"use client"

import { useState } from 'react'
import { Trash2Icon, SearchIcon, TriangleAlertIcon } from 'lucide-react'
import { deleteAccountAction } from '@/app/dashboard/settings/actions/admin-actions'
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
}

const ROLE_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'admin', label: 'Admins' },
  { id: 'staff', label: 'Staff' },
  { id: 'donor', label: 'Donors' },
] as const

function roleMeta(role: string) {
  if (isAdminRole(role)) return { label: 'Administrator', cls: 'bg-blue-50 text-blue-600' }
  if (isStaffRole(role)) return { label: 'Regional Staff', cls: 'bg-emerald-50 text-emerald-600' }
  if (isDonorRole(role)) return { label: 'Donor', cls: 'bg-amber-50 text-amber-600' }
  return { label: role, cls: 'bg-gray-100 text-gray-500' }
}

export function AccountManagementView({ initialUsers, currentUserId }: AccountManagementViewProps) {
  const [users, setUsers] = useState<Profile[]>(initialUsers)
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')

  // The account pending deletion (drives the confirmation modal).
  const [confirmUser, setConfirmUser] = useState<Profile | null>(null)
  const [busy, setBusy] = useState(false)
  const [dialogError, setDialogError] = useState<string | null>(null)

  const closeDialog = () => {
    if (busy) return // don't let the modal close mid-delete
    setConfirmUser(null)
    setDialogError(null)
  }

  const handleConfirmDelete = async () => {
    if (!confirmUser) return
    setBusy(true)
    setDialogError(null)
    const res = await deleteAccountAction(confirmUser.id)
    setBusy(false)
    if (res.error) {
      setDialogError(res.error) // keep the modal open and show why it was blocked
      return
    }
    setUsers((prev) => prev.filter((u) => u.id !== confirmUser.id))
    setConfirmUser(null)
  }

  const q = query.trim().toLowerCase()
  const filtered = users.filter((u) => {
    const matchesRole =
      roleFilter === 'all' ||
      (roleFilter === 'admin' && isAdminRole(u.role)) ||
      (roleFilter === 'staff' && isStaffRole(u.role)) ||
      (roleFilter === 'donor' && isDonorRole(u.role))
    const matchesQuery =
      q === '' ||
      (u.full_name ?? '').toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    return matchesRole && matchesQuery
  })

  return (
    <div className="space-y-4">
      {/* Search + role filter */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1">
          <SearchIcon
            className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400"
            aria-hidden="true"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full rounded-xl border border-gray-100 bg-white pl-9 pr-3 py-2 text-xs text-gray-700 outline-none focus:border-gray-300"
          />
        </div>
        <div className="flex gap-1">
          {ROLE_FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setRoleFilter(f.id)}
              className={
                roleFilter === f.id
                  ? 'px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-50 text-blue-600 cursor-pointer'
                  : 'px-3 py-1.5 text-xs font-medium rounded-lg text-gray-500 hover:bg-gray-100 cursor-pointer'
              }
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center text-xs text-gray-400">
          No accounts match your search.
        </div>
      ) : (
        filtered.map((user) => {
          const meta = roleMeta(user.role)
          const isSelf = user.id === currentUserId

          return (
            <div
              key={user.id}
              className="bg-white border border-gray-100 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-gray-900 truncate">
                    {user.full_name || 'Unnamed account'}
                  </h3>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${meta.cls}`}
                  >
                    {meta.label}
                  </span>
                  {isSelf && <span className="text-[10px] text-gray-400">(you)</span>}
                </div>
                <p className="text-xs text-gray-400 font-mono mt-0.5 truncate">{user.email}</p>
                {user.country && user.country.length > 0 && (
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Regions: {user.country.join(', ')}
                  </p>
                )}
              </div>

              <button
                onClick={() => {
                  setDialogError(null)
                  setConfirmUser(user)
                }}
                disabled={isSelf}
                title={isSelf ? "You can't delete your own account" : 'Delete account'}
                className="inline-flex items-center gap-1.5 bg-red-50 text-red-700 font-semibold text-xs px-3 py-1.5 rounded-lg cursor-pointer hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              >
                <Trash2Icon className="size-3.5" aria-hidden="true" />
                Delete
              </button>
            </div>
          )
        })
      )}

      <p className="text-[11px] text-gray-400 px-1">
        Showing {filtered.length} of {users.length} account{users.length === 1 ? '' : 's'}. Deleting
        is blocked for accounts linked to sponsorships or registered children.
      </p>

      {/* Confirmation modal */}
      <Dialog
        open={confirmUser !== null}
        onOpenChange={(open) => {
          if (!open) closeDialog()
        }}
      >
        <DialogContent showCloseButton={!busy} className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
                <TriangleAlertIcon className="size-5" aria-hidden="true" />
              </span>
              <DialogTitle>Delete this account?</DialogTitle>
            </div>
            <DialogDescription className="pt-2">
              This permanently deletes{' '}
              <span className="font-medium text-foreground">
                {confirmUser?.full_name || confirmUser?.email}
              </span>
              {confirmUser?.full_name ? (
                <>
                  {' '}
                  (<span className="font-mono">{confirmUser.email}</span>)
                </>
              ) : null}{' '}
              and their login. This action <span className="font-semibold">cannot be undone</span>.
            </DialogDescription>
          </DialogHeader>

          {dialogError && (
            <div className="p-3 bg-red-50 border border-red-100 text-xs text-red-600 rounded-xl">
              ⚠️ {dialogError}
            </div>
          )}

          <DialogFooter>
            <DialogClose
              disabled={busy}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-gray-100 text-gray-600 cursor-pointer hover:bg-gray-200 disabled:opacity-50"
            >
              Cancel
            </DialogClose>
            <button
              onClick={handleConfirmDelete}
              disabled={busy}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-red-600 text-white cursor-pointer hover:bg-red-700 disabled:opacity-50"
            >
              <Trash2Icon className="size-3.5" aria-hidden="true" />
              {busy ? 'Deleting…' : 'Delete account'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
