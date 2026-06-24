import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { PhotoViewer } from './components/PhotoViewer'
import { AuditLogSection } from './components/AuditLogSection'
import { IntakeSection } from './components/IntakeSection'
import { getEligibleIntakeForms } from './intake-actions'
import { calculateAge } from '@/components/actions'
import { resolvePhotoSrc, resolveVideo } from '@/lib/childMedia'
import type { Child } from '@/lib/types'

type ChildWithCreator = Child & {
  creator?: {
    full_name: string | null
    role: string | null
  } | null
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="py-3 border-b border-gray-50 last:border-0">
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className={`text-sm ${value ? 'text-gray-800' : 'text-gray-300'}`}>{value || '—'}</p>
    </div>
  )
}

const donorDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
})

function safeDate(value: string | null): Date | null {
  if (!value) return null
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T12:00:00`
    : value
  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date
}

function donorDateLabel(value: string | null): string | null {
  const date = safeDate(value)
  return date ? donorDateFormatter.format(date) : null
}

function donorChildName(child: Child): string {
  return (
    [child.first_name, child.last_name].filter(Boolean).join(' ') ||
    child.display_name ||
    'Unnamed'
  )
}

function donorHobbies(child: Child): string[] {
  return (child.hobby ?? '')
    .split(',')
    .map((hobby) => hobby.trim())
    .filter(Boolean)
}

function donorSentenceList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')}, and ${items.at(-1)}`
}

function DonorProfileFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-[#eadfd0] bg-[#f6f1e8] px-3 py-3">
      <dt className="text-xs font-bold uppercase tracking-[0.18em] text-navy/45">
        {label}
      </dt>
      <dd className="mt-1 text-base font-bold leading-snug text-[#241b16]">
        {value}
      </dd>
    </div>
  )
}

