-- Migration: Replace session_date and event_dates with event_start and event_end
-- This simplifies the date handling for both single-day and multi-day events.
-- If event_end is NULL or equals event_start, it's a single-day event.

ALTER TABLE activity_sessions
  ADD COLUMN IF NOT EXISTS event_start DATE,
  ADD COLUMN IF NOT EXISTS event_end DATE;

-- Migrate existing data:
-- 1. If event_dates array has values, use first as start, last as end
-- 2. Otherwise, use session_date for both start and end
UPDATE activity_sessions
SET
  event_start = CASE
    WHEN jsonb_array_length(COALESCE(event_dates, '[]'::jsonb)) > 0
    THEN (event_dates->0)::text::date
    ELSE session_date
  END,
  event_end = CASE
    WHEN jsonb_array_length(COALESCE(event_dates, '[]'::jsonb)) > 1
    THEN (event_dates->(jsonb_array_length(event_dates) - 1))::text::date
    WHEN jsonb_array_length(COALESCE(event_dates, '[]'::jsonb)) = 1
    THEN (event_dates->0)::text::date
    ELSE session_date
  END
WHERE event_start IS NULL;

-- Note: Keep session_date and event_dates columns for now to allow rollback if needed.
-- After verifying the migration works in production, you can drop them:
-- ALTER TABLE activity_sessions DROP COLUMN session_date, DROP COLUMN event_dates;
