import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { apiError, apiOk } from '@/lib/api/response'

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
// `field` can be either:
//   - a built-in top-level column on activity_registrations
//     (full_name, phone, email, college, college_roll, hsc_session, division)
//   - a custom_answers key (any string — looked up in the jsonb)

const TOP_LEVEL_COLS = new Set([
  'full_name', 'phone', 'email', 'college',
  'college_roll', 'hsc_session', 'division',
])

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('session_id')
  const field = req.nextUrl.searchParams.get('field') || ''
  const value = (req.nextUrl.searchParams.get('value') || '').trim()

  if (!sessionId) return apiError('session_id is required', 400)
  if (!field) return apiError('field is required', 400)
  if (!value) return apiOk({ match: null })

  const isTopLevel = TOP_LEVEL_COLS.has(field)

  // Fetch every registration in this event. We pull enough fields to tell
  // the leader / team-member story. The dataset is bounded by the number
  // of registrations in one event, which is small for a club site — a
  // full scan is fine here.
  const { data: regs, error } = await supabaseAdmin
    .from('activity_registrations')
    .select('id, full_name, phone, email, college, college_roll, hsc_session, division, custom_answers, team_members, category_id, activity_session_id, member_id')
    .eq('activity_session_id', sessionId)

  if (error) return apiError(error, 400)

  const norm = (v: any) => (v === null || v === undefined ? '' : String(v).trim().toLowerCase())
  const target = norm(value)

  // First check the leader of every registration (top-level columns and
  // custom_answers).
  for (const r of regs || []) {
    let leaderMatch = false
    if (isTopLevel) {
      leaderMatch = norm((r as any)[field]) === target
    } else {
      leaderMatch = norm((r as any).custom_answers?.[field]) === target
    }
    if (leaderMatch) {
      return apiOk({
        match: {
          type: 'leader',
          registration_id: r.id,
          existing_name: r.full_name,
          existing_email: r.email,
        },
      })
    }
  }

  // Then check every team member across all registrations. Team members are
  // stored in r.team_members (jsonb array of { id, full_name, email,
  // college_roll, custom_answers, ... }).
  for (const r of regs || []) {
    const members = (r as any).team_members || []
    for (const m of members) {
      let memberMatch = false
      if (isTopLevel) {
        if (field === 'full_name') memberMatch = norm(m.full_name) === target
        else if (field === 'email') memberMatch = norm(m.email) === target
        else if (field === 'college_roll') memberMatch = norm(m.college_roll) === target
        else if (field === 'phone') memberMatch = norm(m.phone) === target
        else memberMatch = norm(m[field]) === target
      } else {
        memberMatch = norm(m.custom_answers?.[field]) === target
      }
      if (memberMatch) {
        return apiOk({
          match: {
            type: 'team_member',
            registration_id: r.id,
            member_id: m.id,
            existing_name: m.full_name,
            added_by_name: r.full_name,
            leader_email: r.email,
            leader_phone: r.phone,
          },
        })
      }
    }
  }

  return apiOk({ match: null })
}
