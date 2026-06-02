"use server"
import { createAdminClient } from '@/lib/supabase/admin'

export type UpdateChildInput = {
  first_name: string
  last_name: string
  birth_year?: number
  birth_month?: number
  birth_day?: number
  age: number
  year_joined?: number
  country: string
  career_aspiration?: string
  favorite_subject?: string
  hobby?: string
  bio?: string
  notes?: string
  status: 'active' | 'inactive'
}

export async function updateChildAction(
  id: string,
  input: UpdateChildInput,
): Promise<{ error: string | null }> {
  const supabase = createAdminClient()
  const display_name = `${input.first_name} ${input.last_name}`.trim()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('children')
    .update({
      display_name,
      first_name: input.first_name,
      last_name: input.last_name,
      age: input.age,
      birth_year: input.birth_year ?? null,
      birth_month: input.birth_month ?? null,
      birth_day: input.birth_day ?? null,
      year_joined: input.year_joined ?? null,
      country: input.country,
      career_aspiration: input.career_aspiration ?? null,
      favorite_subject: input.favorite_subject ?? null,
      hobby: input.hobby ?? null,
      bio: input.bio ?? null,
      notes: input.notes ?? null,
      status: input.status,
    })
    .eq('id', id)

  if (error) return { error: error.message }
  return { error: null }
}
