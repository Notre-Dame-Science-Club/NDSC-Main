// types/database.ts
//
// Row types for every table in DATABASE_STRUCTURE.md. These describe the
// shape of data as it comes back from Supabase (`select('*')`), not form
// state — form/edit types belong next to the component that owns them.
//
// Keep this file in sync with DATABASE_STRUCTURE.md and the MIGRATION_*.sql
// files when the schema changes. Fields documented there as "legacy" or
// "unused" are still typed here (as optional/nullable) so reads don't break,
// but new code shouldn't write to them.

export type UUID = string
export type ISODateString = string // timestamptz / date, always as returned by Supabase (string)

// ── admins ──────────────────────────────────────────────────────────────
export type AdminRole = 'super_admin' | 'admin' | (string & {})

export interface AdminRow {
  id: UUID
  email: string
  role: AdminRole
}

// ── members ─────────────────────────────────────────────────────────────
export type MemberDepartment =
  | 'Administration' | 'Project' | 'Publication' | 'ICT' | 'LWS' | 'Quiz' | 'R&D'
  | (string & {})

export interface MemberAchievement {
  id: string
  title: string
  description: string
  image_url: string
  status: 'pending' | 'approved'
  created_at: ISODateString
}

export interface MemberRow {
  id: UUID // == auth.users.id
  email: string
  full_name: string
  phone: string
  ndsc_id: string
  /** @deprecated legacy, unused */
  college_role?: number | null
  college_roll: string
  batch: string
  department: MemberDepartment
  /** @deprecated legacy fallback for department */
  wing?: string
  payment_slip_url: string
  is_verified: boolean
  achievements: MemberAchievement[]
  created_at: ISODateString
}

export interface MemberShoutboxRow {
  id: UUID
  member_id: UUID
  full_name: string
  message: string
  created_at: ISODateString
}

// ── announcements ───────────────────────────────────────────────────────
export type AnnouncementTarget = 'all' | 'members' | 'non_members'

export interface AnnouncementRow {
  id: UUID
  title: string
  body: string
  target: AnnouncementTarget
  created_at: ISODateString
}

// ── executives ──────────────────────────────────────────────────────────
export type ExecutivePanel = 'committee' | 'moderators' | 'former_moderators' | 'founder'

export interface ExecutiveRow {
  id: UUID
  full_name: string
  position: string
  panel: ExecutivePanel
  dept: string
  photo_url: string
  photo_position: string // CSS object-position, default "50% 15%"
  facebook_url?: string
  linkedin_url?: string
  email?: string
  whatsapp?: string
  instagram_url?: string
  github_url?: string
  x_url?: string
  display_order: number
  session_year: string // e.g. "2025-26"
  is_active: boolean
}

// ── publications ────────────────────────────────────────────────────────
export type PublicationCategory =
  | 'annual_magazine' | 'wall_magazine' | 'trimatrik' | 'abhishkar' | (string & {})

export interface PublicationRow {
  id: UUID
  title: string
  description: string
  category: PublicationCategory
  published_year: number
  cover_image_url: string
  pdf_url: string
  is_published: boolean
  created_at: ISODateString
}

// ── science_media ───────────────────────────────────────────────────────
export interface ScienceMediaRow {
  id: UUID
  title: string
  youtube_url: string
  display_order: number
  is_active: boolean
}

// ── homepage_settings (key-value store) ────────────────────────────────
// Also holds Appearance settings (Admin > Appearance): default_theme,
// font_family, header_size — same generic key/value shape, no separate table.
export interface HomepageSettingRow {
  key: string
  value: string
  updated_at: ISODateString
}

// ── activity_types → activity_versions → activity_sessions ─────────────
export interface ActivityTypeRow {
  id: UUID
  name: string
  slug: string
  icon: string // emoji
  description: string
  display_order: number
}

export interface ActivityVersionRow {
  id: UUID
  activity_type_id: UUID
  version_number: number
  version_label: string
  year_start: number
  year_end: number | null
  description: string
}

