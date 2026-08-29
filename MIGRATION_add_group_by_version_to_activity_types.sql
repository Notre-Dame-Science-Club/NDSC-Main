-- Migration: Add group_by_version field to activity_types table
-- Date: 2026-08-27
-- Description: Adds a boolean field to control whether activities should be grouped by version or listed chronologically

-- Add the new column to activity_types table
ALTER TABLE activity_types
ADD COLUMN group_by_version BOOLEAN DEFAULT FALSE;

-- Update comment
COMMENT ON COLUMN activity_types.group_by_version IS 'When true, activities are grouped by version. When false, activities are listed chronologically with version badges.';

-- Example: Set podcast activity type to group by version (if it exists)
-- UPDATE activity_types SET group_by_version = TRUE WHERE slug = 'podcast';
