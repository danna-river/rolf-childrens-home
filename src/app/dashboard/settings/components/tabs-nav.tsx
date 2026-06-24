"use client"

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { isAdminRole } from '@/lib/profiles'
import { UserIcon, LockIcon, ShieldCheckIcon, GlobeIcon, UsersIcon, FileTextIcon } from 'lucide-react'

interface TabsNavProps {
  userRole: string
}

export function TabsNav({ userRole }: TabsNavProps) {
  const searchParams = useSearchParams()
  const activeTab = searchParams.get('tab') || 'profile'
  const isSystemAdmin = isAdminRole(userRole)

  const tabs = [
    { id: 'profile', label: 'Personal Profile', icon: UserIcon },
    { id: 'security', label: 'Password & Security', icon: LockIcon },
  ]

  if (isSystemAdmin) {
    tabs.push(
      { id: 'approvals', label: 'Approval Requests', icon: ShieldCheckIcon },
      { id: 'global_config', label: 'Global Configurations', icon: GlobeIcon },
      { id: 'manage_users', label: 'Manage Users', icon: UsersIcon },
      { id: 'intake_form', label: 'Intake Forms', icon: FileTextIcon }
    )
  }

  return (
    <nav className="google-sans-registry flex flex-col gap-1 w-full">
      {tabs.map((tab) => {
        const isCurrent = activeTab === tab.id
        const Icon = tab.icon
        
        let linkClass = "flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-semibold rounded-md text-navy/65 hover:text-navy hover:bg-ice/80 transition-all cursor-pointer whitespace-normal break-words"
        let iconClass = "size-4 text-navy/40 shrink-0"

        if (isCurrent) {
          linkClass = "flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-bold rounded-md bg-teal/15 text-teal border border-teal/30 shadow-2xs transition-all cursor-pointer whitespace-normal break-words"
          iconClass = "size-4 text-teal shrink-0"
        }

        return (
          <Link 
            key={tab.id} 
            href={`/dashboard/settings?tab=${tab.id}`}
            className={linkClass}
          >
            <Icon className={iconClass} aria-hidden="true" />
            <span>{tab.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}