"use server"

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth'
import { isAdminRole } from '@/lib/profiles'
import type { QuestionInput, IntakeTemplate } from '../components/intake-types'

// intake_templates / template_questions aren't in the generated Database schema,
// so these queries need an escape hatch from the typed client.
/* eslint-disable @typescript-eslint/no-explicit-any */

interface IntakeTemplateRow {
  id: string
  title: string | null
}

// Security Gate verifying true admin scope
async function verifyAdminGate() {
  const { profile } = await requireAuth()
  if (!isAdminRole(profile.role)) {
    throw new Error('Unauthorized: Administrative clearance required.')
  }
}

export async function getIntakeFormsAction() {
  await verifyAdminGate()
  const adminSupabase = await createAdminClient()

  const { data: templates, error } = await adminSupabase
    .from('intake_templates')
    .select('id, title')
    .order('title', { ascending: true })

  if (error) return { error: error.message }
  
  const typedTemplates = (templates || []) as IntakeTemplateRow[]

  const formattedTemplates = typedTemplates.map(t => ({
    id: t.id,
    name: t.title || t.id
  }))

  return { success: true, forms: formattedTemplates }
}

export async function getIntakeTemplates(): Promise<{ data: IntakeTemplate[] | null; error: string | null }> {
  await verifyAdminGate()
  const supabase = createAdminClient()

  const { data, error } = await (supabase
    .from('intake_templates' as any)
    .select(`
      id,
      title,
      country,
      status,
      created_at,
      updated_at,
      template_questions (*)
    `) as any)
    .order('created_at', { ascending: false })

  if (error) {
    return { data: null, error: error.message }
  }

  const typedData = (data as any[])?.map((tpl: any) => {
    if (Array.isArray(tpl.template_questions)) {
      tpl.template_questions.sort((a: any, b: any) => a.sort_order - b.sort_order)
    }
    return tpl as IntakeTemplate
  }) || []

  return { data: typedData, error: null }
}

export async function createIntakeTemplate(title: string, country: string, questions: QuestionInput[]) {
  await verifyAdminGate()
  const supabase = createAdminClient()

  const { data: template, error: tplError } = await (supabase
    .from('intake_templates' as any)
    .insert({ title, country, status: 'active' })
    .select('id')
    .single() as any)

  if (tplError || !template) return { error: tplError?.message || "Failed to create template blueprint." }

  const questionRows = questions.map((q, index) => ({
    template_id: template.id,
    question_text: q.question_text,
    field_type: q.field_type,
    sort_order: index,
    choices: q.field_type === 'select' ? (q.choices?.filter(c => c.trim() !== '') || []) : null
  }))

  const { error: qError } = await (supabase.from('template_questions' as any).insert(questionRows) as any)
  if (qError) return { error: qError.message }

  // ⚡ COMPUTE RECOVERY GATE: Creating a new form means everyone in this target country is instantly incomplete.
  // We use a blind update here which uses near-zero CPU and RAM.
  const matchQuery = country !== 'all' ? { country } : {}
  await (supabase
    .from('children' as any)
    .update({ profile_complete: false })
    .eq('status', 'active')
    .match(matchQuery) as any)

  revalidatePath('/dashboard/settings')
  return { success: true }
}

