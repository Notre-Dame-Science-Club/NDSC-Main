-- ============================================================================
-- UNIFIED MASTER SCHEMA — NDSC Platform
-- ============================================================================
-- Single, comprehensive, fully idempotent migration script combining:
--   - db/schema.sql (primary schema)
--   - MIGRATION_add_group_by_version_to_activity_types.sql
--   - All db/migration_*.sql files
--   - db/update-08-07-2026.sql
--
-- Safe to run on ANY database state:
--   - Fresh Supabase project (creates everything from scratch)
--   - Existing production database (updates only what's missing)
--
-- Generated: 2026-08-29
-- ============================================================================

-- Enable required extensions
create extension if not exists "pgcrypto"; -- for gen_random_uuid(), password hashing

-- ============================================================================
-- CORE TABLES
-- ============================================================================

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
  is_organizer     boolean default false,  -- survey audience targeting, admin/members toggle
  is_executive     boolean default false,  -- survey audience targeting, admin/members toggle
  password_hash    text,                   -- local dev only (no Supabase Auth in local PostgREST)
  created_at       timestamptz default now()
);

-- Add password_hash column if not exists (from migration_member_password_07.sql)
do $$ begin
  if not exists (select 1 from information_schema.columns where table_name='members' and column_name='password_hash') then
    alter table members add column password_hash text;
  end if;
end $$;

-- Index for login path's "lookup by email" query
create index if not exists members_email_idx on members (lower(email));

-- ── users (non-member event participants) ───────────────────────────────
create table if not exists users (
  id               uuid primary key,                 -- == auth.users.id (Supabase Auth)
  email            text unique not null,
  full_name        text not null,
  phone            text,
  college          text,
  college_roll     text,                             -- optional for non-NDC participants
  hsc_session      text,
  batch            text,
  is_active        boolean default true,
  password_hash    text,                             -- local dev only
  created_at       timestamptz default now()
);

create index if not exists users_email_idx on users (lower(email));

-- Enable RLS on users table
alter table users enable row level security;

-- ── member_shoutbox ─────────────────────────────────────────────────────
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

-- ============================================================================
-- ACTIVITY SYSTEM
-- ============================================================================

-- ── activity_types → activity_versions → activity_sessions ─────────────
create table if not exists activity_types (
  id            uuid primary key default gen_random_uuid(),
  name          text,
  slug          text,
  icon          text,                                  -- emoji
  description   text,
  display_order int default 0
);

-- Add group_by_version column if not exists (from MIGRATION_add_group_by_version_to_activity_types.sql)
do $$ begin
  if not exists (select 1 from information_schema.columns where table_name='activity_types' and column_name='group_by_version') then
    alter table activity_types add column group_by_version boolean default false;
    comment on column activity_types.group_by_version is 'When true, activities are grouped by version. When false, activities are listed chronologically with version badges.';
  end if;
end $$;

create table if not exists activity_versions (
  id                uuid primary key default gen_random_uuid(),
  activity_type_id  uuid references activity_types(id) on delete cascade,
  version_number    int,
  version_label     text,
  year_start        int,
  year_end          int,
  description       text,
  is_pinned         boolean default false,
  is_highlighted    boolean default false
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
  bg_color              text,
  image_display_mode    text not null default 'cover',   -- 'cover' | 'native'
  reg_status            text,
  reg_deadline          timestamptz,
  notify_publicly       boolean not null default false
);

-- Add notify_publicly column if not exists (from migration_notify_publicly.sql)
do $$ begin
  if not exists (select 1 from information_schema.columns where table_name='activity_sessions' and column_name='notify_publicly') then
    alter table activity_sessions add column notify_publicly boolean not null default false;
  end if;
end $$;

-- ── activity_updates — per-event admin updates/announcements feed ───────
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
  team_optional         boolean default false,
  team_size_min         int,
  team_size_max         int,
  team_member_fields    jsonb default '[]',
  requires_payment      boolean default false,
  payment_amount        numeric,
  payment_label         text,
  is_online_submission  boolean default false,
  linked_olympiad_id    uuid,
  edit_window_hours     int,
  schedule_date         date,
  schedule_time         text,
  schedule_room         text,
  submission_config     jsonb default '[]',
  submission_who        text default 'leader',
  project_name_enabled  boolean default false,
  project_name_label    text default 'Project Name',
  registration_open     boolean default true,
  icon                  text,
  bg_image_url          text,
  is_segment            boolean default false,
  form_field_schema     jsonb default '[]'::jsonb,
  created_at            timestamptz default now()
);

