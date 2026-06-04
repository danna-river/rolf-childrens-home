"use client"

import { useState } from 'react'
import { signUpAction, verifyOtpAction } from '@/app/login/actions'

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
        } else if (result?.success && result.email) {
            setSavedEmail(result.email)
            setPendingVerification(true)
            setLoading(false)
        }
    }

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
                    <div className="p-3 bg-red-50 border border-red-100 text-xs text-red-600 rounded-xl">
                        ⚠️ {errorMsg}
                    </div>
                )}

                <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                        Verification Code
                    </label>
                    <input
                        name="otpToken"
                        type="text"
                        required
                        maxLength={6}
                        pattern="\d{6}"
                        placeholder="123456"
                        className="w-full px-3 py-2 text-center font-mono text-base tracking-widest bg-gray-50 border border-gray-100 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    />
                    <p className="text-[10px] text-gray-400 pt-0.5">
                        We sent a 6-digit confirmation code to <span className="font-medium text-gray-600">{savedEmail}</span>.
                    </p>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold text-xs py-2.5 rounded-xl shadow-xs transition-all active:scale-98 cursor-pointer"
                >
                    {loading ? 'Verifying Code...' : 'Confirm Account'}
                </button>

                <div className="text-center pt-1">
                    <button
                        type="button"
                        onClick={() => setPendingVerification(false)}
                        className="text-xs text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                    >
                        ← Back to registration
                    </button>
                </div>
            </form>
        )
    }

    // PHASE 1 VIEW: Core User Details Registration
    return (
        <form onSubmit={handleSignUpSubmit} className="space-y-4">
            {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-100 text-xs text-red-600 rounded-xl">
                    ⚠️ {errorMsg}
                </div>
            )}

            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                        First Name
                    </label>
                    <input
                        name="firstName"
                        type="text"
                        required
                        placeholder="Margaret"
                        className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-100 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                        Last Name
                    </label>
                    <input
                        name="lastName"
                        type="text"
                        required
                        placeholder="Thompson"
                        className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-100 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    />
                </div>
            </div>

            <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Email Address
                </label>
                <input
                    name="email"
                    type="email"
                    required
                    placeholder="example@email.com"
                    className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-100 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
            </div>

            <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Password
                </label>
                <input
                    name="password"
                    type="password"
                    required
                    minLength={6}
                    placeholder="••••••••••••••••"
                    className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-100 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
            </div>

            <button
                type="submit"
                disabled={loading}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-semibold text-xs py-2.5 rounded-xl shadow-xs transition-all active:scale-98 cursor-pointer"
            >
                {loading ? 'Sending Code...' : 'Register'}
            </button>

            <div className="text-center pt-2">
                <button
                    type="button"
                    onClick={onSwitchToLogin}
                    className="text-xs text-gray-400 hover:text-blue-600 transition-colors cursor-pointer"
                >
                    Already have an account? Sign In
                </button>
            </div>
        </form>
    )
}