export async function updateIntakeTemplate(
  templateId: string, 
  title: string, 
  country: string, 
  questions: QuestionInput[]
) {
  await verifyAdminGate()
  const supabase = createAdminClient()

  // 0. Fetch the existing template configuration to detect scope changes
  const { data: existingTpl } = await (supabase
    .from('intake_templates' as any)
    .select('country')
    .eq('id', templateId)
    .single() as any)

  const oldCountry = existingTpl?.country || 'all'
  const countryScopeChanged = oldCountry !== country

  // 1. Update the base template details (non-destructively)
  const { error: tplError } = await (supabase
    .from('intake_templates' as any)
    .update({ title, country, updated_at: new Date().toISOString() })
    .eq('id', templateId) as any)

  if (tplError) return { error: tplError.message }

  // 2. Fetch all current questions in the database for this template
  const { data: existingQs } = await (supabase
    .from('template_questions' as any)
    .select('id, question_text, field_type')
    .eq('template_id', templateId) as any)

  const existingQsMap = new Map<string, any>((existingQs || []).map((q: any) => [q.id, q]))
  const existingIds = Array.from(existingQsMap.keys())
  const incomingIds = questions.map(q => q.id).filter(Boolean) as string[]

  // Determine modification scope for compute optimizations
  const hasNewQuestions = questions.some(q => !q.id)
  const idsToDelete = existingIds.filter((id: string) => !incomingIds.includes(id))
  const hasDeletedQuestions = idsToDelete.length > 0

  // 3. Prevent Deletion Check of Existing Questions
  if (hasDeletedQuestions) {
    const { data: linkedAnswers, error: checkError } = await (supabase
      .from('report_answers' as any)
      .select('question_id')
      .in('question_id', idsToDelete) as any)

    if (checkError) return { error: checkError.message }

    if (linkedAnswers && linkedAnswers.length > 0) {
      const blockedId = linkedAnswers[0].question_id
      const blockedQ = existingQsMap.get(blockedId)
      const qText = blockedQ ? `"${blockedQ.question_text}"` : "selected questions"

      return { 
        error: `Deletion Blocked: The question ${qText} cannot be removed because it already has active student/applicant answers.` 
      }
    }

    const { error: delError } = await (supabase
      .from('template_questions' as any)
      .delete()
      .in('id', idsToDelete) as any)

    if (delError) return { error: delError.message }
  }

  // 4. Validate that existing questions with answers do not have their type changed
  const questionsWithChangedTypes = questions.filter(q => {
    if (!q.id) return false // New questions are fine
    const databaseQ = existingQsMap.get(q.id)
    return databaseQ && databaseQ.field_type !== q.field_type
  })

  if (questionsWithChangedTypes.length > 0) {
    const changedIds = questionsWithChangedTypes.map(q => q.id) as string[]
    
    // Check if any of these modified questions already have answers in the database
    const { data: activeAnswers, error: answerCheckError } = await (supabase
      .from('report_answers' as any)
      .select('question_id')
      .in('question_id', changedIds)
      .limit(1) as any)

    if (answerCheckError) return { error: answerCheckError.message }

    if (activeAnswers && activeAnswers.length > 0) {
      const blockedId = activeAnswers[0].question_id
      const blockedQ = existingQsMap.get(blockedId)
      const qText = blockedQ ? `"${blockedQ.question_text}"` : "selected questions"

      return {
        error: `Type Lock active: Cannot change the answer type of ${qText} because answers have already been submitted for it.`
      }
    }
  }

  // 5. Save and update questions
  for (let index = 0; index < questions.length; index++) {
    const q = questions[index]
    const row = {
      template_id: templateId,
      question_text: q.question_text,
      field_type: q.field_type,
      sort_order: index,
      choices: q.field_type === 'select' ? (q.choices?.filter(c => c.trim() !== '') || []) : null
    }

    if (q.id) {
      const { error: upError } = await (supabase
        .from('template_questions' as any)
        .update(row)
        .eq('id', q.id) as any)

      if (upError) return { error: upError.message }
    } else {
      const { error: insError } = await (supabase
        .from('template_questions' as any)
        .insert(row) as any)

      if (insError) return { error: insError.message }
    }
  }

  // ⚡ COMPUTE RECOVERY GATES: Evaluate the exact criteria to protect quotas
  const needsBlindReset = hasNewQuestions
  const needsFullRecompute = hasDeletedQuestions || countryScopeChanged

  if (needsBlindReset) {
    // 🟢 OPTIMIZATION 1: A blind write of FALSE takes 1-2ms and virtually 0 compute.
    const matchQuery = country !== 'all' ? { country } : {}
    await (supabase
      .from('children' as any)
      .update({ profile_complete: false })
      .eq('status', 'active')
      .match(matchQuery) as any)
    
    // If the country scope changed simultaneously, we still need to heal the OLD country
    if (countryScopeChanged) {
      await supabase.rpc('bulk_recalculate_profile_complete', { target_country: oldCountry })
    }
  } else if (needsFullRecompute) {
    // 🟡 OPTIMIZATION 2: Heavy evaluation engine for deletes/scope changes
    await supabase.rpc('bulk_recalculate_profile_complete', { target_country: country })

    if (countryScopeChanged) {
      await supabase.rpc('bulk_recalculate_profile_complete', { target_country: oldCountry })
    }
  }
  // 🔵 OPTIMIZATION 3: If they just edited question text, choices, types, or order, 
  // both IF blocks are skipped entirely. Compute impact = Absolute Zero.

  revalidatePath('/dashboard/settings')
  return { success: true }
}

