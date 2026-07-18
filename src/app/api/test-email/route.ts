import { NextRequest, NextResponse } from "next/server"
import {
  sendRegistrationReceivedEmail,
  sendPendingAccountsDigest,
  sendAccountApprovedEmail,
  sendAccountDeniedEmail,
  sendPasswordChangedEmail,
  sendSponsorInvitationEmail,
} from "@/lib/email"

// Dev-only helper to preview all transactional emails. Delete before production,
// or it stays 404'd there anyway via the guard below.
// Usage: visit /api/test-email?to=childrenhome@theriverflows.org while `npm run dev` runs.
// NOTE: with the onboarding@resend.dev test sender, `to` MUST be your own Resend account email.
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const to = request.nextUrl.searchParams.get("to")
  if (!to) {
    return NextResponse.json({ error: "Add ?to=your@email.com" }, { status: 400 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

  const results = await Promise.allSettled([
    sendRegistrationReceivedEmail(to, "Test User"),
    sendPendingAccountsDigest([to], 2, 3, appUrl),
    sendAccountApprovedEmail(to, "Test User", "staff", appUrl),
    sendAccountDeniedEmail(to, "Test User"),
    sendPasswordChangedEmail(to, "Test User"),
    sendSponsorInvitationEmail(to, "Test Sponsor", appUrl),
  ])

  const labels = [
    "registration_received",
    "new_account_alert",
    "account_approved",
    "account_denied",
    "password_changed",
    "sponsor_invitation",
  ]

  return NextResponse.json({
    to,
    from: process.env.RESEND_FROM ?? "default (production domain)",
    results: results.map((r, i) => ({
      email: labels[i],
      status: r.status,
      ...(r.status === "rejected" ? { error: String(r.reason) } : {}),
    })),
  })
}
