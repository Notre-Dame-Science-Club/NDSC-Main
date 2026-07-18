> **Archived (2026-07-17 cleanup):** kept for history only. Any `MIGRATION_V*.sql` / `schema_update_*.sql` file mentioned below has been superseded by the single **db/schema.sql**. Do not run the SQL commands in this file directly.

# Task 1 (Activity Update) — what changed

## 0. Run this first
Apply `schema_update_05.sql` in the Supabase SQL editor (additive only, same
pattern as 01/03/04). Nothing existing is renamed or dropped.

## Already solid before this pass (confirmed, not touched)
- **1.0** Base Activity Admin flow (Type → Version → Session → Registration
  toggle → Manage Registration) — already correct.
- **1.2** `activity_versions.description` and per-session `description` —
  already existed and already render on the public activities page.
- **1.3b** Primary-field auto-population (`form_configs.primary_fields`,
  editable/removable, plus `extra_fields`) — already existed via `/admin/forms`.
- **1.3c/1.3d** Segment/round selection + branching multi-step flow — already
  implemented via the self-referencing `activity_reg_categories` tree.
- **1.3e** Returning-user prefill — already implemented (identity lookup +
  known-info prefill on the register page).
- **1.3f** Team registration — already implemented (`requires_team`,
  `team_member_fields`, per-member sub-forms).
- **1.8** Online submission / live MCQ config — already generalized to any
  session with registration on, not Olympiad-only.

## New in this pass
- **1.1** — `activity_sessions.image_display_mode` (`cover` | `native`).
  Admin toggle in the session editor. Public list + detail page render
  `native` at the image's own aspect ratio instead of the fixed event box.
- **1.2 (pinning)** — `activity_versions.is_pinned` / `is_highlighted`.
  Toggle in the version editor. Public list sorts pinned versions first and
  gives them distinct badge styling — this is how "Science Under" gets
  pinned/highlighted without hardcoding its name anywhere.
- **1.3a** — Appearance pipeline on `form_configs`: `bg_color`,
  `bg_image_url`, `font_family`, `cover_aspect_ratio`, and
  `auto_pull_title` / `auto_pull_description` / `auto_pull_cover` toggles.
  Editable from `/admin/forms` (deep-linkable via `?key=activity_register:<sessionId>`)
  and previewed from the new **Appearance** tab on the registration builder.
  The register page consumes all of it (font, background, cover ratio,
  auto-pull fallbacks).
- **1.5** — CSV export button on the Registrants panel (client-side, includes
  every custom field + team members).
- **1.6** — `activity_sessions.reg_status` (free-text label) and
  `reg_deadline` (timestamp). Editable in the session editor. Surfaced as
  badges on the activity detail page, the per-event dashboard, and the
  "My Registrations" list on the global member dashboard.
- **1.7** — New `activity_updates` table + admin CRUD
  (`/api/admin/activity-updates`) + public read (`/api/activity-updates-public`).
  New **Updates** tab on the registration builder to post/delete updates.
  Feed renders on the activity detail page and the per-event dashboard,
  newest first.
- **Unique-field duplicate detection** (from your last message) — any custom
  field or team-member field can be flagged "Unique field" in the builder.
  Enforced server-side in `/api/activity-register` (session-wide, so it
  catches duplicates across segments/rounds of the same event too), returns
  a 409 naming the field.

## Files touched
- `schema_update_05.sql` (new)
- `types/database.ts`
- `app/api/admin/activity-sessions/route.ts`
- `app/api/admin/activity-versions/route.ts`
- `app/api/admin/activity-updates/route.ts` (new)
- `app/api/activity-updates-public/route.ts` (new)
- `app/api/activity-register/route.ts` (unique-field check)
- `app/api/activity-sessions-public/route.ts`
- `app/api/activity-reg-categories-public/route.ts`
- `app/api/member-activity-registrations/route.ts`
- `app/admin/activities/page.tsx`
- `app/admin/activity-registration/[sessionId]/page.tsx` (Appearance/Updates
  tabs, CSV export, unique-field checkbox)
- `app/admin/forms/page.tsx` (appearance fields, `?key=` deep link)
- `app/activities/page.tsx`
- `app/activities/[slug]/page.tsx`
- `app/activities/[slug]/dashboard/page.tsx`
- `app/activities/[slug]/register/page.tsx` (appearance consumption)
- `app/dashboard/page.tsx`

## Known gap I didn't guess at
"Statement sites" isn't a concept that existed anywhere in the codebase (no
table, type, or component named that). I implemented 1.1 as a general
per-session `image_display_mode` toggle instead of hardcoding a name match —
turn it on for whichever sessions are the "statement site" ones. If there's
meant to be a dedicated `activity_type` or content type for these, tell me
and I'll wire the toggle to default `native` for that type automatically.

## Not fully verified
I couldn't run a full `next build` in this sandbox — the zip you gave me is
missing a couple of unrelated pre-existing files (`components/NDSCBot.tsx`,
`components/SurveyForm.tsx`), so Turbopack fails before it gets to type-check
my changes. Please run your normal build/dev and send me any errors —
straightforward to fix from here.
