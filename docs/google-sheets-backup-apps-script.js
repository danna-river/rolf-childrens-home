/* eslint-disable @typescript-eslint/no-unused-vars */

const APP_URL = "https://childrenshome.rolfusa.org"
const BACKUP_PATH = "/api/admin/sheets-backup"

function runSupabaseSheetsBackup() {
  const secret = PropertiesService
    .getScriptProperties()
    .getProperty("SHEETS_BACKUP_SECRET")

  if (!secret) {
    throw new Error("Missing SHEETS_BACKUP_SECRET script property")
  }

  const response = UrlFetchApp.fetch(`${APP_URL}${BACKUP_PATH}`, {
    method: "post",
    headers: {
      Authorization: `Bearer ${secret}`,
    },
    muteHttpExceptions: true,
  })

  const status = response.getResponseCode()
  const body = response.getContentText()

  if (status < 200 || status >= 300) {
    throw new Error(`Backup failed with HTTP ${status}: ${body}`)
  }

  const result = JSON.parse(body)
  if (!result.ok) {
    throw new Error(`Backup partially failed: ${body}`)
  }

  Logger.log(body)
}

function installHourlySupabaseSheetsBackup() {
  ScriptApp.newTrigger("runSupabaseSheetsBackup")
    .timeBased()
    .everyHours(1)
    .create()
}
