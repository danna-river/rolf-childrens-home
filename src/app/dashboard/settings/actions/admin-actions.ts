"use server"

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/auth'
import { isAdminRole } from '@/lib/profiles'

// Security Guard to ensure only true administrators hit these endpoints
async function verifyAdminGate() {
  const { user, profile } = await requireAuth()
  if (!isAdminRole(profile.role)) {
    throw new Error('Unauthorized: Administrative clearance required.')
  }
  return user
}

export async function approveAccountAction(userId: string, role: string, countries: string[]) {
  await verifyAdminGate()
  
  const adminSupabase = await createAdminClient()

  // 🌟 FIX: Use empty array '{}' instead of null to match your native text[] column migration bounds
  const { error } = await (adminSupabase as any)
    .from('profiles')
    .update({
      role: role,
      country: countries.length > 0 ? countries : '{}'
    })
    .eq('id', userId)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/approval')
  return { success: true }
}

export async function denyAccountAction(userId: string) {
  await verifyAdminGate()
  
  const adminSupabase = await createAdminClient()

  const { error: dbError } = await adminSupabase
    .from('profiles')
    .delete()
    .eq('id', userId)
  if (dbError) return { error: dbError.message }

  const { error: authError } = await adminSupabase.auth.admin.deleteUser(userId)
  if (authError) return { error: authError.message }

  revalidatePath('/dashboard/settings')
  return { success: true }
}

export async function deleteAccountAction(userId: string) {
  const currentUser = await verifyAdminGate()
  const adminSupabase = await createAdminClient()

  if (userId === currentUser.id) {
    return { error: 'Action denied: You cannot delete your own account.' }
  }

  const { data: target } = await (adminSupabase as any)
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()
  
  if (!target) return { error: 'Account not found.' }

  if (isAdminRole(target.role)) {
    const { count } = await adminSupabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'admin')
    if ((count ?? 0) <= 1) {
      return { error: 'Action denied: Cannot delete the last administrator.' }
    }
  }
  
  const { count: sponsorCount } = await adminSupabase
    .from('sponsorships')
    .select('id', { count: 'exact', head: true })
    .eq('donor_id', userId)
  if ((sponsorCount ?? 0) > 0) {
    return { error: `Cannot delete: ${sponsorCount} sponsorship(s) are linked to this donor. End or reassign them first.` }
  }

  const { count: childCount } = await adminSupabase
    .from('children')
    .select('id', { count: 'exact', head: true })
    .eq('created_by', userId)
  if ((childCount ?? 0) > 0) {
    return { error: `Cannot delete: ${childCount} child record(s) were created by this staff account. Reassign or remove them first.` }
  }

  const { error: dbError } = await adminSupabase
    .from('profiles')
    .delete()
    .eq('id', userId)
  if (dbError) return { error: dbError.message }

  const { error: authError } = await adminSupabase.auth.admin.deleteUser(userId)
  if (authError) return { authError: authError.message }

  revalidatePath('/dashboard/settings')
  return { success: true }
}

// Update this function inside your admin-actions.ts file

export async function appendNewCountryAction(input: { name: string; isoCode: string }) {
  await verifyAdminGate()
  const adminSupabase = await createAdminClient()

  const cleanName = input.name.trim()
  const cleanIsoCode = input.isoCode.trim().toUpperCase()

  // 1. Check for empty fields
  if (!cleanName || !cleanIsoCode) {
    return { error: 'Both Country Name and ISO Code parameters are required.' }
  }

  // 2. 🌟 RULE: Enforce exactly 3 letters for the ISO code
  const threeLetterRegex = /^[A-Z]{3}$/
  if (!threeLetterRegex.test(cleanIsoCode)) {
    return { error: 'Format Error: ISO Code must be exactly 3 alphabetical letters (e.g. BEN, UGA).' }
  }

  // 3. 🌟 RULE: Verify Country Name does not already exist (case-insensitive check)
  const { data: nameMatch, error: nameCheckError } = await adminSupabase
    .from('countries')
    .select('name')
    .ilike('name', cleanName) // ilike makes it case-insensitive
    .maybeSingle()

  if (nameCheckError) return { error: nameCheckError.message }
  if (nameMatch) {
    return { error: `Validation Error: The country "${cleanName}" already exists in the system.` }
  }

  // 4. 🌟 RULE: Verify ISO Code does not already exist
  const { data: codeMatch, error: codeCheckError } = await adminSupabase
    .from('countries')
    .select('iso_code')
    .eq('iso_code', cleanIsoCode)
    .maybeSingle()

  if (codeCheckError) return { error: codeCheckError.message }
  if (codeMatch) {
    return { error: `Validation Error: The ISO code "${cleanIsoCode}" is already assigned to another country.` }
  }

  // 5. Proceed with insertion since all validation checks passed safely
  const { error } = await (adminSupabase as any)
    .from('countries')
    .insert({
      name: cleanName,
      iso_code: cleanIsoCode
    })

  if (error) return { error: error.message }

  revalidatePath('/dashboard/settings')
  return { success: true }
}

// 🌟 REFACTORED: Cleans up table checks and deletes rows from your countries table
export async function removeCountryAction(targetCountry: string) {
  await verifyAdminGate()
  const adminSupabase = await createAdminClient()

  const cleanCountryName = targetCountry.trim()

  // 1. GUARD A: Check if any active user profiles contain this country item inside their text[] array field bounds
  const { data: profileMatches, error: profileCheckError } = await adminSupabase
    .from('profiles')
    .select('id')
    .overlaps('country', [cleanCountryName]) // Works perfectly for native text[] array types!

  if (profileCheckError) return { error: profileCheckError.message }
  if (profileMatches && profileMatches.length > 0) {
    return {
      error: `Cannot remove "${cleanCountryName}". There are currently ${profileMatches.length} user profile(s) assigned to this region.`
    }
  }

  // 2. GUARD B: Check if any child records match this country name field
  const { data: childMatches, error: childCheckError } = await adminSupabase
    .from('children')
    .select('id')
    .eq('country', cleanCountryName)

  if (childCheckError) return { error: childCheckError.message }
  if (childMatches && childMatches.length > 0) {
    return {
      error: `Cannot remove "${cleanCountryName}". There are currently ${childMatches.length} active child record(s) bound to this region.`
    }
  }

  // 3. REMOVAL: Execute a direct row deletion targeting the specific country name match
  const { error: deleteError } = await adminSupabase
    .from('countries')
    .delete()
    .eq('name', cleanCountryName) // Adjust to match your column identifier key ('name' vs 'iso_code')

  if (deleteError) return { error: deleteError.message }

  revalidatePath('/dashboard/settings')
  return { success: true }
}