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
}

export type ResolvedRecipient = {
  email: string
  name: string
  source: 'member' | 'user'
  source_id: string
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Resolves audience based on source and filters.
 * Returns a de-duplicated list of recipients (members win over users on email collision).
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

  // De-duplicate by email (members win on collision)
  const seen = new Map<string, ResolvedRecipient>()
  recipients.forEach(r => {
    const existing = seen.get(r.email)
    if (!existing || (existing.source === 'user' && r.source === 'member')) {
      seen.set(r.email, r)
    }
  })

  return Array.from(seen.values())
}
