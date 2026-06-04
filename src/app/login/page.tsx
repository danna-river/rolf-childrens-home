"use client"

import { useState } from 'react'
import { LoginForm } from '@/app/login/components/login-form'
import { RegisterForm } from '@/app/login/components/register-form'

export default function LoginPage() {
  const [activeView, setActiveView] = useState<'login' | 'register'>('login')

  let pageTitle = 'Children\'s Home Portal Login'
  let pageDescription = 'Authenticate to access your dashboard'

  if (activeView === 'register') {
    pageTitle = 'Register Children\'s Home Account'
    pageDescription = 'All fields are required'
  }

  let formContent
  if (activeView === 'login') {
    formContent = <LoginForm onSwitchToRegister={() => setActiveView('register')}/>
  } else {
    formContent = <RegisterForm onSwitchToLogin={() => setActiveView('login')}/>
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white border border-gray-100 rounded-3xl p-8 shadow-xs max-w-sm w-full space-y-6">
        
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md">
            ROLF Children's Home
          </span>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight mt-3">
            {pageTitle}
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {pageDescription}
          </p>
        </div>

        {formContent}

      </div>
    </main>
  )
}