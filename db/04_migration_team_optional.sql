-- Optional team support for activity segments / categories.
-- Run this in the Supabase SQL editor.
--
-- Adds team_optional boolean: when requires_team = true AND team_optional = true,
-- a registrant may submit solo (0 team members) OR with a team. When
-- requires_team = false, this flag is ignored.
--
-- Additive only. Existing rows default to false (current behavior preserved).

alter table activity_reg_categories
  add column if not exists team_optional boolean default false;
