"use server"

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * Evaluates template list filtering rules and joins relational submission states
 */
export async function getEligibleIntakeForms(childId: string, childCountry: string, dateJoinedStr: string | null, yearJoinedNum: number | null) {
  const supabase = await createClient()

  // 1. Resolve child's baseline start date threshold metrics
  let joinDateThreshold: Date | null = null
  if (dateJoinedStr) {
    joinDateThreshold = new Date(dateJoinedStr)
  } else if (yearJoinedNum) {
    joinDateThreshold = new Date(yearJoinedNum, 0, 1)
  }

  // 2. Fetch all templates matching scope rules from latest to oldest
  const { data: templates } = await (supabase as any)
    .from('intake_templates')
    .select(`
      *,
      template_questions (*)
    `)
    .order('created_at', { ascending: false })

  if (!templates) return { eligibleForms: [], latestCompleted: false }

  // 3. Fetch all existing relational progress reports and answers submitted for this specific child
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

  // 4. Transform relational results into a searchable record map
  const submissionMap: Record<string, Record<string, string>> = {}
  existingReports?.forEach((report: any) => {
    const answersObj: Record<string, string> = {}
    
    report.report_answers?.forEach((ans: any) => {
      answersObj[ans.question_id] = ans.answer_value
    })
    submissionMap[report.template_id] = answersObj
  })

  // 5. Apply filtering sequence rules
  const eligibleForms = templates.map((tpl: any) => {
    const isTargetRegion = tpl.country === 'all' || tpl.country === childCountry
    const templateCreatedAt = new Date(tpl.created_at)
    const isTimelineEligible = !joinDateThreshold || templateCreatedAt >= joinDateThreshold

    if (!isTargetRegion || !isTimelineEligible) return null

    const questionsList = tpl.template_questions || []
    const savedQuestionAnswers = submissionMap[tpl.id] || {}

    // Map answer states matched explicitly to target relational database Question IDs
    const componentViewAnswers: Record<string, string> = {}
    questionsList.forEach((q: any) => {
      componentViewAnswers[q.question_text] = savedQuestionAnswers[q.id] || ""
    })

    const isFinished = questionsList.length > 0 && questionsList.every((q: any) => {
      const ans = savedQuestionAnswers[q.id]
      return ans !== undefined && ans !== null && ans.trim() !== ""
    })

    return {
      id: tpl.id,
      title: tpl.title,
      createdAt: tpl.created_at,
      questions: questionsList,
      answers: componentViewAnswers,
      isCompleted: isFinished,
      isLatest: false
    }
  }).filter(Boolean) as any[]

  if (eligibleForms.length > 0) {
    eligibleForms[0].isLatest = true
  }

  const latestCompleted = eligibleForms.length > 0 ? eligibleForms[0].isCompleted : true

  return { eligibleForms, latestCompleted }
}

/**
 * Saves input matrices directly into progress_reports and report_answers tables
 * and correctly logs custom delta tracking lines into your child edit_log array.
 */
export async function saveIntakeFormAction(
  childId: string,
  templateId: string,
  formTitle: string,
  newAnswers: Record<string, string>
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Authentication session expired." }

  // 1. Fetch metadata profiles and child record details to generate the edit logs properly
  const [profileRes, childRes] = await Promise.all([
    supabase.from('profiles').select('full_name, role, country').eq('id', user.id).single(),
    (supabase as any).from('children').select('*').eq('id', childId).single()
  ])

  if (childRes.error || !childRes.data) return { error: "Child record targeted could not be found." }
  
  const actorProfile = profileRes.data
  const childData = childRes.data

  // 2. Resolve Master Question IDs associated with this template profile layout
  const { data: dbQuestions } = await (supabase as any)
    .from('template_questions')
    .select('id, question_text')
    .eq('template_id', templateId)

  if (!dbQuestions) return { error: "Failed to resolve blueprint master questions setup." }

  // 3. Look up or upsert a parent transaction header inside progress_reports
  let { data: existingReport } = await (supabase as any)
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

  // 4. Pull original answers submitted previously to build audit comparison changes
  const { data: oldAnswersList } = await (supabase as any)
    .from('report_answers')
    .select('question_id, answer_value')
    .eq('report_id', reportId)

  const priorAnswersMap: Record<string, string> = {}
  oldAnswersList?.forEach((ans: any) => {
    priorAnswersMap[ans.question_id] = ans.answer_value
  })

  // 5. Evaluate modifications and schedule clean transaction arrays
  const changes: Array<{ field: string; from: any; to: any }> = []
  const answersUpsertPayload: any[] = []

  dbQuestions.forEach((q: any) => {
    const clientValue = newAnswers[q.question_text] || ""
    const oldValue = priorAnswersMap[q.id] || ""

    const cleanOld = oldValue.trim() ? oldValue.trim() : "—"
    const cleanNew = clientValue.trim() ? clientValue.trim() : "—"

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
      answer_value: clientValue
    })
  })

  // 6. If mutations are captured, append transaction details onto edit_log matching global structures
  if (changes.length > 0) {
    let updatedLog = childData.edit_log || []
    
    const newLogEntry = {
      timestamp: new Date().toISOString(),
      edited_by: actorProfile?.full_name || 'System User', // Match explicit project types
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

    // Save changes into the child's edit log tracking column using a loose query structure
    await (supabase as any)
      .from('children')
      .update({ edit_log: updatedLog })
      .eq('id', childId)
  }

  // 7. Bulk execute answer writes to report_answers table
  if (answersUpsertPayload.length > 0) {
    const { error: upsertErr } = await (supabase as any)
      .from('report_answers')
      .upsert(answersUpsertPayload, { onConflict: 'report_id,question_id' })

    if (upsertErr) return { error: `Failed saving sub-answers ledger: ${upsertErr.message}` }
  }

  revalidatePath(`/dashboard/children/${childId}`)
  return { error: null }
}