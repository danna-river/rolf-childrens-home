'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { sendRegistrationReceivedEmail } from '@/lib/email'

export async function loginAction(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { error: error.message }
  }

  redirect('/dashboard')
}

export async function signUpAction(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const firstName = formData.get('firstName') as string
  const lastName = formData.get('lastName') as string

  if (!email || !password || !firstName || !lastName) {
    return { error: 'All registration fields are required.' }
  }

  const fullName = firstName + ' ' + lastName

  const supabase = await createClient()

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        'full_name': fullName,
        'role': 'unapproved'
      }
    },
  })

  if (error) {
    return { error: error.message }
  }

  // Email confirmation is enabled in Supabase, so signUp emails a 6-digit code
  // (delivered via the Supabase SMTP → Resend integration) and does NOT create
  // a session. The profiles row is created by the on_auth_user_created trigger.
  // The user verifies the code next via verifyOtpAction — don't redirect or send
  // our own email here, since the address isn't confirmed yet.
  return { success: true, email }
}

export async function verifyOtpAction(email: string, token: string) {
  const supabase = await createClient()

  if (!email || !token || token.trim().length !== 6) {
    return { error: 'A valid 6-digit verification code is required.' }
  }

  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email',
  })
  if (error) {
    return { error: error.message }
  }

  // Email is now confirmed and a session exists. The profiles row already exists
  // (on_auth_user_created trigger) — do NOT insert it. Send the "received,
  // pending approval" confirmation now that the address is verified.
  if (data?.user) {
    const fullName = data.user.user_metadata?.full_name ?? ''
    try {
      await sendRegistrationReceivedEmail(email, fullName)
    } catch (err) {
      console.error('[verifyOtp] registration email error:', err)
    }
  }

  redirect('/dashboard')
}

export async function signOutAction() {
  const supabase = await createClient()

  await supabase.auth.signOut()

  redirect('/login')
}
