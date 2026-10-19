-- Migration 39: service credentials managed from the admin panel
-- Lets admins add the WhatsApp sender service URL + token in the UI instead of
-- editing environment variables. Tokens are stored AES-256-GCM encrypted
-- (lib/crypto.ts). The env vars WHATSAPP_SERVICE_URL / WHATSAPP_SERVICE_TOKEN
-- remain as a fallback when no active row exists.

create table if not exists service_credentials (
  id               uuid primary key default gen_random_uuid(),
  provider         text not null default 'whatsapp',
  label            text not null,
  base_url         text not null,
  token_encrypted  text not null,
  is_active        boolean not null default false,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

-- At most one active credential per provider.
create unique index if not exists service_credentials_one_active
  on service_credentials (provider) where is_active;

alter table service_credentials enable row level security; -- server (service role) access only
