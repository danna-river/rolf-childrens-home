import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types'

// Service-role client — server-side only. Never import this in client components.
// TODO: ensure SUPABASE_SERVICE_ROLE_KEY is set in .env.local (never expose to browser)
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
