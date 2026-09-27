-- Adds parent_activity_session_id to olympiads table to support purely
-- informational olympiad entries that link back to their parent Activity
-- rather than having their own registration form.
--
-- When this field is set, the olympiad card on /olympiad shows a "Register
-- for [parent activity]" CTA instead of its own form submission button.

ALTER TABLE olympiads
  ADD COLUMN IF NOT EXISTS parent_activity_session_id uuid REFERENCES activity_sessions(id) ON DELETE SET NULL;
