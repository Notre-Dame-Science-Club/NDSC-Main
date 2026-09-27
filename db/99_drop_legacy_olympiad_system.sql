-- Migration: Drop legacy olympiad_registrations table and related columns
-- This removes the old standalone olympiad registration system that has been
-- replaced by the unified form-graph based registration system.
--
-- ⚠️ DO NOT RUN THIS. Its own precondition #3 was false when it was written:
-- olympiad_registrations is NOT legacy. It's the live storage table for every
-- STANDALONE (non activity-linked) olympiad's registrations and exam answers,
-- written by the "isOlympiad" branch of app/api/public/form-graph/submit and
-- read by app/api/olympiad-register, app/api/organizer/registrations,
-- app/api/admin/olympiad-registrations, the registrations CSV export, the
-- leaderboard, member-history, identity-lookup, and more. Only
-- ACTIVITY-LINKED ("child") olympiads use activity_registrations instead —
-- "the form-graph based registration system" replaced the OLD
-- olympiads.questions / registration_fields columns (see migration 27), not
-- this table.
--
-- This file was actually run against the live database on this false
-- premise, which is why standalone-olympiad submissions started failing with
-- "Could not find the table 'public.olympiad_registrations' in the schema
-- cache". See db/30_migration_restore_olympiad_registrations.sql, which
-- re-creates the table. Do not run this file again until every route listed
-- above has genuinely been migrated off olympiad_registrations — see
-- db/README.md.
--
-- IMPORTANT: Run this ONLY after confirming:
-- 1. All olympiads are using the new form-graph system
-- 2. Any data from olympiad_registrations has been migrated to activity_registrations
-- 3. No production code references olympiad_registrations table
--
-- Idempotent: Safe to re-run (uses IF EXISTS)

-- Drop the legacy olympiad_registrations table
DROP TABLE IF EXISTS olympiad_registrations CASCADE;

-- Drop legacy columns from olympiads table that were replaced by form_graphs
ALTER TABLE olympiads
  DROP COLUMN IF EXISTS registration_fields,
  DROP COLUMN IF EXISTS questions;

-- Drop category_id from activity_registrations (points to deleted activity_reg_categories)
-- This column was already phased out by the form-graph migration
ALTER TABLE activity_registrations
  DROP COLUMN IF EXISTS category_id;

-- Drop category_id from activity_submissions as well
ALTER TABLE activity_submissions
  DROP COLUMN IF EXISTS category_id;

-- Note: activity_reg_categories table may have already been dropped in a previous migration.
-- Including it here for completeness:
DROP TABLE IF EXISTS activity_reg_categories CASCADE;