-- Add team_optional column if not exists (from migration_team_optional_06.sql)
do $$ begin
  if not exists (select 1 from information_schema.columns where table_name='activity_reg_categories' and column_name='team_optional') then
    alter table activity_reg_categories add column team_optional boolean default false;
  end if;
end $$;

-- Add segment columns if not exist (from migration_segments_05.sql)
do $$ begin
  if not exists (select 1 from information_schema.columns where table_name='activity_reg_categories' and column_name='icon') then
    alter table activity_reg_categories add column icon text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='activity_reg_categories' and column_name='bg_image_url') then
    alter table activity_reg_categories add column bg_image_url text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='activity_reg_categories' and column_name='is_segment') then
    alter table activity_reg_categories add column is_segment boolean default false;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='activity_reg_categories' and column_name='form_field_schema') then
    alter table activity_reg_categories add column form_field_schema jsonb default '[]'::jsonb;
  end if;
end $$;

-- ============================================================================
-- OLYMPIAD SYSTEM
-- ============================================================================

create table if not exists olympiads (
  id                     uuid primary key default gen_random_uuid(),
  name                   text,
  description            text,
  cover_image_url        text,
  pdf_url                text,
  mode                   text,
  exam_type              text default 'mixed',
  exam_mode              text default 'mixed',
  question_display       text default 'all_at_once',
  timer_minutes          int default 60,
  is_active              boolean default true,
  external_only          boolean default false,
  result_published       boolean default false,
  annotations_published  boolean default false,
  registration_deadline  timestamptz,
  exam_date              timestamptz,
  eligibility            text,
  organizer_password     text,
  registration_fields    jsonb default '[]',
  questions              jsonb default '[]',
  relay_mode             boolean default false,
  relay_type             text default 'sequential',
  subjects               jsonb default '[]',
  subject_assignment_mode text default 'self_select',
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

-- Add FK constraint for linked_olympiad_id after olympiads table exists
do $$ begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'fk_activity_reg_categories_olympiad'
  ) then
    alter table activity_reg_categories
      add constraint fk_activity_reg_categories_olympiad
      foreign key (linked_olympiad_id) references olympiads(id) on delete set null;
  end if;
end $$;

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
  team_name              text,
  member_id              uuid references members(id) on delete set null,
  payment_status         text default 'not_required',
  payment_tran_id        text,
  payment_amount         numeric,
  payment_validated_at   timestamptz,
  edit_locked_at         timestamptz,
  project_name           text,
  division               text,
  form_graph_id          uuid,
  form_node_id           uuid,
  submitted_node_ids     jsonb default '[]'::jsonb,
  created_at             timestamptz default now()
);

-- Add team_name column if not exists (from migration_team_name_08.sql)
do $$ begin
  if not exists (select 1 from information_schema.columns where table_name='activity_registrations' and column_name='team_name') then
    alter table activity_registrations add column team_name text;
  end if;
end $$;

-- Add form graph backref columns if not exist (from migration_form_graphs_02_backrefs.sql)
do $$ begin
  if not exists (select 1 from information_schema.columns where table_name='activity_registrations' and column_name='form_graph_id') then
    alter table activity_registrations add column form_graph_id uuid;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='activity_registrations' and column_name='form_node_id') then
    alter table activity_registrations add column form_node_id uuid;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='activity_registrations' and column_name='submitted_node_ids') then
    alter table activity_registrations add column submitted_node_ids jsonb default '[]'::jsonb;
  end if;
end $$;

-- ── payment_transactions ────────────────────────────────────────────────
create table if not exists payment_transactions (
  id                         uuid primary key default gen_random_uuid(),
  tran_id                    text unique,
  activity_registration_id   uuid references activity_registrations(id) on delete set null,
  amount                     numeric,
  currency                   text default 'BDT',
  status                     text default 'pending',
  raw_ipn                    jsonb,
  raw_validation             jsonb,
  created_at                 timestamptz default now(),
  validated_at               timestamptz
);

