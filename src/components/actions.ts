import { createAdminClient } from '@/lib/supabase/admin'
import type { ChildProfile } from '@/types/profile'
import { createClient } from '@/lib/supabase/server'
import { PAGE_SIZE } from '@/lib/pagination'

interface DBChildRow {
  id: string
  id_rolf: string | null
  first_name: string | null
  last_name: string | null
  birth_year: number | null
  birth_month: number | null
  birth_day: number | null
  country: string | null
  created_at: string
  updated_at: string | null
  year_joined: number | null
  date_joined: string | null
  profile_photo: string | null
  profile_video: string | null
  status: string
}

/** Registry query shape: the media columns arrive as embedded child_media refs. */
type RegistryQueryRow = Omit<DBChildRow, 'profile_photo' | 'profile_video'> & {
  profile_photo: { url: string } | null
  profile_video: { url: string } | null
}

export type RegisterChildInput = {
  id_rolf?: string
  first_name: string
  last_name: string
  birth_year?: number
  year_joined?: number
  date_joined?: string
  country: string
  career_aspiration?: string
  favorite_subject?: string
  hobby?: string
  bio?: string
  profile_photo?: string
  profile_video?: string
}

interface CountryRow {
  name: string
  iso_code: string
}

export type ChildrenRegistryStats = {
  total: number
  active: number
  inactive: number
  countries: number
}

type RegistryStatsRow = {
  status: string | null
  country: string | null
}

/** Split a registry search into per-word ilike patterns. Escapes ilike
 *  wildcards and strips characters that would break the PostgREST .or()
 *  filter grammar (commas/parentheses delimit its terms). */
function toIlikeSearchPatterns(search: string): string[] {
  return search
    .trim()
    .split(/\s+/)
    .map((term) => term.replace(/[,()]/g, '').replace(/([\\%_])/g, '\\$1'))
    .filter(Boolean)
    .slice(0, 5)
    .map((term) => `%${term}%`)
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
  
  // 🌟 Explicitly tell Supabase to expect your row layout structure
  const { data, error } = await supabase
    .from('countries')
    .select('name')
    .order('name', { ascending: true })

  if (error || !data) {
    console.error('Error fetching system country parameters:', error)
    return []
  }
  
  // TypeScript now recognizes 'row' as a valid object instead of 'never'
  return (data as CountryRow[]).map((row) => row.name)
}

export async function getChildrenRegistryStats(
  countries?: string[],
  useSessionClient = false,
): Promise<ChildrenRegistryStats> {
  const supabase = useSessionClient ? await createClient() : createAdminClient()

  let query = supabase.from('children').select('status, country')

  if (countries && countries.length > 0) {
    query = query.in('country', countries)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching children registry stats:', error.message)
    return { total: 0, active: 0, inactive: 0, countries: 0 }
  }

  const rows = (data ?? []) as RegistryStatsRow[]
  const countrySet = new Set(rows.flatMap((row) => (row.country ? [row.country] : [])))

  return {
    total: rows.length,
    active: rows.filter((row) => row.status === 'active').length,
    inactive: rows.filter((row) => row.status === 'inactive').length,
    countries: countrySet.size,
  }
}

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

  // ⚡ UPDATE: Switch from select('*') to sub-join across child_media references
  let query = supabase.from('children').select(`
    *,
    profile_photo:child_media!fk_children_profile_photo(url),
    profile_video:child_media!fk_children_profile_video(url)
  `, { count: 'exact' })

  if (countries && countries.length > 0) {
    query = query.in('country', countries)
  }

  if (search) {
    // Every word must match a name field or the ROLF ID (chained .or() groups
    // AND together), so full names work in either order: "Grace Nakato" and
    // "Nakato Grace" both find first_name=Grace, last_name=Nakato.
    for (const pattern of toIlikeSearchPatterns(search)) {
      query = query.or(`first_name.ilike.${pattern},last_name.ilike.${pattern},id_rolf.ilike.${pattern}`)
    }
  }

  if (status === 'active' || status === 'inactive') {
    query = query.eq('status', status)
  }

  if (yearJoined === 'unknown') {
    query = query.is('year_joined', null)
  } else if (yearJoined) {
    query = query.eq('year_joined', parseInt(yearJoined))
  }

  if (sort === 'name_desc') {
    query = query.order('first_name', { ascending: false })
  } 
  else if (sort === 'age_asc') {
    query = query
      .order('birth_year', { ascending: false })
      .order('birth_month', { ascending: false })
      .order('birth_day', { ascending: false })
  } 
  else if (sort === 'age_desc') {
    query = query
      .order('birth_year', { ascending: true })
      .order('birth_month', { ascending: true })
      .order('birth_day', { ascending: true })
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

  // ⚡ UPDATE: Unpack and flatten the nested object response back into a clean string URL
  const formattedProfiles: ChildProfile[] = ((data ?? []) as unknown as RegistryQueryRow[]).map((row) => ({
    id: row.id,
    id_rolf: row.id_rolf || null,
    firstName: row.first_name || '',
    lastName: row.last_name || '',
    birthYear: row.birth_year || 0,
    birthMonth: row.birth_month || 0,
    birthDay: row.birth_day || 0,
    age: calculateAge(row.birth_year, row.birth_month, row.birth_day),
    country: row.country || '',
    createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    updatedAt: row.updated_at || null,
    year_joined: row.year_joined || 0,
    date_joined: row.date_joined || null,
    profilePictureURL: row.profile_photo?.url || '', // 👈 Pulls the nested url path cleanly!
    status: row.status || 'active',
  }))

  return { profiles: formattedProfiles, error: null, total: count ?? 0 }
}

export function calculateAge(year: number | null, month: number | null, day: number | null): number {
  if (!year) return 0

  const today = new Date()
  const birthMonth = month ? month - 1 : 0 
  const birthDay = day || 1

  const birthDate = new Date(year, birthMonth, birthDay)
  
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDifference = today.getMonth() - birthDate.getMonth()

  if (
    monthDifference < 0 || 
    (monthDifference === 0 && today.getDate() < birthDate.getDate())
  ) {
    age--
  }

  return age < 0 ? 0 : age
}
