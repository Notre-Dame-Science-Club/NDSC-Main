-- ARCHIVED (2026-07-17 cleanup) — historical only. Folded into db/schema.sql.
-- Do not run this file directly; it may conflict with or duplicate the merged schema.

-- Survey / notification system
-- Run this in the Supabase SQL editor (same as schema_update_01.sql).
-- NOTE: if schema_update_02.sql (activity_sessions.bg_color) hasn't been
-- applied yet, run that one too — this file is independent of it.

-- Role flags on members, used for survey/notification audience targeting
-- ("organizers" / "executives" as a subset of logged-in members — see the
-- long comment in lib/survey.ts for why this is how those two audiences
-- are modeled instead of the per-olympiad organizer_password session).
alter table members
  add column if not exists is_organizer boolean default false,
  add column if not exists is_executive boolean default false;

create table if not exists surveys (
  id                          uuid primary key default gen_random_uuid(),
  title                       text not null,
  description                 text,
  cover_image_url             text,
  questions                   jsonb not null default '[]',
  is_active                   boolean not null default true,
  starts_at                   timestamptz,
  ends_at                     timestamptz,
  allow_multiple_responses    boolean not null default false,

  -- Distribution
  show_notification           boolean not null default false,
  notification_title          text,
  notification_message        text,
  send_email                  boolean not null default false,
  email_sent_at                timestamptz,

  -- Audience targeting — see lib/survey.ts for the shape of audience_config
  -- and how it's interpreted per audience_type.
  audience_type               text not null default 'all',
  audience_config             jsonb not null default '{}',

  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create table if not exists survey_responses (
  id                 uuid primary key default gen_random_uuid(),
  survey_id          uuid not null references surveys(id) on delete cascade,
  member_id          uuid references members(id) on delete set null,
  respondent_name    text,
  respondent_email   text,
  answers            jsonb not null default '{}',
  created_at         timestamptz not null default now()
);

create index if not exists idx_survey_responses_survey_id on survey_responses(survey_id);
create index if not exists idx_survey_responses_member_id on survey_responses(member_id);
