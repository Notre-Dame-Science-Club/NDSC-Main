-- ============================================================================
-- Bridge team_members to real member accounts.
--
-- Why: a team event's team_members jsonb column on activity_registrations
-- captures the per-member data (name, email, phone, college_roll, password
-- hash, custom answers) but doesn't know whether the email actually maps
-- to an existing row in `members`. Until that link is recorded, the member
-- dashboard's `/api/member-activity-registrations` query can only return
-- events the member registered for *as leader* (member_id = X) — it can't
-- surface events they were added to as a team member, because the link
-- is implicit in the jsonb blob.
--
-- This table materializes that link: one row per (registration, member)
-- pair, with the role the member plays in that registration. Composite
-- primary key (registration_id, member_id) so a single member showing up
-- on the same registration twice (would be a bug) is impossible, and
-- the same member can link to many registrations.
--
-- email_at_registration: the value of team_members[i].email as captured
-- at write time. Kept as a denormalized snapshot so we can detect later
-- if a member's email changes (e.g. they update their profile) and decide
-- whether to re-link or unlink. Not authoritative — `members.email` is.
--
-- RLS: bypassed in this codebase (service-role writes via supabaseAdmin).
-- Local dev grants the same access to anon via PostgREST; production
-- has RLS on `members` and `activity_registrations` and an explicit
-- policy can be added on this table if/when read-time RLS becomes
-- necessary.
--
-- No backfill: existing team_member rows with no link are left as-is
-- (read-time code falls back to a runtime email lookup, see
-- /api/member-activity-registrations/route.ts). Re-submitting a
-- registration goes through the new write path and will create the
-- link then.
-- ============================================================================

create table if not exists team_member_links (
  registration_id uuid not null references activity_registrations(id) on delete cascade,
  member_id       uuid not null references members(id) on delete cascade,
  role            text not null default 'team_member'
                   check (role in ('leader', 'team_member')),
  email_at_registration text not null,
  created_at      timestamptz not null default now(),
  primary key (registration_id, member_id)
);

-- Two indexes, both covering the access patterns:
--   (1) by member_id  — dashboard "show me every event I'm on" query
--   (2) by registration_id — admin view of "who's on this team"
create index if not exists team_member_links_member_idx
  on team_member_links (member_id);
create index if not exists team_member_links_registration_idx
  on team_member_links (registration_id);
