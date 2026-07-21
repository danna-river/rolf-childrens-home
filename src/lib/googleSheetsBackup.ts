import "server-only"

import { google, sheets_v4 } from "googleapis"
import { createAdminClient } from "@/lib/supabase/admin"

type JsonRow = Record<string, unknown>

type ExportTable = {
  name: string
  orderBy?: string
  optional?: boolean
  redactedColumns?: string[]
}

type TableBackupResult = {
  table: string
  rows: number
  columns: number
  status: "ok" | "skipped" | "error"
  error?: string
}

type TableWrite = {
  table: string
  sheetName: string
  rows: number
  columns: number
  values: unknown[][]
}

type ValueWrite = {
  range: string
  values: unknown[][]
  bytes: number
}

export type SheetsBackupResult = {
  spreadsheetId: string
  syncedAt: string
  tables: TableBackupResult[]
}

const PAGE_SIZE = 1000
const MAX_VALUE_BATCH_BYTES = 1_500_000
const RETRY_DELAYS_MS = [1000, 2000, 4000, 8000]

// App-owned public tables only. Do not mirror Supabase internals like auth,
// storage, realtime, cron, or vault into a spreadsheet.
const EXPORT_TABLES: ExportTable[] = [
  { name: "app_settings", orderBy: "id", optional: true },
  { name: "countries", orderBy: "name" },
  { name: "profiles", orderBy: "created_at" },
  { name: "children", orderBy: "created_at" },
  { name: "child_media", orderBy: "created_at" },
  { name: "child_updates", orderBy: "created_at" },
  { name: "media_deletion", orderBy: "soft_deleted_at", optional: true },
  { name: "sponsors", orderBy: "created_at" },
  { name: "sponsorships", orderBy: "created_at" },
  { name: "intake_templates", orderBy: "created_at" },
  { name: "template_questions", orderBy: "sort_order" },
  { name: "progress_reports", orderBy: "id" },
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getErrorStatus(error: unknown) {
  if (!error || typeof error !== "object") return null
  const directCode = (error as { code?: unknown }).code
  if (typeof directCode === "number") return directCode

  const responseStatus = (error as { response?: { status?: unknown } }).response?.status
  return typeof responseStatus === "number" ? responseStatus : null
}

function isRateLimitError(error: unknown) {
  const status = getErrorStatus(error)
  const message = error instanceof Error ? error.message : String(error)

  return status === 429
    || (status === 403 && /quota|rate|too many|resource_exhausted/i.test(message))
}

async function withSheetsRetry<T>(operation: () => Promise<T>) {
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await operation()
    } catch (error) {
      if (!isRateLimitError(error) || attempt === RETRY_DELAYS_MS.length) {
        throw error
      }

      await sleep(RETRY_DELAYS_MS[attempt])
    }
  }

  throw new Error("Sheets request failed")
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

function isMissingTableError(message: string) {
  return message.includes("Could not find the table")
    || message.includes("does not exist")
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
    fields: "sheets.properties(sheetId,title)",
  })

  const sheetMap = new Map<string, number>()
  for (const sheet of data.sheets ?? []) {
    const title = sheet.properties?.title
    const sheetId = sheet.properties?.sheetId
    if (title && sheetId !== undefined && sheetId !== null) {
      sheetMap.set(title, sheetId)
    }
  }

  return sheetMap
}

async function prepareSheets(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
  existingSheets: Map<string, number>,
  writes: TableWrite[],
) {
  const existingIds = new Set(existingSheets.values())
  let nextSheetId = 100000
  const requests: sheets_v4.Schema$Request[] = []

  const allocateSheetId = () => {
    while (existingIds.has(nextSheetId)) nextSheetId++
    existingIds.add(nextSheetId)
    return nextSheetId++
  }

  for (const write of writes) {
    const rowCount = Math.max(write.values.length, 1)
    const columnCount = Math.max(write.columns, 1)
    const existingSheetId = existingSheets.get(write.sheetName)

    if (existingSheetId === undefined) {
      const sheetId = allocateSheetId()
      existingSheets.set(write.sheetName, sheetId)
      requests.push({
        addSheet: {
          properties: {
            sheetId,
            title: write.sheetName,
            gridProperties: {
              rowCount,
              columnCount,
              frozenRowCount: 1,
            },
          },
        },
      })
      continue
    }

    requests.push({
      updateSheetProperties: {
        properties: {
          sheetId: existingSheetId,
          gridProperties: {
            rowCount,
            columnCount,
            frozenRowCount: 1,
          },
        },
        fields: "gridProperties.rowCount,gridProperties.columnCount,gridProperties.frozenRowCount",
      },
    })
  }

  if (requests.length === 0) return

  await withSheetsRetry(() => sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests,
    },
  }))
}

