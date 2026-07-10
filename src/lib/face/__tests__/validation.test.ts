// Unit tests for the pure face-validation logic. Runs on plain Node:
//   npm run test:face   (node --test with native type stripping)
// Node's type stripping cannot resolve extensionless TS imports, so the
// module under test is loaded via an explicit file URL and typed with a
// type-only import (which tsc resolves through the bundler as usual).

import { test } from 'node:test'
import assert from 'node:assert/strict'

type ValidationModule = typeof import('../validation')

const validation: ValidationModule = await import(
  new URL('../validation.ts', import.meta.url).href
)

const {
  assessFaceDetection,
  isValidFaceEmbedding,
  isUsableFace,
  FACE_EMBEDDING_LENGTH,
  FACE_MAX_ROTATION_RAD,
  FACE_MIN_BOX_PX,
  FACE_MIN_DETECTION_SCORE,
  FACE_MIN_MESH_SCORE,
} = validation

type Face = Parameters<ValidationModule['assessFaceDetection']>[0][number]

function goodFace(overrides: Partial<Face> = {}): Face {
  return {
    boxScore: 0.9,
    faceScore: 0.9,
    boxWidth: 200,
    boxHeight: 220,
    rotation: { roll: 0.05, yaw: -0.1, pitch: 0.08 },
    embedding: new Array(FACE_EMBEDDING_LENGTH).fill(0.01),
    ...overrides,
  }
}

// --- isValidFaceEmbedding -----------------------------------------------------

test('accepts a well-formed 1024-value embedding', () => {
  assert.equal(isValidFaceEmbedding(new Array(FACE_EMBEDDING_LENGTH).fill(0.5)), true)
})

test('rejects non-arrays and empty values', () => {
  assert.equal(isValidFaceEmbedding(undefined), false)
  assert.equal(isValidFaceEmbedding(null), false)
  assert.equal(isValidFaceEmbedding('[1,2,3]'), false)
  assert.equal(isValidFaceEmbedding({}), false)
  assert.equal(isValidFaceEmbedding([]), false)
})

test('rejects wrong-length embeddings', () => {
  assert.equal(isValidFaceEmbedding(new Array(FACE_EMBEDDING_LENGTH - 1).fill(0.5)), false)
  assert.equal(isValidFaceEmbedding(new Array(FACE_EMBEDDING_LENGTH + 1).fill(0.5)), false)
})

test('rejects non-finite and non-numeric entries', () => {
  const withNaN = new Array<number>(FACE_EMBEDDING_LENGTH).fill(0.5)
  withNaN[17] = Number.NaN
  assert.equal(isValidFaceEmbedding(withNaN), false)

  const withInfinity = new Array<number>(FACE_EMBEDDING_LENGTH).fill(0.5)
  withInfinity[0] = Number.POSITIVE_INFINITY
  assert.equal(isValidFaceEmbedding(withInfinity), false)

  const withString = new Array<unknown>(FACE_EMBEDDING_LENGTH).fill(0.5)
  withString[3] = '0.5'
  assert.equal(isValidFaceEmbedding(withString), false)
})

// --- isUsableFace ---------------------------------------------------------------

test('accepts a clear, large, forward-facing face', () => {
  assert.equal(isUsableFace(goodFace()), true)
})

test('rejects low detector or mesh confidence', () => {
  assert.equal(isUsableFace(goodFace({ boxScore: FACE_MIN_DETECTION_SCORE - 0.01 })), false)
  assert.equal(isUsableFace(goodFace({ faceScore: FACE_MIN_MESH_SCORE - 0.01 })), false)
})

test('rejects faces smaller than the minimum box size', () => {
  assert.equal(isUsableFace(goodFace({ boxWidth: FACE_MIN_BOX_PX - 1 })), false)
  assert.equal(isUsableFace(goodFace({ boxHeight: FACE_MIN_BOX_PX - 1 })), false)
})

test('rejects strong head rotation on any axis, and missing rotation data', () => {
  const over = FACE_MAX_ROTATION_RAD + 0.01
  assert.equal(isUsableFace(goodFace({ rotation: { roll: over, yaw: 0, pitch: 0 } })), false)
  assert.equal(isUsableFace(goodFace({ rotation: { roll: 0, yaw: -over, pitch: 0 } })), false)
  assert.equal(isUsableFace(goodFace({ rotation: { roll: 0, yaw: 0, pitch: over } })), false)
  assert.equal(isUsableFace(goodFace({ rotation: null })), false)
  assert.equal(isUsableFace(goodFace({ rotation: undefined })), false)
})

// --- assessFaceDetection --------------------------------------------------------

test('returns the embedding for exactly one usable face', () => {
  const result = assessFaceDetection([goodFace()])
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.embedding.length, FACE_EMBEDDING_LENGTH)
  }
})

test('converts Float32Array embeddings to plain finite numbers', () => {
  const result = assessFaceDetection([
    goodFace({ embedding: new Float32Array(FACE_EMBEDDING_LENGTH).fill(0.25) }),
  ])
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(Array.isArray(result.embedding), true)
    assert.equal(result.embedding.every((v) => Number.isFinite(v)), true)
  }
})

test('no detected face → no-face', () => {
  assert.deepEqual(assessFaceDetection([]), { ok: false, reason: 'no-face' })
})

test('two faces → multiple-faces, even when both are usable', () => {
  assert.deepEqual(
    assessFaceDetection([goodFace(), goodFace()]),
    { ok: false, reason: 'multiple-faces' },
  )
})

test('single low-quality face → low-quality', () => {
  assert.deepEqual(
    assessFaceDetection([goodFace({ boxWidth: 10, boxHeight: 10 })]),
    { ok: false, reason: 'low-quality' },
  )
})

test('usable face with a malformed embedding → low-quality', () => {
  assert.deepEqual(
    assessFaceDetection([goodFace({ embedding: undefined })]),
    { ok: false, reason: 'low-quality' },
  )
  assert.deepEqual(
    assessFaceDetection([goodFace({ embedding: [0.1, 0.2] })]),
    { ok: false, reason: 'low-quality' },
  )
  const nanEmbedding = new Array<number>(FACE_EMBEDDING_LENGTH).fill(0.5)
  nanEmbedding[100] = Number.NaN
  assert.deepEqual(
    assessFaceDetection([goodFace({ embedding: nanEmbedding })]),
    { ok: false, reason: 'low-quality' },
  )
})
