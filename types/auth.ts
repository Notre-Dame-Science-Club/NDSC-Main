// types/auth.ts
//
// Shared shapes for the three separate auth systems in this app. They are
// intentionally NOT unified into one "User" type because they really are
// different mechanisms with different guarantees — see ARCHITECTURE.md and
// lib/auth.ts for the reasoning.

import type { AdminRole } from './database'

/** Decoded contents of the `admin_session` cookie (set in app/api/admin/login). */
export interface AdminSession {
  email: string
  role: AdminRole
}

/** Decoded contents of the `organizer_session` cookie (see lib/organizerAuth.ts). */
export interface OrganizerSession {
  olympiadIds: string[]
}

/**
 * A member identity resolved from a Supabase Bearer token (see
 * lib/auth.ts#getMemberFromRequest). This is intentionally just the subset
 * of `supabase.auth.getUser()`'s result that route handlers actually use —
 * for the full member profile row, query the `members` table with `.id`.
 */
export interface MemberIdentity {
  id: string
  email: string | undefined
}
