import {
  getChildrenProfiles,
  getChildrenRegistryStats,
  getCountries,
  getJoinedYears,
} from '@/components/actions'
import { SearchBar } from '@/components/searchBar'
import { StatusFilter } from '@/components/statusFilter'
import { CountryFilter } from '@/components/countryFilter'
import { SortFilter } from '@/components/sortFilter'
import { YearJoinedFilter } from '@/components/yearJoinedFilter'
import { ProfileList } from '@/components/profileList'
import { Pagination } from '@/components/pagination'
import {
  RegistryHeader,
  RegistryStats,
  RegistryToolbar,
  ResultsSummary,
} from '@/app/dashboard/children/components/registry-page-layout'

type ChildrenSearchParams = {
  search?: string
  status?: string
  country?: string | string[]
  sort?: string
  yearJoined?: string
  page?: string
}

function parseCountryFilter(country?: string | string[]): string[] | undefined {
  if (!country) return undefined
  return Array.isArray(country) ? country : [country]
}

export async function AdminView({
  searchParams,
}: {
  searchParams: Promise<ChildrenSearchParams>
}) {
  const { search, status, country, sort, yearJoined, page } = await searchParams
  const currentPage = Math.max(1, parseInt(page ?? '1'))
  const countries = parseCountryFilter(country)
  const hasFilters = Boolean(
    search?.trim()
    || (status && status !== 'all')
    || (countries && countries.length > 0)
    || (yearJoined && yearJoined !== 'all')
  )
  const [{ profiles, error, total }, countryOptions, joinedYears, stats] = await Promise.all([
    getChildrenProfiles(countries, search, status, sort, false, yearJoined, currentPage),
    getCountries(),
    getJoinedYears(),
    getChildrenRegistryStats(countries, false),
  ])

  return (
    <main className="google-sans-registry min-h-[calc(100svh-4rem)] bg-ice pb-8">
      <RegistryHeader
        badge="Admin Dashboard"
        eyebrow="ROLF Children's Home"
        title="Children Registry"
        subtitle="Internal operations dashboard"
      />

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <RegistryStats stats={stats} />

        <RegistryToolbar>
          <div className="space-y-4">
            <SearchBar />
            <div className="flex flex-col gap-4">
              <StatusFilter />
              <CountryFilter countries={countryOptions} />
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
  )
}
