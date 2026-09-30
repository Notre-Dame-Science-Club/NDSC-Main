// Public: submit a single form node in a form graph.
//
// The runner calls this once per form node the user completes. The body
// has:
//   - graph_id  + node_id
//   - form       (built-in field values, only meaningful at the root node
//                 where the registration row is created)
//   - custom_answers
//   - team_members
//   - olympiad answers (mcq, short, photo) — only used when the graph
//                 owner_kind is 'olympiad'
//
// The server decides what to do based on the node's role in the graph:
//
//   root node
//     - create the registration row, set form_graph_id / form_node_id /
//       submitted_node_ids = [node_id], write all built-ins to the
//       top-level columns
//   non-root node
//     - update the existing registration: merge custom_answers, append
//       the node id to submitted_node_ids, lift any olympiad question
//       fields into mcq_answers / short_answers / photo_answers
//   terminal node
//     - same as non-root, then mark exam_submitted_at (olympiad) or
//       just leave the row as final
//
// The response always tells the runner what's next:
//   { registration_id, next_node_id, done, node } where
//   - next_node_id is the FIRST child of the just-submitted node  (or the child named by body.next_node_id)
//   - done = true when the submitted node is terminal OR the graph has
//     no further enabled children
//
// Anti-cheat enforcement (timer, no-copy) happens client-side via
// <AntiCheatProvider />. We rely on the same trust model the rest of
// the public registration API uses: a registration id is an unguessable
// UUID, so once the runner passes it back we trust it. (Re-grading the
// exam server-side and re-locking the dashboard if the timer was
// bypassed is a v2 concern.)
//
// Phase 2: per-member team validation + password hashing, and the
// full unique_field check (leader + team_members), now live here too —
// see validateAndPrepareTeam and findUniqueFieldDuplicates below.

import { evaluateStep } from '@/lib/registrationPath'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { validateCollegeRoll } from '@/lib/validation'
import { apiError, apiOk } from '@/lib/api/response'
import { normalizeBlocks, HARD_MINIMUM_KEYS, validateFieldFormat, type FormBlock } from '@/lib/formBlocks'
import { validateAndPrepareTeam, isTeamResultOk, type ValidateTeamResult } from '@/lib/teamRegistration'
import type { FormNode } from '@/lib/formGraph'
import { sendWelcomeEmailIfEnabled } from '@/lib/email/welcome'
import { computePathFee } from '@/lib/paymentFee'
import { checkWindow } from '@/lib/segmentAccess'
import { groupKeyFor } from '@/lib/segmentGroups'
import { buildSlotIdentities } from '@/lib/identity'
import { activityRegistrationOpen, olympiadRegistrationOpen } from '@/lib/registrationWindow'

// Node kinds that contain identity/registration info, NOT exam questions.
// These are excluded from the timer trigger logic below.
const IDENTITY_NODE_KINDS = new Set(['preset_common_details', 'preset_team_info'])

// college_roll used to be the one field with a hardcoded format rule
// ("exactly 8 digits", but only for Notre Dame College students) baked
// straight into the server with no way for an admin to see it, change it,
// or turn it off — and no equivalent existed for any other field (phone
// number included). Now any field can carry its own `validation` config
// (lib/formBlocks.ts, set via the Form Builder's field editor). For
// college_roll specifically, an admin's explicit config fully overrides
// the old default (including disabling it outright); with no config set,
// existing graphs keep behaving exactly as before.
function resolveRollValidationError(nodeFields: FormBlock[] | null | undefined, college: string | null | undefined, roll: string | null | undefined): string | null {
  const rollField = normalizeBlocks(nodeFields || []).find(f => (f as any).is_builtin === 'college_roll')
  if (rollField?.validation) return validateFieldFormat(rollField, roll)
  return validateCollegeRoll(college, roll)
}

// Generic format-validation pass over every other field in the node being
// submitted (built-in or custom) — purely additive, since without an
// explicit `validation` config on a field this is always a no-op.
// college_roll is excluded here since it's handled by
// resolveRollValidationError above (with its NDC-specific fallback).
function validateAllFieldFormats(nodeFields: FormBlock[] | null | undefined, builtins: Record<string, any>, custom: Record<string, any>): string | null {
  for (const f of normalizeBlocks(nodeFields || [])) {
    if (f.kind !== 'field') continue
    const builtinKey = (f as any).is_builtin as string | undefined
    if (builtinKey === 'college_roll') continue
    const value = builtinKey ? builtins[builtinKey] : custom[f.key ?? f.id]
    const err = validateFieldFormat(f, value)
    if (err) return err
  }
  return null
}

type SubmitBody = {
  graph_id?: string
  node_id?: string
  registration_id?: string         // set on every non-root submit
  next_node_id?: string | null    // B10: the child the registrant picked (validated server-side)
  form?: Record<string, any>       // built-in values
  custom_answers?: Record<string, any>
  team_members?: any[]
  // Set when the registrant is logged in as a member (FormRunner reads
  // this from the current Supabase session). Only meaningful for
  // activities — activity_registrations.member_id is a real FK column;
  // olympiad_registrations has no equivalent column, so this is ignored
  // for olympiad graphs. NOTE: this client-supplied value is only ever
  // used as a fallback — see getAuthedMemberId() below, which overrides
  // it with the verified id from the request's own bearer token.
  member_id?: string | null
  // olympiad question fields are merged into custom_answers by the client
  // (using `key` or `id`); the server lifts them to mcq_answers /
  // short_answers / photo_answers at the terminal submit.
}

// Registering — for an activity OR an olympiad — now requires a logged-in
// website account (see RegistrationCTA and the /register/[ownerKind]/
// [ownerId] login gate on the client, which normally stop an anonymous
// visitor from ever reaching this endpoint in the first place). We check
// again here so the requirement actually holds even if someone calls this
// route directly, and so we never trust a client-claimed `member_id` —
// same Bearer-token pattern already used by /api/member-profile,
// /api/member-achievements, etc. The session lives in browser
// localStorage, not a cookie the server sees automatically, so the client
// has to hand us the access token explicitly (FormRunner does this on
// every submit call).
async function getAuthedMemberId(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  if (!token) return null
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data.user) return null
  return data.user.id
}

function validateRequiredFields(node: FormNode, form: Record<string, any>, customAnswers: Record<string, any>) {
  const errors: string[] = []
  for (const f of normalizeBlocks(node.fields)) {
    if (f.kind !== 'field') continue
    if (!f.required) continue
    const v = (f as any).is_builtin
      ? form?.[(f as any).is_builtin]
      : customAnswers?.[f.key || f.id]
    if (v === undefined || v === null || (typeof v === 'string' && !v.trim())) {
      errors.push(f.label || f.key || f.id)
    }
  }
  // NOTE: the hard-minimum builtin check used to live here and fired on
  // every root submit, regardless of whether the root node's own schema
  // even collected those fields. In a graph where identity fields (e.g.
  // "Common details") live on a non-root node, that made it impossible
  // to submit the root at all. The hard minimum is now enforced once,
  // only when the user's path actually finishes — see
  // missingHardMinimum() / the isDone check below.
  return errors
}

// Non-empty values for any recognized builtin key present in `form`. Used
// both to persist builtins at whichever node collects them (not just root)
// and to compute the "have we collected the essentials yet" check below.
function nonEmptyBuiltins(form: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {}
  const keys: string[] = ['full_name', 'phone', 'email', 'college', 'college_roll', 'hsc_session', 'division', 'batch']
  for (const k of keys) {
    const v = form?.[k]
    if (v !== undefined && v !== null && !(typeof v === 'string' && !v.trim())) out[k] = v
  }
  return out
}

