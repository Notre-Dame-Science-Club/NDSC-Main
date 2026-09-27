/**
 * lib/email/audience.ts — audience resolution for mass-emailing campaigns.
 *
 * Filters members and/or users based on EmailAudienceFilters, returning
 * a de-duplicated list of recipients.
 */

import { supabaseAdmin } from '@/lib/supabase'

export type EmailAudienceFilters = {
  batches?: string[]
  departments?: string[] // only applies to members
  verified_only?: boolean // members.is_verified
  organizers_only?: boolean // members.is_organizer
  executives_only?: boolean // members.is_executive
  college?: 'any' | 'notre_dame_only' | 'excluding_notre_dame' // only applies to users
  active_only?: boolean // users.is_active
  custom_ids?: string[] // explicit member/user ids, OR'd with everything else
  custom_emails?: string[] // explicit raw email addresses (no member/user record needed), OR'd with everything else
  activity_session_ids?: string[] // registrants of these activity events (any category), OR'd with everything else
  category_ids?: string[] // registrants under these specific v1 categories/segments (e.g. a single "submission" bucket), OR'd with everything else
  form_node_ids?: string[] // registrants whose submitted path (v2 form-graph) passes through one of these nodes, OR'd with everything else
  submitted_only?: boolean // when set alongside activity_session_ids/category_ids/form_node_ids, keep only registrants who actually have an activity_submissions row
  olympiad_ids?: string[] // registrants of these olympiads — covers both standalone olympiads and "child" olympiads linked to a parent activity, OR'd with everything else
}

