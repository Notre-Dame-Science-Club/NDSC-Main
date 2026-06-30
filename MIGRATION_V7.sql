-- ============================================================
-- NDSC Platform — MIGRATION V7 (registration-open toggle)
-- Run in Supabase SQL Editor after V6
-- SAFE TO RE-RUN — IF NOT EXISTS
-- ============================================================

-- Lets admin close registration for ANY node in the category tree — a leaf
-- (e.g. "Physics" stops accepting new sign-ups) or a primary field (e.g.
-- "Online" closes entirely, which closes every leaf underneath it too).
-- Checked at both levels at submit time: a leaf is open only if the leaf
-- itself AND every ancestor up to the root is also open.
ALTER TABLE public.activity_reg_categories
  ADD COLUMN IF NOT EXISTS registration_open boolean DEFAULT true;
