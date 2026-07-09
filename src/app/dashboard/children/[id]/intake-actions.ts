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

function buildServerFilename(childData: any, type: "photo" | "video", ext: string): string {
  const now = new Date()
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "")
  const ms = Date.now()
  const microfraction = String(ms % 1000).padStart(3, '0')
  return `${childData.id_rolf ? sanitize(childData.id_rolf) : "unknown"}_${childData.last_name ? sanitize(childData.last_name) : ""}_${childData.first_name ? sanitize(childData.first_name) : ""}_${type}_${dateStr}-${ms}${microfraction}.${ext.toLowerCase()}`
}

export async function getEligibleIntakeForms(childId: string, childCountry: string, dateJoinedStr: string | null, yearJoinedNum: number | null) {
  const supabase = await createClient()

  let joinDateThreshold: Date | null = null
  if (dateJoinedStr) {
    joinDateThreshold = new Date(dateJoinedStr)
  } else if (yearJoinedNum) {
    joinDateThreshold = new Date(yearJoinedNum, 0, 1)
  }

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

  if (!templates) return { eligibleForms: [], latestCompleted: false }

  // 1. Fetch reports WITHOUT the child_media join to prevent strict-FK query crashes
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

  // 2. Fetch media separately to resolve UUIDs back into viewable URLs
  const { data: childMediaData } = await supabase.from('child_media').select('id, url').eq('child_id', childId)
  const mediaMap: Record<string, { id: string; url: string }> = {}
  const mediaByUrl: Record<string, { id: string; url: string }> = {}
  childMediaData?.forEach((m: any) => {
    mediaMap[m.id] = m
    mediaByUrl[m.url] = m
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

  const eligibleForms = templates.map((tpl: any) => {
    const isTargetRegion = tpl.country === 'all' || tpl.country === childCountry
    const templateCreatedAt = new Date(tpl.created_at)
    const isTimelineEligible = !joinDateThreshold || templateCreatedAt >= joinDateThreshold

    if (!isTargetRegion || !isTimelineEligible) return null

    const questionsList = tpl.template_questions || []
    const savedQuestionAnswers = submissionMap[tpl.id] || {}

    const componentViewAnswers: Record<string, string> = {}
    const componentMediaIds: Record<string, string> = {}
    const lockedQuestionsList: string[] = []

    questionsList.forEach((q: any) => {
      const savedData = savedQuestionAnswers[q.id]
      
      // Strict Database Lock Check: Lock immediately if answer_value has any string.
      if (savedData && savedData.value && savedData.value.trim() !== "") {
        lockedQuestionsList.push(q.id)
      }

      if (q.field_type === 'media_photo' || q.field_type === 'media_video') {
        componentViewAnswers[q.id] = savedData?.url || savedData?.value || ""
        if (savedData?.mediaId) componentMediaIds[q.id] = savedData.mediaId
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
      questions: questionsList,
      answers: componentViewAnswers,
      mediaIds: componentMediaIds,
      lockedQuestions: lockedQuestionsList,
      isCompleted: isFinished,
      isLatest: false
    }
  }).filter(Boolean)

  if (eligibleForms.length > 0) {
    eligibleForms[0].isLatest = true
  }

  const latestCompleted = eligibleForms.length > 0 ? eligibleForms[0].isCompleted : true

  return { eligibleForms, latestCompleted }
}

export async function saveIntakeFormAction(
  childId: string,
  templateId: string,
  formTitle: string,
  newAnswers: Record<string, string>,
  stagedDriveFileIds?: string[]
) {
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

  // Fetch answers without problematic joins
  const { data: oldAnswersList } = await (supabase as any)
    .from('report_answers')
    .select('question_id, answer_value')
    .eq('report_id', reportId)

  // Secondary fetch for comparison map
  const { data: childMediaData } = await supabase.from('child_media').select('id, url').eq('child_id', childId)
  const mediaMap: Record<string, string> = {}
  childMediaData?.forEach((m: any) => {
    mediaMap[m.id] = m.url
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

  for (const q of dbQuestions) {
    const clientValue = newAnswers[q.id] || ""
    const oldRawValue = priorAnswersMap[q.id] || ""
    const oldMediaUrl = priorMediaUrlsMap[q.id] || ""

    let finalAnswerValue = clientValue
    const isMediaField = q.field_type === 'media_photo' || q.field_type === 'media_video'

    if (isMediaField) {
      if (clientValue.startsWith('http')) {
        if (clientValue === oldMediaUrl) {
          finalAnswerValue = oldRawValue
        } else {
          const determinedType = q.field_type === 'media_video' ? 'video' : 'photo'
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
              usage_type: 'intake',
              filename: generatedFilename,
              uploaded_by: user.id
            })
            .select('id')
            .single()

          if (mediaRecord) {
            finalAnswerValue = mediaRecord.id
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

  revalidatePath(`/dashboard/children/${childId}`)
  return { error: null }
}
