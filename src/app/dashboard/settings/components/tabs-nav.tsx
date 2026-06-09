"use client"

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { isAdminRole } from '@/lib/profiles'

interface TabsNavProps {
  userRole: string
}

export function TabsNav({ userRole }: TabsNavProps) {
  const searchParams = useSearchParams()
  const activeTab = searchParams.get('tab') || 'profile'
  const isSystemAdmin = isAdminRole(userRole)

  // Baseline navigation definitions accessible by ANY active account role
  const tabs = [
    { id: 'profile', label: '👤 Personal Profile' },
    { id: 'security', label: '🔒 Password & Security' },
  ]

  // Conditionally append structural panels if administrator clearance matches
  if (isSystemAdmin) {
    tabs.push(
      { id: 'approvals', label: '🛡️ Pending Accounts' },
      { id: 'global_configs', label: '🌍 Global Configuration' }
    )
  }

  return (
    <nav className="flex border-b border-gray-100 gap-1 pb-1">
      {tabs.map((tab) => {
        const isCurrent = activeTab === tab.id
        
        let linkClass = "px-4 py-2 text-xs font-semibold rounded-xl text-gray-500 hover:text-gray-900 hover:bg-gray-50/80 transition-all cursor-pointer"
        if (isCurrent) {
          linkClass = "px-4 py-2 text-xs font-bold rounded-xl bg-blue-50 text-blue-600 transition-all cursor-pointer"
        }

        return (
          <Link 
            key={tab.id} 
            href={`/dashboard/settings?tab=${tab.id}`}
            className={linkClass}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}