// src/app/login/page.tsx
import { redirect } from 'next/navigation'
import { validateSessionAndRole } from './actions' // 🌟 Import your new action
import { LoginView } from '@/app/login/components/login-view'

export const dynamic = 'force-dynamic'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  
  // 1. Run the server action validation check
  const { status } = await validateSessionAndRole()

  // 2. Direct traffic immediately based on the status string
  if (status === 'authorized') {
    return redirect('/dashboard/children')
  }

  if (status === 'unapproved') {
    return redirect('/dashboard') // Sends them to the orchestrator to see the UnapprovedView
  }

  // If the status is 'profile_missing', the action has already logged them out.
  // We can redirect them to refresh the page state with the clean query parameter.
  if (status === 'profile_missing' && error !== 'ProfileMissing') {
    return redirect('/login?error=ProfileMissing')
  }

  // 3. If 'no_session' or clean 'profile_missing', safely render the login forms
  return (
    <main className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="bg-white border border-gray-100 rounded-3xl p-8 shadow-xs max-w-sm w-full space-y-6">
        
        {error === 'ProfileMissing' && (
          <div className="p-3 bg-amber-50 border border-amber-200 text-xs text-amber-700 rounded-xl leading-relaxed animate-fade-in">
            <strong>Session Wiped:</strong> Your authentication login existed, but no database profile row was found. The invalid session has been cleared. Please try registering again.
          </div>
        )}

        <LoginView />
      </div>
    </main>
  )
}