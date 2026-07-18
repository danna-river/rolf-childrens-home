"use server"

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { commitStagedFilesToCountry } from '@/lib/googleDrive'
import { extractDriveFileId } from '@/lib/childMedia'
import type { EditLogChange } from '@/lib/types'
import { revalidatePath } from 'next/cache'

/* eslint-disable @typescript-eslint/no-explicit-any */

function sanitize(str: string): string {
  return str.trim().replace(/[^a-zA-Z0-9]/g, "_")
}

// Media field types: `media_*` uploads go to the child's library only;
// `profile_*` uploads additionally become the child's profile photo / video.
function isMediaFieldType(fieldType: string): boolean {
  return ['media_photo', 'media_video', 'profile_photo', 'profile_video'].includes(fieldType)
}

function isProfileFieldType(fieldType: string): boolean {
  return fieldType === 'profile_photo' || fieldType === 'profile_video'
}

function isVideoFieldType(fieldType: string): boolean {
  return fieldType === 'media_video' || fieldType === 'profile_video'
}

function buildServerFilename(childData: any, type: "photo" | "video", ext: string): string {
  const now = new Date()
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "")
  const ms = Date.now()
  const microfraction = String(ms % 1000).padStart(3, '0')
  return `${childData.id_rolf ? sanitize(childData.id_rolf) : "unknown"}_${childData.last_name ? sanitize(childData.last_name) : ""}_${childData.first_name ? sanitize(childData.first_name) : ""}_${type}_${dateStr}-${ms}${microfraction}.${ext.toLowerCase()}`
}

// ⚡ NEW: The highly optimized single-child RPC Evaluator
export async function recalculateProfileComplete(childId: string) {
  const supabase = await createClient()
  
  // Executes entirely inside the Supabase cluster (Zero network egress)
  const { error } = await supabase.rpc('recalculate_profile_complete', {
    target_child_id: childId
  })

  if (error) {
    console.error("❌ Database RPC performance crash (recalculateProfileComplete):", error.message)
  }
}

