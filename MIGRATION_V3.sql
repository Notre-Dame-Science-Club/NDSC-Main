-- ============================================================
-- NDSC Olympiad Platform — Migration V3
-- Run this in Supabase SQL Editor (safe to re-run — everything uses IF NOT EXISTS)
-- ============================================================

-- ----------------------------------------------------------------
-- 1. olympiads — exam format selector + safety net for V2 columns
-- ----------------------------------------------------------------
ALTER TABLE public.olympiads
  -- Explicit admin-controlled exam format. Replaces the old unused `mode`
  -- column going forward (kept for backward compatibility, not deleted).
  -- 'photo_only'  -> student only sees "Submit Answer Sheet" on their dashboard
  -- 'live_only'   -> student only sees "Start Exam"
  -- 'mixed'       -> student sees both (current default behavior)
  ADD COLUMN IF NOT EXISTS exam_type text DEFAULT 'mixed';

-- Backfill exam_type sensibly for any existing rows based on their current
-- question mix, so nothing that already works suddenly hides an option.
UPDATE public.olympiads
SET exam_type = CASE
  WHEN EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(questions, '[]'::jsonb)) q
    WHERE q->>'type' IN ('mcq', 'short')
  ) AND (
    pdf_url IS NOT NULL OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(questions, '[]'::jsonb)) q
      WHERE q->>'type' = 'photo'
    )
  ) THEN 'mixed'
  WHEN EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(questions, '[]'::jsonb)) q
    WHERE q->>'type' IN ('mcq', 'short')
  ) THEN 'live_only'
  ELSE 'photo_only'
END
WHERE exam_type IS NULL OR exam_type = 'mixed';

-- ----------------------------------------------------------------
-- 2. olympiad_registrations — score unification, annotations, breakdown
-- ----------------------------------------------------------------
ALTER TABLE public.olympiad_registrations
  -- The organizer scoring route (/api/organizer/score) writes to this column.
  -- It did not exist before this migration, which silently broke organizer
  -- score-marking (Supabase rejects updates to unknown columns).
  ADD COLUMN IF NOT EXISTS final_score numeric,

  -- Organizer/admin's overall written comment on the whole answer sheet —
  -- separate from per-mark notes, which live inside `annotations` below.
  ADD COLUMN IF NOT EXISTS organizer_note text,

  -- Per-question breakdown shown to the student on the result page once
  -- result_published = true. Shape: array of
  --   { question_id, question_text, type, student_answer, correct_answer,
  --     is_correct, marks_awarded, marks_possible, organizer_note }
  ADD COLUMN IF NOT EXISTS question_results jsonb DEFAULT '[]'::jsonb,

  -- Tick / cross / note markers placed on the answer-sheet image by an
  -- organizer or admin. Shape: array of
  --   { id, x, y, type: 'tick' | 'cross' | 'note', text? }
  -- x/y are percentages (0-100) of image width/height, so the marks stay in
  -- the right place regardless of how large the image is rendered.
  ADD COLUMN IF NOT EXISTS annotations jsonb DEFAULT '[]'::jsonb,

  -- Safety net: columns referenced throughout the app's code that were part
  -- of the original V1 schema (not included in this project's SQL files at
  -- all) — added here with IF NOT EXISTS so this migration is safe to run
  -- regardless of what already exists in production.
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS review_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS mcq_answers jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS mcq_score numeric,
  ADD COLUMN IF NOT EXISTS custom_answers jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS short_answers jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS photo_answers jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS batch text,
  ADD COLUMN IF NOT EXISTS group_name text,
  ADD COLUMN IF NOT EXISTS hsc_session text,
  ADD COLUMN IF NOT EXISTS exam_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS exam_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS answer_sheet_url text,
  ADD COLUMN IF NOT EXISTS result_score numeric; -- legacy column, kept for old data

-- One-time backfill: if any rows already have a result_score (set by the
-- admin panel before this migration) but no final_score yet, copy it over so
-- nothing the admin already graded looks unscored after this migration.
UPDATE public.olympiad_registrations
SET final_score = result_score
WHERE final_score IS NULL AND result_score IS NOT NULL;

-- ----------------------------------------------------------------
-- Done. After running this:
--   1. Re-deploy the updated app code (this migration alone does not change
--      any application behavior by itself).
--   2. Existing organizer-marked scores that failed silently before this
--      migration are NOT recoverable (the writes never landed) — only scores
--      marked AFTER this migration + the code fix will save correctly.
-- ----------------------------------------------------------------