export type ResolvedRecipient = {
  email: string
  name: string
  source: 'member' | 'user' | 'activity_registration' | 'olympiad_registration' | 'custom_email'
  source_id: string | null
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Resolves audience based on source and filters.
 * Returns a de-duplicated list of recipients (see precedence rules below).
 */
export async function resolveAudience(
  source: 'members' | 'users' | 'both',
  filters: EmailAudienceFilters
): Promise<ResolvedRecipient[]> {
  const recipients: ResolvedRecipient[] = []

  // Fetch members if needed
  if (source === 'members' || source === 'both') {
    let query = supabaseAdmin.from('members').select('id, email, full_name, batch, department, is_verified, is_organizer, is_executive')

    // Apply filters
    if (filters.verified_only) {
      query = query.eq('is_verified', true)
    }
    if (filters.organizers_only) {
      query = query.eq('is_organizer', true)
    }
    if (filters.executives_only) {
      query = query.eq('is_executive', true)
    }
    if (filters.departments && filters.departments.length > 0) {
      query = query.in('department', filters.departments)
    }
    if (filters.batches && filters.batches.length > 0) {
      query = query.in('batch', filters.batches)
    }

    const { data: members, error } = await query
    if (!error && members) {
      members.forEach(m => {
        if (m.email && EMAIL_REGEX.test(m.email)) {
          recipients.push({
            email: m.email.toLowerCase(),
            name: m.full_name || m.email,
            source: 'member',
            source_id: m.id,
          })
        }
      })
    }
  }

  // Fetch users if needed
  if (source === 'users' || source === 'both') {
    let query = supabaseAdmin.from('users').select('id, email, full_name, batch, college, is_active')

    // Apply filters
    if (filters.active_only) {
      query = query.eq('is_active', true)
    }
    if (filters.batches && filters.batches.length > 0) {
      query = query.in('batch', filters.batches)
    }
    if (filters.college === 'notre_dame_only') {
      query = query.ilike('college', '%notre dame%')
    } else if (filters.college === 'excluding_notre_dame') {
      query = query.not('college', 'ilike', '%notre dame%')
    }

    const { data: users, error } = await query
    if (!error && users) {
      users.forEach(u => {
        if (u.email && EMAIL_REGEX.test(u.email)) {
          recipients.push({
            email: u.email.toLowerCase(),
            name: u.full_name || u.email,
            source: 'user',
            source_id: u.id,
          })
        }
      })
    }
  }

  // Add custom IDs (OR'd, not AND'd — they get included regardless of other filters)
  if (filters.custom_ids && filters.custom_ids.length > 0) {
    // Try members first
    const { data: customMembers } = await supabaseAdmin
      .from('members')
      .select('id, email, full_name')
      .in('id', filters.custom_ids)
    if (customMembers) {
      customMembers.forEach(m => {
        if (m.email && EMAIL_REGEX.test(m.email)) {
          recipients.push({
            email: m.email.toLowerCase(),
            name: m.full_name || m.email,
            source: 'member',
            source_id: m.id,
          })
        }
      })
    }

    // Try users
    const { data: customUsers } = await supabaseAdmin
      .from('users')
      .select('id, email, full_name')
      .in('id', filters.custom_ids)
    if (customUsers) {
      customUsers.forEach(u => {
        if (u.email && EMAIL_REGEX.test(u.email)) {
          recipients.push({
            email: u.email.toLowerCase(),
            name: u.full_name || u.email,
            source: 'user',
            source_id: u.id,
          })
        }
      })
    }
  }

  // Activity event / category / submission participants (OR'd in, regardless of source).
  // A registrant is pulled in if they match ANY of the three id lists provided —
  // e.g. picking one activity_session_id pulls every registrant of that event,
  // while also picking a category_id narrows nothing (it's additive, not a filter
  // on top), matching how custom_ids already behaves.
  const hasSessionFilter = !!filters.activity_session_ids?.length
  const hasCategoryFilter = !!filters.category_ids?.length
  const hasNodeFilter = !!filters.form_node_ids?.length
  if (hasSessionFilter || hasCategoryFilter || hasNodeFilter) {
    const orClauses: string[] = []
    if (hasSessionFilter) orClauses.push(`activity_session_id.in.(${filters.activity_session_ids!.join(',')})`)
    if (hasCategoryFilter) orClauses.push(`category_id.in.(${filters.category_ids!.join(',')})`)

    // form_node_ids can't be expressed as a plain column filter (it lives
    // inside a jsonb array), so when it's needed we fetch broadly (scoped by
    // the session/category OR clause when one exists, otherwise every
    // registration) and filter the node match client-side below.
    let regQuery = supabaseAdmin
      .from('activity_registrations')
      .select('id, email, full_name, category_id, activity_session_id, submitted_node_ids')
    if (orClauses.length > 0) {
      regQuery = regQuery.or(orClauses.join(','))
    }

    const { data: regs, error: regErr } = await regQuery

    if (!regErr && regs) {
      let filteredRegs = regs.filter(r => {
        if (!hasNodeFilter) return true
        const path = Array.isArray(r.submitted_node_ids) ? (r.submitted_node_ids as string[]) : []
        const inNodeSet = path.some(id => filters.form_node_ids!.includes(id))
        // If session/category filters were also given, a row already matched
        // one of those via the DB query — keep it regardless of node match.
        // Otherwise (node filter only), require the node match.
        if (orClauses.length > 0) return true
        return inNodeSet
      })

      if (filters.submitted_only) {
        const regIds = filteredRegs.map(r => r.id)
        if (regIds.length > 0) {
          const { data: submissions } = await supabaseAdmin
            .from('activity_submissions')
            .select('registration_id')
            .in('registration_id', regIds)
          const submittedIds = new Set((submissions || []).map(s => s.registration_id))
          filteredRegs = filteredRegs.filter(r => submittedIds.has(r.id))
        } else {
          filteredRegs = []
        }
      }

      filteredRegs.forEach(r => {
        if (r.email && EMAIL_REGEX.test(r.email)) {
          recipients.push({
            email: r.email.toLowerCase(),
            name: r.full_name || r.email,
            source: 'activity_registration',
            source_id: r.id,
          })
        }
      })
    }
  }

  // Olympiad participants (covers standalone olympiads AND "child" olympiads
  // linked to a parent activity — both live in the same table keyed by
  // olympiad_id, so no special-casing is needed here).
  if (filters.olympiad_ids && filters.olympiad_ids.length > 0) {
    const { data: oRegs, error: oErr } = await supabaseAdmin
      .from('olympiad_registrations')
      .select('id, email, full_name, olympiad_id')
      .in('olympiad_id', filters.olympiad_ids)
    if (!oErr && oRegs) {
      oRegs.forEach(r => {
        if (r.email && EMAIL_REGEX.test(r.email)) {
          recipients.push({
            email: r.email.toLowerCase(),
            name: r.full_name || r.email,
            source: 'olympiad_registration',
            source_id: r.id,
          })
        }
      })
    }
  }

  // Explicit individual emails — for picking one or a few specific recipients
  // that aren't necessarily tied to any member/user/registration record.
  if (filters.custom_emails && filters.custom_emails.length > 0) {
    filters.custom_emails.forEach(raw => {
      const email = raw.trim().toLowerCase()
      if (email && EMAIL_REGEX.test(email)) {
        recipients.push({
          email,
          name: email,
          source: 'custom_email',
          source_id: null,
        })
      }
    })
  }

  // De-duplicate by email. Precedence on collision: member > user >
  // activity_registration / olympiad_registration > custom_email — a record
  // tied to an actual member/user account is preferred over a bare
  // registration or typed-in email for the same address.
  const rank: Record<ResolvedRecipient['source'], number> = {
    member: 4,
    user: 3,
    activity_registration: 2,
    olympiad_registration: 2,
    custom_email: 1,
  }
  const seen = new Map<string, ResolvedRecipient>()
  recipients.forEach(r => {
    const existing = seen.get(r.email)
    if (!existing || rank[r.source] > rank[existing.source]) {
      seen.set(r.email, r)
    }
  })

  return Array.from(seen.values())
}
