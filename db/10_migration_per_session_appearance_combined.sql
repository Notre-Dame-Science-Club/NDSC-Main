-- Combined one-shot migration: strip per-session form_configs into the new
-- activity_session_form_appearance table.
--
-- Run this in the Supabase SQL editor. It is safe to re-run; every step is
-- idempotent. After running, scroll to the result messages and confirm the
-- step 3 dry-run shows matching counts before running step 4 (which deletes).
--
-- Mirrors the plan at: C:\Users\mahmu\.claude\plans\whimsical-frolicking-muffin.md

-- ============================================================================
-- 1. Create the new 1:1 appearance table.
-- ============================================================================
create table if not exists activity_session_form_appearance (
  session_id uuid primary key references activity_sessions(id) on delete cascade,
  form_title text,
  form_subtitle text,
  form_cover_photo_url text,
  form_cover_aspect_ratio text default 'auto',
  form_bg_theme text default 'default',
  form_bg_color text,
  form_bg_image_url text,
  form_font_family text default 'default',
  form_auto_pull_title boolean default false,
  form_auto_pull_description boolean default false,
  form_auto_pull_cover boolean default false,
  form_contact_persons jsonb,
  updated_at timestamptz default now()
);

-- ============================================================================
-- 2. Drop the now-unused primary_fields column from form_configs.
--    (No live reader; replaced by the per-segment form_field_schema system.)
-- ============================================================================
alter table form_configs drop column if exists primary_fields;

-- ============================================================================
-- 3. Backfill: copy each per-session form_config row into the new table.
--    on conflict (session_id) do nothing makes this safe to re-run.
-- ============================================================================
insert into activity_session_form_appearance
  (session_id, form_title, form_subtitle, form_cover_photo_url, form_cover_aspect_ratio,
   form_bg_theme, form_bg_color, form_bg_image_url, form_font_family,
   form_auto_pull_title, form_auto_pull_description, form_auto_pull_cover,
   form_contact_persons)
select
  split_part(fc.form_key, ':', 2)::uuid,
  fc.title, fc.subtitle, fc.cover_photo_url, fc.cover_aspect_ratio,
  fc.bg_theme, fc.bg_color, fc.bg_image_url, fc.font_family,
  fc.auto_pull_title, fc.auto_pull_description, fc.auto_pull_cover,
  fc.contact_persons
from form_configs fc
where fc.form_key like 'activity_register:%'
  -- Skip orphans: form_configs rows whose session no longer exists in
  -- activity_sessions. These are unrecoverable and the delete in step 5
  -- will sweep them up.
  and exists (
    select 1 from activity_sessions s
     where s.id = split_part(fc.form_key, ':', 2)::uuid
  )
on conflict (session_id) do nothing;

-- ============================================================================
-- 4. DRY-RUN: verify the backfill landed.
--    The new table count SHOULD be <= the per-session form_configs count.
--    Any difference is orphan rows — form_configs whose session was deleted
--    at some point but whose config row was never cleaned up. These are
--    unrecoverable and step 5 will delete them.
--
--    To list orphans before the cleanup:
--      select fc.form_key
--        from form_configs fc
--       where fc.form_key like 'activity_register:%'
--         and not exists (
--           select 1 from activity_sessions s
--            where s.id = split_part(fc.form_key, ':', 2)::uuid
--         );
-- ============================================================================
select 'form_configs (per-session) total' as what, count(*) as n
  from form_configs where form_key like 'activity_register:%'
union all
select 'activity_session_form_appearance (backfilled)' as what, count(*) as n
  from activity_session_form_appearance
union all
select 'orphan form_configs (session missing)' as what, count(*) as n
  from form_configs fc
 where fc.form_key like 'activity_register:%'
   and not exists (
     select 1 from activity_sessions s
      where s.id = split_part(fc.form_key, ':', 2)::uuid
   );

-- ============================================================================
-- 5. CLEANUP: only run after you confirm the dry-run counts match AND have
--    spot-checked a few rows in the admin (Manage → Appearance on a few
--    events). Leave this commented out so the migration file is safe to
--    run as a whole.
-- ============================================================================
-- delete from form_configs where form_key like 'activity_register:%';
