import { redirect } from 'next/navigation'
import { MapPin, Heart, Users, Globe2, HeartHandshake } from 'lucide-react'
import { requireAuth } from '@/lib/auth'
import { isAdminRole, isStaffRole } from '@/lib/profiles'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolvePhotoSrc } from '@/lib/childMedia'
import { RegistryHeader } from '@/app/dashboard/children/components/registry-page-layout'
import { getMessages, getUserLocale } from '@/i18n/server'
import type { Locale } from '@/i18n/config'
import type { MessageKey, Messages } from '@/i18n/locales/en'

type MatchRow = {
  id: string
  start_date: string
  end_date: string | null
  amount: number | null
  frequency: string | null
  child: {
    id: string
    id_rolf: string | null
    display_name: string
    first_name: string | null
    last_name: string | null
    country: string | null
    profile_photo: string | null
  } | null
  sponsor: {
    id: string
    full_name: string
    email: string | null
  } | null
}

type Match = {
  id: string
  startDate: string
  endDate: string | null
  amount: number | null
  frequency: string | null
  child: NonNullable<MatchRow['child']>
  sponsor: NonNullable<MatchRow['sponsor']>
  country: string
}

/** Raw query shape: profile_photo arrives as an embedded child_media ref, not a flat URL. */
type MatchQueryRow = Omit<MatchRow, 'child'> & {
  child: (Omit<NonNullable<MatchRow['child']>, 'profile_photo'> & { profile_photo: { url: string } | null }) | null
}

const FREQUENCY_SHORT: Record<string, string> = {
  one_time: 'one-time',
  weekly: '/wk',
  biweekly: '/2wk',
  monthly: '/mo',
  quarterly: '/qtr',
  semiannual: '/6mo',
  annual: '/yr',
}

function t(messages: Messages, key: MessageKey): string {
  return messages[key]
}

function childDisplayName(child: NonNullable<MatchRow['child']>, messages: Messages): string {
  return (
    [child.first_name, child.last_name].filter(Boolean).join(' ') ||
    child.display_name ||
    t(messages, 'matches.card.unnamedChild')
  )
}

function childInitials(child: NonNullable<MatchRow['child']>): string {
  const parts = [child.first_name, child.last_name].filter(Boolean)
  if (parts.length >= 2) return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase()
  return (child.first_name?.slice(0, 2) || child.display_name?.slice(0, 2) || '?').toUpperCase()
}

function formatContribution(amount: number | null, frequency: string | null): string | null {
  if (!amount) return null
  const usd = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount)
  if (!frequency || frequency === 'one_time') return usd
  return `${usd}${FREQUENCY_SHORT[frequency] ?? ''}`
}


function shortDate(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(
    new Date(`${iso}T12:00:00`),
  )
}

function MatchCard({ match, locale, messages }: { match: Match; locale: Locale; messages: Messages }) {
  const name = childDisplayName(match.child, messages)
  const photoSrc = resolvePhotoSrc(match.child.profile_photo, 200)
  const contribution = formatContribution(match.amount, match.frequency)

  return (
    <article className="overflow-hidden rounded-xl border border-stone bg-white shadow-sm">
      <div className="flex items-stretch">
        {/* Child side */}
        <div className="flex min-w-0 flex-1 items-center gap-3 px-4 py-4 sm:gap-4 sm:px-5">
          <div className="shrink-0">
            {photoSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoSrc}
                alt={name}
                referrerPolicy="no-referrer"
                className="size-12 rounded-full object-cover ring-2 ring-sky/60 sm:size-14"
              />
            ) : (
              <div className="flex size-12 items-center justify-center rounded-full bg-teal/15 ring-2 ring-sky/40 sm:size-14">
                <span className="text-sm font-bold text-teal sm:text-base">
                  {childInitials(match.child)}
                </span>
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-navy sm:text-base">{name}</p>
            {match.child.id_rolf && (
              <p className="mt-0.5 truncate text-xs font-bold uppercase tracking-wide text-teal">
                {match.child.id_rolf}
              </p>
            )}
            {match.child.country && (
              <p className="mt-0.5 flex items-center gap-1 truncate text-xs font-medium text-navy/50">
                <MapPin className="size-3 shrink-0" aria-hidden="true" />
                {match.child.country}
              </p>
            )}
          </div>
        </div>

        {/* Connector */}
        <div className="flex shrink-0 flex-col items-center justify-center gap-1 border-x border-stone bg-sky/25 px-3 py-4">
          <Heart className="size-4 fill-teal text-teal" aria-hidden="true" />
        </div>

        {/* Sponsor side */}
        <div className="flex min-w-0 flex-1 flex-col items-end justify-center gap-1 px-4 py-4 sm:px-5">
          <p className="truncate text-sm font-bold text-navy sm:text-base">
            {match.sponsor.full_name}
          </p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {contribution && (
              <span className="inline-flex items-center rounded-md bg-teal/10 px-2 py-0.5 text-[11px] font-bold tracking-wide text-teal">
                {contribution}
              </span>
            )}
            <span className="inline-flex items-center rounded-md bg-stone/70 px-2 py-0.5 text-[11px] font-medium text-navy/60">
              {shortDate(match.startDate, locale)} — {match.endDate ? shortDate(match.endDate, locale) : t(messages, 'matches.card.ongoing')}
            </span>
          </div>
        </div>
      </div>
    </article>
  )
}

