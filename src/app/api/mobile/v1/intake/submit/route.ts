import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  authenticateMobileDevice,
  mobileErrorResponse,
  mobileJson,
  type MobileAuthContext,
} from '@/app/api/mobile/v1/_lib/auth'
import type { EditLogChange } from '@/lib/types'

export const runtime = 'nodejs'
export const maxDuration = 60

/* eslint-disable @typescript-eslint/no-explicit-any -- intake tables are not in the generated Database schema yet. */

const submissionSchema = z.object({
  op_id: z.string().trim().min(3).max(200),
  child_id: z.string().uuid(),
  template_id: z.string().uuid(),
  answers: z.array(z.object({
    question_id: z.string().uuid(),
    answer_value: z.string().max(10_000),
  })).min(1).max(200),
}).strict()

const submitSchema = z.object({
  device_installation_id: z.string().trim().min(3).max(200),
  submissions: z.array(submissionSchema).min(1).max(50),
}).strict()

type Submission = z.infer<typeof submissionSchema>

function isMediaFieldType(fieldType: string): boolean {
  return ['media_photo', 'media_video', 'profile_photo', 'profile_video'].includes(fieldType)
}

function isProfileFieldType(fieldType: string): boolean {
  return fieldType === 'profile_photo' || fieldType === 'profile_video'
}

/**
 * Offline counterpart of saveIntakeFormAction: upserts the changed answers of
 * one form per submission. Media answers arrive as child_media ids (created by
 * the mobile media upload flow); profile_photo / profile_video answers also
 * become the child's profile media. No Drive staging and no face enrollment.
 */
