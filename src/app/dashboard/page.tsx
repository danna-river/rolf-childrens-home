import { createAdminClient } from '@/lib/supabase/admin'
import ProfileList from './profileList'
import type { ChildProfile } from '@/types/profile'

export default async function Page() {
  const supabase = createAdminClient()

  const { data: children, error } = await supabase
    .from('children')
    .select('id, first_name, last_name, birth_year, birth_month, birth_day, age, country, created_at, profile_photo, status')
    .order('created_at', { ascending: false })

  if (error) console.error('Error fetching children:', error)

  const profiles: ChildProfile[] = (children ?? []).map((child) => {
    const c = child as {
      id: string
      first_name: string | null
      last_name: string | null
      birth_year: number | null
      birth_month: number | null
      birth_day: number | null
      age: number | null
      country: string | null
      created_at: string
      profile_photo: string | null
      status: string
    }
    return {
      id: c.id,
      firstName: c.first_name ?? '',
      lastName: c.last_name ?? '',
      birthYear: c.birth_year ?? 0,
      birthMonth: c.birth_month ?? 0,
      birthDay: c.birth_day ?? 0,
      age: c.age ?? 0,
      country: c.country ?? '',
      createdAt: new Date(c.created_at),
      // profile_photo is an S3 key, not a URL — signed URL generation comes later
      profilePictureURL: '',
      status: c.status,
    }
  })

  return (
    <main className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">All Children</h1>
        <span className="text-sm text-gray-500">{profiles.length} total</span>
      </div>
      {error && (
        <p className="text-sm text-red-600 mb-4">Failed to load data: {error.message}</p>
      )}
      <ProfileList profiles={profiles} />
    </main>
  )
}
