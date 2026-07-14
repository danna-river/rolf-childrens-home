import 'server-only'

import { google } from 'googleapis'

export type MobileDriveMeta = {
  idRolf: string | null
  firstName: string | null
  lastName: string | null
  country: string
}

export type MobileMediaType = 'photo' | 'video'

const MAX_BYTES = {
  photo: 15 * 1024 * 1024,
  video: 50 * 1024 * 1024,
}
const MAX_CHUNK_BYTES = 4 * 1024 * 1024
const DRIVE_UPLOAD_HOST = 'www.googleapis.com'

function getDriveClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n')
  const sharedDriveId = process.env.GOOGLE_SHARED_DRIVE_ID

  if (!email || !key || !sharedDriveId) {
    throw new Error('Missing Google Drive environment variables')
  }

  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: email, private_key: key },
    scopes: ['https://www.googleapis.com/auth/drive'],
  })

  return { drive: google.drive({ version: 'v3', auth }), sharedDriveId }
}

async function getDriveAccessToken() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (!email || !key) {
    throw new Error('Missing Google Drive environment variables')
  }

  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: email, private_key: key },
    scopes: ['https://www.googleapis.com/auth/drive'],
  })

  const client = await auth.getClient()
  const accessToken = await client.getAccessToken()
  const token = typeof accessToken === 'string' ? accessToken : accessToken?.token
  if (!token) throw new Error('Could not obtain Google Drive upload token')

  return token
}

function sanitize(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9]/g, '_')
}

function buildFilename(meta: MobileDriveMeta, type: MobileMediaType, originalFilename: string): string {
  const extension = originalFilename.split('.').pop() ?? (type === 'photo' ? 'jpg' : 'mp4')
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const parts = [
    meta.idRolf ? sanitize(meta.idRolf) : null,
    meta.lastName ? sanitize(meta.lastName) : null,
    meta.firstName ? sanitize(meta.firstName) : null,
    type,
    `${date}-${Date.now()}`,
  ].filter(Boolean)

  return `${parts.join('_')}.${extension.toLowerCase()}`
}

async function findOrCreateFolder(
  drive: ReturnType<typeof google.drive>,
  sharedDriveId: string,
  name: string,
  parentId: string,
): Promise<string> {
  const { data } = await drive.files.list({
    q: `name = '${name.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and '${parentId}' in parents and trashed = false`,
    fields: 'files(id)',
    spaces: 'drive',
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
    corpora: 'drive',
    driveId: sharedDriveId,
  })

  if (data.files?.[0]?.id) return data.files[0].id

  const { data: created } = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    fields: 'id',
    supportsAllDrives: true,
  })

  if (!created.id) throw new Error('Google Drive did not create the target folder.')
  return created.id
}

function validateMedia(type: MobileMediaType, mimeType: string, size: number) {
  if (!Number.isSafeInteger(size) || size < 1 || size > MAX_BYTES[type]) {
    throw new Error(`File exceeds the ${MAX_BYTES[type] / 1024 / 1024} MB ${type} limit.`)
  }

  const expectedPrefix = type === 'photo' ? 'image/' : 'video/'
  if (!mimeType.startsWith(expectedPrefix)) throw new Error('Invalid media MIME type.')
}

/** Creates a private Drive resumable session. Its URL is retained only by this backend. */
export async function createMobileDriveUploadSession(input: {
  type: MobileMediaType
  filename: string
  mimeType: string
  size: number
  meta: MobileDriveMeta
}): Promise<string> {
  validateMedia(input.type, input.mimeType, input.size)

  const { drive, sharedDriveId } = getDriveClient()
  const accessToken = await getDriveAccessToken()
  const stagingFolderId = await findOrCreateFolder(drive, sharedDriveId, 'SYSTEM_TRASH', sharedDriveId)
  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': input.mimeType,
        'X-Upload-Content-Length': String(input.size),
      },
      body: JSON.stringify({
        name: buildFilename(input.meta, input.type, input.filename),
        parents: [stagingFolderId],
      }),
    },
  )

  if (!response.ok) {
    console.error('[mobile-drive] session creation failed:', response.status, await response.text().catch(() => ''))
    throw new Error('Could not start the Google Drive upload.')
  }

  const uploadUrl = response.headers.get('location')
  if (!uploadUrl) throw new Error('Google Drive did not return an upload session.')
  return uploadUrl
}

function isValidDriveUploadUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return (
      url.protocol === 'https:' &&
      url.hostname === DRIVE_UPLOAD_HOST &&
      url.pathname.startsWith('/upload/drive/') &&
      url.searchParams.get('uploadType') === 'resumable' &&
      url.searchParams.has('upload_id')
    )
  } catch {
    return false
  }
}

