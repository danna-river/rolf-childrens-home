import { createHash } from 'node:crypto'
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Database } from '@/lib/types'
import {
  assertCountryScope,
  authenticateMobileDevice,
  MobileApiError,
  mobileErrorResponse,
  mobileJson,
} from '@/app/api/mobile/v1/_lib/auth'

export const runtime = 'nodejs'
export const maxDuration = 60

const optionalText = z.string().trim().max(10_000).nullable().optional()
const optionalShortText = z.string().trim().max(255).nullable().optional()

const childPayloadSchema = z.object({
  id_rolf: z.string().trim().toUpperCase().max(80).nullable().optional(),
  first_name: optionalShortText,
  last_name: optionalShortText,
  birth_year: z.number().int().min(1900).max(2100).nullable().optional(),
  birth_month: z.number().int().min(1).max(12).nullable().optional(),
  birth_day: z.number().int().min(1).max(31).nullable().optional(),
  country: z.string().trim().min(1).max(120).optional(),
  year_joined: z.number().int().min(1900).max(2100).nullable().optional(),
  date_joined: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  career_aspiration: optionalText,
  favorite_subject: optionalText,
  hobby: optionalText,
  bio: optionalText,
  notes: optionalText,
  status: z.enum(['active', 'inactive']).optional(),
}).strict()

type ChildPayload = z.infer<typeof childPayloadSchema>
type Operation = {
  operation_id: string
  operation_type: 'create_child' | 'update_child'
  child_id: string
  base_sync_version: number | null
  payload: ChildPayload
}

const mobileChildFieldsSchema = z.object({
  firstName: z.string().trim().max(255),
  lastName: z.string().trim().max(255),
  birthYear: z.number().int().min(1900).max(2100).nullable(),
  birthMonth: z.number().int().min(1).max(12).nullable(),
  birthDay: z.number().int().min(1).max(31).nullable(),
  country: z.string().trim().min(1).max(120),
  dateJoined: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  careerAspiration: z.string().trim().max(10_000),
  favoriteSubject: z.string().trim().max(10_000),
  hobby: z.string().trim().max(10_000),
  bio: z.string().trim().max(10_000),
  notes: z.string().trim().max(10_000),
  status: z.enum(['active', 'inactive']),
}).strict()

function fieldsToPayload(fields: z.infer<typeof mobileChildFieldsSchema>): ChildPayload {
  return {
    first_name: fields.firstName,
    last_name: fields.lastName,
    birth_year: fields.birthYear,
    birth_month: fields.birthMonth,
    birth_day: fields.birthDay,
    country: fields.country,
    date_joined: fields.dateJoined,
    career_aspiration: fields.careerAspiration,
    favorite_subject: fields.favoriteSubject,
    hobby: fields.hobby,
    bio: fields.bio,
    notes: fields.notes,
    status: fields.status,
  }
}

const legacyOperationSchema = z.object({
  operation_id: z.string().uuid(),
  operation_type: z.enum(['create_child', 'update_child']),
  child_id: z.string().uuid(),
  base_sync_version: z.number().int().positive().nullable(),
  payload: childPayloadSchema,
}).strict().transform((operation): Operation => operation)

const androidOperationSchema = z.object({
  op_id: z.string().uuid(),
  op_type: z.enum(['create_child', 'update_child']),
  child_local_id: z.string().uuid(),
  child_server_id: z.string().uuid().nullable().optional(),
  id_rolf: z.string().trim().toUpperCase().max(80).nullable().optional(),
  base_sync_version: z.number().int().min(0),
  fields: mobileChildFieldsSchema,
}).strict().transform((operation): Operation => ({
  operation_id: operation.op_id,
  operation_type: operation.op_type,
  child_id: operation.op_type === 'update_child'
    ? (operation.child_server_id ?? operation.child_local_id)
    : operation.child_local_id,
  base_sync_version: operation.op_type === 'create_child' ? null : operation.base_sync_version,
  payload: {
    ...fieldsToPayload(operation.fields),
    ...(operation.id_rolf ? { id_rolf: operation.id_rolf } : {}),
  },
}))

