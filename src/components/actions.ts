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

export type RegisterChildInput = {
  first_name: string
  last_name: string
  age: number
  birth_year?: number
  year_joined?: number
  country: string
  career_aspiration?: string
  favorite_subject?: string
  hobby?: string
  bio?: string
}

export async function registerChild(
  input: RegisterChildInput,
): Promise<{ id: string | null; error: string | null }> {
  const supabase = createAdminClient()
  const display_name = `${input.first_name} ${input.last_name}`.trim()
  const { data, error } = await supabase
    .from('children')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert({
      display_name,
      first_name: input.first_name,
      last_name: input.last_name,
      age: input.age,
      birth_year: input.birth_year ?? null,
      year_joined: input.year_joined ?? null,
      country: input.country,
      career_aspiration: input.career_aspiration ?? null,
      favorite_subject: input.favorite_subject ?? null,
      hobby: input.hobby ?? null,
      bio: input.bio ?? null,
      status: 'active',
    } as any)
    .select('id')
    .single()
  if (error) return { id: null, error: error.message }
  return { id: (data as { id: string }).id, error: null }
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
