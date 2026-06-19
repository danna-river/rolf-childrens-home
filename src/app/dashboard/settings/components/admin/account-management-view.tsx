"use client"

import { useState } from 'react'
import { Trash2Icon, SearchIcon, TriangleAlertIcon } from 'lucide-react'
import { deleteAccountAction, approveAccountAction } from '@/app/dashboard/settings/actions/admin-actions'
import { type Profile } from '@/lib/types'
import { isAdminRole, isStaffRole, isDonorRole } from '@/lib/profiles'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface AccountManagementViewProps {
  initialUsers: Profile[]
  currentUserId: string
  availableCountries: string[] 
}

const ROLE_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'admin', label: 'Admins' },
  { id: 'staff', label: 'Staff' },
  { id: 'donor', label: 'Donors' },
] as const

export function AccountManagementView({ initialUsers, currentUserId, availableCountries }: AccountManagementViewProps) {
  const [users, setUsers] = useState<Profile[]>(initialUsers)
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')

  // 🌟 Local UI saving state tracking maps
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<Record<string, 'idle' | 'saving' | 'saved'>>({})
  const [globalError, setGlobalError] = useState<string | null>(null)

  // 🌟 Real-time maps for storing unsaved edits before hitting "Save Changes"
  const [userRoles, setUserRoles] = useState<Record<string, string>>(
    initialUsers.reduce((acc, u) => ({ ...acc, [u.id]: u.role }), {})
  )
  const [userCountries, setUserCountries] = useState<Record<string, string[]>>(
    initialUsers.reduce((acc, u) => {
      const parsedCountries = Array.isArray(u.country) 
        ? u.country 
        : typeof u.country === 'string' && u.country 
          ? [u.country] 
          : [];
      return { ...acc, [u.id]: parsedCountries };
    }, {})
  )

  // The account pending deletion (drives the confirmation modal).
  const [confirmUser, setConfirmUser] = useState<Profile | null>(null)
  const [busy, setBusy] = useState(false)
  const [dialogError, setDialogError] = useState<string | null>(null)

  const closeDialog = () => {
    if (busy) return
    setConfirmUser(null)
    setDialogError(null)
  }

  // 🌟 Handles local role selection switching
  const handleRoleChange = (userId: string, newRole: string) => {
    setUserRoles({ ...userRoles, [userId]: newRole })
    setSaveStatus({ ...saveStatus, [userId]: 'idle' }) // Reset to "Save Changes" state
  }

  // 🌟 Handles local staff region checkbox toggles
  const toggleCountrySelection = (userId: string, country: string) => {
    const currentList = userCountries[userId] || []
    const updatedList = currentList.includes(country)
      ? currentList.filter(item => item !== country)
      : [...currentList, country]
    
    setUserCountries({ ...userCountries, [userId]: updatedList })
    setSaveStatus({ ...saveStatus, [userId]: 'idle' }) // Reset to "Save Changes" state
  }

  // 🌟 Fires the server action to save live state configurations to Supabase
  const handleSaveChanges = async (userId: string) => {
    setGlobalError(null)
    setProcessingId(userId)
    setSaveStatus({ ...saveStatus, [userId]: 'saving' })

    const selectedRole = userRoles[userId]
    // If the role isn't staff anymore, strip out their assigned countries automatically
    const selectedRegions = selectedRole === 'staff' ? userCountries[userId] : []

    const res = await approveAccountAction(userId, selectedRole, selectedRegions)
    
    if (res.error) {
      setGlobalError(res.error)
      setSaveStatus({ ...saveStatus, [userId]: 'idle' })
    } else {
      setSaveStatus({ ...saveStatus, [userId]: 'saved' })
      
      // 🌟 FIX: Force-assert the object properties to match the 'Profile' type structural signature
      setUsers(users.map(u => u.id === userId ? { 
        ...u, 
        role: selectedRole as Profile['role'], // 👈 Add the type assertion here
        country: selectedRegions 
      } : u))
    }
    setProcessingId(null)
  }

  const handleConfirmDelete = async () => {
    if (!confirmUser) return
    setBusy(true)
    setDialogError(null)
    const res = await deleteAccountAction(confirmUser.id)
    setBusy(false)
    if (res.error) {
      setDialogError(res.error)
      return
    }
    setUsers((prev) => prev.filter((u) => u.id !== confirmUser.id))
    setConfirmUser(null)
  }

  const q = query.trim().toLowerCase()
  const filtered = users.filter((u) => {
    // Read current updated role map state to maintain search/filter accuracy
    const currentRole = userRoles[u.id] || u.role
    const matchesRole =
      roleFilter === 'all' ||
      (roleFilter === 'admin' && isAdminRole(currentRole)) ||
      (roleFilter === 'staff' && isStaffRole(currentRole)) ||
      (roleFilter === 'donor' && isDonorRole(currentRole))
    const matchesQuery =
      q === '' ||
      (u.full_name ?? '').toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    return matchesRole && matchesQuery
  })

  return (
    <div className="space-y-4">
      {globalError && (
        <div className="p-3 bg-red-50 border border-red-100 text-sm text-red-600 rounded-xl">
          ⚠️ Action Interrupted: {globalError}
        </div>
      )}

      {/* Search + role filter bar */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-600" aria-hidden="true" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full rounded-xl border border-gray-100 bg-white pl-9 pr-3 py-2 text-sm text-gray-700 outline-none focus:border-gray-300"
          />
        </div>
        <div className="flex gap-1">
          {ROLE_FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setRoleFilter(f.id)}
              className={roleFilter === f.id ? 'px-3 py-1.5 text-sm font-semibold rounded-lg bg-blue-50 text-blue-600 cursor-pointer' : 'px-3 py-1.5 text-sm font-medium rounded-lg text-gray-700 hover:bg-gray-100 cursor-pointer'}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center text-sm text-gray-600">
          No accounts match your search.
        </div>
      ) : (
        filtered.map((user) => {
          const isSelf = user.id === currentUserId
          const currentRole = userRoles[user.id] || 'donor'
          const currentCountries = userCountries[user.id] || []
          const currentSaveState = saveStatus[user.id] || 'idle'
          const isWorking = processingId === user.id

          return (
            <div key={user.id} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-xs flex flex-col gap-4">
              
              {/* Upper Control Row: Profile Metadata + Interactive Role Dropdown */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-gray-900 truncate">
                      {user.full_name || 'Unnamed account'}
                    </h3>
                    {isSelf && <span className="text-xs text-gray-600 font-medium bg-gray-100 px-1.5 py-0.5 rounded">(you)</span>}
                  </div>
                  <p className="text-sm text-gray-600 font-mono mt-0.5 truncate">{user.email}</p>
                </div>

                {/* Dropdown Role Selector replacing old read-only status text metadata badges */}
                <div className="shrink-0">
                  <select
                    disabled={isSelf || isWorking}
                    value={currentRole}
                    onChange={(e) => handleRoleChange(user.id, e.target.value)}
                    className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-1.5 text-sm text-gray-700 outline-none font-medium disabled:opacity-50 cursor-pointer"
                  >
                    <option value="staff">Regional Staff</option>
                    <option value="admin">System Administrator</option>
                    <option value="donor">Donor</option>
                  </select>
                </div>
              </div>

              {/* 🌟 Dynamic Jurisdictions Matrix (Mounts directly if current active state is Regional Staff) */}
              {currentRole === 'staff' && (
                <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 space-y-2 animate-fade-in">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-600 block">
                    Assigned Jurisdictional Regions
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {availableCountries.map((country) => {
                      const isChecked = currentCountries.includes(country)
                      return (
                        <button
                          type="button"
                          key={country}
                          disabled={isWorking || isSelf}
                          onClick={() => toggleCountrySelection(user.id, country)}
                          className={`px-2.5 py-1 text-[11px] font-medium rounded-md border transition-all cursor-pointer ${
                            isChecked 
                              ? "border-blue-400 bg-blue-50 text-blue-600 font-semibold" 
                              : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          {country} {isChecked ? '✓' : ''}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Lower Actions Section Footer Row */}
              <div className="flex items-center justify-between border-t border-gray-50 pt-3">
                <button
                  onClick={() => {
                    setDialogError(null)
                    setConfirmUser(user)
                  }}
                  disabled={isSelf || isWorking}
                  className="inline-flex items-center gap-1.5 bg-red-50 text-red-700 font-semibold text-sm px-3 py-1.5 rounded-lg cursor-pointer hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                >
                  <Trash2Icon className="size-3.5" aria-hidden="true" />
                  Delete
                </button>

                {/* Persist Save Button */}
                <button
                  disabled={isWorking || currentSaveState === 'saving' || isSelf}
                  onClick={() => handleSaveChanges(user.id)}
                  className={`text-sm font-bold px-4 py-1.5 rounded-lg transition-all cursor-pointer shadow-3xs ${
                    currentSaveState === 'saved'
                      ? "bg-emerald-50 border border-emerald-200 text-emerald-600 animate-pulse"
                      : isSelf 
                        ? "bg-gray-100 text-gray-600 cursor-not-allowed"
                        : "bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-400"
                  }`}
                >
                  {currentSaveState === 'saving' ? 'Saving...' : currentSaveState === 'saved' ? 'Changes Saved ✓' : 'Save Changes'}
                </button>
              </div>

            </div>
          )
        })
      )}

      <p className="text-[11px] text-gray-600 px-1">
        Showing {filtered.length} of {users.length} account{users.length === 1 ? '' : 's'}. Deleting is blocked for accounts linked to sponsorships or registered children.
      </p>

      {/* Confirmation modal */}
      <Dialog open={confirmUser !== null} onOpenChange={(open) => { if (!open) closeDialog() }}>
        <DialogContent showCloseButton={!busy} className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
                <TriangleAlertIcon className="size-5" aria-hidden="true" />
              </span>
              <DialogTitle>Delete this account?</DialogTitle>
            </div>
            <DialogDescription className="pt-2">
              This permanently deletes <span className="font-medium text-foreground">{confirmUser?.full_name || confirmUser?.email}</span>
              {confirmUser?.full_name ? (<> (<span className="font-mono">{confirmUser.email}</span>)</>) : null} and their login. This action <span className="font-semibold">cannot be undone</span>.
            </DialogDescription>
          </DialogHeader>

          {dialogError && <div className="p-3 bg-red-50 border border-red-100 text-sm text-red-600 rounded-xl">⚠️ {dialogError}</div>}

          <DialogFooter>
            <DialogClose disabled={busy} className="px-4 py-2 text-sm font-semibold rounded-lg bg-gray-100 text-gray-600 cursor-pointer hover:bg-gray-200 disabled:opacity-50">Cancel</DialogClose>
            <button onClick={handleConfirmDelete} disabled={busy} className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-red-600 text-white cursor-pointer hover:bg-red-700 disabled:opacity-50">
              <Trash2Icon className="size-3.5" aria-hidden="true" /> {busy ? 'Deleting…' : 'Delete account'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}