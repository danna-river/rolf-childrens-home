// Browser-only wrapper around @vladmandic/human. The library (and its
// bundled tfjs) is loaded lazily via dynamic import so it never enters the
// server bundle or any route that doesn't use face search/enrollment.
// Model files are self-hosted under public/models/human — no CDN calls.
//
// Privacy: everything here runs on the staff device. Query photos and camera
// frames are drawn onto a local canvas, reduced to a 1024-value descriptor,
// and discarded — they are never uploaded, stored, or logged.

import type { Human, Config } from '@vladmandic/human'
import { FACE_MAX_INPUT_EDGE_PX, FACE_MODEL_BASE_PATH } from './config'
import { assessFaceDetection, type DetectedFaceQuality, type FaceExtraction } from './validation'

/** Thrown when the models cannot load or inference itself fails. Distinct from
 *  a "no usable face" outcome: callers must NOT mark a photo unsearchable on
 *  this error — the photo was never actually analyzed. */
export class FaceEngineError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'FaceEngineError'
  }
}

const HUMAN_CONFIG: Partial<Config> = {
  modelBasePath: FACE_MODEL_BASE_PATH,
  // Equalize the detected face crop before description, per the Human
  // embedding guide — helps with under/over-exposed field photos.
  filter: { enabled: true, equalization: true },
  face: {
    enabled: true,
    // maxDetected > 1 so a second person in frame is seen (and rejected).
    detector: { rotation: true, maxDetected: 5, minConfidence: 0.2 },
    mesh: { enabled: true },
    iris: { enabled: true },
    description: { enabled: true },
    attention: { enabled: false },
    emotion: { enabled: false },
    antispoof: { enabled: false },
    liveness: { enabled: false },
  },
  body: { enabled: false },
  hand: { enabled: false },
  object: { enabled: false },
  gesture: { enabled: false },
  segmentation: { enabled: false },
}

let humanPromise: Promise<Human> | null = null

/** Load Human + the self-hosted models once per session. */
function getHuman(): Promise<Human> {
  if (typeof window === 'undefined') {
    return Promise.reject(new FaceEngineError('Face engine is browser-only'))
  }
  if (!humanPromise) {
    humanPromise = (async () => {
      try {
        const { default: HumanCtor } = await import('@vladmandic/human')
        const human = new HumanCtor(HUMAN_CONFIG)
        await human.load()
        return human
      } catch (cause) {
        humanPromise = null // allow a retry after a transient network failure
        throw new FaceEngineError('Failed to load the face models', { cause })
      }
    })()
  }
  return humanPromise
}

/** Draw an image/video frame onto a plain canvas, downscaled so its longest
 *  edge is at most FACE_MAX_INPUT_EDGE_PX. Keeps detection memory predictable
 *  regardless of source resolution. */
function toDetectionCanvas(
  source: HTMLVideoElement | ImageBitmap,
): HTMLCanvasElement {
  const sourceWidth = source instanceof HTMLVideoElement ? source.videoWidth : source.width
  const sourceHeight = source instanceof HTMLVideoElement ? source.videoHeight : source.height
  if (!sourceWidth || !sourceHeight) {
    throw new FaceEngineError('Capture source has no pixels')
  }

  const scale = Math.min(1, FACE_MAX_INPUT_EDGE_PX / Math.max(sourceWidth, sourceHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(sourceWidth * scale))
  canvas.height = Math.max(1, Math.round(sourceHeight * scale))

  const context = canvas.getContext('2d')
  if (!context) throw new FaceEngineError('Canvas 2D context unavailable')
  context.drawImage(source, 0, 0, canvas.width, canvas.height)
  return canvas
}

async function detectOnCanvas(canvas: HTMLCanvasElement): Promise<FaceExtraction> {
  const human = await getHuman()

  let faces: DetectedFaceQuality[]
  try {
    const result = await human.detect(canvas)
    faces = result.face.map((face) => ({
      boxScore: face.boxScore,
      faceScore: face.faceScore,
      boxWidth: face.box[2],
      boxHeight: face.box[3],
      rotation: face.rotation?.angle ?? null,
      embedding: face.embedding,
    }))
  } catch (cause) {
    throw new FaceEngineError('Face detection failed', { cause })
  }

  return assessFaceDetection(faces)
}

/** Extract one embedding from an image file/blob (photo upload, or bytes from
 *  the authenticated media proxy). The pixels never leave this function. */
export async function extractFaceEmbeddingFromBlob(blob: Blob): Promise<FaceExtraction> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(blob)
  } catch {
    // Undecodable bytes (corrupt file, unsupported format) — treat as an
    // analyzable photo without a face rather than an engine failure.
    return { ok: false, reason: 'no-face' }
  }

  try {
    return await detectOnCanvas(toDetectionCanvas(bitmap))
  } finally {
    bitmap.close()
  }
}

/** Extract one embedding from the current frame of a live camera preview. */
export async function extractFaceEmbeddingFromVideoFrame(
  video: HTMLVideoElement,
): Promise<FaceExtraction> {
  return detectOnCanvas(toDetectionCanvas(video))
}

/** Warm the model cache in the background (e.g. when the search dialog opens)
 *  so the first capture doesn't stall. Errors are deferred to the first real
 *  extraction, which reports them properly. */
export function preloadFaceEngine(): void {
  void getHuman().catch(() => {})
}
