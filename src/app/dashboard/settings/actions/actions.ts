'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { sendPasswordChangedEmail } from '@/lib/email'

export async function updateProfileName(fullName: string) {
  const supabase = await createClient()

  // 1. Get the current user session securely from the encrypted JWT token
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: 'Session expired or unauthorized.' }
  }

  if (!fullName.trim()) {
    return { success: false, error: 'Display name cannot be blank.' }
  }

  // 2. Enforce absolute ownership: Target ONLY the authenticated session user's ID
  const { error } = await supabase
    .from('profiles')
    .update({ full_name: fullName.trim() })
    .eq('id', user.id) // 🔒 Security Check: Prevents updating any other profile row

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/dashboard/settings')
  return { success: true }
}

export async function updateAccountPassword(password: string) {
  const supabase = await createClient()

  // 1. Double check session legitimacy before hitting auth management
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: 'Session expired or unauthorized.' }
  }

  if (!password || password.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters long.' }
  }

  // 2. 🔒 Security Check: This endpoint natively mutates ONLY the active session token owner's credentials
  const { error } = await supabase.auth.updateUser({
    password: password
  })

  if (error) {
    return { success: false, error: error.message }
  }

  // Fetch name for the email — user.email is already available from getUser above
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  try {
    await sendPasswordChangedEmail(user.email!, profile?.full_name ?? 'there')
  } catch (err) {
    console.error('[updatePassword] email error:', err)
  }

  return { success: true }
}