"use server"
import { createAdminClient } from '@/lib/supabase/admin'
import type { RegisterChildInput } from '@/components/actions'

export async function registerChildAction(
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
