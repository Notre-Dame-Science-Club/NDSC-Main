// Shared team-member validation + preparation.
//
// Both v1 (app/api/activity-register/route.ts) and v2
// (app/api/public/form-graph/submit/route.ts) build their team-members
// from the same per-member shape: { full_name, phone?, email,
// college_roll, password (raw), custom_answers? }. The "how many
// members", "which extra fields per member", "is the team even
// optional/required" rules differ in their storage shape between v1
// (flat columns on activity_reg_categories) and v2 (nested
// behavior.require_team jsonb on form_nodes), but the validation +
// hashing logic is identical.
//
// This module is the ONE place that team-membership validation +
// preparation lives. v1 calls it after flattening its category fields
// into the same `TeamConfig` shape v2 hands in directly. Whatever the
// caller passes, the prepared output is the same `{ id, full_name,
// phone, email, college_roll, password_hash, custom_answers, is_leader }`
// rows written to `activity_registrations.team_members` (jsonb) — and
// the same `activity-team-login/route.ts` reads back without caring
// which system wrote them.

import { hashPassword } from './password.ts'
import { validateCollegeRoll } from './validation.ts'

/**
 * Shape the helper accepts as input. Both v1 and v2 flatten their
 * category/node behavior into this before calling.
 */
export type TeamMemberInput = {
  full_name?: string | null
  phone?: string | null
  email?: string | null
  college_roll?: string | null
  password?: string | null
  custom_answers?: Record<string, any>
}

/**
 * Per-member "extra" field definitions — mirrored from v1's
 * `category.team_member_fields` and v2's
 * `behavior.require_team.fields`. Each entry mirrors what the admin
 * configured (label, key, type, required). We only enforce `required`
 * server-side; the public FormRunner renders the inputs (Phase 2).
 */
export type TeamMemberFieldDef = {
  key?: string
  label?: string
  type?: string
  required?: boolean
}

/**
 * Configuration of the team policy for a given activity / category /
 * node. v1 and v2 build it differently; the helper itself doesn't care.
 */
export type TeamConfig = {
  /** Whether this activity/category/node requires team members at all. If
   *  false, the helper short-circuits to an empty prepared array. */
  require_team: boolean
  /** "Team is optional" means even a leader-only registration is
   *  valid (members array may be empty); when false the size bound
   *  below becomes a hard minimum. Mirrors activity_reg_categories.team_optional
   *  and behavior.require_team.optional. */
  team_optional?: boolean
  /** Lower bound on member count (not counting leader). v1:
   *  category.team_size_min; v2: behavior.require_team.min. Defaults to 1
   *  when team is required. */
  team_size_min?: number | null
  /** Upper bound on member count. v1: category.team_size_max; v2:
   *  behavior.require_team.max. Defaults to 99. */
  team_size_max?: number | null
  /** Whether the helper should enforce per-member password presence
   *  and length. Defaults to true (matches v1's contract — v1 always
   *  required passwords). Set to false on the v2 path only for nodes
   *  whose admin explicitly disabled passwords. */
  password_required?: boolean
  /** Minimum password length enforced when password_required is true.
   *  Defaults to 6 (the v1 contract). */
  password_min_length?: number
  /** Per-member "extra" field definitions, used only to enforce the
   *  required-flag. */
  team_member_fields?: TeamMemberFieldDef[]
  /** Leader's college, used to drive validateCollegeRoll per member
   *  (Notre Dame = 8-digit rule, others = digits-only). */
  leader_college?: string | null
}

/**
 * Prepared team-member row (the shape that actually gets written to
 * activity_registrations.team_members jsonb). hashedPassword replaces
 * the raw input.
 */
export type PreparedTeamMember = {
  id: string
  full_name: string
  phone: string
  email: string
  college_roll: string
  password_hash: string
  custom_answers: Record<string, any>
  is_leader: boolean
}

export type ValidateTeamResult =
  | { ok: true; prepared: PreparedTeamMember[] }
  | { ok: false; error: string }

/**
 * User-defined type guard. Some tsconfigs (incl. ours — see
 * app/api/activity-register/route.ts comment) run with `strict: false`,
 * which means a plain `if (result.ok)` doesn't narrow the union to the
 * success variant. Callers that need a guaranteed narrow can use this
 * guard instead. Internally we always branch on the same predicate.
 */
