-- ============================================================================
-- Add a users table for non-member event participants.
--
-- Why: The platform needs to support two types of authenticated accounts:
--   1. Members (NDSC club members) - already exists in `members` table
--   2. Users (event participants) - new table for olympiad/activity participants
--
-- Users can register for events and access their exam results/submissions
-- without going through the member verification workflow. This keeps the
-- member registration process focused on actual NDSC membership while
-- allowing event participation from any college.
--
-- Unlike members, users don't require payment slips or verification, and
-- their college_roll validation is less strict (not limited to NDC's 8-digit
-- format).
-- ============================================================================

create extension if not exists pgcrypto;

create table if not exists users (
  id               uuid primary key,                 -- == auth.users.id (Supabase Auth)
  email            text unique not null,
  full_name        text not null,
  phone            text,
  college          text,
  college_roll     text,                             -- optional for non-NDC participants
  hsc_session      text,
  batch            text,
  is_active        boolean default true,
  password_hash    text,                             -- local dev only, mirrors members.password_hash
  created_at       timestamptz default now()
);

-- Index for login path's "lookup by email" query
create index if not exists users_email_idx on users (lower(email));

-- Enable RLS (policies will match the member table's pattern: service_role bypasses)
alter table users enable row level security;
