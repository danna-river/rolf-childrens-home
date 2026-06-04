import { redirectIfAuthenticated } from "@/lib/auth"
import { LoginView } from '@/app/login/components/login-view'

export default async function LoginPage() {
  await redirectIfAuthenticated()

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white border border-gray-100 rounded-3xl p-8 shadow-xs max-w-sm w-full space-y-6">
        
        <LoginView />

      </div>
    </main>
  )
}