-- Adds a per-olympiad "is_just_a_submission" toggle.
-- When true, the public exam-taking flow drops the countdown timer and the
-- "Start Exam" framing, and behaves like a plain form submission instead.
-- Everything else about the olympiad (questions, subjects, relay mode,
-- scheduling window, grading) is unaffected.

ALTER TABLE olympiads
  ADD COLUMN IF NOT EXISTS is_just_a_submission boolean NOT NULL DEFAULT false;
