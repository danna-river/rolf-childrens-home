import { getChildrenProfiles, getJoinedYears } from '@/components/actions'
import { RegisterChildButton } from '@/components/registerChildButton'
import { SearchBar } from '@/components/searchBar'
import { StatusFilter } from '@/components/statusFilter'
import { CountryFilter } from '@/components/countryFilter' // 🌟 1. Import CountryFilter
import { SortFilter } from '@/components/sortFilter'
import { YearJoinedFilter } from '@/components/yearJoinedFilter'
import { ProfileList } from '@/components/profileList'
import { Pagination } from '@/components/pagination'
import { StaffLayout } from '@/app/dashboard/children/components/staff-layout'

type StaffSearchParams = {
  search?: string
  status?: string
  country?: string | string[] // 🌟 2. Add country parameter to types
  sort?: string
  yearJoined?: string
  page?: string
}

interface StaffViewProps {
  assignedCountries: string[]
  searchParams: Promise<StaffSearchParams>
}

// 🌟 3. Helper to handle multiple checked country boxes from url strings
function parseCountryFilter(country?: string | string[]): string[] | undefined {
  if (!country) return undefined
  return Array.isArray(country) ? country : [country]
}

export async function StaffView({ assignedCountries, searchParams }: StaffViewProps) {
  const regionalLabel =
    assignedCountries.length > 0 ? assignedCountries.join(', ') : 'No Assigned Regions'

  const { search, status, country, sort, yearJoined, page } = await searchParams // 🌟 4. Extract country param
  const currentPage = Math.max(1, parseInt(page ?? '1'))
  
  // 🌟 5. Determine the active target filter scope
  const selectedCountries = parseCountryFilter(country)
  const countryQueryScope = selectedCountries && selectedCountries.length > 0 
    ? selectedCountries 
    : (assignedCountries.length > 0 ? assignedCountries : undefined)

  const [{ profiles, error, total }, joinedYears] = await Promise.all([
    getChildrenProfiles(
      countryQueryScope, // 🌟 6. Pass the scoped selection to the background fetch pipeline
      search,
      status,
      sort,
      true,
      yearJoined,
      currentPage,
    ),
    getJoinedYears(),
  ])

  return (
    <StaffLayout>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-2 gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-green-600 bg-green-50 px-2.5 py-1 rounded-md mb-1.5">
              Staff Portal — {regionalLabel}
            </div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              Children Registry
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Showing children in {regionalLabel}.
            </p>
          </div>
          <RegisterChildButton />
        </div>

        <SearchBar totalCount={total} />

        {/* 🌟 7. Inject CountryFilter, passing strictly their sandbox allowed country strings array options */}
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row flex-wrap gap-4 sm:gap-6 divide-y sm:divide-y-0 divide-gray-100">
          <div className="pt-4 sm:pt-0 first:pt-0"><StatusFilter /></div>
          <div className="pt-4 sm:pt-0"><CountryFilter countries={assignedCountries} /></div> 
          <div className="pt-4 sm:pt-0"><YearJoinedFilter years={joinedYears} /></div>
          <div className="pt-4 sm:pt-0"><SortFilter /></div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-100 text-xs text-red-600 rounded-xl">
            Error loading data: {error}
          </div>
        )}

        <ProfileList profiles={profiles} />
        <Pagination total={total} currentPage={currentPage} />
      </main>
    </StaffLayout>
  )
}