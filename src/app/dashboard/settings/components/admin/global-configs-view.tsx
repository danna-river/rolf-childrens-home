"use client"

import { useState } from 'react'
import { appendNewCountryAction, removeCountryAction } from '@/app/dashboard/settings/actions/admin-actions'

interface GlobalConfigsViewProps {
  currentCountries: string[]
}

export function GlobalConfigsView({ currentCountries }: GlobalConfigsViewProps) {
  const [countries, setCountries] = useState<string[]>(currentCountries)
  const [inputVal, setInputVal] = useState('')
  const [isoCodeVal, setIsoCodeVal] = useState('')
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
      setIsoCodeVal('')
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
      <div className="bg-amber-50/50 border border-amber-200 rounded-md p-3.5 flex items-center justify-between gap-4 animate-fade-in">
        <p className="text-xs text-navy/85 font-semibold">
          Add <span className="font-bold text-navy">&quot;{inputVal.trim()}&quot;</span> with code <span className="font-mono font-bold text-[11px] text-teal bg-teal/10 px-1.5 py-0.5 rounded-sm">{isoCodeVal.trim().toUpperCase()}</span> to system registry configurations?
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <button type="button" onClick={handleExecuteAppend} className="bg-teal hover:bg-teal/90 text-white font-bold text-xs px-3 py-1.5 rounded-md cursor-pointer transition-all">
            Yes, Save Configuration
          </button>
          <button type="button" onClick={() => setShowAddConfirm(false)} className="font-semibold bg-white text-navy/65 border border-stone text-xs px-3 py-1.5 rounded-md cursor-pointer hover:bg-ice">
            Cancel
          </button>
        </div>
      </div>
    )
  } else if (pendingDeleteCountry) {
    subActionArea = (
      <div className="bg-rose-50/40 border border-rose-200 rounded-md p-3.5 flex items-center justify-between gap-4 animate-fade-in">
        <p className="text-xs text-rose-950 font-semibold">
          Are you sure you want to remove <span className="font-bold">&quot;{pendingDeleteCountry}&quot;</span>? You should check to see that no children or staff have this country assigned to them.
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <button type="button" onClick={() => handleExecuteDelete(pendingDeleteCountry)} className="bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs px-3 py-1.5 rounded-md cursor-pointer transition-all">
            Confirm Delete
          </button>
          <button type="button" onClick={() => setPendingDeleteCountry(null)} className="font-semibold bg-white text-navy/65 border border-stone text-xs px-3 py-1.5 rounded-md cursor-pointer hover:bg-ice">
            Cancel
          </button>
        </div>
      </div>
    )
  } else {
    subActionArea = (
      <form onSubmit={handleAddSubmitAttempt} className="flex flex-col sm:flex-row gap-2.5 max-w-xl">
        <input
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          placeholder="Country name (e.g. Benin)"
          disabled={loading}
          required
          className="font-semibold flex-1 px-3 py-2 text-xs bg-white border border-stone rounded-md text-navy placeholder:text-navy/30 placeholder:font-normal outline-none focus:border-teal transition-all"
        />
        <input
          type="text"
          value={isoCodeVal}
          onChange={(e) => setIsoCodeVal(e.target.value)}
          placeholder="ISO Code (XXX)"
          maxLength={3}
          disabled={loading}
          required
          className="font-mono uppercase w-full sm:w-32 px-3 py-2 text-xs font-bold bg-white border border-stone rounded-md text-navy placeholder:text-navy/30 placeholder:font-normal outline-none focus:border-teal transition-all"
        />
        <button type="submit" disabled={loading} className="bg-teal hover:bg-teal/90 text-white font-bold text-xs px-4 py-2 rounded-md transition-all cursor-pointer shrink-0 shadow-2xs">
          {loading ? 'Processing...' : 'Add Country'}
        </button>
      </form>
    )
  }

  return (
    <div className="google-sans-registry bg-white border border-stone rounded-md p-5 sm:p-6 space-y-6 shadow-sm">
      {errorMsg && (
        <div className="p-3 bg-rose-50/50 border border-rose-200 text-xs text-rose-700 rounded-md leading-relaxed font-bold">
          Action Interrupted: {errorMsg}
        </div>
      )}

      <div className="space-y-2.5">
        <span className="block text-[11px] font-medium uppercase tracking-[0.13em] text-navy/45 border-b border-stone pb-2">
          Active Countries
        </span>
        <div className="flex flex-wrap gap-2 pt-1">
          {countries.map((country) => (
            <div
              key={country}
              className="inline-flex items-center gap-2 px-3 py-1 bg-ice border border-stone text-navy font-bold text-xs rounded-md shadow-2xs"
            >
              <span>{country}</span>
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  setErrorMsg(null)
                  setPendingDeleteCountry(country)
                }}
                className="w-4 h-4 rounded-full inline-flex items-center justify-center text-[10px] font-bold text-navy/40 hover:bg-rose-100 hover:text-rose-700 transition-all cursor-pointer outline-none"
                title={`Remove ${country}`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2.5 border-t border-stone pt-4">
        <span className="block text-[11px] font-medium uppercase tracking-[0.13em] text-navy/45">
          Add a New Country
        </span>
        {subActionArea}
      </div>
    </div>
  )
}