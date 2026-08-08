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
//     owner_kind is 'olympiad'
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
//   - next_node_id is the FIRST child of the just-submitted node
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

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { validateCollegeRoll } from '@/lib/validation'
import { apiError, apiOk } from '@/lib/api/response'
import { normalizeBlocks, HARD_MINIMUM_KEYS } from '@/lib/formBlocks'
import { validateAndPrepareTeam, isTeamResultOk, type ValidateTeamResult } from '@/lib/teamRegistration'
import type { FormNode } from '@/lib/formGraph'

const OLYMPIAD_NODE_KINDS = new Set(['preset_olympiad_questions'])

type SubmitBody = {
  graph_id?: string
  node_id?: string
  registration_id?: string         // set on every non-root submit
  form?: Record<string, any>       // built-in values
  custom_answers?: Record<string, any>
  team_members?: any[]
  // Set when the registrant is logged in as a member (FormRunner reads
  // this from the current Supabase session). Only meaningful for
  // activities — activity_registrations.member_id is a real FK column;
  // olympiad_registrations has no equivalent column, so this is ignored
  // for olympiad graphs.
  member_id?: string | null
  // olympiad question fields are merged into custom_answers by the client
  // (using `key` or `id`); the server lifts them to mcq_answers /
  // short_answers / photo_answers at the terminal submit.
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
  const keys: string[] = ['full_name', 'phone', 'email', 'college', 'college_roll', 'hsc_session', 'division']
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
async function findDuplicateLeader(
  table: 'activity_registrations' | 'olympiad_registrations',
  ownerCol: 'activity_session_id' | 'olympiad_id',
  ownerId: string,
  builtins: Record<string, any>,
  excludeId?: string,
  memberId?: string | null
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
  type DupRow = { id: string; full_name: string | null; member_id?: string | null }
  let data: DupRow[] | null = null
  if (table === 'activity_registrations') {
    let query = supabaseAdmin
      .from('activity_registrations')
      .select('id, full_name, email, phone, college_roll, member_id')
      .eq(ownerCol, ownerId)
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
    .select('id, full_name, email, phone, college_roll, custom_answers, team_members')
    .eq('activity_session_id', activitySessionId)
  if (excludeId) query = query.neq('id', excludeId)
  const { data: existingRegs } = await query

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
    .select('id, full_name, email, phone, college_roll, team_members')
    .eq('activity_session_id', activitySessionId)
  if (excludeId) query = query.neq('id', excludeId)
  const { data: existing } = await query
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
  const nextNodeId = (children && children.length) ? children[0].id : null
  const isDone = !!node.is_terminal || !nextNodeId

  const newBuiltins = nonEmptyBuiltins(form)

  if (isRoot) {
    if (registrationId) return apiError("Can't supply a registration id for the root submit.", 400)
    if (isDone) {
      const missing = missingHardMinimum(newBuiltins)
      if (missing.length) return apiError(`Missing required field(s): ${missing.join(', ')}`, 400)
    }
    if (isOlympiad) {
      if (newBuiltins.college_roll) {
        const rollError = validateCollegeRoll(newBuiltins.college, newBuiltins.college_roll)
        if (rollError) return apiError(rollError, 400)
      }
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
        const rollError = validateCollegeRoll(newBuiltins.college, newBuiltins.college_roll)
        if (rollError) return apiError(rollError, 400)
      }
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
      // Phase 3: payment. Mirror v1's activity-register behavior — when
      // the active root node declares a payment amount, stamp
      // payment_status='pending' + payment_amount on the new row, and
      // tell the client (via the response below) to kick off
      // /api/payment/init so it can redirect to the SSLCommerz gateway.
      // We only do this when the root submit IS DONE — a payment-required
      // intermediate node that still has children to visit wouldn't make
      // sense as a payment trigger. (Same shape as v1: payment fires
      // only at final registration submit.)
      const payCfg = (node as any).behavior?.requires_payment
      if (payCfg && typeof payCfg.amount === 'number' && payCfg.amount > 0) {
        insert.payment_status = 'pending'
        insert.payment_amount = payCfg.amount
      }
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
      ...newBuiltins,
    }
    if (newBuiltins.college_roll) {
      const rollError = validateCollegeRoll(effectiveBuiltins.college, newBuiltins.college_roll)
      if (rollError) return apiError(rollError, 400)
    }
    {
      const dup = await findDuplicateLeader(table as any, (isOlympiad ? 'olympiad_id' : 'activity_session_id') as any, graph.owner_id, newBuiltins, registrationId, body.member_id)
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
    if (!isOlympiad && teamCfg) {
      const ufDup = await findUniqueFieldDuplicates(
        graph.owner_id,
        node.fields || [],
        newBuiltins,
        custom,
        preparedTeamMembers,
        registrationId,
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
    // olympiad_registrations has no 'division' column, so we exclude it for olympiads.
    const filteredBuiltins = isOlympiad
      ? (({ division, ...rest }) => rest)(newBuiltins)
      : newBuiltins
    const patch: Record<string, any> = {
      form_node_id: node.id,
      submitted_node_ids: [...(existing.submitted_node_ids || []), node.id],
      ...filteredBuiltins,
    }
    if (isOlympiad) {
      // Lift olympiad question fields into the dedicated columns.
      const { mcq, short, photo } = splitOlympiadAnswers(node as any, custom)
      patch.custom_answers = { ...(existing.custom_answers || {}), ...custom }
      patch.mcq_answers = { ...(existing.mcq_answers || {}), ...mcq }
      patch.short_answers = { ...(existing.short_answers || {}), ...short }
      patch.photo_answers = [...(existing.photo_answers || []), ...photo]
    } else {
      patch.custom_answers = { ...(existing.custom_answers || {}), ...custom }
      // Phase 2: append the freshly-validated + hashed members to the
      // existing team_members list. preparedTeamMembers is the
      // client-supplied body.team_members after validation + hashing,
      // so we never write a password field through to the row.
      if (preparedTeamMembers.length) {
        patch.team_members = [...(existing.team_members || []), ...preparedTeamMembers]
      } else if (body.team_members && body.team_members.length) {
        // Defensive: a team_members array arriving at a node whose
        // behavior.require_team is NOT set means the client is
        // resubmitting the form on a non-team step. Preserve whatever
        // was already persisted — don't clobber, don't append raw.
        // (The phase-1 validateAndPrepareTeam above already skipped
        // this case because teamCfg was null, so we just keep what we
        // have.)
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

  // Figure out the next step. For an olympiad, the questions node sets
  // exam_started_at the FIRST time it's entered and exam_submitted_at
  // when its form is submitted (or the terminal node is submitted).
  if (isOlympiad) {
    await maybeMarkOlympiadTimers(table as any, registrationId, graph, node as any)
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
    requires_payment_init: !isOlympiad && !!(node as any).behavior?.requires_payment?.amount,
  })
}

// Splits a node's olympiad question fields (mcq / checkbox / short_answer /
// photo) out of the generic custom_answers bag into the dedicated columns
// on olympiad_registrations. Returns the per-bucket maps / array. We do
// the split server-side so the client never has to know about it.
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
  }
  return { mcq, short, photo }
}

// For olympiad graphs, set exam_started_at the first time the registrant
// ENTERS the questions node (i.e. on its non-root submit OR — if the
// root is the questions node — on its root submit). Set exam_submitted_at
// when the questions node OR a downstream terminal node is submitted.
async function maybeMarkOlympiadTimers(table: string, registrationId: string, graph: any, node: FormNode) {
  const isQuestionsNode = node.kind === 'preset_olympiad_questions' || OLYMPIAD_NODE_KINDS.has(node.kind as any)
  if (!isQuestionsNode) return
  // exam_started_at is set the first time we see this node — the runner
  // doesn't submit a question node on entry, only on submit, so by the
  // time we get here exam_started_at might still be null. We approximate
  // "started" as the time of submit, which is the conservative choice.
  const patch: Record<string, any> = { exam_started_at: new Date().toISOString() }
  if (node.is_terminal) patch.exam_submitted_at = new Date().toISOString()
  await supabaseAdmin.from(table).update(patch).eq('id', registrationId)
}
