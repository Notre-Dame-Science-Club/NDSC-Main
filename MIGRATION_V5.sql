-- ============================================================
-- NDSC Platform — Migration V5 (Activity Registration + Payment + Teams)
-- Run this in Supabase SQL Editor (safe to re-run — IF NOT EXISTS everywhere)
-- ============================================================

-- ----------------------------------------------------------------
-- 0. Identity rule correction (carried over from a Phase B mistake)
-- ----------------------------------------------------------------
-- Phase B's "exactly 8 digits" validation was based on an incorrect
-- assumption — college roll is required for EVERY registrant (NDC or not),
-- but the digit count only needs to be exactly 8 for NDC students
-- specifically; other colleges format their own rolls differently. No
-- column change is needed for this — it's an application-layer validation
-- fix (see app/register/page.tsx, app/api/auth/register/route.ts,
-- app/olympiad/page.tsx) — noted here so the schema and the app logic
-- comments stay in sync with this correction.

-- ----------------------------------------------------------------
-- 1. activity_sessions — upcoming status + registration toggle
-- ----------------------------------------------------------------
ALTER TABLE public.activity_sessions
  -- Explicit admin override rather than purely date-derived, since a
  -- session's date can be TBD or simply wrong/unset, and "upcoming" needs
  -- to be a deliberate choice that also gates the registration toggle below.
  ADD COLUMN IF NOT EXISTS is_upcoming boolean DEFAULT false,

  -- Only meaningful when is_upcoming = true. Turns the whole multi-layer
  -- registration sub-system (tables below) on for this session.
  ADD COLUMN IF NOT EXISTS registration_enabled boolean DEFAULT false,

  -- Free-text note shown near the registration CTA, e.g. "Registration
  -- closes June 30" — admin-controlled, not enforced server-side (the real
  -- per-category deadline, if any, lives on the category itself — see below).
  ADD COLUMN IF NOT EXISTS registration_note text,

  -- Multi-day event support (fests commonly run 3 days). The existing
  -- single `session_date` column is left untouched and continues to work as
  -- the primary/display date for anything that doesn't use this — but when
  -- an event spans multiple days, admin fills `event_dates` with the full
  -- list and the UI prefers it over the single date wherever relevant
  -- (schedule display, "happened" calculation uses the LAST date in this
  -- array so a 3-day fest doesn't flip to "previous" after day 1).
  ADD COLUMN IF NOT EXISTS event_dates jsonb DEFAULT '[]'::jsonb; -- ["2026-07-01","2026-07-02","2026-07-03"]

-- ----------------------------------------------------------------
-- 2. activity_reg_categories — the recursive, admin-controlled-depth tree
-- ----------------------------------------------------------------
-- A single session can have an arbitrarily deep category tree
-- (e.g. Offline / Online -> Class 5 / Class 9-10 -> Physics / Chemistry).
-- Registration only ever happens at a LEAF (a category with no children) —
-- that's where custom_fields / team settings / payment settings live.
CREATE TABLE IF NOT EXISTS public.activity_reg_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_session_id uuid NOT NULL REFERENCES public.activity_sessions(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.activity_reg_categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  display_order int DEFAULT 0,

  -- Leaf-only settings (ignored/unused on non-leaf nodes, but kept on the
  -- same row rather than a separate table — simpler to query and edit as
  -- one tree, and a non-leaf row simply never reads these columns).
  custom_fields jsonb DEFAULT '[]'::jsonb,
  -- Shape: [{ key, label, description, type: 'text'|'number'|'textarea'|'photo', required }]

  requires_team boolean DEFAULT false,
  team_size_min int,
  team_size_max int,
  team_member_fields jsonb DEFAULT '[]'::jsonb,
  -- Same shape as custom_fields — what info is collected per team member.

  requires_payment boolean DEFAULT false,
  payment_amount numeric,
  payment_label text, -- e.g. "Registration fee" — shown on the payment screen

  -- The auto-link to the Olympiad system (requirement #8 — a category whose
  -- registration is really "submit your work online" becomes a real
  -- Olympiad under the hood, and registrants are sent straight into the
  -- existing Olympiad registration/dashboard/submission flow instead of a
  -- separate Activity-specific one).
  is_online_submission boolean DEFAULT false,
  linked_olympiad_id uuid REFERENCES public.olympiads(id) ON DELETE SET NULL,

  -- How many hours after registering a participant can still edit their own
  -- basic info from their dashboard. NULL means no time limit (always
  -- editable). 0 means editing is locked immediately after submitting.
  edit_window_hours int,

  -- Schedule info for this specific segment — only meaningful on a leaf
  -- (the node where registration actually happens). Lets the dashboard show
  -- "Physics Round — July 2, 10:00 AM, Room 204" as a reminder for anyone
  -- registered in this category, and lets one event have different segments
  -- running at different times/rooms across a multi-day fest.
  schedule_date date,
  schedule_time text, -- free text e.g. "10:00 AM - 12:00 PM", not a strict time type, since admin may want a range or "TBA"
  schedule_room text,

  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS activity_reg_categories_session_idx ON public.activity_reg_categories (activity_session_id);
CREATE INDEX IF NOT EXISTS activity_reg_categories_parent_idx ON public.activity_reg_categories (parent_id);

-- ----------------------------------------------------------------
-- 3. activity_registrations — the actual sign-ups, always at a leaf category
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.activity_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.activity_reg_categories(id) ON DELETE CASCADE,
  activity_session_id uuid NOT NULL REFERENCES public.activity_sessions(id) ON DELETE CASCADE,

  -- Core mandatory fields, collected for every activity registration
  -- regardless of what extra custom_fields the category defines — same
  -- pattern already established for Olympiad registrations.
  full_name text NOT NULL,
  phone text NOT NULL,
  email text NOT NULL,
  college text NOT NULL,
  college_roll text NOT NULL,
  hsc_session text,

  custom_answers jsonb DEFAULT '{}'::jsonb,

  -- Team registration: the leader's own row is this registration; teammates
  -- are stored alongside it rather than as separate top-level registration
  -- rows that would need their own category linkage. Each entry also gets
  -- its own login credential (member_id once they claim/log in).
  team_members jsonb DEFAULT '[]'::jsonb,
  -- Shape: [{ id, full_name, phone, email, college_roll, password_hash,
  --           custom_answers, is_leader: false }]

  -- If the registrant was a logged-in member at the time of registering,
  -- linked here so the member dashboard can show "you're registered for X".
  member_id uuid REFERENCES public.members(id) ON DELETE SET NULL,

  payment_status text DEFAULT 'not_required', -- not_required | pending | paid | failed
  payment_tran_id text,
  payment_amount numeric,
  payment_validated_at timestamptz,

  -- Registrants can edit their own info up until this timestamp (set at
  -- registration time based on an admin-configured edit window).
  edit_locked_at timestamptz,

  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activity_registrations_category_idx ON public.activity_registrations (category_id);
CREATE INDEX IF NOT EXISTS activity_registrations_session_idx ON public.activity_registrations (activity_session_id);
CREATE INDEX IF NOT EXISTS activity_registrations_email_idx ON public.activity_registrations (email);
CREATE INDEX IF NOT EXISTS activity_registrations_roll_idx ON public.activity_registrations (college_roll);

-- ----------------------------------------------------------------
-- 4. Site-wide payment ledger (shared by activities; olympiads/members
--    don't currently charge anything, but this stays generic in case)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tran_id text UNIQUE NOT NULL,
  activity_registration_id uuid REFERENCES public.activity_registrations(id) ON DELETE SET NULL,
  amount numeric NOT NULL,
  currency text DEFAULT 'BDT',
  status text DEFAULT 'pending', -- pending | valid | failed | cancelled
  raw_ipn jsonb,
  raw_validation jsonb,
  created_at timestamptz DEFAULT now(),
  validated_at timestamptz
);

CREATE INDEX IF NOT EXISTS payment_transactions_tran_idx ON public.payment_transactions (tran_id);

-- ----------------------------------------------------------------
-- Done. After running this:
--   1. Re-deploy the updated app code.
--   2. Nothing existing is touched/renamed — only new tables and new
--      nullable/defaulted columns were added.
-- ----------------------------------------------------------------
