-- Site-wide Appearance settings (Admin > Appearance)
-- Run this in the Supabase SQL editor (same as schema_update_01.sql / 03.sql).
-- Same key/value shape as homepage_settings.

create table if not exists appearance_settings (
  key         text primary key,
  value       text not null default '',
  updated_at  timestamptz not null default now()
);
