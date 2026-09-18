-- Migration: Add user types & refactor member definition
-- Date: 2026-09-04

-- Add new columns for open student platform
ALTER TABLE members
  ADD COLUMN IF NOT EXISTS institution text,
  ADD COLUMN IF NOT EXISTS education_level text,
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS blood_group text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS secondary_phone text,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS membership_status text DEFAULT 'none';

-- Make college_roll nullable (only required for NDC club membership application)
ALTER TABLE members
  ALTER COLUMN college_roll DROP NOT NULL;

-- Backfill existing members
UPDATE members
SET
  institution = COALESCE(institution, 'Notre Dame College'),
  education_level = COALESCE(education_level, 'HSC'),
  membership_status = CASE
    WHEN is_verified = true THEN 'approved'
    WHEN payment_slip_url IS NOT NULL THEN 'pending'
    ELSE 'none'
  END
WHERE membership_status IS NULL OR membership_status = 'none';
