-- ============================================================================
-- Add a password column to the members table.
--
-- Why: the local dev stack runs plain PostgREST (no Supabase Auth / GoTrue),
-- so `supabase.auth.admin.createUser` doesn't work and there's no Auth
-- schema to store member passwords in. To make member registration +
-- login work end-to-end locally, we keep a hash of the password right
-- next to the rest of the member's profile in the `members` table.
--
-- The route handlers in /api/auth/* branch on SUPABASE_ENV: on prod they
-- still go through Supabase Auth; on local they read/write this column
-- instead. NEVER ship this column to a real Supabase project — the
-- production auth path uses GoTrue's auth.users, not this column.
--
-- We use pgcrypto's crypt() for the hash. dev-only secret for now, but
-- the column is the same shape any password store would expect, so when
-- (if) we ever add a real password store in prod this is one migration
-- to drop.
-- ============================================================================

create extension if not exists pgcrypto;

alter table members
  add column if not exists password_hash text;

-- Index for the local login path's "lookup by email" query.
create index if not exists members_email_idx on members (lower(email));
