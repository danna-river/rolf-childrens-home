"use client"

import { useState } from 'react'
import { appendNewCountryAction, removeCountryAction } from '@/app/dashboard/settings/actions/admin-actions'

interface GlobalConfigsViewProps {
  currentCountries: string[]
}

export function GlobalConfigsView({ currentCountries }: GlobalConfigsViewProps) {
  const [countries, setCountries] = useState<string[]>(currentCountries)
  const [inputVal, setInputVal] = useState('')
  const [isoCodeVal, setIsoCodeVal] = useState('') // 🌟 1. Added ISO state hook
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [showAddConfirm, setShowAddConfirm] = useState(false)
  const [pendingDeleteCountry, setPendingDeleteCountry] = useState<string | null>(null)

  const handleAddSubmitAttempt = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (inputVal.trim().length === 0 || isoCodeVal.trim().length === 0) return
    setErrorMsg(null)
    setShowAddConfirm(true)
  }

  const handleExecuteAppend = async () => {
    setLoading(true)
    setShowAddConfirm(false)

    // 🌟 2. Pass structured object payload parameters out to action channel
    const res = await appendNewCountryAction({
      name: inputVal,
      isoCode: isoCodeVal
    })

    if (res.error) {
      setErrorMsg(res.error)
      setLoading(false)
    } else {
      setCountries([...countries, inputVal.trim()])
      setInputVal('')
      setIsoCodeVal('') // 🌟 3. Reset input field strings completely
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
      <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 flex items-center justify-between gap-4 animate-fade-in">
        <p className="text-sm text-amber-800 font-medium">
          Add <span className="font-bold">"{inputVal.trim()}"</span> with code <span className="font-bold font-mono text-[11px] bg-amber-100/60 px-1 rounded-sm">{isoCodeVal.trim().toUpperCase()}</span> to system registry configurations?
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <button type="button" onClick={handleExecuteAppend} className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-sm px-3 py-1.5 rounded-lg cursor-pointer transition-all">
            Yes, Save Configuration
          </button>
          <button type="button" onClick={() => setShowAddConfirm(false)} className="bg-white text-gray-700 border border-gray-200 text-sm px-3 py-1.5 rounded-lg cursor-pointer hover:border-gray-300">
            Cancel
          </button>
        </div>
      </div>
    )
  } else if (pendingDeleteCountry) {
    subActionArea = (
      <div className="bg-red-50 border border-red-100 rounded-xl p-3 flex items-center justify-between gap-4 animate-fade-in">
        <p className="text-sm text-red-800 font-medium">
          Are you sure you want to remove <span className="font-bold">"{pendingDeleteCountry}"</span>? You should check to see that no children or staff have this country assigned to them.
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <button type="button" onClick={() => handleExecuteDelete(pendingDeleteCountry)} className="bg-red-600 hover:bg-red-700 text-white font-semibold text-sm px-3 py-1.5 rounded-lg cursor-pointer transition-all">
            Confirm Delete
          </button>
          <button type="button" onClick={() => setPendingDeleteCountry(null)} className="bg-white text-gray-700 border border-gray-200 text-sm px-3 py-1.5 rounded-lg cursor-pointer hover:border-gray-300">
            Cancel
          </button>
        </div>
      </div>
    )
  } else {
    subActionArea = (
      // 🌟 4. Converted form into a responsive row structure with matching inputs layout
      <form onSubmit={handleAddSubmitAttempt} className="flex flex-col sm:flex-row gap-2 max-w-xl">
        <input
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          placeholder="Country name (e.g. Benin)"
          disabled={loading}
          required
          className="flex-1 px-3 py-2 text-sm bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
        />
        <input
          type="text"
          value={isoCodeVal}
          onChange={(e) => setIsoCodeVal(e.target.value)}
          placeholder="ISO Code (e.g. BEN)"
          maxLength={3} // 🌟 Changed from 4 to 3 to block extra typing right in the browser!
          disabled={loading}
          required
          className="w-full sm:w-32 px-3 py-2 text-sm font-mono uppercase bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
        />
        <button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm px-4 py-2 rounded-xl transition-all cursor-pointer shrink-0">
          {loading ? 'Processing...' : 'Add Country'}
        </button>
      </form>
    )
  }

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-6 shadow-xs">
      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-100 text-sm text-red-600 rounded-xl leading-relaxed">
          ⚠️ Action Interrupted: {errorMsg}
        </div>
      )}

      {/* Active Parameters List */}
      <div className="space-y-2">
        <span className="text-xs font-bold uppercase tracking-wider text-gray-600 block">
          Active Countries
        </span>
        <div className="flex flex-wrap gap-2">
          {countries.map((country) => (
            <div
              key={country}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-50 border border-gray-100 text-gray-600 font-medium text-sm rounded-xl shadow-2xs"
            >
              <span>🌍 {country}</span>
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  setErrorMsg(null)
                  setPendingDeleteCountry(country)
                }}
                className="w-3.5 h-3.5 ml-0.5 rounded-full inline-flex items-center justify-center text-[9px] font-bold text-gray-600 hover:bg-red-50 hover:text-red-600 transition-all cursor-pointer outline-none"
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
        <span className="text-xs font-bold uppercase tracking-wider text-gray-600 block">
          Add a New Country
        </span>
        {subActionArea}
      </div>
    </div>
  )
}