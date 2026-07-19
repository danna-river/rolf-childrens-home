"use client"

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next"
import { usePathname } from "next/navigation"

const PUBLIC_ANALYTICS_PATHS = new Set(["/", "/login"])

function cleanPublicEvent(event: BeforeSendEvent): BeforeSendEvent | null {
  try {
    const url = new URL(event.url, window.location.origin)

    if (!PUBLIC_ANALYTICS_PATHS.has(url.pathname)) {
      return null
    }

    return {
      ...event,
      url: url.pathname,
    }
  } catch {
    return null
  }
}

export function PublicAnalytics() {
  const pathname = usePathname()

  if (!pathname || !PUBLIC_ANALYTICS_PATHS.has(pathname)) {
    return null
  }

  return <Analytics beforeSend={cleanPublicEvent} />
}
