const CSV_FORMULA_PREFIX = /^[=+\-@\t\r\n]/

export function escapeCSVValue(value: unknown): string {
  if (value === null || value === undefined) return ""

  const raw = typeof value === "object"
    ? JSON.stringify(value) ?? ""
    : String(value)
  const safe = CSV_FORMULA_PREFIX.test(raw) ? `'${raw}` : raw

  return `"${safe.replace(/"/g, '""')}"`
}
