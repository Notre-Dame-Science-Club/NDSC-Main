-- Migration: Restore `olympiad_registrations`, wrongly dropped by
-- 99_drop_legacy_olympiad_system.sql.
--
-- ROOT CAUSE: 99_drop_legacy_olympiad_system.sql was written (and run) on the
-- assumption that "No production code references olympiad_registrations
-- table" once the form-graph migration landed. That assumption was false —
-- every STANDALONE (non activity-linked) olympiad still stores its
-- registrations and exam answers in this table:
--
--   - app/api/public/form-graph/submit/route.ts  (isOlympiad branch: the
--     INSERT/UPDATE target for every standalone olympiad registration)
--   - app/api/olympiad-register/route.ts         (GET resume + PUT answers)
--   - app/api/organizer/registrations/route.ts,
--     app/api/admin/olympiad-registrations/route.ts,
--     app/api/admin/olympiads/[olympiadId]/registrations.csv/route.ts
--     (standalone branch — the activity-linked branch uses
--     activity_registrations instead and is unaffected)
--   - app/api/olympiad-leaderboard, app/api/member-history,
--     app/api/identity-lookup, app/api/admin/send-announcement, etc.
--
-- With the table gone, submitting to any standalone olympiad fails at the
-- database layer with "Could not find the table 'public.olympiad_registrations'
-- in the schema cache" (PostgREST can't find a table that doesn't exist).
-- Activity-linked ("child") olympiads are unaffected because they never used
-- this table in the first place.
--
-- This migration re-creates the table (and its form-graph backref columns,
-- FKs, and indexes) exactly as defined in 00_UNIFIED_MASTER_SCHEMA.sql, so it
-- matches what the application code above already expects. It does NOT
-- restore any data that may have been lost when the table was dropped — per
-- 99's own header, no olympiad registrations were believed to exist in
-- production at the time it was run, but if standalone olympiads have
-- collected real registrations since then, those rows are gone and this can
-- only recreate an empty table.
--
-- Idempotent: safe to re-run (uses IF NOT EXISTS throughout).
--
-- IMPORTANT: do not run db/99_drop_legacy_olympiad_system.sql again until the
-- standalone olympiad flow above has actually been migrated onto
-- activity_registrations (or some other replacement) and every route listed
-- above has been updated accordingly. See db/README.md.

create table if not exists olympiad_registrations (
  id                   uuid primary key default gen_random_uuid(),
  olympiad_id          uuid references olympiads(id) on delete cascade,
  full_name            text,
  phone                text,
  email                text,
  college              text,
  college_roll         text,
  hsc_session          text,
  batch                text,
  group_name           text,
  custom_answers       jsonb default '{}',
  short_answers        jsonb default '{}',
  mcq_answers          jsonb default '{}',
  photo_answers        jsonb default '[]',
  answer_sheet_url     text,
  exam_started_at      timestamptz,
  exam_submitted_at    timestamptz,
  mcq_score            numeric,
  final_score          numeric,
  result_score         numeric,
  result_feedback      text,
  question_results     jsonb default '[]',
  annotations          jsonb default '[]',
  organizer_note       text,
  review_status        text default 'pending',
  form_graph_id        uuid,
  form_node_id         uuid,
  submitted_node_ids   jsonb default '[]'::jsonb,
  created_at           timestamptz default now()
);

-- Add form graph backref columns if the table already existed without them
-- (defensive — mirrors 00_UNIFIED_MASTER_SCHEMA.sql).
do $$ begin
  if not exists (select 1 from information_schema.columns where table_name='olympiad_registrations' and column_name='form_graph_id') then
    alter table olympiad_registrations add column form_graph_id uuid;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='olympiad_registrations' and column_name='form_node_id') then
    alter table olympiad_registrations add column form_node_id uuid;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='olympiad_registrations' and column_name='submitted_node_ids') then
    alter table olympiad_registrations add column submitted_node_ids jsonb default '[]'::jsonb;
  end if;
end $$;

-- Re-add the FKs to form_graphs / form_nodes.
do $$ begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'olympiad_registrations_form_graph_id_fkey'
  ) then
    alter table olympiad_registrations
      add constraint olympiad_registrations_form_graph_id_fkey
      foreign key (form_graph_id) references form_graphs(id) on delete set null;
  end if;

  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'olympiad_registrations_form_node_id_fkey'
  ) then
    alter table olympiad_registrations
      add constraint olympiad_registrations_form_node_id_fkey
      foreign key (form_node_id) references form_nodes(id) on delete set null;
  end if;
end $$;

create index if not exists olympiad_registrations_form_graph_idx on olympiad_registrations (form_graph_id);
create index if not exists olympiad_registrations_form_node_idx on olympiad_registrations (form_node_id);
create index if not exists olympiad_registrations_olympiad_idx on olympiad_registrations (olympiad_id);
