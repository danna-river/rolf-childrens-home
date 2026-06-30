// middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  // 1. Initialize the Supabase Client within the Middleware lifecycle
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // 2. IMPORTANT: This refreshes the session token if it's expired.
  // It syncs the browser auth cookie directly with Next.js header streams.
  const { data: { user }, error } = await supabase.auth.getUser()

  // Diagnostic logging to see if middleware is picking up the user session
  if (user) {
    console.log(`📡 MIDDLEWARE: Authenticated session detected for user: ${user.email}`)
  } else {
    console.log('📡 MIDDLEWARE: No active authenticated session cookie found.')
  }

  return supabaseResponse
}

// 3. Configure the matcher to run on all dashboard pages, but skip static assets
// and the upload route (which buffers large files and calls requireAuth directly).
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/upload|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}