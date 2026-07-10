// Client-side enrollment pipeline shared by the new-child form, the edit form,
// and the admin backfill. All profile photos live behind the authenticated
// media proxy, so one flow covers direct uploads and Drive links alike:
//   1. resolve the child's current profile-photo media id (server action)
//   2. fetch its bytes through /api/media/[id]/thumbnail (cookie-authenticated)
//   3. run the face model locally and derive one embedding
//   4. save the template — or mark the photo unsearchable — via server action
// The photo bytes and embedding stay on this device except for step 4's
// write-only upsert.

import { getFaceEnrollmentTarget, saveFaceTemplate } from './actions'
import { extractFaceEmbeddingFromBlob, FaceEngineError } from './embedding'

export type FaceEnrollmentOutcome =
  /** Template stored — the child is now findable by face search. */
  | { status: 'enrolled' }
  /** Photo analyzed, no single usable face — recorded as unsearchable. */
  | { status: 'unsearchable' }
  /** Child currently has no profile photo — nothing to enroll. */
  | { status: 'no-photo' }
  /** Model load/inference or network failure. Nothing was recorded; the child
   *  stays in the admin backfill queue for a later retry. */
  | { status: 'failed'; message: string }

/** Enroll (or refresh) the face template for a child's current profile photo.
 *  Known media id can be passed to skip the lookup (backfill queue provides it). */
export async function enrollChildProfilePhoto(
  childId: string,
  knownMediaId?: string,
): Promise<FaceEnrollmentOutcome> {
  try {
    let mediaId = knownMediaId ?? null
    if (!mediaId) {
      const target = await getFaceEnrollmentTarget(childId)
      if (target.error) return { status: 'failed', message: target.error }
      if (!target.mediaId) return { status: 'no-photo' }
      mediaId = target.mediaId
    }

    const response = await fetch(`/api/media/${mediaId}/thumbnail`)
    if (!response.ok) {
      return { status: 'failed', message: `Could not load the profile photo (HTTP ${response.status}).` }
    }
    const photoBlob = await response.blob()

    const extraction = await extractFaceEmbeddingFromBlob(photoBlob)

    // A definitive "no usable face" verdict is recorded as unsearchable so the
    // backfill treats the child as done. Engine failures throw instead and are
    // reported without recording anything.
    const { error } = await saveFaceTemplate(
      childId,
      mediaId,
      extraction.ok ? extraction.embedding : null,
    )
    if (error) return { status: 'failed', message: error }

    return extraction.ok ? { status: 'enrolled' } : { status: 'unsearchable' }
  } catch (error) {
    const message = error instanceof FaceEngineError
      ? error.message
      : 'Face enrollment failed unexpectedly.'
    return { status: 'failed', message }
  }
}
