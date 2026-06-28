-- ============================================================
-- NDSC Platform — Migration V4 (Member Portal rework)
-- Run this in Supabase SQL Editor (safe to re-run — IF NOT EXISTS everywhere)
-- ============================================================

-- ----------------------------------------------------------------
-- 1. members — new identity, payment proof, department, achievements
-- ----------------------------------------------------------------
ALTER TABLE public.members
  -- The site's primary identifier going forward is the 8-digit college roll,
  -- stored as TEXT (not numeric) so leading zeros are never silently dropped
  -- and so it can be validated as "exactly 8 digits" at the application
  -- layer. The existing `college_role` column (a pre-existing typo/legacy
  -- field, stored as a number) is left untouched for backward compatibility
  -- — nothing reads/writes it after this patch, but old data isn't lost.
  ADD COLUMN IF NOT EXISTS college_roll text,

  -- Photo of the club membership slip (proof of the 200 taka membership fee
  -- payment + filled-out form submitted at the control room). Admin reviews
  -- this before approving (is_verified = true), same as already planned.
  ADD COLUMN IF NOT EXISTS payment_slip_url text,

  -- Which of the 7 NDSC departments this member belongs to. Free-text
  -- rather than an enum so admin can assign it without a code deploy if a
  -- department is ever renamed — the public-facing department list (with
  -- icons/colors/descriptions) lives in app/about/page.tsx's DEPTS array and
  -- this should match one of those names exactly: Administration, Project,
  -- Publication, ICT, LWS, Quiz, R&D.
  ADD COLUMN IF NOT EXISTS department text,

  -- Member-added, admin-moderated achievement/certificate entries. Shape:
  -- array of { id, title, description, image_url?, status: 'pending'|'approved', created_at }
  ADD COLUMN IF NOT EXISTS achievements jsonb DEFAULT '[]'::jsonb,

  -- Safety net for the `wing` field referenced in /api/auth/login's response
  -- shape but never actually set anywhere — keeping both `wing` and the new
  -- `department` column means nothing already depending on `wing` breaks,
  -- while new code can standardize on `department`.
  ADD COLUMN IF NOT EXISTS wing text,

  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- ----------------------------------------------------------------
-- 2. olympiad_registrations — tighten the roll number field
-- ----------------------------------------------------------------
-- college_roll already exists there as free text (added in earlier
-- migrations/original schema) — no structural change needed, this is just a
-- note that the *application layer* now validates it as 8 digits on both
-- the member registration form and the olympiad registration form, for a
-- consistent identity system site-wide. No SQL change required for this.

-- ----------------------------------------------------------------
-- 3. homepage_settings — Messenger group link
-- ----------------------------------------------------------------
-- No new column needed — this table is already a simple key/value store
-- (confirmed via /api/admin/homepage-settings). The Messenger group link is
-- just a new key, e.g. ('messenger_group_link', 'https://m.me/...'),
-- set through the existing admin UI/endpoint. Nothing to migrate here.

-- ----------------------------------------------------------------
-- 4. member_shoutbox — members-only live feed/board
-- ----------------------------------------------------------------
-- A lightweight, members-only message board shown on the dashboard Home
-- tab — separate from the AI assistant (NDSCBot) and from admin
-- announcements. Any verified member can post a short message; every
-- verified member can read the whole feed. No RLS policy needed for this
-- one since all reads/writes go through API routes using supabaseAdmin,
-- which always bypasses RLS — consistent with the rest of this app.
CREATE TABLE IF NOT EXISTS public.member_shoutbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid REFERENCES public.members(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  message text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS member_shoutbox_created_at_idx ON public.member_shoutbox (created_at DESC);

-- ----------------------------------------------------------------
-- Done. After running this:
--   1. Re-deploy the updated app code.
--   2. Existing members keep working exactly as before — `college_role`,
--      `wing` etc. are untouched, only new columns/tables were added.
-- ----------------------------------------------------------------
