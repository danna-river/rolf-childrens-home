"use server"
import { google } from "googleapis"
import { Readable } from "stream"

export type ChildMeta = {
  idRolf: string | null
  firstName: string | null
  lastName: string | null
  country: string | null
  folderOverride?: string
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