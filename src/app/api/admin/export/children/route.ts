import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { escapeCSVValue } from '@/lib/csv'
import { isAdminRole } from '@/lib/profiles'

// Security gate helper matching your admin action standard
async function verifyAdminGate() {
    const { profile } = await requireAuth()
    if (!isAdminRole(profile.role)) {
        throw new Error('Unauthorized: Administrative clearance required.')
    }
}

export async function GET() {
    try {
        await verifyAdminGate()

        const supabase = await createClient()
        const { data: children, error } = await supabase
            .from('children')
            .select('*')
            .order('created_at', { ascending: false })

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }

        if (!children || children.length === 0) {
            return new Response('No data found.', { status: 404 })
        }

        // Extract dynamic headers from any keys present in the children rows
        const headers = Object.keys(children[0])
        const csvRows = [headers.join(',')]

        for (const child of children) {
            //   Type-safe fix using keyof:
            const row = headers.map((header) => {
                const value = child[header as keyof typeof child]
                return escapeCSVValue(value)
            })
            csvRows.push(row.join(','))
        }

        const csvContent = csvRows.join('\n')

        return new Response(csvContent, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="children_export_${new Date().toISOString().slice(0, 10)}.csv"`,
            },
        })
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unauthorized'
        return NextResponse.json({ error: message }, { status: 403 })
    }
}
