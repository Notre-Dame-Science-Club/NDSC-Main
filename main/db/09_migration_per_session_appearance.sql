-- One-shot migration: split per-event appearance out of `form_configs`
-- into the new `activity_session_form_appearance` table.
--
-- Background: the activity-registration admin's Appearance tab used to
-- deep-link into /admin/forms?key=activity_register:<sessionId>, which held
-- a full form builder (FormBlocksBuilder + a hardcoded primary_fields
-- editor) for the same thing the per-segment form_field_schema editor
-- already covers. The redundancy was removed by moving per-event
-- appearance (title/subtitle/cover/bg/font/auto-pull toggles/contact
-- persons) onto the new 1:1 table, and editing it inline in the Appearance
-- tab. form_configs itself is kept for the GLOBAL `activity_register`,
-- `olympiad_register`, and `membership` rows.
--
-- Run in this order:
--   1. Apply db/schema.sql's new table definition (already in the merged
--      schema; if you have an older instance, create the table first).
--   2. Run this file's INSERT (below). It is idempotent (ON CONFLICT DO
--      NOTHING) so it's safe to re-run.
--   3. Verify the row counts match: see the SELECT after the INSERT.
--   4. Once verified, run the DELETE at the bottom (currently left
--      commented out on purpose — don't run it without first opening
--      /admin/activity-registration on at least one event and confirming
--      the appearance editor reads back the values you set on the
--      form_configs row).

insert into activity_session_form_appearance (
  session_id,
  form_title,
  form_subtitle,
  form_cover_photo_url,
  form_cover_aspect_ratio,
  form_bg_theme,
  form_bg_color,
  form_bg_image_url,
  form_font_family,
  form_auto_pull_title,
  form_auto_pull_description,
  form_auto_pull_cover,
  form_contact_persons
)
select
  split_part(form_key, ':', 2)::uuid as session_id,
  title                                as form_title,
  subtitle                             as form_subtitle,
  cover_photo_url                      as form_cover_photo_url,
  cover_aspect_ratio                   as form_cover_aspect_ratio,
  bg_theme                             as form_bg_theme,
  bg_color                             as form_bg_color,
  bg_image_url                         as form_bg_image_url,
  font_family                          as form_font_family,
  coalesce(auto_pull_title, false)     as form_auto_pull_title,
  coalesce(auto_pull_description, false) as form_auto_pull_description,
  coalesce(auto_pull_cover, false)     as form_auto_pull_cover,
  contact_persons                      as form_contact_persons
from form_configs
where form_key like 'activity_register:%'
on conflict (session_id) do nothing;

-- ── Verify: should be 0 (every per-event form_config backfilled cleanly) ──
-- select count(*) as unbackfilled
-- from form_configs fc
-- where fc.form_key like 'activity_register:%'
--   and not exists (
--     select 1 from activity_session_form_appearance a
--     where a.session_id = split_part(fc.form_key, ':', 2)::uuid
--   );

-- ── After verification, drop the legacy rows ──
-- delete from form_configs where form_key like 'activity_register:%';