// Checks the hard-minimum identity fields against an "effective" builtins
// object — i.e. whatever's been collected across the whole path so far
// (previously-saved columns on the registration, merged with anything new
// from this submit), not just what's on the current node.
function missingHardMinimum(effective: Record<string, any>): string[] {
  return HARD_MINIMUM_KEYS.filter(k => !effective?.[k] || (typeof effective[k] === 'string' && !effective[k].trim()))
}

// The client has a live "is this already taken?" lookup while typing
// (/api/activity-unique-check), but that only *advises* — nothing stopped
// someone from ignoring the warning and submitting anyway, which is how
// the same person ends up with two registrations for one event. This does
// the same leader-level match, server-side, at the moment we're about to
// create the registration row, and actually blocks it.
// `segmentNodeId`, when provided, scopes the comparison to registrations
// that ENDED at the SAME terminal node (the last id in submitted_node_ids)
// as the registration currently being checked. Every terminal node in the
// graph — no matter how deep it sits (a segment's leaf, or a leaf several
// levels down inside a subsegment) — is its own independent registration
// slot: reaching one terminal never blocks reaching a different one, but
// reaching the SAME terminal twice does. Passing `undefined`/`null` keeps
// the old whole-session behavior (used by olympiads, which have no
// segments, and by graphs with only a single possible path).
function inSameSegment(r: { submitted_node_ids?: string[] | null }, segmentNodeId?: string | null): boolean {
  if (!segmentNodeId) return true
  const ids = r.submitted_node_ids
  return Array.isArray(ids) && ids.length > 0 && ids[ids.length - 1] === segmentNodeId
}

async function findDuplicateLeader(
  table: 'activity_registrations' | 'olympiad_registrations',
  ownerCol: 'activity_session_id' | 'olympiad_id',
  ownerId: string,
  builtins: Record<string, any>,
  excludeId?: string,
  memberId?: string | null,
  segmentNodeId?: string | null,
): Promise<{ id: string; full_name: string | null } | null> {
  const checkKeys = ['email', 'phone', 'college_roll'].filter(k => {
    const v = builtins?.[k]
    return v !== undefined && v !== null && !(typeof v === 'string' && !v.trim())
  })
  if (!checkKeys.length && !memberId) return null

  // NOTE: we branch fully on `table` here (rather than calling `.from(table)`
  // once and picking a select string with a ternary) so each query gets a
  // concrete literal table name. Supabase's generated types parse the
  // `.select()` string against whichever table `.from()` resolves to; when
  // `table` is a union type, a conditional select string (e.g. one branch
  // including the activity-only `member_id` column) can't be resolved
  // against both schemas at once and the type parser bails out to a
  // ParserError instead of a real row type. Two separate, literally-typed
  // branches sidestep that entirely.
  type DupRow = { id: string; full_name: string | null; member_id?: string | null; submitted_node_ids?: string[] | null }
  let data: DupRow[] | null = null
  if (table === 'activity_registrations') {
    let query = supabaseAdmin
      .from('activity_registrations')
      .select('id, full_name, email, phone, college_roll, member_id, submitted_node_ids')
      .eq(ownerCol, ownerId)
      .not('completed_at', 'is', null)   // B2: drafts never count as a registration
    if (excludeId) query = query.neq('id', excludeId)
    const res = await query
    data = res.data
  } else {
    let query = supabaseAdmin
      .from('olympiad_registrations')
      .select('id, full_name, email, phone, college_roll')
      .eq(ownerCol, ownerId)
    if (excludeId) query = query.neq('id', excludeId)
    const res = await query
    data = res.data
  }

  const norm = (v: any) => (v === null || v === undefined ? '' : String(v).trim().toLowerCase())
  for (const r of data || []) {
    if (!inSameSegment(r, segmentNodeId)) continue
    if (memberId && table === 'activity_registrations' && r.member_id === memberId) {
      return { id: r.id, full_name: r.full_name }
    }
    for (const k of checkKeys) {
      if (norm((r as any)[k]) === norm(builtins[k])) {
        return { id: r.id, full_name: r.full_name }
      }
    }
  }
  return null
}

// Walks every field with `unique_field: true` in the active node and
// checks the leader + each team_member against every existing
// registration's leader column + each of their team_members. Mirrors
// the v1 (`activity-register/route.ts:248-379`) uniqueness contract
// exactly — Phase 2 ports the contract into the v2 path so v2 isn't
// weaker than v1 for the same `unique_field` flag.
//
// Returns null if no conflict, or `{ id, full_name, label, value,
// scope: 'leader' | 'team_member' }` describing the existing match so
// the caller can surface a useful message. `excludeId` lets the
// non-root submit path ignore the same row it's currently updating
// when the user is editing their own team.
async function findUniqueFieldDuplicates(
  activitySessionId: string,
  fields: any[],
  builtins: Record<string, any>,
  customAnswers: Record<string, any>,
  teamMembers: any[],
  excludeId?: string,
  segmentNodeId?: string | null,
): Promise<{ id: string; full_name: string | null; label: string; value: string; scope: 'leader' | 'team_member' } | null> {
  const TOP_LEVEL_COLS = new Set([
    'full_name', 'phone', 'email', 'college',
    'college_roll', 'hsc_session', 'division',
  ])
  const norm = (v: any) => (v === null || v === undefined ? '' : String(v).trim().toLowerCase())

  type UF = { label: string; source: 'top_level' | 'custom'; key: string; builtinCol?: string }
  const ufs: UF[] = []
  for (const f of (fields || [])) {
    if (!f || !f.unique_field) continue
    const builtinCol = f.is_builtin as string | undefined
    if (builtinCol && TOP_LEVEL_COLS.has(builtinCol)) {
      ufs.push({ label: f.label || builtinCol, source: 'top_level', key: builtinCol, builtinCol })
    } else {
      const k = (f.key || f.id || builtinCol || '') as string
      if (!k) continue
      ufs.push({ label: f.label || k, source: 'custom', key: k, builtinCol })
    }
  }
  if (!ufs.length) return null

  let query = supabaseAdmin
    .from('activity_registrations')
    .select('id, full_name, email, phone, college_roll, custom_answers, team_members, submitted_node_ids')
    .eq('activity_session_id', activitySessionId)
    .not('completed_at', 'is', null)   // B2
  if (excludeId) query = query.neq('id', excludeId)
  const { data: allExistingRegs } = await query
  const existingRegs = (allExistingRegs || []).filter(r => inSameSegment(r as any, segmentNodeId))

  // Within the incoming submission: check leader values against each
  // unique_field and team_member values against each unique_field.
  for (const f of ufs) {
    const incomingLeader = f.source === 'top_level' ? builtins?.[f.key] : customAnswers?.[f.key]
    const incomingLeaderNorm = norm(incomingLeader)
    if (incomingLeaderNorm) {
      const incomingDisplay = String(incomingLeader).trim()
      // Check against existing registrations' leader columns
      for (const r of (existingRegs || [])) {
        let leaderVal: any
        if (f.source === 'top_level') leaderVal = (r as any)[f.key]
        else leaderVal = (r as any).custom_answers?.[f.key]
        if (norm(leaderVal) === incomingLeaderNorm) {
          return { id: r.id, full_name: r.full_name, label: f.label, value: incomingDisplay, scope: 'leader' }
        }
      }
      // Check against existing registrations' team members
      for (const r of (existingRegs || [])) {
        for (const m of ((r as any).team_members || [])) {
          const mVal = f.source === 'top_level'
            ? (m[f.key as keyof typeof m])
            : m.custom_answers?.[f.key]
          if (norm(mVal) === incomingLeaderNorm) {
            return { id: r.id, full_name: r.full_name, label: f.label, value: incomingDisplay, scope: 'team_member' }
          }
        }
      }
    }
  }

  // Cross-check incoming team members against existing leader columns +
  // existing team members.
  for (const m of (teamMembers || [])) {
    for (const f of ufs) {
      const mVal = f.source === 'top_level'
        ? (m[f.key as keyof typeof m])
        : m.custom_answers?.[f.key]
      const mValNorm = norm(mVal)
      if (!mValNorm) continue
      const incomingDisplay = String(mVal).trim()
      // Existing leader columns
      for (const r of (existingRegs || [])) {
        let leaderVal: any
        if (f.source === 'top_level') leaderVal = (r as any)[f.key]
        else leaderVal = (r as any).custom_answers?.[f.key]
        if (norm(leaderVal) === mValNorm) {
          return { id: r.id, full_name: r.full_name, label: f.label, value: incomingDisplay, scope: 'leader' }
        }
      }
      // Existing team members
      for (const r of (existingRegs || [])) {
        for (const tm of ((r as any).team_members || [])) {
          const tmVal = f.source === 'top_level'
            ? (tm[f.key as keyof typeof tm])
            : tm.custom_answers?.[f.key]
          if (norm(tmVal) === mValNorm) {
            return { id: r.id, full_name: r.full_name, label: f.label, value: incomingDisplay, scope: 'team_member' }
          }
        }
      }
    }
  }

  return null
}

