import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { isAdminRole, isStaffRole } from '@/lib/profiles'

// Lightweight in-memory cache and rate-limiter. Per-instance and ephemeral on
// Vercel, which is fine at this volume — no need for Redis.
const CACHE = new Map<string, { bio: string; expiresAt: number }>()
const CACHE_TTL_MS = 5 * 60 * 1000
const RATE = new Map<string, { remaining: number; resetAt: number }>()
const RATE_LIMIT = Number(process.env.GENERATE_BIO_RATE_LIMIT || 30) // requests
const RATE_WINDOW = Number(process.env.GENERATE_BIO_RATE_WINDOW_SECONDS || 60) // seconds

/** Collapse whitespace/control chars and cap length before anything touches a prompt. */
function clean(value: unknown, max: number): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

function ageFromBirthdate(birthdate: string): string {
  const d = new Date(birthdate)
  if (Number.isNaN(d.getTime())) return ''
  const now = new Date()
  let age = now.getFullYear() - d.getFullYear()
  const hadBirthday =
    now.getMonth() > d.getMonth() ||
    (now.getMonth() === d.getMonth() && now.getDate() >= d.getDate())
  if (!hadBirthday) age -= 1
  return age >= 0 && age < 30 ? String(age) : ''
}

/** Turn a raw hobby field into a grammatical third-person clause:
 *  "I like to play soccer" → "likes to play soccer"; "soccer" → "enjoys soccer". */
function hobbyClause(raw: string): string {
  const stripped = raw.replace(/\.+$/, '').trim()
  const leadIn = stripped.match(/^i\s+(?:really\s+)?(?:like to|love to)\s+(.+)$/i)
  if (leadIn) return `likes to ${leadIn[1]}`
  const bare = stripped.replace(/^i\s+(?:really\s+)?(?:enjoy|like|love)\s+/i, '')
  if (!bare) return ''
  return `enjoys ${bare.charAt(0).toLowerCase()}${bare.slice(1)}`
}

/** "Soccer Player" → "a soccer player" (article + lowercase for mid-sentence use). */
function cleanCareer(raw: string): string {
  const noun = raw.replace(/\.+$/, '').trim().toLowerCase().replace(/^(a|an)\s+/, '')
  if (!noun) return ''
  const article = /^[aeiou]/.test(noun) ? 'an' : 'a'
  return `${article} ${noun}`
}

type Fields = {
  firstName: string
  lastName: string
  hobby: string
  career: string
  subject: string
  country: string
  age: string
  notes: string
}

/** Grammar-safe template bio — used when no HF key is set or the model call fails. */
function templateBio(f: Fields): string {
  const name = [f.firstName, f.lastName].filter(Boolean).join(' ')
  const parts: string[] = []
  const agePart = f.age ? `a ${f.age}-year-old` : 'a child'
  parts.push(`${name || 'This child'} is ${agePart} from ${f.country || 'their home country'}.`)
  const hobby = hobbyClause(f.hobby)
  if (hobby) {
    // "Erling likes to play soccer." / with no name: "They like to play soccer."
    parts.push(
      f.firstName
        ? `${f.firstName} ${hobby}.`
        : `They ${hobby.replace(/^(likes|enjoys)/, (v) => v.slice(0, -1))}.`,
    )
  }
  if (f.subject) parts.push(`Their favorite subject is ${f.subject}.`)
  const career = cleanCareer(f.career)
  if (career) parts.push(`They dream of becoming ${career} one day.`)
  return parts.join(' ')
}

const SYSTEM_PROMPT = `You write short biographies of children living at a children's home, shown to potential sponsors.

Rules:
- Write in fluent, grammatically correct English, even if the input is in another language.
- Exactly 1-2 sentences, third person, using only the child's first name.
- Rephrase the raw details into natural prose; never copy the input wording verbatim (e.g. turn "I like to play soccer" into "loves playing soccer").
- Tone: warm, hopeful, dignified, age-appropriate.
- The background notes are private staff context. If they describe hardship (orphaned, abandoned, single-parent home, etc.), you may allude to it briefly and gently — never in graphic, pitying, or shaming detail. It is fine to omit it entirely if it cannot be phrased with dignity.
- Never invent facts that are not in the input.
- Output ONLY the bio text: no preamble, no quotation marks, no notes.`

