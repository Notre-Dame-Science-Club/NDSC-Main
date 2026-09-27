-- Migration: Unified Stage System
-- Date: 2026-09-06
-- Description: Replace is_organizer, is_executive boolean flags with unified stage enum field

-- Step 1: Add stage column with default value
ALTER TABLE members ADD COLUMN IF NOT EXISTS stage text NOT NULL DEFAULT 'member';

-- Step 2: Backfill stage from existing boolean flags
-- Priority: executive > organizer > member
UPDATE members
SET stage = CASE
  WHEN is_executive = true THEN 'executive'
  WHEN is_organizer = true THEN 'organizer'
  ELSE 'member'
END;

-- Step 3: Add constraint to ensure only valid stage values
ALTER TABLE members ADD CONSTRAINT members_stage_check
  CHECK (stage IN ('member', 'organizer', 'executive', 'alumni'));

-- Step 4: Create index on stage for faster queries
CREATE INDEX IF NOT EXISTS idx_members_stage ON members(stage);

-- Step 5: Drop old boolean columns (clean migration)
ALTER TABLE members DROP COLUMN IF EXISTS is_organizer;
ALTER TABLE members DROP COLUMN IF EXISTS is_executive;

-- Verification queries (run manually to verify migration success):
-- SELECT stage, COUNT(*) FROM members GROUP BY stage;
-- SELECT * FROM members WHERE stage NOT IN ('member', 'organizer', 'executive', 'alumni');
