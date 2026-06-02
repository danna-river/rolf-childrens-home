import { createAdminClient } from '@/lib/supabase/admin'
import type { ChildProfile } from '@/types/profile'
import { createClient } from '@/lib/supabase/server'

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

export async function getCountries(): Promise<string[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('children')
    .select('country')
    .not('country', 'is', null)
    .order('country')
  const unique = [...new Set((data ?? []).map((r: { country: string | null }) => r.country as string))]
  return unique
}

export async function getChildrenProfiles(
  countries?: string[],
  search?: string,
  status?: string,
  sort?: string,
  useSessionClient = false,
): Promise<{ profiles: ChildProfile[]; error: string | null }> {
  const supabase = useSessionClient ? await createClient() : createAdminClient()

  let query = supabase.from('children').select('*')

  if (countries && countries.length > 0) {
    query = query.in('country', countries)
  }

  if (search) {
    query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%`)
  }

  if (status && status !== 'all') {
    query = query.eq('status', status)
  }

  if (sort === 'name_desc') {
    query = query.order('first_name', { ascending: false })
  } else if (sort === 'age_asc') {
    query = query.order('age', { ascending: true })
  } else if (sort === 'age_desc') {
    query = query.order('age', { ascending: false })
  } else {
    query = query.order('first_name', { ascending: true })
  }

  const { data, error } = await query

  if (error) {
    console.error('❌ FETCH ACTIONS: Failed to query children registry:', error.message)
    return { profiles: [], error: error.message }
  }

  const formattedProfiles: ChildProfile[] = ((data ?? []) as DBChildRow[]).map((row) => ({
    id: row.id,
    firstName: row.first_name || '',
    lastName: row.last_name || '',
    birthYear: row.birth_year || 0,
    birthMonth: row.birth_month || 0,
    birthDay: row.birth_day || 0,
    age: row.age || 0,
    country: row.country || '',
    createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    profilePictureURL: row.profile_photo || '',
    status: row.status || 'active',
  }))

  return { profiles: formattedProfiles, error: null }
}