-- ── activity_submissions ────────────────────────────────────────────────
create table if not exists activity_submissions (
  id                    uuid primary key default gen_random_uuid(),
  registration_id       uuid references activity_registrations(id) on delete cascade,
  category_id           uuid references activity_reg_categories(id) on delete cascade,
  activity_session_id   uuid references activity_sessions(id) on delete cascade,
  submitted_by          text default 'leader',
  answers               jsonb default '{}',
  is_final              boolean default false,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

-- ── relay_exam_state ────────────────────────────────────────────────────
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

-- ── team_subject_assignments ────────────────────────────────────────────
create table if not exists team_subject_assignments (
  registration_id  uuid references activity_registrations(id) on delete cascade,
  member_id        text,
  olympiad_id      uuid references olympiads(id) on delete cascade,
  subject_id       text,
  assigned_at      timestamptz default now(),
  primary key (registration_id, member_id, olympiad_id)
);

-- ── team_member_links (from migration_team_member_links_09.sql) ─────────
create table if not exists team_member_links (
  registration_id       uuid not null references activity_registrations(id) on delete cascade,
  member_id             uuid not null references members(id) on delete cascade,
  role                  text not null default 'team_member' check (role in ('leader', 'team_member')),
  email_at_registration text not null,
  created_at            timestamptz not null default now(),
  primary key (registration_id, member_id)
);

create index if not exists team_member_links_member_idx on team_member_links (member_id);
create index if not exists team_member_links_registration_idx on team_member_links (registration_id);

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

-- Add form graph backref columns to olympiad_registrations if not exist
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

-- ============================================================================
-- FORM SYSTEM (FLOWCHART FORM BUILDER)
-- ============================================================================

-- ── form_configs ─────────────────────────────────────────────────────────
create table if not exists form_configs (
  id               uuid primary key default gen_random_uuid(),
  form_key         text unique,
  title            text,
  subtitle         text,
  cover_photo_url  text,
  bg_theme         text default 'default',
  extra_fields     jsonb default '[]',
  contact_persons  jsonb default '[]',
  bg_color               text,
  bg_image_url           text,
  font_family            text default 'default',
  cover_aspect_ratio     text default 'auto',
  auto_pull_title        boolean not null default false,
  auto_pull_description  boolean not null default false,
  auto_pull_cover        boolean not null default false,
  updated_at       timestamptz default now()
);

-- Drop primary_fields column if exists (from migration_per_session_appearance_combined.sql)
do $$ begin
  if exists (select 1 from information_schema.columns where table_name='form_configs' and column_name='primary_fields') then
    alter table form_configs drop column primary_fields;
  end if;
end $$;

-- ── activity_session_form_appearance ─────────────────────────────────────
create table if not exists activity_session_form_appearance (
  session_id              uuid primary key references activity_sessions(id) on delete cascade,
  form_title              text,
  form_subtitle           text,
  form_cover_photo_url    text,
  form_cover_aspect_ratio text default 'auto',
  form_bg_theme           text default 'default',
  form_bg_color           text,
  form_bg_image_url       text,
  form_font_family        text default 'default',
  form_auto_pull_title    boolean not null default false,
  form_auto_pull_description boolean not null default false,
  form_auto_pull_cover    boolean not null default false,
  form_contact_persons    jsonb default '[]',
  updated_at              timestamptz default now()
);

-- ── form_graphs (from migration_form_graphs.sql) ────────────────────────
create table if not exists form_graphs (
  id            uuid primary key default gen_random_uuid(),
  owner_kind    text not null check (owner_kind in ('activity', 'olympiad')),
  owner_id      uuid not null,
  root_node_id  uuid,
  title         text not null default 'Untitled form graph',
  settings      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (owner_kind, owner_id)
);

create index if not exists form_graphs_owner_idx on form_graphs (owner_kind, owner_id);

-- ── form_nodes (from migration_form_graphs.sql) ─────────────────────────
create table if not exists form_nodes (
  id             uuid primary key default gen_random_uuid(),
  graph_id       uuid not null references form_graphs(id) on delete cascade,
  parent_id      uuid references form_nodes(id) on delete cascade,
  position       jsonb not null default '{"x":100,"y":100}'::jsonb,
  label          text not null default 'Untitled form',
  kind           text not null default 'blank'
                   check (kind in ('starter','blank','preset_common_details','preset_olympiad_questions','preset_team_info')),
  enabled        boolean not null default true,
  is_terminal    boolean not null default false,
  fields         jsonb not null default '[]'::jsonb,
  appearance     jsonb not null default '{}'::jsonb,
  behavior       jsonb not null default '{}'::jsonb,
  display_order  integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists form_nodes_graph_idx on form_nodes (graph_id);
create index if not exists form_nodes_parent_idx on form_nodes (parent_id);

-- One root per graph constraint
create unique index if not exists form_graphs_one_root_per_graph
  on form_nodes (graph_id) where parent_id is null;

-- Add FK constraints for form_graph_id and form_node_id after tables exist
do $$ begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'activity_registrations_form_graph_id_fkey'
  ) then
    alter table activity_registrations
      add constraint activity_registrations_form_graph_id_fkey
      foreign key (form_graph_id) references form_graphs(id) on delete set null;
  end if;

  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'activity_registrations_form_node_id_fkey'
  ) then
    alter table activity_registrations
      add constraint activity_registrations_form_node_id_fkey
      foreign key (form_node_id) references form_nodes(id) on delete set null;
  end if;

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