function rowByteLength(row: unknown[]) {
  return Buffer.byteLength(JSON.stringify(row), "utf8") + 2
}

function createValueWrites(
  sheetName: string,
  values: unknown[][],
) {
  const writes: ValueWrite[] = []
  let startRow = 1
  let batch: unknown[][] = []
  let batchBytes = 0

  for (let index = 0; index < values.length; index++) {
    const row = values[index]
    const nextBytes = rowByteLength(row)
    if (batch.length > 0 && batchBytes + nextBytes > MAX_VALUE_BATCH_BYTES) {
      writes.push({
        range: `${quoteSheetName(sheetName)}!A${startRow}`,
        values: batch,
        bytes: batchBytes,
      })
      startRow = index + 1
      batch = []
      batchBytes = 0
    }

    batch.push(row)
    batchBytes += nextBytes
  }

  if (batch.length > 0) {
    writes.push({
      range: `${quoteSheetName(sheetName)}!A${startRow}`,
      values: batch,
      bytes: batchBytes,
    })
  }

  return writes
}

async function writeValueBatches(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
  writes: TableWrite[],
) {
  const valueWrites = writes.flatMap((write) =>
    createValueWrites(write.sheetName, write.values),
  )
  let batchData: { range: string; values: unknown[][] }[] = []
  let batchBytes = 0

  const flush = async () => {
    if (batchData.length === 0) return

    const data = batchData
    batchData = []
    batchBytes = 0

    await withSheetsRetry(() => sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: "RAW",
        data,
      },
    }))
  }

  for (const write of valueWrites) {
    if (batchData.length > 0 && batchBytes + write.bytes > MAX_VALUE_BATCH_BYTES) {
      await flush()
    }

    batchData.push({ range: write.range, values: write.values })
    batchBytes += write.bytes
  }

  await flush()
}

function buildTableWrite(table: ExportTable, rows: JsonRow[]) {
  const sheetName = sanitizeSheetName(table.name)
  if (rows.length === 0) {
    const values = [
      ["status", "synced_at"],
      ["empty", new Date().toISOString()],
    ]

    return {
      table: table.name,
      sheetName,
      rows: 0,
      columns: values[0].length,
      values,
    }
  }

  const columns = collectColumns(rows)
  return {
    table: table.name,
    sheetName,
    rows: rows.length,
    columns: columns.length,
    values: [
      columns,
      ...rows.map((row) => columns.map((column) => formatCell(row[column]))),
    ],
  }
}

function buildMetaWrite(spreadsheetId: string, syncedAt: string, results: TableBackupResult[]) {
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

  return {
    table: "_backup_meta",
    sheetName: "_backup_meta",
    rows: results.length,
    columns: values[0].length,
    values,
  }
}

export async function backupSupabaseToGoogleSheets(): Promise<SheetsBackupResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase admin environment variables")
  }

  const spreadsheetId = getSpreadsheetId()
  const sheets = getSheetsClient()
  const existingSheets = await getExistingSheetNames(sheets, spreadsheetId)
  const syncedAt = new Date().toISOString()
  const results: TableBackupResult[] = []
  const tableWrites: TableWrite[] = []

  for (const table of EXPORT_TABLES) {
    try {
      const rows = await fetchTableRows(table)
      const write = buildTableWrite(table, rows)
      tableWrites.push(write)

      results.push({
        table: table.name,
        rows: write.rows,
        columns: write.columns,
        status: "ok",
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown export error"
      const status = table.optional && isMissingTableError(message) ? "skipped" : "error"
      results.push({
        table: table.name,
        rows: 0,
        columns: 0,
        status,
        error: message,
      })
    }
  }

  const writes = [...tableWrites, buildMetaWrite(spreadsheetId, syncedAt, results)]
  await prepareSheets(sheets, spreadsheetId, existingSheets, writes)
  await writeValueBatches(sheets, spreadsheetId, writes)

  return { spreadsheetId, syncedAt, tables: results }
}