// Task 6: default-on duplicate detection for team members. v1's
// `findUniqueFieldDuplicates` only fires when a field has
// `unique_field: true` — so a v2 team event with no per-field opt-in
// accepted the same email twice across separate registrations of the
// same session. Per the audit, member email + college_roll should be
// unique *by default* (no per-field opt-in). The check runs whenever
// this submit is for a team-required node, regardless of how the
// admin configured `fields`.
//
// Same shape as findUniqueFieldDuplicates so callers can surface a
// consistent error. Returns null on no conflict.
async function findDuplicateTeamMembers(
  activitySessionId: string,
  teamMembers: any[],
  excludeId?: string,
  segmentNodeId?: string | null,
): Promise<{ id: string; full_name: string | null; label: string; value: string; scope: 'team_member' | 'leader' } | null> {
  if (!Array.isArray(teamMembers) || !teamMembers.length) return null
  const norm = (v: any) => (v === null || v === undefined ? '' : String(v).trim().toLowerCase())
  // Only consider members with at least one of the two identifying
  // fields actually filled — otherwise we'd false-positive on every
  // half-typed row.
  const incoming = teamMembers
    .map((m: any, i: number) => ({
      idx: i, name: (m.full_name || '').trim(),
      email: norm(m.email), roll: norm(m.college_roll),
    }))
    .filter(m => m.email || m.roll)
  if (!incoming.length) return null

  let query = supabaseAdmin
    .from('activity_registrations')
    .select('id, full_name, email, phone, college_roll, team_members, submitted_node_ids')
    .eq('activity_session_id', activitySessionId)
  if (excludeId) query = query.neq('id', excludeId)
  const { data: rawExisting } = await query
  const existing = (rawExisting || []).filter(r => inSameSegment(r as any, segmentNodeId))
  if (!existing?.length) return null

  for (const m of incoming) {
    for (const r of existing) {
      // vs. existing leader
      if (m.email && norm((r as any).email) === m.email) {
        return { id: r.id, full_name: r.full_name, label: 'Email', value: m.email, scope: 'leader' }
      }
      if (m.roll && norm((r as any).college_roll) === m.roll) {
        return { id: r.id, full_name: r.full_name, label: 'College roll', value: m.roll, scope: 'leader' }
      }
      // vs. existing team members
      for (const tm of ((r as any).team_members || [])) {
        if (m.email && norm(tm.email) === m.email) {
          return { id: r.id, full_name: r.full_name, label: 'Email', value: m.email, scope: 'team_member' }
        }
        if (m.roll && norm(tm.college_roll) === m.roll) {
          return { id: r.id, full_name: r.full_name, label: 'College roll', value: m.roll, scope: 'team_member' }
        }
      }
    }
  }
  return null
}

// Task 5: write-time bridge from team_members jsonb to real member
// accounts. For each member on this registration, look up their email
// in `members`; if found, record a team_member_links row with role
// 'team_member' (or 'leader' when memberId on the registration is
// the same person). Failures here are non-fatal: the bridge is an
// additive enrichment on top of the jsonb team_members data, and
// the read-side falls back to a runtime email lookup for unlinked
// rows. So we swallow errors and log them — the registration
// succeeds regardless.
//
// We run on every submit that wrote team_members (root + non-root),
// deduping by (registration_id, member_id) via the upsert ON
// CONFLICT clause. Re-submits with the same member set are
// idempotent.
async function linkTeamMembersToAccounts(
  registrationId: string,
  leaderMemberId: string | null | undefined,
  preparedTeamMembers: any[],
): Promise<void> {
  // Collect every email we'll try to link. Includes the leader
  // (their member_id, if set) and each team member's email.
  const candidateEmails: string[] = []
  if (leaderMemberId) candidateEmails.push('__leader_only__')  // sentinel
  for (const m of (preparedTeamMembers || [])) {
    const e = (m?.email || '').trim()
    if (e) candidateEmails.push(e.toLowerCase())
  }
  if (!candidateEmails.length) return

  // Look up team-member emails against the members table in one
  // round trip. The leader doesn't need an email lookup — their
  // member_id is already on the registration row, and we record
  // the leader link separately if so.
  const teamEmails = candidateEmails.filter(e => e !== '__leader_only__').slice(0, 50)
  let memberRows: any[] = []
  if (teamEmails.length) {
    const res = await supabaseAdmin
      .from('members')
      .select('id, email')
      .in('email', teamEmails)
    memberRows = res.data || []
  }
  const emailToId = new Map<string, string>()
  for (const r of memberRows) {
    if (r?.email) emailToId.set(String(r.email).trim().toLowerCase(), r.id)
  }

  // Build the link rows.
  const rows: any[] = []
  // Leader link (if leader is a real member).
  if (leaderMemberId) {
    rows.push({
      registration_id: registrationId,
      member_id: leaderMemberId,
      role: 'leader',
      email_at_registration: '',
    })
  }
  // Team-member links.
  for (const m of (preparedTeamMembers || [])) {
    const e = (m?.email || '').trim()
    if (!e) continue
    const id = emailToId.get(e.toLowerCase())
    if (!id) continue
    // Skip self-link when the team member's email matches the leader.
    if (leaderMemberId && id === leaderMemberId) continue
    rows.push({
      registration_id: registrationId,
      member_id: id,
      role: 'team_member',
      email_at_registration: e,
    })
  }
  if (!rows.length) return

  // upsert with ON CONFLICT DO NOTHING so re-submits are idempotent.
  // We do not update email_at_registration on conflict — keep the
  // earliest snapshot for audit purposes.
  const { error } = await supabaseAdmin
    .from('team_member_links')
    .upsert(rows, { onConflict: 'registration_id,member_id', ignoreDuplicates: true })
  if (error) {
    // Don't fail the registration; just log.
    console.warn('linkTeamMembersToAccounts: upsert error', error)
  }
}

