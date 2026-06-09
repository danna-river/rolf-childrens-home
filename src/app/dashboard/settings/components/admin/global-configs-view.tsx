"use client"

import { useState } from 'react'
import { appendNewCountryAction, removeCountryAction } from '@/app/dashboard/settings/actions/admin-actions'

interface GlobalConfigsViewProps {
  currentCountries: string[]
}

export function GlobalConfigsView({ currentCountries }: GlobalConfigsViewProps) {
  const [countries, setCountries] = useState<string[]>(currentCountries)
  const [inputVal, setInputVal] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  
  const [showAddConfirm, setShowAddConfirm] = useState(false)
  const [pendingDeleteCountry, setPendingDeleteCountry] = useState<string | null>(null)

  const handleAddSubmitAttempt = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (inputVal.trim().length === 0) return
    setErrorMsg(null)
    setShowAddConfirm(true)
  }

  const handleExecuteAppend = async () => {
    setLoading(true)
    setShowAddConfirm(false)
    const res = await appendNewCountryAction(inputVal)
    
    if (res.error) {
      setErrorMsg(res.error)
      setLoading(false)
    } else {
      setCountries([...countries, inputVal.trim()])
      setInputVal('')
      setLoading(false)
    }
  }

  const handleExecuteDelete = async (targetCountry: string) => {
    setLoading(true)
    setErrorMsg(null)
    setPendingDeleteCountry(null)

    const res = await removeCountryAction(targetCountry)

    if (res.error) {
      setErrorMsg(res.error)
      setLoading(false)
    } else {
      setCountries(countries.filter(item => item !== targetCountry))
      setLoading(false)
    }
  }

  let subActionArea
  if (showAddConfirm) {
    subActionArea = (
      <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 flex items-center justify-between gap-4">
        <p className="text-xs text-amber-800 font-medium">
          Add <span className="font-bold">"{inputVal.trim()}"</span> to the country list?
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <button type="button" onClick={handleExecuteAppend} className="bg-amber-600 text-white font-semibold text-xs px-3 py-1.5 rounded-lg cursor-pointer">
            Yes, Save Configuration
          </button>
          <button type="button" onClick={() => setShowAddConfirm(false)} className="bg-white text-gray-500 border border-gray-200 text-xs px-3 py-1.5 rounded-lg cursor-pointer">
            Cancel
          </button>
        </div>
      </div>
    )
  } else if (pendingDeleteCountry) {
    subActionArea = (
      <div className="bg-red-50 border border-red-100 rounded-xl p-3 flex items-center justify-between gap-4">
        <p className="text-xs text-red-800 font-medium">
          Are you sure you want to remove <span className="font-bold">"{pendingDeleteCountry}"</span>? You should check to see that no children or staff have this country assigned to them.
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <button type="button" onClick={() => handleExecuteDelete(pendingDeleteCountry)} className="bg-red-600 text-white font-semibold text-xs px-3 py-1.5 rounded-lg cursor-pointer">
            Confirm Delete
          </button>
          <button type="button" onClick={() => setPendingDeleteCountry(null)} className="bg-white text-gray-500 border border-gray-200 text-xs px-3 py-1.5 rounded-lg cursor-pointer">
            Cancel
          </button>
        </div>
      </div>
    )
  } else {
    subActionArea = (
      <form onSubmit={handleAddSubmitAttempt} className="flex gap-2 max-w-md">
        <input
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          placeholder="e.g. Ethiopia"
          disabled={loading}
          required
          className="flex-1 px-3 py-2 text-xs bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
        />
        <button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-4 py-2 rounded-xl transition-all cursor-pointer">
          {loading ? 'Processing...' : 'Add Country'}
        </button>
      </form>
    )
  }

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-6 shadow-xs">
      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-100 text-xs text-red-600 rounded-xl leading-relaxed">
          ⚠️ Action Interrupted: {errorMsg}
        </div>
      )}

      {/* Active Parameters List */}
      <div className="space-y-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
          Active Countries
        </span>
        <div className="flex flex-wrap gap-2">
          {countries.map((country) => (
            <div 
              key={country} 
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-50 border border-gray-100 text-gray-600 font-medium text-xs rounded-xl shadow-2xs"
            >
              <span>🌍 {country}</span>
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  setErrorMsg(null)
                  setPendingDeleteCountry(country)
                }}
                className="w-3.5 h-3.5 ml-0.5 rounded-full inline-flex items-center justify-center text-[9px] font-bold text-gray-400 hover:bg-red-50 hover:text-red-600 transition-all cursor-pointer outline-none"
                title={`Remove ${country}`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Form Action Section */}
      <div className="space-y-2 border-t border-gray-50 pt-4">
        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
          Add a New Country
        </span>
        {subActionArea}
      </div>
    </div>
  )
}