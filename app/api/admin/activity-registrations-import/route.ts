// Admin: bulk-register participants into an activity from a CSV.
//
//   GET  ?sessionId=…   -> { columns, csv }  header template derived from the activity's form tree
//   POST { session_id, headers, rows, row_offset?, default_password, payment_status?,
//          send_welcome_email?, dry_run? }
//        dry_run=true  -> validate + report what WOULD happen; writes nothing
//        dry_run=false -> for each row: find-or-create the website account, then create one COMPLETE
//                         registration per target segment through the same slot rules as the public
//                         form (db/36 complete_registration: one person / one segment, segment groups,
//                         disable-multi-enroll), so imported people can't double up with web sign-ups.
//
// Column convention and parsing live in lib/activityImport.ts (unit-tested).
//
// Deliberately NOT enforced for admin imports: the registration window (deadline / "registration
// open" flag). Everything else — duplicates, group rules, field formats — is.

import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/api/admin-auth'
import { apiError, apiOk } from '@/lib/api/response'
import { planImport, buildTemplate, NOT_SET, type ImportNode, type PlannedRow, type PlannedTarget } from '@/lib/activityImport'
import { ensureWebsiteAccount, findWebsiteAccount } from '@/lib/server/ensureWebsiteAccount'
import { groupKeyFor } from '@/lib/segmentGroups'
import { buildSlotIdentities, type SlotIdentity } from '@/lib/identity'
import { computePathFee } from '@/lib/paymentFee'
import { sendWelcomeEmailIfEnabled } from '@/lib/email/welcome'

export const maxDuration = 60

const MAX_DRY_RUN_ROWS = 1000
const MAX_IMPORT_ROWS_PER_REQUEST = 15

type Slot = { terminal_node_id: string; group_key: string | null; identity_kind: string; identity_value: string }
type TargetResult = { label: string; status: 'registered' | 'ready' | 'already' | 'failed'; message?: string; registration_id?: string }
type RowResult = {
  row: number; email: string; name: string
  account: 'created' | 'existing' | 'will_create' | 'none'
  targets: TargetResult[]; errors: string[]; warnings: string[]
}

async function loadContext(sessionId: string) {
  const { data: session } = await supabaseAdmin.from('activity_sessions').select('id, title').eq('id', sessionId).maybeSingle()
  if (!session) return { error: 'Activity not found.' as const }
  const { data: graph } = await supabaseAdmin.from('form_graphs')
    .select('id, root_node_id, settings').eq('owner_kind', 'activity').eq('owner_id', sessionId).maybeSingle()
  if (!graph) return { error: 'This activity has no registration form yet (Form Builder is empty).' as const }
  const { data: nodeRows, error } = await supabaseAdmin.from('form_nodes')
    .select('id, parent_id, label, kind, enabled, is_terminal, fields, behavior, display_order').eq('graph_id', (graph as any).id)
  if (error) return { error: error.message }
  const nodes = (nodeRows || []) as ImportNode[]
  const root = nodes.find(n => n.parent_id === null)
  const groups = Array.isArray((graph as any).settings?.segment_groups) ? (graph as any).settings.segment_groups : []
  return {
    session: session as any, graph: graph as any, nodes, byId: new Map(nodes.map(n => [n.id, n])),
    groups, disableMulti: !!root?.behavior?.disable_multi_segment_enroll,
  }
}

export async function GET(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized
  const sessionId = req.nextUrl.searchParams.get('sessionId')
  if (!sessionId) return apiError('sessionId is required.', 400)
  const ctx = await loadContext(sessionId)
  if ('error' in ctx) return apiError(ctx.error, 400)
  return apiOk(buildTemplate(ctx.nodes))
}

// Slots held by any of these identities in this event (leader identities only matter here).
async function fetchSlots(sessionId: string, ids: SlotIdentity[]): Promise<Slot[]> {
  const values = [...new Set(ids.map(i => i.value))]
  if (!values.length) return []
  const { data } = await supabaseAdmin.from('registration_slots')
    .select('terminal_node_id, group_key, identity_kind, identity_value')
    .eq('activity_session_id', sessionId).in('identity_value', values)
  return (data || []) as Slot[]
}

async function loadAllSlots(sessionId: string): Promise<Slot[]> {
  const out: Slot[] = []
  for (let from = 0; ; from += 1000) {
    const { data } = await supabaseAdmin.from('registration_slots')
      .select('terminal_node_id, group_key, identity_kind, identity_value')
      .eq('activity_session_id', sessionId).range(from, from + 999)
    out.push(...((data || []) as Slot[]))
    if (!data || data.length < 1000) break
  }
  return out
}

