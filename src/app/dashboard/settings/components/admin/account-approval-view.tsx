"use client"

import { useState } from 'react'
import { approveAccountAction, denyAccountAction } from '@/app/dashboard/settings/actions/admin-actions'
import { type Profile } from '@/lib/types'

interface AccountApprovalViewProps {
  initialUsers: Profile[]
  availableCountries: string[]
}

export function AccountApprovalView({ initialUsers, availableCountries }: AccountApprovalViewProps) {
  const [users, setUsers] = useState<Profile[]>(initialUsers)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [selectedRoles, setSelectedRoles] = useState<Record<string, string>>({})
  const [selectedCountries, setSelectedCountries] = useState<Record<string, string[]>>({})
  const [confirmState, setConfirmState] = useState<Record<string, 'idle' | 'approve-prompt' | 'deny-prompt'>>({})

  if (users.length === 0) {
    return (
      <div className="google-sans-registry bg-white border border-stone rounded-md p-8 text-center text-xs text-navy/45 italic font-semibold shadow-sm">
        No accounts are currently awaiting system authorization.
      </div>
    )
  }

  const toggleCountrySelection = (userId: string, country: string) => {
    const currentList = selectedCountries[userId] || []
    let updatedList = [...currentList, country]
    if (currentList.includes(country)) {
      updatedList = currentList.filter(item => item !== country)
    }
    setSelectedCountries({ ...selectedCountries, [userId]: updatedList })
  }

  const handleApproveExecute = async (userId: string) => {
    setErrorMsg(null)
    setProcessingId(userId)
    const res = await approveAccountAction(userId, selectedRoles[userId] || 'staff', selectedCountries[userId] || [])
    if (res.error) {
      setErrorMsg(res.error)
      setProcessingId(null)
    } else {
      setUsers(users.filter(u => u.id !== userId))
      setProcessingId(null)
    }
  }

  const handleDenyExecute = async (userId: string) => {
    setErrorMsg(null)
    setProcessingId(userId)
    const res = await denyAccountAction(userId)
    if (res.error) {
      setErrorMsg(res.error)
      setProcessingId(null)
    } else {
      setUsers(users.filter(u => u.id !== userId))
      setProcessingId(null)
    }
  }

  return (
    <div className="google-sans-registry space-y-3">
      {errorMsg && (
        <div className="p-3 bg-rose-50/50 border border-rose-200 text-xs text-rose-700 rounded-md font-bold">
          Action Interrupted: {errorMsg}
        </div>
      )}

      {users.map((user) => {
        const currentRole = selectedRoles[user.id] || 'staff'
        const currentCountries = selectedCountries[user.id] || []
        const currentStage = confirmState[user.id] || 'idle'
        const isWorking = processingId === user.id

        let staffOptionPanel = null
        if (currentRole === 'staff') {
          staffOptionPanel = (
            <div className="bg-ice/50 rounded-md p-3.5 border border-stone space-y-2.5">
              <span className="block text-[10px] font-medium uppercase tracking-[0.13em] text-navy/55">
                Assign Regional Jurisdictions (Optional)
              </span>
              <div className="flex flex-wrap gap-1.5">
                {availableCountries.map((country) => {
                  const isChecked = currentCountries.includes(country)
                  let checkClass = "px-2.5 py-1 text-xs font-semibold rounded-md border border-stone bg-white text-navy/65 cursor-pointer transition-all"
                  if (isChecked) checkClass = "px-2.5 py-1 text-xs font-bold rounded-md border border-teal/50 bg-teal/10 text-teal cursor-pointer transition-all"
                  
                  return (
                    <button type="button" key={country} onClick={() => toggleCountrySelection(user.id, country)} className={checkClass}>
                      {country} {isChecked ? '✓' : ''}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        }

        let actionButtonsPanel
        if (currentStage === 'approve-prompt') {
          actionButtonsPanel = (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-amber-700 mr-1">Apply authorization changes?</span>
              <button onClick={() => handleApproveExecute(user.id)} disabled={isWorking} className="bg-teal hover:bg-teal/90 text-white font-bold text-xs px-3.5 py-1.5 rounded-md cursor-pointer shadow-2xs">
                Confirm Approval
              </button>
              <button onClick={() => setConfirmState({ ...confirmState, [user.id]: 'idle' })} className="bg-ice border border-stone text-navy/70 font-semibold text-xs px-3 py-1.5 rounded-md cursor-pointer hover:bg-stone/50">
                Cancel
              </button>
            </div>
          )
        } else if (currentStage === 'deny-prompt') {
          actionButtonsPanel = (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-rose-700 mr-1">Permanently delete this user?</span>
              <button onClick={() => handleDenyExecute(user.id)} disabled={isWorking} className="bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs px-3.5 py-1.5 rounded-md cursor-pointer shadow-2xs">
                Confirm Deletion
              </button>
              <button onClick={() => setConfirmState({ ...confirmState, [user.id]: 'idle' })} className="bg-ice border border-stone text-navy/70 font-semibold text-xs px-3 py-1.5 rounded-md cursor-pointer hover:bg-stone/50">
                Cancel
              </button>
            </div>
          )
        } else {
          actionButtonsPanel = (
            <div className="flex items-center gap-2">
              <button onClick={() => setConfirmState({ ...confirmState, [user.id]: 'approve-prompt' })} disabled={isWorking} className="bg-teal/15 border border-teal/40 text-teal hover:bg-teal hover:text-white font-bold text-xs px-3.5 py-1.5 rounded-md cursor-pointer transition-all">
                Approve
              </button>
              <button onClick={() => setConfirmState({ ...confirmState, [user.id]: 'deny-prompt' })} disabled={isWorking} className="bg-ice border border-stone text-navy/70 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 font-bold text-xs px-3.5 py-1.5 rounded-md cursor-pointer transition-all">
                Deny & Delete
              </button>
            </div>
          )
        }

        return (
          <div key={user.id} className="bg-white border border-stone rounded-md p-5 space-y-4 shadow-sm hover:border-teal/60 transition-all">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold tracking-tight leading-tight text-navy">{user.full_name}</h3>
                <p className="font-mono mt-0.5 truncate text-xs text-teal">{user.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={currentRole}
                  onChange={(e) => setSelectedRoles({ ...selectedRoles, [user.id]: e.target.value })}
                  className="bg-ice border border-stone rounded-md px-3 py-1.5 text-xs text-navy outline-none font-bold focus:border-teal cursor-pointer"
                >
                  <option value="staff">Regional Staff</option>
                  <option value="admin">System Administrator</option>
                  <option value="donor">Donor</option>
                </select>
              </div>
            </div>
            {staffOptionPanel}
            <div className="flex justify-end border-t border-stone pt-3.5">{actionButtonsPanel}</div>
          </div>
        )
      })}
    </div>
  )
}