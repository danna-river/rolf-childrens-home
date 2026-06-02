import { getChildrenProfiles } from '@/components/actions'
import { RegisterChildButton } from '@/components/registerChildButton'
import { SearchBar } from '@/components/searchBar'
import { ProfileList } from '@/components/profileList'

export async function AdminView() {
  const { profiles = [], error } = await getChildrenProfiles()

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-2 gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md mb-1.5">
            Admin Dashboard
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Children Registry
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            System overview tracking active child records.
          </p>
        </div>

        {/* Register Child Button */}
        <RegisterChildButton />
      </div>

      {/* Search Bar and Metrics */}
      <SearchBar totalCount={profiles.length} />

      {/* Error System Bound Panel */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-100 text-xs text-red-600 rounded-xl">
          Error loading data: {error}
        </div>
      )}

      {/* Profiles Display List */}
      <ProfileList profiles={profiles} />
    </main>
  )
}