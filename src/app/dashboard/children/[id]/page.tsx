import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ProfileMediaViewer } from './components/ProfileMediaViewer'
import { AuditLogSection } from './components/AuditLogSection'
import { IntakeSection } from './components/IntakeSection'
import { PenPalSection } from './components/PenPalSection'
import { LibraryViewer, type MediaItem } from './components/LibraryViewer'
import { getEligibleIntakeForms } from './intake-actions'
import { calculateAge } from '@/components/actions'
import { ArrowLeftIcon, PrinterIcon } from 'lucide-react'
import { ensureBioIncludesAgeAndCountry, homeDurationFromDate, splitBioClosing } from '@/lib/bio'
import { resolvePhotoSrc, resolveVideo } from '@/lib/childMedia'
import type { Child, ChildWithMediaRefs, SponsorshipFrequency } from '@/lib/types'
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
    <div className="flex flex-col gap-2 border-b border-stone py-4 last:border-0 sm:py-5">
      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-navy/45 sm:text-sm">
        {label}
      </span>
      <span className={`text-base font-bold leading-relaxed sm:text-lg ${value ? 'text-navy' : 'text-navy/40 italic'}`}>
        {value || emptyLabel}
      </span>
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

const shortDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

function shortDateLabel(value: string | null): string | null {
  const date = safeDate(value)
  return date ? shortDateFormatter.format(date) : null
}

const FREQUENCY_LABELS: Record<NonNullable<SponsorshipFrequency>, string> = {
  one_time: 'One-time',
  weekly: '/week',
  biweekly: '/biweekly',
  monthly: '/month',
  quarterly: '/quarter',
  semiannual: '/6 months',
  annual: '/year',
}

function formatContribution(amount: number | null, frequency: SponsorshipFrequency | null): string {
  if (!amount) return 'On file'
  const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount)
  if (!frequency || frequency === 'one_time') return usd
  return `${usd}${FREQUENCY_LABELS[frequency]}`
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

