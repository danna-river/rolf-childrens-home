import { Suspense } from 'react'

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-blue-600 text-white p-4">
        <h1 className="text-xl font-bold">Staff Dashboard</h1>
      </header>
      <main className="flex-1 p-6">
        <Suspense>{children}</Suspense>
      </main>
    </div>
  )
}