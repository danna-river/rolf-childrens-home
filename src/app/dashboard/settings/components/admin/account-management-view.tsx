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

  const [processingId, setProcessingId] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<Record<string, 'idle' | 'saving' | 'saved'>>({})
  const [globalError, setGlobalError] = useState<string | null>(null)

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

  const [confirmUser, setConfirmUser] = useState<Profile | null>(null)
  const [busy, setBusy] = useState(false)
  const [dialogError, setDialogError] = useState<string | null>(null)

  const closeDialog = () => {
    if (busy) return
    setConfirmUser(null)
    setDialogError(null)
  }

  const handleRoleChange = (userId: string, newRole: string) => {
    setUserRoles({ ...userRoles, [userId]: newRole })
    setSaveStatus({ ...saveStatus, [userId]: 'idle' })
  }

  const toggleCountrySelection = (userId: string, country: string) => {
    const currentList = userCountries[userId] || []
    const updatedList = currentList.includes(country)
      ? currentList.filter(item => item !== country)
      : [...currentList, country]
    
    setUserCountries({ ...userCountries, [userId]: updatedList })
    setSaveStatus({ ...saveStatus, [userId]: 'idle' })
  }

  const handleSaveChanges = async (userId: string) => {
    setGlobalError(null)
    setProcessingId(userId)
    setSaveStatus({ ...saveStatus, [userId]: 'saving' })

    const selectedRole = userRoles[userId]
    const selectedRegions = selectedRole === 'staff' ? userCountries[userId] : []

    const res = await approveAccountAction(userId, selectedRole, selectedRegions)
    
    if (res.error) {
      setGlobalError(res.error)
      setSaveStatus({ ...saveStatus, [userId]: 'idle' })
    } else {
      setSaveStatus({ ...saveStatus, [userId]: 'saved' })
      setUsers(users.map(u => u.id === userId ? { 
        ...u, 
        role: selectedRole as Profile['role'],
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
    <div className="google-sans-registry space-y-4">
      {globalError && (
        <div className="p-3 bg-rose-50/50 border border-rose-200 text-xs text-rose-700 rounded-md font-bold">
          ⚠️ Action Interrupted: {globalError}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-navy/40" aria-hidden="true" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or email…"
            className="font-semibold w-full rounded-md border border-stone bg-white pl-9 pr-3 py-2 text-xs text-navy outline-none focus:border-teal placeholder:text-navy/30 placeholder:font-normal"
          />
        </div>
        <div className="flex gap-1">
          {ROLE_FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setRoleFilter(f.id)}
              className={roleFilter === f.id ? 'px-3 py-1.5 text-xs font-bold rounded-md bg-teal/15 text-teal border border-teal/30 cursor-pointer shadow-2xs' : 'px-3 py-1.5 text-xs font-semibold rounded-md text-navy/65 hover:bg-ice hover:text-navy cursor-pointer'}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-stone rounded-md p-8 text-center text-xs text-navy/45 italic font-semibold">
          No accounts match your search.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((user) => {
            const isSelf = user.id === currentUserId
            const currentRole = userRoles[user.id] || 'donor'
            const currentCountries = userCountries[user.id] || []
            const currentSaveState = saveStatus[user.id] || 'idle'
            const isWorking = processingId === user.id

            return (
              <div key={user.id} className="bg-white border border-stone rounded-md p-5 shadow-sm hover:border-teal/60 transition-all flex flex-col gap-4">
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold tracking-tight leading-tight text-navy truncate">
                        {user.full_name || 'Unnamed account'}
                      </h3>
                      {isSelf && <span className="text-[10px] text-navy/45 font-bold bg-ice border border-stone px-2 py-0.5 rounded-md">(you)</span>}
                    </div>
                    <p className="font-mono mt-0.5 truncate text-xs text-teal">{user.email}</p>
                  </div>

                  <div className="shrink-0">
                    <select
                      disabled={isSelf || isWorking}
                      value={currentRole}
                      onChange={(e) => handleRoleChange(user.id, e.target.value)}
                      className="bg-ice border border-stone rounded-md px-3 py-1.5 text-xs text-navy outline-none font-bold disabled:opacity-50 cursor-pointer focus:border-teal"
                    >
                      <option value="staff">Regional Staff</option>
                      <option value="admin">System Administrator</option>
                      <option value="donor">Donor</option>
                    </select>
                  </div>
                </div>

                {currentRole === 'staff' && (
                  <div className="bg-ice/50 rounded-md p-3.5 border border-stone space-y-2.5 animate-fade-in">
                    <span className="block text-[10px] font-medium uppercase tracking-[0.13em] text-navy/55">
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
                            className={`px-2.5 py-1 text-xs rounded-md border transition-all cursor-pointer ${
                              isChecked 
                                ? "border-teal/50 bg-teal/10 text-teal font-bold" 
                                : "border-stone bg-white text-navy/65 font-semibold hover:bg-ice hover:text-navy"
                            }`}
                          >
                            {country} {isChecked ? '✓' : ''}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between border-t border-stone pt-3.5">
                  <button
                    onClick={() => {
                      setDialogError(null)
                      setConfirmUser(user)
                    }}
                    disabled={isSelf || isWorking}
                    className="inline-flex items-center gap-1.5 text-rose-700 hover:text-rose-900 font-bold text-xs px-2.5 py-1 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0 cursor-pointer"
                  >
                    <Trash2Icon className="size-3.5" aria-hidden="true" />
                    Delete
                  </button>

                  <button
                    disabled={isWorking || currentSaveState === 'saving' || isSelf}
                    onClick={() => handleSaveChanges(user.id)}
                    className={`text-xs font-bold px-4 py-2 rounded-md transition-all cursor-pointer shadow-2xs ${
                      currentSaveState === 'saved'
                        ? "bg-teal/15 border border-teal/40 text-teal animate-pulse"
                        : isSelf 
                          ? "bg-ice text-navy/40 border border-stone cursor-not-allowed"
                          : "bg-teal text-white hover:bg-teal/90 disabled:bg-stone disabled:text-navy/50"
                    }`}
                  >
                    {currentSaveState === 'saving' ? 'Saving...' : currentSaveState === 'saved' ? 'Changes Saved ✓' : 'Save Changes'}
                  </button>
                </div>

              </div>
            )
          })}
        </div>
      )}

      <p className="text-[11px] text-navy/55 px-1 pt-1 font-semibold">
        Showing {filtered.length} of {users.length} account{users.length === 1 ? '' : 's'}. Deleting is blocked for accounts linked to sponsorships or registered children.
      </p>

      <Dialog open={confirmUser !== null} onOpenChange={(open) => { if (!open) closeDialog() }}>
        <DialogContent showCloseButton={!busy} className="sm:max-w-md border border-stone rounded-md google-sans-registry">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-rose-50/50 border border-rose-200 text-rose-700">
                <TriangleAlertIcon className="size-5" aria-hidden="true" />
              </span>
              <DialogTitle className="text-lg font-bold tracking-tight text-navy">Delete this account?</DialogTitle>
            </div>
            <DialogDescription className="pt-2 text-xs font-medium text-navy/70">
              This permanently deletes <span className="font-bold text-navy">{confirmUser?.full_name || confirmUser?.email}</span>
              {confirmUser?.full_name ? (<> (<span className="font-mono text-teal font-normal">{confirmUser.email}</span>)</>) : null} and their login. This action <span className="font-bold text-rose-700">cannot be undone</span>.
            </DialogDescription>
          </DialogHeader>

          {dialogError && <div className="p-3 bg-rose-50/50 border border-rose-200 text-xs text-rose-700 rounded-md font-bold">⚠️ {dialogError}</div>}

          <DialogFooter>
            <DialogClose disabled={busy} className="px-4 py-2 text-xs font-bold rounded-md bg-ice border border-stone text-navy/75 cursor-pointer hover:bg-stone/50 disabled:opacity-50">Cancel</DialogClose>
            <button onClick={handleConfirmDelete} disabled={busy} className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold rounded-md bg-rose-700 text-white cursor-pointer hover:bg-rose-800 disabled:opacity-50 shadow-2xs">
              <Trash2Icon className="size-3.5" aria-hidden="true" /> {busy ? 'Deleting…' : 'Delete account'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}