import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import type { Child } from '@/lib/types'
import { PhotoViewer } from './PhotoViewer'
import { AuditLogSection } from './AuditLogSection'

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="py-3 border-b border-gray-50 last:border-0">
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className={`text-sm ${value ? 'text-gray-800' : 'text-gray-300'}`}>{value || '—'}</p>
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

  const { data: child } = await supabase
    .from('children')
    .select(`
      *,
      creator:created_by (
        full_name,
        role
      )
    `)
    .eq('id', id)
    .single() as any

  if (!child) return notFound()

  const name = [child.first_name, child.last_name].filter(Boolean).join(' ') || 'Unnamed'
  const isActive = child.status === 'active'
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
            <p className={`text-lg font-bold ${typeof child.age === 'number' && child.age >= 0 ? 'text-gray-900' : 'text-gray-300'}`}>
              {typeof child.age === 'number' && child.age >= 0 ? child.age : '—'}
            </p>
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

        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          {child.profile_video ? (
            <video src={child.profile_video} controls className="w-full aspect-video" />
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
        {(profile.role === 'admin' || profile.role === 'staff') && (
          <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
            <p className="text-xs font-semibold text-amber-600 mb-1">Internal Notes</p>
            {child.notes?.trim() ? (
              <p className="text-sm text-amber-800 whitespace-pre-wrap">{child.notes}</p>
            ) : (
              <p className="text-sm text-amber-400 italic">No internal notes added yet.</p>
            )}
          </div>
        )}

        {/* 🌟 READ-ONLY AUDIT LOG TIMELINE SECTION (ADMINS ONLY) */}
        {profile.role === 'admin' && (
          <AuditLogSection
            editLog={child.edit_log}
            createdAt={child.created_at}
            creatorName={child.creator?.full_name || null} // 🌟 Double check this line matches exactly!
            creatorRole={child.creator?.role || null}
          />
        )}
      </div>
    </div>
  )
}
