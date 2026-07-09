"use client"

import { useState } from 'react'
import { resendVerificationCodeAction, signUpAction, verifyOtpAction } from '@/app/login/actions'
import type { MessageKey } from '@/i18n/locales/en'
import { useTranslations } from '@/i18n/client'

interface RegisterFormProps {
  onSwitchToLogin: () => void
}

function getResendErrorKey(errorKey: string | undefined) {
  return errorKey === 'login.register.error.emailRequired'
    ? 'login.register.error.emailRequired'
    : 'login.register.resendError'
}

function getSignUpErrorKey(errorKey: string | undefined): MessageKey {
  switch (errorKey) {
    case 'login.register.error.requiredFields':
      return 'login.register.error.requiredFields'
    case 'login.register.error.accountAlreadyExists':
      return 'login.register.error.accountAlreadyExists'
    case 'login.register.error.invalidCode':
      return 'login.register.error.invalidCode'
    default:
      return 'login.register.error.generic'
  }
}

export function RegisterForm({ onSwitchToLogin }: RegisterFormProps) {
  const t = useTranslations()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [infoMsg, setInfoMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [pendingVerification, setPendingVerification] = useState(false)
  const [savedEmail, setSavedEmail] = useState('')
  const [otpToken, setOtpToken] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [registerEmail, setRegisterEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleSignUpSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrorMsg(null)
    setInfoMsg(null)
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const result = await signUpAction(formData)

    if (result && 'errorKey' in result && result.errorKey) {
      setErrorMsg(t(getSignUpErrorKey(result.errorKey)))
      setLoading(false)
    } else if (result && 'error' in result && result.error) {
      setErrorMsg(result.error)
      setLoading(false)
    } else if (result && 'success' in result && result.success && result.email) {
      // Move to the code-entry step; Supabase has emailed the 6-digit code.
      setSavedEmail(result.email)
      setOtpToken('')
      setPendingVerification(true)
      setLoading(false)
    }
  }

  const handleOtpSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrorMsg(null)
    setInfoMsg(null)
    setLoading(true)

    const result = await verifyOtpAction(savedEmail, otpToken)

    // On success verifyOtpAction redirects, so we only get here on error.
    if (result && 'errorKey' in result && result.errorKey) {
      setErrorMsg(t(getSignUpErrorKey(result.errorKey)))
      setLoading(false)
    } else if (result?.error) {
      setErrorMsg(result.error)
      setLoading(false)
    }
  }

  const handleResendClick = async () => {
    if (!savedEmail || resendLoading) return

    setErrorMsg(null)
    setInfoMsg(null)
    setResendLoading(true)

    const result = await resendVerificationCodeAction(savedEmail)

    if (result?.success) {
      setInfoMsg(t('login.register.resendSuccess'))
    } else {
      setErrorMsg(t(getResendErrorKey(result?.errorKey)))
    }

    setResendLoading(false)
  }

  // PHASE 2 VIEW: 6-digit code verification
  if (pendingVerification) {
    return (
      <form onSubmit={handleOtpSubmit} className="space-y-4">
        {errorMsg && (
          <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-xs text-red-600">
            {errorMsg}
          </div>
        )}
        {infoMsg && (
          <div className="rounded-xl border border-teal/20 bg-teal/10 p-3 text-xs text-navy/70">
            {infoMsg}
          </div>
        )}

        <div className="space-y-1">
          <label className="text-[11px] font-bold uppercase tracking-widest text-navy/45">
            {t('login.register.verificationCode')}
          </label>
          <input
            name="otpToken"
            type="text"
            required
            maxLength={10}
            pattern="\d{6,10}"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={otpToken}
            onChange={(event) => {
              setOtpToken(event.currentTarget.value.replace(/\D/g, '').slice(0, 10))
            }}
            placeholder={t('login.register.otpPlaceholder')}
            className="w-full rounded-xl border border-stone bg-ice px-3 py-2 text-center font-mono text-base tracking-widest text-navy outline-none transition-all focus:border-teal focus:bg-white focus:ring-2 focus:ring-teal/20"
          />
          <p className="pt-0.5 text-[10px] text-navy/40">
            {t('login.register.verificationHelpPrefix')}{' '}
            <span className="font-medium text-navy/60">{savedEmail}</span>
            {t('login.register.verificationHelpSuffix')}
          </p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full cursor-pointer rounded-xl bg-navy py-2.5 text-sm font-semibold text-white transition-colors hover:bg-navy/90 disabled:opacity-50"
        >
          {loading ? t('login.register.verifyingCode') : t('login.register.confirmAccount')}
        </button>

        <button
          type="button"
          disabled={loading || resendLoading}
          onClick={handleResendClick}
          className="w-full cursor-pointer rounded-xl border border-stone bg-white py-2.5 text-sm font-semibold text-navy transition-colors hover:border-teal hover:text-teal disabled:opacity-50"
        >
          {resendLoading ? t('login.register.resendingCode') : t('login.register.resendCode')}
        </button>

        <div className="pt-1 text-center">
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="cursor-pointer text-xs font-medium text-navy/40 transition-colors hover:text-teal"
          >
            {t('login.register.signInInstead')}
          </button>
        </div>

        <div className="text-center">
          <button
            type="button"
            onClick={() => {
              setPendingVerification(false)
              setErrorMsg(null)
              setInfoMsg(null)
              setOtpToken('')
            }}
            className="cursor-pointer text-xs font-medium text-navy/40 transition-colors hover:text-teal"
          >
            {t('login.register.backToRegistration')}
          </button>
        </div>
      </form>
    )
  }

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
            {t('login.register.firstName')}
          </label>
          <input
            name="firstName"
            type="text"
            required
            value={firstName}
            onChange={(event) => {
              setFirstName(event.currentTarget.value)
            }}
            placeholder={t('login.register.firstNamePlaceholder')}
            className="w-full rounded-xl border border-stone bg-ice px-3 py-2 text-sm text-navy outline-none transition-all placeholder:text-navy/25 focus:border-teal focus:bg-white focus:ring-2 focus:ring-teal/20"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-bold uppercase tracking-widest text-navy/45">
            {t('login.register.lastName')}
          </label>
          <input
            name="lastName"
            type="text"
            required
            value={lastName}
            onChange={(event) => {
              setLastName(event.currentTarget.value)
            }}
            placeholder={t('login.register.lastNamePlaceholder')}
            className="w-full rounded-xl border border-stone bg-ice px-3 py-2 text-sm text-navy outline-none transition-all placeholder:text-navy/25 focus:border-teal focus:bg-white focus:ring-2 focus:ring-teal/20"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-[11px] font-bold uppercase tracking-widest text-navy/45">
          {t('login.email')}
        </label>
        <input
          name="email"
          type="email"
          required
          value={registerEmail}
          onChange={(event) => {
            setRegisterEmail(event.currentTarget.value)
          }}
          placeholder={t('login.emailPlaceholder')}
          className="w-full rounded-xl border border-stone bg-ice px-3 py-2 text-sm text-navy outline-none transition-all placeholder:text-navy/25 focus:border-teal focus:bg-white focus:ring-2 focus:ring-teal/20"
        />
      </div>

      <div className="space-y-1">
        <label className="text-[11px] font-bold uppercase tracking-widest text-navy/45">
          {t('login.password')}
        </label>
        <input
          name="password"
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(event) => {
            setPassword(event.currentTarget.value)
          }}
          placeholder={t('login.passwordPlaceholder')}
          className="w-full rounded-xl border border-stone bg-ice px-3 py-2 text-sm text-navy outline-none transition-all placeholder:text-navy/25 focus:border-teal focus:bg-white focus:ring-2 focus:ring-teal/20"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full cursor-pointer rounded-xl bg-navy py-2.5 text-sm font-semibold text-white transition-colors hover:bg-navy/90 disabled:opacity-50"
      >
        {loading ? t('login.register.registering') : t('login.register.createAccount')}
      </button>

      <div className="pt-1 text-center">
        <button
          type="button"
          onClick={onSwitchToLogin}
          className="cursor-pointer text-xs font-medium text-navy/40 transition-colors hover:text-teal"
        >
          {t('login.register.alreadyHaveAccount')}
        </button>
      </div>
    </form>
  )
}
