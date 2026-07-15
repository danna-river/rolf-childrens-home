import {
  getChildrenProfiles,
  getChildrenRegistryStats,
  getJoinedYears,
} from '@/components/actions'
import { getEligibleIntakeForms } from '@/app/dashboard/children/[id]/intake-actions'
import { SearchBar } from '@/components/searchBar'
import { FaceSearchButton } from '@/app/dashboard/children/components/FaceSearchButton'
import { StatusFilter } from '@/components/statusFilter'
import { CountryFilter } from '@/components/countryFilter'
import { SortFilter } from '@/components/sortFilter'
import { YearJoinedFilter } from '@/components/yearJoinedFilter'
import { LastUpdatedFilter } from '@/components/lastUpdatedFilter'
import { ProfileList } from '@/components/profileList'
import { Pagination } from '@/components/pagination'
import { createClient } from '@/lib/supabase/server'
import { StaffLayout } from '@/app/dashboard/children/components/staff-layout'
import {
  RegistryHeader,
  RegistryStatsWithLabels,
  RegistryToolbar,
  ResultsSummary,
} from '@/app/dashboard/children/components/registry-page-layout'
import type { Locale } from '@/i18n/config'
import type { Messages } from '@/i18n/locales/en'

type StaffSearchParams = {
  search?: string
  status?: string
  country?: string | string[]
  sort?: string
  yearJoined?: string
  updated?: string
  page?: string
}

interface StaffViewProps {
  assignedCountries: string[]
  searchParams: Promise<StaffSearchParams>
  messages: Messages
  locale: Locale
}

function parseCountryFilter(country?: string | string[]): string[] | undefined {
  if (!country) return undefined
  return Array.isArray(country) ? country : [country]
}

