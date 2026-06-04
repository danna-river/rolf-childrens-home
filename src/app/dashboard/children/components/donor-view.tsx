// src/app/dashboard/children/components/donor-view.tsx
import { getChildrenProfiles } from '@/components/actions' // Adjust path if actions.ts is located elsewhere
import { ProfileList } from '@/components/profileList'

export async function DonorView() {
  // Use your built-in action. We pass undefined for countries, search, status, and sort
  // but flip useSessionClient to true so it relies on the donor's active RLS rules.
  const { profiles, error } = await getChildrenProfiles(
    undefined, // countries
    undefined, // search
    'active',  // status (only show active sponsorships)
    undefined, // sort
    true       // useSessionClient = true 
  )

  return (
    <div className="min-h-screen bg-gray-50/50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* Header Layout */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-2 gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md mb-1.5">
              Donor Portal
            </div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              My Sponsored Connections
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              View updates and profiles for the children you sponsor.
            </p>
          </div>
        </div>

        {/* Error Handling */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-100 text-xs text-red-600 rounded-xl">
            Error loading your shared profiles: {error}
          </div>
        )}

        {/* Profiles Grid */}
        {profiles.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-200">
            <p className="text-sm text-gray-500">No active child sponsorships found on your account.</p>
          </div>
        ) : (
          /* Reuses your layout flawlessly since types are perfectly aligned now! */
          <ProfileList profiles={profiles} />
        )}
      </main>
    </div>
  )
}