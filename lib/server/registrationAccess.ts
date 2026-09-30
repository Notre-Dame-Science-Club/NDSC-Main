// The ONE server-side gate for a segment's submission / olympiad (Part 1.1).
// A caller may act only if: a COMPLETE registration ends at this segment's node,
// the caller is provably its leader or a team member (verified bearer token or
// signed team token, never a client-claimed id), the node chain is enabled,
// payment is settled, the relevant window is open, and any requested olympiad
// equals the node's linked olympiad.
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyTeamToken } from '@/lib/api/teamToken'
import { normalizeEmail } from '@/lib/identity'
import { checkWindow, paymentSettled, terminalOf } from '@/lib/segmentAccess'

export type AccessNeed = 'submission' | 'olympiad' | 'view'
export type AccessOk = {
  ok: true
  registration: any
  node: any
  role: 'leader' | 'team_member'
  teamMemberId: string | null
  /** 'leader' or the team_members[].id this caller is; null if unknown. */
  participantId: string | null
  memberId: string | null
  olympiadId: string | null
}
export type AccessDenied = { ok: false; status: 401 | 403 | 404 | 409 | 402 | 503; code: string; message: string; extra?: Record<string, any> }

const deny = (status: AccessDenied['status'], code: string, message: string, extra?: Record<string, any>): AccessDenied =>
  ({ ok: false, status, code, message, extra })

async function resolveMember(req: NextRequest): Promise<{ id: string | null; transient: boolean }> {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) return { id: null, transient: false }
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !data?.user) {
      // 4xx from the auth server = bad token; anything else = transient.
      const st = (error as any)?.status
      return { id: null, transient: !!st && st >= 500 }
    }
    return { id: data.user.id, transient: false }
  } catch { return { id: null, transient: true } }
}

export type IdentityOk = {
  ok: true
  registration: any
  role: 'leader' | 'team_member'
  teamMemberId: string | null
  participantId: string | null
  memberId: string | null
}

/**
 * Identity only (no completeness / enabled / payment / window checks): proves the
 * caller is the registration's leader or a team member. Used by the dashboard
 * read/edit routes, which must work for unpaid or in-progress registrations.
 */
export async function resolveRegistrationIdentity(
  req: NextRequest,
  registrationId: string | null | undefined
): Promise<IdentityOk | AccessDenied> {
  if (!registrationId) return deny(404, 'registration_not_found', 'Registration not found.')

  // 1. Who is calling (verified).
  const team = verifyTeamToken(req.headers.get('x-team-token'))
  const member = await resolveMember(req)
  if (member.transient && !team) return deny(503, 'auth_unavailable', 'Could not verify your session. Please try again.')
  if (!member.id && !team) return deny(401, 'unauthenticated', 'Please log in.')

  // 2. The registration.
  const { data: reg } = await supabaseAdmin
    .from('activity_registrations').select('*').eq('id', registrationId).maybeSingle()
  if (!reg) return deny(404, 'registration_not_found', 'Registration not found.')

  // 3. Is the caller on it?
  let role: 'leader' | 'team_member' | null = null
  let teamMemberId: string | null = null
  if (member.id) {
    if (reg.member_id === member.id) role = 'leader'
    else {
      const { data: link } = await supabaseAdmin.from('team_member_links')
        .select('role').eq('registration_id', reg.id).eq('member_id', member.id).maybeSingle()
      if (link) role = link.role === 'leader' ? 'leader' : 'team_member'
    }
  }
  // Auto-enroll: listed on the team by e-mail but the account was created later (or the
  // e-mail was typed with different casing) -> treat as a team member and record the link.
  if (!role && member.id) {
    const { data: me } = await supabaseAdmin.from('members').select('email').eq('id', member.id).maybeSingle()
    const mine = normalizeEmail(me?.email)
    const onTeam = mine && (Array.isArray(reg.team_members) ? reg.team_members : []).some((x: any) => normalizeEmail(x?.email) === mine)
    if (onTeam) {
      role = 'team_member'
      await supabaseAdmin.from('team_member_links').upsert(
        [{ registration_id: reg.id, member_id: member.id, role: 'team_member', email_at_registration: mine }],
        { onConflict: 'registration_id,member_id', ignoreDuplicates: true },
      )
    }
  }
  if (!role && team && team.registrationId === reg.id) {
    const m = (Array.isArray(reg.team_members) ? reg.team_members : []).find((x: any) => x?.id === team.teamMemberId)
    if (m) { role = 'team_member'; teamMemberId = m.id }
  }
  if (!role) return deny(403, 'not_on_registration', "You're not part of this registration.")

  let participantId: string | null = role === 'leader' ? 'leader' : teamMemberId
  if (!participantId && member.id) {
    const { data: me } = await supabaseAdmin.from('members').select('email').eq('id', member.id).maybeSingle()
    const mine = normalizeEmail(me?.email)
    const m = mine ? (Array.isArray(reg.team_members) ? reg.team_members : []).find((x: any) => normalizeEmail(x?.email) === mine) : null
    participantId = m?.id ?? null
  }

  return { ok: true, registration: reg, role, teamMemberId, participantId, memberId: member.id }
}

