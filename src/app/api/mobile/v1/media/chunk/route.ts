import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  authenticateMobileDevice,
  MobileApiError,
  mobileErrorResponse,
  mobileJson,
} from '@/app/api/mobile/v1/_lib/auth'
import { uploadMobileDriveChunk } from '@/lib/googleDriveMobile'

export const runtime = 'nodejs'
export const maxDuration = 60

const uploadIdSchema = z.string().uuid()
const MAX_CHUNK_BYTES = 4 * 1024 * 1024

function parseContentRange(value: string | null): { start: number; end: number; total: number } {
  const match = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(value ?? '')
  if (!match) throw new MobileApiError(400, 'invalid_content_range', 'The upload chunk has an invalid Content-Range header.')

  const [start, end, total] = match.slice(1).map(Number)
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    !Number.isSafeInteger(total) ||
    start < 0 ||
    end < start ||
    total <= 0 ||
    end >= total
  ) {
    throw new MobileApiError(400, 'invalid_content_range', 'The upload chunk has an invalid Content-Range header.')
  }

  return { start, end, total }
}

/** Receives one binary chunk. Device and upload IDs travel in headers, never in the media bytes. */
export async function POST(request: NextRequest) {
  try {
    const uploadId = uploadIdSchema.parse(request.headers.get('x-rolf-upload-id'))
    const context = await authenticateMobileDevice(request)
    const range = parseContentRange(request.headers.get('content-range'))
    const contentType = request.headers.get('content-type')?.split(';', 1)[0].trim()
    if (!contentType) throw new MobileApiError(400, 'missing_content_type', 'The upload chunk needs a Content-Type header.')

    const body = Buffer.from(await request.arrayBuffer())
    const expectedBytes = range.end - range.start + 1
    if (body.byteLength !== expectedBytes || body.byteLength > MAX_CHUNK_BYTES) {
      throw new MobileApiError(400, 'invalid_chunk_size', 'The upload chunk length does not match its range.')
    }

    const admin = createAdminClient()
    const { data: upload, error: uploadError } = await admin
      .from('mobile_media_uploads')
      .select('*')
      .eq('id', uploadId)
      .eq('device_id', context.device.id)
      .eq('user_id', context.userId)
      .maybeSingle()
    if (uploadError) throw new Error(`Could not read mobile media upload: ${uploadError.message}`)
    if (!upload) throw new MobileApiError(404, 'upload_not_found', 'The media upload was not found for this device.')
    if (Date.parse(upload.expires_at) <= Date.now()) throw new MobileApiError(410, 'upload_expired', 'The media upload session has expired.')
    if (upload.mime_type !== contentType || range.total !== upload.total_bytes) {
      throw new MobileApiError(400, 'upload_metadata_mismatch', 'The upload chunk does not match its session metadata.')
    }
    if (upload.status === 'completed' || upload.status === 'uploaded') {
      return mobileJson({ upload_id: upload.id, done: true, file_id: upload.gdrive_file_id, next_offset: upload.total_bytes })
    }
    if (upload.status !== 'uploading') throw new MobileApiError(409, 'upload_not_writable', 'This upload cannot accept more chunks.')

    if (range.start < upload.uploaded_bytes) {
      return mobileJson({ upload_id: upload.id, done: false, next_offset: upload.uploaded_bytes })
    }
    if (range.start !== upload.uploaded_bytes) {
      throw new MobileApiError(409, 'unexpected_chunk_offset', 'The chunk does not begin at the expected upload offset.')
    }

    const driveResult = await uploadMobileDriveChunk({
      uploadUrl: upload.drive_upload_url,
      mimeType: upload.mime_type,
      totalBytes: upload.total_bytes,
      start: range.start,
      end: range.end,
      body,
    })
    const nextOffset = driveResult.done ? upload.total_bytes : driveResult.nextOffset
    const { error: updateError } = await admin
      .from('mobile_media_uploads')
      .update({
        uploaded_bytes: nextOffset,
        drive_upload_url: driveResult.uploadUrl,
        gdrive_file_id: driveResult.done ? driveResult.fileId : null,
        status: driveResult.done ? 'uploaded' : 'uploading',
        updated_at: new Date().toISOString(),
      })
      .eq('id', upload.id)
    if (updateError) throw new Error(`Could not save upload progress: ${updateError.message}`)

    return mobileJson({
      upload_id: upload.id,
      done: driveResult.done,
      next_offset: nextOffset,
      ...(driveResult.done ? { file_id: driveResult.fileId } : {}),
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return mobileJson({ error: { code: 'invalid_upload_id', message: 'The upload ID is invalid.' } }, { status: 400 })
    }
    return mobileErrorResponse(error)
  }
}
