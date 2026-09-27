-- Migration: Add Stage to Achievements
-- Date: 2026-09-08
-- Description: Add stage field to achievements for lifecycle organization

-- Add stage field to achievement structure
-- Note: achievements is stored as JSONB array in members table
-- This migration documents the new schema structure

-- Achievement structure (stored in members.achievements JSONB):
-- {
--   id: string
--   title: string
--   description: string
--   image_url: string
--   status: 'pending' | 'approved'
--   stage: 'member' | 'organizer' | 'executive' | 'alumni'  -- NEW FIELD
--   created_at: timestamp
-- }

-- No SQL migration needed since achievements are JSONB
-- The application code will handle the new stage field
-- Default to 'member' for achievements without explicit stage

COMMENT ON COLUMN members.achievements IS 'JSONB array of achievements. Each achievement should have: id, title, description, image_url, status, stage (member/organizer/executive/alumni), created_at';
