"use server"

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import type { QuestionInput, IntakeTemplate } from '../components/intake-types'

export async function getIntakeTemplates(): Promise<{ data: IntakeTemplate[] | null; error: string | null }> {
    const supabase = createAdminClient()

    // 🌟 Force the builder to treat this as a generic endpoint query
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

    revalidatePath('/dashboard/settings')
    return { success: true }
}

export async function updateIntakeTemplate(templateId: string, title: string, country: string, questions: QuestionInput[]) {
    const supabase = createAdminClient()

    const { error: tplError } = await (supabase
        .from('intake_templates' as any)
        .update({ title, country, updated_at: new Date().toISOString() })
        .eq('id', templateId) as any)

    if (tplError) return { error: tplError.message }

    // Clear previous configurations cleanly
    await (supabase.from('template_questions' as any).delete().eq('template_id', templateId) as any)

    const questionRows = questions.map((q, index) => ({
        template_id: templateId,
        question_text: q.question_text,
        field_type: q.field_type,
        sort_order: index,
        choices: q.field_type === 'select' ? (q.choices?.filter(c => c.trim() !== '') || []) : null
    }))

    const { error: qError } = await (supabase.from('template_questions' as any).insert(questionRows) as any)
    if (qError) return { error: qError.message }

    revalidatePath('/dashboard/settings')
    return { success: true }
}

export async function toggleTemplateStatus(id: string, currentStatus: 'active' | 'inactive') {
    const supabase = createAdminClient()
    const nextStatus = currentStatus === 'active' ? 'inactive' : 'active'

    const { error } = await (supabase
        .from('intake_templates' as any)
        .update({ status: nextStatus })
        .eq('id', id) as any)

    revalidatePath('/dashboard/settings')
    return { error: error?.message || null }
}

export async function deleteTemplate(id: string) {
    const supabase = createAdminClient()
    const { error } = await (supabase.from('intake_templates' as any).delete().eq('id', id) as any)

    revalidatePath('/dashboard/settings')
    return { error: error?.message || null }
}

export async function getIntakeCountries(): Promise<string[]> {
    const supabase = createAdminClient()
    const { data, error } = await (supabase
        .from('countries' as any)
        .select('name')
        .order('name', { ascending: true }) as any)

    if (error || !data) {
        console.error('❌ INTAKE COUNTRIES ACTION:', error?.message)
        return []
    }
    return (data as any[]).map((row) => row.name)
}