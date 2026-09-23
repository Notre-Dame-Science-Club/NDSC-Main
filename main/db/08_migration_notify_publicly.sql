-- schema_update_06.sql — "Notify publicly" popup for activity sessions
-- Run this once in the Supabase SQL editor against the live project.
-- Purely additive — no existing column is renamed, retyped, or dropped.
-- Already folded into db/schema.sql for fresh installs; this file is only
-- needed to bring an existing database up to date.

alter table activity_sessions
  add column if not exists notify_publicly boolean not null default false;
  -- When true, this session is eligible to show as a small popup to every
  -- site visitor on entry (cover image, title, short blurb, when it
  -- happens, and whether registration is open) — mirrors
  -- surveys.show_notification. Turn back off once the event has passed or
  -- you no longer want it advertised; ActivityNotification also self-expires
  -- it once the session's date is in the past, as a safety net.
