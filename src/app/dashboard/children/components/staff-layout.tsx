import { Suspense } from 'react'

export function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[calc(100svh_-_4rem)] flex flex-col">
      <main className="flex-1 p-6">
        <Suspense>{children}</Suspense>
      </main>
    </div>
  )
}
