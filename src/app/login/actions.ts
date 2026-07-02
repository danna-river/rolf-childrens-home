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
    // The profile row is created automatically by the `on_auth_user_created`
    // trigger (public.handle_new_user), which reads role/full_name from the
    // signUp metadata above. Do NOT insert it here: a manual insert collides
    // with the trigger's row and throws a duplicate-key error, which used to
    // abort this action before the notification emails could send.
    const fullName = data.user.user_metadata?.full_name ?? `${firstName} ${lastName}`

    // Confirm registration to the new user. Admins are NOT emailed per signup —
    // they get a weekday digest of pending accounts via the cron route
    // /api/cron/pending-accounts-digest, so a burst of signups doesn't spam them.
    // Awaited before redirect() so the send completes before the function ends.
    try {
      await sendRegistrationReceivedEmail(email, fullName)
    } catch (err) {
      console.error('[signup] registration email error:', err)
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