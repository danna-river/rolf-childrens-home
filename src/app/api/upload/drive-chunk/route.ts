import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { isAdminRole, isStaffRole } from "@/lib/profiles"

export const runtime = "nodejs"
export const maxDuration = 60

const MAX_CHUNK_BYTES = 4 * 1024 * 1024
const MAX_FILE_BYTES = 50 * 1024 * 1024
const DRIVE_UPLOAD_HOST = "www.googleapis.com"

function isValidDriveUploadUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return (
      url.protocol === "https:" &&
      url.hostname === DRIVE_UPLOAD_HOST &&
      url.pathname.startsWith("/upload/drive/") &&
      url.searchParams.get("uploadType") === "resumable" &&
      url.searchParams.has("upload_id")
    )
  } catch {
    return false
  }
}

function parseContentRange(value: string | null): {
  start: number
  end: number
  total: number
} | null {
  const match = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(value ?? "")
  if (!match) return null

  const start = Number(match[1])
  const end = Number(match[2])
  const total = Number(match[3])

  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    !Number.isSafeInteger(total) ||
    start < 0 ||
    end < start ||
    total <= 0 ||
    total > MAX_FILE_BYTES ||
    end >= total
  ) {
    return null
  }

  return { start, end, total }
}

function parseDriveRange(value: string | null): number | null {
  const match = /^bytes[= ](\d+)-(\d+)$/.exec(value ?? "")
  if (!match) return null
  const end = Number(match[2])
  return Number.isSafeInteger(end) ? end + 1 : null
}

export async function POST(request: NextRequest) {
  const { profile } = await requireAuth()
  if (!isAdminRole(profile.role) && !isStaffRole(profile.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const uploadUrl = request.headers.get("x-drive-upload-url")
  if (!uploadUrl || !isValidDriveUploadUrl(uploadUrl)) {
    return NextResponse.json({ error: "Invalid Google Drive upload session." }, { status: 400 })
  }

  const range = parseContentRange(request.headers.get("content-range"))
  if (!range) {
    return NextResponse.json({ error: "Invalid upload range." }, { status: 400 })
  }

  const expectedBytes = range.end - range.start + 1
  if (expectedBytes > MAX_CHUNK_BYTES) {
    return NextResponse.json({ error: "Upload chunk is too large." }, { status: 413 })
  }

  const isFinalChunk = range.end === range.total - 1
  if (!isFinalChunk && expectedBytes % (256 * 1024) !== 0) {
    return NextResponse.json({ error: "Upload chunk has an invalid size." }, { status: 400 })
  }

  const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim()
  if (!contentType || (!contentType.startsWith("image/") && !contentType.startsWith("video/"))) {
    return NextResponse.json({ error: "Invalid media type." }, { status: 400 })
  }

  const body = Buffer.from(await request.arrayBuffer())
  if (body.byteLength !== expectedBytes) {
    return NextResponse.json({ error: "Upload chunk length does not match its range." }, { status: 400 })
  }

  const driveResponse = await fetch(uploadUrl, {
    method: "PUT",
    redirect: "manual",
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(body.byteLength),
      "Content-Range": `bytes ${range.start}-${range.end}/${range.total}`,
    },
    body,
  })

  const nextUploadUrl = driveResponse.headers.get("location") ?? uploadUrl
  if (driveResponse.status === 308) {
    const nextOffset = parseDriveRange(driveResponse.headers.get("range"))
    if (
      nextOffset === null ||
      nextOffset < range.start ||
      nextOffset > range.end + 1
    ) {
      return NextResponse.json({ error: "Google Drive returned an invalid upload range." }, { status: 502 })
    }

    return NextResponse.json({
      done: false,
      nextOffset,
      uploadUrl: nextUploadUrl,
    })
  }

  if (driveResponse.status === 200 || driveResponse.status === 201) {
    const result = await driveResponse.json().catch(() => null) as { id?: string } | null
    if (!result?.id) {
      return NextResponse.json({ error: "Google Drive did not return a file ID." }, { status: 502 })
    }

    return NextResponse.json({ done: true, fileId: result.id, uploadUrl: nextUploadUrl })
  }

  console.error(
    "[drive-chunk] Google Drive upload failed:",
    driveResponse.status,
    await driveResponse.text().catch(() => ""),
  )
  return NextResponse.json({ error: "Google Drive upload failed." }, { status: 502 })
}
