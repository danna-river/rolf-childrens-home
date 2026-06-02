import { getChildrenProfiles } from '@/components/actions'
import { RegisterChildButton } from '@/components/registerChildButton'
import { SearchBar } from '@/components/searchBar'
import { ProfileList } from '@/components/profileList'

interface InputterViewProps {
  assignedCountries: string[]
}

export async function InputterView({ assignedCountries }: InputterViewProps) {
  // Pass the user's array directly to the data fetcher
  const { profiles = [], error } = await getChildrenProfiles()

  // Format the visual display label string based on their real table rows
  const regionalLabel = assignedCountries.length > 0 
    ? assignedCountries.join(', ') 
    : 'No Assigned Regions'

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-blue-600 text-white p-4">
        <h1 className="text-xl font-bold">Staff Dashboard</h1>
      </header>
      
      <main className="flex-1 p-6">
        <main className="max-w-7xl mx-auto space-y-6">
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

          <SearchBar totalCount={profiles.length} />

          {error && (
            <div className="p-3 bg-red-50 border border-red-100 text-xs text-red-600 rounded-xl">
              Error loading data: {error}
            </div>
          )}

          <ProfileList profiles={profiles} />
        </main>
      </main>
    </div>
  )
}