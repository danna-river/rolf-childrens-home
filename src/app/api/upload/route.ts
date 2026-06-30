import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { isAdminRole, isStaffRole } from "@/lib/profiles"
import { uploadToDrive, type ChildMeta } from "@/lib/googleDrive"

const MAX_BYTES = {
  photo: 15 * 1024 * 1024,
  video: 50 * 1024 * 1024,
}

// Hard ceiling before any body parsing — rejects oversized requests immediately.
const ABSOLUTE_MAX_BYTES = MAX_BYTES.video

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length") ?? 0)
  if (contentLength > ABSOLUTE_MAX_BYTES) {
    return NextResponse.json({ error: "Request too large." }, { status: 413 })
  }

  const { profile } = await requireAuth()
  if (!isAdminRole(profile.role) && !isStaffRole(profile.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const formData = await request.formData()
  const file = formData.get("file")
  const type = formData.get("type")

  if (!(file instanceof File) || (type !== "photo" && type !== "video")) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  if (file.size > MAX_BYTES[type]) {
    return NextResponse.json(
      { error: `File too large. Max ${MAX_BYTES[type] / 1024 / 1024} MB.` },
      { status: 400 },
    )
  }

  const meta: ChildMeta = {
    idRolf: formData.get("idRolf") as string | null,
    firstName: formData.get("firstName") as string | null,
    lastName: formData.get("lastName") as string | null,
    country: formData.get("country") as string | null,
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const { url } = await uploadToDrive(buffer, file.name, file.type, type, meta)

  return NextResponse.json({ url })
}