function conflictMessage(slots: Slot[], ids: SlotIdentity[], terminalId: string, groupKey: string | null, labelOf: (id: string) => string): string | null {
  for (const s of slots) {
    if (!ids.some(i => i.kind === s.identity_kind && i.value === s.identity_value)) continue
    if (s.terminal_node_id === terminalId) return `Already registered in this segment (matched ${s.identity_kind}).`
    if (groupKey && s.group_key === groupKey)
      return `Already registered in "${labelOf(s.terminal_node_id)}", which is in the same segment group — only one allowed.`
  }
  return null
}

export async function POST(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized
  try {
    const body = await req.json().catch(() => null)
    if (!body) return apiError('Invalid JSON body.', 400)
    const { session_id: sessionId, headers, rows, row_offset: rowOffset = 0 } = body
    const dryRun = body.dry_run === true
    const defaultPassword = typeof body.default_password === 'string' ? body.default_password : ''
    const paymentOpt: 'not_required' | 'paid' | 'pending' =
      body.payment_status === 'paid' || body.payment_status === 'pending' ? body.payment_status : 'not_required'
    const sendWelcome = body.send_welcome_email === true

    if (!sessionId) return apiError('session_id is required.', 400)
    if (!Array.isArray(headers) || !Array.isArray(rows) || !rows.length) return apiError('headers and a non-empty rows array are required.', 400)
    if (dryRun ? rows.length > MAX_DRY_RUN_ROWS : rows.length > MAX_IMPORT_ROWS_PER_REQUEST)
      return apiError(dryRun ? `Preview is limited to ${MAX_DRY_RUN_ROWS} rows — split the file.` : `Send at most ${MAX_IMPORT_ROWS_PER_REQUEST} rows per request.`, 400)
    if (defaultPassword.length < 6) return apiError('default_password must be at least 6 characters.', 400)

    const ctx = await loadContext(sessionId)
    if ('error' in ctx) return apiError(ctx.error, 400)
    const { graph, nodes, byId, groups, disableMulti } = ctx

    const plan = planImport(headers, rows, nodes, Number(rowOffset) || 0)
    if (plan.fatal) return apiError(plan.fatal, 400)

    const labelOf = (id: string) => byId.get(id)?.label || 'another segment'
    const groupKeyOf = (terminalId: string) => groupKeyFor(terminalId, byId as any, groups, disableMulti)
    const leaderIds = (row: PlannedRow, memberId: string | null) => buildSlotIdentities({
      leader: { member_id: memberId, email: row.real.email, phone: row.real.phone, college_roll: row.real.college_roll },
    })

    const virtualSlots: Slot[] = dryRun ? await loadAllSlots(sessionId) : []

    // dry-run: look accounts up in parallel up-front (the pass below is then in-memory)
    const accountByRow = new Map<number, string | null>()
    if (dryRun) {
      const todo = plan.rows.filter(r => !r.blank && !r.errors.length)
      for (let i = 0; i < todo.length; i += 15) {
        await Promise.all(todo.slice(i, i + 15).map(async r => { accountByRow.set(r.rowNum, (await findWebsiteAccount(r.email))?.id ?? null) }))
      }
    }

    const results: RowResult[] = []
    for (const row of plan.rows) {
      if (row.blank) continue
      const res: RowResult = {
        row: row.rowNum, email: row.email, name: row.real.full_name || NOT_SET, account: 'none',
        targets: [], errors: [...row.errors], warnings: [...row.warnings],
      }
      results.push(res)
      if (res.errors.length) continue

      // ── account ──
      let memberId: string | null = null
      if (dryRun) {
        memberId = accountByRow.get(row.rowNum) ?? null
        res.account = memberId ? 'existing' : 'will_create'
      } else {
        const acct = await ensureWebsiteAccount({
          email: row.email,
          full_name: row.stored.full_name,
          phone: row.stored.phone,
          institution: row.stored.college,
          password: row.password || defaultPassword,
        })
        if (acct.ok === false) { res.errors.push(`Account: ${acct.error}`); continue }
        memberId = acct.id
        res.account = acct.created ? 'created' : 'existing'
      }

      // ── one registration per target segment ──
      const ids = leaderIds(row, memberId)
      for (const target of row.targets) {
        const groupKey = groupKeyOf(target.terminalId)
        const slots = dryRun ? virtualSlots : await fetchSlots(sessionId, ids)
        const clash = conflictMessage(slots, ids, target.terminalId, groupKey, labelOf)
        if (clash) { res.targets.push({ label: target.label, status: 'already', message: clash }); continue }

        if (dryRun) {
          for (const i of ids) virtualSlots.push({ terminal_node_id: target.terminalId, group_key: groupKey, identity_kind: i.kind, identity_value: i.value })
          res.targets.push({ label: target.label, status: 'ready' })
          continue
        }
        const out = await createRegistration({ sessionId, graph, nodes, byId, groups, disableMulti, row, target, memberId: memberId!, ids, groupKey, paymentOpt })
        res.targets.push({ label: target.label, ...out })
        if (out.status === 'registered' && sendWelcome) await sendWelcomeEmailIfEnabled('activity_registrations' as any, out.registration_id!)
      }
    }

    const tally = (s: TargetResult['status']) => results.reduce((n, r) => n + r.targets.filter(t => t.status === s).length, 0)
    return apiOk({
      dry_run: dryRun,
      columns: dryRun ? plan.columns.map(c => c.kind === 'field'
        ? { header: c.header, kind: c.kind, maps_to: `${c.nodeLabel} › ${c.field.label || c.key}` }
        : c.kind === 'ignored' ? { header: c.header, kind: c.kind, maps_to: c.reason }
        : { header: c.header, kind: c.kind, maps_to: c.kind === 'builtin' ? 'Common detail' : (c.key === 'segment' ? 'Segment selector' : c.key) }) : undefined,
      results,
      summary: {
        rows: results.length,
        with_errors: results.filter(r => r.errors.length).length,
        accounts_to_create: dryRun ? results.filter(r => r.account === 'will_create').length : undefined,
        accounts_created: dryRun ? undefined : results.filter(r => r.account === 'created').length,
        registrations: dryRun ? tally('ready') : tally('registered'),
        already_registered: tally('already'),
        failed: tally('failed'),
      },
    })
  } catch (err: any) {
    return apiError(err?.message || 'Server error', 500)
  }
}