export async function toggleTemplateStatus(id: string, currentStatus: 'active' | 'inactive') {
  await verifyAdminGate()
  const supabase = createAdminClient()
  const nextStatus = currentStatus === 'active' ? 'inactive' : 'active'

  const { data: tpl } = await (supabase
    .from('intake_templates' as any)
    .select('country')
    .eq('id', id)
    .single() as any)

  const { error } = await (supabase
    .from('intake_templates' as any)
    .update({ status: nextStatus })
    .eq('id', id) as any)

  // ⚡ Activating or deactivating a form immediately triggers a bulk recompute for its target scope
  if (!error && tpl) {
    await supabase.rpc('bulk_recalculate_profile_complete', { target_country: tpl.country })
  }

  revalidatePath('/dashboard/settings')
  return { error: error?.message || null }
}

export async function deleteTemplate(id: string) {
  await verifyAdminGate()
  const supabase = createAdminClient()

  // 1. Fetch the target country before deleting to handle cache recalculation
  const { data: tpl } = await (supabase
    .from('intake_templates' as any)
    .select('country')
    .eq('id', id)
    .single() as any)

  // 2. Find all question IDs belonging to this template
  const { data: templateQuestions } = await (supabase
    .from('template_questions' as any)
    .select('id')
    .eq('template_id', id) as any)

  const questionIds = (templateQuestions || []).map((q: any) => q.id)

  if (questionIds.length > 0) {
    // 3. Prevent deletion if any question has entries inside report_answers
    const { data: linkedAnswers, error: checkError } = await (supabase
      .from('report_answers' as any)
      .select('id')
      .in('question_id', questionIds)
      .limit(1) as any)

    if (checkError) return { error: checkError.message }

    if (linkedAnswers && linkedAnswers.length > 0) {
      return { 
        error: "Deletion Blocked: Cannot delete this form template because it contains submitted student/applicant responses." 
      }
    }
  }

  // 4. Safe to proceed with deletion if no answer relationships exist
  const { error } = await (supabase
    .from('intake_templates' as any)
    .delete()
    .eq('id', id) as any)

  // ⚡ 5. Deleting a form removes requirements, triggering a healing recomputation for that scope
  if (!error && tpl) {
    await supabase.rpc('bulk_recalculate_profile_complete', { target_country: tpl.country })
  }

  if (error) return { error: error.message }

  revalidatePath('/dashboard/settings')
  return { error: null }
}

export async function getIntakeCountries(): Promise<string[]> {
  await verifyAdminGate()
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('countries')
    .select('name')
    .order('name', { ascending: true })

  if (error || !data) {
    console.error('❌ INTAKE COUNTRIES ACTION:', error?.message)
    return []
  }
  return data.map((row) => row.name)
}

export async function getLockedQuestionIds(templateId: string): Promise<{ ids: string[]; error: string | null }> {
  await verifyAdminGate()
  const supabase = createAdminClient()

  // 1. Fetch all questions for this template
  const { data: questions, error: qError } = await (supabase
    .from('template_questions' as any)
    .select('id')
    .eq('template_id', templateId) as any)

  if (qError) return { ids: [], error: qError.message }
  const qIds = (questions || []).map((q: any) => q.id)

  if (qIds.length === 0) return { ids: [], error: null }

  // 2. Fetch distinct question_ids that have responses in report_answers
  const { data: answers, error: aError } = await (supabase
    .from('report_answers' as any)
    .select('question_id')
    .in('question_id', qIds) as any)

  if (aError) return { ids: [], error: aError.message }

  const lockedIds = Array.from(new Set((answers || []).map((ans: any) => ans.question_id))) as string[]
  return { ids: lockedIds, error: null }
}