function parseDriveRange(value: string | null): number | null {
  const match = /^bytes[= ](\d+)-(\d+)$/.exec(value ?? '')
  if (!match) return null
  const end = Number(match[2])
  return Number.isSafeInteger(end) ? end + 1 : null
}

export type MobileDriveChunkResult =
  | { done: false; nextOffset: number; uploadUrl: string }
  | { done: true; fileId: string; uploadUrl: string }

/** Proxies one strictly validated resumable chunk to the private Drive session. */
export async function uploadMobileDriveChunk(input: {
  uploadUrl: string
  mimeType: string
  totalBytes: number
  start: number
  end: number
  body: Buffer
}): Promise<MobileDriveChunkResult> {
  if (!isValidDriveUploadUrl(input.uploadUrl)) throw new Error('Invalid Google Drive upload session.')
  if (
    !Number.isSafeInteger(input.start) ||
    !Number.isSafeInteger(input.end) ||
    input.start < 0 ||
    input.end < input.start ||
    input.end >= input.totalBytes ||
    input.body.byteLength !== input.end - input.start + 1 ||
    input.body.byteLength > MAX_CHUNK_BYTES
  ) {
    throw new Error('Invalid upload range.')
  }

  const isFinalChunk = input.end === input.totalBytes - 1
  if (!isFinalChunk && input.body.byteLength % (256 * 1024) !== 0) {
    throw new Error('Non-final upload chunks must be a multiple of 256 KiB.')
  }

  const response = await fetch(input.uploadUrl, {
    method: 'PUT',
    redirect: 'manual',
    headers: {
      'Content-Type': input.mimeType,
      'Content-Length': String(input.body.byteLength),
      'Content-Range': `bytes ${input.start}-${input.end}/${input.totalBytes}`,
    },
    body: input.body as unknown as BodyInit,
  })

  const uploadUrl = response.headers.get('location') ?? input.uploadUrl
  if (response.status === 308) {
    const nextOffset = parseDriveRange(response.headers.get('range'))
    if (nextOffset === null || nextOffset < input.start || nextOffset > input.end + 1) {
      throw new Error('Google Drive returned an invalid upload range.')
    }
    return { done: false, nextOffset, uploadUrl }
  }

  if (response.status === 200 || response.status === 201) {
    const result = await response.json().catch(() => null) as { id?: string } | null
    if (!result?.id) throw new Error('Google Drive did not return a file ID.')
    return { done: true, fileId: result.id, uploadUrl }
  }

  console.error('[mobile-drive] chunk upload failed:', response.status, await response.text().catch(() => ''))
  throw new Error('Google Drive rejected the upload chunk.')
}

/** Verifies the staged Drive file and grants the existing public reader policy. */
export async function completeMobileDriveUpload(fileId: string): Promise<string> {
  if (!fileId.trim()) throw new Error('Missing Google Drive file ID.')

  const { drive, sharedDriveId } = getDriveClient()
  const stagingFolderId = await findOrCreateFolder(drive, sharedDriveId, 'SYSTEM_TRASH', sharedDriveId)
  const { data: file } = await drive.files.get({
    fileId,
    fields: 'id,parents,driveId,trashed',
    supportsAllDrives: true,
  })

  if (file.trashed || file.driveId !== sharedDriveId || !file.parents?.includes(stagingFolderId)) {
    throw new Error('The uploaded Drive file is not in the approved staging folder.')
  }

  await drive.permissions.create({
    fileId,
    requestBody: { role: 'reader', type: 'anyone' },
    supportsAllDrives: true,
  })

  return `https://drive.google.com/file/d/${fileId}/view`
}

/** Moves a verified staged file into its country/year folder without exposing Drive credentials. */
export async function commitMobileDriveUpload(countryName: string, fileId: string): Promise<void> {
  const { drive, sharedDriveId } = getDriveClient()
  const countryFolderId = await findOrCreateFolder(drive, sharedDriveId, sanitize(countryName), sharedDriveId)
  const yearFolderId = await findOrCreateFolder(drive, sharedDriveId, String(new Date().getFullYear()), countryFolderId)
  const { data: file } = await drive.files.get({
    fileId,
    fields: 'parents',
    supportsAllDrives: true,
  })

  if (file.parents?.includes(yearFolderId)) return

  await drive.files.update({
    fileId,
    addParents: yearFolderId,
    removeParents: file.parents?.join(',') ?? '',
    supportsAllDrives: true,
  })
}
