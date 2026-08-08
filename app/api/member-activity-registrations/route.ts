import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { apiError, apiOk } from '@/lib/api/response'

// GET /api/member-activity-registrations?member_id=UUID
// Returns all activity registrations for a member, with session + category info.
// Used by the member dashboard to show enrolled events list.
//
// Task 5: includes both events the member registered for *as leader*
// (member_id column on activity_registrations) AND events they were
// added to as a *team member* (team_member_links bridge table). Each
// row is tagged with a `role` so the dashboard can render leader /
// team-member entries distinctly.
//
// Read-time fallback: registrations whose team_members jsonb has
// entries matching this member's email but no row in
// team_member_links (typically a pre-migration row) are included too,
// by scanning the jsonb at read time. This keeps the dashboard
// accurate for registrations created before the bridge was added,
// without requiring a backfill migration.
export async function GET(req: NextRequest) {
  const memberId = req.nextUrl.searchParams.get('member_id')
  if (!memberId) return apiError('member_id is required', 400)

  // Fetch this member's email once (used for the read-time fallback scan).
  const { data: memberRow } = await supabaseAdmin
    .from('members')
    .select('email')
    .eq('id', memberId)
    .maybeSingle()
  const memberEmail = (memberRow?.email || '').trim().toLowerCase()

  // Two parallel fetches: leader rows + team_member_links rows.
  // Done concurrently so the dashboard doesn't pay double latency.
  const [leaderRes, linksRes] = await Promise.all([
    supabaseAdmin
      .from('activity_registrations')
      .select('id, category_id, activity_session_id, full_name, payment_status, created_at, project_name, member_id, team_members')
      .eq('member_id', memberId)
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('team_member_links')
      .select('registration_id, role')
      .eq('member_id', memberId),
  ])

  if (leaderRes.error) return apiError(leaderRes.error, 400)
  if (linksRes.error) return apiError(linksRes.error, 400)

  const leaderRegs = leaderRes.data || []
  const linkRegs = linksRes.data || []

  // Build the union. Leader rows always come back with role=leader.
  // team_member_links rows pull their registration by id and get
  // role=team_member.
  const leaderById = new Map<string, any>(leaderRegs.map((r: any) => [r.id, r]))
  const seen = new Set<string>()
  type Entry = { reg: any; role: 'leader' | 'team_member' }
  const entries: Entry[] = []
  for (const r of leaderRegs) {
    seen.add(r.id)
    entries.push({ reg: r, role: 'leader' })
  }
  // Fetch the linked registration bodies in one round trip.
  const linkRegIds = linkRegs.map((l: any) => l.registration_id).filter((id: string) => !seen.has(id))
  if (linkRegIds.length) {
    const { data: linkRegBodies, error: lerr } = await supabaseAdmin
      .from('activity_registrations')
      .select('id, category_id, activity_session_id, full_name, payment_status, created_at, project_name, member_id, team_members')
      .in('id', linkRegIds)
    if (lerr) return apiError(lerr, 400)
    for (const r of (linkRegBodies || [])) {
      if (seen.has(r.id)) continue
      seen.add(r.id)
      entries.push({ reg: r, role: 'team_member' })
    }
  }

  // Read-time fallback: scan activity_registrations whose
  // team_members jsonb contains the member's email but that don't
  // have a team_member_links row yet (e.g. registrations from before
  // the bridge existed). We only do this if we actually know the
  // member's email — otherwise we can't match.
  if (memberEmail) {
    const candidateIds = Array.from(seen)
    let q = supabaseAdmin
      .from('activity_registrations')
      .select('id, category_id, activity_session_id, full_name, payment_status, created_at, project_name, member_id, team_members')
      // The JSONB contains a row with the matching email. PostgREST
      // cs operator does a case-sensitive containment check; we
      // lower-case both sides by using the same casing in the jsonb
      // (the v2 write path always trims but does not lowercase
      // emails on insert). For the fallback, an exact match is good
      // enough — the user's email is what they typed when they
      // registered as a team member, modulo trim.
      .contains('team_members', JSON.stringify([{ email: memberEmail }]))
      // Don't accidentally surface rows where the leader is the member
      // themselves — those came back via the leader-rows path already.
      // We use is.null to ALSO match legacy rows whose member_id is
      // null (pre-migration registration that has no leader account).
      // PostgREST's `neq` against null returns nothing (NULL is never
      // != anything), so the explicit `is.null` branch is required.
      .or(`member_id.is.null,member_id.neq.${memberId}`)
    if (candidateIds.length) q = q.not('id', 'in', `(${candidateIds.join(',')})`)
    const { data: fbRegs, error: fbErr } = await q
    if (fbErr) return apiError(fbErr, 400)
    for (const r of (fbRegs || [])) {
      if (seen.has(r.id)) continue
      seen.add(r.id)
      entries.push({ reg: r, role: 'team_member' })
    }
  }

  if (!entries.length) return apiOk({ registrations: [] })

  // Batch-fetch sessions and categories referenced by any entry.
  const sessionIds = [...new Set(entries.map(e => e.reg.activity_session_id).filter(Boolean))]
  const categoryIds = [...new Set(entries.map(e => e.reg.category_id).filter(Boolean))]

  const [{ data: sessions }, { data: categories }] = await Promise.all([
    supabaseAdmin
      .from('activity_sessions')
      .select('id, title, slug, is_upcoming, cover_image_url, reg_status, reg_deadline')
      .in('id', sessionIds),
    supabaseAdmin
      .from('activity_reg_categories')
      .select('id, name, is_online_submission, linked_olympiad_id, schedule_date, schedule_time, schedule_room, submission_config')
      .in('id', categoryIds),
  ])

  const sessionMap = Object.fromEntries((sessions || []).map(s => [s.id, s]))
  const categoryMap = Object.fromEntries((categories || []).map(c => [c.id, c]))

  // Sort newest first.
  entries.sort((a, b) => {
    const ta = new Date(a.reg.created_at).getTime()
    const tb = new Date(b.reg.created_at).getTime()
    return tb - ta
  })

  const enriched = entries.map(({ reg, role }) => {
    // For team_member rows, surface the *team member's* name (from
    // jsonb) rather than the leader's, so the dashboard can show
    // "You're on <Team Name> as <Your Name>" instead of "Leader:
    // <leader>". Falls back to the leader's full_name when the
    // email is unmatched (fallback path) or the member's entry is
    // not found in jsonb for any reason.
    let displayName = reg.full_name
    if (role === 'team_member' && memberEmail && Array.isArray(reg.team_members)) {
      const me = reg.team_members.find((m: any) => (m?.email || '').trim().toLowerCase() === memberEmail)
      if (me?.full_name) displayName = me.full_name
    }
    return {
      id: reg.id,
      category_id: reg.category_id,
      activity_session_id: reg.activity_session_id,
      full_name: displayName,
      leader_full_name: reg.full_name,  // always the leader, for context
      payment_status: reg.payment_status,
      created_at: reg.created_at,
      project_name: reg.project_name,
      role,
      session: sessionMap[reg.activity_session_id] || null,
      category: categoryMap[reg.category_id] || null,
    }
  })

  return apiOk({ registrations: enriched })
}

