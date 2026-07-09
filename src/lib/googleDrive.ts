"use server"
import { google } from "googleapis"
import { Readable } from "stream"
import { requireAuth } from "@/lib/auth"
import { isAdminRole, isStaffRole } from "@/lib/profiles"

export type ChildMeta = {
  idRolf: string | null
  firstName: string | null
  lastName: string | null
  country: string | null
  folderOverride?: string
}

const MAX_BYTES = {
  photo: 15 * 1024 * 1024,
  video: 50 * 1024 * 1024,
}
const MAX_THUMBNAIL_BYTES = 2 * 1024 * 1024

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

async function getDriveAccessToken() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n")

  if (!email || !key) {
    throw new Error("Missing Google Drive environment variables")
  }

  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: email, private_key: key },
    scopes: ["https://www.googleapis.com/auth/drive"],
  })

  const client = await auth.getClient()
  const accessToken = await client.getAccessToken()
  const token = typeof accessToken === "string" ? accessToken : accessToken?.token

  if (!token) {
    throw new Error("Could not obtain Google Drive upload token")
  }

  return token
}

function sanitize(str: string): string {
  return str.trim().replace(/[^a-zA-Z0-9]/g, "_")
}

function buildFilename(
  meta: ChildMeta,
  type: "photo" | "video",
  ext: string,
): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "")
  const ms = Date.now();
  const microfraction = performance.now().toFixed(3).split('.')[1] || "000";
  const exactTimestamp = `${dateStr}-${ms}${microfraction}`;

  const parts = [
    meta.idRolf ? sanitize(meta.idRolf) : null,
    meta.lastName ? sanitize(meta.lastName) : null,
    meta.firstName ? sanitize(meta.firstName) : null,
    type,
    exactTimestamp,
  ].filter(Boolean)
  
  return `${parts.join("_")}.${ext.toLowerCase()}`
}

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
): Promise<{ fileId: string; url: string; filename: string }> {
  const { drive, sharedDriveId } = getDriveClient()

  const ext = originalName.split(".").pop() ?? (type === "photo" ? "jpg" : "mp4")
  const filename = buildFilename(meta, type, ext)
  
  let targetFolderId: string

  // If we are overriding the location to staging (SYSTEM_TRASH)
  if (meta.folderOverride === "SYSTEM_TRASH") {
    targetFolderId = await findOrCreateFolder(drive, sharedDriveId, "SYSTEM_TRASH", sharedDriveId)
  } else {
    // Standard direct permanent structure path routing
    const year = new Date().getFullYear().toString()
    const country = meta.country ? sanitize(meta.country) : "Unknown"
    const countryFolderId = await findOrCreateFolder(drive, sharedDriveId, country, sharedDriveId)
    targetFolderId = await findOrCreateFolder(drive, sharedDriveId, year, countryFolderId)
  }

  const { data } = await drive.files.create({
    requestBody: {
      name: filename,
      parents: [targetFolderId],
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
    filename
  }
}

export async function createDriveUploadSession({
  type,
  filename,
  mimeType,
  size,
  meta,
}: {
  type: "photo" | "video"
  filename: string
  mimeType: string
  size: number
  meta: ChildMeta
}): Promise<{ uploadUrl: string | null; error: string | null }> {
  const { profile } = await requireAuth()
  if (!isAdminRole(profile.role) && !isStaffRole(profile.role)) {
    return { uploadUrl: null, error: "Unauthorized" }
  }

  if (type !== "photo" && type !== "video") {
    return { uploadUrl: null, error: "Invalid upload type" }
  }

  if (size > MAX_BYTES[type]) {
    return { uploadUrl: null, error: `File too large. Max ${MAX_BYTES[type] / 1024 / 1024} MB.` }
  }

  const expectedPrefix = type === "photo" ? "image/" : "video/"
  if (!mimeType.startsWith(expectedPrefix)) {
    return { uploadUrl: null, error: "Invalid file type" }
  }

  const { drive, sharedDriveId } = getDriveClient()
  const accessToken = await getDriveAccessToken()
  const ext = filename.split(".").pop() ?? (type === "photo" ? "jpg" : "mp4")
  const driveFilename = buildFilename(meta, type, ext)
  const targetFolderId = await findOrCreateFolder(drive, sharedDriveId, "SYSTEM_TRASH", sharedDriveId)

  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": mimeType,
        "X-Upload-Content-Length": String(size),
      },
      body: JSON.stringify({
        name: driveFilename,
        parents: [targetFolderId],
      }),
    },
  )

  if (!response.ok) {
    const message = await response.text().catch(() => "")
    console.error("[createDriveUploadSession] Google Drive session error:", message)
    return { uploadUrl: null, error: "Could not start Google Drive upload." }
  }

  const uploadUrl = response.headers.get("location")
  if (!uploadUrl) {
    return { uploadUrl: null, error: "Google Drive did not return an upload URL." }
  }

  return { uploadUrl, error: null }
}

