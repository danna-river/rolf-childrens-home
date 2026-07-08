import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendPendingAccountsDigest } from "@/lib/email"

// Weekday digest to admins of accounts awaiting approval.
// Scheduled in vercel.json (Mon–Fri, once a day). Only sends when at least one
// account is pending — so admins never get an empty "0 pending" email.
export async function GET(request: NextRequest) {
  // Vercel Cron includes `Authorization: Bearer ${CRON_SECRET}` when CRON_SECRET
  // is set. Reject anything else so the endpoint can't be triggered publicly.
  const secret = process.env.CRON_SECRET
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const admin = createAdminClient()

  const { count, error: countError } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "unapproved")
  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 })
  }
  // Nothing pending → no email.
  if (!count || count < 1) {
    return NextResponse.json({ sent: false, pending: 0 })
  }

  const { data: admins, error: adminError } = await admin
    .from("profiles")
    .select("email")
    .eq("role", "admin")
  if (adminError) {
    return NextResponse.json({ error: adminError.message }, { status: 500 })
  }
  const adminEmails = (admins ?? [])
    .map((a: { email: string }) => a.email)
    .filter(Boolean)

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ""
  await sendPendingAccountsDigest(adminEmails, count, appUrl)

  return NextResponse.json({ sent: true, pending: count, admins: adminEmails.length })
}