const operationSchema = z.union([legacyOperationSchema, androidOperationSchema])

const syncSchema = z.object({
  device_installation_id: z.string().trim().min(3).max(200),
  operations: z.array(operationSchema).min(1).max(100),
}).strict()

type OperationResult = {
  operation_id: string
  status: 'applied' | 'conflict' | 'rejected'
  result: Record<string, unknown>
}

class SyncConflict extends Error {
  constructor(public readonly result: Record<string, unknown>) {
    super('Sync conflict')
  }
}

function hasOwn<T extends object>(value: T, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(value, key)
}

function hashOperation(operation: Operation): string {
  return createHash('sha256').update(JSON.stringify(operation)).digest('hex')
}

function operationResult(
  operationId: string,
  status: OperationResult['status'],
  result: Record<string, unknown>,
): OperationResult {
  return { operation_id: operationId, status, result }
}

function stringField(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function nullableNumberField(value: unknown): number | null {
  return typeof value === 'number' ? value : null
}

function childFields(child: Record<string, unknown>) {
  return {
    firstName: stringField(child.first_name),
    lastName: stringField(child.last_name),
    birthYear: nullableNumberField(child.birth_year),
    birthMonth: nullableNumberField(child.birth_month),
    birthDay: nullableNumberField(child.birth_day),
    country: stringField(child.country),
    dateJoined: typeof child.date_joined === 'string' ? child.date_joined : null,
    careerAspiration: stringField(child.career_aspiration),
    favoriteSubject: stringField(child.favorite_subject),
    hobby: stringField(child.hobby),
    bio: stringField(child.bio),
    notes: stringField(child.notes),
    status: child.status === 'inactive' ? 'inactive' : 'active',
  }
}

function recordValue(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

function toWireResult(result: OperationResult) {
  const child = recordValue(result.result.child)
  const serverChild = recordValue(result.result.server_child)
  const source = child ?? serverChild

  return {
    op_id: result.operation_id,
    outcome: result.status,
    child_server_id: typeof source?.id === 'string' ? source.id : undefined,
    id_rolf: typeof source?.id_rolf === 'string' ? source.id_rolf : undefined,
    new_sync_version: typeof child?.sync_version === 'number' ? child.sync_version : undefined,
    server_fields: serverChild ? childFields(serverChild) : undefined,
    server_sync_version: typeof serverChild?.sync_version === 'number' ? serverChild.sync_version : undefined,
    reason: typeof result.result.message === 'string'
      ? result.result.message
      : typeof result.result.code === 'string'
        ? result.result.code
        : undefined,
  }
}

function childSnapshot(child: Record<string, unknown>) {
  return {
    id: child.id,
    id_rolf: child.id_rolf,
    display_name: child.display_name,
    first_name: child.first_name,
    last_name: child.last_name,
    birth_year: child.birth_year,
    birth_month: child.birth_month,
    birth_day: child.birth_day,
    country: child.country,
    year_joined: child.year_joined,
    date_joined: child.date_joined,
    career_aspiration: child.career_aspiration,
    favorite_subject: child.favorite_subject,
    hobby: child.hobby,
    bio: child.bio,
    notes: child.notes,
    status: child.status,
    sync_version: child.sync_version,
    updated_at: child.updated_at,
  }
}

function payloadMatchesChild(payload: z.infer<typeof childPayloadSchema>, child: Record<string, unknown>): boolean {
  const matchingFields = [
    'id_rolf',
    'first_name',
    'last_name',
    'birth_year',
    'birth_month',
    'birth_day',
    'country',
    'year_joined',
    'date_joined',
    'career_aspiration',
    'favorite_subject',
    'hobby',
    'bio',
    'notes',
    'status',
  ] as const

  return matchingFields.every((field) => !hasOwn(payload, field) || payload[field] === child[field])
}

function buildChildPatch(
  payload: z.infer<typeof childPayloadSchema>,
  existing: Record<string, unknown>,
): Database['public']['Tables']['children']['Update'] {
  const patch: Record<string, unknown> = {}
  const fields = [
    'first_name',
    'last_name',
    'birth_year',
    'birth_month',
    'birth_day',
    'country',
    'year_joined',
    'date_joined',
    'career_aspiration',
    'favorite_subject',
    'hobby',
    'bio',
    'notes',
    'status',
  ] as const

  for (const field of fields) {
    if (hasOwn(payload, field)) patch[field] = payload[field]
  }

  if (hasOwn(payload, 'first_name') || hasOwn(payload, 'last_name')) {
    const firstName = (hasOwn(payload, 'first_name') ? payload.first_name : existing.first_name) ?? ''
    const lastName = (hasOwn(payload, 'last_name') ? payload.last_name : existing.last_name) ?? ''
    const displayName = `${firstName} ${lastName}`.trim()
    if (displayName) patch.display_name = displayName
  }

  return patch as Database['public']['Tables']['children']['Update']
}

async function generateNextRolfId(
  admin: ReturnType<typeof createAdminClient>,
  country: string,
): Promise<string> {
  const { data: countryRecord, error: countryError } = await admin
    .from('countries')
    .select('iso_code')
    .eq('name', country.trim())
    .single()

  if (countryError || !countryRecord) {
    throw new MobileApiError(422, 'country_not_configured', `Country "${country}" is not configured for ROLF IDs.`)
  }

  const prefix = countryRecord.iso_code
  const { data: siblingRecords, error: siblingError } = await admin
    .from('children')
    .select('id_rolf')
    .like('id_rolf', `${prefix}-%`)

  if (siblingError) throw new Error(`Could not read existing ROLF IDs: ${siblingError.message}`)

  let currentMaxNumber = 0
  for (const record of siblingRecords ?? []) {
    const match = record.id_rolf?.match(/^[A-Z]+-(\d+)$/)
    if (!match) continue
    const parsedNumber = parseInt(match[1], 10)
    if (parsedNumber > currentMaxNumber) currentMaxNumber = parsedNumber
  }

  return `${prefix}-${String(currentMaxNumber + 1).padStart(4, '0')}`
}

async function createChild(
  operation: Operation,
  context: Awaited<ReturnType<typeof authenticateMobileDevice>>,
): Promise<Record<string, unknown>> {
  const { payload } = operation
  if (
    !payload.country ||
    !payload.first_name ||
    !payload.last_name ||
    operation.base_sync_version !== null
  ) {
    throw new MobileApiError(422, 'invalid_create_operation', 'New children require country, first name, last name, and a null base sync version. The server assigns the ROLF ID during sync.')
  }
  assertCountryScope(context, payload.country)

  const admin = createAdminClient()
  const { data: existing, error: existingError } = await admin
    .from('children')
    .select('id, id_rolf, country, created_by, sync_version, display_name, first_name, last_name, birth_year, birth_month, birth_day, year_joined, date_joined, career_aspiration, favorite_subject, hobby, bio, notes, status, updated_at')
    .eq('id', operation.child_id)
    .maybeSingle()

  if (existingError) throw new Error(`Could not check the child being created: ${existingError.message}`)
  if (existing) {
    assertCountryScope(context, existing.country)
    if (existing.created_by === context.userId && payloadMatchesChild(payload, existing)) {
      return childSnapshot(existing)
    }
    throw new SyncConflict({
      code: 'child_id_already_exists',
      server_child: childSnapshot(existing),
    })
  }

  let lastAttemptedRolfId: string | null = null
  for (let attempt = 0; attempt < 5; attempt++) {
    const idRolf = await generateNextRolfId(admin, payload.country)
    lastAttemptedRolfId = idRolf

    const { data: inserted, error: insertError } = await admin
      .from('children')
      .insert({
        id: operation.child_id,
        id_rolf: idRolf,
        display_name: `${payload.first_name} ${payload.last_name}`.trim(),
        first_name: payload.first_name,
        last_name: payload.last_name,
        birth_year: payload.birth_year ?? null,
        birth_month: payload.birth_month ?? null,
        birth_day: payload.birth_day ?? null,
        country: payload.country,
        year_joined: payload.year_joined ?? null,
        date_joined: payload.date_joined ?? null,
        career_aspiration: payload.career_aspiration ?? null,
        favorite_subject: payload.favorite_subject ?? null,
        hobby: payload.hobby ?? null,
        bio: payload.bio ?? null,
        notes: payload.notes ?? null,
        status: payload.status ?? 'active',
        profile_photo: null,
        profile_video: null,
        edit_log: [],
        created_by: context.userId,
      })
      .select('id, id_rolf, country, created_by, sync_version, display_name, first_name, last_name, birth_year, birth_month, birth_day, year_joined, date_joined, career_aspiration, favorite_subject, hobby, bio, notes, status, updated_at')
      .single()

    if (!insertError && inserted) return childSnapshot(inserted)

    if (insertError?.code === '23505') {
      continue
    }

    throw new Error(`Could not create child: ${insertError?.message ?? 'No child returned.'}`)
  }

  throw new SyncConflict({ code: 'rolf_id_generation_collision', id_rolf: lastAttemptedRolfId })
}

async function updateChild(
  operation: Operation,
  context: Awaited<ReturnType<typeof authenticateMobileDevice>>,
): Promise<Record<string, unknown>> {
  if (!operation.base_sync_version) {
    throw new MobileApiError(422, 'base_sync_version_required', 'Child updates require a base sync version.')
  }

  const admin = createAdminClient()
  const { data: existing, error: existingError } = await admin
    .from('children')
    .select('id, id_rolf, country, created_by, sync_version, display_name, first_name, last_name, birth_year, birth_month, birth_day, year_joined, date_joined, career_aspiration, favorite_subject, hobby, bio, notes, status, updated_at')
    .eq('id', operation.child_id)
    .maybeSingle()

  if (existingError) throw new Error(`Could not read the child being updated: ${existingError.message}`)
  if (!existing) throw new MobileApiError(404, 'child_not_found', 'The child no longer exists.')
  assertCountryScope(context, existing.country)

  if (hasOwn(operation.payload, 'id_rolf') && operation.payload.id_rolf !== existing.id_rolf) {
    throw new MobileApiError(422, 'rolf_id_immutable', 'A child ROLF ID cannot be changed by mobile sync.')
  }

  const targetCountry = operation.payload.country ?? existing.country
  assertCountryScope(context, targetCountry)

  if (existing.sync_version !== operation.base_sync_version) {
    // A timeout after a successful update may leave the idempotency row in
    // processing state. Treat an identical final child as the completed retry.
    if (payloadMatchesChild(operation.payload, existing)) return childSnapshot(existing)
    throw new SyncConflict({
      code: 'base_sync_version_mismatch',
      base_sync_version: operation.base_sync_version,
      server_child: childSnapshot(existing),
    })
  }

  const patch = buildChildPatch(operation.payload, existing)
  if (Object.keys(patch).length === 0) return childSnapshot(existing)

  const { data: updated, error: updateError } = await admin
    .from('children')
    .update(patch)
    .eq('id', operation.child_id)
    .eq('sync_version', operation.base_sync_version)
    .select('id, id_rolf, country, created_by, sync_version, display_name, first_name, last_name, birth_year, birth_month, birth_day, year_joined, date_joined, career_aspiration, favorite_subject, hobby, bio, notes, status, updated_at')
    .maybeSingle()

  if (updateError) throw new Error(`Could not update child: ${updateError.message}`)
  if (!updated) {
    const { data: latest } = await admin
      .from('children')
      .select('id, id_rolf, country, created_by, sync_version, display_name, first_name, last_name, birth_year, birth_month, birth_day, year_joined, date_joined, career_aspiration, favorite_subject, hobby, bio, notes, status, updated_at')
      .eq('id', operation.child_id)
      .maybeSingle()
    throw new SyncConflict({
      code: 'base_sync_version_mismatch',
      base_sync_version: operation.base_sync_version,
      server_child: latest ? childSnapshot(latest) : null,
    })
  }

  return childSnapshot(updated)
}

async function processOperation(
  operation: Operation,
  context: Awaited<ReturnType<typeof authenticateMobileDevice>>,
): Promise<OperationResult> {
  const admin = createAdminClient()
  const payloadHash = hashOperation(operation)
  const { data: existing, error: readError } = await admin
    .from('mobile_sync_operations')
    .select('*')
    .eq('operation_id', operation.operation_id)
    .maybeSingle()

  if (readError) throw new Error(`Could not read sync operation: ${readError.message}`)
  if (existing) {
    if (existing.device_id !== context.device.id || existing.user_id !== context.userId || existing.payload_hash !== payloadHash) {
      return operationResult(operation.operation_id, 'rejected', { code: 'operation_id_reused', message: 'Operation IDs cannot be reused with different data or devices.' })
    }
    if (existing.status !== 'processing' && existing.result) {
      return operationResult(operation.operation_id, existing.status === 'applied' ? 'applied' : existing.status === 'conflict' ? 'conflict' : 'rejected', existing.result)
    }
    if (Date.now() - Date.parse(existing.attempt_started_at) < 60_000) {
      return operationResult(operation.operation_id, 'rejected', { code: 'operation_in_progress', message: 'This operation is still being processed. Retry shortly.' })
    }
    await admin
      .from('mobile_sync_operations')
      .update({ attempt_started_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('operation_id', operation.operation_id)
  } else {
    const { error: insertError } = await admin
      .from('mobile_sync_operations')
      .insert({
        operation_id: operation.operation_id,
        device_id: context.device.id,
        user_id: context.userId,
        operation_type: operation.operation_type,
        payload_hash: payloadHash,
        status: 'processing',
        result: null,
      })

    if (insertError) {
      // A concurrent retry won the primary-key insert. The next sync receives
      // its stored result or safely retries after the short processing lease.
      return operationResult(operation.operation_id, 'rejected', { code: 'operation_in_progress', message: 'This operation is already being processed.' })
    }
  }

  let result: OperationResult
  try {
    const child = operation.operation_type === 'create_child'
      ? await createChild(operation, context)
      : await updateChild(operation, context)
    result = operationResult(operation.operation_id, 'applied', { child })
  } catch (error) {
    if (error instanceof SyncConflict) {
      result = operationResult(operation.operation_id, 'conflict', error.result)
    } else if (error instanceof MobileApiError) {
      result = operationResult(operation.operation_id, 'rejected', { code: error.code, message: error.message })
    } else {
      console.error('[mobile-sync] operation failed', operation.operation_id, error)
      result = operationResult(operation.operation_id, 'rejected', { code: 'operation_failed', message: 'The operation could not be applied. Retry after checking the child data.' })
    }
  }

  const { error: completeError } = await admin
    .from('mobile_sync_operations')
    .update({
      status: result.status,
      result: result.result,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('operation_id', operation.operation_id)

  if (completeError) throw new Error(`Could not persist sync operation result: ${completeError.message}`)
  return result
}

/** Applies ordered, idempotent offline changes and returns one result per operation. */
export async function POST(request: NextRequest) {
  try {
    const input = syncSchema.parse(await request.json())
    const context = await authenticateMobileDevice(request, input.device_installation_id)
    const results: OperationResult[] = []

    for (const operation of input.operations) {
      results.push(await processOperation(operation, context))
    }

    return mobileJson({
      server_time: new Date().toISOString(),
      results: results.map(toWireResult),
      operations: results,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return mobileJson({ error: { code: 'invalid_sync_request', message: 'The sync request is invalid.' } }, { status: 400 })
    }
    return mobileErrorResponse(error)
  }
}
