"use client"

import { useState } from 'react'
import { signUpAction } from '@/app/login/actions' // Add verifyOtpAction import when OTP added

interface RegisterFormProps {
  onSwitchToLogin: () => void
}

export function RegisterForm({ onSwitchToLogin }: RegisterFormProps) {
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [pendingVerification, setPendingVerification] = useState(false)
  const [savedEmail, setSavedEmail] = useState('')

  const handleSignUpSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrorMsg(null)
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const result = await signUpAction(formData)

    if (result?.error) {
      setErrorMsg(result.error)
      setLoading(false)
    }
    // Uncomment block once OTP added
    /*
    else if (result?.success && result.email) {
        setSavedEmail(result.email)
        setPendingVerification(true)
        setLoading(false)
    }
    */
  }

  // Uncomment block once OTP added
  /*
  const handleOtpSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
      e.preventDefault()
      setErrorMsg(null)
      setLoading(true)

      const formData = new FormData(e.currentTarget)
      const token = formData.get('otpToken') as string

      const result = await verifyOtpAction(savedEmail, token)

      if (result?.error) {
          setErrorMsg(result.error)
          setLoading(false)
      }
  }

  // 6-Digit OTP Verification
  if (pendingVerification) {
      return (
          <form onSubmit={handleOtpSubmit} className="space-y-4">
              {errorMsg && (
                  <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-xs text-red-600">
                      {errorMsg}
                  </div>
              )}

              <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-navy/45">
                      Verification Code
                  </label>
                  <input
                      name="otpToken"
                      type="text"
                      required
                      maxLength={6}
                      pattern="\d{6}"
                      placeholder="123456"
                      className="w-full rounded-xl border border-stone bg-ice px-3 py-2 text-center font-mono text-base tracking-widest text-navy outline-none transition-all focus:border-teal focus:bg-white focus:ring-2 focus:ring-teal/20"
                  />
                  <p className="pt-0.5 text-[10px] text-navy/40">
                      We sent a 6-digit confirmation code to <span className="font-medium text-navy/60">{savedEmail}</span>.
                  </p>
              </div>

              <button
                  type="submit"
                  disabled={loading}
                  className="w-full cursor-pointer rounded-xl bg-navy py-2.5 text-sm font-semibold text-white transition-colors hover:bg-navy/90 disabled:opacity-50"
              >
                  {loading ? 'Verifying Code…' : 'Confirm Account'}
              </button>

              <div className="pt-1 text-center">
                  <button
                      type="button"
                      onClick={() => setPendingVerification(false)}
                      className="cursor-pointer text-xs font-medium text-navy/40 transition-colors hover:text-teal"
                  >
                      ← Back to registration
                  </button>
              </div>
          </form>
      )
  }
  */

  // PHASE 1 VIEW: Core User Details Registration
  return (
    <form onSubmit={handleSignUpSubmit} className="space-y-4">
      {errorMsg && (
        <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-xs text-red-600">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[11px] font-bold uppercase tracking-widest text-navy/45">
            First Name
          </label>
          <input
            name="firstName"
            type="text"
            required
            placeholder="Margaret"
            className="w-full rounded-xl border border-stone bg-ice px-3 py-2 text-sm text-navy outline-none transition-all placeholder:text-navy/25 focus:border-teal focus:bg-white focus:ring-2 focus:ring-teal/20"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-bold uppercase tracking-widest text-navy/45">
            Last Name
          </label>
          <input
            name="lastName"
            type="text"
            required
            placeholder="Thompson"
            className="w-full rounded-xl border border-stone bg-ice px-3 py-2 text-sm text-navy outline-none transition-all placeholder:text-navy/25 focus:border-teal focus:bg-white focus:ring-2 focus:ring-teal/20"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-[11px] font-bold uppercase tracking-widest text-navy/45">
          Email Address
        </label>
        <input
          name="email"
          type="email"
          required
          placeholder="example@email.com"
          className="w-full rounded-xl border border-stone bg-ice px-3 py-2 text-sm text-navy outline-none transition-all placeholder:text-navy/25 focus:border-teal focus:bg-white focus:ring-2 focus:ring-teal/20"
        />
      </div>

      <div className="space-y-1">
        <label className="text-[11px] font-bold uppercase tracking-widest text-navy/45">
          Password
        </label>
        <input
          name="password"
          type="password"
          required
          minLength={6}
          placeholder="••••••••••••••••"
          className="w-full rounded-xl border border-stone bg-ice px-3 py-2 text-sm text-navy outline-none transition-all placeholder:text-navy/25 focus:border-teal focus:bg-white focus:ring-2 focus:ring-teal/20"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full cursor-pointer rounded-xl bg-navy py-2.5 text-sm font-semibold text-white transition-colors hover:bg-navy/90 disabled:opacity-50"
      >
        {loading ? 'Registering…' : 'Create Account'}
      </button>

      <div className="pt-1 text-center">
        <button
          type="button"
          onClick={onSwitchToLogin}
          className="cursor-pointer text-xs font-medium text-navy/40 transition-colors hover:text-teal"
        >
          Already have an account? Sign In
        </button>
      </div>
    </form>
  )
}
