"use server"

// Server actions for the private face lookup. Authorization is enforced twice:
// here (signed-in admin/staff only) and again inside the SECURITY DEFINER
// database functions, which also apply staff country scoping. Embeddings flow
// in one direction only — browser → database. No action ever returns one, and
// neither embeddings nor face photos are ever logged.

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdminRole, isStaffRole } from '@/lib/profiles'
import type { UserProfile } from '@/lib/profiles'
import { FACE_MODEL_VERSION } from './config'
import { isValidFaceEmbedding } from './validation'

const NOT_AUTHORIZED = 'You are not authorized to use face lookup.'

export type FaceMatchCandidate = {
  childId: string
  /** Exact L2 distance between the query and the stored template (lower = closer). */
  distance: number
  displayName: string
  idRolf: string | null
  country: string | null
  /** child_media id of the profile photo, rendered via /api/media/[id]/thumbnail. */
  photoMediaId: string | null
}

export type FaceBackfillItem = {
  childId: string
  mediaId: string
  displayName: string
}

export type FaceTemplateStats = {
  childrenWithPhoto: number
  templatesActive: number
  templatesUnsearchable: number
}

type ActorCheck =
  | { profile: UserProfile; error: null }
  | { profile: null; error: string }

/** Resolve the caller and require an approved admin or staff profile. */
async function requireFaceActor(): Promise<ActorCheck> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { profile: null, error: NOT_AUTHORIZED }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, country, full_name')
    .eq('id', user.id)
    .single<UserProfile>()

  if (!profile || (!isAdminRole(profile.role) && !isStaffRole(profile.role))) {
    return { profile: null, error: NOT_AUTHORIZED }
  }
  return { profile, error: null }
}

/** Match a query embedding against enrolled profile photos. Returns at most
 *  three candidates, already restricted to the caller's country scope by the
 *  database function. The query embedding is discarded after this call. */
export async function matchChildFace(
  embedding: number[],
): Promise<{ candidates: FaceMatchCandidate[]; error: string | null }> {
  const actor = await requireFaceActor()
  if (actor.error !== null) return { candidates: [], error: actor.error }

  if (!isValidFaceEmbedding(embedding)) {
    return { candidates: [], error: 'Invalid face data. Please try again.' }
  }

  // Session client: the RPC checks auth.uid() for role + country scoping.
  const supabase = await createClient()
  const { data: matches, error: matchError } = await supabase.rpc('match_child_face', {
    query_embedding: embedding,
    query_model_version: FACE_MODEL_VERSION,
  })

  if (matchError) {
    console.error('[face-search] match_child_face failed:', matchError.message)
    return { candidates: [], error: 'Face search failed. Please try again.' }
  }

  const rows = matches ?? []
  if (rows.length === 0) return { candidates: [], error: null }

  // The ids are already scope-filtered by the RPC; hydrate display details.
  const adminSupabase = createAdminClient()
  const { data: childRows, error: childError } = await adminSupabase
    .from('children')
    .select('id, display_name, id_rolf, country, profile_photo')
    .in('id', rows.map((row) => row.child_id))

  if (childError) {
    console.error('[face-search] candidate hydration failed:', childError.message)
    return { candidates: [], error: 'Face search failed. Please try again.' }
  }

  const childById = new Map((childRows ?? []).map((child) => [child.id, child]))
  const candidates = rows.flatMap((row) => {
    const child = childById.get(row.child_id)
    if (!child) return []
    return [{
      childId: row.child_id,
      distance: row.distance,
      displayName: child.display_name,
      idRolf: child.id_rolf,
      country: child.country,
      // children.profile_photo holds the child_media UUID on the raw row.
      photoMediaId: child.profile_photo,
    }]
  })

  return { candidates, error: null }
}

/** Media id of a child's current profile photo, for enrollment: the client
 *  fetches its bytes through the authenticated media proxy and runs the model
 *  locally. Staff can only target children inside their assigned countries. */
export async function getFaceEnrollmentTarget(
  childId: string,
): Promise<{ mediaId: string | null; error: string | null }> {
  const actor = await requireFaceActor()
  if (actor.error !== null) return { mediaId: null, error: actor.error }

  const adminSupabase = createAdminClient()
  const { data: child } = await adminSupabase
    .from('children')
    .select('id, country, profile_photo')
    .eq('id', childId)
    .maybeSingle()

  if (!child) return { mediaId: null, error: 'Child not found.' }

  if (!isAdminRole(actor.profile.role)) {
    const allowedCountries = actor.profile.country ?? []
    if (!child.country || !allowedCountries.includes(child.country)) {
      return { mediaId: null, error: NOT_AUTHORIZED }
    }
  }

  return { mediaId: child.profile_photo, error: null }
}

/** Create or replace the face template for a child's current profile photo.
 *  Pass null when the photo was analyzed and holds no single usable face —
 *  it stays a valid profile photo but is recorded as unsearchable (and any
 *  stale template is cleared). Do NOT call with null on model/load failures. */
export async function saveFaceTemplate(
  childId: string,
  mediaId: string,
  embedding: number[] | null,
): Promise<{ error: string | null }> {
  const actor = await requireFaceActor()
  if (actor.error !== null) return { error: actor.error }

  if (embedding !== null && !isValidFaceEmbedding(embedding)) {
    return { error: 'Invalid face data. Please try again.' }
  }

  // Session client: the RPC validates role, country scope, and that the media
  // row is this child's current profile photo.
  const supabase = await createClient()
  const { error } = await supabase.rpc('upsert_child_face_template', {
    target_child_id: childId,
    target_media_id: mediaId,
    face_embedding: embedding,
    face_model_version: FACE_MODEL_VERSION,
  })

  if (error) {
    console.error('[face-enroll] upsert_child_face_template failed:', error.message)
    return { error: 'Could not save the face template.' }
  }
  return { error: null }
}

/** Admin-only: children whose current profile photo still needs enrollment for
 *  the active model version. Shrinks as the backfill progresses, so the run is
 *  resumable after a refresh or failure. */
export async function getFaceBackfillQueue(): Promise<{
  items: FaceBackfillItem[]
  error: string | null
}> {
  const actor = await requireFaceActor()
  if (actor.error !== null || !isAdminRole(actor.profile.role)) {
    return { items: [], error: NOT_AUTHORIZED }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_face_enrollment_queue', {
    expected_model_version: FACE_MODEL_VERSION,
  })

  if (error) {
    console.error('[face-backfill] queue fetch failed:', error.message)
    return { items: [], error: 'Could not load the enrollment queue.' }
  }

  return {
    items: (data ?? []).map((row) => ({
      childId: row.child_id,
      mediaId: row.media_id,
      displayName: row.display_name,
    })),
    error: null,
  }
}

/** Admin-only enrollment counters for the settings screen. */
export async function getFaceTemplateStats(): Promise<{
  stats: FaceTemplateStats | null
  error: string | null
}> {
  const actor = await requireFaceActor()
  if (actor.error !== null || !isAdminRole(actor.profile.role)) {
    return { stats: null, error: NOT_AUTHORIZED }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_face_template_stats', {
    expected_model_version: FACE_MODEL_VERSION,
  })

  const row = data?.[0]
  if (error || !row) {
    console.error('[face-backfill] stats fetch failed:', error?.message)
    return { stats: null, error: 'Could not load face search statistics.' }
  }

  return {
    stats: {
      childrenWithPhoto: row.children_with_photo,
      templatesActive: row.templates_active,
      templatesUnsearchable: row.templates_unsearchable,
    },
    error: null,
  }
}
