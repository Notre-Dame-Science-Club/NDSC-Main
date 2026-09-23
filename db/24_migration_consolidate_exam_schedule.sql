-- ============================================================================
-- 24_migration_consolidate_exam_schedule.sql
--
-- Olympiads used to carry THREE overlapping ideas of "when":
--   - exam_date               a single display date, not actually enforced
--   - scheduled_start_at /
--     scheduled_end_at        the fields that actually gate student entry
--   - auto_start               a boolean flag that was never read anywhere
--
-- This collapses it down to one pair: scheduled_start_at / scheduled_end_at.
-- That's now the single source of truth everywhere (admin editor, the public
-- /olympiad listing, the exam-taking flow, the relay gate). A one-day exam
-- is just scheduled_start_at and scheduled_end_at on the same calendar day.
--
-- Safe to run more than once.
-- ============================================================================

-- 1) Backfill: for any olympiad that has an old exam_date but never had a
--    proper scheduled_start_at, treat exam_date as the start, and the end
--    of that same calendar day as the end (this matches the fallback
--    behaviour the app already used when scheduled_end_at was empty).
do $$ begin
  if exists (select 1 from information_schema.columns where table_name = 'olympiads' and column_name = 'exam_date') then
    update olympiads
    set
      scheduled_start_at = coalesce(scheduled_start_at, exam_date),
      scheduled_end_at   = coalesce(scheduled_end_at, date_trunc('day', exam_date) + interval '1 day' - interval '1 second')
    where exam_date is not null
      and (scheduled_start_at is null or scheduled_end_at is null);
  end if;
end $$;

-- 2) Drop the now-redundant columns.
do $$ begin
  if exists (select 1 from information_schema.columns where table_name = 'olympiads' and column_name = 'exam_date') then
    alter table olympiads drop column exam_date;
  end if;
  if exists (select 1 from information_schema.columns where table_name = 'olympiads' and column_name = 'auto_start') then
    alter table olympiads drop column auto_start;
  end if;
end $$;
