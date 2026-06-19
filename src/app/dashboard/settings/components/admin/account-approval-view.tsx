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
      <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center text-sm text-gray-600">
        ✨ No accounts are currently awaiting system authorization.
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
    <div className="space-y-4">
      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-100 text-sm text-red-600 rounded-xl">
          ⚠️ Action Interrupted: {errorMsg}
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
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-600 block">
                Assign Regional Jurisdictions (Optional)
              </span>
              <div className="flex flex-wrap gap-2">
                {availableCountries.map((country) => {
                  const isChecked = currentCountries.includes(country)
                  let checkClass = "px-2.5 py-1 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-600 cursor-pointer transition-all"
                  if (isChecked) checkClass = "px-2.5 py-1 text-sm font-medium rounded-lg border border-blue-500 bg-blue-50 text-blue-600 cursor-pointer transition-all"
                  
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
              <span className="text-[11px] font-medium text-amber-600 mr-1">Apply authorization changes?</span>
              <button onClick={() => handleApproveExecute(user.id)} disabled={isWorking} className="bg-emerald-600 text-white font-semibold text-sm px-3 py-1.5 rounded-lg cursor-pointer">
                Confirm Approval
              </button>
              <button onClick={() => setConfirmState({ ...confirmState, [user.id]: 'idle' })} className="bg-gray-100 text-gray-700 text-sm px-3 py-1.5 rounded-lg cursor-pointer">
                Cancel
              </button>
            </div>
          )
        } else if (currentStage === 'deny-prompt') {
          actionButtonsPanel = (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-red-600 mr-1">Permanently delete this user?</span>
              <button onClick={() => handleDenyExecute(user.id)} disabled={isWorking} className="bg-red-600 text-white font-semibold text-sm px-3 py-1.5 rounded-lg cursor-pointer">
                Confirm Deletion
              </button>
              <button onClick={() => setConfirmState({ ...confirmState, [user.id]: 'idle' })} className="bg-gray-100 text-gray-700 text-sm px-3 py-1.5 rounded-lg cursor-pointer">
                Cancel
              </button>
            </div>
          )
        } else {
          actionButtonsPanel = (
            <div className="flex items-center gap-2">
              <button onClick={() => setConfirmState({ ...confirmState, [user.id]: 'approve-prompt' })} disabled={isWorking} className="bg-emerald-50 text-emerald-700 font-semibold text-sm px-3 py-1.5 rounded-lg cursor-pointer">
                Approve
              </button>
              <button onClick={() => setConfirmState({ ...confirmState, [user.id]: 'deny-prompt' })} disabled={isWorking} className="bg-red-50 text-red-700 font-semibold text-sm px-3 py-1.5 rounded-lg cursor-pointer">
                Deny & Delete
              </button>
            </div>
          )
        }

        return (
          <div key={user.id} className="bg-white border border-gray-100 rounded-2xl p-5 space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-gray-900">{user.full_name}</h3>
                <p className="text-sm text-gray-600 font-mono mt-0.5">{user.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={currentRole}
                  onChange={(e) => setSelectedRoles({ ...selectedRoles, [user.id]: e.target.value })}
                  className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-1.5 text-sm text-gray-700 outline-none font-medium"
                >
                  <option value="staff">Regional Staff</option>
                  <option value="admin">System Administrator</option>
                  <option value="donor">Donor</option>
                </select>
              </div>
            </div>
            {staffOptionPanel}
            <div className="flex justify-end border-t border-gray-50 pt-3">{actionButtonsPanel}</div>
          </div>
        )
      })}
    </div>
  )
}