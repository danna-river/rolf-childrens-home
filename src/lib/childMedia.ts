// Hybrid child-media helpers. The `profile_photo` and `profile_video` fields in the
// children table now hold strict UUID foreign key references to rows in 'child_media'.
// Once your server data layers pull and flatten those relational entries into raw text 
// URL strings, these pure functions detect Drive links and turn them into renderable URLs:
//   - photos  → a thumbnail image URL usable in <img>
//   - videos  → an iframe preview URL (Drive video links cannot play in <video>)
// Anything that isn't a Drive link is returned untouched so direct storage bucket links 
// keep working exactly as before.

const DRIVE_HOSTS = ['drive.google.com', 'drive.usercontent.google.com']

/** True when the URL points at Google Drive. */
export function isGoogleDriveUrl(url: string | null | undefined): boolean {
  if (!url) return false
  try {
    const { hostname } = new URL(url)
    return DRIVE_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`))
  } catch {
    return false
  }
}

/**
 * Pull the file ID out of the common Drive link formats:
 *   - https://drive.google.com/file/d/FILE_ID/view
 *   - https://drive.google.com/open?id=FILE_ID
 *   - https://drive.google.com/uc?id=FILE_ID
 *   - https://drive.google.com/thumbnail?id=FILE_ID
 * Returns null if no ID can be found.
 */
export function extractDriveFileId(url: string | null | undefined): string | null {
  if (!url) return null

  // /file/d/FILE_ID/... form
  const pathMatch = url.match(/\/file\/d\/([^/?#]+)/)
  if (pathMatch?.[1]) return pathMatch[1]

  // ?id=FILE_ID or &id=FILE_ID form
  const idMatch = url.match(/[?&]id=([^&#]+)/)
  if (idMatch?.[1]) return idMatch[1]

  return null
}

/** Drive image thumbnail URL, usable directly in an <img src>. */
export function getDrivePhotoThumbnail(fileId: string, size = 1000): string {
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w${size}`
}

/** Drive iframe preview URL, usable in an <iframe src> for video playback. */
export function getDriveVideoPreview(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/preview`
}

/**
 * Resolve a stored photo URL into something an <img> can render.
 * Drive links become thumbnails; uploaded URLs pass through unchanged.
 */
export function resolvePhotoSrc(
  url: string | null | undefined,
  size = 1000,
): string | null {
  if (!url) return null
  if (isGoogleDriveUrl(url)) {
    const fileId = extractDriveFileId(url)
    return fileId ? getDrivePhotoThumbnail(fileId, size) : url
  }
  return url
}

export type ResolvedVideo =
  | { kind: 'none' }
  | { kind: 'file'; src: string }
  | { kind: 'drive'; src: string }

/**
 * Resolve a stored video URL into a render strategy.
 *   - 'drive' → render an <iframe src> (Drive videos can't use <video>)
 *   - 'file'  → render a normal <video src controls>
 *   - 'none'  → no video / unrecognized Drive link, show empty state
 */
export function resolveVideo(url: string | null | undefined): ResolvedVideo {
  if (!url) return { kind: 'none' }
  if (isGoogleDriveUrl(url)) {
    const fileId = extractDriveFileId(url)
    return fileId ? { kind: 'drive', src: getDriveVideoPreview(fileId) } : { kind: 'none' }
  }
  return { kind: 'file', src: url }
}

/** Shared helper text shown beside Drive link inputs. */
export const DRIVE_SHARE_HINT =
  'Google Drive files must be shared with anyone who has the link.'

/** Drive video thumbnail image preview URL, usable directly in an <img src>. */
export function resolveVideoThumbnail(url: string | null | undefined, size = 1000): string | null {
  if (!url) return null
  if (isGoogleDriveUrl(url)) {
    const fileId = extractDriveFileId(url)
    return fileId ? `https://drive.google.com/thumbnail?id=${fileId}&sz=w${size}` : null
  }
  return null // Return null if it's a generic bucket stream without native thumbnail hooks
}