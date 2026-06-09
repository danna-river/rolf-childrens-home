"use server"
import { createAdminClient } from "@/lib/supabase/admin"

// Requires a public Supabase Storage bucket named "children-media"
// Create it in: Supabase Dashboard → Storage → New bucket → "children-media" → Public
const BUCKET = "children-media"

export async function getUploadUrl(
  path: string,
): Promise<{ signedUrl: string | null; publicUrl: string | null; error: string | null }> {
  const supabase = createAdminClient()

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(path)

  if (error || !data) {
    return { signedUrl: null, publicUrl: null, error: error?.message ?? "Failed to create upload URL" }
  }

  const { data: publicData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(path)

  return { signedUrl: data.signedUrl, publicUrl: publicData.publicUrl, error: null }
}
