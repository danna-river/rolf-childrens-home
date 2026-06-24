'use client'

import { useState } from 'react'
import { updateProfileName } from '../actions/actions'

interface ProfileViewProps {
  initialName?: string
  email?: string
}

export function ProfileView({ initialName = '', email = '' }: ProfileViewProps) {
  const [name, setName] = useState(initialName)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    const result = await updateProfileName(name)
    setLoading(false)

    if (result.success) {
      setMessage({ type: 'success', text: 'Display name updated successfully.' })
    } else {
      setMessage({ type: 'error', text: result.error || 'Failed to update name.' })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="google-sans-registry p-5 sm:p-6 bg-white rounded-md border border-stone space-y-4 max-w-md shadow-sm">
      <div className="border-b border-stone pb-3">
        <h3 className="text-base font-bold tracking-tight text-navy sm:text-lg">Account Information</h3>
        <p className="text-xs font-medium text-navy/55 mt-0.5">Update your general identity parameters.</p>
      </div>

      <div className="space-y-1.5">
        <label className="block text-[11px] font-medium uppercase tracking-[0.13em] text-navy/45">Email Address</label>
        <input 
          type="text" 
          disabled 
          value={email} 
          className="font-mono w-full text-xs px-3 py-2 bg-ice/60 border border-stone rounded-md text-navy/50 cursor-not-allowed outline-none" 
        />
      </div>

      <div className="space-y-1.5">
        <label className="block text-[11px] font-medium uppercase tracking-[0.13em] text-navy/45">Full Name</label>
        <input 
          type="text" 
          value={name} 
          onChange={(e) => setName(e.target.value)} 
          className="font-semibold w-full text-xs px-3 py-2 bg-white border border-stone rounded-md text-navy placeholder:text-navy/30 placeholder:font-normal focus:border-teal focus:outline-none transition-colors"
          placeholder="Enter your full name"
          required
        />
      </div>

      {message && (
        <p className={`text-xs font-semibold ${message.type === 'success' ? 'text-teal' : 'text-rose-700'}`}>
          {message.text}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || name.trim() === initialName.trim()}
        className="w-full py-2.5 bg-teal hover:bg-teal/90 text-white font-bold rounded-md text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
      >
        {loading ? 'Saving Changes...' : 'Update Name'}
      </button>
    </form>
  )
}