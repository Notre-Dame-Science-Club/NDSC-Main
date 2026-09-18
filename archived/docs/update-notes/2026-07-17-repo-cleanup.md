# Repo cleanup & schema consolidation — 2026-07-17

Full pass over the codebase: consolidated the database schema, reorganized
loose files into folders, and fixed several mismatches found between the
docs/types and the actual code. Summary below.

## 🔴 Security — read this first

1. **Live Supabase `service_role` key was hardcoded in `migrate.py`**
   (`SUPABASE_URL` / `SERVICE_KEY` constants), even though the script's own
   docstring documented env-var configuration. Fixed to actually read
   `TARGET_SUPABASE_URL` / `TARGET_SUPABASE_SERVICE_ROLE_KEY` from `.env`.
   **If this ever left your machine (git push, zip shared with anyone,
   uploaded anywhere), rotate that key now** from the Supabase dashboard —
   it bypasses RLS entirely. See `scripts/README.md`.
2. **`.env.local` was not in `.gitignore`.** It held the same live
   Supabase service-role + anon keys, plus `ADMIN_PASSWORD=super_admin`
   (a guessable default covering every `/admin` route) and an upload
   secret. `.gitignore` now excludes `.env*`. The real file was **not**
   included in this cleaned-up copy — only a placeholder
   `.env.local.example` — recreate your real `.env.local` locally and
   rotate `ADMIN_PASSWORD` to a strong, generated value while you're at it.
   If `.env.local` was ever committed to git history, deleting it isn't
   enough — the old blob is still there; rotate every secret in it.

## Schema consolidation

- Six SQL files at the repo root (`schema.sql`, `schema_update_01/03/04/05.sql`,
  `schema_updates.sql`) merged into one authoritative **`db/schema.sql`**.
- `schema_update_05.sql`'s changes (the `activity_updates` table,
  `activity_versions.is_pinned`/`is_highlighted`,
  `activity_sessions.image_display_mode`/`reg_status`/`reg_deadline`, and
  the `form_configs` appearance-pipeline columns) had **never been folded
  into `schema.sql`** — confirmed via grep that all of them are live in
  the app, and added them in.
- `schema_updates.sql` (plural — an older, different draft) proposed a
  separate appearance pipeline directly on `activity_sessions`
  (`background_image_url`, `title_text`, `custom_css`,
  `registration_form_definition`, etc.). Confirmed via grep this was
  **never implemented** — zero references anywhere in `app/`/`lib/`. Left
  out of the merged schema; kept only as history.
- Old files moved to `docs/update-notes/schema-history/`, each marked
  ARCHIVED at the top so nobody runs them by mistake.

## Type/code mismatches fixed

- `types/database.ts`'s `MemberRow` was missing `is_organizer` /
  `is_executive` — both are actively read/written (survey audience
  targeting, `admin/members` role toggles, several API routes). Added back.
- `lib/api-response.ts` + `types/api.ts` were a **dead duplicate**
  implementation of the API response helpers — zero imports anywhere,
  different `apiOk()` signature than the real one, never wired up. Deleted.
  The real, 68-call-site helper is `lib/api/response.ts`; `ARCHITECTURE.md`
  was rewritten to document that file instead of the dead one, and
  `types/index.ts`'s barrel export was updated to drop `./api`.
- `DATABASE_STRUCTURE.md` predated `schema_update_05.sql` and didn't
  mention `is_organizer`/`is_executive` either — added a note at the top
  pointing to `db/schema.sql` as the verified source of truth.

## Reorganization

- `db/schema.sql` — the one schema file.
- `scripts/` — all loose `.js`/`.py` maintenance scripts
  (`export-supabase-data.js`, `export_storage_files.py`,
  `import-supabase-data.js`, `list-admins.js`, `migrate.py`), plus a
  `scripts/package.json` (so `dotenv` isn't mixed into the main app's
  dependencies), `scripts/requirements.txt` (referenced by `migrate.py`'s
  docstring but never actually existed), and `scripts/README.md`.
- `docs/` — `ARCHITECTURE.md`, `DATABASE_STRUCTURE.md`, `SUPABASE_SETUP.md`.
- `docs/update-notes/` — `TASK1_CHANGES.md`, `UNIFIED_REGISTRATION_PLAN.md`,
  the old root `README.md` (renamed
  `README-phase-d-deployment-guide-OLD.md` — it referenced a different repo
  name and `MIGRATION_V5/V6.sql` files that don't exist here, clearly a
  stale doc from an earlier phase), `docs/update-notes/schema-history/`,
  and this file.
- Root `README.md` rewritten from scratch to match what's actually here.

## Junk removed

- `tsconfig.tsbuildinfo` — build artifact, regenerates automatically, was
  never meant to be committed.
- `components/New Text Document.txt` — empty file.
- `README-MIGRATION.md` — empty file.
- Empty `run/` folder — unreferenced anywhere.

## Confirmed still accurate (checked, not changed)

- `activities` table + its API route: confirmed still genuinely dead code
  (no page calls the route).
- `appearance_settings` table: confirmed still unused — the live
  Appearance route reads/writes `homepage_settings` instead, exactly as
  the old schema.sql's caveats said.

## Not fixed (flagged only, out of scope for a reorg pass)

- `app/admin/activity-registration/[sessionId]/page.tsx` references a
  `FilesPanel` component that is never imported or defined anywhere in the
  file — `tsc --noEmit` fails on it. Pre-existing, unrelated to this
  cleanup (confirmed by running the type-check both before and after these
  changes). Worth a follow-up.
