// Shared constants for the private face lookup feature. Importable from both
// client and server code — keep this file free of browser or Node APIs.

/** Identifies the embedding model that produced a stored template. Bump this
 *  whenever the descriptor model (faceres) or its preprocessing changes in a
 *  way that makes old vectors incomparable; stale templates are then re-queued
 *  by the admin backfill instead of silently mismatching. */
export const FACE_MODEL_VERSION = 'human-faceres-1024-v1'

// Embedding length and per-face quality gates live beside the validation
// logic (./validation is kept import-free so node --test can run it); they
// are re-exported here so the app has one tuning point.
export {
  FACE_EMBEDDING_LENGTH,
  FACE_MAX_ROTATION_RAD,
  FACE_MIN_BOX_PX,
  FACE_MIN_DETECTION_SCORE,
  FACE_MIN_MESH_SCORE,
} from './validation'

/** Where the self-hosted Human model files are served from (see public/models/human). */
export const FACE_MODEL_BASE_PATH = '/models/human'

/** Max candidates the match RPC returns; the DB function also enforces this. */
export const FACE_MATCH_MAX_CANDIDATES = 3

/** Longest edge an input image is downscaled to before detection. */
export const FACE_MAX_INPUT_EDGE_PX = 1600

// --- Match routing thresholds (exact L2 distance, lower = closer) ------------
// PLACEHOLDERS pending calibration with authorized alternate photos (kept out
// of the repo). Direct opening stays disabled until that set produces zero
// false automatic matches.

/** Feature gate: never auto-open a profile until calibration signs off. */
export const FACE_DIRECT_OPEN_ENABLED = false

/** Best-match distance at or below which a single profile may open directly. */
export const FACE_DIRECT_MAX_DISTANCE = 0.9

/** Required distance gap between the best and second-best match for direct open. */
export const FACE_DIRECT_MIN_MARGIN = 0.15

/** Candidates farther than this are hidden from the results list. Deliberately
 *  permissive until calibrated — the RPC already caps results at three. */
export const FACE_CANDIDATE_MAX_DISTANCE = Number.POSITIVE_INFINITY
