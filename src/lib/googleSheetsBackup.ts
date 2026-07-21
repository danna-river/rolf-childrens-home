import "server-only"

import { google } from "googleapis"
import { createAdminClient } from "@/lib/supabase/admin"

type JsonRow = Record<string, unknown>

type ExportTable = {
  name: string
  orderBy?: string
  redactedColumns?: string[]
}

type TableBackupResult = {
  table: string
  rows: number
  columns: number
  status: "ok" | "error"
  error?: string
}

export type SheetsBackupResult = {
  spreadsheetId: string
  syncedAt: string
  tables: TableBackupResult[]
}

const PAGE_SIZE = 1000
const WRITE_BATCH_ROWS = 500

// App-owned public tables only. Do not mirror Supabase internals like auth,
// storage, realtime, cron, or vault into a spreadsheet.
const EXPORT_TABLES: ExportTable[] = [
  { name: "app_settings", orderBy: "id" },
  { name: "countries", orderBy: "name" },
  { name: "profiles", orderBy: "created_at" },
  { name: "children", orderBy: "created_at" },
  { name: "child_media", orderBy: "created_at" },
  { name: "child_updates", orderBy: "created_at" },
  { name: "media_deletion", orderBy: "soft_deleted_at" },
  { name: "sponsors", orderBy: "created_at" },
  { name: "sponsorships", orderBy: "created_at" },
  { name: "intake_templates", orderBy: "created_at" },
  { name: "template_questions", orderBy: "sort_order" },
  { name: "progress_reports", orderBy: "created_at" },
  { name: "report_answers", orderBy: "created_at" },
  { name: "pen_pal_threads", orderBy: "created_at" },
  { name: "pen_pal_messages", orderBy: "created_at" },
  { name: "pen_pal_events", orderBy: "created_at" },
  { name: "mobile_devices", orderBy: "created_at" },
  { name: "rolf_id_counters", orderBy: "country" },
  { name: "rolf_id_reservations", orderBy: "reserved_at" },
  { name: "mobile_sync_operations", orderBy: "created_at" },
  {
    name: "mobile_media_uploads",
    orderBy: "created_at",
    redactedColumns: ["drive_upload_url"],
  },
  { name: "heartbeat", orderBy: "id" },
]

function getSheetsClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n")

  if (!email || !key) {
    throw new Error("Missing Google service account environment variables")
  }

  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: email, private_key: key },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  })

  return google.sheets({ version: "v4", auth })
}

function getSpreadsheetId() {
  const spreadsheetId = process.env.GOOGLE_SHEETS_BACKUP_SPREADSHEET_ID

  if (!spreadsheetId) {
    throw new Error("Missing GOOGLE_SHEETS_BACKUP_SPREADSHEET_ID")
  }

  return spreadsheetId
}

function sanitizeSheetName(name: string) {
  return name.replace(/[\[\]:*?/\\]/g, "_").slice(0, 99)
}

function quoteSheetName(name: string) {
  return `'${name.replace(/'/g, "''")}'`
}

function formatCell(value: unknown) {
  if (value === null || value === undefined) return ""
  if (value instanceof Date) return value.toISOString()
  if (typeof value === "object") return JSON.stringify(value)
  return value
}

function collectColumns(rows: JsonRow[]) {
  const columns = new Set<string>()

  for (const row of rows) {
    for (const column of Object.keys(row)) {
      columns.add(column)
    }
  }

  return Array.from(columns)
}

function applyRedactions(rows: JsonRow[], redactedColumns: string[] | undefined) {
  if (!redactedColumns?.length) return rows
  const redacted = new Set(redactedColumns)

  return rows.map((row) => {
    const copy = { ...row }
    for (const column of redacted) {
      if (column in copy) copy[column] = "[redacted]"
    }
    return copy
  })
}

async function fetchTableRows(table: ExportTable) {
  const supabase = createAdminClient()
  const rows: JsonRow[] = []
  let from = 0

  while (true) {
    let query = supabase
      .from(table.name as never)
      .select("*")
      .range(from, from + PAGE_SIZE - 1)

    if (table.orderBy) {
      query = query.order(table.orderBy, { ascending: true })
    }

    const { data, error } = await query

    if (error) {
      throw new Error(error.message)
    }

    const page = (data ?? []) as JsonRow[]
    rows.push(...page)

    if (page.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return applyRedactions(rows, table.redactedColumns)
}

async function getExistingSheetNames(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
) {
  const { data } = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties.title",
  })

  return new Set(
    (data.sheets ?? [])
      .map((sheet) => sheet.properties?.title)
      .filter((title): title is string => Boolean(title)),
  )
}

