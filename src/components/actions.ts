import { createAdminClient } from '@/lib/supabase/admin'
import type { ChildProfile } from '@/types/profile'

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

export async function getChildrenProfiles(country?: string, search?: string, status?: string, sort?: string): Promise<{ profiles: ChildProfile[]; error: string | null }> {
  const supabase = createAdminClient()

  let query = supabase
    .from('children')
    .select('id, first_name, last_name, birth_year, birth_month, birth_day, age, country, created_at, profile_photo, status')

  if (country) query = query.eq('country', country)

  if (search) query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%`)

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

  const { data: children, error } = await query

  if (error) {
    console.error('Error fetching children from Supabase:', error)
    return { profiles: [], error: error.message }
  }

  // Map database data safely into frontend types using nullish coalescing (??)
  const mappedProfiles = (children ?? []).map((child) => {
    const c = child as DBChildRow
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
      profilePictureURL: '', // Placeholder for secure S3 signed URLs later
      status: c.status,
    }
  })

  return { profiles: mappedProfiles, error: null }
}