import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { PhotoViewer } from './components/PhotoViewer'
import { AuditLogSection } from './components/AuditLogSection'
import { IntakeSection } from './components/IntakeSection'
import { PenPalSection } from './components/PenPalSection'
import { getEligibleIntakeForms } from './intake-actions'
import { calculateAge } from '@/components/actions'
import { ArrowLeftIcon, VideoIcon } from 'lucide-react'
import { ensureBioIncludesAgeAndCountry, homeDurationFromDate } from '@/lib/bio'
import { resolvePhotoSrc, resolveVideo } from '@/lib/childMedia'
import type { Child } from '@/lib/types'
import { getMessages, getUserLocale } from '@/i18n/server'
import type { Locale } from '@/i18n/config'
import type { MessageKey, Messages } from '@/i18n/locales/en'

type ChildWithCreator = Child & {
  creator?: {
    full_name: string | null
    role: string | null
  } | null
}

function DetailRow({
  label,
  value,
  emptyLabel,
}: {
  label: string
  value: string | null | undefined
  emptyLabel: string
}) {
  return (
    <div className="py-3 border-b border-stone last:border-0 flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-[0.13em] text-navy/45">{label}</span>
      <span className={`text-xs font-semibold ${value ? 'text-navy' : 'text-navy/40 italic'}`}>{value || emptyLabel}</span>
    </div>
  )
}

function t(messages: Messages, key: MessageKey): string {
  return messages[key]
}

function dateLocale(locale: Locale) {
  return locale === 'fr' ? 'fr-FR' : 'en-GB'
}

