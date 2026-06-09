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

  const tabs = [
    { id: 'profile', label: '👤 Personal Profile' },
    { id: 'security', label: '🔒 Password & Security' },
  ]

  if (isSystemAdmin) {
    tabs.push(
      { id: 'approvals', label: '🛡️ Approval Requests' },
      { id: 'global_config', label: '🌍 Global Configurations' }
    )
  }

  return (
    <nav className="flex flex-row md:flex-col gap-1 w-full overflow-x-auto md:overflow-x-visible pb-3 md:pb-0 border-b border-gray-100 md:border-b-0">
      {tabs.map((tab) => {
        const isCurrent = activeTab === tab.id
        
        let linkClass = "flex items-center px-4 py-2.5 text-xs font-semibold rounded-xl text-gray-500 hover:text-gray-900 hover:bg-gray-100/70 transition-all cursor-pointer whitespace-nowrap md:whitespace-normal"
        if (isCurrent) {
          linkClass = "flex items-center px-4 py-2.5 text-xs font-bold rounded-xl bg-blue-50 text-blue-600 transition-all cursor-pointer whitespace-nowrap md:whitespace-normal"
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