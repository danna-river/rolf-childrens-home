'use client'

import { useState } from 'react'
import { updateAccountPassword } from '../actions/actions'

export function SecurityView() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)

    if (password !== confirmPassword) {
      return setMessage({ type: 'error', text: 'Passwords do not match.' })
    }

    setLoading(true)
    const result = await updateAccountPassword(password)
    setLoading(false)

    if (result.success) {
      setMessage({ type: 'success', text: 'Password reset completed successfully.' })
      setPassword('')
      setConfirmPassword('')
    } else {
      setMessage({ type: 'error', text: result.error || 'Failed to update password.' })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-6 bg-white rounded-2xl border border-gray-100 space-y-4 max-w-md shadow-2xs">
      <div>
        <h3 className="text-sm font-bold text-gray-800 mb-1">Security Credentials</h3>
        <p className="text-xs text-gray-400 mb-4">Change or refresh your system authentication passwords.</p>
      </div>

      <div className="space-y-1">
        <label className="text-[11px] font-bold text-gray-500 uppercase">New Password</label>
        <input 
          type="password" 
          value={password} 
          onChange={(e) => setPassword(e.target.value)} 
          className="w-full text-xs p-2.5 border border-gray-200 rounded-lg text-gray-800 focus:border-blue-500 focus:outline-none transition-colors"
          placeholder="At least 6 characters"
          required
        />
      </div>

      <div className="space-y-1">
        <label className="text-[11px] font-bold text-gray-500 uppercase">Confirm New Password</label>
        <input 
          type="password" 
          value={confirmPassword} 
          onChange={(e) => setConfirmPassword(e.target.value)} 
          className="w-full text-xs p-2.5 border border-gray-200 rounded-lg text-gray-800 focus:border-blue-500 focus:outline-none transition-colors"
          placeholder="Repeat password"
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
        disabled={loading || !password || !confirmPassword}
        className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
      >
        {loading ? 'Updating Credentials...' : 'Change Password'}
      </button>
    </form>
  )
}