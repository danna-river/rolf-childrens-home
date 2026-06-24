import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { PhotoViewer } from './components/PhotoViewer'
import { AuditLogSection } from './components/AuditLogSection'
import { IntakeSection } from './components/IntakeSection'
import { getEligibleIntakeForms } from './intake-actions'
import { calculateAge } from '@/components/actions'
import { resolveVideo } from '@/lib/childMedia'
import { ArrowLeftIcon, VideoIcon } from 'lucide-react'

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="py-3 border-b border-stone last:border-0 flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-[0.13em] text-navy/45">{label}</span>
      <span className={`text-xs font-semibold ${value ? 'text-navy' : 'text-navy/40 italic'}`}>{value || 'Not recorded'}</span>
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

  if (!profile || (profile.role !== 'admin' && profile.role !== 'staff')) {
    return redirect('/login?error=Unauthorized')
  }

  const { data: child } = await (supabase as any)
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

  if (!child) return notFound()

  const { eligibleForms, latestCompleted } = await getEligibleIntakeForms(
    child.id,
    child.country,
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
            
            {/* Standard ROLF Status Badge */}
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

        {/* Internal Notes Segment */}
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