"use server"

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/auth'
import { isAdminRole } from '@/lib/profiles'

// Security Guard to ensure only true administrators hit these endpoints
async function verifyAdminGate() {
  const { profile } = await requireAuth()
  if (!isAdminRole(profile.role)) {
    throw new Error('Unauthorized: Administrative clearance required.')
  }
}

export async function approveAccountAction(userId: string, role: string, countries: string[]) {
  await verifyAdminGate()
  const supabase = await createClient()

  // Update the user's role configuration parameters inside the table
  const { error } = await (supabase
    .from('profiles') as any)
    .update({
      role: role,
      country: countries.length > 0 ? countries : null
    })
    .eq('id', userId)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/approval')
  return { success: true }
}

export async function denyAccountAction(userId: string) {
  await verifyAdminGate()
  const supabase = await createClient()
  const adminSupabase = createAdminClient()

  // 1. Erase public footprint row from profiles database table
  const { error: dbError } = await supabase
    .from('profiles')
    .delete()
    .eq('id', userId)
  if (dbError) return { error: dbError.message }

  // 2. Erase core authentication identity from Supabase Auth storage completely
  const { error: authError } = await adminSupabase.auth.admin.deleteUser(userId)
  if (authError) return { error: authError.message }

  revalidatePath('/dashboard/settings')
  return { success: true }
}

export async function appendNewCountryAction(newCountry: string) {
  await verifyAdminGate()
  const supabase = await createClient()

  if (!newCountry || newCountry.trim().length === 0) {
    return { error: 'Country name parameter cannot be empty.' }
  }

  // Appends an item directly into the database text array at Row ID #1
  const { error } = await (supabase.rpc as any)('append_setting_country', {
    country_name: newCountry.trim()
  })

  // Alternative fallback approach if your instance prefers a direct pipeline modification block:
  // We grab row 1, push, and save, but a direct SQL update is safest. Let's write the SQL helper below.
  if (error) {
    // Direct execution fallback string parameter block
    const { data } = await (supabase.from('app_settings') as any)
      .select('countries')
      .eq('id', 1)
      .single()
    const updatedCountries = [...(data?.countries || []), newCountry.trim()]
    const { error: updateError } = await (supabase.from('app_settings') as any)
      .update({ countries: updatedCountries })
      .eq('id', 1)
    if (updateError) return { error: updateError.message }
  }

  revalidatePath('/dashboard/settings')
  return { success: true }
}

export async function removeCountryAction(targetCountry: string) {
  await verifyAdminGate()
  const supabase = await createClient()

  const cleanCountryName = targetCountry.trim()

  // 1. GUARD A: Check if any active user profiles are assigned to this country
  const { data: profileMatches, error: profileCheckError } = await supabase
    .from('profiles')
    .select('id')
    .overlaps('country', [cleanCountryName])

  if (profileCheckError) return { error: profileCheckError.message }
  if (profileMatches && profileMatches.length > 0) {
    return {
      error: `Cannot remove "${cleanCountryName}". There are currently ${profileMatches.length} user profile(s) assigned to this jurisdiction.`
    }
  }

  // 2. GUARD B: Check if any child records are pinned to this country location
  const { data: childMatches, error: childCheckError } = await supabase
    .from('children')
    .select('id')
    .eq('country', cleanCountryName)

  if (childCheckError) return { error: childCheckError.message }
  if (childMatches && childMatches.length > 0) {
    return {
      error: `Cannot remove "${cleanCountryName}". There are currently ${childMatches.length} active child record(s) bound to this location.`
    }
  }

  // 3. REMOVAL: Pull list, filter out target string, and rewrite back to row 1
  const { data } = await (supabase.from('app_settings') as any)
    .select('countries')
    .eq('id', 1)
    .single()

  const currentList: string[] = data?.countries || []
  const updatedList = currentList.filter(item => item !== cleanCountryName)

  const { error: updateError } = await (supabase.from('app_settings') as any)
    .update({ countries: updatedList })
    .eq('id', 1)

  if (updateError) return { error: updateError.message }

  revalidatePath('/dashboard/settings')
  return { success: true }
}