# NDSC Platform

Next.js 16 + Supabase site for NDSC — member portal, activities/events with
registration, olympiads with a live exam runner, publications, and an admin
panel covering all of it.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Supabase** (Postgres + Auth + Storage) — service-role key from API
  routes for admin operations, anon key for public reads
- **Tailwind CSS**
- Transactional email via **Resend** (`lib/email.ts`), survey/notification
  email via **Brevo** (`lib/email/brevo.ts`, not yet wired to a real API key)

## Project layout

```
app/              Next.js App Router — pages + app/api/** route handlers
components/       Shared UI (components/ui) + feature components
hooks/            Client-side hooks (e.g. useAdminResource)
lib/              Server/shared helpers — auth, email, payment, supabase client, etc.
types/            Shared TypeScript types, incl. types/database.ts (DB row shapes)
public/           Static assets
db/
  schema.sql      Single source of truth for the database schema — run this
                  on a fresh Supabase project before anything else
scripts/          Standalone maintenance/migration scripts (not part of the
                  app build) — see scripts/README.md
docs/
  ARCHITECTURE.md         How the shared infrastructure (auth, api response
                          helpers, hooks) fits together
  DATABASE_STRUCTURE.md   Narrative companion to db/schema.sql
  SUPABASE_SETUP.md       Env vars + RLS policies for a new environment
  update-notes/           Historical planning docs, changelogs, and the
                          superseded schema_update_*.sql files — kept for
                          history, not authoritative
```

## Getting started

1. Copy `.env.local.example` to `.env.local` and fill in real values
   (Supabase project URL/keys, admin password, upload secret). **Never
   commit `.env.local`** — it's gitignored, and it holds live credentials.
2. Run `db/schema.sql` in your Supabase project's SQL Editor.
3. `npm install`
4. `npm run dev`

See `docs/SUPABASE_SETUP.md` for the RLS policies and admin bootstrap steps.

## Scripts

One-off data export/import/migration tooling lives in `scripts/` and is run
directly with `node`/`python` from the project root — it's intentionally
separate from the Next.js app build. See `scripts/README.md` before running
anything there, especially `migrate.py`.
