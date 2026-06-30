-- ============================================================
-- NDSC Platform — MIGRATION V6 (Phase D)
-- Run in Supabase SQL Editor after V5_PATCH
-- SAFE TO RE-RUN — all IF NOT EXISTS
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. activity_reg_categories — Phase D new columns
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.activity_reg_categories
  ADD COLUMN IF NOT EXISTS submission_config jsonb DEFAULT '[]'::jsonb,
  -- [{ id, title, description, field_type: 'file'|'text'|'textarea',
  --    file_types: ['pdf','jpg'], max_file_size_mb: 5, max_files: 1, required: true }]
  ADD COLUMN IF NOT EXISTS submission_who text DEFAULT 'leader',
  -- 'leader' | 'any_member'
  ADD COLUMN IF NOT EXISTS project_name_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS project_name_label text DEFAULT 'Project Name';

-- ────────────────────────────────────────────────────────────
-- 2. activity_registrations — project name field
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.activity_registrations
  ADD COLUMN IF NOT EXISTS project_name text,
  ADD COLUMN IF NOT EXISTS division text;

-- ────────────────────────────────────────────────────────────
-- 3. activity_submissions — file/text submissions per registration
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.activity_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid NOT NULL REFERENCES public.activity_registrations(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.activity_reg_categories(id) ON DELETE CASCADE,
  activity_session_id uuid NOT NULL REFERENCES public.activity_sessions(id) ON DELETE CASCADE,
  submitted_by text NOT NULL DEFAULT 'leader',
  -- 'leader' or team_member.id (from the JSONB array)
  answers jsonb DEFAULT '{}'::jsonb,
  -- { field_id: 'text value' | ['url1', 'url2'] }
  is_final boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activity_submissions_reg_idx ON public.activity_submissions (registration_id);
CREATE INDEX IF NOT EXISTS activity_submissions_session_idx ON public.activity_submissions (activity_session_id);

-- ────────────────────────────────────────────────────────────
-- 4. olympiads — relay + subjects + scheduling columns
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.olympiads
  ADD COLUMN IF NOT EXISTS relay_mode boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS relay_type text DEFAULT 'sequential',
  -- 'sequential' = 1→2→3 strict order
  -- 'chain' = next member's questions inject previous answers as variables
  ADD COLUMN IF NOT EXISTS subjects jsonb DEFAULT '[]'::jsonb,
  -- [{ id, name, description, question_ids: [] }]
  ADD COLUMN IF NOT EXISTS subject_assignment_mode text DEFAULT 'self_select',
  -- 'self_select' | 'admin_assign' | 'auto'
  ADD COLUMN IF NOT EXISTS scheduled_start_at timestamptz,
  ADD COLUMN IF NOT EXISTS scheduled_end_at timestamptz,
  ADD COLUMN IF NOT EXISTS auto_start boolean DEFAULT false;

-- ────────────────────────────────────────────────────────────
-- 5. relay_exam_state — per-registration relay progress
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.relay_exam_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid NOT NULL REFERENCES public.activity_registrations(id) ON DELETE CASCADE,
  olympiad_id uuid NOT NULL REFERENCES public.olympiads(id) ON DELETE CASCADE,
  current_member_index int DEFAULT 0,
  member_submissions jsonb DEFAULT '[]'::jsonb,
  -- [{ member_id: 'leader'|id, answers: {}, submitted_at, duration_seconds }]
  chain_values jsonb DEFAULT '{}'::jsonb,
  -- values injected into next member's questions
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS relay_exam_state_reg_oly_idx
  ON public.relay_exam_state (registration_id, olympiad_id);

-- ────────────────────────────────────────────────────────────
-- 6. team_subject_assignments
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.team_subject_assignments (
  registration_id uuid NOT NULL REFERENCES public.activity_registrations(id) ON DELETE CASCADE,
  member_id text NOT NULL,  -- 'leader' or team_member.id
  olympiad_id uuid NOT NULL REFERENCES public.olympiads(id) ON DELETE CASCADE,
  subject_id text NOT NULL,
  assigned_at timestamptz DEFAULT now(),
  PRIMARY KEY (registration_id, member_id, olympiad_id)
);

-- ────────────────────────────────────────────────────────────
-- 7. form_configs — universal per-form customization
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.form_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_key text UNIQUE NOT NULL,
  -- e.g. 'activity_register', 'olympiad_register', 'membership',
  --      'activity_register:SESSION_ID', 'olympiad_register:OLYMPIAD_ID'
  title text,
  subtitle text,
  cover_photo_url text,
  bg_theme text DEFAULT 'default',
  primary_fields jsonb DEFAULT '[]'::jsonb,
  -- [{ field_key, label, description, visible, required }]
  extra_fields jsonb DEFAULT '[]'::jsonb,
  -- same shape as category.custom_fields
  contact_persons jsonb DEFAULT '[]'::jsonb,
  -- [{ name, post, phone, email, whatsapp, facebook }]
  -- OR { use_ec_page: true, ec_ids: ['uuid'] }
  updated_at timestamptz DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- Done
-- ────────────────────────────────────────────────────────────