export async function completeDriveUpload(fileId: string): Promise<{ url: string | null; error: string | null }> {
  const { profile } = await requireAuth()
  if (!isAdminRole(profile.role) && !isStaffRole(profile.role)) {
    return { url: null, error: "Unauthorized" }
  }

  if (!fileId.trim()) {
    return { url: null, error: "Missing Google Drive file ID." }
  }

  const { drive, sharedDriveId } = getDriveClient()
  const stagingFolderId = await findOrCreateFolder(drive, sharedDriveId, "SYSTEM_TRASH", sharedDriveId)
  const { data: fileData } = await drive.files.get({
    fileId,
    fields: "id,parents,driveId,trashed",
    supportsAllDrives: true,
  })

  if (
    fileData.trashed ||
    fileData.driveId !== sharedDriveId ||
    !fileData.parents?.includes(stagingFolderId)
  ) {
    return { url: null, error: "Invalid Google Drive upload file." }
  }

  await drive.permissions.create({
    fileId,
    requestBody: { role: "reader", type: "anyone" },
    supportsAllDrives: true,
  })

  return {
    url: `https://drive.google.com/file/d/${fileId}/view`,
    error: null,
  }
}

export async function getDriveThumbnail(fileId: string): Promise<{
  body: ArrayBuffer
  contentType: string
} | null> {
  if (!fileId.trim()) return null

  const { drive } = getDriveClient()
  const { data: file } = await drive.files.get({
    fileId,
    fields: "thumbnailLink",
    supportsAllDrives: true,
  })

  if (!file.thumbnailLink) return null

  const accessToken = await getDriveAccessToken()
  const response = await fetch(file.thumbnailLink, {
    headers: {
      Accept: "image/avif,image/webp,image/*,*/*;q=0.8",
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  })

  const contentType = response.headers.get("content-type")
  const contentLength = Number(response.headers.get("content-length") ?? 0)
  if (
    !response.ok ||
    !contentType?.startsWith("image/") ||
    (Number.isFinite(contentLength) && contentLength > MAX_THUMBNAIL_BYTES)
  ) {
    return null
  }

  const body = await response.arrayBuffer()
  if (body.byteLength > MAX_THUMBNAIL_BYTES) return null

  return { body, contentType }
}

export async function moveFileToSystemTrash(fileId: string): Promise<void> {
  const { drive, sharedDriveId } = getDriveClient()
  const trashFolderId = await findOrCreateFolder(drive, sharedDriveId, "SYSTEM_TRASH", sharedDriveId)

  const { data: fileData } = await drive.files.get({
    fileId,
    fields: "parents",
    supportsAllDrives: true,
  })

  const previousParents = fileData.parents?.join(",") || ""

  await drive.files.update({
    fileId,
    addParents: trashFolderId,
    removeParents: previousParents,
    supportsAllDrives: true,
  })
}

/**
 * Moves dynamic file IDs out of the central SYSTEM_TRASH staging folder
 * and places them into the correct Country/Year folder array on form submission save.
 */
export async function commitStagedFilesToCountry(countryName: string, fileIds: string[]): Promise<void> {
  if (!fileIds || fileIds.length === 0) return

  try {
    const { drive, sharedDriveId } = getDriveClient()
    
    // Resolve standard core target location maps: Root -> Country -> Year
    const year = new Date().getFullYear().toString()
    const country = countryName ? sanitize(countryName) : "Unknown"
    const countryFolderId = await findOrCreateFolder(drive, sharedDriveId, country, sharedDriveId)
    const targetFolderId = await findOrCreateFolder(drive, sharedDriveId, year, countryFolderId)

    for (const fileId of fileIds) {
      const { data: fileData } = await drive.files.get({
        fileId,
        fields: "parents",
        supportsAllDrives: true,
      })

      const previousParents = fileData.parents?.join(",") || ""

      // Atomic parent inversion migration swap out of SYSTEM_TRASH staging
      await drive.files.update({
        fileId,
        addParents: targetFolderId,
        removeParents: previousParents,
        supportsAllDrives: true,
      })
    }
  } catch (error) {
    console.error("Failed to commit staged files out of garbage staging to target destination:", error)
  }
}