async function applySubmission(
  context: MobileAuthContext,
  submission: Submission,
): Promise<{ outcome: 'applied' } | { outcome: 'rejected'; reason: string }> {
  const admin = createAdminClient()

  const { data: childData, error: childError } = await admin
    .from('children')
    .select('*')
    .eq('id', submission.child_id)
    .maybeSingle()
  if (childError) throw new Error(`Could not read child for intake submit: ${childError.message}`)
  if (!childData) return { outcome: 'rejected', reason: 'Child not found on server' }
  if (!childData.country || (!context.isAdmin && !context.assignedCountries.includes(childData.country))) {
    return { outcome: 'rejected', reason: 'The child is outside this staff account\'s assigned countries.' }
  }

  const { data: template, error: templateError } = await (admin as any)
    .from('intake_templates')
    .select('id, title, template_questions (id, question_text, field_type)')
    .eq('id', submission.template_id)
    .maybeSingle()
  if (templateError) throw new Error(`Could not read intake template: ${templateError.message}`)
  if (!template) return { outcome: 'rejected', reason: 'Intake template not found' }

  const questionsById = new Map<string, { id: string; question_text: string; field_type: string }>(
    (template.template_questions ?? []).map((question: any) => [question.id, question]),
  )
  const unknownQuestion = submission.answers.find((answer) => !questionsById.has(answer.question_id))
  if (unknownQuestion) {
    return { outcome: 'rejected', reason: 'An answer targets a question outside this template.' }
  }

  // Media answers must reference this child's media of the matching type.
  const mediaAnswerIds = submission.answers
    .filter((answer) => {
      const question = questionsById.get(answer.question_id)
      return question && isMediaFieldType(question.field_type) && answer.answer_value.trim() !== ''
    })
    .map((answer) => answer.answer_value)
  const mediaById = new Map<string, { id: string; media_type: string | null }>()
  if (mediaAnswerIds.length > 0) {
    const { data: mediaRows, error: mediaError } = await admin
      .from('child_media')
      .select('id, media_type')
      .eq('child_id', submission.child_id)
      .in('id', mediaAnswerIds)
    if (mediaError) throw new Error(`Could not validate intake media answers: ${mediaError.message}`)
    for (const media of mediaRows ?? []) mediaById.set(media.id, media)
    for (const answer of submission.answers) {
      const question = questionsById.get(answer.question_id)
      if (!question || !isMediaFieldType(question.field_type) || answer.answer_value.trim() === '') continue
      const media = mediaById.get(answer.answer_value)
      const expectedType = question.field_type.endsWith('video') ? 'video' : 'photo'
      if (!media || media.media_type !== expectedType) {
        return { outcome: 'rejected', reason: 'A media answer does not reference this child\'s media of the expected type.' }
      }
    }
  }

  const { data: existingReport, error: existingReportError } = await (admin as any)
    .from('progress_reports')
    .select('id')
    .eq('child_id', submission.child_id)
    .eq('template_id', submission.template_id)
    .maybeSingle()
  if (existingReportError) throw new Error(`Could not read progress report: ${existingReportError.message}`)

  let reportId: string | undefined = existingReport?.id
  if (!reportId) {
    const { data: newReport, error: reportError } = await (admin as any)
      .from('progress_reports')
      .insert({
        child_id: submission.child_id,
        template_id: submission.template_id,
        country: childData.country || 'all',
        submitted_by: context.userId,
      })
      .select('id')
      .single()
    if (reportError || !newReport) {
      throw new Error(`Could not create progress report: ${reportError?.message ?? 'no report returned'}`)
    }
    reportId = newReport.id
  }

  const { data: priorAnswers, error: priorError } = await (admin as any)
    .from('report_answers')
    .select('question_id, answer_value')
    .eq('report_id', reportId)
  if (priorError) throw new Error(`Could not read prior report answers: ${priorError.message}`)
  const priorByQuestion = new Map<string, string>(
    (priorAnswers ?? []).map((answer: any) => [answer.question_id, answer.answer_value ?? '']),
  )

  const changes: EditLogChange[] = []
  let assignedProfilePhoto: string | null = null
  let assignedProfileVideo: string | null = null

  for (const answer of submission.answers) {
    const question = questionsById.get(answer.question_id)!
    const oldValue = (priorByQuestion.get(answer.question_id) ?? '').trim() || '—'
    const newValue = answer.answer_value.trim() || '—'
    if (oldValue !== newValue) {
      changes.push({
        field: `Intake Field (${template.title}): ${question.question_text}`,
        from: oldValue,
        to: newValue === '—' ? '[Deleted / Cleared]' : newValue,
      })
    }

    if (isProfileFieldType(question.field_type) && answer.answer_value.trim() !== '') {
      if (question.field_type === 'profile_photo') assignedProfilePhoto = answer.answer_value
      if (question.field_type === 'profile_video') assignedProfileVideo = answer.answer_value
    }

    // Non-profile intake media carries the same usage label the web writes.
    if (
      isMediaFieldType(question.field_type) &&
      !isProfileFieldType(question.field_type) &&
      answer.answer_value.trim() !== ''
    ) {
      await admin
        .from('child_media')
        .update({ usage_type: 'intake' })
        .eq('id', answer.answer_value)
        .eq('child_id', submission.child_id)
        .eq('usage_type', 'library')
    }
  }

  const { error: upsertError } = await (admin as any)
    .from('report_answers')
    .upsert(
      submission.answers.map((answer) => ({
        report_id: reportId,
        question_id: answer.question_id,
        answer_value: answer.answer_value,
      })),
      { onConflict: 'report_id,question_id' },
    )
  if (upsertError) throw new Error(`Could not save report answers: ${upsertError.message}`)

  for (const [mediaId, usage] of [
    [assignedProfilePhoto, 'profile_picture'],
    [assignedProfileVideo, 'profile_video'],
  ] as const) {
    if (!mediaId) continue
    const { error: demoteError } = await admin
      .from('child_media')
      .update({ usage_type: 'library' })
      .eq('child_id', submission.child_id)
      .eq('usage_type', usage)
      .neq('id', mediaId)
    if (demoteError) throw new Error(`Could not release the old profile media: ${demoteError.message}`)

    const { error: promoteError } = await admin
      .from('child_media')
      .update({ usage_type: usage })
      .eq('id', mediaId)
      .eq('child_id', submission.child_id)
    if (promoteError) throw new Error(`Could not promote the profile media: ${promoteError.message}`)

    const isPhotoSlot = usage === 'profile_picture'
    const profileColumn = isPhotoSlot ? 'profile_photo' : 'profile_video'
    const previous = (childData as any)[profileColumn] as string | null
    if (previous !== mediaId) {
      changes.push({ field: profileColumn, from: previous ?? '—', to: mediaId })
    }
    const { error: childUpdateError } = await admin
      .from('children')
      .update(isPhotoSlot ? { profile_photo: mediaId } : { profile_video: mediaId })
      .eq('id', submission.child_id)
    if (childUpdateError) throw new Error(`Could not update the child profile media: ${childUpdateError.message}`)
  }

  if (changes.length > 0) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      edited_by: context.profile.full_name || 'Mobile Staff',
      edited_at: new Date().toISOString(),
      profile: {
        id: context.userId,
        full_name: context.profile.full_name || 'Mobile Staff',
        role: context.profile.role,
        country: context.profile.country ?? '',
      },
      changes,
    }
    const priorLog = (childData.edit_log as any[] | null) ?? []
    const { error: logError } = await admin
      .from('children')
      .update({ edit_log: [logEntry, ...priorLog] })
      .eq('id', submission.child_id)
    if (logError) throw new Error(`Could not append the intake edit log: ${logError.message}`)
  }

  // Same completeness heal the web save runs; a failure only skips the cache.
  const { error: recalcError } = await (admin as any)
    .rpc('recalculate_profile_complete', { target_child_id: submission.child_id })
  if (recalcError) console.error('[mobile-api] recalculate_profile_complete failed', recalcError.message)

  return { outcome: 'applied' }
}

export async function POST(request: NextRequest) {
  try {
    const input = submitSchema.parse(await request.json())
    const context = await authenticateMobileDevice(request, input.device_installation_id)

    const results = []
    for (const submission of input.submissions) {
      try {
        const result = await applySubmission(context, submission)
        results.push({ op_id: submission.op_id, ...result })
      } catch (error) {
        console.error('[mobile-api] intake submission failed', error)
        results.push({
          op_id: submission.op_id,
          outcome: 'rejected' as const,
          reason: 'The intake submission could not be saved.',
        })
      }
    }

    return mobileJson({ results })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return mobileJson({ error: { code: 'invalid_intake_submit_request', message: 'The intake submission request is invalid.' } }, { status: 400 })
    }
    return mobileErrorResponse(error)
  }
}
