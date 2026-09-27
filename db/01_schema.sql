-- ============================================================================
-- NDSC Platform — full schema. Single source of truth for the database.
--
-- This is the merged result of the old schema.sql + schema_update_01/03/04/05.sql,
-- verified field-by-field against types/database.ts and actual `.from(...)`
-- usage across app/ and lib/ as of the 2026-07-17 cleanup (see
-- docs/update-notes/ for the full verification notes). The individual
-- schema_update_*.sql files that used to sit at the repo root are kept
-- for history only, under docs/update-notes/schema-history/ — this file
-- supersedes all of them. Run this single file on a fresh Supabase project
-- (SQL Editor) BEFORE importing data with scripts/import-supabase-data.js.
--
-- IMPORTANT CAVEATS (read before running):
--  1. This defines columns as loosely-typed as the app actually treats them
--     (mostly `text`), since the original migration history wasn't fully
--     preserved in the repo. It is NOT guaranteed byte-identical to the old
--     schema's constraints/indexes/RLS policies — verify against your old
--     project if you still have any dashboard/API access anywhere (staging,
--     a teammate's session, cached browser tab, etc.) before trusting this
--     as the sole source of truth.
--  2. Row Level Security (RLS) policies are NOT reconstructed here — the app
--     talks to Supabase via the service role key from API routes for admin
--     operations, and anon key for public reads. You'll need to re-create
--     RLS policies appropriate to your security model; a reasonable default
--     (RLS enabled, service_role bypasses it, no anon policies) is included
--     as a commented starting point at the bottom.
--  3. `activities` table: confirmed still dead in this cleanup — a CRUD API
--     route exists (app/api/admin/activities/route.ts) but no page calls it.
--     Included for completeness in case it holds legacy rows.
--  4. `appearance_settings`: confirmed still unused in this cleanup — the
--     live Appearance route (app/api/admin/appearance-settings/route.ts)
--     reads/writes `homepage_settings` under a shared set of keys instead.
--     Table kept in case it holds legacy rows; don't build new code against it.
--  5. `members.is_organizer` / `members.is_executive` (added by the old
--     schema_update_03.sql) ARE actively read/written by the app (survey
--     audience targeting, admin/members role toggles) — confirmed via grep
--     across app/ and lib/survey.ts. types/database.ts was missing these
--     two fields on MemberRow; that's been added back as part of this pass.
--  6. The old root-level `schema_updates.sql` (plural) proposed a different,
--     never-implemented appearance pipeline directly on `activity_sessions`
--     (background_image_url, title_text, title_color, button_color,
--     button_text_color, custom_css, registration_form_definition). None of
--     those columns are referenced anywhere in the current app — the actual
--     implementation that shipped is the form_configs-based pipeline from
--     schema_update_05.sql (bg_color, bg_image_url, font_family,
--     cover_aspect_ratio, auto_pull_*) below. The superseded draft is kept
--     under docs/update-notes/schema-history/ for history only — do not run it.
--  7. `schema_update_02.sql` is referenced by a comment in the old
--     schema_update_03.sql ("activity_sessions.bg_color") but the file
--     itself was never present in this repo. Its one column (`bg_color` on
--     activity_sessions) was already folded into the base schema below, so
--     nothing is missing — just noting the gap in the numbering for history.
-- ============================================================================

create extension if not exists "pgcrypto"; -- for gen_random_uuid()

-- ── admins ──────────────────────────────────────────────────────────────
create table if not exists admins (
  id    uuid primary key default gen_random_uuid(),
  email text unique not null,
  role  text default 'admin'
);

-- ── members (id mirrors auth.users.id) ─────────────────────────────────
create table if not exists members (
  id               uuid primary key,                 -- == auth.users.id, no default
  email            text,
  full_name        text,
  phone            text,
  ndsc_id          text,
  college_role     numeric,                           -- legacy, unused
  college_roll     text,
  batch            text,
  department       text,                              -- Administration|Project|Publication|ICT|LWS|Quiz|R&D
  wing             text,                              -- legacy fallback
  payment_slip_url text,
  is_verified      boolean default false,
  achievements     jsonb default '[]',
  is_organizer     boolean default false,  -- confirmed live: survey audience targeting, admin/members toggle
  is_executive     boolean default false,  -- confirmed live: survey audience targeting, admin/members toggle
  created_at       timestamptz default now()
);

create table if not exists member_shoutbox (
  id         uuid primary key default gen_random_uuid(),
  member_id  uuid references members(id) on delete cascade,
  full_name  text,
  message    text,
  created_at timestamptz default now()
);

-- ── announcements ───────────────────────────────────────────────────────
create table if not exists announcements (
  id         uuid primary key default gen_random_uuid(),
  title      text,
  body       text,
  target     text default 'all',                      -- all|members|non_members
  created_at timestamptz default now()
);

-- ── executives ──────────────────────────────────────────────────────────
create table if not exists executives (
  id             uuid primary key default gen_random_uuid(),
  full_name      text,
  position       text,
  panel          text,                                 -- committee|moderators|former_moderators|founder
  dept           text,
  photo_url      text,
  photo_position text default '50% 15%',
  facebook_url   text,
  linkedin_url   text,
  email          text,
  whatsapp       text,
  instagram_url  text,
  github_url     text,
  x_url          text,
  display_order  int default 0,
  session_year   text,
  is_active      boolean default true
);

-- ── publications ────────────────────────────────────────────────────────
create table if not exists publications (
  id              uuid primary key default gen_random_uuid(),
  title           text,
  description     text,
  category        text,                                -- annual_magazine|wall_magazine|trimatrik|abhishkar
  published_year  int,
  cover_image_url text,
  pdf_url         text,
  is_published    boolean default false,
  created_at      timestamptz default now()
);

-- ── science_media ───────────────────────────────────────────────────────
create table if not exists science_media (
  id            uuid primary key default gen_random_uuid(),
  title         text,
  youtube_url   text,
  display_order int default 0,
  is_active     boolean default true
);

-- ── homepage_settings / appearance_settings (key-value stores) ─────────
create table if not exists homepage_settings (
  key        text primary key,
  value      text,
  updated_at timestamptz default now()
);

create table if not exists appearance_settings (
  key        text primary key,
  value      text not null default '',
  updated_at timestamptz not null default now()
);

-- ── activities (legacy/unused table, column set unconfirmed) ───────────
create table if not exists activities (
  id         uuid primary key default gen_random_uuid(),
  title      text,
  slug       text,
  type       text,
  date       date,
  status     text,
  created_at timestamptz default now()
);

-- ── activity_types → activity_versions → activity_sessions ─────────────
create table if not exists activity_types (
  id            uuid primary key default gen_random_uuid(),
  name          text,
  slug          text,
  icon          text,                                  -- emoji
  description   text,
  display_order int default 0
);

create table if not exists activity_versions (
  id                uuid primary key default gen_random_uuid(),
  activity_type_id  uuid references activity_types(id) on delete cascade,
  version_number    int,
  version_label     text,
  year_start        int,
  year_end          int,
  description       text,
  is_pinned         boolean default false,  -- from schema_update_05.sql; pins version to top of its type's list
  is_highlighted    boolean default false   -- from schema_update_05.sql; distinct styling on public activities list
);

create table if not exists activity_sessions (
  id                    uuid primary key default gen_random_uuid(),
  activity_version_id   uuid references activity_versions(id) on delete set null,
  activity_type_id      uuid references activity_types(id) on delete set null,
  title                 text,
  slug                  text,
  session_date          date,
  location              text,
  description           text,
  cover_image_url       text,
  youtube_url           text,
  pdf_url               text,
  gallery_urls          jsonb default '[]',
  is_published          boolean default false,
  is_upcoming           boolean default false,
  registration_enabled  boolean default false,
  registration_note     text,
  event_dates           jsonb default '[]',
  bg_color              text,                           -- referenced by schema_update_03.sql comment
  -- from schema_update_05.sql (Task 1 — Activity Update):
  image_display_mode    text not null default 'cover',   -- 'cover' (fixed box, events) | 'native' (statement sites/posters)
  reg_status            text,                            -- admin-defined label, e.g. Open | Closed | Judging | Results Out
  reg_deadline          timestamptz,                      -- shown as countdown/date on the user dashboard
  -- from schema_update_06.sql — site-wide "new event" popup (mirrors surveys.show_notification):
  -- when true, this session is eligible to appear as the entry-popup in ActivityNotification
  -- (components/ActivityNotification.tsx) for every visitor, until the admin turns it back off
  -- or the event's date passes.
  notify_publicly        boolean not null default false
);

-- ── activity_updates — per-event admin updates/announcements feed ───────
-- from schema_update_05.sql (Task 1 — Activity Update), confirmed live via
-- app/api/admin/activity-updates, app/api/activity-updates-public,
-- app/activities/[slug]/page.tsx
create table if not exists activity_updates (
  id                    uuid primary key default gen_random_uuid(),
  activity_session_id   uuid not null references activity_sessions(id) on delete cascade,
  title                 text not null,
  body                  text not null default '',
  link_url              text,
  created_at            timestamptz not null default now()
);
create index if not exists idx_activity_updates_session on activity_updates(activity_session_id);

-- ── activity_reg_categories (self-referencing tree) ─────────────────────
create table if not exists activity_reg_categories (
  id                    uuid primary key default gen_random_uuid(),
  activity_session_id   uuid references activity_sessions(id) on delete cascade,
  parent_id             uuid references activity_reg_categories(id) on delete cascade,
  name                  text,
  description           text,
  display_order         int default 0,
  custom_fields         jsonb default '[]',
  requires_team         boolean default false,
  team_size_min         int,
  team_size_max         int,
  team_member_fields    jsonb default '[]',
  requires_payment      boolean default false,
  payment_amount        numeric,
  payment_label         text,
  is_online_submission  boolean default false,
  linked_olympiad_id    uuid,                           -- FK added after olympiads table below
  edit_window_hours     int,                             -- null = unlimited, 0 = immediately locked
  schedule_date         date,
  schedule_time         text,
  schedule_room         text,
  submission_config     jsonb default '[]',
  submission_who        text default 'leader',           -- leader|any_member
  project_name_enabled  boolean default false,
  project_name_label    text default 'Project Name',
  registration_open     boolean default true,
  created_at            timestamptz default now()
);

-- ── olympiads (created before activity_registrations/categories FK use it) ─
create table if not exists olympiads (
  id                     uuid primary key default gen_random_uuid(),
  name                   text,
  description            text,
  cover_image_url        text,
  pdf_url                text,
  mode                   text,                            -- legacy
  exam_type              text default 'mixed',             -- photo_only|live_only|mixed
  exam_mode              text default 'mixed',
  question_display       text default 'all_at_once',       -- one_by_one|all_at_once
  timer_minutes          int default 60,
  is_active              boolean default true,
  external_only          boolean default false,
  result_published       boolean default false,
  annotations_published  boolean default false,
  registration_deadline  timestamptz,
  exam_date              timestamptz,
  eligibility            text,
  organizer_password     text,                            -- plaintext, see original notes
  registration_fields    jsonb default '[]',
  questions              jsonb default '[]',
  relay_mode             boolean default false,
  relay_type             text default 'sequential',        -- sequential|chain
  subjects               jsonb default '[]',
  subject_assignment_mode text default 'self_select',      -- self_select|admin_assign|auto
  scheduled_start_at     timestamptz,
  scheduled_end_at       timestamptz,
  auto_start             boolean default false,
  theme_bg_color         text,
  theme_bg_image_url     text,
  theme_accent_color     text,
  theme_header_title     text,
  theme_header_subtitle  text,
  theme_header_logo_url  text,
  created_at             timestamptz default now()
);

alter table activity_reg_categories
  add constraint fk_activity_reg_categories_olympiad
  foreign key (linked_olympiad_id) references olympiads(id) on delete set null;

-- ── activity_registrations ──────────────────────────────────────────────
create table if not exists activity_registrations (
  id                     uuid primary key default gen_random_uuid(),
  category_id            uuid references activity_reg_categories(id) on delete cascade,
  activity_session_id    uuid references activity_sessions(id) on delete cascade,
  full_name              text,
  phone                  text,
  email                  text,
  college                text,
  college_roll           text,
  hsc_session            text,
  custom_answers         jsonb default '{}',
  team_members           jsonb default '[]',
  member_id              uuid references members(id) on delete set null,
  payment_status         text default 'not_required',      -- not_required|pending|paid|failed
  payment_tran_id        text,
  payment_amount         numeric,
  payment_validated_at   timestamptz,
  edit_locked_at         timestamptz,
  project_name           text,
  division               text,
  created_at             timestamptz default now()
);

create table if not exists payment_transactions (
  id                         uuid primary key default gen_random_uuid(),
  tran_id                    text unique,
  activity_registration_id   uuid references activity_registrations(id) on delete set null,
  amount                     numeric,
  currency                   text default 'BDT',
  status                     text default 'pending',        -- pending|valid|failed|cancelled
  raw_ipn                    jsonb,
  raw_validation             jsonb,
  created_at                 timestamptz default now(),
  validated_at               timestamptz
);

create table if not exists activity_submissions (
  id                    uuid primary key default gen_random_uuid(),
  registration_id       uuid references activity_registrations(id) on delete cascade,
  category_id           uuid references activity_reg_categories(id) on delete cascade,
  activity_session_id   uuid references activity_sessions(id) on delete cascade,
  submitted_by          text default 'leader',              -- "leader" | team_member.id
  answers               jsonb default '{}',
  is_final              boolean default false,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

create table if not exists relay_exam_state (
  id                     uuid primary key default gen_random_uuid(),
  registration_id        uuid references activity_registrations(id) on delete cascade,
  olympiad_id            uuid references olympiads(id) on delete cascade,
  current_member_index   int default 0,
  member_submissions     jsonb default '[]',
  chain_values           jsonb default '{}',
  started_at             timestamptz,
  completed_at           timestamptz,
  created_at             timestamptz default now(),
  unique (registration_id, olympiad_id)
);

create table if not exists team_subject_assignments (
  registration_id  uuid references activity_registrations(id) on delete cascade,
  member_id        text,                                    -- "leader" | team_member.id
  olympiad_id      uuid references olympiads(id) on delete cascade,
  subject_id       text,
  assigned_at      timestamptz default now(),
  primary key (registration_id, member_id, olympiad_id)
);

-- ── olympiad_registrations ──────────────────────────────────────────────
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
  result_score         numeric,                              -- legacy, mirrors final_score
  result_feedback      text,
  question_results     jsonb default '[]',
  annotations          jsonb default '[]',
  organizer_note       text,
  review_status        text default 'pending',
  created_at           timestamptz default now()
);

-- ── form_configs ─────────────────────────────────────────────────────────
-- Global form appearance overrides keyed by form_key ("activity_register",
-- "olympiad_register:<id>", "membership", ...). Per-event appearance used
-- to live here as rows with form_key like "activity_register:<sessionId>",
-- but those were migrated to the 1:1 activity_session_form_appearance
-- table below (which keeps activity_sessions lean — most sessions don't
-- customize appearance, and a 1:1 table makes that a single-row check).
create table if not exists form_configs (
  id               uuid primary key default gen_random_uuid(),
  form_key         text unique,                              -- "activity_register", "olympiad_register:<id>", ...
  title            text,
  subtitle         text,
  cover_photo_url  text,
  bg_theme         text default 'default',
  extra_fields     jsonb default '[]',
  contact_persons  jsonb default '[]',
  -- registration-form appearance pipeline, from schema_update_05.sql,
  -- confirmed live via app/admin/forms/page.tsx, app/olympiad/page.tsx,
  -- app/activities/[slug]/register/page.tsx, app/api/olympiad/route.ts
  bg_color               text,
  bg_image_url           text,
  font_family            text default 'default',   -- 'default' | 'orbitron' | 'rajdhani' | 'jakarta' | 'mono'
  cover_aspect_ratio     text default 'auto',       -- 'auto' | '16/9' | '4/3' | '1/1' | '21/9'
  auto_pull_title        boolean not null default false,
  auto_pull_description  boolean not null default false,
  auto_pull_cover        boolean not null default false,
  updated_at       timestamptz default now()
);

-- ── activity_session_form_appearance ─────────────────────────────────────
-- 1:1 with activity_sessions. Holds the per-session registration-form
-- appearance overrides (title, subtitle, cover, bg, font, contact
-- persons, auto-pull toggles). Replaces the old per-event
-- form_configs rows with form_key like "activity_register:<sessionId>".
-- Read by /api/activity-session-appearance-public and
-- /api/admin/activity-session-appearance; written by the admin Appearance
-- tab on /admin/activity-registration/[sessionId].
create table if not exists activity_session_form_appearance (
  session_id              uuid primary key references activity_sessions(id) on delete cascade,
  form_title              text,
  form_subtitle           text,
  form_cover_photo_url    text,
  form_cover_aspect_ratio text default 'auto',        -- 'auto' | '16/9' | '4/3' | '1/1' | '21/9'
  form_bg_theme           text default 'default',
  form_bg_color           text,
  form_bg_image_url       text,
  form_font_family        text default 'default',     -- 'default' | 'orbitron' | 'rajdhani' | 'jakarta' | 'mono'
  form_auto_pull_title    boolean not null default false,
  form_auto_pull_description boolean not null default false,
  form_auto_pull_cover    boolean not null default false,
  form_contact_persons    jsonb default '[]',
  updated_at              timestamptz default now()
);

-- ── surveys / survey_responses (from schema_update_03.sql) ──────────────
create table if not exists surveys (
  id                        uuid primary key default gen_random_uuid(),
  title                     text not null,
  description               text,
  cover_image_url           text,
  questions                 jsonb not null default '[]',
  is_active                 boolean not null default true,
  starts_at                 timestamptz,
  ends_at                   timestamptz,
  allow_multiple_responses  boolean not null default false,
  show_notification         boolean not null default false,
  notification_title        text,
  notification_message      text,
  send_email                boolean not null default false,
  email_sent_at             timestamptz,
  audience_type             text not null default 'all',
  audience_config           jsonb not null default '{}',
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create table if not exists survey_responses (
  id                uuid primary key default gen_random_uuid(),
  survey_id         uuid not null references surveys(id) on delete cascade,
  member_id         uuid references members(id) on delete set null,
  respondent_name   text,
  respondent_email  text,
  answers           jsonb not null default '{}',
  created_at        timestamptz not null default now()
);

create index if not exists idx_survey_responses_survey_id on survey_responses(survey_id);
create index if not exists idx_survey_responses_member_id on survey_responses(member_id);

-- ============================================================================
-- OPTIONAL: minimal RLS starting point.
-- The old project's actual policies are NOT recoverable from the codebase
-- (they live only in Supabase's Postgres catalog). Uncomment and adapt as
-- needed — service_role always bypasses RLS regardless of policies below,
-- so your API routes using SUPABASE_SERVICE_ROLE_KEY will keep working
-- immediately after import even with RLS enabled and no policies defined.
-- ============================================================================

-- alter table members enable row level security;
-- create policy "members can view own row" on members
--   for select using (auth.uid() = id);
-- ... repeat per table as needed for your security model
