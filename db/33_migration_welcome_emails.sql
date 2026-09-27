-- Migration 33: Per-event welcome emails
-- Created: 2026-09-26
--
-- Adds a "welcome email" config to activity_sessions and olympiads (off by
-- default), and a sent-once marker + last-error column to the two
-- registration tables. Sending itself reuses the existing email_accounts
-- pool from migration 26 (see lib/email/welcome.ts) — no new sender
-- infrastructure, just a new trigger point + per-event template.
--
-- Wiring: app/api/public/form-graph/submit/route.ts sends the email the
-- moment a registration's form path is fully complete (isDone), regardless
-- of payment status. welcome_email_sent_at makes that idempotent even if
-- the same terminal node is somehow submitted twice.

-- ── activity_sessions ────────────────────────────────────────────────────
alter table activity_sessions
  add column if not exists welcome_email_enabled boolean not null default false,
  add column if not exists welcome_email_subject  text,
  add column if not exists welcome_email_body     text;

-- ── olympiads ────────────────────────────────────────────────────────────
alter table olympiads
  add column if not exists welcome_email_enabled boolean not null default false,
  add column if not exists welcome_email_subject  text,
  add column if not exists welcome_email_body     text;

-- ── activity_registrations ───────────────────────────────────────────────
alter table activity_registrations
  add column if not exists welcome_email_sent_at timestamptz,
  add column if not exists welcome_email_error   text;

-- ── olympiad_registrations ───────────────────────────────────────────────
alter table olympiad_registrations
  add column if not exists welcome_email_sent_at timestamptz,
  add column if not exists welcome_email_error   text;