async function createRegistration(a: {
  sessionId: string; graph: any; nodes: ImportNode[]; byId: Map<string, ImportNode>; groups: any[]; disableMulti: boolean
  row: PlannedRow; target: PlannedTarget; memberId: string; ids: SlotIdentity[]; groupKey: string | null
  paymentOpt: 'not_required' | 'paid' | 'pending'
}): Promise<{ status: 'registered' | 'failed' | 'already'; message?: string; registration_id?: string }> {
  const { row, target } = a
  const fee = computePathFee(target.pathIds.map(id => a.byId.get(id)))
  const hasTeamCfg = target.pathIds.some(id => a.byId.get(id)?.behavior?.require_team)
  const pay = fee > 0 && a.paymentOpt !== 'not_required'
    ? { payment_status: a.paymentOpt, payment_amount: fee, ...(a.paymentOpt === 'paid' ? { payment_validated_at: new Date().toISOString() } : {}) }
    : { payment_status: 'not_required', payment_amount: null }

  const insert: Record<string, any> = {
    activity_session_id: a.sessionId,
    full_name: row.stored.full_name, phone: row.stored.phone, email: row.email,
    college: row.stored.college, college_roll: row.stored.college_roll,
    hsc_session: row.stored.hsc_session, division: row.stored.division,
    project_name: row.projectName || null,
    custom_answers: target.custom,
    team_members: [],
    member_id: a.memberId,
    form_graph_id: a.graph.id,
    form_node_id: target.terminalId,
    submitted_node_ids: target.pathIds,
    ...(hasTeamCfg && row.teamName ? { team_name: row.teamName } : {}),
    ...pay,
  }
  const { data: reg, error } = await supabaseAdmin.from('activity_registrations').insert(insert).select('id').single()
  if (error || !reg) return { status: 'failed', message: error?.message || 'Insert failed' }
  const regId = (reg as any).id as string

  // Complete + claim slots atomically (db/36). On conflict nothing is written; remove the draft row.
  const { data, error: rpcErr } = await supabaseAdmin.rpc('complete_registration', {
    p_registration_id: regId, p_session_id: a.sessionId, p_terminal_id: target.terminalId,
    p_group_key: a.groupKey, p_identities: a.ids,
  })
  const discard = () => supabaseAdmin.from('activity_registrations').delete().eq('id', regId)
  if (rpcErr) {
    await discard()
    const missing = (rpcErr as any).code === 'PGRST202' || (rpcErr as any).code === '42883'
    return { status: 'failed', message: missing ? 'complete_registration() is missing — apply db/36_migration_registration_slots.sql first.' : rpcErr.message }
  }
  const res: any = data
  if (!res?.ok) {
    await discard()
    const c = res?.conflict || {}
    return { status: 'already', message: c.same_terminal
      ? `Already registered in this segment (matched ${c.kind}).`
      : `Already registered in "${a.byId.get(c.terminal_node_id)?.label || 'another segment'}" (same segment group / single-segment event).` }
  }

  // Leader link: how the participant's dashboard finds the registration (same as the public submit route).
  const { error: linkErr } = await supabaseAdmin.from('team_member_links').upsert(
    [{ registration_id: regId, member_id: a.memberId, role: 'leader', email_at_registration: '' }],
    { onConflict: 'registration_id,member_id', ignoreDuplicates: true })
  if (linkErr) console.warn('activity import: leader link error', linkErr.message)
  return { status: 'registered', registration_id: regId }
}
