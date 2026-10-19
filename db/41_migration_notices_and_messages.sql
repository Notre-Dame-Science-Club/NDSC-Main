-- Migration 41: targeted dashboard notices + member message box
--
-- NOTICES   An admin writes a notice aimed at a college and/or batch (e.g. "Notre Dame College,
--           Batch 28 -> join your WhatsApp group" with a link). Members who match see it on their
--           dashboard until they dismiss it (or it is switched off / expires).
--             notices              one row per notice (+ its audience, link, schedule)
--             notice_dismissals    which member closed which notice (so it stays closed on every device)
--
-- MESSAGES  A message box on the dashboard: "professional obligation" / "report a problem" /
--           "tell us something". Admins read and resolve them from /admin/messages.
--             member_messages      one row per message, with status + the admin's reply
--
-- Audience semantics (see lib/notices.ts, the single source of truth for matching):
--   audience_colleges / audience_batches are BOTH empty  -> everyone
--   otherwise a member must match every non-empty list (college AND batch), and within one
--   list any value matches. Colleges are compared by college identity (every spelling of
--   Notre Dame College is one college) and batches by normalised value ("28" = "Batch 28").
--
-- Requires migration 38 (the `users` table). Idempotent: safe to re-run.
-- Access is server-only (API routes use the service role), like members / membership_applications.

begin;

-- ── notices ─────────────────────────────────────────────────────────────────
create table if not exists notices (
  id                uuid primary key default gen_random_uuid(),
  title             text not null,
  body              text,
  link_url          text,                                   -- http(s) only; validated by the API
  link_label        text,                                   -- button text; default is derived from the link
  tone              text not null default 'info'
                    check (tone in ('info', 'important', 'success')),
  audience_colleges text[] not null default '{}',           -- empty = any college
  audience_batches  text[] not null default '{}',           -- empty = any batch
  is_active         boolean not null default true,
  dismissible       boolean not null default true,          -- false = stays until it is switched off
  starts_at         timestamptz,                            -- optional schedule window
  ends_at           timestamptz,
  created_by        text,                                   -- admin email (admin auth is cookie based)
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists notices_active_idx on notices (is_active, created_at desc);

-- ── notice_dismissals ───────────────────────────────────────────────────────
create table if not exists notice_dismissals (
  notice_id    uuid not null references notices(id) on delete cascade,
  user_id      uuid not null references users(id) on delete cascade,
  dismissed_at timestamptz not null default now(),
  primary key (notice_id, user_id)
);
create index if not exists notice_dismissals_user_idx on notice_dismissals (user_id);

-- ── member_messages ─────────────────────────────────────────────────────────
create table if not exists member_messages (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references users(id) on delete set null,  -- keep the message if the account is deleted
  sender_name  text,                                          -- snapshot, survives account deletion
  sender_email text,
  category     text not null default 'other'
               check (category in ('professional', 'problem', 'other')),
  subject      text,
  message      text not null,
  status       text not null default 'open'
               check (status in ('open', 'in_progress', 'resolved')),
  admin_reply  text,                                          -- shown to the member on their dashboard
  resolved_by  text,                                          -- admin email
  resolved_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists member_messages_status_idx on member_messages (status, created_at desc);
create index if not exists member_messages_user_idx   on member_messages (user_id, created_at desc);

-- ── Row Level Security: server only ─────────────────────────────────────────
-- No policies for anon / authenticated on purpose: the browser never touches these tables,
-- every read and write goes through an API route that checks who is calling.
alter table notices           enable row level security;
alter table notice_dismissals enable row level security;
alter table member_messages   enable row level security;

-- Hosted Supabase: service_role has BYPASSRLS, nothing more to do.
-- Local PostgREST stack (db/02_init_roles.sql): service_role is a plain role without BYPASSRLS,
-- so RLS with no policy would lock the API out. Grant it explicit access there only.
do $$
declare t text;
begin
  if exists (select 1 from pg_roles where rolname = 'service_role' and not rolbypassrls) then
    foreach t in array array['notices', 'notice_dismissals', 'member_messages'] loop
      execute format('drop policy if exists %I on %I', t || '_service_role_all', t);
      execute format('create policy %I on %I for all to service_role using (true) with check (true)',
                     t || '_service_role_all', t);
    end loop;
  end if;
end $$;

commit;