function DonorChildDetail({ child }: { child: Child }) {
  const name = donorChildName(child)
  const firstName = child.first_name || child.display_name || name
  const age = calculateAge(child.birth_year, child.birth_month, child.birth_day)
  const birthdate = child.birth_year && child.birth_month && child.birth_day
    ? donorDateFormatter.format(new Date(child.birth_year, child.birth_month - 1, child.birth_day))
    : null
  const joined = donorDateLabel(child.date_joined) ?? (child.year_joined ? String(child.year_joined) : 'Unknown')
  const hobbies = donorHobbies(child)
  const photoSrc = resolvePhotoSrc(child.profile_photo, 1800)
  const video = resolveVideo(child.profile_video)
  const storyParts = [
    child.bio?.trim() ||
      `My name is ${name}. ${age ? `I am ${age} years old. ` : ''}${child.country ? `I live at the Children's Home in ${child.country}. ` : ''}`,
    child.favorite_subject ? `My favorite subject is ${child.favorite_subject}.` : null,
    hobbies.length > 0 ? ` ${donorSentenceList(hobbies)}.` : null,
    child.career_aspiration ? `When I grow up, I hope to be ${child.career_aspiration}.` : null,
  ].filter((part): part is string => Boolean(part))

  return (
    <div className="google-sans-page min-h-[calc(100svh_-_4rem)] bg-[#f8f1e8]">
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <Link
          href="/dashboard/children"
          className="inline-flex items-center rounded-full border border-[#e1d6c7] bg-white/70 px-4 py-2 text-sm font-bold text-navy/70 transition-colors hover:text-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
        >
          Back to my sponsorships
        </Link>

        <article className="mt-8 overflow-hidden rounded-[2rem] border border-[#eadfd0] border-t-8 border-teal/80 bg-[#fffdf8] shadow-[0_24px_60px_rgba(21,44,75,0.10)]">
          <div className="space-y-8 p-5 sm:p-8 lg:p-10">
            <div className="flex flex-col gap-6 md:flex-row md:items-start">
              <div className="mx-auto w-full max-w-[18rem] shrink-0 overflow-hidden rounded-[1.75rem] border border-[#eadfd0] bg-[#f6f1e8] shadow-[0_18px_45px_rgba(21,44,75,0.10)] md:mx-0 md:w-72 lg:w-80">
                <div className="flex aspect-[3/4] w-full items-center justify-center">
                  {photoSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element -- donor media can be S3 or Google Drive URLs resolved at runtime.
                    <img
                      src={photoSrc}
                      alt={`${name} profile photo`}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-teal text-6xl font-bold text-white sm:text-8xl">
                      {(child.first_name?.slice(0, 2) || child.display_name?.slice(0, 2) || '?').toUpperCase()}
                    </div>
                  )}
                </div>
              </div>

              <div className="min-w-0 flex-1 md:pt-2">
                <p className="text-xs font-bold uppercase tracking-[0.28em] text-teal">
                  {child.country || 'Sponsorship profile'}
                </p>
                <h1 className="mt-3 font-serif text-5xl font-bold leading-none tracking-tight text-[#241b16] sm:text-6xl">
                  {name}
                </h1>
                <p className="mt-4 text-base font-semibold leading-7 text-[#7a6d5d]">
                  {age ? `${age} years old` : 'Age being prepared'}
                  {birthdate ? ` - Born ${birthdate}` : ''}
                </p>
                <dl className="mt-5 grid grid-cols-2 gap-2">
                  <DonorProfileFact label="Country" value={child.country || 'To be added'} />
                  <DonorProfileFact label="Date joined" value={joined} />
                  <DonorProfileFact label="Favorite subject" value={child.favorite_subject || 'To be added'} />
                  <DonorProfileFact label="Hobbies" value={hobbies.length > 0 ? donorSentenceList(hobbies) : 'To be added'} />
                </dl>
              </div>
            </div>

            <section className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-[0.28em] text-teal">
                My story
              </h2>
              <div className="space-y-3 font-serif text-xl italic leading-9 text-[#2d241d] sm:text-2xl sm:leading-10">
                <p>Dearest Sponsor,</p>
                {storyParts.map((part, index) => (
                  <p key={index}>{part}</p>
                ))}
                <p>Thank you for sponsoring me and loving me. I pray that God will bless you too!</p>
              </div>
            </section>

            {video.kind !== 'none' && (
              <section className="overflow-hidden rounded-3xl border border-teal/10 bg-sky/65">
                <div className="aspect-video overflow-hidden bg-sky">
                  {video.kind === 'drive' ? (
                    <iframe
                      src={video.src}
                      allow="autoplay"
                      allowFullScreen
                      className="h-full w-full"
                      title={`${firstName} video`}
                    />
                  ) : (
                    <video
                      src={video.src}
                      controls
                      preload="metadata"
                      className="h-full w-full"
                    />
                  )}
                </div>
                <div className="px-5 py-4">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal">
                    Video message
                  </p>
                  <p className="mt-1 text-base font-bold text-[#241b16]">
                    A message from {firstName}
                  </p>
                </div>
              </section>
            )}
          </div>
        </article>
      </main>
    </div>
  )
}

