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
  RegistryStats,
  RegistryToolbar,
  ResultsSummary,
} from '@/app/dashboard/children/components/registry-page-layout'

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
}

function parseCountryFilter(country?: string | string[]): string[] | undefined {
  if (!country) return undefined
  return Array.isArray(country) ? country : [country]
}

export async function StaffView({ assignedCountries, searchParams }: StaffViewProps) {
  const regionalLabel =
    assignedCountries.length > 0 ? assignedCountries.join(', ') : 'No Assigned Regions'

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
          badge="Staff Portal"
          eyebrow={regionalLabel}
          title="Children Registry"
          subtitle={`Showing children in ${regionalLabel}`}
        />

        <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
          <RegistryStats stats={stats} />

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

          <ResultsSummary total={total} hasFilters={hasFilters} />

          {error && (
            <div className="rounded-md border border-red-100 bg-red-50 p-4 text-base font-semibold text-red-700">
              Error loading data: {error}
            </div>
          )}

          <ProfileList profiles={profiles} />
          <Pagination total={total} currentPage={currentPage} />
        </div>
      </main>
    </StaffLayout>
  )
}