async function ensureSheet(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
  existingSheetNames: Set<string>,
  sheetName: string,
) {
  if (existingSheetNames.has(sheetName)) return

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          addSheet: {
            properties: {
              title: sheetName,
              gridProperties: { frozenRowCount: 1 },
            },
          },
        },
      ],
    },
  })

  existingSheetNames.add(sheetName)
}

async function clearSheet(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
  sheetName: string,
) {
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `${quoteSheetName(sheetName)}!A:ZZZ`,
  })
}

async function writeValues(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
  sheetName: string,
  values: unknown[][],
) {
  if (values.length === 0) return

  for (let start = 0; start < values.length; start += WRITE_BATCH_ROWS) {
    const batch = values.slice(start, start + WRITE_BATCH_ROWS)
    const rowNumber = start + 1
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${quoteSheetName(sheetName)}!A${rowNumber}`,
      valueInputOption: "RAW",
      requestBody: { values: batch },
    })
  }
}

async function writeTableSheet(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
  existingSheetNames: Set<string>,
  table: ExportTable,
  rows: JsonRow[],
) {
  const sheetName = sanitizeSheetName(table.name)
  await ensureSheet(sheets, spreadsheetId, existingSheetNames, sheetName)
  await clearSheet(sheets, spreadsheetId, sheetName)

  if (rows.length === 0) {
    await writeValues(sheets, spreadsheetId, sheetName, [
      ["status", "synced_at"],
      ["empty", new Date().toISOString()],
    ])
    return { columns: 2 }
  }

  const columns = collectColumns(rows)
  const values = [
    columns,
    ...rows.map((row) => columns.map((column) => formatCell(row[column]))),
  ]

  await writeValues(sheets, spreadsheetId, sheetName, values)
  return { columns: columns.length }
}

async function writeMetaSheet(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
  existingSheetNames: Set<string>,
  syncedAt: string,
  results: TableBackupResult[],
) {
  const sheetName = "_backup_meta"
  await ensureSheet(sheets, spreadsheetId, existingSheetNames, sheetName)
  await clearSheet(sheets, spreadsheetId, sheetName)

  const values = [
    ["synced_at", "spreadsheet_id", "table", "rows", "columns", "status", "error"],
    ...results.map((result) => [
      syncedAt,
      spreadsheetId,
      result.table,
      result.rows,
      result.columns,
      result.status,
      result.error ?? "",
    ]),
  ]

  await writeValues(sheets, spreadsheetId, sheetName, values)
}

async function resizeSheetColumns(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
  sheetName: string,
  columnCount: number,
) {
  if (columnCount < 1) return

  const { data } = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties(sheetId,title)",
  })
  const sheet = data.sheets?.find((candidate) => candidate.properties?.title === sheetName)
  const sheetId = sheet?.properties?.sheetId

  if (sheetId === undefined || sheetId === null) return

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          autoResizeDimensions: {
            dimensions: {
              sheetId,
              dimension: "COLUMNS",
              startIndex: 0,
              endIndex: Math.min(columnCount, 26),
            },
          },
        },
      ],
    },
  })
}

export async function backupSupabaseToGoogleSheets(): Promise<SheetsBackupResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase admin environment variables")
  }

  const spreadsheetId = getSpreadsheetId()
  const sheets = getSheetsClient()
  const existingSheetNames = await getExistingSheetNames(sheets, spreadsheetId)
  const syncedAt = new Date().toISOString()
  const results: TableBackupResult[] = []

  for (const table of EXPORT_TABLES) {
    try {
      const rows = await fetchTableRows(table)
      const { columns } = await writeTableSheet(
        sheets,
        spreadsheetId,
        existingSheetNames,
        table,
        rows,
      )

      results.push({
        table: table.name,
        rows: rows.length,
        columns,
        status: "ok",
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown export error"
      results.push({
        table: table.name,
        rows: 0,
        columns: 0,
        status: "error",
        error: message,
      })
    }
  }

  await writeMetaSheet(sheets, spreadsheetId, existingSheetNames, syncedAt, results)
  await resizeSheetColumns(
    sheets,
    spreadsheetId,
    "_backup_meta",
    7,
  )

  return { spreadsheetId, syncedAt, tables: results }
}
