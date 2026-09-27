-- Drops the legacy olympiads.questions and olympiads.registration_fields
-- columns. Both are now fully replaced by the unified form_graphs/form_nodes
-- system — questions and registration fields are both authored in Form Builder
-- (admin/form-builder) and read from form_nodes where kind =
-- 'preset_olympiad_questions' or 'preset_common_details'.
--
-- This migration completes the transition from the old standalone olympiad
-- system to the unified form-graph system shared with activities.
--
-- Safe to run: no olympiad data currently exists in production, and all code
-- paths that previously read these columns now call getOlympiadQuestionFields()
-- (lib/server/olympiadQuestions.ts) or read directly from form_nodes.

ALTER TABLE olympiads
  DROP COLUMN IF EXISTS questions,
  DROP COLUMN IF EXISTS registration_fields;
