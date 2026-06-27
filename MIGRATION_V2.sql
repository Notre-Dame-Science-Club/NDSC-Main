-- ============================================================
-- NDSC Olympiad Platform — Full Schema Migration
-- Run this in Supabase SQL Editor
-- ============================================================

-- Add new columns to olympiads table
ALTER TABLE public.olympiads
  ADD COLUMN IF NOT EXISTS exam_mode text DEFAULT 'mixed',
  -- 'one_by_one' | 'all_at_once' — question display mode
  ADD COLUMN IF NOT EXISTS question_display text DEFAULT 'all_at_once',
  ADD COLUMN IF NOT EXISTS timer_minutes integer DEFAULT 60,
  ADD COLUMN IF NOT EXISTS result_published boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS annotations_published boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS registration_fields jsonb DEFAULT '[]'::jsonb;
  -- registration_fields replaces custom_fields, adds mandatory field config

-- Drop old mode column constraint and update it  
-- (mode column already exists, just adding new question types)

-- Add new columns to olympiad_registrations
ALTER TABLE public.olympiad_registrations
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS hsc_session text,
  ADD COLUMN IF NOT EXISTS short_answers jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS photo_answers jsonb DEFAULT '[]'::jsonb,
  -- array of { question_id, url } for per-question photo uploads
  ADD COLUMN IF NOT EXISTS exam_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS exam_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS annotations jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS organizer_note text,
  ADD COLUMN IF NOT EXISTS result_score integer,
  ADD COLUMN IF NOT EXISTS result_feedback text;
