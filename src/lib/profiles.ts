/** Auth user roles stored on `profiles.role`. Keep in sync with `supabase/schema.sql`. */
export const USER_ROLES = ['admin', 'staff', 'donor', 'unapproved'] as const

export type UserRole = (typeof USER_ROLES)[number]

/** Subset of profile fields used for dashboard routing. */
export type UserProfile = {
  role: string
  country: string[] | null
}

export function normalizeUserRole(role: string): string {
  const normalized = role.trim().toLowerCase()
  return normalized
}

export function isAdminRole(role: string): boolean {
  const normalized = normalizeUserRole(role)
  return normalized === 'admin' || normalized === 'super_admin'
}

export function isStaffRole(role: string): boolean {
  return normalizeUserRole(role) === 'staff'
}

export function isDonorRole(role: string): boolean {
  return normalizeUserRole(role) === 'donor'
}

export function isUnapprovedRole(role: string): boolean {
  return normalizeUserRole(role) === 'unapproved'
}
