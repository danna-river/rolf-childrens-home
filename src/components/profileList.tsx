import ProfileCard, { type ProfileCardLabels } from "@/components/profileCard";
import type { Locale } from "@/i18n/config";
import type { ChildProfile } from "@/types/profile";

const DEFAULT_LABELS = {
  noChildren: 'No children found',
  noChildrenHelp: 'Adjust the search or filters to return child records.',
  table: ['Child', 'Country', 'Age', 'Joined', 'Last Updated', 'Status'],
}

export function ProfileList({
  profiles,
  labels = DEFAULT_LABELS,
  locale = 'en',
}: {
  profiles: ChildProfile[]
  labels?: {
    noChildren: string
    noChildrenHelp: string
    table: string[]
    card?: ProfileCardLabels
  }
  locale?: Locale
}) {
  if (profiles.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-stone bg-white px-6 py-12 text-center">
        <p className="text-lg font-bold text-navy">{labels.noChildren}</p>
        <p className="mt-2 text-base text-navy/55">
          {labels.noChildrenHelp}
        </p>
      </div>
    )
  }

  return (
    <section>
      {/* Desktop table header */}
      <div className="hidden xl:grid xl:grid-cols-[minmax(240px,1.35fr)_minmax(120px,0.8fr)_minmax(120px,0.8fr)_minmax(120px,0.8fr)_minmax(140px,0.9fr)_minmax(120px,0.6fr)] xl:gap-4 xl:rounded-t-md xl:border xl:border-stone xl:bg-white xl:px-5 xl:py-2.5">
        {labels.table.map((col) => (
          <span key={col} className="text-xs font-bold uppercase tracking-[0.14em] text-navy/45">
            {col}
          </span>
        ))}
      </div>

      {/* Mobile: 1 col · Tablet (md): 2 col · Desktop (xl): table rows */}
      <div className="grid grid-cols-1 gap-2 sm:gap-3 md:grid-cols-2 xl:block xl:overflow-hidden xl:rounded-b-md xl:border xl:border-t-0 xl:border-stone xl:bg-white">
        {profiles.map((profile) => (
          <ProfileCard key={profile.id} profile={profile} labels={labels.card} locale={locale} />
        ))}
      </div>
    </section>
  )
}