export default async function ChildProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return redirect('/login?error=SessionExpired')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, country')
    .eq('id', user.id)
    .single() as { data: { role: string; country: string | string[] | null } | null; error: unknown }

  if (!profile || (profile.role !== 'admin' && profile.role !== 'staff' && profile.role !== 'donor')) {
    return redirect('/login?error=Unauthorized')
  }

  if (profile.role === 'donor') {
    const donorChildResult = await supabase
      .from('children')
      .select('*')
      .eq('id', id)
      .single()
    const donorChild = donorChildResult.data as Child | null

    if (!donorChild) return notFound()
    return <DonorChildDetail child={donorChild} />
  }

  const childResult = await supabase
    .from('children')
    .select(`
      *,
      creator:created_by (
        full_name,
        role
      )
    `)
    .eq('id', id)
    .single()
  const child = childResult.data as ChildWithCreator | null

  if (!child) return notFound()

  // Evaluate eligible records server-side
  const { eligibleForms, latestCompleted } = await getEligibleIntakeForms(
    child.id,
    child.country ?? '',
    child.date_joined,
    child.year_joined
  )

  const dynamicAge = calculateAge(child.birth_year, child.birth_month, child.birth_day)
  const name = [child.first_name, child.last_name].filter(Boolean).join(' ') || 'Unnamed'
  const isActive = child.status === 'active'
  const video = resolveVideo(child.profile_video)
  
  const birthdate = child.birth_year && child.birth_month && child.birth_day
    ? new Date(child.birth_year, child.birth_month - 1, child.birth_day).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  const dateJoined = child.date_joined
    ? new Date(child.date_joined).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : child.year_joined ? `${child.year_joined}` : null

  return (
    <div className="min-h-[calc(100svh_-_4rem)] bg-gray-50 flex flex-col">
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-4 flex items-center gap-3">
        <Link href="/dashboard/children" className="text-gray-500 hover:text-gray-800 text-sm font-medium">
          ← Back
        </Link>
        <div className="flex-1" />
        <Link
          href={`/dashboard/children/${id}/edit`}
          className="text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg px-3 py-1.5 transition-colors"
        >
          Edit
        </Link>
      </div>

      <div className="flex-1 max-w-lg mx-auto w-full px-4 py-6 space-y-5">
        <div className="flex flex-col items-center gap-3 pt-2">
          <PhotoViewer
            src={child.profile_photo ?? ""}
            alt={name}
            fallbackInitial={child.first_name?.[0] ?? '?'}
          />
          <div className="text-center">
            <h1 className="text-xl font-bold text-gray-900">{name}</h1>
            <p className={`text-sm font-mono mt-0.5 ${child.id_rolf ? 'text-gray-400' : 'text-gray-300'}`}>{child.id_rolf || 'ROLF ID Unknown'}</p>
            <span className={`inline-block mt-2 text-xs px-2.5 py-0.5 rounded-full font-medium ${isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {child.status}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl border border-gray-100 p-3 flex flex-col items-center justify-center text-center">
            <p className="text-lg font-bold text-gray-900">{dynamicAge}</p>
            <p className="text-xs text-gray-400">years old</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-3 flex flex-col items-center justify-center text-center">
            <p className={`text-sm font-bold truncate w-full ${child.country ? 'text-gray-900' : 'text-gray-300'}`}>{child.country || '—'}</p>
            <p className="text-xs text-gray-400">country</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-3 flex flex-col items-center justify-center text-center">
            <p className={`text-lg font-bold ${child.date_joined || child.year_joined ? 'text-gray-900' : 'text-gray-300'}`}>
              {child.date_joined ? new Date(child.date_joined).getFullYear() : child.year_joined || '—'}
            </p>
            <p className="text-xs text-gray-400">joined</p>
          </div>
        </div>

        {/* Mapped custom workbook worksheets panel */}
        <IntakeSection 
          childId={id} 
          eligibleForms={eligibleForms} 
          latestCompleted={latestCompleted} 
        />

        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          {video.kind === "file" ? (
            <video src={video.src} controls className="w-full aspect-video" />
          ) : video.kind === "drive" ? (
            <iframe
              src={video.src}
              allow="autoplay"
              allowFullScreen
              className="w-full aspect-video"
              title={`${name} video`}
            />
          ) : (
            <div className="aspect-video bg-gray-100 flex flex-col items-center justify-center gap-2">
              <span className="text-3xl">🎥</span>
              <p className="text-xs text-gray-400">No video uploaded yet</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-100 px-4">
          <DetailRow label="Date of Birth" value={birthdate} />
          <DetailRow label="Date Joined" value={dateJoined} />
          <DetailRow label="Career Aspiration" value={child.career_aspiration} />
          <DetailRow label="Favorite Subject" value={child.favorite_subject} />
          <DetailRow label="Hobbies" value={child.hobby} />
          <DetailRow label="Bio" value={child.bio} />
        </div>

        {/* Internal Notes Segment */}
        <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
          <p className="text-xs font-semibold text-amber-600 mb-1">Internal Notes</p>
          {child.notes?.trim() ? (
            <p className="text-sm text-amber-800 whitespace-pre-wrap">{child.notes}</p>
          ) : (
            <p className="text-sm text-amber-400 italic">No internal notes added yet.</p>
          )}
        </div>

        {/* Read-only historical timeline view */}
        {profile.role === 'admin' && (
          <AuditLogSection
            editLog={child.edit_log}
            createdAt={child.created_at}
            creatorName={child.creator?.full_name || null}
            creatorRole={child.creator?.role || null}
          />
        )}
      </div>
    </div>
  )
}
