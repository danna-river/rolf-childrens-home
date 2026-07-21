import { NextRequest, NextResponse } from "next/server"
import { backupSupabaseToGoogleSheets } from "@/lib/googleSheetsBackup"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST(request: NextRequest) {
  const secret = process.env.SHEETS_BACKUP_SECRET

  if (!secret) {
    console.error("[sheets-backup] SHEETS_BACKUP_SECRET is not configured.")
    return NextResponse.json(
      { error: "Sheets backup secret is not configured" },
      { status: 500 },
    )
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await backupSupabaseToGoogleSheets()
    const failedTables = result.tables.filter((table) => table.status === "error")

    return NextResponse.json(
      {
        ok: failedTables.length === 0,
        ...result,
        failedTables,
      },
      { status: failedTables.length === 0 ? 200 : 207 },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sheets backup failed"
    console.error("[sheets-backup] failed:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
