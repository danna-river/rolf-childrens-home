import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { isUnapprovedRole, type UserProfile } from '@/lib/profiles'

interface AuthOptions {
    allowUnapproved?: boolean
}

/**
 * Global security gatekeeper for server pages.
 * - If not logged in: redirects straight to /login
 * - If unapproved and trying to access a secure sub-page: redirects to /dashboard
 */
export async function requireAuth(options: AuthOptions = {}) {
    const supabase = await createClient()

    // 1. GATE 1: Fail fast if there is no active session token
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return redirect('/login?error=SessionExpired')
    }

    // 2. GATE 2: Securely retrieve permissions profile
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, role, country, full_name')
        .eq('id', user.id)
        .single() as { data: UserProfile | null; error: unknown }

    if (profileError || !profile) {
        return redirect('/login?error=Unauthorized')
    }

    // 3. GATE 3: Catch unapproved role attempts unless explicitly allowed (like on the base dashboard page)
    if (isUnapprovedRole(profile.role) && !options.allowUnapproved) {
        return redirect('/dashboard')
    }

    // Return the validated records so the page can consume them immediately without re-fetching
    return { user, profile }
}

/**
 * Reverse security gatekeeper for public pages like /login.
 * If a user is already logged in, it bounces them straight to the dashboard.
 */
export async function redirectIfAuthenticated() {
    const supabase = await createClient()

    // Check if a valid user session token already exists in browser cookies
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
        // Already logged in? Take them straight to the main hub.
        return redirect('/dashboard')
    }
}