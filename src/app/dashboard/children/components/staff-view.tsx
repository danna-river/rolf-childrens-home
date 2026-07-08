import {
  getChildrenProfiles,
  getChildrenRegistryStats,
  getJoinedYears,
} from '@/components/actions'
import { SearchBar } from '@/components/searchBar'
import { StatusFilter } from '@/components/statusFilter'
import { CountryFilter } from '@/components/countryFilter'
import { SortFilter } from '@/components/sortFilter'
import { YearJoinedFilter } from '@/components/yearJoinedFilter'
import { ProfileList } from '@/components/profileList'
import { Pagination } from '@/components/pagination'
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

  const { search, status, country, sort, yearJoined, page } = await searchParams
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
    ),
    getJoinedYears(),
    getChildrenRegistryStats(countryQueryScope, true),
  ])

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
              <SearchBar />
              <div className="flex flex-col gap-4">
                <StatusFilter />
                <CountryFilter countries={assignedCountries} />
                <YearJoinedFilter years={joinedYears} />
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
            profiles={profiles}
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
