// lib/auth.ts
//
// This app has THREE separate, deliberately-unmerged auth systems, each
// matching how that user type actually needs to authenticate:
//
//   1. Admin     — an `admin_session` httpOnly cookie (see app/api/admin/login).
//   2. Organizer — an `organizer_session` httpOnly cookie (see lib/organizerAuth.ts,
//                  kept as its own file/table since it predates this one; re-exported
//                  here so callers only need one import).
//   3. Member    — a Supabase Auth session. On the server this arrives as a
//                  `Authorization: Bearer <token>` header (NOT a cookie —
//                  see lib/supabase.ts's comment on why sessions only
//                  persist in the browser), because the member dashboard's
//                  fetches attach the token from the client-side Supabase
//                  session manually.
//
// Server Components needing the admin cookie directly (e.g. app/admin/layout.tsx
// redirect logic) can keep reading `cookies()` themselves — these helpers are
// aimed at Route Handlers, where the pattern below was previously
// copy-pasted into ~20 files as a local `isAdmin()` function.
//
// This file is server-only (imports `next/headers`). Don't import it from
// a Client Component.

import { cookies } from 'next/headers'
import type { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import type { AdminSession, MemberIdentity } from '@/types/auth'

export type { OrganizerSession } from '@/types/auth'
export { getOrganizerSession } from '@/lib/organizerAuth'

const ADMIN_COOKIE = 'admin_session'

/**
 * Parses the `admin_session` cookie, if present and well-formed.
 * Returns null if there's no session or it's malformed — never throws.
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies()
  const raw = cookieStore.get(ADMIN_COOKIE)?.value
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (typeof parsed?.email !== 'string') return null
    return parsed as AdminSession
  } catch {
    return null
  }
}

/**
 * The check ~20 admin API routes already do inline as a local `isAdmin()`.
 * Deliberately just checks the cookie *exists* (matching existing routes'
 * behavior) rather than fully validating its contents — use
 * `getAdminSession()` if you need the email/role and want malformed
 * cookies treated as "not an admin".
 */
export async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies()
  return !!cookieStore.get(ADMIN_COOKIE)
}

/**
 * Resolves the logged-in member from a request's `Authorization: Bearer`
 * header (the pattern duplicated across /api/member-profile,
 * /api/member-achievements, /api/member-shoutbox). Returns null if the
 * header is missing or the token doesn't correspond to a valid Supabase
 * session — never throws.
 *
 * This only confirms *who* the member is (via Supabase Auth); it does not
 * fetch their `members` row. Query the `members` table by `.id` for profile
 * data.
 */
export async function getMemberFromRequest(req: NextRequest): Promise<MemberIdentity | null> {
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  if (!token) return null
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data.user) return null
  return { id: data.user.id, email: data.user.email }
}

// ── Naming-compatibility aliases ───────────────────────────────────────────
//
// The original task plan for this file specified `requireAdmin()`,
// `requireOrganizer()`, and `getMemberSession()` as the exported names.
// The implementations above chose `isAdmin()` (kept verbatim from the code
// it replaces), `getOrganizerSession()` (re-exported from
// lib/organizerAuth.ts, unchanged), and `getMemberFromRequest()` (named for
// what it actually takes — a Request, not a stored session) instead, since
// those names better match what each function does. Both names work;
// pick whichever reads better at the call site. These aliases are pure
// re-exports — no behavior differs between a function and its alias.

/** Alias for `isAdmin()`. */
export const requireAdmin = isAdmin

/** Alias for `getOrganizerSession()` (re-exported above from lib/organizerAuth.ts). */
export { getOrganizerSession as requireOrganizer } from '@/lib/organizerAuth'

/** Alias for `getMemberFromRequest()`. */
export const getMemberSession = getMemberFromRequest