function longDate(value: Date, locale: Locale): string {
  return value.toLocaleDateString(dateLocale(locale), { day: 'numeric', month: 'long', year: 'numeric' })
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
  const bioAge = child.birth_year ? age : null
  const homeDuration = homeDurationFromDate(child.date_joined ?? (child.year_joined ? `${child.year_joined}-01-01` : null))
  // A saved bio is the child's whole letter (generated bios are self-contained
  // and end with a blessing). The assembled sentences are only a fallback for
  // children without one; their facts still show in the grid above.
  const bioText = child.bio?.trim()
  const displayBioText = bioText
    ? ensureBioIncludesAgeAndCountry(bioText, { age: bioAge, country: child.country, homeDuration })
    : null
  const storyParts = displayBioText
    ? [displayBioText]
    : [
        `My name is ${name}. ${bioAge !== null ? `I am ${bioAge} years old. ` : ''}${child.country ? `I live at the Children's Home in ${child.country}. ` : ''}${homeDuration ? `I have been at the Children's Home for ${homeDuration}. ` : ''}`,
        child.favorite_subject ? `My favorite subject is ${child.favorite_subject}.` : null,
        hobbies.length > 0 ? ` ${donorSentenceList(hobbies)}.` : null,
        child.career_aspiration ? `When I grow up, I hope to be ${child.career_aspiration}.` : null,
      ].filter((part): part is string => Boolean(part))
  // Older bios don't end with a blessing — keep the template closing for those.
  const bioHasBlessing = displayBioText ? /god bless/i.test(displayBioText) : false

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
                {!bioHasBlessing && (
                  <p>Thank you for sponsoring me and loving me. I pray that God will bless you too!</p>
                )}
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

            <PenPalSection childId={child.id} childName={firstName} />
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
  const locale = await getUserLocale(user.id)
  const messages = getMessages(locale)

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

  const { eligibleForms, latestCompleted } = await getEligibleIntakeForms(
    child.id,
    child.country ?? '',
    child.date_joined,
    child.year_joined
  )

  const dynamicAge = calculateAge(child.birth_year, child.birth_month, child.birth_day)
  const name = [child.first_name, child.last_name].filter(Boolean).join(' ') || t(messages, 'children.card.unnamed')
  const isActive = child.status === 'active'
  const video = resolveVideo(child.profile_video)
  const statusLabel = isActive ? t(messages, 'children.registry.active') : t(messages, 'children.registry.inactive')
  const notRecorded = t(messages, 'children.card.notRecorded')
  const detailBio = child.bio?.trim()
    ? ensureBioIncludesAgeAndCountry(child.bio, {
        age: child.birth_year ? dynamicAge : null,
        country: child.country,
        homeDuration: homeDurationFromDate(child.date_joined ?? (child.year_joined ? `${child.year_joined}-01-01` : null)),
      })
    : null
  
  const birthdate = child.birth_year && child.birth_month && child.birth_day
    ? longDate(new Date(child.birth_year, child.birth_month - 1, child.birth_day), locale)
    : null

  const dateJoined = child.date_joined
    ? longDate(new Date(child.date_joined), locale)
    : child.year_joined ? `${child.year_joined}` : null

  return (
    <div className="google-sans-registry min-h-[calc(100svh_-_4rem)] bg-ice/40 flex flex-col">
      <div className="sticky top-0 z-10 bg-white border-b border-stone px-4 py-3.5 flex items-center gap-3 shadow-2xs">
        <Link href="/dashboard/children" className="inline-flex items-center gap-1.5 text-navy/60 hover:text-navy text-xs font-bold uppercase tracking-wider transition-colors">
          <ArrowLeftIcon className="size-3.5" />
          <span>{t(messages, 'children.detail.backRegistry')}</span>
        </Link>
        <div className="flex-1" />
        <Link
          href={`/dashboard/children/${id}/edit`}
          className="text-xs font-bold text-white bg-teal hover:bg-teal/90 rounded-md px-3.5 py-1.5 transition-all shadow-2xs"
        >
          {t(messages, 'children.detail.editProfile')}
        </Link>
      </div>

      <div className="flex-1 max-w-lg mx-auto w-full px-4 py-8 space-y-6">
        <div className="flex flex-col items-center gap-3 pt-1">
          <PhotoViewer
            src={child.profile_photo ?? ""}
            alt={name}
            fallbackInitial={child.first_name?.[0] ?? '?'}
          />
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight text-navy">{name}</h1>
            <p className={`text-xs font-mono mt-0.5 ${child.id_rolf ? 'text-teal font-semibold' : 'text-navy/30'}`}>{child.id_rolf || t(messages, 'children.card.rolfIdUnknown')}</p>
            
            {/* Standard ROLF Status Badge */}
            <span className={`mt-2.5 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold ${
              isActive ? "border-teal/50 bg-teal/10 text-teal" : "border-stone bg-ice text-navy/55"
            }`}>
              <span className={`size-1.5 rounded-full ${isActive ? "bg-teal" : "bg-navy/35"}`} aria-hidden="true" />
              {statusLabel}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-md border border-stone p-3.5 flex flex-col items-center justify-center text-center shadow-2xs">
            <p className="text-lg font-bold text-navy">{dynamicAge}</p>
            <p className="text-[10px] font-medium uppercase tracking-wider text-navy/45 mt-0.5">{t(messages, 'children.detail.yearsOld')}</p>
          </div>
          <div className="bg-white rounded-md border border-stone p-3.5 flex flex-col items-center justify-center text-center shadow-2xs">
            <p className={`text-xs font-bold truncate w-full ${child.country ? 'text-navy' : 'text-navy/30'}`}>{child.country || '—'}</p>
            <p className="text-[10px] font-medium uppercase tracking-wider text-navy/45 mt-0.5">{t(messages, 'children.card.country')}</p>
          </div>
          <div className="bg-white rounded-md border border-stone p-3.5 flex flex-col items-center justify-center text-center shadow-2xs">
            <p className={`text-lg font-bold ${child.date_joined || child.year_joined ? 'text-navy font-mono' : 'text-navy/30'}`}>
              {child.date_joined ? new Date(child.date_joined).getFullYear() : child.year_joined || '—'}
            </p>
            <p className="text-[10px] font-medium uppercase tracking-wider text-navy/45 mt-0.5">{t(messages, 'children.card.joined')}</p>
          </div>
        </div>

        {/* Mapped custom intake worksheet orchestrator */}
        <IntakeSection 
          childId={id} 
          eligibleForms={eligibleForms} 
          latestCompleted={latestCompleted} 
        />

        <div className="bg-white rounded-md border border-stone overflow-hidden shadow-2xs">
          {video.kind === "file" ? (
            <video src={video.src} controls className="w-full aspect-video object-cover" />
          ) : video.kind === "drive" ? (
            <iframe
              src={video.src}
              allow="autoplay"
              allowFullScreen
              className="w-full aspect-video border-0"
              title={t(messages, 'children.detail.videoTitle').replace('{name}', name)}
            />
          ) : (
            <div className="aspect-video bg-ice flex flex-col items-center justify-center gap-2 p-4 text-center">
              <VideoIcon className="size-8 text-navy/25" aria-hidden="true" />
              <p className="text-xs font-semibold text-navy/45">{t(messages, 'children.detail.noVideo')}</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-md border border-stone px-5 shadow-2xs">
          <DetailRow label={t(messages, 'children.detail.dateOfBirth')} value={birthdate} emptyLabel={notRecorded} />
          <DetailRow label={t(messages, 'children.detail.dateJoined')} value={dateJoined} emptyLabel={notRecorded} />
          <DetailRow label={t(messages, 'children.detail.careerAspiration')} value={child.career_aspiration} emptyLabel={notRecorded} />
          <DetailRow label={t(messages, 'children.detail.favoriteSubject')} value={child.favorite_subject} emptyLabel={notRecorded} />
          <DetailRow label={t(messages, 'children.detail.hobbies')} value={child.hobby} emptyLabel={notRecorded} />
          <DetailRow label={t(messages, 'children.detail.bio')} value={detailBio} emptyLabel={notRecorded} />
        </div>

        {/* Internal Notes Segment */}
        <div className="bg-amber-50/60 border border-amber-200/80 rounded-md px-5 py-4 shadow-2xs space-y-1.5">
          <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-amber-900">{t(messages, 'children.detail.internalNotes')}</p>
          {child.notes?.trim() ? (
            <p className="text-xs text-amber-950 font-medium whitespace-pre-wrap leading-relaxed">{child.notes}</p>
          ) : (
            <p className="text-xs text-amber-900/50 italic font-medium">{t(messages, 'children.detail.noInternalNotes')}</p>
          )}
        </div>

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