export async function StaffView({ assignedCountries, searchParams, messages, locale }: StaffViewProps) {
  const t = (key: keyof Messages) => messages[key]
  const regionalLabel =
    assignedCountries.length > 0 ? assignedCountries.join(', ') : t('children.registry.noAssignedRegions')

  const { search, status, country, sort, yearJoined, updated, page } = await searchParams
  const currentPage = Math.max(1, parseInt(page ?? '1'))

  const selectedCountries = parseCountryFilter(country)
  const countryQueryScope = selectedCountries && selectedCountries.length > 0
    ? selectedCountries
    : (assignedCountries.length > 0 ? assignedCountries : undefined)
  const hasFilters = Boolean(
    search?.trim()
    || (status && status !== 'all')
    || (selectedCountries && selectedCountries.length > 0)
    || (yearJoined && yearJoined !== 'all')
    || (updated && updated !== 'all')
  )

  const [{ profiles, error, total }, joinedYears, stats] = await Promise.all([
    getChildrenProfiles(
      countryQueryScope,
      search,
      status,
      sort,
      true,
      yearJoined,
      currentPage,
      updated,
    ),
    getJoinedYears(),
    getChildrenRegistryStats(countryQueryScope, true),
  ])

  // ⚡ Live Verification Matrix: Compute Missing Fields Status across Children + Intake Templates
  const augmentedProfiles = await (async () => {
    if (!profiles || profiles.length === 0) return []
    const supabase = await createClient()
    const childIds = profiles.map((p) => p.id)

    // Side-load custom parameters to handle key drops natively
    const { data: rawChildrenFields } = await supabase
      .from('children')
      .select('id, bio, hobby, career_aspiration, favorite_subject, profile_video')
      .in('id', childIds)

    // Execute matching validation pipelines concurrently across all children in the batch slice
    const formsEvaluations = await Promise.all(
      profiles.map(async (profile) => {
        if (profile.status === 'inactive') return { id: profile.id, latestCompleted: true }
        try {
          const { latestCompleted } = await getEligibleIntakeForms(
            profile.id,
            profile.country || '',
            profile.date_joined ? String(profile.date_joined) : null,
            profile.year_joined ? Number(profile.year_joined) : null
          )
          return { id: profile.id, latestCompleted }
        } catch (e) {
          console.error(`❌ Intake analysis engine crash for child ${profile.id}:`, e)
          return { id: profile.id, latestCompleted: true }
        }
      })
    )

    return profiles.map((profile) => {
      if (profile.status === 'inactive') {
        return { ...profile, hasMissingFields: false }
      }

      const dbRow = rawChildrenFields?.find(r => r.id === profile.id)
      const intakeEvaluation = formsEvaluations.find(f => f.id === profile.id)

      const isBaseFieldMissing = [
        profile.id_rolf,
        profile.firstName,
        profile.lastName,
        profile.birthYear,
        profile.birthMonth,
        profile.birthDay,
        profile.country,
        profile.date_joined,
        profile.year_joined,
        profile.profilePictureURL
      ].some(val => val === null || val === undefined || val.toString().trim() === '' || val === 0)

      const isCustomFieldMissing = !dbRow || [
        dbRow.bio,
        dbRow.hobby,
        dbRow.career_aspiration,
        dbRow.favorite_subject,
        dbRow.profile_video
      ].some(val => val === null || val === undefined || val.toString().trim() === '')

      const isIntakeMissing = intakeEvaluation ? !intakeEvaluation.latestCompleted : false

      return { 
        ...profile, 
        hasMissingFields: isBaseFieldMissing || isCustomFieldMissing || isIntakeMissing 
      }
    })
  })()

  return (
    <StaffLayout>
      <main className="google-sans-registry min-h-[calc(100svh-4rem)] bg-ice pb-8">
        <RegistryHeader
          badge={t('children.registry.staffBadge')}
          eyebrow={regionalLabel}
          title={t('children.registry.title')}
          subtitle={t('children.registry.staffSubtitle').replace('{regions}', regionalLabel)}
        />

        <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
          <RegistryStatsWithLabels
            stats={stats}
            labels={{
              totalChildren: t('children.registry.totalChildren'),
              active: t('children.registry.active'),
              inactive: t('children.registry.inactive'),
              countries: t('children.registry.countries'),
            }}
          />

          <RegistryToolbar>
            <div className="space-y-4">
              <div className="flex items-stretch gap-3">
                <div className="min-w-0 flex-1">
                  <SearchBar />
                </div>
                <FaceSearchButton />
              </div>
              <div className="flex flex-col gap-4">
                <StatusFilter />
                <CountryFilter countries={assignedCountries} />
                <YearJoinedFilter years={joinedYears} />
                <LastUpdatedFilter />
                <SortFilter />
              </div>
            </div>
          </RegistryToolbar>

          <ResultsSummary
            total={total}
            hasFilters={hasFilters}
            labels={{
              showing: t('children.registry.showing'),
              showingAll: t('children.registry.showingAll'),
              childSingular: t('children.registry.childSingular'),
              childPlural: t('children.registry.childPlural'),
            }}
          />

          {error && (
            <div className="rounded-md border border-red-100 bg-red-50 p-4 text-base font-semibold text-red-700">
              {t('children.registry.errorPrefix')} {error}
            </div>
          )}

          <ProfileList
            profiles={augmentedProfiles}
            locale={locale}
            labels={{
              noChildren: t('children.registry.noChildren'),
              noChildrenHelp: t('children.registry.noChildrenHelp'),
              table: [
                t('children.registry.table.child'),
                t('children.registry.table.country'),
                t('children.registry.table.age'),
                t('children.registry.table.joined'),
                t('children.registry.table.lastUpdated'),
                t('children.registry.table.status'),
              ],
              card: {
                unnamed: t('children.card.unnamed'),
                active: t('children.registry.active'),
                inactive: t('children.registry.inactive'),
                unknownAge: t('children.card.unknownAge'),
                unknownJoined: t('children.card.unknownJoined'),
                rolfIdUnknown: t('children.card.rolfIdUnknown'),
                viewProfile: t('children.card.viewProfile'),
                edit: t('children.card.edit'),
                country: t('children.card.country'),
                age: t('children.card.age'),
                joined: t('children.card.joined'),
                lastUpdated: t('children.card.lastUpdated'),
                notRecorded: t('children.card.notRecorded'),
                yearsShort: t('children.card.yearsShort'),
              },
            }}
          />
          <Pagination total={total} currentPage={currentPage} />
        </div>
      </main>
    </StaffLayout>
  )
}