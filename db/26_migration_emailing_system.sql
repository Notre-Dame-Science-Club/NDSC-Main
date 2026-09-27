-- Migration 26: Mass-emailing system tables
-- Created: 2026-09-24
-- Adds email_accounts, email_campaigns, and email_campaign_recipients tables
-- for the multi-account Brevo-based mass-emailing system.

-- ── email_accounts ──────────────────────────────────────────────────────
create table if not exists email_accounts (
  id                uuid primary key default gen_random_uuid(),
  label             text not null,
  gmail_address     text,
  sender_name       text not null,
  sender_email      text not null,
  api_key_encrypted text not null,
  daily_limit       int not null default 300,
  sent_today        int not null default 0,
  quota_date        date not null default current_date,
  is_active         boolean not null default true,
  created_at        timestamptz default now()
);

-- ── email_campaigns ─────────────────────────────────────────────────────
create table if not exists email_campaigns (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  subject            text not null,
  body_html          text not null,
  audience_source    text not null default 'members',
  audience_filters   jsonb not null default '{}',
  status             text not null default 'draft',
  scheduled_at       timestamptz,
  sent_at            timestamptz,
  total_recipients   int not null default 0,
  sent_count         int not null default 0,
  failed_count       int not null default 0,
  processing_lock_at timestamptz,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);

create index if not exists email_campaigns_status_idx on email_campaigns (status, scheduled_at);

-- ── email_campaign_recipients ───────────────────────────────────────────
create table if not exists email_campaign_recipients (
  id               uuid primary key default gen_random_uuid(),
  campaign_id      uuid not null references email_campaigns(id) on delete cascade,
  email            text not null,
  name             text,
  source           text not null,
  source_id        uuid,
  status           text not null default 'pending',
  email_account_id uuid references email_accounts(id),
  error            text,
  sent_at          timestamptz,
  created_at       timestamptz default now()
);

create index if not exists email_campaign_recipients_campaign_idx on email_campaign_recipients (campaign_id, status);
