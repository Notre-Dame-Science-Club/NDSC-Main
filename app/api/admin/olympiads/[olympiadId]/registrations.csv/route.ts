// CSV download for an olympiad's registrations.
//
// Flattens every registrant's answers into one row. Built-in columns
// (name, phone, etc.) + one column per MCQ question (option text not
// included, just the chosen option id) + one column per short-answer
// question (the text) + one column per photo question (the URL) +
// custom answers + exam timing + score columns.
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

  // Load the olympiad so we can read the legacy `questions` JSONB
  // (v1 registrations still use that). Also load the form graph (v2)
  // so we know the question set for v2 registrations.
  const [{ data: olympiad }, { data: graph }, { data: regs, error: rErr }] = await Promise.all([
    supabaseAdmin.from('olympiads').select('id, questions, registration_fields').eq('id', olympiadId).maybeSingle(),
    supabaseAdmin.from('form_graphs').select('id').eq('owner_kind', 'olympiad').eq('owner_id', olympiadId).maybeSingle(),
    supabaseAdmin.from('olympiad_registrations')
      .select('id, full_name, phone, email, college, college_roll, hsc_session, batch, group_name, custom_answers, short_answers, mcq_answers, photo_answers, exam_started_at, exam_submitted_at, mcq_score, final_score, created_at, form_graph_id')
      .eq('olympiad_id', olympiadId)
      .order('created_at', { ascending: false }),
  ])
  if (rErr) return apiError(rErr, 400)

  // Derive question columns. For v1, read olympiad.questions directly.
  // For v2, read the form graph's questions node. We use a Map<key,
  // label> to keep the column header stable.
  const questionHeaderByKey = new Map<string, { header: string; type: string }>()
  function addQuestions(blocks: any[]) {
    for (const f of normalizeBlocks(blocks)) {
      if (f.kind !== 'field') continue
      if (f.type !== 'mcq' && f.type !== 'checkbox' && f.type !== 'short_answer' && f.type !== 'photo') continue
      const k = f.key || f.id
      if (!k) continue
      if (!questionHeaderByKey.has(k)) {
        questionHeaderByKey.set(k, { header: f.label || k, type: f.type })
      }
    }
  }
  if (graph) {
    const { data: nodes } = await supabaseAdmin
      .from('form_nodes').select('fields').eq('graph_id', graph.id)
    for (const n of nodes || []) addQuestions(n.fields || [])
  }
  if (olympiad?.questions) addQuestions(olympiad.questions as any)
  // v1 olympiads also had registration_fields (text/email/tel/select).
  // These got merged into custom_answers on submit; we add a column per
  // field too so v1 registrations show them.
  if (Array.isArray(olympiad?.registration_fields)) {
    for (const f of olympiad!.registration_fields as any[]) {
      const k = f.key || f.id
      if (!k) continue
      if (!questionHeaderByKey.has(k)) {
        questionHeaderByKey.set(k, { header: f.label || k, type: f.type || 'text' })
      }
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
      // Look in mcq_answers first, then short_answers, then photo_answers,
      // then custom_answers. For checkbox/multi the value is an array;
      // we join with | so spreadsheets show something readable.
      const v = mcq[k] ?? short[k] ?? custom[k]
      if (v === undefined) {
        // Photo: count if any of the photo URLs came from this question.
        // Without per-question keying we can't split photos, so we just
        // count them per registrant in a single column. To keep headers
        // simple we only put photo links into the column whose key is
        // marked as photo type.
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
