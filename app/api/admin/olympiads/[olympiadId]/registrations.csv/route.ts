// CSV download for an olympiad's registrations.
//
// Flattens every registrant's answers into one row. Built-in columns
// (name, phone, etc.) + one column per question on the olympiad's
// form-graph question node (MCQ: chosen option id, short-answer: the
// text, photo: the URL) + custom answers + exam timing + score columns.
//
// Output: text/csv with CRLF newlines. Filename:
//   ndsc-olympiad-<olympiadId>-<YYYYMMDD>.csv

import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/api/admin-auth'
import { apiError } from '@/lib/api/response'
import { normalizeBlocks } from '@/lib/formBlocks'
import { rowsToCsv, dedupHeaders } from '@/lib/csv'

type Ctx = { params: Promise<{ olympiadId: string }> }

export async function GET(_req: NextRequest, ctx: Ctx) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized
  const { olympiadId } = await ctx.params
  if (!olympiadId) return apiError('olympiadId is required.', 400)

  // Load the form graph so we know the question set — questions live on
  // its preset_olympiad_questions node(s), not on the olympiad row.
  const [{ data: graph }, { data: regs, error: rErr }] = await Promise.all([
    supabaseAdmin.from('form_graphs').select('id').eq('owner_kind', 'olympiad').eq('owner_id', olympiadId).maybeSingle(),
    supabaseAdmin.from('olympiad_registrations')
      .select('id, full_name, phone, email, college, college_roll, hsc_session, batch, group_name, custom_answers, short_answers, mcq_answers, photo_answers, exam_started_at, exam_submitted_at, mcq_score, final_score, created_at, form_graph_id')
      .eq('olympiad_id', olympiadId)
      .order('created_at', { ascending: false }),
  ])
  if (rErr) return apiError(rErr, 400)

  // Derive question columns from ALL fields on the form graph (except those on
  // identity nodes: preset_common_details and preset_team_info). We use a Map<key,
  // label> to keep the column header stable.
  const questionHeaderByKey = new Map<string, { header: string; type: string }>()
  const IDENTITY_NODE_KINDS = new Set(['preset_common_details', 'preset_team_info'])
  function addQuestions(blocks: any[]) {
    for (const f of normalizeBlocks(blocks)) {
      if (f.kind !== 'field') continue
      // Include ALL field types as question columns
      const k = f.key || f.id
      if (!k) continue
      if (!questionHeaderByKey.has(k)) {
        questionHeaderByKey.set(k, { header: f.label || k, type: f.type })
      }
    }
  }
  if (graph) {
    const { data: nodes } = await supabaseAdmin
      .from('form_nodes').select('fields, kind').eq('graph_id', graph.id)
    for (const n of nodes || []) {
      // Skip identity nodes — their fields aren't exam questions
      if (IDENTITY_NODE_KINDS.has((n as any).kind)) continue
      addQuestions(n.fields || [])
    }
  }

  const questionHeaders: string[] = []
  const questionKeyByHeader = new Map<string, string>()
  for (const [k, v] of questionHeaderByKey) {
    questionHeaders.push(v.header)
    questionKeyByHeader.set(v.header, k)
  }

  const headers = dedupHeaders([
    'Registration ID',
    'Created At',
    'Exam Started',
    'Exam Submitted',
    'MCQ Score',
    'Final Score',
    'Full Name',
    'Phone',
    'Email',
    'College',
    'College Roll',
    'HSC Session',
    'Batch',
    'Group',
    ...questionHeaders,
  ])

  const rows = (regs || []).map((r: any) => {
    const mcq: Record<string, any> = r.mcq_answers || {}
    const short: Record<string, any> = r.short_answers || {}
    const photo: string[] = Array.isArray(r.photo_answers) ? r.photo_answers : []
    const custom: Record<string, any> = r.custom_answers || {}

    const questionRow = questionHeaders.map(h => {
      const k = questionKeyByHeader.get(h) || ''
      // Check the dedicated columns first (mcq_answers, short_answers,
      // photo_answers) for backward compatibility, then fall back to
      // custom_answers for all other field types.
      const v = mcq[k] ?? short[k] ?? custom[k]
      if (v === undefined) {
        // Photo: legacy format where photo URLs were stored as an array at
        // the top level. Check if any of them belong to this question.
        if (questionHeaderByKey.get(k)?.type === 'photo') {
          return photo.join(' | ')
        }
        return ''
      }
      if (Array.isArray(v)) return v.join(' | ')
      return String(v)
    })

    return [
      r.id,
      r.created_at,
      r.exam_started_at || '',
      r.exam_submitted_at || '',
      r.mcq_score ?? '',
      r.final_score ?? '',
      r.full_name || '',
      r.phone || '',
      r.email || '',
      r.college || '',
      r.college_roll || '',
      r.hsc_session || '',
      r.batch || '',
      r.group_name || '',
      ...questionRow,
    ]
  })

  const csv = rowsToCsv(headers, rows)
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="ndsc-olympiad-${olympiadId.slice(0, 8)}-${date}.csv"`,
    },
  })
}
