"use client"

import { useState } from 'react'
import { LoginForm } from '@/app/login/components/login-form'
import { RegisterForm } from '@/app/login/components/register-form'

export function LoginView() {
  const [activeView, setActiveView] = useState<'login' | 'register'>('login')

  const isRegister = activeView === 'register'

  return (
    <>
      <div className="bg-navy px-6 py-6 text-white">
        <div className="mb-4 inline-flex items-center rounded-md border border-teal/40 bg-teal/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-teal">
          ROLF Children&apos;s Home
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          {isRegister ? 'Create account' : 'Sign in'}
        </h1>
        <p className="mt-1 text-base font-medium text-white/60">
          {isRegister ? 'All fields are required' : 'Access your dashboard'}
        </p>
      </div>

      <div className="px-6 py-6">
        {isRegister
          ? <RegisterForm onSwitchToLogin={() => setActiveView('login')} />
          : <LoginForm onSwitchToRegister={() => setActiveView('register')} />
        }
      </div>
    </>
  )
}