function CountrySection({ country, matches, locale, messages }: { country: string; matches: Match[]; locale: Locale; messages: Messages }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-3">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.2em] text-teal">
          <Globe2 className="size-4" aria-hidden="true" />
          {country}
        </h2>
        <span className="rounded-full bg-teal/10 px-2.5 py-0.5 text-xs font-bold text-teal">
          {matches.length}
        </span>
        <div className="h-px flex-1 bg-stone" />
      </div>
      <div className="grid gap-2 sm:gap-3">
        {matches.map((match) => (
          <MatchCard key={match.id} match={match} locale={locale} messages={messages} />
        ))}
      </div>
    </section>
  )
}

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-stone bg-white px-4 py-4 shadow-sm sm:px-5">
      <p className="text-2xl font-bold tracking-tight text-navy sm:text-3xl">
        {value.toLocaleString()}
      </p>
      <p className="mt-1 text-xs font-bold uppercase tracking-wide text-navy/50">{label}</p>
    </div>
  )
}

export default async function MatchesPage() {
  const { user, profile } = await requireAuth()

  if (!isAdminRole(profile.role) && !isStaffRole(profile.role)) {
    redirect('/dashboard')
  }
  const locale = await getUserLocale(user.id)
  const messages = getMessages(locale)

  const supabase = createAdminClient()

  // ⚡ UPDATE: Modify children projection to fetch profile_photo via child_media relationship
  let query = supabase
    .from('sponsorships')
    .select(`
      id,
      start_date,
      end_date,
      amount,
      frequency,
      child:children(
        id, 
        id_rolf, 
        display_name, 
        first_name, 
        last_name, 
        country, 
        profile_photo:child_media!fk_children_profile_photo(url)
      ),
      sponsor:sponsors(id, full_name, email)
    `)
    .eq('status', 'active')
    .not('child_id', 'is', null)
    .not('sponsor_id', 'is', null)
    .order('start_date', { ascending: true })

  // Staff see only their assigned countries.
  if (isStaffRole(profile.role) && profile.country && profile.country.length > 0) {
    query = query.in('children.country', profile.country) as typeof query
  }

  const { data, error } = await query

  const rows = (data ?? []) as unknown as MatchQueryRow[]

  // ⚡ UPDATE: Flatten the relational url property object back to a simple text property
  const matches: Match[] = rows
    .filter((row): row is MatchQueryRow & { child: NonNullable<MatchQueryRow['child']>; sponsor: NonNullable<MatchQueryRow['sponsor']> } =>
      row.child !== null && row.sponsor !== null,
    )
    .map((row) => ({
      id: row.id,
      startDate: row.start_date,
      endDate: row.end_date,
      amount: row.amount,
      frequency: row.frequency,
      child: {
        ...row.child,
        profile_photo: row.child.profile_photo?.url ?? null, // Safely maps out image link strings
      },
      sponsor: row.sponsor,
      country: row.child.country ?? t(messages, 'matches.card.unknownCountry'),
    }))

  const byCountry = new Map<string, Match[]>()
  for (const match of matches) {
    const list = byCountry.get(match.country) ?? []
    list.push(match)
    byCountry.set(match.country, list)
  }
  const countries = Array.from(byCountry.keys()).sort()

  const totalMatches = matches.length
  const totalCountries = countries.length
  const isAdmin = isAdminRole(profile.role)

  const regionLabel = isAdmin
    ? t(messages, 'matches.header.allRegions')
    : (profile.country?.join(', ') ?? t(messages, 'matches.header.yourRegion'))

  return (
    <main className="google-sans-registry min-h-[calc(100svh-4rem)] bg-ice pb-12">
      <RegistryHeader
        badge={isAdmin ? t(messages, 'matches.header.adminBadge') : t(messages, 'matches.header.staffBadge')}
        eyebrow={regionLabel}
        title={t(messages, 'matches.registry.title')}
        subtitle={t(messages, 'matches.registry.subtitle')}
      />

      <div className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        {/* Summary stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatPill label={t(messages, 'matches.stats.activeMatches')} value={totalMatches} />
          <StatPill label={t(messages, 'matches.stats.countries')} value={totalCountries} />
          <div className="col-span-2 flex items-center justify-center gap-3 rounded-xl border border-teal/20 bg-teal/5 px-5 py-4 sm:col-span-1">
            <HeartHandshake className="size-6 shrink-0 text-teal" aria-hidden="true" />
            <p className="text-sm font-semibold leading-snug text-teal">
              {totalMatches === 1
                ? t(messages, 'matches.stats.supportedSingular')
                : t(messages, 'matches.stats.supportedPlural').replace('{count}', totalMatches.toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-US'))}
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-destructive/20 bg-white px-5 py-4 text-sm font-semibold text-destructive shadow-sm">
            {t(messages, 'matches.error.load')}
          </div>
        )}

        {!error && matches.length === 0 && (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-stone bg-white px-6 py-16 text-center shadow-sm">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-sky text-teal">
              <Users className="size-7" aria-hidden="true" />
            </div>
            <div>
              <p className="text-lg font-bold text-navy">{t(messages, 'matches.empty.title')}</p>
              <p className="mt-1 text-sm font-medium text-navy/55">
                {t(messages, 'matches.empty.description')}
              </p>
            </div>
          </div>
        )}

        {countries.map((country) => (
          <CountrySection
            key={country}
            country={country}
            matches={byCountry.get(country)!}
            locale={locale}
            messages={messages}
          />
        ))}
      </div>
    </main>
  )
}
