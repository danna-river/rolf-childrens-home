import { createAdminClient } from '@/lib/supabase/admin'
import type { ChildProfile } from '@/types/profile'
import { createClient } from '@/lib/supabase/server'

// Define what the raw PostgreSQL database row looks like
interface DBChildRow {
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

export async function getChildrenProfiles(allowedCountries?: string[]) {
  const supabase = await createClient()

  let query = supabase
    .from('children')
    .select('*')

  if (allowedCountries && allowedCountries.length > 0) {
    query = query.in('country', allowedCountries)
  }

  // Cast the network payload to your raw database layout type
  const { data, error } = await query as { data: DBChildRow[] | null; error: any }

  if (error) {
    console.error('❌ FETCH ACTIONS: Failed to query children registry:', error.message)
    return { profiles: [], error: error.message }
  }

  // 🔄 Map snake_case database rows cleanly into your camelCase ChildProfile interface
  const formattedProfiles: ChildProfile[] = (data || []).map((row) => ({
    id: row.id,
    firstName: row.first_name || '',
    lastName: row.last_name || '',
    birthYear: row.birth_year || 0,
    birthMonth: row.birth_month || 0,
    birthDay: row.birth_day || 0,
    age: row.age || 0,
    country: row.country || '',
    createdAt: row.created_at ? new Date(row.created_at) : new Date(), // Convert string string to Date object
    profilePictureURL: row.profile_photo || '',
    status: row.status || 'active'
  }))

  return { profiles: formattedProfiles, error: null }
}