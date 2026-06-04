"use server"
import { createAdminClient } from '@/lib/supabase/admin'
import type { RegisterChildInput } from '@/components/actions'

const COUNTRY_CODES: Record<string, string> = {
  'Uganda': 'UGA', 'Kenya': 'KEN', 'Tanzania': 'TZA', 'Rwanda': 'RWA',
  'Burundi': 'BDI', 'South Sudan': 'SSD', 'Ethiopia': 'ETH', 'Ghana': 'GHA',
  'Nigeria': 'NGA', 'Togo': 'TGO', 'Niger': 'NER', 'Burkina Faso': 'BFA',
  'Benin': 'BEN', 'Mali': 'MLI', 'Senegal': 'SEN', "Côte d'Ivoire": 'CIV',
  'Ivory Coast': 'CIV', 'Cameroon': 'CMR', 'Zambia': 'ZMB', 'Zimbabwe': 'ZWE',
  'Malawi': 'MWI', 'Mozambique': 'MOZ', 'DRC': 'COD', 'Congo': 'COG',
}

export async function generateRolfId(
  country: string,
): Promise<{ id: string | null; error: string | null }> {
  const code = COUNTRY_CODES[country]
  if (!code) return { id: null, error: `No country code for "${country}". Enter the ID manually.` }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any
  const { data } = await supabase
    .from('children')
    .select('id_rolf')
    .like('id_rolf', `${code}-%`)

  let max = 0
  for (const row of (data ?? []) as { id_rolf: string | null }[]) {
    const match = row.id_rolf?.match(/^[A-Z]+-(\d+)$/)
    if (match) {
      const n = parseInt(match[1], 10)
      if (n > max) max = n
    }
  }

  return { id: `${code}-${String(max + 1).padStart(4, '0')}`, error: null }
}

export async function registerChildAction(
  input: RegisterChildInput,
): Promise<{ id: string | null; error: string | null }> {
  const supabase = createAdminClient()
  const display_name = `${input.first_name} ${input.last_name}`.trim()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('children')
    .insert({
      id_rolf: input.id_rolf ?? null,
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
      profile_photo: input.profile_photo ?? null,
      status: 'active',
    })
    .select('id')
    .single()
  if (error) return { id: null, error: error.message }
  return { id: (data as { id: string }).id, error: null }
}
