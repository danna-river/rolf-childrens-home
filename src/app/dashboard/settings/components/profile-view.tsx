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
    <form onSubmit={handleSubmit} className="p-6 bg-white rounded-2xl border border-gray-100 space-y-4 max-w-md shadow-2xs">
      <div>
        <h3 className="text-sm font-bold text-gray-800 mb-1">Account Information</h3>
        <p className="text-xs text-gray-400 mb-4">Update your general identity parameters.</p>
      </div>

      <div className="space-y-1">
        <label className="text-[11px] font-bold text-gray-400 uppercase">Email Address</label>
        <input 
          type="text" 
          disabled 
          value={email} 
          className="w-full text-xs p-2.5 bg-gray-50 border border-gray-100 rounded-lg text-gray-400 cursor-not-allowed outline-none" 
        />
      </div>

      <div className="space-y-1">
        <label className="text-[11px] font-bold text-gray-500 uppercase">Full Name</label>
        <input 
          type="text" 
          value={name} 
          onChange={(e) => setName(e.target.value)} 
          className="w-full text-xs p-2.5 border border-gray-200 rounded-lg text-gray-800 focus:border-blue-500 focus:outline-none transition-colors"
          placeholder="Enter your full name"
          required
        />
      </div>

      {message && (
        <p className={`text-xs font-medium ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
          {message.text}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || name.trim() === initialName.trim()}
        className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
      >
        {loading ? 'Saving Changes...' : 'Update Name'}
      </button>
    </form>
  )
}