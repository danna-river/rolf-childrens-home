import { getChildrenProfiles } from '@/components/actions'
import { RegisterChildButton } from '@/components/registerChildButton'
import { SearchBar } from '@/components/searchBar'
import { StatusFilter } from '@/components/statusFilter'
import { SortFilter } from '@/components/sortFilter'
import { ProfileList } from '@/components/profileList'

const COUNTRY = 'Uganda'

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string; sort?: string }>
}) {
  const { search, status, sort } = await searchParams
  const { profiles, error } = await getChildrenProfiles(COUNTRY, search, status, sort)

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-2 gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-green-600 bg-green-50 px-2.5 py-1 rounded-md mb-1.5">
            Staff Portal — {COUNTRY}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Children Registry
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Showing children in {COUNTRY}.
          </p>
        </div>
        <RegisterChildButton />
      </div>

      <SearchBar totalCount={profiles.length} />

      <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-xs flex flex-wrap gap-6">
        <StatusFilter />
        <SortFilter />
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-100 text-xs text-red-600 rounded-xl">
          Error loading data: {error}
        </div>
      )}

      <ProfileList profiles={profiles} />
    </main>
  )
}