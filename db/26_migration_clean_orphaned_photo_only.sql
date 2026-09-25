-- Remove orphaned photo_only olympiad rows created by Bug B (fake olympiads
-- for submission scheduling). Now that Submission is a first-class feature with
-- its own schedule fields in form_node.behavior, these rows serve no purpose.
--
-- Safety: This only deletes rows where exam_type='photo_only' AND questions
-- is empty (the signature of a Bug B fake olympiad). Real olympiads with actual
-- questions are never touched.

DELETE FROM olympiads
WHERE exam_type = 'photo_only'
  AND (questions IS NULL OR questions = '[]'::jsonb);
