> **Archived (2026-07-17 cleanup):** kept for history only. Any `MIGRATION_V*.sql` / `schema_update_*.sql` file mentioned below has been superseded by the single **db/schema.sql**. Do not run the SQL commands in this file directly.

# NDSC Phase D — Complete Deployment Guide

## Step 1 — Database
Run `MIGRATION_V6.sql` in Supabase SQL Editor. Safe to re-run.

## Step 2 — Copy files into your repo
Every file under `app/` here maps to the exact same path in `NDSC-Main`.
Overwrite existing files; the new ones (`relay-exam/`, `admin/forms/`, the
new API routes) just get added.

| File | Status |
|---|---|
| `app/activities/[slug]/page.tsx` | replace |
| `app/activities/[slug]/ActivityRegisterButton.tsx` | new |
| `app/activities/[slug]/register/page.tsx` | replace |
| `app/activities/[slug]/dashboard/page.tsx` | replace |
| `app/activities/[slug]/relay-exam/page.tsx` | new |
| `app/dashboard/page.tsx` | replace |
| `app/olympiad/page.tsx` | replace (small additive change — scheduling gate + subject_id field) |
| `app/admin/activity-registration/[sessionId]/page.tsx` | replace |
| `app/admin/olympiads/page.tsx` | replace |
| `app/admin/forms/page.tsx` | new |
| `app/api/activity-register/route.ts` | replace |
| `app/api/activity-submission/route.ts` | new |
| `app/api/activity-upload/route.ts` | replace |
| `app/api/admin/form-configs/route.ts` | new |
| `app/api/form-config/route.ts` | new |
| `app/api/member-activity-registrations/route.ts` | new |
| `app/api/olympiad/route.ts` | replace |
| `app/api/relay-exam/route.ts` | new |

## Step 3 — Admin nav
Add a link to `/admin/forms` somewhere in your admin sidebar/layout.

## What's implemented

**Dashboard flow** — registering now redirects straight to a per-event
dashboard; the activity page shows "Register" or "My Dashboard" depending
on whether a registration already exists on that device.

**Member dashboard** — shows every event a member has registered for, with
a direct link into each one's dashboard.

**Online rounds** — categories marked as online-submission show a
submit/exam panel on their dashboard: file/text submission fields
(admin-configured types, sizes, file counts), or a "Start Exam" button.

**Submission system** — admin defines arbitrary fields per category
(title, description, type, file constraints, required) under "Submission
Fields" in the category editor. Server-side validates file type/size on
upload, not just client-side.

**Team relay exams** — a dedicated `relay-exam` page handles team members
taking turns. Sequential mode locks the next member out until the current
one submits; chain mode lets a question reference a previous member's
answer via `{{chain.memberN.questionId}}`, resolved at render time.

**Subject assignment** — admin defines subjects per olympiad; team members
self-select (or admin/auto-assign in future); a subject locks out everyone
else from picking it. Questions can be tagged to a specific subject so each
member only sees their own subject's questions.

**Exam scheduling** — admin sets a start/end time; both the activity
dashboard and the relay-exam page respect it (countdown before start,
locked after end). The standalone `/olympiad` page also respects it as a
light additive gate.

**Universal form config** — `/admin/forms` lets the admin customize title,
subtitle, cover photo, primary field labels/descriptions/visibility, extra
custom fields, and contact persons for any form. Contact persons can be
typed manually or pulled live from the Executives page by selecting which
EC members to show.

**Pre-fill** — non-members get their primary info remembered in
localStorage after their first registration; members get it from their
member profile. Either way, second-time registration doesn't ask again.

**Project name field** — toggle per category; label is admin-editable;
saved on the registration and shown on dashboards.

## Known limitations (by design, not oversight)

- The relay-exam page is a *separate* flow from the original `/olympiad`
  page, because that page's registration model (`olympiad_registrations`)
  is architecturally different from activity-linked registrations
  (`activity_registrations`). Trying to merge them risked breaking the
  existing standalone olympiad flow that already works in production.
- Admin-assign and auto subject-assignment modes are wired into the schema
  and dropdown, but only self-select has a working UI flow end-to-end.
  Admin-assign would need a small UI in `/admin/olympiads` to map members
  to subjects manually — not built in this pass.
- EC contact pull resolves at page-load time on the register page; it
  isn't cached, so very high-traffic forms make one extra request per
  visitor. Fine at NDSC's scale.
