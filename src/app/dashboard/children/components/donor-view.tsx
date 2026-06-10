import { createClient } from '@/lib/supabase/server'
import type { Child } from '@/lib/types'

function countryFlag(country: string): string {
  const flags: Record<string, string> = {
    'Uganda': '🇺🇬', 'Kenya': '🇰🇪', 'Tanzania': '🇹🇿', 'Rwanda': '🇷🇼',
    'Burundi': '🇧🇮', 'Ethiopia': '🇪🇹', 'Ghana': '🇬🇭', 'Nigeria': '🇳🇬',
    'Togo': '🇹🇬', 'Senegal': '🇸🇳', 'Cameroon': '🇨🇲', 'Zambia': '🇿🇲',
    'Zimbabwe': '🇿🇼', 'Malawi': '🇲🇼', 'DRC': '🇨🇩',
  }
  return flags[country] ?? '🌍'
}

function yearsInHome(child: Child): number | null {
  const year = child.date_joined
    ? new Date(child.date_joined).getFullYear()
    : child.year_joined
  if (!year) return null
  return new Date().getFullYear() - year
}

function subjectIcon(subject: string): string {
  const icons: Record<string, string> = {
    'Math': '🔢', 'Language': '📖', 'Science': '🔬', 'Social Studies': '🌎',
    'Gym / PE': '⚽', 'Music': '🎵', 'Art': '🎨', 'History': '📜',
  }
  return icons[subject] ?? '📚'
}

function ChildCard({ child }: { child: Child }) {
  const name = [child.first_name, child.last_name].filter(Boolean).join(' ') || 'Unnamed'
  const firstName = child.first_name ?? name
  const years = yearsInHome(child)
  const initial = child.first_name?.[0] ?? '?'

  return (
    <article className="bg-white rounded-[2rem] overflow-hidden shadow-md border border-amber-100/60">

      {/* Photo — tall and dominant */}
      <div className="relative aspect-[4/3] bg-gradient-to-br from-amber-100 to-orange-100 overflow-hidden">
        {child.profile_photo ? (
          <img
            src={child.profile_photo}
            alt={name}
            className="w-full h-full object-cover transition-transform duration-700 hover:scale-105 cursor-pointer"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-9xl font-bold text-amber-300">{initial}</span>
          </div>
        )}
        {/* Name overlay at bottom of photo */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent px-6 pt-12 pb-5">
          <h2 className="text-3xl font-bold text-white">
            {firstName}{child.age ? <span className="font-light">, {child.age}</span> : ''}
          </h2>
          <p className="text-white/80 text-sm mt-0.5">
            {countryFlag(child.country ?? '')} {child.country}
            {years ? ` · ${years} year${years !== 1 ? 's' : ''} in the home` : ''}
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="px-7 py-8 flex flex-col gap-7">

        {/* Dream — front and center */}
        {child.career_aspiration && (
          <div className="flex gap-3 items-start">
            <span className="text-2xl mt-0.5">✨</span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500 mb-1">Dream</p>
              <p className="text-lg font-semibold text-gray-800 leading-snug">
                {child.career_aspiration}
              </p>
            </div>
          </div>
        )}

        {/* Divider */}
        {child.career_aspiration && child.bio && (
          <hr className="border-gray-100" />
        )}

        {/* Bio */}
        {child.bio && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">About {firstName}</p>
            <p className="text-base text-gray-600 leading-relaxed">{child.bio}</p>
          </div>
        )}

        {/* Interests as tags */}
        {(child.favorite_subject || child.hobby) && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Interests</p>
            <div className="flex flex-wrap gap-2">
              {child.favorite_subject && (
                <span className="inline-flex items-center gap-1.5 bg-amber-50 border border-amber-100 text-amber-800 text-sm font-medium px-3.5 py-2 rounded-full">
                  {subjectIcon(child.favorite_subject)} {child.favorite_subject}
                </span>
              )}
              {child.hobby && child.hobby.split(',').map(h => h.trim()).filter(Boolean).map((h, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 bg-orange-50 border border-orange-100 text-orange-800 text-sm font-medium px-3.5 py-2 rounded-full">
                  {h}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Video */}
        {child.profile_video && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Meet {firstName}</p>
            <div className="rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
              <video src={child.profile_video} controls className="w-full aspect-video bg-gray-50" />
            </div>
          </div>
        )}

      </div>
    </article>
  )
}

export async function DonorView() {
  const supabase = await createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('children')
    .select('*')
    .eq('status', 'active')

  const children = (data ?? []) as Child[]

  return (
    <div className="min-h-[calc(100svh_-_4rem)] bg-amber-50/40">
      <main className="max-w-lg mx-auto px-4 sm:px-6 py-12 space-y-10">

        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-amber-500 mb-1">Your Impact</p>
          <h1 className="text-3xl font-bold text-gray-900">
            {children.length === 1 ? `Meet ${children[0].first_name ?? 'Your Child'}` : 'Meet Your Children'}
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            {children.length === 1
              ? 'You are sponsoring 1 child.'
              : `You are sponsoring ${children.length} children.`}
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-100 text-xs text-red-600 rounded-xl">
            Error loading profiles: {(error as { message?: string }).message}
          </div>
        )}

        {children.length === 0 && !error && (
          <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
            <p className="text-gray-400 text-sm">No active sponsorships found on your account.</p>
          </div>
        )}

        <div className="flex flex-col gap-10">
          {children.map(child => (
            <ChildCard key={child.id} child={child} />
          ))}
        </div>

      </main>
    </div>
  )
}
