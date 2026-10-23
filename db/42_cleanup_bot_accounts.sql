-- 42_cleanup_bot_accounts.sql
-- Review-first cleanup of the bot accounts created through /api/auth/register
-- on 2026-10-21/22. DO NOT RUN THE WHOLE FILE AT ONCE. Run section by section in
-- the Supabase SQL editor and look at the numbers before moving on.
-- Take a backup first (Supabase -> Database -> Backups, or the CREATE TABLE below).

-- ── 0. Safety copy ───────────────────────────────────────────────────────
create table if not exists backup_users_before_bot_cleanup as table users;

-- ── 1. When did the flood start? (accounts created per hour, last 3 days) ─
select date_trunc('hour', created_at) as hour, count(*) as signups
from users
where created_at > now() - interval '3 days'
group by 1 order by 1;
-- Pick the hour where the count jumps from "normal" (a few per hour) to hundreds
-- or thousands. Put that timestamp into :cutoff below (UTC).

-- ── 2. Look at the suspicious rows ───────────────────────────────────────
-- Replace the timestamp with your cutoff.
select email, full_name, institution, phone, created_at
from users
where created_at >= '2026-10-21 00:00:00+00'      -- <- your cutoff
order by created_at
limit 100;

-- Which email domains / institutions dominate the flood?
select split_part(email, '@', 2) as domain, count(*) c
from users where created_at >= '2026-10-21 00:00:00+00'
group by 1 order by c desc limit 20;

-- ── 3. Build the delete list (nothing is deleted yet) ────────────────────
-- A flood account is deleted only if it is after the cutoff AND has no
-- membership application AND is not an NDC-batch roll holder AND did nothing
-- on the site. Add the other tables that hold user activity in your schema
-- (activity/olympiad registrations, team members, messages …) as extra
-- "not exists" lines — a real person who registered during those hours must
-- never be deleted.
create temp table bot_candidates as
select u.id
from users u
where u.created_at >= '2026-10-21 00:00:00+00'    -- <- your cutoff
  and coalesce(u.college_roll, '') = ''
  and not exists (select 1 from membership_applications a where a.user_id = u.id)
  -- and not exists (select 1 from <activity_registrations_table> r where r.user_id = u.id)
  -- and not exists (select 1 from <team_members_table> t where t.user_id = u.id)
;
select count(*) from bot_candidates;               -- sanity check: ~24k expected

-- ── 4. Delete (only after steps 1-3 look right) ──────────────────────────
-- delete from users       where id in (select id from bot_candidates);
-- delete from auth.users  where id in (select id from bot_candidates);
-- If it times out, repeat with "limit 2000" batches:
--   delete from auth.users where id in (select id from bot_candidates limit 2000);
