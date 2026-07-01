'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import {
  sendRegistrationReceivedEmail,
  sendNewAccountAlertToAdmins,
} from '@/lib/email'

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

  const { data, error } = await supabase.auth.signUp({
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

  // Non-OTP Version (Remove block once OTP added)
  if (data?.user) {
    const fullName = data.user.user_metadata?.full_name

    const { error } = await supabase
    .from('profiles')
    .insert({
      id: data.user.id,
      email: email,
      full_name: fullName,
      role: 'unapproved',
      country: null
    } as any)

    if (error) {
      return { error: error.message }
    }

    // Await the emails before redirecting — redirect() ends the serverless
    // function, so detached (fire-and-forget) sends get killed before they run.
    // Wrapped in try/catch so an email failure never blocks registration.
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
    try {
      await sendRegistrationReceivedEmail(email, fullName)

      const adminClient = createAdminClient()
      const { data: admins } = await adminClient
        .from('profiles')
        .select('email')
        .eq('role', 'admin')
      const adminEmails = (admins ?? [])
        .map((a: { email: string }) => a.email)
        .filter(Boolean)
      await sendNewAccountAlertToAdmins(adminEmails, fullName, email, appUrl)
    } catch (err) {
      console.error('[signup] notification email error:', err)
    }
  }

  redirect('/dashboard')

  /*
  return { success: true, email }
  */
}

// Non-OTP Version (Remove block once OTP added)
/*
export async function verifyOtpAction(email: string, token: string) {
    const supabase = await createClient()

    if (!email || !token || token.trim().length !== 6) {
      return { error: 'A valid 6-digit verification code is required.' }
    }
    
    const {data, error} = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'signup'
    })
    if (error) {
      return { error: error.message }
    }

    if (data?.user) {
      const fullName = data.user.user_metadata?.full_name

      const { error } = await supabase
      .from('profiles')
      .insert({
        id: data.user.id,
        email: email,
        full_name: fullName,
        role: 'unapproved',
        country: null
      } as any)

      if (error) {
        return { error: error.message }
      }
    }

    redirect('/dashboard')
}
*/

export async function signOutAction() {
  const supabase = await createClient()

  await supabase.auth.signOut()

  redirect('/login')
}