export async function getEligibleIntakeForms(childId: string, childCountry: string, dateJoinedStr: string | null, yearJoinedNum: number | null) {
  const supabase = await createClient()

  const { data: templates } = await (supabase as any)
    .from('intake_templates')
    .select(`
      *,
      template_questions (
        id,
        template_id,
        question_text,
        field_type,
        choices,
        created_at
      )
    `)
    .order('created_at', { ascending: false })

  if (!templates) return { eligibleForms: [], latestCompleted: true }

  const { data: existingReports } = await (supabase as any)
    .from('progress_reports')
    .select(`
      id,
      template_id,
      report_answers (
        question_id,
        answer_value
      )
    `)
    .eq('child_id', childId)

  const { data: childMediaData } = await supabase
    .from('child_media')
    .select('id, url, usage_type, created_at')
    .eq('child_id', childId)
  const mediaMap: Record<string, { id: string; url: string }> = {}
  const mediaByUrl: Record<string, { id: string; url: string }> = {}
  childMediaData?.forEach((m: any) => {
    mediaMap[m.id] = m
    mediaByUrl[m.url] = m
  })

  const ONE_MONTH_MS = 1000 * 60 * 60 * 24 * 30
  const recentProfileMedia: Record<'photo' | 'video', { id: string; url: string; createdAt: string } | null> = {
    photo: null,
    video: null,
  }
  childMediaData?.forEach((m: any) => {
    if (m.usage_type !== 'profile_picture' && m.usage_type !== 'profile_video') return
    if (!m.created_at || Date.now() - new Date(m.created_at).getTime() > ONE_MONTH_MS) return
    const kind: 'photo' | 'video' = m.usage_type === 'profile_picture' ? 'photo' : 'video'
    const current = recentProfileMedia[kind]
    if (!current || new Date(m.created_at) > new Date(current.createdAt)) {
      recentProfileMedia[kind] = { id: m.id, url: m.url, createdAt: m.created_at }
    }
  })

  const submissionMap: Record<string, Record<string, { value: string; url: string; mediaId: string }>> = {}
  existingReports?.forEach((report: any) => {
    const answersObj: Record<string, { value: string; url: string; mediaId: string }> = {}
    report.report_answers?.forEach((ans: any) => {
      const savedValue = ans.answer_value || ""
      const media = mediaMap[savedValue] || mediaByUrl[savedValue]
      answersObj[ans.question_id] = {
        value: savedValue,
        url: media?.url || (savedValue.startsWith('http') ? savedValue : ""),
        mediaId: media?.id || "",
      }
    })
    submissionMap[report.template_id] = answersObj
  })

  const currentYear = new Date().getFullYear()
  const previousYear = currentYear - 1

  const eligibleForms = templates.map((tpl: any) => {
    if (tpl.status === 'inactive') return null

    const isTargetRegion = tpl.country === 'all' || tpl.country === childCountry
    
    const templateCreatedAt = new Date(tpl.created_at)
    const templateYear = templateCreatedAt.getFullYear()
    const isTimelineEligible = !yearJoinedNum || templateYear >= yearJoinedNum

    if (!isTargetRegion || !isTimelineEligible) return null

    const questionsList = tpl.template_questions || []
    const savedQuestionAnswers = submissionMap[tpl.id] || {}

    const componentViewAnswers: Record<string, string> = {}
    const componentMediaIds: Record<string, string> = {}
    const lockedQuestionsList: string[] = []
    const suggestedMediaMap: Record<string, string> = {}

    questionsList.forEach((q: any) => {
      const savedData = savedQuestionAnswers[q.id]

      if (savedData && savedData.value && savedData.value.trim() !== "") {
        lockedQuestionsList.push(q.id)
      }

      if (isMediaFieldType(q.field_type)) {
        componentViewAnswers[q.id] = savedData?.url || savedData?.value || ""
        if (savedData?.mediaId) componentMediaIds[q.id] = savedData.mediaId

        if (!componentViewAnswers[q.id] && isProfileFieldType(q.field_type)) {
          const suggestion = q.field_type === 'profile_photo' ? recentProfileMedia.photo : recentProfileMedia.video
          if (suggestion) {
            componentViewAnswers[q.id] = suggestion.url
            componentMediaIds[q.id] = suggestion.id
            suggestedMediaMap[q.id] = suggestion.createdAt
          }
        }
      } else {
        componentViewAnswers[q.id] = savedData?.value || ""
      }
    })

    const isFinished = questionsList.length > 0 && questionsList.every((q: any) => {
      const ansData = savedQuestionAnswers[q.id]
      return ansData?.value !== undefined && ansData?.value !== null && ansData?.value.trim() !== ""
    })

    return {
      id: tpl.id,
      title: tpl.title,
      createdAt: tpl.created_at,
      templateYear,
      questions: questionsList,
      answers: componentViewAnswers,
      mediaIds: componentMediaIds,
      lockedQuestions: lockedQuestionsList,
      suggestedMedia: suggestedMediaMap,
      isCompleted: isFinished,
      isLatest: false
    }
  }).filter(Boolean)

  if (eligibleForms.length > 0) {
    eligibleForms[0].isLatest = true
  }

  const targetWindowForms = eligibleForms.filter(
    (form: any) => form.templateYear === currentYear || form.templateYear === previousYear
  )
  
  const latestCompleted = targetWindowForms.length > 0 
    ? targetWindowForms.every((form: any) => form.isCompleted) 
    : true

  return { eligibleForms, latestCompleted }
}

