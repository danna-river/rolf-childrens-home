"use server"
import { google } from "googleapis"
import { Readable } from "stream"

export type ChildMeta = {
  idRolf: string | null
  firstName: string | null
  lastName: string | null
  country: string | null
}

function getDriveClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n")
  const sharedDriveId = process.env.GOOGLE_SHARED_DRIVE_ID

  if (!email || !key || !sharedDriveId) {
    throw new Error("Missing Google Drive environment variables")
  }

  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: email, private_key: key },
    scopes: ["https://www.googleapis.com/auth/drive"],
  })

  return { drive: google.drive({ version: "v3", auth }), sharedDriveId }
}

function sanitize(str: string): string {
  return str.trim().replace(/[^a-zA-Z0-9]/g, "_")
}

function buildFilename(
  meta: ChildMeta,
  type: "photo" | "video",
  ext: string,
): string {
  // 1. Get the human-readable date (YYYYMMDD)
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "")

  // 2. Get the high-resolution microsecond timestamp
  const ms = Date.now();
  const microfraction = performance.now().toFixed(3).split('.')[1] || "000";
  const exactTimestamp = `${ms}${microfraction}`;

  // 3. Combine date and microsecond timestamp
  const timingContext = `${dateStr}-${exactTimestamp}`;

  const parts = [
    meta.idRolf ? sanitize(meta.idRolf) : null,
    meta.lastName ? sanitize(meta.lastName) : null,
    meta.firstName ? sanitize(meta.firstName) : null,
    type,
    timingContext,
  ].filter(Boolean)
  
  return `${parts.join("_")}.${ext.toLowerCase()}`
}

/** Find a folder by name under a parent within the Shared Drive, or create it. */
async function findOrCreateFolder(
  drive: ReturnType<typeof google.drive>,
  sharedDriveId: string,
  name: string,
  parentId: string,
): Promise<string> {
  const { data } = await drive.files.list({
    q: `name = '${name}' and mimeType = 'application/vnd.google-apps.folder' and '${parentId}' in parents and trashed = false`,
    fields: "files(id)",
    spaces: "drive",
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
    corpora: "drive",
    driveId: sharedDriveId,
  })

  if (data.files && data.files.length > 0) return data.files[0].id!

  const { data: created } = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    },
    fields: "id",
    supportsAllDrives: true,
  })

  return created.id!
}

export async function uploadToDrive(
  buffer: Buffer,
  originalName: string,
  mimeType: string,
  type: "photo" | "video",
  meta: ChildMeta,
): Promise<{ fileId: string; url: string }> {
  const { drive, sharedDriveId } = getDriveClient()

  const ext = originalName.split(".").pop() ?? (type === "photo" ? "jpg" : "mp4")
  const filename = buildFilename(meta, type, ext)
  const year = new Date().getFullYear().toString()

  // Resolve destination: Shared Drive root / country / year
  const country = meta.country ? sanitize(meta.country) : "Unknown"
  const countryFolderId = await findOrCreateFolder(drive, sharedDriveId, country, sharedDriveId)
  const yearFolderId = await findOrCreateFolder(drive, sharedDriveId, year, countryFolderId)

  const { data } = await drive.files.create({
    requestBody: {
      name: filename,
      parents: [yearFolderId],
    },
    media: {
      mimeType,
      body: Readable.from(buffer),
    },
    fields: "id",
    supportsAllDrives: true,
  })

  const fileId = data.id!

  await drive.permissions.create({
    fileId,
    requestBody: { role: "reader", type: "anyone" },
    supportsAllDrives: true,
  })

  return {
    fileId,
    url: `https://drive.google.com/file/d/${fileId}/view`,
  }
}
