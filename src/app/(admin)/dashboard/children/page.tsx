import { getChildrenProfiles } from './actions'
import ProfileList from './profileList'

export default async function Page() {
  const { profiles, error } = await getChildrenProfiles()

  return (
    <main className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">All Children</h1>
        <span className="text-sm text-gray-500">{profiles.length} total</span>
      </div>
      {error && (
        <p className="text-sm text-red-600 mb-4">Failed to load data: {error ?? 'Unknown error'}</p>
      )}
      <ProfileList profiles={profiles} />
    </main>
  )
}
