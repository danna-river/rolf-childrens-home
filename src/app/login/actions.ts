'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { sendRegistrationReceivedEmail, sendPendingAccountsDigest } from '@/lib/email'

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

    // Awaited before redirect() so the sends complete before the function ends.
    try {
      // 1. Confirm registration to the new user.
      await sendRegistrationReceivedEmail(email, fullName)

      // 2. Notify admins — debounced to at most one email per 24h so a burst of
      //    signups on the same day yields a single "N awaiting approval" email
      //    instead of one per registration. The profile row already exists (the
      //    on_auth_user_created trigger created it), so we detect the first
      //    signup of the window: if this is the only unapproved account created
      //    in the last 24h, send; otherwise a notice already went out today.
      const adminClient = createAdminClient()
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const { count: recentPending } = await adminClient
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'unapproved')
        .gte('created_at', since)

      if ((recentPending ?? 0) <= 1) {
        const [{ count: totalPending }, { data: admins }] = await Promise.all([
          adminClient
            .from('profiles')
            .select('id', { count: 'exact', head: true })
            .eq('role', 'unapproved'),
          adminClient.from('profiles').select('email').eq('role', 'admin'),
        ])
        const adminEmails = (admins ?? [])
          .map((a: { email: string }) => a.email)
          .filter(Boolean)
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
        await sendPendingAccountsDigest(adminEmails, totalPending ?? recentPending ?? 1, appUrl)
      }
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