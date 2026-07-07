import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { PhotoViewer } from './components/PhotoViewer'
import { AuditLogSection } from './components/AuditLogSection'
import { IntakeSection } from './components/IntakeSection'
import { LibraryViewer } from './components/LibraryViewer' // ⚡ IMPORT LINKED
import { getEligibleIntakeForms } from './intake-actions'
import { calculateAge } from '@/components/actions'
import { ArrowLeftIcon, VideoIcon } from 'lucide-react'
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
    <div className="py-3 border-b border-stone last:border-0 flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-[0.13em] text-navy/45">{label}</span>
      <span className={`text-xs font-semibold ${value ? 'text-navy' : 'text-navy/40 italic'}`}>{value || 'Not recorded'}</span>
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

// ⚡ INJECT PORTFOLIO PROPS DOWNSTREAM
function DonorChildDetail({ child, libraryItems }: { child: Child; libraryItems: any[] }) {
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

            {/* ⚡ INTEGRATE SEAMLESS DONOR VIEW COMPONENT CONTAINER FRAME */}
            {libraryItems.length > 0 && (
              <section className="pt-2">
                <LibraryViewer mediaLibrary={libraryItems} />
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
    .maybeSingle() as { data: { role: string; country: string | string[] | null } | null; error: unknown }

  if (!profile || (profile.role !== 'admin' && profile.role !== 'staff' && profile.role !== 'donor')) {
    return redirect('/login?error=Unauthorized')
  }

  // ⚡ COMPREHENSIVE BATCH GATHER TRACK: Fetches portfolio rows for the child
  const { data: mediaLibraryRows } = await supabase
    .from('child_media')
    .select('id, url, media_type, filename')
    .eq('child_id', id)
    .order('created_at', { ascending: false }) as { data: any[] | null }

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
    const rawDonorChild = donorChildResult.data as any

    if (!rawDonorChild) return notFound()

    const donorChild: Child = {
      ...rawDonorChild,
      profile_photo: rawDonorChild.profile_photo?.url ?? null,
      profile_video: rawDonorChild.profile_video?.url ?? null
    }

    return <DonorChildDetail child={donorChild} libraryItems={libraryItems} />
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
  const rawChild = childResult.data as any

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
    <div className="google-sans-registry min-h-[calc(100svh_-_4rem)] bg-ice/40 flex flex-col">
      <div className="sticky top-0 z-10 bg-white border-b border-stone px-4 py-3.5 flex items-center gap-3 shadow-2xs">
        <Link href="/dashboard/children" className="inline-flex items-center gap-1.5 text-navy/60 hover:text-navy text-xs font-bold uppercase tracking-wider transition-colors">
          <ArrowLeftIcon className="size-3.5" />
          <span>Back to Registry</span>
        </Link>
        <div className="flex-1" />
        <Link
          href={`/dashboard/children/${id}/edit`}
          className="text-xs font-bold text-white bg-teal hover:bg-teal/90 rounded-md px-3.5 py-1.5 transition-all shadow-2xs"
        >
          Edit Profile
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
            <p className={`text-xs font-mono mt-0.5 ${child.id_rolf ? 'text-teal font-semibold' : 'text-navy/30'}`}>{child.id_rolf || 'ROLF ID Unknown'}</p>
            
            <span className={`mt-2.5 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold ${
              isActive ? "border-teal/50 bg-teal/10 text-teal" : "border-stone bg-ice text-navy/55"
            }`}>
              <span className={`size-1.5 rounded-full ${isActive ? "bg-teal" : "bg-navy/35"}`} aria-hidden="true" />
              {child.status}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-md border border-stone p-3.5 flex flex-col items-center justify-center text-center shadow-2xs">
            <p className="text-lg font-bold text-navy">{dynamicAge}</p>
            <p className="text-[10px] font-medium uppercase tracking-wider text-navy/45 mt-0.5">Years Old</p>
          </div>
          <div className="bg-white rounded-md border border-stone p-3.5 flex flex-col items-center justify-center text-center shadow-2xs">
            <p className={`text-xs font-bold truncate w-full ${child.country ? 'text-navy' : 'text-navy/30'}`}>{child.country || '—'}</p>
            <p className="text-[10px] font-medium uppercase tracking-wider text-navy/45 mt-0.5">Country</p>
          </div>
          <div className="bg-white rounded-md border border-stone p-3.5 flex flex-col items-center justify-center text-center shadow-2xs">
            <p className={`text-lg font-bold ${child.date_joined || child.year_joined ? 'text-navy font-mono' : 'text-navy/30'}`}>
              {child.date_joined ? new Date(child.date_joined).getFullYear() : child.year_joined || '—'}
            </p>
            <p className="text-[10px] font-medium uppercase tracking-wider text-navy/45 mt-0.5">Joined</p>
          </div>
        </div>

        <IntakeSection 
          childId={id} 
          eligibleForms={eligibleForms} 
          latestCompleted={latestCompleted} 
        />

        {/* ⚡ INTEGRATE SEAMLESS STAFF REGISTRY VIEW COMPONENT GRID */}
        {libraryItems.length > 0 && (
          <div className="bg-white rounded-md border border-stone p-5 shadow-2xs">
            <LibraryViewer mediaLibrary={libraryItems} />
          </div>
        )}

        <div className="bg-white rounded-md border border-stone overflow-hidden shadow-2xs">
          {video.kind === "file" ? (
            <video src={video.src} controls className="w-full aspect-video object-cover" />
          ) : video.kind === "drive" ? (
            <iframe
              src={video.src}
              allow="autoplay"
              allowFullScreen
              className="w-full aspect-video border-0"
              title={`${name} video`}
            />
          ) : (
            <div className="aspect-video bg-ice flex flex-col items-center justify-center gap-2 p-4 text-center">
              <VideoIcon className="size-8 text-navy/25" aria-hidden="true" />
              <p className="text-xs font-semibold text-navy/45">No profile video uploaded yet</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-md border border-stone px-5 shadow-2xs">
          <DetailRow label="Date of Birth" value={birthdate} />
          <DetailRow label="Date Joined" value={dateJoined} />
          <DetailRow label="Career Aspiration" value={child.career_aspiration} />
          <DetailRow label="Favorite Subject" value={child.favorite_subject} />
          <DetailRow label="Hobbies" value={child.hobby} />
          <DetailRow label="Bio" value={child.bio} />
        </div>

        <div className="bg-amber-50/60 border border-amber-200/80 rounded-md px-5 py-4 shadow-2xs space-y-1.5">
          <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-amber-900">Internal Notes</p>
          {child.notes?.trim() ? (
            <p className="text-xs text-amber-950 font-medium whitespace-pre-wrap leading-relaxed">{child.notes}</p>
          ) : (
            <p className="text-xs text-amber-900/50 italic font-medium">No internal confidential notes populated.</p>
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