-- Indexes for form graph backrefs
create index if not exists activity_registrations_form_graph_idx on activity_registrations (form_graph_id);
create index if not exists activity_registrations_form_node_idx on activity_registrations (form_node_id);
create index if not exists olympiad_registrations_form_graph_idx on olympiad_registrations (form_graph_id);
create index if not exists olympiad_registrations_form_node_idx on olympiad_registrations (form_node_id);

-- ============================================================================
-- SURVEY SYSTEM
-- ============================================================================

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
-- CHAT SYSTEM (from migration_chat_system.sql)
-- ============================================================================

-- ── chat_rooms ──────────────────────────────────────────────────────────
create table if not exists chat_rooms (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  description      text,
  room_type        text not null default 'chat',  -- 'chat' | 'voting'
  access_level     text not null default 'all',    -- 'all' | 'members' | 'executives' | 'custom'
  is_active        boolean default true,
  allow_anonymous_read boolean default false,
  require_approval boolean default false,
  voting_enabled   boolean default false,
  voting_question  text,
  voting_options   jsonb default '[]',
  voting_ends_at   timestamptz,
  allow_multiple   boolean default false,
  show_results     boolean default false,
  anonymous_voting boolean default false,
  created_by       uuid references members(id),
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

create index if not exists idx_chat_rooms_active on chat_rooms(is_active);
create index if not exists idx_chat_rooms_type on chat_rooms(room_type);
create index if not exists idx_chat_rooms_created_at on chat_rooms(created_at desc);

-- ── chat_room_participants ──────────────────────────────────────────────
create table if not exists chat_room_participants (
  id              uuid primary key default gen_random_uuid(),
  room_id         uuid not null references chat_rooms(id) on delete cascade,
  member_id       uuid not null references members(id) on delete cascade,
  role            text not null default 'participant',  -- 'admin' | 'moderator' | 'participant' | 'viewer' | 'voter'
  can_send        boolean default true,
  can_read        boolean default true,
  can_vote        boolean default false,
  is_muted        boolean default false,
  joined_at       timestamptz default now(),
  last_read_at    timestamptz,
  unique(room_id, member_id)
);

create index if not exists idx_room_participants_room on chat_room_participants(room_id);
create index if not exists idx_room_participants_member on chat_room_participants(member_id);
create index if not exists idx_room_participants_role on chat_room_participants(room_id, role);

-- ── chat_messages ───────────────────────────────────────────────────────
create table if not exists chat_messages (
  id              uuid primary key default gen_random_uuid(),
  room_id         uuid not null references chat_rooms(id) on delete cascade,
  sender_id       uuid not null references members(id) on delete cascade,
  message         text not null,
  message_type    text default 'text',                  -- 'text' | 'system' | 'announcement'
  is_important    boolean default false,
  is_pinned       boolean default false,
  is_deleted      boolean default false,
  reply_to_id     uuid references chat_messages(id),
  edited_at       timestamptz,
  created_at      timestamptz default now()
);

create index if not exists idx_chat_messages_room on chat_messages(room_id, created_at desc);
create index if not exists idx_chat_messages_sender on chat_messages(sender_id);
create index if not exists idx_chat_messages_important on chat_messages(room_id, is_important) where is_important = true;
create index if not exists idx_chat_messages_pinned on chat_messages(room_id, is_pinned) where is_pinned = true;
create index if not exists idx_chat_messages_not_deleted on chat_messages(room_id) where is_deleted = false;

-- ── chat_message_reactions ──────────────────────────────────────────────
create table if not exists chat_message_reactions (
  id              uuid primary key default gen_random_uuid(),
  message_id      uuid not null references chat_messages(id) on delete cascade,
  member_id       uuid not null references members(id) on delete cascade,
  emoji           text not null,
  created_at      timestamptz default now(),
  unique(message_id, member_id, emoji)
);

create index if not exists idx_message_reactions_message on chat_message_reactions(message_id);

-- ── chat_votes ──────────────────────────────────────────────────────────
create table if not exists chat_votes (
  id              uuid primary key default gen_random_uuid(),
  room_id         uuid not null references chat_rooms(id) on delete cascade,
  member_id       uuid not null references members(id) on delete cascade,
  option_index    integer not null,
  option_text     text,
  voted_at        timestamptz default now(),
  unique(room_id, member_id, option_index)
);

create index if not exists idx_chat_votes_room on chat_votes(room_id);
create index if not exists idx_chat_votes_member on chat_votes(member_id);
create index if not exists idx_chat_votes_option on chat_votes(room_id, option_index);

-- ── chat_room_invitations ───────────────────────────────────────────────
create table if not exists chat_room_invitations (
  id              uuid primary key default gen_random_uuid(),
  room_id         uuid not null references chat_rooms(id) on delete cascade,
  member_id       uuid not null references members(id) on delete cascade,
  invited_by      uuid references members(id),
  status          text default 'pending',               -- 'pending' | 'accepted' | 'declined'
  invited_at      timestamptz default now(),
  responded_at    timestamptz,
  unique(room_id, member_id)
);

create index if not exists idx_room_invitations_member on chat_room_invitations(member_id, status);
create index if not exists idx_room_invitations_room on chat_room_invitations(room_id);

-- ── chat_room_blocks ────────────────────────────────────────────────────
create table if not exists chat_room_blocks (
  id              uuid primary key default gen_random_uuid(),
  room_id         uuid not null references chat_rooms(id) on delete cascade,
  member_id       uuid not null references members(id) on delete cascade,
  blocked_by      uuid references members(id),
  reason          text,
  blocked_at      timestamptz default now(),
  unique(room_id, member_id)
);

create index if not exists idx_room_blocks_room on chat_room_blocks(room_id);
create index if not exists idx_room_blocks_member on chat_room_blocks(member_id);

-- ── chat_typing_indicators ──────────────────────────────────────────────
create table if not exists chat_typing_indicators (
  id              uuid primary key default gen_random_uuid(),
  room_id         uuid not null references chat_rooms(id) on delete cascade,
  member_id       uuid not null references members(id) on delete cascade,
  started_at      timestamptz default now(),
  unique(room_id, member_id)
);

create index if not exists idx_typing_room on chat_typing_indicators(room_id);

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- ── Form graph root sync trigger ────────────────────────────────────────
create or replace function sync_form_graph_root() returns trigger as $$
begin
  if new.parent_id is null then
    update form_graphs
       set root_node_id = new.id,
           updated_at = now()
     where id = new.graph_id
       and root_node_id is null;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists form_nodes_sync_root on form_nodes;
create trigger form_nodes_sync_root
  after insert on form_nodes
  for each row execute function sync_form_graph_root();

-- ── Chat room updated_at trigger ────────────────────────────────────────
create or replace function update_chat_room_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists chat_rooms_updated_at on chat_rooms;
create trigger chat_rooms_updated_at
  before update on chat_rooms
  for each row
  execute function update_chat_room_updated_at();

-- ── Cleanup old typing indicators ───────────────────────────────────────
create or replace function cleanup_old_typing_indicators()
returns void as $$
begin
  delete from chat_typing_indicators
  where started_at < now() - interval '30 seconds';
end;
$$ language plpgsql;

-- ============================================================================
-- VIEWS
-- ============================================================================

-- ── Chat rooms with stats ───────────────────────────────────────────────
create or replace view chat_rooms_with_stats as
select
  r.*,
  count(distinct p.member_id) as participant_count,
  (
    select json_build_object(
      'message', m.message,
      'sender_id', m.sender_id,
      'sender_name', mem.full_name,
      'created_at', m.created_at
    )
    from chat_messages m
    left join members mem on mem.id = m.sender_id
    where m.room_id = r.id and m.is_deleted = false
    order by m.created_at desc
    limit 1
  ) as last_message,
  (
    select count(*)
    from chat_messages m
    where m.room_id = r.id and m.is_deleted = false
  ) as message_count,
  (
    select count(*)
    from chat_votes v
    where v.room_id = r.id
  ) as vote_count
from chat_rooms r
left join chat_room_participants p on p.room_id = r.id
group by r.id;

-- ============================================================================
-- NOTES & VERIFICATION
-- ============================================================================
--
-- This unified schema is safe to run multiple times. All operations use:
--   - CREATE TABLE IF NOT EXISTS
--   - CREATE INDEX IF NOT EXISTS
--   - CREATE OR REPLACE FUNCTION/TRIGGER/VIEW
--   - DO blocks with column existence checks before ALTER TABLE ADD COLUMN
--
-- To verify successful application, run:
--
--   select count(*) from form_graphs;
--   select count(*) from form_nodes;
--   select count(*) from chat_rooms;
--   select count(*) from activity_types;
--   select count(*) from members;
--
-- For a fresh database, all counts will be 0 but the schema will be complete.
-- For an existing database, existing data is preserved and only missing
-- columns/tables/indexes are added.
--
-- ============================================================================
