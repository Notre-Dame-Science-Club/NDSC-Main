import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { apiError, apiOk } from '@/lib/api/response'
import { checkRateLimitShared, clientIp, tooManyRequests } from '@/lib/api/rateLimit'

// GET /api/activity-unique-check?session_id=<uuid>&field=<dbColumnOrKey>&value=<string>
//
// Used by the public registration form to do a live "is this value already
// taken in this event?" check as the user types. Powers two flows:
//
// 1. "Already registered" — the value belongs to the LEADER of an existing
//    registration in this event. We return that registration so the form
//    can show "You already have a registration. Open your dashboard →"
//    instead of letting them fill out a duplicate.
//
// 2. "Added by X" — the value belongs to a TEAM MEMBER of an existing
//    registration. We return the leader's name and the team registration
//    so the form can show "You were added to [event] by [leader name]
//    as a team member. Open your team dashboard →".
//
// This is a read-only lookup; it never creates or mutates anything.
//
// SECURITY: this route is anonymous, so it only ever answers `{ taken: boolean }`. It does NOT
// return the existing registration's id, name, email or phone (that would let anyone probe who
// is registered). The lookup is done DB-side on the exact submitted value (no event-wide scan),
// and the route is rate-limited per IP.
//
// `field` can be either:
//   - a built-in top-level column on activity_registrations
//     (full_name, phone, email, college, college_roll, hsc_session, division)
//   - a custom_answers key (any string — looked up in the jsonb)

const TOP_LEVEL_COLS = new Set([
  'full_name', 'phone', 'email', 'college',
  'college_roll', 'hsc_session', 'division',
])

// Escape LIKE wildcards so ilike() behaves as an exact, case-insensitive match.
const escapeLike = (v: string) => v.replace(/[\\%_]/g, '\\$&')

export async function GET(req: NextRequest) {
  const rl = await checkRateLimitShared(`activity-unique-check:ip:${clientIp(req)}`, 60, 10 * 60 * 1000)
  if (!rl.ok) return tooManyRequests(rl.retryAfterSec)

  const sessionId = req.nextUrl.searchParams.get('session_id')
  const field = req.nextUrl.searchParams.get('field') || ''
  const value = (req.nextUrl.searchParams.get('value') || '').trim()
  // Which node the person is currently filling in. The public runner sends this as the last
  // entry of the path it's walking (the active node) — the same id that ends up as the last
  // entry of submitted_node_ids once that node is actually submitted. We match against OTHER
  // registrations' own last-submitted node so the check scopes to "this exact terminal".
  const segmentNodeId = req.nextUrl.searchParams.get('segment_node_id') || null

  if (!sessionId) return apiError('session_id is required', 400)
  if (!field || field.length > 100) return apiError('field is required', 400)
  if (!value) return apiOk({ taken: false })
  if (value.length > 200) return apiOk({ taken: false })

  const isTopLevel = TOP_LEVEL_COLS.has(field)

  // Completed registrations of this event only; capped, and filtered in the DB on the exact value.
  const base = () =>
    supabaseAdmin
      .from('activity_registrations')
      .select('id, submitted_node_ids')
      .eq('activity_session_id', sessionId)
      .not('completed_at', 'is', null)   // B2
      .limit(50)

  // jsonb containment is case-sensitive, so try the common casings of the value.
  const variants = Array.from(new Set([value, value.toLowerCase(), value.toUpperCase()]))

  const queries: PromiseLike<{ data: any[] | null; error: any }>[] = []
  if (isTopLevel) {
    // Leader: top-level column, case-insensitive exact match.
    queries.push(base().ilike(field, escapeLike(value)))
    // Team members: jsonb array of { full_name, email, college_roll, phone, ... }.
    for (const v of variants) queries.push(base().contains('team_members', [{ [field]: v }]))
  } else {
    for (const v of variants) {
      queries.push(base().contains('custom_answers', { [field]: v }))
      queries.push(base().contains('team_members', [{ custom_answers: { [field]: v } }]))
    }
  }

  const results = await Promise.all(queries)
  const failed = results.find(r => r.error)
  if (failed) return apiError(failed.error, 400)

  // Scope to the same terminal when we know one. When segmentNodeId is null (non-segmented
  // event, or caller didn't send it) any match counts.
  const taken = results.some(r =>
    (r.data || []).some((row: any) =>
      !segmentNodeId ||
      (Array.isArray(row.submitted_node_ids) &&
        row.submitted_node_ids.length > 0 &&
        row.submitted_node_ids[row.submitted_node_ids.length - 1] === segmentNodeId)
    )
  )

  return apiOk({ taken })
}
