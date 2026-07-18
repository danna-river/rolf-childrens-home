import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { isAdminRole } from '@/lib/profiles'

// 1. Explicitly type our schema-matched entities to defeat 'never[]' inference
interface TemplateQuestion {
  id: string
  question_text: string
  field_type: string // 🌟 Added field_type to identify media questions
}

interface JoinedChild {
  id_rolf: string | null
  first_name: string | null
  last_name: string | null
}

interface JoinedAnswer {
  question_id: string
  answer_value: string | null
}

interface ProgressReportRow {
  id: string
  children: JoinedChild | JoinedChild[] | null
  report_answers: JoinedAnswer[] | null
}

async function verifyAdminGate() {
  const { profile } = await requireAuth()
  if (!isAdminRole(profile.role)) {
    throw new Error('Unauthorized: Administrative clearance required.')
  }
}

function escapeCSVValue(val: any): string {
  if (val === null || val === undefined) return ''
  const str = String(val)
  return `"${str.replace(/"/g, '""')}"`
}

export async function GET(request: NextRequest) {
  try {
    await verifyAdminGate()

    const { searchParams } = request.nextUrl
    const formId = searchParams.get('formId')

    if (!formId) {
      return NextResponse.json({ error: 'Missing required parameter: formId' }, { status: 400 })
    }

    const supabase = await createClient()

    // 1. Fetch questions (🌟 Now including field_type)
    const { data: rawQuestions, error: questionsError } = await supabase
      .from('template_questions')
      .select('id, question_text, field_type')
      .eq('template_id', formId)
      .order('sort_order', { ascending: true })

    if (questionsError) {
      return NextResponse.json({ error: questionsError.message }, { status: 400 })
    }

    const questions = (rawQuestions || []) as TemplateQuestion[]

    if (questions.length === 0) {
      return new Response('No questions found for this intake template.', { status: 404 })
    }

    // 🌟 Identify which question IDs correspond to media uploads
    const mediaQuestionIds = new Set(
      questions
        .filter(q => q.field_type === 'media_photo' || q.field_type === 'media_video')
        .map(q => q.id)
    )

    // 2. Fetch submissions with inner joins
    const { data: rawReports, error: reportsError } = await supabase
      .from('progress_reports')
      .select(`
        id,
        children!inner (
          id_rolf,
          first_name,
          last_name
        ),
        report_answers (
          question_id,
          answer_value
        )
      `)
      .eq('template_id', formId)

    if (reportsError) {
      return NextResponse.json({ error: reportsError.message }, { status: 400 })
    }

    const reports = (rawReports || []) as unknown as ProgressReportRow[]

    if (reports.length === 0) {
      return new Response('No submissions found for this template.', { status: 404 })
    }

    // 🌟 3. Bulk fetch media URLs to replace UUIDs
    const mediaUuidsToFetch = new Set<string>()
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

    // Scan all answers to find UUIDs that belong to media questions
    for (const report of reports) {
      for (const ans of (report.report_answers || [])) {
        if (mediaQuestionIds.has(ans.question_id) && ans.answer_value && uuidRegex.test(ans.answer_value)) {
          mediaUuidsToFetch.add(ans.answer_value)
        }
      }
    }

    // Dictionary to map Media UUID -> Drive URL
    const mediaUrlLookup = new Map<string, string>()

    if (mediaUuidsToFetch.size > 0) {
      // Execute a single batch query instead of querying per row
      const { data: mediaData } = await supabase
        .from('child_media')
        .select('id, url')
        .in('id', Array.from(mediaUuidsToFetch))

      if (mediaData) {
        for (const media of mediaData) {
          if (media.url) mediaUrlLookup.set(media.id, media.url)
        }
      }
    }

    // 4. Build CSV Headers
    const dynamicHeaders = questions.map((q) => q.question_text)
    const csvHeaders = ['ROLF ID', 'First Name', 'Last Name', ...dynamicHeaders]
    
    const csvRows = [csvHeaders.join(',')]

    // 5. Map each submission to a row with complete type-safety
    for (const report of reports) {
      const childData = Array.isArray(report.children) 
        ? report.children[0] 
        : report.children
      
      const child: Partial<JoinedChild> = childData || {}
      
      const rolfId = child.id_rolf || ''
      const firstName = child.first_name || ''
      const lastName = child.last_name || ''

      const answersList = report.report_answers || []
      const answerLookup = new Map<string, string>()
      answersList.forEach((ans) => {
        answerLookup.set(ans.question_id, ans.answer_value || '')
      })

      // Map dynamic values safely mapping via the question id matching
      const dynamicValues = questions.map((q) => {
        let value = answerLookup.get(q.id) || ''
        
        // 🌟 If this question is a media type, swap the UUID for the actual Drive URL
        if (mediaQuestionIds.has(q.id) && mediaUrlLookup.has(value)) {
          value = mediaUrlLookup.get(value)!
        }

        return escapeCSVValue(value)
      })

      const rowValues = [
        escapeCSVValue(rolfId),
        escapeCSVValue(firstName),
        escapeCSVValue(lastName),
        ...dynamicValues
      ]

      csvRows.push(rowValues.join(','))
    }

    const csvContent = '\ufeff' + csvRows.join('\n')

    return new Response(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="intake_form_export_${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unauthorized' }, { status: 403 })
  }
}