async function modelBio(f: Fields): Promise<string | null> {
  const HF_KEY = process.env.HUGGINGFACE_API_KEY
  if (!HF_KEY) return null
  // Instruction-tuned model via HF's OpenAI-compatible router (the old
  // api-inference.huggingface.co endpoint is deprecated; flan-t5 echoes input).
  const HF_MODEL = process.env.HF_MODEL || 'Qwen/Qwen2.5-7B-Instruct'

  // PII minimization: the model only needs the first name.
  const lines = [
    `First name: ${f.firstName || 'not given'}`,
    `Age: ${f.age || 'not given'}`,
    `Country: ${f.country || 'not given'}`,
    `Hobbies: ${f.hobby || 'not given'}`,
    `Favorite subject: ${f.subject || 'not given'}`,
    `Dream job: ${f.career || 'not given'}`,
    f.notes ? `Background notes (private, handle with care): ${f.notes}` : '',
  ].filter(Boolean)

  try {
    const res = await fetch('https://router.huggingface.co/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${HF_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: HF_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: lines.join('\n') },
        ],
        max_tokens: 150,
        temperature: 0.7,
      }),
    })

    if (!res.ok) {
      // Log server-side only; the caller falls back to the template.
      console.error('[generate-bio] HF error', res.status, await res.text())
      return null
    }

    const json = await res.json()
    const text: string = json?.choices?.[0]?.message?.content ?? ''
    const bio = text.trim().replace(/^["']+|["']+$/g, '')
    return bio || null
  } catch (err) {
    console.error('[generate-bio] HF request failed:', err)
    return null
  }
}

function getClientIp(req: Request) {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? 'unknown'
}

export async function POST(req: Request) {
  // Staff/admin only — this endpoint spends API credits and handles child data.
  const { profile } = await requireAuth()
  if (!isAdminRole(profile.role) && !isStaffRole(profile.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const fields: Fields = {
    firstName: clean(body.first_name, 80),
    lastName: clean(body.last_name, 80),
    hobby: clean(body.hobby, 200),
    career: clean(body.career_aspiration, 120),
    subject: clean(body.favorite_subject, 120),
    country: clean(body.country, 80),
    age: body.birthdate ? ageFromBirthdate(String(body.birthdate)) : '',
    notes: clean(body.quick_notes, 600),
  }
  const usedQuickNotes = Boolean(fields.notes)

  // Cache first (includes notes — a notes change must regenerate) so cached
  // hits don't spend rate-limit budget or tokens.
  const cacheKey = JSON.stringify(fields)
  const cached = CACHE.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json({ bio: cached.bio, used_quick_notes: usedQuickNotes, cached: true })
  }

  // Per-client rate limit to avoid accidental large usage.
  const clientIp = getClientIp(req)
  const now = Date.now()
  const rate = RATE.get(clientIp)
  if (!rate || rate.resetAt <= now) {
    RATE.set(clientIp, { remaining: RATE_LIMIT - 1, resetAt: now + RATE_WINDOW * 1000 })
  } else if (rate.remaining <= 0) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  } else {
    RATE.set(clientIp, { remaining: rate.remaining - 1, resetAt: rate.resetAt })
  }

  // Model when configured, template otherwise — and template again if the
  // model call fails, so the button always produces something.
  const bio = (await modelBio(fields)) ?? templateBio(fields)

  CACHE.set(cacheKey, { bio, expiresAt: Date.now() + CACHE_TTL_MS })
  return NextResponse.json({ bio, used_quick_notes: usedQuickNotes })
}
