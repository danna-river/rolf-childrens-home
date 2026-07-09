import { NextRequest } from "next/server"
import { requireAuth } from "@/lib/auth"
import { getDriveThumbnail } from "@/lib/googleDrive"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ mediaId: string }> },
) {
  const { mediaId } = await params
  if (!UUID_PATTERN.test(mediaId)) {
    return new Response(null, { status: 404 })
  }

  await requireAuth()
  const supabase = await createClient()
  const { data: media } = await supabase
    .from("child_media")
    .select("gdrive_file_id")
    .eq("id", mediaId)
    .maybeSingle()

  // The normal authenticated Supabase client keeps this check subject to the
  // existing child_media RLS policies for donors, staff, and administrators.
  if (!media) {
    return new Response(null, { status: 404 })
  }

  try {
    const thumbnail = await getDriveThumbnail(media.gdrive_file_id)
    if (!thumbnail) {
      return new Response(null, { status: 502 })
    }

    return new Response(thumbnail.body, {
      headers: {
        "Cache-Control": "private, max-age=300",
        "Content-Type": thumbnail.contentType,
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch (error) {
    console.error("[media-thumbnail] Failed to retrieve Google Drive thumbnail:", error)
    return new Response(null, { status: 502 })
  }
}