function capitalizeFirst(value: string): string {
  const trimmed = value.trim()
  return trimmed ? trimmed.charAt(0).toUpperCase() + trimmed.slice(1) : trimmed
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

// ⚡ INJECT PORTFOLIO PROPS DOWNSTREAM
function DonorChildDetail({
  child,
  libraryItems,
  sponsorshipStart,
  sponsorshipEnd,
  amount,
  frequency,
}: {
  child: Child
  libraryItems: MediaItem[]
  sponsorshipStart: string | null
  sponsorshipEnd: string | null
  amount: number | null
  frequency: SponsorshipFrequency | null
}) {
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
    ? splitBioClosing(displayBioText)
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
                    // eslint-disable-next-line @next/next/no-img-element -- child media can be S3 or Google Drive URLs that are resolved at runtime.
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
                  <DonorProfileFact label="Career aspiration" value={child.career_aspiration ? capitalizeFirst(child.career_aspiration) : 'To be added'} />
                  <DonorProfileFact label="Sponsorship since" value={sponsorshipStart ? shortDateLabel(sponsorshipStart) ?? 'Active' : 'Active'} />
                  <DonorProfileFact label="Contribution" value={formatContribution(amount, frequency)} />
                  <DonorProfileFact label="End date" value={sponsorshipEnd ? shortDateLabel(sponsorshipEnd) ?? 'Ongoing' : 'Ongoing'} />
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

            {/* ⚡ INTEGRATE SEAMLESS DONOR VIEW COMPONENT CONTAINER FRAME */}
            {libraryItems.length > 0 && (
              <section className="pt-2">
                {/* Fixed: Passed child.id as childId prop */}
                <LibraryViewer childId={child.id} mediaLibrary={libraryItems} />
              </section>
            )}

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
    .maybeSingle() as { data: { role: string; country: string | string[] | null } | null; error: unknown }

  if (!profile || (profile.role !== 'admin' && profile.role !== 'staff' && profile.role !== 'donor')) {
    return redirect('/login?error=Unauthorized')
  }

  // ⚡ COMPREHENSIVE BATCH GATHER TRACK: Fetches portfolio rows for the child
  const { data: mediaLibraryRows } = await supabase
    .from('child_media')
    .select('id, url, media_type, filename, usage_type, created_at') // Make sure usage_type and created_at are included
    .eq('child_id', id)
    .order('created_at', { ascending: false }) as { data: MediaItem[] | null }

  const libraryItems = mediaLibraryRows || []

  if (profile.role === 'donor') {
    const donorChildResult = await supabase
      .from('children')
      .select(`
        *,
        profile_photo:child_media!fk_children_profile_photo(id, url),
        profile_video:child_media!fk_children_profile_video(id, url)
      `)
      .eq('id', id)
      .single()
    const rawDonorChild = donorChildResult.data as ChildWithMediaRefs | null

    if (!rawDonorChild) return notFound()

    const donorChild: Child = {
      ...rawDonorChild,
      profile_photo: rawDonorChild.profile_photo?.url ?? null,
      profile_video: rawDonorChild.profile_video?.url ?? null
    }

    // Sponsorship facts (since/contribution/end date) so this page matches
    // the summary already shown on the sponsored-children list card.
    const { data: sponsorshipRow } = await supabase
      .from('sponsorships')
      .select('start_date, end_date, amount, frequency')
      .eq('child_id', id)
      .eq('status', 'active')
      .maybeSingle()

    return (
      <DonorChildDetail
        child={donorChild}
        libraryItems={libraryItems}
        sponsorshipStart={sponsorshipRow?.start_date ?? null}
        sponsorshipEnd={sponsorshipRow?.end_date ?? null}
        amount={sponsorshipRow?.amount ?? null}
        frequency={sponsorshipRow?.frequency ?? null}
      />
    )
  }

  const childResult = await supabase
    .from('children')
    .select(`
      *,
      profile_photo:child_media!fk_children_profile_photo(id, url),
      profile_video:child_media!fk_children_profile_video(id, url),
      creator:created_by (
        full_name,
        role
      )
    `)
    .eq('id', id)
    .single()
  const rawChild = childResult.data as (ChildWithMediaRefs & { creator?: { full_name: string | null; role: string | null } | null }) | null

  if (!rawChild) return notFound()

  const child: ChildWithCreator & { profile_photo_id?: string | null; profile_video_id?: string | null } = {
    ...rawChild,
    profile_photo: rawChild.profile_photo?.url ?? null,
    profile_video: rawChild.profile_video?.url ?? null,
    profile_photo_id: rawChild.profile_photo?.id ?? null,
    profile_video_id: rawChild.profile_video?.id ?? null
  }

  const eligibleFormsResult = await getEligibleIntakeForms(
    child.id,
    child.country ?? '',
    child.date_joined,
    child.year_joined
  )
  const eligibleForms = eligibleFormsResult.eligibleForms
  const latestCompleted = eligibleFormsResult.latestCompleted

  const dynamicAge = calculateAge(child.birth_year, child.birth_month, child.birth_day)
  const name = [child.first_name, child.last_name].filter(Boolean).join(' ') || t(messages, 'children.card.unnamed')
  const isActive = child.status === 'active'
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
    <div className="google-sans-registry flex min-h-[calc(100svh_-_4rem)] flex-col bg-ice/40">
      <div className="flex items-center gap-3 border-b border-stone bg-white px-5 py-4 shadow-2xs sm:px-8 sm:py-5">
        <Link href="/dashboard/children" className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[0.12em] text-navy/60 transition-colors hover:text-navy sm:text-base">
          <ArrowLeftIcon className="size-4 sm:size-5" />
          <span>{t(messages, 'children.detail.backRegistry')}</span>
        </Link>
        <div className="flex-1" />
        {profile.role === 'admin' && (
          <Link
            href={`/print/children/${id}`}
            className="inline-flex items-center gap-2 rounded-lg border border-stone bg-white px-4 py-2 text-sm font-bold text-navy shadow-2xs transition-all hover:bg-ice sm:px-5 sm:py-2.5 sm:text-base"
          >
            <PrinterIcon className="size-4 sm:size-5" aria-hidden="true" />
            {t(messages, 'children.detail.printTemplate')}
          </Link>
        )}
        <Link
          href={`/dashboard/children/${id}/edit`}
          className="rounded-lg bg-teal px-4 py-2 text-sm font-bold text-white shadow-2xs transition-all hover:bg-teal/90 sm:px-5 sm:py-2.5 sm:text-base"
        >
          {t(messages, 'children.detail.editProfile')}
        </Link>
      </div>

      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-7 px-5 py-9 sm:gap-8 sm:px-6 sm:py-12">
        <div className="flex flex-col items-center gap-4 pt-1 text-center sm:gap-5">
          <ProfileMediaViewer
            photoSrc={child.profile_photo ?? ""}
            videoSrc={child.profile_video ?? ""}
            alt={name}
            fallbackInitial={child.first_name?.[0] ?? '?'}
            videoTitle={t(messages, 'children.detail.videoTitle').replace('{name}', name)}
          />
          <div>
            <h1 className="text-4xl font-bold leading-tight tracking-tight text-navy sm:text-5xl">{name}</h1>
            <p className={`mt-1 font-mono text-base ${child.id_rolf ? 'font-semibold text-teal' : 'text-navy/30'}`}>
              {child.id_rolf || t(messages, 'children.card.rolfIdUnknown')}
            </p>
            
            <span className={`mt-3 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-base font-bold ${
              isActive ? "border-teal/50 bg-teal/10 text-teal" : "border-stone bg-ice text-navy/55"
            }`}>
              <span className={`size-2 rounded-full ${isActive ? "bg-teal" : "bg-navy/35"}`} aria-hidden="true" />
              {statusLabel}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 sm:gap-5">
          <div className="flex min-h-28 flex-col items-center justify-center rounded-xl border border-stone bg-white p-4 text-center shadow-2xs sm:min-h-32 sm:p-5">
            <p className="text-3xl font-bold text-navy sm:text-4xl">{dynamicAge}</p>
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-navy/45 sm:text-sm">{t(messages, 'children.detail.yearsOld')}</p>
          </div>
          <div className="flex min-h-28 flex-col items-center justify-center rounded-xl border border-stone bg-white p-4 text-center shadow-2xs sm:min-h-32 sm:p-5">
            <p className={`w-full break-words text-sm font-bold leading-tight sm:text-xl ${child.country ? 'text-navy' : 'text-navy/30'}`}>{child.country || '—'}</p>
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-navy/45 sm:text-sm">{t(messages, 'children.card.country')}</p>
          </div>
          <div className="flex min-h-28 flex-col items-center justify-center rounded-xl border border-stone bg-white p-4 text-center shadow-2xs sm:min-h-32 sm:p-5">
            <p className={`text-3xl font-bold sm:text-4xl ${child.date_joined || child.year_joined ? 'font-mono text-navy' : 'text-navy/30'}`}>
              {child.date_joined ? new Date(child.date_joined).getFullYear() : child.year_joined || '—'}
            </p>
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-navy/45 sm:text-sm">{t(messages, 'children.card.joined')}</p>
          </div>
        </div>

        <IntakeSection 
          childId={id} 
          eligibleForms={eligibleForms} 
          latestCompleted={latestCompleted} 
        />

        <div className="rounded-xl border border-stone bg-white px-6 shadow-2xs sm:px-8">
          <DetailRow label={t(messages, 'children.detail.dateOfBirth')} value={birthdate} emptyLabel={notRecorded} />
          <DetailRow label={t(messages, 'children.detail.dateJoined')} value={dateJoined} emptyLabel={notRecorded} />
          <DetailRow label={t(messages, 'children.detail.careerAspiration')} value={child.career_aspiration} emptyLabel={notRecorded} />
          <DetailRow label={t(messages, 'children.detail.favoriteSubject')} value={child.favorite_subject} emptyLabel={notRecorded} />
          <DetailRow label={t(messages, 'children.detail.hobbies')} value={child.hobby} emptyLabel={notRecorded} />
          <DetailRow label={t(messages, 'children.detail.bio')} value={detailBio} emptyLabel={notRecorded} />
        </div>

        <div className="space-y-4 rounded-xl border border-amber-200/80 bg-amber-50/60 px-6 py-6 shadow-2xs sm:px-8">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-amber-900">{t(messages, 'children.detail.internalNotes')}</p>
          {child.notes?.trim() ? (
            <p className="whitespace-pre-wrap text-lg font-medium leading-relaxed text-amber-950">{child.notes}</p>
          ) : (
            <p className="text-base font-medium italic text-amber-900/50">{t(messages, 'children.detail.noInternalNotes')}</p>
          )}
        </div>

        {/* ⚡ INTEGRATE SEAMLESS STAFF REGISTRY VIEW COMPONENT GRID */}
        {libraryItems.length > 0 && (
          <div className="rounded-xl border border-stone bg-white p-6 shadow-2xs sm:p-8">
            {/* Fixed: Passed id as childId prop */}
            <LibraryViewer childId={id} mediaLibrary={libraryItems} canManageProfileMedia />
          </div>
        )}

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
