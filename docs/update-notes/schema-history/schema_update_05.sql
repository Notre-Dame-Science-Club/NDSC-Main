-- ARCHIVED (2026-07-17 cleanup) — historical only. Folded into db/schema.sql.
-- Do not run this file directly; it may conflict with or duplicate the merged schema.

-- Task 1 (Activity Update) additions
-- Run this in the Supabase SQL editor (same as schema_update_01/03/04.sql).
-- Purely additive — no existing column is renamed, retyped, or dropped.

-- ── 1.1 — statement-site images: per-session opt-in to native aspect ratio
-- instead of the fixed "event cover" box. Default keeps existing event-image
-- behavior unchanged for every session that doesn't explicitly opt in.
alter table activity_sessions
  add column if not exists image_display_mode text not null default 'cover';
  -- 'cover'  = existing behavior, fixed box, object-fit: cover (events)
  -- 'native' = render at the image's own upload aspect ratio (statement sites, posters, A4 docs)

-- ── 1.6 — deadline & status, read by the user-facing dashboard (1.4)
alter table activity_sessions
  add column if not exists reg_status text,          -- e.g. Open | Closed | Judging | Results Out (admin-defined label, free text)
  add column if not exists reg_deadline timestamptz;  -- shown as a countdown/date on the dashboard

-- ── 1.2 — "Science Under" grouping: pin a version to the top of its
-- activity-type's list and give it distinct highlighted styling. Not
-- name-matched — any version can be pinned, "Science Under" is just the
-- first one admin will flag this way.
alter table activity_versions
  add column if not exists is_pinned boolean not null default false,
  add column if not exists is_highlighted boolean not null default false;

-- ── 1.7 — per-event admin updates/announcements feed
create table if not exists activity_updates (
  id                    uuid primary key default gen_random_uuid(),
  activity_session_id   uuid not null references activity_sessions(id) on delete cascade,
  title                 text not null,
  body                  text not null default '',
  link_url              text,
  created_at            timestamptz not null default now()
);
create index if not exists idx_activity_updates_session on activity_updates(activity_session_id);

-- ── 1.3a — registration-form appearance pipeline (background, font, cover
-- ratio, auto-pull-from-event toggles). Extends the existing form_configs
-- key/value-per-form_key table — same table used by /admin/forms already.
alter table form_configs
  add column if not exists bg_color text,             -- solid/gradient CSS background for the form page
  add column if not exists bg_image_url text,          -- background image, tiled/cover behind the form
  add column if not exists font_family text default 'default', -- 'default' | 'orbitron' | 'rajdhani' | 'jakarta' | 'mono'
  add column if not exists cover_aspect_ratio text default 'auto', -- 'auto' (native upload ratio) | '16/9' | '4/3' | '1/1' | '21/9'
  add column if not exists auto_pull_title boolean not null default false,
  add column if not exists auto_pull_description boolean not null default false,
  add column if not exists auto_pull_cover boolean not null default false;