export async function POST(req: NextRequest) {
  const body: SubmitBody = await req.json().catch(() => ({}))
  if (!body?.graph_id || !body?.node_id) {
    return apiError('graph_id and node_id are required.', 400)
  }

  // Resolve who's actually making this request from their own session —
  // never from the body they sent. Overrides whatever `member_id` the
  // client claimed, closing off a spot where anyone could previously
  // attribute a registration to any member id just by putting it in the
  // request body.
  const authedMemberId = await getAuthedMemberId(req)
  body.member_id = authedMemberId

  // Load the node + graph together so we know the owner's kind and the
  // node's place in the tree.
  const { data: node, error: nErr } = await supabaseAdmin
    .from('form_nodes').select('*').eq('id', body.node_id).maybeSingle()
  if (nErr) return apiError(nErr, 400)
  if (!node) return apiError('Node not found.', 404)
  if (node.graph_id !== body.graph_id) {
    return apiError("Node doesn't belong to that graph.", 400)
  }
  if (!node.enabled) return apiError("This form is currently disabled.", 403)

  const { data: graph, error: gErr } = await supabaseAdmin
    .from('form_graphs').select('*').eq('id', body.graph_id).maybeSingle()
  if (gErr) return apiError(gErr, 400)
  if (!graph) return apiError('Graph not found.', 404)

  // "Disable multiple segment enroll" — a root-node-only flag (see
  // FormNodeBehavior in lib/formGraph.ts). When set, this activity's
  // segments no longer act as independent registration slots: reaching
  // ANY segment's terminal should block every other segment's terminal
  // too, so we widen the duplicate checks below to span the whole
  // session (segmentNodeId forced to null) instead of just the terminal
  // being submitted. Only meaningful for activities; irrelevant (and a
  // no-op) for olympiad graphs, which have no segment concept.
  let disableMultiSegmentEnroll = false
  if (graph.owner_kind === 'activity' && graph.root_node_id) {
    const { data: rootNode } = await supabaseAdmin
      .from('form_nodes').select('behavior').eq('id', graph.root_node_id).maybeSingle()
    disableMultiSegmentEnroll = !!(rootNode as any)?.behavior?.disable_multi_segment_enroll
  }

  // If this is an olympiad graph, check if it requires a parent activity registration
  if (graph.owner_kind === 'olympiad') {
    const { data: olympiad } = await supabaseAdmin
      .from('olympiads')
      .select('parent_activity_session_id')
      .eq('id', graph.owner_id)
      .maybeSingle()

    if (olympiad?.parent_activity_session_id) {
      // This olympiad requires registration for a parent activity
      // Check if the user is registered for that activity
      const userIdentifiers = body.form || {}
      const email = userIdentifiers.email?.trim().toLowerCase()
      const phone = userIdentifiers.phone?.trim()
      const collegeRoll = userIdentifiers.college_roll?.trim()

      if (!email && !phone && !collegeRoll) {
        return apiError('Cannot verify parent activity registration without user identification (email, phone, or college roll).', 400)
      }

      let query = supabaseAdmin
        .from('activity_registrations')
        .select('id, full_name')
        .eq('activity_session_id', olympiad.parent_activity_session_id)

      // Build OR conditions for matching
      const orConditions: string[] = []
      if (email) orConditions.push(`email.ilike.${email}`)
      if (phone) orConditions.push(`phone.eq.${phone}`)
      if (collegeRoll) orConditions.push(`college_roll.eq.${collegeRoll}`)

      if (orConditions.length > 0) {
        query = query.or(orConditions.join(','))
      }

      const { data: parentReg } = await query.maybeSingle()

      if (!parentReg) {
        const { data: activitySession } = await supabaseAdmin
          .from('activity_sessions')
          .select('title')
          .eq('id', olympiad.parent_activity_session_id)
          .maybeSingle()

        const activityName = activitySession?.title || 'the parent activity'
        return apiError(`You must be registered for ${activityName} before registering for this olympiad.`, 403)
      }
    }
  }

  // Validate the inputs against the node's schema. We never trust the
  // client's claim about which fields are required — we re-derive it
  // from the node's `fields` JSONB.
  const form = body.form || {}
  const custom = body.custom_answers || {}
  const errors = validateRequiredFields(node as any, form, custom)
  if (errors.length) {
    return apiError(`Missing required field(s): ${errors.join(', ')}`, 400)
  }

  // Phase 2: validate + hash team members against the active node's
  // behavior.require_team config (v1 doesn't run this on every node —
  // v1 only ran it at submit time — and v2's submission is spread
  // across multiple per-node calls, so we run it here too).
  // Shared with v1 (activity-register/route.ts) via lib/teamRegistration.
  const teamCfg = (node as any).behavior?.require_team
  let preparedTeamMembers: any[] = []
  if (teamCfg) {
    const result = validateAndPrepareTeam(body.team_members, {
      require_team: true,
      // v2 stores the team policy directly on behavior.require_team;
      // map v2's flat keys (`optional`, `min`, `max`, `fields`) into the
      // shared TeamConfig shape that v1 also uses, so the helper doesn't
      // care which system produced the policy.
      team_optional: !!teamCfg.optional,
      team_size_min: teamCfg.min,
      team_size_max: teamCfg.max,
      password_required: teamCfg.password_required !== false,
      team_member_fields: teamCfg.fields,
      leader_college: form.college,
      member_field_validation: teamCfg.member_field_validation,
    })
    // tsconfig has `strict: false`, so the discriminated union on
    // ValidateTeamResult doesn't narrow via a plain `if (!result.ok)`
    // check — use the exported guard instead.
    if (!isTeamResultOk(result)) {
      return apiError((result as Extract<ValidateTeamResult, { ok: false }>).error, 400)
    }
    preparedTeamMembers = result.prepared
  }
  // If the node doesn't have require_team set, but the body still ships
  // team_members (e.g. resuming a multi-node flow where an earlier node
  // was a team node), we'd already have validated them when that earlier
  // node was submitted. So `preparedTeamMembers` is the right thing to
  // persist below. Pass through `body.team_members` if there's no team
  // config on this node — but NEVER skip hashing: see the
  // `validateAndPrepareTeam` early in this function which always runs
  // when there's config. If `body.team_members` arrives here without
  // having gone through the helper (shouldn't happen given the FormRunner
  // only sends them through team-requiring nodes), it's a malformed
  // client; skip persistence rather than write unsalted passwords.

  // Root node = creating a registration. Non-root = appending to one.
  // If registration_id was provided, it must already exist.
  let registrationId: string | null = body.registration_id || null
  const isOlympiad = graph.owner_kind === 'olympiad'
  const table = isOlympiad ? 'olympiad_registrations' : 'activity_registrations'
  const isRoot = node.parent_id === null
  let registrationFee = 0   // B4: >0 only when this submit completed a payable registration

  // Figure out up front whether this submit finishes the user's path — we
  // need this before writing anything, because the identity-field hard
  // minimum is only enforced once the path is actually done, not on every
  // intermediate node (a node partway down the tree may legitimately not
  // collect full_name/phone/email/college_roll itself).
  const { data: children } = await supabaseAdmin
    .from('form_nodes')
    .select('id, is_terminal, enabled, display_order')
    .eq('parent_id', node.id)
    .eq('enabled', true)
    .order('display_order', { ascending: true })
  // B10: honor the child the person actually picked. It must be one of this
  // node's enabled children; otherwise fall back to the first child.
  let nextNodeId: string | null = (children && children.length) ? children[0].id : null
  if (body.next_node_id !== undefined && body.next_node_id !== null) {
    const picked = (children || []).find((c: any) => c.id === body.next_node_id)
    if (!picked) return apiError('That option is not available.', 400)
    nextNodeId = picked.id
  }
  const isDone = !!node.is_terminal || !nextNodeId

  // S9: registration deadlines/flags are enforced HERE, not just in the UI.
  // Starting a NEW registration (root submit) requires the event to be open.
  // In-flight registrations may finish their path after the deadline.
  if (isRoot) {
    if (isOlympiad) {
      const { data: oly } = await supabaseAdmin.from('olympiads')
        .select('is_active, registration_deadline').eq('id', graph.owner_id).maybeSingle()
      const r = olympiadRegistrationOpen(oly)
      if (r.open === false) return apiError(r.reason, 403, { code: 'registration_closed' })
    } else {
      const { data: sess } = await supabaseAdmin.from('activity_sessions')
        .select('is_upcoming, registration_enabled, reg_deadline').eq('id', graph.owner_id).maybeSingle()
      const r = activityRegistrationOpen(sess)
      if (r.open === false) return apiError(r.reason, 403, { code: 'registration_closed' })
    }
  }

  // B8: olympiad exam-content submits respect the exam window and
  // allow_resubmission (previously only olympiad-register PUT / relay-exam did).
  if (isOlympiad && !IDENTITY_NODE_KINDS.has(node.kind as any)) {
    const { data: oly } = await supabaseAdmin.from('olympiads')
      .select('scheduled_start_at, scheduled_end_at, allow_resubmission').eq('id', graph.owner_id).maybeSingle()
    const w = checkWindow(new Date(), { opens_at: oly?.scheduled_start_at, closes_at: oly?.scheduled_end_at })
    if (w === 'not_open') return apiError('The exam has not started yet.', 403, { code: 'not_open', scheduled_start_at: oly?.scheduled_start_at })
    if (w === 'closed') return apiError('Exam time is over.', 403, { code: 'closed' })
    if (registrationId && oly?.allow_resubmission === false) {
      const { data: prev } = await supabaseAdmin.from('olympiad_registrations')
        .select('exam_submitted_at').eq('id', registrationId).maybeSingle()
      if (prev?.exam_submitted_at) return apiError('This olympiad does not allow resubmission.', 409, { code: 'resubmission_blocked' })
    }
  }

  const newBuiltins = nonEmptyBuiltins(form)

  if (isRoot) {
    if (registrationId) return apiError("Can't supply a registration id for the root submit.", 400)
    // Starting a brand-new registration requires a logged-in account.
    // Continuing an existing one (non-root submits, below) doesn't need
    // to re-check this — the registration itself couldn't have been
    // created without passing this same gate.
    if (!authedMemberId) {
      return apiError('Please log in to register for this event.', 401)
    }
    if (isDone) {
      const missing = missingHardMinimum(newBuiltins)
      if (missing.length) return apiError(`Missing required field(s): ${missing.join(', ')}`, 400)
    }
    if (isOlympiad) {
      if (newBuiltins.college_roll) {
        const rollError = resolveRollValidationError(node.fields, newBuiltins.college, newBuiltins.college_roll)
        if (rollError) return apiError(rollError, 400)
      }
      const fmtError = validateAllFieldFormats(node.fields, newBuiltins, custom)
      if (fmtError) return apiError(fmtError, 400)
      const dup = await findDuplicateLeader('olympiad_registrations', 'olympiad_id', graph.owner_id, newBuiltins)
      if (dup) {
        return NextResponse.json({
          error: `You already have a registration${dup.full_name ? ` as ${dup.full_name}` : ''}.`,
          existing_registration_id: dup.id,
        }, { status: 409 })
      }
      // mcq_answers / short_answers / photo_answers are JSONB, and we
      // lift any olympiad question fields from `custom` into them here.
      const { mcq, short, photo } = splitOlympiadAnswers(node as any, custom)
      const insert: Record<string, any> = {
        olympiad_id: graph.owner_id,
        full_name: form.full_name || null,
        phone: form.phone || null,
        email: form.email || null,
        college: form.college || null,
        college_roll: form.college_roll || null,
        hsc_session: form.hsc_session || null,
        batch: form.batch || null,
        custom_answers: custom,
        mcq_answers: mcq,
        short_answers: short,
        photo_answers: photo,
        form_graph_id: graph.id,
        form_node_id: node.id,
        submitted_node_ids: [node.id],
      }
      const { data, error } = await supabaseAdmin.from(table).insert(insert).select('id').single()
      if (error) return apiError(error, 400)
      registrationId = data.id
    } else {
      if (newBuiltins.college_roll) {
        const rollError = resolveRollValidationError(node.fields, newBuiltins.college, newBuiltins.college_roll)
        if (rollError) return apiError(rollError, 400)
      }
      const fmtError = validateAllFieldFormats(node.fields, newBuiltins, custom)
      if (fmtError) return apiError(fmtError, 400)
      // Every terminal node in the graph is its own independent
      // registration slot — a segment's leaf, or a leaf several levels
      // down inside a subsegment, doesn't share a "have they already
      // registered" bucket with any other terminal. Until the path
      // actually finishes we don't yet know which terminal it's heading
      // to, so identity/uniqueness checks are deferred to whichever
      // submit actually completes the path (isDone) — same principle the
      // hard-minimum check above already follows. This replaces the old
      // "skip only when root branches into more than one next step"
      // rule, which still ran the check immediately whenever root had
      // exactly one child even if that one child led to further branching
      // (subsegments) deeper down — wrongly treating every subsegment
      // under that child as one shared registration slot.
      if (isDone) {
        const dup = await findDuplicateLeader('activity_registrations', 'activity_session_id', graph.owner_id, newBuiltins, undefined, body.member_id)
        if (dup) {
          return NextResponse.json({
            error: `You already have a registration${dup.full_name ? ` as ${dup.full_name}` : ''} for this event.`,
            existing_registration_id: dup.id,
          }, { status: 409 })
        }
        // Phase 2: full unique_field check (any field flagged unique_field
        // in the active node, checked across leader + team_members of
        // every existing registration in the session). Mirrors v1's
        // activity-register/route.ts:248-379. The leader-row-only
        // findDuplicateLeader above only checks the top-level identity
        // columns — it doesn't see custom_answers, team_members, or
        // per-team uniqueness, which is why this extra check exists.
        const ufDup = await findUniqueFieldDuplicates(
          graph.owner_id,
          node.fields || [],
          newBuiltins,
          custom,
          preparedTeamMembers,
        )
        if (ufDup) {
          const where = ufDup.scope === 'leader' ? '' : ` on ${ufDup.full_name || 'someone'}'s team`
          return NextResponse.json({
            error: `"${ufDup.label}" with value "${ufDup.value}" is already registered for this event${where}. `
              + `Duplicate entries aren't allowed for unique fields.`,
            existing_registration_id: ufDup.id,
          }, { status: 409 })
        }
        // Task 6: default-on member email/college_roll uniqueness. Runs
        // on every team-required root submit, regardless of per-field
        // opt-in. Catches the same email registering as a team member
        // twice in the same session, or matching an existing leader.
        const tmDup = await findDuplicateTeamMembers(
          graph.owner_id,
          preparedTeamMembers,
          registrationId || undefined,
        )
        if (tmDup) {
          const where = tmDup.scope === 'leader'
            ? ` (the leader "${tmDup.full_name || 'someone'}" already used this)`
            : ` on "${tmDup.full_name || 'someone'}"'s team`
          return NextResponse.json({
            error: `A team member's ${tmDup.label} "${tmDup.value}" is already registered for this event${where}. `
              + `Each team member needs a unique email and college roll.`,
            existing_registration_id: tmDup.id,
          }, { status: 409 })
        }
      }
      const insert: Record<string, any> = {
        activity_session_id: graph.owner_id,
        full_name: form.full_name || null,
        phone: form.phone || null,
        email: form.email || null,
        college: form.college || null,
        college_roll: form.college_roll || null,
        hsc_session: form.hsc_session || null,
        division: form.division || null,
        project_name: form.project_name || null,
        custom_answers: custom,
        team_members: preparedTeamMembers,
        member_id: body.member_id || null,
        form_graph_id: graph.id,
        form_node_id: node.id,
        submitted_node_ids: [node.id],
      }
      // Task 1: team_name. The leader sends `team_name` as part of the
      // top-level `form` bag (alongside full_name etc.) whenever this
      // node has require_team set. We only store it on the row when the
      // event is a team event — for non-team events the field is absent
      // and the column stays null. Empty strings are coerced to null so
      // the optional-solo case doesn't litter the DB with "". (Trimmed
      // first; the public form already trims before sending, but be
      // defensive.)
      if (teamCfg) {
        const tn = (form.team_name || '').trim()
        if (tn) insert.team_name = tn
        else if (!teamCfg.optional) {
          // Required when the team is not optional (i.e. min > 0). The
          // public form gates this client-side; this is the server-side
          // backstop.
          return apiError('Team name is required for team events.', 400)
        }
      }
      // B4: payment is stamped once, at completion, from the whole path's fees
      // (root + segment). Never at an intermediate step.
      if (isDone && !isOlympiad) {
        const fee = computePathFee([node])
        if (fee > 0) {
          insert.payment_status = 'pending'
          insert.payment_amount = fee
          registrationFee = fee
        }
      }
      // Completion (completed_at / terminal_node_id) is stamped atomically with the
      // registration_slots rows by finalizeCompletion() below.
      const { data, error } = await supabaseAdmin.from(table).insert(insert).select('id').single()
      if (error) return apiError(error, 400)
      registrationId = data.id
      // Task 5: bridge team_members to real member accounts. Runs
      // after the row is committed so the FK on team_member_links
      // resolves. Best-effort: failures don't fail the registration.
      if (preparedTeamMembers.length) {
        await linkTeamMembersToAccounts(registrationId, body.member_id, preparedTeamMembers)
      } else if (body.member_id) {
        // Solo registration by a logged-in member — record the
        // leader link so the dashboard surfaces this event under
        // their account via the same read path.
        await linkTeamMembersToAccounts(registrationId, body.member_id, [])
      }
    }
  } else {
    if (!registrationId) return apiError("registration_id is required for non-root submits.", 400)
    // Load the existing registration so we can merge.
    const { data: existing, error: rErr } = await supabaseAdmin
      .from(table).select('*').eq('id', registrationId).maybeSingle()
    if (rErr) return apiError(rErr, 400)
    if (!existing) return apiError('Registration not found.', 404)
    if (existing.form_graph_id !== graph.id) {
      return apiError("Registration isn't on this form graph.", 400)
    }

    // B3: path integrity. A registration can only move forward along the
    // tree (or re-submit a node it already passed, which truncates the
    // path there). It can never jump to a sibling/unrelated node, and a
    // completed activity registration can't be re-routed at all.
    if (!isOlympiad && (existing as any).completed_at) {
      return apiError('This registration is already complete.', 409)
    }
    const step = evaluateStep({ priorPath: existing.submitted_node_ids, rootId: graph.root_node_id, node })
    if (step.ok === false) {
      return apiError("That step doesn't follow from where this registration is.", 409)
    }
    const newPath: string[] = step.newPath
    // B15: every ancestor must exist in this graph and be enabled.
    {
      const { data: graphNodes, error: gnErr } = await supabaseAdmin
        .from('form_nodes').select('id, parent_id, enabled').eq('graph_id', graph.id)
      if (gnErr) return apiError(gnErr, 400)
      const byId = new Map<string, { id: string; parent_id: string | null; enabled: boolean }>(
        (graphNodes || []).map((n: any) => [n.id, n]))
      let cur: string | null = node.parent_id
      let guard = 0
      while (cur && guard++ < 100) {
        const anc = byId.get(cur)
        if (!anc) return apiError('This form is misconfigured (broken path).', 409)
        if (!anc.enabled) return apiError('This form is currently disabled.', 403)
        cur = anc.parent_id
      }
    }

    // The terminal this registration is heading to, for scoping the
    // duplicate checks below — see inSameSegment(). We only know the true
    // scope once the path is actually finished (isDone): `node` is then
    // the terminal itself, so every other registration is compared by
    // whether IT also ended at this same node id. This makes each
    // terminal — a segment's leaf, or a leaf under a subsegment several
    // levels deep — its own independent registration slot, regardless of
    // how many branch points (segments, subsegments, ...) sit above it.
    // Overridden to null (whole-session scope) when the graph's root has
    // "disable multiple segment enroll" on — see disableMultiSegmentEnroll
    // above.
    const segmentNodeId: string | null = (isDone && !disableMultiSegmentEnroll) ? node.id : null

    // Whatever's already on the row, topped up with anything new from this
    // node — this is what we check the hard minimum against, and it's also
    // what actually gets written below. Previously only the root submit
    // ever wrote full_name/phone/email/etc. to their top-level columns, so
    // any identity fields collected on a later node (e.g. a "Common
    // details" step) were silently dropped.
    const effectiveBuiltins: Record<string, any> = {
      full_name: existing.full_name, phone: existing.phone, email: existing.email,
      college: existing.college, college_roll: existing.college_roll,
      hsc_session: existing.hsc_session, division: (existing as any).division,
      batch: (existing as any).batch,
      ...newBuiltins,
    }
    if (newBuiltins.college_roll) {
      const rollError = resolveRollValidationError(node.fields, effectiveBuiltins.college, newBuiltins.college_roll)
      if (rollError) return apiError(rollError, 400)
    }
    const fmtError = validateAllFieldFormats(node.fields, effectiveBuiltins, custom)
    if (fmtError) return apiError(fmtError, 400)
    // Identity/uniqueness checks below are deferred until this submit is
    // the one that actually completes the path (isDone) — see the
    // segmentNodeId comment above. An intermediate node partway down the
    // tree may share identity fields with sibling branches that lead to
    // entirely different (and independently registrable) terminals, so
    // checking early would wrongly reject a path that hasn't reached its
    // own terminal yet.
    if (isDone) {
      const dup = await findDuplicateLeader(table as any, (isOlympiad ? 'olympiad_id' : 'activity_session_id') as any, graph.owner_id, newBuiltins, registrationId, body.member_id, isOlympiad ? null : segmentNodeId)
      if (dup) {
        return NextResponse.json({
          error: `You already have a registration${dup.full_name ? ` as ${dup.full_name}` : ''}.`,
          existing_registration_id: dup.id,
        }, { status: 409 })
      }
    }
    // Phase 2: full unique_field check on the activity non-root branch.
    // Olympiads have no team_members, so the leader-level check above
    // is sufficient — skip the deeper check for them.
    if (!isOlympiad && teamCfg && isDone) {
      const ufDup = await findUniqueFieldDuplicates(
        graph.owner_id,
        node.fields || [],
        newBuiltins,
        custom,
        preparedTeamMembers,
        registrationId,
        segmentNodeId,
      )
      if (ufDup) {
        const where = ufDup.scope === 'leader' ? '' : ` on ${ufDup.full_name || 'someone'}'s team`
        return NextResponse.json({
          error: `"${ufDup.label}" with value "${ufDup.value}" is already registered for this event${where}. `
            + `Duplicate entries aren't allowed for unique fields.`,
          existing_registration_id: ufDup.id,
        }, { status: 409 })
      }
      // Task 6: default-on member uniqueness on the non-root branch too,
      // excluding the row being edited (so the same team doesn't trip
      // its own check). Registration edits get a clean pass-through
      // for unchanged fields, and a hard fail for genuinely conflicting
      // new entries.
      const tmDup = await findDuplicateTeamMembers(
        graph.owner_id,
        preparedTeamMembers,
        registrationId,
        segmentNodeId,
      )
      if (tmDup) {
        const where = tmDup.scope === 'leader'
          ? ` (the leader "${tmDup.full_name || 'someone'}" already used this)`
          : ` on "${tmDup.full_name || 'someone'}"'s team`
        return NextResponse.json({
          error: `A team member's ${tmDup.label} "${tmDup.value}" is already registered for this event${where}. `
            + `Each team member needs a unique email and college roll.`,
          existing_registration_id: tmDup.id,
        }, { status: 409 })
      }
    }
    if (isDone) {
      const missing = missingHardMinimum(effectiveBuiltins)
      if (missing.length) return apiError(`Missing required field(s): ${missing.join(', ')}`, 400)
    }

    // Merge into the appropriate column shape.
    // Filter builtins to only include columns that exist on the target table.
    // olympiad_registrations has no 'division' column, so we exclude it for
    // olympiads; activity_registrations has no 'batch' column, so we exclude
    // that for activities.
    const filteredBuiltins = isOlympiad
      ? (({ division, ...rest }) => rest)(newBuiltins)
      : (({ batch, ...rest }) => rest)(newBuiltins)
    const patch: Record<string, any> = {
      form_node_id: node.id,
      submitted_node_ids: newPath,
      ...filteredBuiltins,
    }
    // B7: answers are stored per node with REPLACE semantics. Keys owned by
    // this node (re-submit) and by nodes that fell off the path (branch
    // switch / going back) are removed before the new answers are merged, so
    // nothing is duplicated and nothing from an abandoned branch survives.
    const ownKeys = (fields: any): string[] => normalizeBlocks(fields || [])
      .filter((f: any) => f.kind === 'field' && !f.is_builtin)
      .map((f: any) => f.key || f.id)
    const droppedIds = new Set<string>(step.dropped)
    const removeKeys = new Set<string>(ownKeys(node.fields))
    if (step.dropped.length) {
      const { data: droppedNodes } = await supabaseAdmin
        .from('form_nodes').select('id, fields').in('id', step.dropped)
      for (const dn of (droppedNodes || [])) for (const k of ownKeys((dn as any).fields)) removeKeys.add(k)
    }
    const baseCustom: Record<string, any> = {}
    for (const [k, v] of Object.entries((existing.custom_answers || {}) as Record<string, any>)) {
      if (!removeKeys.has(k)) baseCustom[k] = v
    }
    const mergedCustom = { ...baseCustom, ...custom }
    patch.custom_answers = mergedCustom
    if (isOlympiad) {
      // mcq/short/photo are DERIVED from custom_answers over the surviving
      // path (never appended), so re-submits can't duplicate photos.
      const { data: pathNodes } = await supabaseAdmin
        .from('form_nodes').select('id, fields').in('id', newPath)
      const mcq: Record<string, any> = {}
      const short: Record<string, any> = {}
      const photo: string[] = []
      for (const pn of (pathNodes || [])) {
        const part = splitOlympiadAnswers((pn.id === node.id ? node : pn) as any, mergedCustom)
        Object.assign(mcq, part.mcq); Object.assign(short, part.short); photo.push(...part.photo)
      }
      patch.mcq_answers = mcq
      patch.short_answers = short
      patch.photo_answers = photo
    } else {
      // Team members are tagged with the node that collected them. On a
      // re-submit of this node, or when their node fell off the path, they
      // are dropped and replaced. Untagged (pre-fix) members are kept
      // unless this very node is being re-submitted with a team config
      // (they'd otherwise be duplicated).
      const prior: any[] = Array.isArray(existing.team_members) ? existing.team_members : []
      const revisitedThisNode = droppedIds.has(node.id)
      const kept = prior.filter((m: any) => m && (m.node_id
        ? (m.node_id !== node.id && !droppedIds.has(m.node_id))
        : !(teamCfg && revisitedThisNode)))
      if (preparedTeamMembers.length || kept.length !== prior.length) {
        patch.team_members = [...kept, ...preparedTeamMembers.map((m: any) => ({ ...m, node_id: node.id }))]
      }
      // Task 1 (non-root branch): for team-required graphs where the
      // team_name is collected on a leaf node rather than the root,
      // the form sends {team_name} on this submit and we persist it
      // here. Mirror the same trim/required rule as the root branch:
      // missing team_name is a 400 only when team is not optional.
      if (teamCfg) {
        const tn = (form.team_name || '').trim()
        if (tn) patch.team_name = tn
        else if (!teamCfg.optional) {
          return apiError('Team name is required for team events.', 400)
        }
      }
    }
    if (isDone && !isOlympiad) {
      // completed_at / terminal_node_id: see finalizeCompletion().
      // B4: fee = sum over the completed path; never touch an already-paid row.
      if (existing.payment_status !== 'paid') {
        const { data: feeNodes } = await supabaseAdmin
          .from('form_nodes').select('id, behavior').in('id', newPath)
        const fee = computePathFee(feeNodes || [])
        if (fee > 0) {
          patch.payment_status = 'pending'
          patch.payment_amount = fee
          registrationFee = fee
        } else {
          patch.payment_status = 'not_required'
          patch.payment_amount = null
        }
      }
    }
    const { error: uErr } = await supabaseAdmin.from(table).update(patch).eq('id', registrationId)
    if (uErr) return apiError(uErr, 400)
    // Task 5: bridge on the non-root path too. Re-link when team
    // members change (e.g. user edits their team and replaces a
    // member). The upsert is idempotent — adding the same link twice
    // is a no-op.
    if (preparedTeamMembers.length) {
      await linkTeamMembersToAccounts(registrationId, body.member_id, preparedTeamMembers)
    } else if (body.member_id) {
      await linkTeamMembersToAccounts(registrationId, body.member_id, [])
    }
  }

  // B9 / Part 3: complete the registration and claim its slots in ONE transaction.
  // A unique-index conflict (same person already holds this segment, or another
  // segment of the same group) becomes a 409 and the row stays an incomplete draft.
  if (isDone && !isOlympiad && registrationId) {
    const blocked = await finalizeCompletion(registrationId, node.id, graph, disableMultiSegmentEnroll)
    if (blocked) return blocked
  }

  // Figure out the next step. For an olympiad, the questions node sets
  // exam_started_at the FIRST time it's entered and exam_submitted_at
  // when its form is submitted (or the terminal node is submitted).
  if (isOlympiad) {
    await maybeMarkOlympiadTimers(table as any, registrationId, graph, node as any)
  }

  // Per-event welcome email (migration 33) — fires the moment this
  // registration's path is fully complete, regardless of payment status.
  // No-op unless the event has it turned on; never throws, so a send
  // failure can't turn a successful registration into an error response.
  // Awaited (not fire-and-forget) since this route runs as an ordinary
  // request/response cycle with no background-task runner behind it — an
  // un-awaited call here could be cut off before it finishes once the
  // response is sent.
  if (isDone && registrationId) {
    await sendWelcomeEmailIfEnabled(table as any, registrationId)
  }

  return apiOk({
    registration_id: registrationId,
    next_node_id: nextNodeId,
    done: isDone,
    is_olympiad: isOlympiad,
    // Phase 3: when this row was created with a pending payment (root
    // node + behavior.requires_payment set), the FormRunner uses this
    // flag to immediately POST /api/payment/init and redirect to the
    // gateway. Only meaningful on activities — olympiad graphs have no
    // payment hook.
    requires_payment_init: !isOlympiad && isDone && registrationFee > 0,
    payment_amount: registrationFee || null,
  })
}

