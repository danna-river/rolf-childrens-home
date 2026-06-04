import { createAdminClient } from '@/lib/supabase/admin'
import type { ChildProfile } from '@/types/profile'
import { createClient } from '@/lib/supabase/server'

interface DBChildRow {
  id: string
  id_rolf: string | null
  first_name: string | null
  last_name: string | null
  birth_year: number | null
  birth_month: number | null
  birth_day: number | null
  age: number | null
  country: string | null
  created_at: string
  year_joined: number | null
  date_joined: string | null
  profile_photo: string | null
  status: string
}

export type RegisterChildInput = {
  id_rolf?: string
  first_name: string
  last_name: string
  age: number
  birth_year?: number
  year_joined?: number
  date_joined?: string
  country: string
  career_aspiration?: string
  favorite_subject?: string
  hobby?: string
  bio?: string
  profile_photo?: string
}


export async function getJoinedYears(): Promise<number[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('children')
    .select('year_joined')
    .not('year_joined', 'is', null)
    .order('year_joined', { ascending: false })
  const unique = [...new Set((data ?? []).map((r: { year_joined: number | null }) => r.year_joined as number))]
  return unique
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

const PAGE_SIZE = 10

export async function getChildrenProfiles(
  countries?: string[],
  search?: string,
  status?: string,
  sort?: string,
  useSessionClient = false,
  yearJoined?: string,
  page = 1,
): Promise<{ profiles: ChildProfile[]; error: string | null; total: number }> {
  const supabase = useSessionClient ? await createClient() : createAdminClient()

  let query = supabase.from('children').select('*', { count: 'exact' })

  if (countries && countries.length > 0) {
    query = query.in('country', countries)
  }

  if (search) {
    query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,id_rolf.ilike.%${search}%`)
  }

  if (status && status !== 'all') {
    query = query.eq('status', status)
  }

  if (yearJoined === 'unknown') {
    query = query.is('year_joined', null)
  } else if (yearJoined) {
    query = query.eq('year_joined', parseInt(yearJoined))
  }

  if (sort === 'name_desc') {
    query = query.order('first_name', { ascending: false })
  } else if (sort === 'age_asc') {
    query = query.order('age', { ascending: true })
  } else if (sort === 'age_desc') {
    query = query.order('age', { ascending: false })
  } else if (sort === 'rolf_id_asc') {
    query = query.order('id_rolf', { ascending: true, nullsFirst: false })
  } else if (sort === 'rolf_id_desc') {
    query = query.order('id_rolf', { ascending: false, nullsFirst: false })
  } else {
    query = query.order('first_name', { ascending: true })
  }

  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1
  const { data, error, count } = await query.range(from, to)

  if (error) {
    console.error('❌ FETCH ACTIONS: Failed to query children registry:', error.message)
    return { profiles: [], error: error.message, total: 0 }
  }

  const formattedProfiles: ChildProfile[] = ((data ?? []) as DBChildRow[]).map((row) => ({
    id: row.id,
    id_rolf: row.id_rolf || null,
    firstName: row.first_name || '',
    lastName: row.last_name || '',
    birthYear: row.birth_year || 0,
    birthMonth: row.birth_month || 0,
    birthDay: row.birth_day || 0,
    age: row.age || 0,
    country: row.country || '',
    createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    year_joined: row.year_joined || 0,
    date_joined: row.date_joined || null,
    profilePictureURL: row.profile_photo || '',
    status: row.status || 'active',
  }))

  return { profiles: formattedProfiles, error: null, total: count ?? 0 }
}
