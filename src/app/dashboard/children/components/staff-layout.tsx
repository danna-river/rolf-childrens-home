import { Suspense } from 'react'

export function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[calc(100svh_-_4rem)] flex flex-col">
      <div className="flex-1">
        <Suspense>{children}</Suspense>
      </div>
    </div>
  )
}
