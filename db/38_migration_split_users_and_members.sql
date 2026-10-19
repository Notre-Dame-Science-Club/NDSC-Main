-- Migration 38: split "everyone with an account" from "approved club members"
--
-- BEFORE: `members` held every website account (membership was just a status column),
--         and a second, almost-unused `users` table existed next to it.
-- AFTER:  users                  = every website account (id == Supabase auth.users.id)
--         membership_applications = "Become a member" requests (photo of the form, pending/approved/...)
--         members                = ONLY approved Notre Dame College club members
--
-- LOGINS ARE NOT TOUCHED. Passwords live in Supabase Auth (auth.users) and the user ids
-- do not change: the old `members` table is *renamed* to `users`, so every id, every
-- password_hash (local mode) and all 14 foreign keys (chat, shoutbox, registrations, ...)
-- keep working as-is.
--
-- Backups created: backup_members_pre_split, backup_users_pre_split (drop them later).
-- Safe to re-run: the rename step only happens once.
-- Run it ONCE on a staging copy / after a DB backup first.

begin;

do $$
begin
  -- Old-shape `members` has an `email` column; the new roster table does not.
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'members' and column_name = 'email') then

    create table if not exists backup_members_pre_split as table members;
    if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'users') then
      create table if not exists backup_users_pre_split as table users;
      alter index if exists users_email_idx rename to users_legacy_email_idx;
      alter table users rename to users_legacy;
    end if;

    alter table members rename to users;
    alter index if exists members_email_idx rename to users_email_idx;
  end if;
end $$;

-- Columns the old `users` table had that the old `members` table did not
alter table users add column if not exists hsc_session text;
alter table users add column if not exists is_active boolean not null default true;
alter table users add column if not exists membership_status text default 'none';
alter table users add column if not exists is_verified boolean default false;

-- Fold in anything that was in the old (nearly empty) `users` table
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'users_legacy') then
    insert into users (id, email, full_name, phone, institution, college_roll, batch, hsc_session,
                       is_active, password_hash, created_at, membership_status, is_verified)
    select l.id, l.email, l.full_name, l.phone, l.college, l.college_roll, l.batch, l.hsc_session,
           coalesce(l.is_active, true), l.password_hash, l.created_at, 'none', false
    from users_legacy l
    where not exists (select 1 from users u where u.id = l.id or lower(u.email) = lower(l.email));
  end if;
end $$;

-- ── Membership applications ("Become a member") ────────────────────────────
create table if not exists membership_applications (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references users(id) on delete cascade,
  college_roll     text,
  batch            text,
  department       text,
  payment_slip_url text,                       -- photo of the filled membership form
  status           text not null default 'pending'
                   check (status in ('pending', 'approved', 'rejected', 'revoked')),
  review_note      text,
  reviewed_by      text,                       -- admin email (admin auth is cookie based)
  reviewed_at      timestamptz,
  created_at       timestamptz not null default now()
);
create index if not exists membership_applications_user_idx on membership_applications (user_id);
create index if not exists membership_applications_status_idx on membership_applications (status);
create unique index if not exists membership_one_pending_per_user
  on membership_applications (user_id) where status = 'pending';

-- ── Members = approved club members only ───────────────────────────────────
create table if not exists members (
  user_id        uuid primary key references users(id) on delete cascade,
  application_id uuid references membership_applications(id) on delete set null,
  approved_at    timestamptz not null default now(),
  approved_by    text,
  created_at     timestamptz not null default now()
);

alter table membership_applications enable row level security;
alter table members enable row level security;
-- No policies on purpose: only the server (service role) reads/writes these.

-- ── Keep users.membership_status / users.is_verified in sync automatically ──
-- (existing code reads those two columns; the members table is the source of truth)
create or replace function refresh_user_membership(uid uuid) returns void
language plpgsql as $$
declare st text;
begin
  if exists (select 1 from members where user_id = uid) then
    st := 'approved';
  elsif exists (select 1 from membership_applications where user_id = uid and status = 'pending') then
    st := 'pending';
  elsif exists (select 1 from membership_applications where user_id = uid and status = 'rejected') then
    st := 'rejected';
  else
    st := 'none';
  end if;
  update users set membership_status = st, is_verified = (st = 'approved') where id = uid;
end $$;

create or replace function trg_members_refresh() returns trigger
language plpgsql as $$
begin
  perform refresh_user_membership(coalesce(new.user_id, old.user_id));
  return null;
end $$;

