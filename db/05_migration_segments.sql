-- Segment-driven event registration (V8)
-- Run this in the Supabase SQL editor.
--
-- Adds per-category segment metadata (icon, bg image, is_segment flag) and a unified
-- form_field_schema jsonb column on activity_reg_categories. form_field_schema is
-- the single source of truth for registration fields per segment — replacing the
-- previous form_configs.primary_fields + custom_fields + activity_reg_categories.custom_fields
-- three-way split.
--
-- Additive only: nothing is dropped, nothing is renamed. Existing rows are backfilled.

alter table activity_reg_categories
  add column if not exists icon text,
  add column if not exists bg_image_url text,
  add column if not exists is_segment boolean default false,
  add column if not exists form_field_schema jsonb default '[]'::jsonb;

-- Backfill form_field_schema for existing rows so the new editor has something to
-- show on first open.
--
-- Strategy:
--   - If the row already has custom_fields, migrate them into form_field_schema
--     verbatim (their shape is already compatible).
--   - Otherwise, seed the 7 built-in defaults (admin can still delete them in the UI).
--
-- The seven built-in field_key values match the top-level columns on
-- activity_registrations (full_name, phone, email, college, college_roll,
-- hsc_session, division) so the server can write answers directly into those
-- columns when the field is marked is_builtin.
update activity_reg_categories
set form_field_schema = case
  when jsonb_array_length(coalesce(custom_fields, '[]'::jsonb)) > 0
    then coalesce(custom_fields, '[]'::jsonb)
  else
    '[
      {"key":"full_name","type":"text","label":"Full Name","description":"","required":true,"is_builtin":"full_name","db_column":"top_level"},
      {"key":"phone","type":"text","label":"Phone Number","description":"","required":true,"is_builtin":"phone","db_column":"top_level"},
      {"key":"email","type":"text","label":"Email Address","description":"","required":true,"is_builtin":"email","db_column":"top_level"},
      {"key":"college","type":"text","label":"College","description":"","required":false,"is_builtin":"college","db_column":"top_level","placeholder":"Notre Dame College"},
      {"key":"college_roll","type":"text","label":"College Roll","description":"","required":true,"is_builtin":"college_roll","db_column":"top_level"},
      {"key":"hsc_session","type":"text","label":"HSC Session","description":"","required":false,"is_builtin":"hsc_session","db_column":"top_level","placeholder":"e.g. 2024-25"},
      {"key":"division","type":"text","label":"Division","description":"","required":false,"is_builtin":"division","db_column":"top_level","placeholder":"e.g. Dhaka"}
    ]'::jsonb
end
where form_field_schema is null or jsonb_array_length(form_field_schema) = 0;
