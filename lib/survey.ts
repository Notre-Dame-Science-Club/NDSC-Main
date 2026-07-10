/**
 * lib/survey.ts — shared types + pure helpers for the survey/notification
 * system. Imported by admin routes, public routes, and both the client-side
 * notification overlay and the survey-taking form, so the audience-matching
 * logic (the one thing that must never disagree between "should we show
 * this?" and "should we accept this response?") lives in exactly one place.
 *
 * Why "organizers" / "executives" are member flags, not separate logins:
 * this codebase has no site-wide login for either group — `executives` is a
 * display-only table (bio cards, zero auth), and `organizer_session` is a
 * short-lived cookie scoped to one specific olympiad's grading panel, not
 * something active while someone is just browsing the site. A notification
 * that "only logged organizers see" needs an identity that persists across
 * an ordinary site visit — the only one that exists is a member's Supabase
 * Auth session. So `members.is_organizer` / `members.is_executive` (new
 * columns, schema_update_03.sql) are simple admin-settable flags on a
 * member's own row, and "alumni" reuses the existing `members.batch` field.
 */

export type SurveyQuestionType =
  | 'short_text'
  | 'paragraph'
  | 'multiple_choice'
  | 'checkboxes'
  | 'dropdown'
  | 'linear_scale'
  | 'date'
  | 'time'

export type SurveyQuestionOption = { id: string; text: string }

export type SurveyQuestion = {
  id: string
  type: SurveyQuestionType
  title: string
  description?: string
  required?: boolean
  // multiple_choice | checkboxes | dropdown
  options?: SurveyQuestionOption[]
  allow_other?: boolean
  // linear_scale
  scale_min?: number
  scale_max?: number
  scale_min_label?: string
  scale_max_label?: string
}

export type SurveyAudienceType = 'all' | 'members' | 'organizers' | 'executives' | 'alumni' | 'custom'

export type SurveyAudienceConfig = {
  /** 'alumni': batches to include. Empty/absent = every batch on file. */
  batches?: string[]
  /** 'custom': explicit member ids to include regardless of role/batch. */
  member_ids?: string[]
  /** 'custom': role-based inclusion, combined (OR'd) with member_ids/batches. */
  roles?: Array<'organizer' | 'executive' | 'member'>
}

export type SurveyRow = {
  id: string
  title: string
  description?: string | null
  cover_image_url?: string | null
  questions: SurveyQuestion[]
  is_active: boolean
  starts_at?: string | null
  ends_at?: string | null
  allow_multiple_responses: boolean
  show_notification: boolean
  notification_title?: string | null
  notification_message?: string | null
  send_email: boolean
  email_sent_at?: string | null
  audience_type: SurveyAudienceType
  audience_config: SurveyAudienceConfig
  created_at: string
  updated_at?: string
}

export type SurveyResponseRow = {
  id: string
  survey_id: string
  member_id?: string | null
  respondent_name?: string | null
  respondent_email?: string | null
  answers: Record<string, unknown>
  created_at: string
}

/** The subset of a member's row that audience matching needs. `null` = anonymous visitor. */
export type AudienceMember = {
  id: string
  batch?: string | null
  is_organizer?: boolean | null
  is_executive?: boolean | null
} | null

export const SURVEY_QUESTION_TYPES: { value: SurveyQuestionType; label: string }[] = [
  { value: 'short_text', label: 'Short Answer' },
  { value: 'paragraph', label: 'Paragraph' },
  { value: 'multiple_choice', label: 'Multiple Choice' },
  { value: 'checkboxes', label: 'Checkboxes' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'linear_scale', label: 'Linear Scale' },
  { value: 'date', label: 'Date' },
  { value: 'time', label: 'Time' },
]

export const AUDIENCE_LABELS: Record<SurveyAudienceType, string> = {
  all: 'Everyone',
  members: 'Members',
  organizers: 'Organizers',
  executives: 'Executives',
  alumni: 'Alumni',
  custom: 'Custom',
}

/** True if `now` falls inside the survey's [starts_at, ends_at] response window (either end optional). */
export function isWithinWindow(survey: Pick<SurveyRow, 'starts_at' | 'ends_at'>, now: Date = new Date()): boolean {
  if (survey.starts_at && now < new Date(survey.starts_at)) return false
  if (survey.ends_at && now > new Date(survey.ends_at)) return false
  return true
}

/**
 * Does this visitor belong to the survey's target audience? Used both to
 * decide whether to surface the notification/let them open the survey, and
 * — server-side, again, never trusting the client's word for it — to decide
 * whether to accept a submitted response.
 */
export function matchesAudience(
  audienceType: SurveyAudienceType,
  audienceConfig: SurveyAudienceConfig | null | undefined,
  member: AudienceMember
): boolean {
  const cfg = audienceConfig || {}

  switch (audienceType) {
    case 'all':
      return true
    case 'members':
      return !!member
    case 'organizers':
      return !!member?.is_organizer
    case 'executives':
      return !!member?.is_executive
    case 'alumni': {
      if (!member || !member.batch) return false
      const batches = cfg.batches || []
      if (batches.length === 0) return true // no batch filter = every batch on file
      return batches.includes(member.batch)
    }
    case 'custom': {
      if (!member) return false
      if ((cfg.member_ids || []).includes(member.id)) return true
      if (member.batch && (cfg.batches || []).includes(member.batch)) return true
      const roles = cfg.roles || []
      if (roles.includes('organizer') && member.is_organizer) return true
      if (roles.includes('executive') && member.is_executive) return true
      if (roles.includes('member')) return true
      return false
    }
    default:
      return false
  }
}

/** Fully eligible = active, inside its response window, and audience-matched. */
export function isEligible(survey: SurveyRow, member: AudienceMember, now: Date = new Date()): boolean {
  if (!survey.is_active) return false
  if (!isWithinWindow(survey, now)) return false
  return matchesAudience(survey.audience_type, survey.audience_config, member)
}

const uid = () => Math.random().toString(36).slice(2, 9)

export function blankQuestion(type: SurveyQuestionType): SurveyQuestion {
  const base: SurveyQuestion = { id: uid(), type, title: '', required: false }
  if (type === 'multiple_choice' || type === 'checkboxes' || type === 'dropdown') {
    base.options = [{ id: uid(), text: '' }, { id: uid(), text: '' }]
  }
  if (type === 'linear_scale') {
    base.scale_min = 1
    base.scale_max = 5
  }
  return base
}

/** Basic required-field validation for a set of answers against a question list. Returns the first error, or null. */
export function validateAnswers(questions: SurveyQuestion[], answers: Record<string, unknown>): string | null {
  for (const q of questions) {
    if (!q.required) continue
    const a = answers[q.id]
    const empty =
      a === undefined || a === null || a === '' || (Array.isArray(a) && a.length === 0)
    if (empty) return `"${q.title || 'Untitled question'}" is required.`
  }
  return null
}
