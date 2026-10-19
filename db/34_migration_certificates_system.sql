-- Standalone certificate system: a template + a recipient list per batch,
-- independent of activity/olympiad registrations. Additive only.
-- See docs/certificates-system.md (build spec) for the full feature design.

create table if not exists certificates (
  id                 uuid primary key default gen_random_uuid(),
  title              text not null,
  slug               text not null unique,          -- the public URL segment
  template_pdf_url   text,                            -- set once uploaded
  name_x_pct         numeric default 50,              -- 0-100, % across the page
  name_y_pct         numeric default 50,              -- 0-100, % down the page
  name_page          int default 0,                   -- 0-indexed
  font_size          int default 32,
  font_color         text default '#111111',
  align              text default 'center'
                       check (align in ('left','center','right')),
  is_active          boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table if not exists certificate_recipients (
  id                 uuid primary key default gen_random_uuid(),
  certificate_id     uuid not null references certificates(id) on delete cascade,
  email              text not null,        -- matched against the logged-in account's email
  full_name          text not null,        -- exact name to stamp (may differ from account display name)
  created_at         timestamptz not null default now(),
  unique (certificate_id, email)
);

create index if not exists idx_certificate_recipients_lookup
  on certificate_recipients (certificate_id, lower(email));