export async function saveIntakeFormAction(
  childId: string,
  templateId: string,
  formTitle: string,
  newAnswers: Record<string, string>,
  stagedDriveFileIds?: string[]
  // profilePhotoChanged tells the caller to run face enrollment on its device:
  // the profile-photo DB trigger just dropped the old face template.
): Promise<{ error: string | null; profilePhotoChanged?: boolean }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Authentication session expired." }

  const [profileRes, childRes] = await Promise.all([
    supabase.from('profiles').select('full_name, role, country').eq('id', user.id).single(),
    supabase.from('children').select('*').eq('id', childId).single()
  ])

  if (childRes.error || !childRes.data) return { error: "Child record targeted could not be found." }

  const actorProfile = profileRes.data
  const childData = childRes.data

  if (stagedDriveFileIds && stagedDriveFileIds.length > 0) {
    try {
      await commitStagedFilesToCountry(childData.country || 'all', Array.from(new Set(stagedDriveFileIds)))
    } catch (err: any) {
      console.error("❌ INTAKE GOOGLE_DRIVE COMMIT FAILURE:", err)
      return { error: `Staging commitment failure: ${err?.message || err}` }
    }
  }

  const { data: dbQuestions } = await (supabase as any)
    .from('template_questions')
    .select('id, question_text, field_type')
    .eq('template_id', templateId)

  if (!dbQuestions) return { error: "Failed to resolve blueprint master questions setup." }

  const { data: existingReport } = await (supabase as any)
    .from('progress_reports')
    .select('id')
    .eq('child_id', childId)
    .eq('template_id', templateId)
    .maybeSingle()

  let reportId = existingReport?.id

  if (!reportId) {
    const { data: newReport, error: reportErr } = await (supabase as any)
      .from('progress_reports')
      .insert({
        child_id: childId,
        template_id: templateId,
        country: childData.country || 'all',
        submitted_by: user.id
      })
      .select('id')
      .single()

    if (reportErr || !newReport) return { error: `Failed creating master record: ${reportErr?.message}` }
    reportId = newReport.id
  }

  const { data: oldAnswersList } = await (supabase as any)
    .from('report_answers')
    .select('question_id, answer_value')
    .eq('report_id', reportId)

  const { data: childMediaData } = await supabase.from('child_media').select('id, url').eq('child_id', childId)
  const mediaMap: Record<string, string> = {}
  const mediaIdByUrl: Record<string, string> = {}
  childMediaData?.forEach((m: any) => {
    mediaMap[m.id] = m.url
    mediaIdByUrl[m.url] = m.id
  })

  const priorAnswersMap: Record<string, string> = {}
  const priorMediaUrlsMap: Record<string, string> = {}
  
  oldAnswersList?.forEach((ans: any) => {
    const savedVal = ans.answer_value || ""
    priorAnswersMap[ans.question_id] = savedVal
    priorMediaUrlsMap[ans.question_id] = mediaMap[savedVal] || ""
  })

  const changes: EditLogChange[] = []
  const answersUpsertPayload: Array<{ report_id: string; question_id: string; answer_value: string }> = []

  let assignedProfilePhotoUuid: string | null = null
  let assignedProfileVideoUuid: string | null = null

  for (const q of dbQuestions) {
    const clientValue = newAnswers[q.id] || ""
    const oldRawValue = priorAnswersMap[q.id] || ""
    const oldMediaUrl = priorMediaUrlsMap[q.id] || ""

    let finalAnswerValue = clientValue
    const isMediaField = isMediaFieldType(q.field_type)
    const isProfileField = isProfileFieldType(q.field_type)
    const determinedType = isVideoFieldType(q.field_type) ? 'video' : 'photo'

    const markProfileAssignment = (mediaUuid: string) => {
      if (!isProfileField) return
      if (determinedType === 'photo') assignedProfilePhotoUuid = mediaUuid
      if (determinedType === 'video') assignedProfileVideoUuid = mediaUuid
    }

    if (isMediaField) {
      if (clientValue.startsWith('http')) {
        if (clientValue === oldMediaUrl) {
          finalAnswerValue = oldRawValue
          markProfileAssignment(finalAnswerValue)
        } else if (mediaIdByUrl[clientValue]) {
          finalAnswerValue = mediaIdByUrl[clientValue]
          markProfileAssignment(finalAnswerValue)
        } else {
          const isGoogleDrive = clientValue.includes('drive.google.com')

          const urlWithoutParams = clientValue.split('?')[0]
          const extractedExt = urlWithoutParams.includes('.')
            ? urlWithoutParams.split('.').pop()?.toLowerCase() || 'jpg'
            : 'jpg'
          const generatedFilename = buildServerFilename(childData, determinedType, extractedExt)

          const adminSupabase = await createAdminClient()

          const { data: mediaRecord } = await (adminSupabase as any)
            .from('child_media')
            .insert({
              child_id: childId,
              url: clientValue,
              gdrive_file_id: isGoogleDrive ? extractDriveFileId(clientValue) : null,
              source: isGoogleDrive ? 'google_drive' : 'supabase',
              media_type: determinedType,
              usage_type: isProfileField
                ? (determinedType === 'video' ? 'profile_video' : 'profile_picture')
                : 'intake',
              filename: generatedFilename,
              uploaded_by: user.id
            })
            .select('id')
            .single()

          if (mediaRecord) {
            finalAnswerValue = mediaRecord.id
            markProfileAssignment(mediaRecord.id)
          }
        }
      } else if (clientValue === "") {
        finalAnswerValue = ""
      }
    }

    const cleanOld = oldRawValue.trim() ? oldRawValue.trim() : "—"
    const cleanNew = finalAnswerValue.trim() ? finalAnswerValue.trim() : "—"

    if (cleanOld !== cleanNew) {
      changes.push({
        field: `Intake Field (${formTitle}): ${q.question_text}`,
        from: cleanOld,
        to: cleanNew === "—" ? "[Deleted / Cleared]" : cleanNew
      })
    }

    answersUpsertPayload.push({
      report_id: reportId,
      question_id: q.id,
      answer_value: finalAnswerValue
    })
  }

  const profilePhotoChanged =
    Boolean(assignedProfilePhotoUuid) && assignedProfilePhotoUuid !== childData.profile_photo

  if (assignedProfilePhotoUuid || assignedProfileVideoUuid) {
    const adminSupabase = await createAdminClient()
    const childUpdatePayload: { profile_photo?: string | null; profile_video?: string | null } = {}
  
    if (assignedProfilePhotoUuid) {
      if (childData.profile_photo && childData.profile_photo !== assignedProfilePhotoUuid) {
        await adminSupabase
          .from('child_media')
          .update({ usage_type: 'library' })
          .eq('child_id', childId)
          .eq('usage_type', 'profile_picture')
          .neq('id', assignedProfilePhotoUuid)
      }
      childUpdatePayload.profile_photo = assignedProfilePhotoUuid
      changes.push({ field: 'profile_photo', from: childData.profile_photo || '—', to: assignedProfilePhotoUuid })
    }
  
    if (assignedProfileVideoUuid) {
      if (childData.profile_video && childData.profile_video !== assignedProfileVideoUuid) {
        await adminSupabase
          .from('child_media')
          .update({ usage_type: 'library' })
          .eq('child_id', childId)
          .eq('usage_type', 'profile_video')
          .neq('id', assignedProfileVideoUuid)
      }
      childUpdatePayload.profile_video = assignedProfileVideoUuid
      changes.push({ field: 'profile_video', from: childData.profile_video || '—', to: assignedProfileVideoUuid })
    }
  
    await adminSupabase.from('children').update(childUpdatePayload).eq('id', childId)
  }

  if (changes.length > 0) {
    let updatedLog = childData.edit_log || []
    
    const newLogEntry = {
      timestamp: new Date().toISOString(),
      edited_by: actorProfile?.full_name || 'System User', 
      edited_at: new Date().toISOString(),
      profile: {
        id: user.id,
        full_name: actorProfile?.full_name || 'System User',
        role: actorProfile?.role || 'staff',
        country: actorProfile?.country || ''
      },
      changes
    }
    updatedLog = [newLogEntry, ...updatedLog]

    const adminSupabase = await createAdminClient()
    await adminSupabase.from('children').update({ edit_log: updatedLog }).eq('id', childId)
  }

  if (answersUpsertPayload.length > 0) {
    const { error: upsertErr } = await (supabase as any)
      .from('report_answers')
      .upsert(answersUpsertPayload, { onConflict: 'report_id,question_id' })

    if (upsertErr) return { error: `Failed saving sub-answers ledger: ${upsertErr.message}` }
  }

  // ⚡ NEW: Heal the profile cache right before path revalidation
  await recalculateProfileComplete(childId)

  revalidatePath(`/dashboard/children/${childId}`)
  return { error: null, profilePhotoChanged }
}