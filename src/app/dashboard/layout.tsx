import { Suspense } from 'react'
import { Navbar } from '@/components/navbar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col">
      <Navbar />
      <Suspense>{children}</Suspense>
    </div>
  )
}