export interface ActivitySessionRow {
  id: UUID
  activity_version_id: UUID | null
  activity_type_id: UUID | null
  title: string
  slug: string
  session_date: ISODateString
  location: string
  description: string
  cover_image_url: string
  youtube_url: string
  pdf_url: string
  gallery_urls: string[]
  is_published: boolean
  is_upcoming?: boolean
  registration_enabled?: boolean
  registration_note?: string
  event_dates?: string[] // ["YYYY-MM-DD", ...]
}

// ── activity_reg_categories (self-referencing tree) ─────────────────────
export type CustomFieldType = 'text' | 'number' | 'textarea' | 'photo'

export interface CustomFieldDef {
  key: string
  label: string
  description?: string
  type: CustomFieldType
  required: boolean
}

export type SubmissionFieldType = 'file' | 'text' | 'textarea'

export interface SubmissionConfigField {
  id: string
  title: string
  description?: string
  field_type: SubmissionFieldType
  file_types?: string[]
  max_file_size_mb?: number
  max_files?: number
  required: boolean
}

export interface ActivityRegCategoryRow {
  id: UUID
  activity_session_id: UUID
  parent_id: UUID | null
  name: string
  description: string
  display_order: number
  custom_fields: CustomFieldDef[]
  requires_team: boolean
  team_size_min: number | null
  team_size_max: number | null
  team_member_fields: CustomFieldDef[]
  requires_payment: boolean
  payment_amount: number | null
  payment_label: string | null
  is_online_submission: boolean
  linked_olympiad_id: UUID | null
  edit_window_hours: number | null // null = unlimited, 0 = immediately locked
  schedule_date: ISODateString | null
  schedule_time: string | null
  schedule_room: string | null
  submission_config: SubmissionConfigField[]
  submission_who: 'leader' | 'any_member'
  project_name_enabled: boolean
  project_name_label: string
  registration_open: boolean
  created_at: ISODateString
}

// ── activity_registrations ──────────────────────────────────────────────
export type ActivityPaymentStatus = 'not_required' | 'pending' | 'paid' | 'failed'

export interface ActivityTeamMember {
  id: string
  full_name: string
  phone: string
  email: string
  college_roll: string
  password_hash: string
  custom_answers: Record<string, unknown>
  is_leader: boolean
}

export interface ActivityRegistrationRow {
  id: UUID
  category_id: UUID
  activity_session_id: UUID
  full_name: string
  phone: string
  email: string
  college: string
  college_roll: string
  hsc_session: string
  custom_answers: Record<string, unknown>
  team_members: ActivityTeamMember[]
  member_id: UUID | null
  payment_status: ActivityPaymentStatus
  payment_tran_id: string | null
  payment_amount: number | null
  payment_validated_at: ISODateString | null
  edit_locked_at: ISODateString | null
  project_name: string | null
  division: string | null
  created_at: ISODateString
}

// ── payment_transactions ────────────────────────────────────────────────
export type PaymentTransactionStatus = 'pending' | 'valid' | 'failed' | 'cancelled'

export interface PaymentTransactionRow {
  id: UUID
  tran_id: string
  activity_registration_id: UUID | null
  amount: number
  currency: string // default "BDT"
  status: PaymentTransactionStatus
  raw_ipn: Record<string, unknown> | null
  raw_validation: Record<string, unknown> | null
  created_at: ISODateString
  validated_at: ISODateString | null
}

// ── activity_submissions ────────────────────────────────────────────────
export interface ActivitySubmissionRow {
  id: UUID
  registration_id: UUID
  category_id: UUID
  activity_session_id: UUID
  submitted_by: string // "leader" | team_member.id
  answers: Record<string, unknown> // { field_id: value | url[] }
  is_final: boolean
  created_at: ISODateString
  updated_at: ISODateString
}

// ── relay_exam_state ─────────────────────────────────────────────────────
export interface RelayMemberSubmission {
  member_id: string
  answers: Record<string, unknown>
  submitted_at: ISODateString
  duration_seconds: number
}

export interface RelayExamStateRow {
  id: UUID
  registration_id: UUID
  olympiad_id: UUID
  current_member_index: number
  member_submissions: RelayMemberSubmission[]
  chain_values: Record<string, unknown>
  started_at: ISODateString | null
  completed_at: ISODateString | null
  created_at: ISODateString
}

