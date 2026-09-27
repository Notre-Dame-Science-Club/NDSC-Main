-- Add organizer review columns to relay_exam_state
-- Enables organizer dashboard to review/score activity-linked olympiad submissions

ALTER TABLE relay_exam_state
  ADD COLUMN IF NOT EXISTS organizer_score numeric,
  ADD COLUMN IF NOT EXISTS review_status text,
  ADD COLUMN IF NOT EXISTS annotations jsonb,
  ADD COLUMN IF NOT EXISTS organizer_note text;