export function isTeamResultOk(r: ValidateTeamResult): r is Extract<ValidateTeamResult, { ok: true }> {
  return r.ok === true
}

function genId() {
  return Math.random().toString(36).slice(2, 9)
}

/**
 * Single source of truth for team-member validation + preparation.
 *
 * Returns:
 *   - { ok: true, prepared: [...] } on success (prepared may be empty
 *     when team is optional and the leader submits solo)
 *   - { ok: false, error } with a user-facing error message on failure
 *
 * Hashing happens here too (was inline in v1, was missing in v2).
 * Callers just spread `prepared` into their insert body.
 *
 * NEVER trust the client's claims about what's required (same caveat
 * the v1 route used to have in its comment): every check below is
 * rederived from the `config` parameter, which itself comes from the
 * server-side category/node row.
 */
export function validateAndPrepareTeam(
  input: TeamMemberInput[] | null | undefined,
  config: TeamConfig
): ValidateTeamResult {
  if (!config.require_team) {
    return { ok: true, prepared: [] }
  }

  const members: TeamMemberInput[] = Array.isArray(input) ? input : []

  const min = config.team_optional ? 0 : (config.team_size_min ?? 1)
  const max = config.team_size_max ?? 99

  if (members.length < min || members.length > max) {
    const lowerBound = config.team_optional
      ? (config.team_size_min ?? 0)
      : min
    const upperBound = max
    return {
      ok: false,
      error: `This category accepts between ${lowerBound} and ${upperBound} team member${upperBound === 1 ? '' : 's'} (not counting yourself as leader).`,
    }
  }

  const passwordMinLength = config.password_min_length ?? 6
  const passwordRequired = config.password_required !== false  // default true

  for (const m of members) {
    const fullName = (m.full_name || '').trim()
    const email = (m.email || '').trim()
    const collegeRoll = (m.college_roll || '').trim()
    const password = m.password || ''

    if (!fullName || !email || !collegeRoll || (passwordRequired && !password)) {
      return {
        ok: false,
        error: 'Every team member needs a name, email, college roll' +
          (passwordRequired ? ', and password' : '') + '.',
      }
    }
    if (passwordRequired && password.length < passwordMinLength) {
      return {
        ok: false,
        error: `Team member passwords must be at least ${passwordMinLength} characters.`,
      }
    }

    const memberRollError = validateCollegeRoll(config.leader_college, collegeRoll)
    if (memberRollError) {
      return { ok: false, error: `Team member "${fullName}": ${memberRollError}` }
    }

    for (const field of config.team_member_fields || []) {
      if (!field?.required || !field.key) continue
      const value = m.custom_answers?.[field.key]
      // Task 2: empty-value check needs to be type-aware. Empty string
      // is empty for text/textarea/number/date/dropdown/multiple_choice;
      // an empty array is empty for checkboxes. Without this, a
      // required `checkboxes` field with no options picked would
      // silently pass. A number `0` is a legitimate answer and must
      // pass — special-cased below.
      const t = (field.type || 'text').toLowerCase()
      let isEmpty: boolean
      if (t === 'checkboxes' || t === 'checkbox') {
        isEmpty = !Array.isArray(value) || value.length === 0
      } else if (t === 'number') {
        isEmpty = value === undefined || value === null || value === ''
      } else {
        isEmpty = value === undefined || value === null || value === ''
      }
      if (isEmpty) {
        return {
          ok: false,
          error: `Team member "${fullName}" is missing required field "${field.label || field.key}".`,
        }
      }
    }
  }

  const prepared: PreparedTeamMember[] = members.map((m) => ({
    id: genId(),
    full_name: (m.full_name || '').trim(),
    phone: (m.phone || '').trim(),
    email: (m.email || '').trim(),
    college_roll: (m.college_roll || '').trim(),
    password_hash: m.password && passwordRequired ? hashPassword(m.password) : '',
    custom_answers: m.custom_answers || {},
    is_leader: false,
  }))

  return { ok: true, prepared }
}