// ── team_subject_assignments ────────────────────────────────────────────
export interface TeamSubjectAssignmentRow {
  registration_id: UUID
  member_id: string // "leader" | team_member.id
  olympiad_id: UUID
  subject_id: string
  assigned_at: ISODateString
}

// ── olympiads ────────────────────────────────────────────────────────────
export type OlympiadExamType = 'photo_only' | 'live_only' | 'mixed'
export type OlympiadQuestionDisplay = 'one_by_one' | 'all_at_once'
export type OlympiadRelayType = 'sequential' | 'chain'
export type OlympiadSubjectAssignmentMode = 'self_select' | 'admin_assign' | 'auto'
export type QuestionType = 'mcq' | 'short' | 'photo'

export interface RegistrationFieldDef {
  key: string
  label: string
  type: 'text' | 'textarea' | 'email' | 'tel' | 'select'
  required: boolean
  options?: string[]
}

export interface OlympiadQuestion {
  id: string
  type: QuestionType
  text: string
  description?: string
  options?: string[]
  correct_option_id?: string
  marks: number
  subject_id?: string
}

export interface OlympiadSubject {
  id: string
  name: string
  description?: string
  question_ids: string[]
}

export interface OlympiadRow {
  id: UUID
  name: string
  description: string
  cover_image_url: string
  pdf_url: string
  /** @deprecated legacy */
  mode?: string
  exam_type: OlympiadExamType
  exam_mode: string
  question_display: OlympiadQuestionDisplay
  timer_minutes: number
  is_active: boolean
  external_only: boolean
  result_published: boolean
  annotations_published: boolean
  registration_deadline: ISODateString | null
  exam_date: ISODateString | null
  eligibility: string
  /** plaintext — see organizer login; not a real security boundary */
  organizer_password: string
  registration_fields: RegistrationFieldDef[]
  questions: OlympiadQuestion[]
  relay_mode: boolean
  relay_type: OlympiadRelayType
  subjects: OlympiadSubject[]
  subject_assignment_mode: OlympiadSubjectAssignmentMode
  scheduled_start_at: ISODateString | null
  scheduled_end_at: ISODateString | null
  auto_start: boolean
  created_at: ISODateString
}

// ── olympiad_registrations ──────────────────────────────────────────────
export interface OlympiadAnnotation {
  id: string
  x: number
  y: number
  type: 'tick' | 'cross' | 'note'
  text?: string
}

export interface QuestionResult {
  question_id: string
  question_text: string
  type: QuestionType
  student_answer: unknown
  correct_answer: unknown
  is_correct: boolean | null
  marks_awarded: number | null
  marks_possible: number
  organizer_note?: string
}

export interface OlympiadRegistrationRow {
  id: UUID
  olympiad_id: UUID
  full_name: string
  phone: string
  email: string
  college: string
  college_roll: string
  hsc_session: string
  batch: string
  group_name: string
  custom_answers: Record<string, unknown>
  short_answers: Record<string, unknown>
  mcq_answers: Record<string, unknown>
  photo_answers: { question_id: string; url: string }[]
  answer_sheet_url: string
  exam_started_at: ISODateString | null
  exam_submitted_at: ISODateString | null
  mcq_score: number | null
  final_score: number | null
  /** @deprecated legacy, mirrors final_score */
  result_score?: number | null
  result_feedback: string
  question_results: QuestionResult[]
  annotations: OlympiadAnnotation[]
  organizer_note: string
  review_status: string
  created_at: ISODateString
}

// ── form_configs ─────────────────────────────────────────────────────────
export interface FormPrimaryField {
  field_key: string
  label: string
  description?: string
  visible: boolean
  required: boolean
}

export interface FormContactPerson {
  name: string
  post: string
  phone?: string
  email?: string
  whatsapp?: string
  facebook?: string
}

export interface FormConfigRow {
  id: UUID
  form_key: string // "activity_register", "olympiad_register:<id>", ...
  title: string
  subtitle: string
  cover_photo_url: string
  bg_theme: string // default "default"
  primary_fields: FormPrimaryField[]
  extra_fields: CustomFieldDef[]
  contact_persons: FormContactPerson[] | { use_ec_page: true; ec_ids: string[] }
  updated_at: ISODateString
}