// Splits a node's olympiad answer fields out of the generic custom_answers bag
// into the dedicated columns on olympiad_registrations. Returns the per-bucket
// maps / array. We do the split server-side so the client never has to know about it.
//
// NEW BEHAVIOR: This still only lifts mcq/checkbox/short_answer/photo into the
// dedicated columns (mcq_answers / short_answers / photo_answers), because those
// columns already exist and the grading UI already reads from them. All OTHER
// field types (text, number, dropdown, date, file, etc.) stay in custom_answers
// only — ResponseDetailModal and the CSV export now read from custom_answers as
// a fallback when the dedicated columns don't have the answer, so newly-included
// types work without a schema migration.
function splitOlympiadAnswers(node: FormNode, custom: Record<string, any>) {
  const mcq: Record<string, any> = {}
  const short: Record<string, any> = {}
  const photo: string[] = []
  for (const f of normalizeBlocks(node.fields)) {
    if (f.kind !== 'field') continue
    const k = f.key || f.id
    const v = custom[k]
    if (v === undefined) continue
    if (f.type === 'mcq') mcq[k] = v
    else if (f.type === 'checkbox') mcq[k] = v
    else if (f.type === 'short_answer') short[k] = v
    else if (f.type === 'photo') {
      if (Array.isArray(v)) photo.push(...v.filter((x: any) => typeof x === 'string'))
      else if (typeof v === 'string') photo.push(v)
    }
    // All other types (text, textarea, number, dropdown, date, time, file, etc.)
    // remain in custom_answers only — the grading UI reads them from there.
  }
  return { mcq, short, photo }
}

