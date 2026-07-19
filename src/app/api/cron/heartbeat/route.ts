import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

// Daily keep-alive for the Supabase free tier, which pauses projects after
// ~7 days without API activity. A write is unambiguous activity; the table
// holds a single row that gets updated in place, so it never grows.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error("[heartbeat] CRON_SECRET is not configured; refusing cron request.")
    return NextResponse.json({ error: "Cron secret is not configured" }, { status: 500 })
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "Missing Supabase admin environment variables" },
      { status: 500 },
    )
  }

  const admin = createAdminClient()
  const beatAt = new Date().toISOString()

  const { error } = await admin
    .from("heartbeat")
    .upsert({ id: 1, beat_at: beatAt })

  if (error) {
    console.error("[heartbeat] failed:", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, beat_at: beatAt })
}
