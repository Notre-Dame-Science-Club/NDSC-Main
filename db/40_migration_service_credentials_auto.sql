-- Migration 40: mark credentials that the WhatsApp service registered by itself on startup.
alter table service_credentials add column if not exists is_auto boolean not null default false;
create unique index if not exists service_credentials_one_auto
  on service_credentials (provider) where is_auto;
