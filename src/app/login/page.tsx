import { LoginForm } from '@/app/login/components/login-form'

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white border border-gray-100 rounded-3xl p-8 shadow-xs max-w-sm w-full space-y-6">
        
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md">
            ROLF Core
          </span>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight mt-3">
            Staff Portal Login
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Authenticate to access your assigned regional workstation.
          </p>
        </div>

        <LoginForm />

      </div>
    </main>
  )
}