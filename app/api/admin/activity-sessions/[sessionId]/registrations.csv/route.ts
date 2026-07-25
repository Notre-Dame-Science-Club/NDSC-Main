// CSV download for an activity session's registrations.
//
// Resolves the form graph (new) AND the category tree (legacy), then
// flattens every registrant's answers into one row. The column set is
// derived from the union of: top-level built-ins + every custom field
// key used in any node/category's form_field_schema. We include team
// members as separate columns (team_1_name, team_1_email, ...) since
// admins want to see them in spreadsheets.
//
// Output: text/csv with CRLF newlines (Excel-friendly). Filename:
//   ndsc-activity-<sessionId>-<YYYYMMDD>.csv
//
// We deliberately don't include the olympiad-only fields
// (mcq_answers, short_answers, etc.) — those belong to the olympiad
// CSV endpoint.

import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/api/admin-auth'
import { apiError } from '@/lib/api/response'
import { normalizeBlocks, BuiltinFieldKey, HARD_MINIMUM_KEYS } from '@/lib/formBlocks'
import { rowsToCsv, dedupHeaders } from '@/lib/csv'

type Ctx = { params: Promise<{ sessionId: string }> }

const BUILTIN_HEADERS: { key: BuiltinFieldKey; header: string }[] = [
  { key: 'full_name', header: 'Full Name' },
  { key: 'phone', header: 'Phone' },
  { key: 'email', header: 'Email' },
  { key: 'college', header: 'College' },
  { key: 'college_roll', header: 'College Roll' },
  { key: 'hsc_session', header: 'HSC Session' },
  { key: 'division', header: 'Division' },
]

const MAX_TEAM_COLUMNS = 12

export async function GET(_req: NextRequest, ctx: Ctx) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized
  const { sessionId } = await ctx.params
  if (!sessionId) return apiError('sessionId is required.', 400)

  // Load the form graph (new) + categories (legacy) so we cover both
  // v1 and v2 registrations in the same file.
  const [{ data: graph }, { data: categories }, { data: regs, error: rErr }] = await Promise.all([
    supabaseAdmin.from('form_graphs').select('id').eq('owner_kind', 'activity').eq('owner_id', sessionId).maybeSingle(),
    supabaseAdmin.from('activity_reg_categories').select('id, name, parent_id, form_field_schema').eq('activity_session_id', sessionId),
    supabaseAdmin.from('activity_registrations')
      .select('id, category_id, form_node_id, form_graph_id, full_name, phone, email, college, college_roll, hsc_session, division, project_name, custom_answers, team_members, payment_status, created_at')
      .eq('activity_session_id', sessionId)
      .order('created_at', { ascending: false }),
  ])
  if (rErr) return apiError(rErr, 400)

  // Build a map of node id → its label (used for the "Form Path" column
  // when a v2 graph is in play).
  const nodeLabelById = new Map<string, string>()
  if (graph) {
    const { data: nodes } = await supabaseAdmin
      .from('form_nodes').select('id, label, parent_id').eq('graph_id', graph.id)
    if (nodes) for (const n of nodes) nodeLabelById.set(n.id, n.label)
  }

  // Derive the set of custom-answer column headers from every node's
  // fields (v2) and every category's form_field_schema (v1). We use the
  // field's `key` (or `id` as fallback) as the column header; if no
  // explicit key we synthesize one from the label. We also keep a
  // header→key map so we can look up the right custom_answers entry
  // for each row.
  const customHeaderToKey = new Map<string, string>()
  const customHeaders: string[] = []
  const seenCustomKeys = new Set<string>()
  function collectCustomFromBlocks(blocks: any[]) {
    for (const f of normalizeBlocks(blocks)) {
      if (f.kind !== 'field') continue
      if ((f as any).is_builtin) continue  // top-level column already covers it
      const k = f.key || f.id
      if (!k) continue
      if (seenCustomKeys.has(k)) continue
      seenCustomKeys.add(k)
      const h = f.label || k
      customHeaders.push(h)
      customHeaderToKey.set(h, k)
    }
  }
  if (graph) {
    const { data: nodes } = await supabaseAdmin
      .from('form_nodes').select('fields').eq('graph_id', graph.id)
    for (const n of nodes || []) collectCustomFromBlocks(n.fields || [])
  }
  for (const c of categories || []) collectCustomFromBlocks(c.form_field_schema || [])

  // Build the header row: builtins + breadcrumb + project + payment +
  // custom + team + form path.
  const headers = dedupHeaders([
    'Registration ID',
    'Created At',
    'Form Path',     // v2: node label; v1: category breadcrumb
    'Is Terminal',   // v2 only
    ...BUILTIN_HEADERS.map(b => b.header),
    'Project Name',
    'Payment Status',
    ...customHeaders,
    ...Array.from({ length: MAX_TEAM_COLUMNS }, (_, i) => `Team ${i + 1} Name`),
    ...Array.from({ length: MAX_TEAM_COLUMNS }, (_, i) => `Team ${i + 1} Email`),
    ...Array.from({ length: MAX_TEAM_COLUMNS }, (_, i) => `Team ${i + 1} Roll`),
  ])

  // Build a category-breadcrumb helper (v1 only).
  const catById = new Map((categories || []).map(c => [c.id, c]))
  const breadcrumb = (cid: string | null | undefined): string => {
    if (!cid) return ''
    const names: string[] = []
    let n: any = catById.get(cid)
    while (n) { names.unshift(n.name); n = n.parent_id ? catById.get(n.parent_id) : null }
    return names.join(' > ')
  }

  const rows = (regs || []).map((r: any) => {
    const builtins: Record<string, any> = {
      full_name: r.full_name, phone: r.phone, email: r.email,
      college: r.college, college_roll: r.college_roll,
      hsc_session: r.hsc_session, division: r.division,
    }
    // v2 form path: walk submitted_node_ids backwards to give a label trail.
    let formPath = ''
    let isTerminal = ''
    if (r.form_graph_id && r.submitted_node_ids) {
      formPath = (r.submitted_node_ids as string[])
        .map(id => nodeLabelById.get(id) || '')
        .filter(Boolean).join(' > ')
    } else if (r.category_id) {
      formPath = breadcrumb(r.category_id)
    }
    // For v2 we infer is_terminal from the form_node's is_terminal flag
    // (best effort: if the row's form_node_id is terminal, mark it).
    if (r.form_node_id) {
      // We don't have is_terminal on the row itself; just leave blank.
    }

    const custom: Record<string, any> = r.custom_answers || {}
    const team: any[] = Array.isArray(r.team_members) ? r.team_members : []

    const row: any[] = [
      r.id,
      r.created_at,
      formPath,
      isTerminal,
      ...BUILTIN_HEADERS.map(b => builtins[b.key] ?? ''),
      r.project_name || '',
      r.payment_status || '',
      ...customHeaders.map(h => custom[customHeaderToKey.get(h) || ''] ?? ''),
      ...Array.from({ length: MAX_TEAM_COLUMNS }, (_, i) => team[i]?.full_name || ''),
      ...Array.from({ length: MAX_TEAM_COLUMNS }, (_, i) => team[i]?.email || ''),
      ...Array.from({ length: MAX_TEAM_COLUMNS }, (_, i) => team[i]?.college_roll || ''),
    ]
    return row
  })

  const csv = rowsToCsv(headers, rows)
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="ndsc-activity-${sessionId.slice(0, 8)}-${date}.csv"`,
    },
  })
}
