// Pure validation logic for face capture and embeddings. Deliberately
// dependency-free (no browser, Human, or even local imports) so `node --test`
// can load it directly and it stays safe to share between client and server.
// The constants below are re-exported from ./config, the import point for the
// rest of the app.

/** faceres descriptor length. Must match vector(1024) in child_face_templates. */
export const FACE_EMBEDDING_LENGTH = 1024

// --- Quality gates applied before an embedding is accepted -------------------
// Guided by the Human embedding guide: reject small, low-confidence, or
// strongly rotated faces rather than storing/searching a weak descriptor.

/** Minimum detector confidence (FaceResult.boxScore). */
export const FACE_MIN_DETECTION_SCORE = 0.5

/** Minimum mesh confidence (FaceResult.faceScore). */
export const FACE_MIN_MESH_SCORE = 0.4

/** Minimum face box edge, in source pixels. */
export const FACE_MIN_BOX_PX = 64

/** Max |roll|/|yaw|/|pitch| in radians (~30°) before a face counts as too rotated. */
export const FACE_MAX_ROTATION_RAD = 0.52

/** Why a capture produced no usable embedding. Also decides enrollment status:
 *  every one of these marks the profile photo 'unsearchable' (still a valid
 *  photo — it just cannot participate in face search). */
export type FaceCaptureIssue = 'no-face' | 'multiple-faces' | 'low-quality'

export type FaceExtraction =
  | { ok: true; embedding: number[] }
  | { ok: false; reason: FaceCaptureIssue }

/** The slice of Human's FaceResult the quality gates need. */
export interface DetectedFaceQuality {
  /** Detector confidence (FaceResult.boxScore). */
  boxScore: number
  /** Mesh confidence (FaceResult.faceScore). */
  faceScore: number
  /** Face box size in source pixels. */
  boxWidth: number
  boxHeight: number
  /** Head pose in radians; null/undefined when rotation could not be computed. */
  rotation?: { roll: number; yaw: number; pitch: number } | null
  embedding?: number[] | Float32Array
}

/** True for a well-formed descriptor: exactly 1024 finite numbers. */
export function isValidFaceEmbedding(value: unknown): value is number[] {
  return (
    Array.isArray(value)
    && value.length === FACE_EMBEDDING_LENGTH
    && value.every((entry) => typeof entry === 'number' && Number.isFinite(entry))
  )
}

/** True when the face is clear, large, and forward-facing enough to match on. */
export function isUsableFace(face: DetectedFaceQuality): boolean {
  if (face.boxScore < FACE_MIN_DETECTION_SCORE) return false
  if (face.faceScore < FACE_MIN_MESH_SCORE) return false
  if (face.boxWidth < FACE_MIN_BOX_PX || face.boxHeight < FACE_MIN_BOX_PX) return false

  const angle = face.rotation
  if (!angle) return false
  if (
    Math.abs(angle.roll) > FACE_MAX_ROTATION_RAD
    || Math.abs(angle.yaw) > FACE_MAX_ROTATION_RAD
    || Math.abs(angle.pitch) > FACE_MAX_ROTATION_RAD
  ) {
    return false
  }

  return true
}

/** Reduce a detection pass to one embedding, or the reason there isn't one.
 *  Requires exactly one detected face that also clears every quality gate —
 *  a second face in frame is rejected outright so a bystander can never be
 *  matched or enrolled by accident. */
export function assessFaceDetection(faces: DetectedFaceQuality[]): FaceExtraction {
  if (faces.length === 0) return { ok: false, reason: 'no-face' }
  if (faces.length > 1) return { ok: false, reason: 'multiple-faces' }

  const face = faces[0]
  if (!isUsableFace(face)) return { ok: false, reason: 'low-quality' }

  const embedding = face.embedding ? Array.from(face.embedding) : []
  if (!isValidFaceEmbedding(embedding)) return { ok: false, reason: 'low-quality' }

  return { ok: true, embedding }
}