// For olympiad graphs, set exam_started_at the first time the registrant submits
// a node that is NOT an identity/registration node (preset_common_details,
// preset_team_info). This triggers the timer on the first actual exam content node,
// regardless of what node kind it is. Set exam_submitted_at when a terminal node
// is submitted.
async function maybeMarkOlympiadTimers(table: string, registrationId: string, graph: any, node: FormNode) {
  // Skip identity nodes — they don't trigger the timer
  if (IDENTITY_NODE_KINDS.has(node.kind as any)) return

  // B8: exam_started_at is stamped ONLY the first time (never overwritten), using
  // the server clock. exam_submitted_at is stamped when a terminal node is submitted.
  const { data: cur } = await supabaseAdmin.from(table).select('exam_started_at').eq('id', registrationId).maybeSingle()
  const patch: Record<string, any> = {}
  if (!cur?.exam_started_at) patch.exam_started_at = new Date().toISOString()
  if (node.is_terminal) patch.exam_submitted_at = new Date().toISOString()
  if (Object.keys(patch).length) await supabaseAdmin.from(table).update(patch).eq('id', registrationId)
}


// Completes a registration and writes its slots atomically (db/36 complete_registration).
// Returns a NextResponse to send back on conflict/error, or null on success.
// If migration 36 has not been applied yet, falls back to the old direct stamp so a
// deploy that lands before the migration does not break registrations.
async function finalizeCompletion(
  registrationId: string,
  terminalId: string,
  graph: any,
  disableMultiSegmentEnroll: boolean,
): Promise<NextResponse | null> {
  const { data: reg } = await supabaseAdmin.from('activity_registrations')
    .select('activity_session_id, member_id, email, phone, college_roll, team_members')
    .eq('id', registrationId).maybeSingle()
  if (!reg) return apiError('Registration not found.', 404)
  const { data: links } = await supabaseAdmin.from('team_member_links')
    .select('member_id, role').eq('registration_id', registrationId)
  const { data: nodeRows } = await supabaseAdmin.from('form_nodes')
    .select('id, parent_id, is_terminal, enabled, behavior').eq('graph_id', graph.id)
  const byId = new Map<string, any>((nodeRows || []).map((n: any) => [n.id, n]))
  const groups = Array.isArray(graph.settings?.segment_groups) ? graph.settings.segment_groups : []
  const groupKey = groupKeyFor(terminalId, byId, groups, disableMultiSegmentEnroll)

  const identities = buildSlotIdentities({
    leader: reg as any,
    team: Array.isArray(reg.team_members) ? reg.team_members : [],
    teamMemberAccountIds: (links || []).filter((l: any) => l.role !== 'leader').map((l: any) => l.member_id),
  })

  const { data, error } = await supabaseAdmin.rpc('complete_registration', {
    p_registration_id: registrationId,
    p_session_id: reg.activity_session_id,
    p_terminal_id: terminalId,
    p_group_key: groupKey,
    p_identities: identities,
  })
  if (error) {
    const missing = (error as any).code === 'PGRST202' || (error as any).code === '42883'
    if (missing) {
      console.warn('complete_registration() missing; apply db/36 migration. Falling back to direct stamp.')
      const { error: e2 } = await supabaseAdmin.from('activity_registrations')
        .update({ completed_at: new Date().toISOString(), terminal_node_id: terminalId }).eq('id', registrationId)
      return e2 ? apiError(e2, 400) : null
    }
    return apiError(error, 400)
  }
  const res: any = data
  if (res?.ok) return null

  const c = res?.conflict || {}
  if (c.self) return apiError('Some identifiers (email, phone or roll) are repeated within your own registration.', 400)
  let segLabel: string | null = null
  if (c.terminal_node_id) {
    segLabel = (byId.get(c.terminal_node_id) as any)?.label ?? null
    if (!segLabel) {
      const { data: n } = await supabaseAdmin.from('form_nodes').select('label').eq('id', c.terminal_node_id).maybeSingle()
      segLabel = (n as any)?.label ?? null
    }
  }
  const groupName = c.group_key && c.group_key !== '__all__'
    ? (groups.find((g: any) => g.id === c.group_key)?.name ?? null) : null
  const who = c.role === 'leader' ? 'registered as a leader' : 'on a team'
  const message = c.same_terminal
    ? `This ${c.kind === 'member' ? 'account' : c.kind} is already registered in this segment${segLabel ? ` (${segLabel})` : ''}.`
    : `This ${c.kind === 'member' ? 'account' : c.kind} is already ${who} in ${segLabel ? `"${segLabel}"` : 'another segment'}. `
      + (groupName ? `You can register in only one segment of "${groupName}".` : 'You can register in only one segment of this event.')
  return NextResponse.json({
    error: message,
    code: c.same_terminal ? 'duplicate_registration' : 'segment_group_conflict',
    group_id: c.group_key ?? null,
    group_name: groupName,
    conflicting_node_id: c.terminal_node_id ?? null,
    conflicting_segment_label: segLabel,
    existing_registration_id: c.registration_id ?? null,
    who: c.role ?? null,
  }, { status: 409 })
}
