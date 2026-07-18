import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendPendingAccountsDigest } from "@/lib/email"
import { FACE_MODEL_VERSION } from "@/lib/face/config"

// Weekday digest to admins of items awaiting action: accounts pending approval
// and profile photos pending face enrollment (set server-side by mobile sync,
// or left behind by a failed client-side enrollment — only the manual backfill
// in Settings indexes those). Scheduled in vercel.json (Mon–Fri, once a day).
// Only sends when at least one item is pending — never an empty "0" email.
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
  const pendingAccounts = count ?? 0

  // A missing/failed RPC must not silence the accounts digest, so fall back to
  // zero and log instead of erroring out.
  let pendingFacePhotos = 0
  const { data: faceCount, error: faceError } = await admin.rpc(
    "get_face_enrollment_pending_count",
    { expected_model_version: FACE_MODEL_VERSION },
  )
  if (faceError) {
    console.error("[digest] face enrollment count failed:", faceError.message)
  } else {
    pendingFacePhotos = faceCount ?? 0
  }

  // Nothing pending → no email.
  if (pendingAccounts < 1 && pendingFacePhotos < 1) {
    return NextResponse.json({ sent: false, pendingAccounts: 0, pendingFacePhotos: 0 })
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
  await sendPendingAccountsDigest(adminEmails, pendingAccounts, pendingFacePhotos, appUrl)

  return NextResponse.json({
    sent: true,
    pendingAccounts,
    pendingFacePhotos,
    admins: adminEmails.length,
  })
}