export async function authorizeSegmentAccess(
  req: NextRequest,
  registrationId: string | null | undefined,
  opts: { need: AccessNeed; requestedOlympiadId?: string | null }
): Promise<AccessOk | AccessDenied> {
  if (!registrationId) return deny(404, 'registration_not_found', 'Registration not found.')

  // 1-3. Who is calling, the registration, and whether the caller is on it.
  const idn = await resolveRegistrationIdentity(req, registrationId)
  if (idn.ok === false) return idn
  const { registration: reg, role, teamMemberId, participantId } = idn
  const member = { id: idn.memberId }

  // 4. Completeness.
  if (!reg.completed_at) return deny(409, 'registration_incomplete', 'This registration was never completed.')

  // 5. Segment node + ancestor chain enabled.
  const nodeId = terminalOf(reg)
  if (!nodeId) return deny(409, 'segment_missing', 'This segment is no longer available.')
  const { data: node } = await supabaseAdmin.from('form_nodes').select('*').eq('id', nodeId).maybeSingle()
  if (!node) return deny(409, 'segment_missing', 'This segment is no longer available.')
  let cur: string | null = node.id, guard = 0
  while (cur && guard++ < 100) {
    const { data: n } = await supabaseAdmin.from('form_nodes').select('id, parent_id, enabled').eq('id', cur).maybeSingle()
    if (!n) return deny(409, 'segment_missing', 'This segment is no longer available.')
    if (!n.enabled) return deny(409, 'segment_disabled', 'This segment is currently disabled.')
    cur = n.parent_id
  }

  // 6. Payment.
  if (!paymentSettled(reg.payment_status)) return deny(402, 'payment_required', 'Payment is required before you can continue.', { payment_status: reg.payment_status })

  // 7. Need-specific rules.
  let olympiadId: string | null = null
  if (opts.need === 'submission') {
    const sub = node.behavior?.submission
    if (!sub?.enabled) return deny(403, 'submission_disabled', "This segment has no open submission.")
    const w = checkWindow(new Date(), sub)
    if (w === 'not_open') return deny(403, 'not_open', 'Submission has not opened yet.', { opens_at: sub.opens_at })
    if (w === 'closed') return deny(403, 'closed', 'Submission is closed.', { closes_at: sub.closes_at })
  } else if (opts.need === 'olympiad') {
    olympiadId = node.behavior?.linked_olympiad_id || null
    if (!olympiadId) return deny(403, 'no_olympiad', 'This segment has no linked olympiad.')
    if (opts.requestedOlympiadId && opts.requestedOlympiadId !== olympiadId) {
      return deny(403, 'olympiad_mismatch', "That olympiad isn't part of your segment.")
    }
    const { data: oly } = await supabaseAdmin.from('olympiads')
      .select('scheduled_start_at, scheduled_end_at').eq('id', olympiadId).maybeSingle()
    if (!oly) return deny(404, 'olympiad_not_found', 'Olympiad not found.')
    const w = checkWindow(new Date(), { opens_at: oly.scheduled_start_at, closes_at: oly.scheduled_end_at })
    if (w === 'not_open') return deny(403, 'not_open', 'The exam has not started yet.', { scheduled_start_at: oly.scheduled_start_at })
    if (w === 'closed') return deny(403, 'closed', 'Exam time is over.')
  }

  return { ok: true, registration: reg, node, role, teamMemberId, participantId, memberId: member.id, olympiadId }
}

export function denyResponse(d: AccessDenied) {
  return NextResponse.json({ error: d.message, code: d.code, ...(d.extra || {}) }, { status: d.status })
}
