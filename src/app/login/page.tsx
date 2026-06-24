import { redirectIfAuthenticated } from "@/lib/auth"
import { LoginView } from '@/app/login/components/login-view'

export default async function LoginPage() {
  await redirectIfAuthenticated()

  return (
    <main className="google-sans-page flex min-h-screen items-center justify-center bg-ice px-4 py-8">
      <div className="w-full max-w-sm overflow-hidden rounded-xl border border-stone bg-white shadow-sm">
        <LoginView />
      </div>
    </main>
  )
}