create or replace function trg_applications_refresh() returns trigger
language plpgsql as $$
begin
  perform refresh_user_membership(coalesce(new.user_id, old.user_id));
  return null;
end $$;

drop trigger if exists members_refresh on members;
create trigger members_refresh after insert or update or delete on members
  for each row execute function trg_members_refresh();

drop trigger if exists membership_applications_refresh on membership_applications;
create trigger membership_applications_refresh after insert or update or delete on membership_applications
  for each row execute function trg_applications_refresh();

-- ── Admin actions (atomic) ─────────────────────────────────────────────────
-- Approve / reject / revoke one user's membership. p_status: 'approved' | 'rejected' | 'none'
create or replace function admin_set_membership(p_user_id uuid, p_status text, p_admin text default null)
returns void language plpgsql as $$
declare app_id uuid;
begin
  if p_status = 'approved' then
    select id into app_id from membership_applications
      where user_id = p_user_id and status = 'pending'
      order by created_at desc limit 1;

    if app_id is null then
      -- approving without a pending application (admin toggle / bulk import): snapshot the profile
      insert into membership_applications (user_id, college_roll, batch, department, payment_slip_url,
                                           status, reviewed_by, reviewed_at)
      select id, college_roll, batch, department, payment_slip_url, 'approved', p_admin, now()
      from users where id = p_user_id
      returning id into app_id;
    else
      update users u set
        college_roll     = coalesce(a.college_roll, u.college_roll),
        batch            = coalesce(a.batch, u.batch),
        department       = coalesce(a.department, u.department),
        payment_slip_url = coalesce(a.payment_slip_url, u.payment_slip_url)
      from membership_applications a
      where a.id = app_id and u.id = a.user_id;

      update membership_applications
        set status = 'approved', reviewed_by = p_admin, reviewed_at = now()
        where id = app_id;
    end if;

    insert into members (user_id, application_id, approved_by)
    values (p_user_id, app_id, p_admin)
    on conflict (user_id) do nothing;

  elsif p_status in ('rejected', 'none') then
    update membership_applications
      set status = case when p_status = 'rejected' then 'rejected' else 'revoked' end,
          reviewed_by = p_admin, reviewed_at = now()
      where user_id = p_user_id and status in ('pending', 'approved');
    delete from members where user_id = p_user_id;
  else
    raise exception 'invalid membership status: %', p_status;
  end if;

  perform refresh_user_membership(p_user_id);
end $$;

-- ── Backfill from the old single-table model ───────────────────────────────
-- approved / verified accounts -> application (approved) + members row
insert into membership_applications (user_id, college_roll, batch, department, payment_slip_url,
                                     status, reviewed_by, reviewed_at, created_at)
select u.id, u.college_roll, u.batch, u.department, u.payment_slip_url,
       'approved', 'migration', now(), coalesce(u.created_at, now())
from users u
where (u.membership_status = 'approved' or u.is_verified = true)
  and not exists (select 1 from members m where m.user_id = u.id)
  and not exists (select 1 from membership_applications a where a.user_id = u.id);

insert into members (user_id, application_id, approved_at, approved_by)
select u.id,
       (select a.id from membership_applications a
         where a.user_id = u.id and a.status = 'approved' order by a.created_at desc limit 1),
       coalesce(u.created_at, now()), 'migration'
from users u
where u.membership_status = 'approved' or u.is_verified = true
on conflict (user_id) do nothing;

-- pending / rejected accounts -> application row with that status
insert into membership_applications (user_id, college_roll, batch, department, payment_slip_url, status, created_at)
select u.id, u.college_roll, u.batch, u.department, u.payment_slip_url, u.membership_status,
       coalesce(u.created_at, now())
from users u
where u.membership_status in ('pending', 'rejected')
  and not exists (select 1 from members m where m.user_id = u.id)
  and not exists (select 1 from membership_applications a where a.user_id = u.id);

-- recompute the two cached columns for everybody from the new tables
select refresh_user_membership(id) from users;

grant all on membership_applications, members to service_role;

commit;

-- Make PostgREST (Supabase API) notice the new/renamed tables
notify pgrst, 'reload schema';

-- ── Verification (run manually) ────────────────────────────────────────────
-- select count(*) from users;                               -- should equal old members count (+ any legacy users)
-- select membership_status, count(*) from users group by 1;
-- select count(*) from members;                             -- approved club members only
-- select count(*) from backup_members_pre_split;
--
-- ── Rollback (only if something is wrong, before new signups happen) ───────
-- drop table members; drop table membership_applications;
-- alter table users rename to members;   alter table users_legacy rename to users;
