> **Archived (2026-07-17 cleanup):** kept for history only. Any `MIGRATION_V*.sql` / `schema_update_*.sql` file mentioned below has been superseded by the single **db/schema.sql**. Do not run the SQL commands in this file directly.

# NDSC — Unified Activity/Olympiad Registration System — Plan & Gap Analysis

Generated from a fresh read of the uploaded zip (`NDSC-Main-main_FIXED.zip`) against the
screenshots of the **currently live** site (ndscbd.net). Written so a new Claude session
can pick this up with zero prior context.

## 0. Important finding first

The screenshots you sent are from the **live deployed site**, and they show an older,
simpler version (flat single-page Olympiad register form, no cover photo, no date/dropdown
options, no "Register Now" on activity cards). But the **code inside this zip is already much
further along** than that — `MIGRATION_V5.sql` + `MIGRATION_V6.sql` plus the current
`app/activities/[slug]/register/page.tsx`, `app/admin/activity-registration/[sessionId]/page.tsx`,
and `app/admin/forms/page.tsx` already implement most of what you're describing:

- Recursive, admin-controlled-depth category tree (`activity_reg_categories`, parent_id) - Leaf-only custom fields with type `text | textarea | number | photo | file | dropdown | date | time`, each with `options[]` for dropdowns and `description` - Team registration toggle with min/max team size + per-member fields - Payment toggle (amount/label) - `is_online_submission` + `linked_olympiad_id` — turning this on **auto-creates a real row in `olympiads`** and links it, so Activity and Olympiad are already modeled as the same underlying registration, not two separate systems (see `app/api/admin/activity-reg-categories/route.ts`)
- `submission_config[]` for the leaf's file/text submission fields, with `max_file_size_mb`, `max_files`, `file_types` — admin-controlled per field - `form_configs` table + `/app/admin/forms/page.tsx` — site-wide or per-event (`activity_register:SESSION_ID`) cover photo, title/subtitle, primary field label/description/visibility overrides, extra fields, contact persons - Register page (`register/page.tsx`) already renders the cover photo, dropdown/date/time/photo/file inputs, category description 
**This means the most likely explanation is the live site hasn't been redeployed with this
code, or was redeployed from an older branch/zip.** Before any further coding, confirm:

> **Is this zip already deployed to ndscbd.net, or is it sitting ahead of production?**

If it's *not* deployed yet — step 1 is just deploying it and re-testing against the live
site, since several of your listed bugs may already be fixed in here.

## 1. Confirmed real gaps (checked directly in this zip's code)

| # | Issue (your words) | Status in this zip | File(s) |
|---|---|---|---|
| 1 | "Register Now" button should show on the event **card** in the Activities listing page, not just the detail page | **Missing** — `app/activities/page.tsx` has zero references to registration/upcoming/register-now | `app/activities/page.tsx` |
| 2 | Same-color titles for all fields (primary vs extra fields look different) | Needs visual check — `form_configs.primary_fields` supports per-field `label/description/visible/required` but not a per-field *color*; likely the visual inconsistency is just inconsistent CSS classes between the primary-field block and the custom-field block in `register/page.tsx`. Needs a pass to unify styling, not a new feature. | `app/activities/[slug]/register/page.tsx` |
| 3 | bg_theme / color control from admin not actually changing anything visually | `form_configs.bg_theme` column exists and is editable in `/admin/forms`, but need to verify `register/page.tsx` actually *reads and applies* `bg_theme` (e.g. CSS var swap). Needs a quick grep + wire-up if unused. | `register/page.tsx`, `app/admin/forms/page.tsx` |
| 4 | Multi-step "Google Form" wizard: select primary field → Next → shows only that primary's sub-fields → Next ... → leaf form → (payment step if required) → Submit → Dashboard | Need to verify `register/page.tsx`'s actual step flow matches this (tree-drill-down with Next/Back per level, not all levels shown at once). From the line numbers seen, the file does branch on `cat.description`/field rendering, but the full step-by-step wizard UX (one level per screen with Next/Back) needs to be read in full and confirmed/fixed. | `register/page.tsx` |
| 5 | Short description with "Show more" (4–5 lines, expandable) on the register page, separate from the registration-field description | Not yet confirmed present — needs to be added if missing | `register/page.tsx` |
| 6 | Dashboard after registration: cover photo + 4–5 line description | Need to check `app/activities/[slug]/dashboard/page.tsx` for this layout | `app/activities/[slug]/dashboard/page.tsx` |
| 7 | Olympiad public page (`/olympiad`) should show each **online-only** primary field as its own card (same cover photo as parent activity), Register routes into the **same** activity register flow, just starting one step in (skipping the primary-category step) | Partially modeled at the DB level (`linked_olympiad_id`), but `app/olympiad/page.tsx` needs to be read in full to confirm it pulls from `activity_reg_categories` (online leaves only) rather than from a separate/legacy `olympiad_register` flow shown in your screenshot (image 4 — that flat form looks like the *old* `/olympiad-register` flow, not this new linked one) | `app/olympiad/page.tsx`, `app/api/olympiad-register/route.ts` |
| 8 | Admin Olympiad page should **auto-list** primary fields whose sub-tree has at least one online (submission/live-exam) leaf, and only let admin configure the *online* parts (submission fields, exam questions/relay/schedule) — never the registration-field structure itself (that stays activity-only) | Need to confirm `app/admin/olympiads/page.tsx` reads from `activity_reg_categories` joined on `linked_olympiad_id`/`is_online_submission`, rather than being a fully separate manually-created Olympiad list | `app/admin/olympiads/page.tsx` |
| 9 | Admin Activity Registration page should show **who registered for what**, nicely organized, but **not** show submission file content/marking (that belongs only on the Olympiad/organizer side) | Needs a registrations-list view added/checked in `admin/activity-registration/[sessionId]/page.tsx` | same file |
| 10 | Each leaf needs an explicit "online or offline" switch, and if online: "submission only / live exam / both / relay" | `submission_config` (submission) and the V6 relay/exam columns on `olympiads` exist, but the actual **online/offline + type selector control** on the leaf editor needs to be confirmed/added in the category builder UI | `admin/activity-registration/[sessionId]/page.tsx` |
| 11 | Registrants need an explicit "can new people register?" toggle (separate from `registration_enabled` on the session) | Not found at category level — only `requires_team`, no "registration open/closed" flag observed on `activity_reg_categories`. Needs a column + UI check. | `MIGRATION_V5.sql`/new patch, category builder |
| 12 | File upload max size **per field**, admin controlled | Already exists for `submission_config[].max_file_size_mb` and presumably `custom_fields` photo/file type — needs confirming `custom_fields` (registration-time fields, not post-registration submission fields) also carries a size limit, since your complaint mentions registration-time photo upload too | category builder, `custom_fields` type |

## 2. Concept recap (so nothing gets re-litigated later)

- **Activity Session** = the actual event (e.g. "Brain Rain 4.0"). Has a registration category
  tree (`activity_reg_categories`).
- **Category tree** = arbitrary depth, admin builds it ("Offline/Online" → "Class 9-10" →
  "Physics"/"Chemistry"...). Registration only happens at a **leaf**.
- **A leaf is "online"** when admin marks it so, and chooses: submission only / live exam only /
  both / relay. This is what makes it show up as an "Olympiad" card — **Olympiad is not a
  separate entity**, it is the online-leaf view of the same Activity registration system.
- Therefore: **one registration flow, one set of registrant records.** The Olympiad public page
  is just a filtered, prettier entry point into the *same* register flow (skips the
  top-level "pick a primary field" step since you already clicked a specific
  primary-field card on the Olympiad page).
- Admin's **Activity Registration** page = build the tree, the fields, who's offline/online,
  schedule/location for offline leaves, and see a clean list of all registrants across the
  whole tree.
- Admin's **Olympiad** page = only touches the *online* leaves: submission field config (what
  files/text, size limits), exam config (questions, relay, scheduled start time), and grading.
  It does **not** let admin edit registration-field structure — that's Activity's job.
- **Organizer** page mirrors the marking/grading view from the Olympiad admin page, scoped to
  whatever the organizer is allowed to see.

## 3.5 Confirmed answers (from you, this round)

1. The zip you originally sent **is** what's live on ndscbd.net (you ran it yourself and took
   the screenshots from that) — so every bug found above is a real, currently-live bug, not a
   stale-deploy mismatch. Good to keep going without re-checking deploy status.
2. *(payment ordering)* — confirmed: SSLCommerz is the last step, but only if the admin
   enabled payment for that specific leaf from the admin panel; otherwise the leaf's own form
   submission is the last step.
3. *(registration-open toggle)* — confirmed: needs to exist at **both** the leaf level and the
   primary-field level, each independently selectable from the admin panel.

## 3. Suggested execution order

**Status key:** done in this pass · ⏳ next up · not started

1. Confirm deployment status (see §0) — *waiting on your answer, proceeding anyway per your instruction not to block on it.*
2. Read `app/activities/[slug]/register/page.tsx` and `app/olympiad/page.tsx` in full (both
   ~600–800 lines) to get exact current behavior vs the wizard/cover-photo/online-filter spec
   above, and produce a precise per-line diff plan rather than guessing.
3. **Fix #1 (Register Now on activity card)** — done. `app/activities/page.tsx`:
   `SessionCard` now reads `is_upcoming` + `registration_enabled` (already returned by
   `/api/admin/activity-sessions` since it does `select('*')`), and shows a "Register Now"
   pill button top-left on the cover image when both are true, linking to
   `/activities/[slug]/register`. Card itself converted from an `<a>` wrapper to a
   click/keyboard-navigable `<div>` (router.push) so the Register button isn't an invalid
   nested `<a>` inside an `<a>`. Also surfaces `registration_note` under the date/location row
   when present.
4. **bg_theme + field-title styling (#2, #3)** — done:
   - Added an accent-color picker (5 presets + custom hex) to `app/admin/forms/page.tsx`,
     writing into the existing `bg_theme` column (was previously declared but had zero UI).
   - `register/page.tsx` now resolves that into an `accent` color and uses it for every
     required-field asterisk, the upload-field icon color, and "Show more" link — consistent
     across the whole form.
   - Unified every field label (primary fields, category custom fields, form-config extra
     fields) onto the same `fieldLabelCls`/`fieldDescCls` classes — previously primary fields
     were tiny muted-gray `text-xs` while custom/extra fields were `text-sm font-medium`
     white; now all three groups render identically.
   - Added the missing session short-description block with a "Show more / Show less" toggle
     (truncates at ~220 chars), kept separate from each field's own `description` (#5).
   - Cover photo now falls back to the activity session's own `cover_image_url` (same
     image/ratio it was uploaded with) when no form-specific override is set, instead of
     showing nothing (#3 cover-photo-of-the-session part).
   - `app/api/activity-reg-categories-public/route.ts` updated to also return
     `description` and `cover_image_url` for the session (previously not selected).
   - **Found and fixed a real, previously-unreported bug**: the dropdown field type has
     always rendered correctly on the public register page (`field.options.map(...)`), but
     the **admin category builder had no input to actually type those options in** — so every
     dropdown field was silently empty. Added a comma-separated options input next to any
     field set to "Dropdown" in `app/admin/activity-registration/[sessionId]/page.tsx`. (Date
     type was already fully wired both in the type picker and as a native `<input
     type="date">` on the register page — that one was already fine in this codebase.)
   - Added an admin-settable **max file size (MB)** input for any registration-time field set
     to Photo/File (was already present for post-registration `submission_config` fields, but
     missing for the `custom_fields` used during registration itself) — wired through to
     `CustomField.max_file_size_mb`, and the register page now enforces it client-side before
     upload and shows it in the upload button text (#12, registration-time half).
5. **Read the full exam/wizard engine and fixed a real regression (#4, #5, relay/exam/MCQ/photo safety check)** — done, with an important architecture discovery:
   - There are **two parallel exam engines** in this codebase:
     1. **Legacy**: `app/olympiad/page.tsx` + `olympiad_registrations` table + `/api/olympiad-register`. Fully self-contained, with its own identity form, MCQ/short/photo question rendering, timer, autosave, scheduled start/end, and a detailed results-breakdown screen. This is what your screenshots (images 3 & 4) are showing — it is **still live and still the only thing linked from `/olympiad`**.
     2. **New/unified**: `app/activities/[slug]/dashboard/page.tsx` + `app/activities/[slug]/relay-exam/page.tsx` + `relay_exam_state` table + `/api/relay-exam`. This is the newer engine built specifically to live *inside* the Activity registration flow (exactly the "Olympiad is not separate" architecture from §2) — it already supports relay mode, subject self-select, chain-relay variable substitution, MCQ, short answer, and the file/text submission form. **This is clearly the direction the codebase was already heading in** — it's the right engine to finish, not the legacy one.
   - **Found and fixed a real regression**: the new engine's `relay-exam/page.tsx` declared a `'photo'` question type but **never actually rendered it** — only MCQ and short-answer questions showed up, so any olympiad with photo-answer questions would silently break on this newer page even though the legacy page handled photo questions fine. Added the missing photo upload UI (same upload pattern as the registration page), wired it into the existing `submitMyTurn` so a pending upload that hadn't finished when the timer ran out gets retried at submit time (mirroring exactly how the legacy engine handled this), and added an uploading/uploaded visual state. **No relay logic, timer logic, MCQ logic, short-answer logic, or submission-config logic was touched** — this was strictly additive.
   - **Not yet done** (tracked below, not lost): the new engine's "done" screen has no results/question-breakdown view yet (the legacy one does — score, correct/incorrect per question, marked answer sheet image). This needs to be ported over before the legacy `/olympiad` page can be safely retired, otherwise students lose that feature.

5b. **Result-breakdown UI ported to the new exam engine** (prerequisite for step 7) — done:
   - `api/relay-exam/route.ts` (`submit_member`): now auto-scores MCQ answers and builds the
     same per-question breakdown (`question_id, question_text, type, student_answer,
     correct_answer, is_correct, marks_awarded, marks_possible`) the legacy engine always
     built, storing it on that member's entry in `member_submissions`. Subject-filtered (only
     scores against the questions for the member's assigned subject, if any).
   - `relay-exam/page.tsx` "done" screen: now shows the full score + question-breakdown view
     (score, /per question, correct answer reveal for missed MCQs, uploaded-photo link)
     once `olympiad.result_published` is true — identical UX to the legacy page's result
     screen. Before publication, still shows the plain "Submitted!" message as before.
   - **Found and fixed a second real bug while wiring this up**: `startExam()` only created
     the `relay_exam_state` row when `olympiad.relay_mode` was true. For a plain single-person
     online exam (not a team relay), no state row was ever created, so `submit_member` would
     always fail at the end with "Relay not started yet." — meaning **any non-relay live exam
     in the new engine was completely unsubmittable**. Fixed: the state row is now created for
     every exam, relay or not (this table doubles as the generic per-registration exam-progress
     tracker, not just a relay-specific one).
   - **Not yet ported**: the legacy page's "marked answer sheet image" display (for offline
     photo-only submissions reviewed by an organizer) and `organizer_note` — these belong to
     the `olympiad_registrations` flow specifically and are a step-8/step-14 concern (organizer
     marking against the new engine's data shape), not step-5.

6. Confirm dashboard layout (#6) — mostly done already (cover photo/title/short-desc present in `dashboard/page.tsx` per the earlier grep), needs one more pass once §7/§8 land.
7. **Rebuild `/olympiad` public page** (#7) — done:
   - New endpoint `api/activity-online-categories-public/route.ts`: returns one card per
     top-level Activity category ("primary field") whose subtree contains at least one open
     online leaf, sourced entirely from `activity_reg_categories` + `activity_sessions` — no
     `olympiads` table involved in building this list at all.
   - `app/olympiad/page.tsx` list view now renders from this new endpoint (session title,
     primary-field name/description, the activity session's own cover photo) instead of the
     standalone `olympiads` table. "Register Now" routes to
     `/activities/[slug]/register?start=<categoryId>` — the *same* Activity register flow,
     not a separate form.
   - `app/activities/[slug]/register/page.tsx`: added `?start=<categoryId>` support — on load,
     builds the full ancestor chain for that category and pre-fills `path`, so the picker opens
     one level *inside* that primary field instead of showing the top-level list (exactly your
     "ekta step kome gelo" spec). If the deep-linked category happens to be a leaf itself, skips
     straight to its form after the identity step. (Needed wrapping the page in `<Suspense>`
     since it now reads `useSearchParams()` — required by Next.js, purely structural, no
     behavior change for normal non-deep-link visits.)
   - **Kept, deliberately, for backward compatibility**: the rest of `/olympiad/page.tsx`
     (register/dashboard/exam/done/result phases, the `olympiads` table fetch, `?id=` and
     `?reg=` resume-by-localStorage logic) is untouched. Anyone who already has an in-progress
     legacy registration (saved reg id, or an old shared link) can still finish it exactly as
     before. Only the **list/entry view** now points new visitors into the unified flow. Full
     retirement of the legacy register/exam code in this file is a later cleanup step, *after*
     admin/organizer parity (steps 8–9, 14) — not before, so nothing currently in progress for
     a real student gets cut off mid-exam.
8. **Admin Olympiad page now Activity-aware** (#8) — done, in a deliberately non-destructive
   way (nothing deleted or hidden, only labeled and guided):
   - New admin endpoint `api/admin/online-categories/route.ts`: returns every
     `activity_reg_categories` leaf with a `linked_olympiad_id`, across all sessions, with a
     breadcrumb (session → primary field → ... → leaf) and a summary of its registration
     structure (custom fields count, team/payment flags, open/closed).
   - Every olympiad card in `admin/olympiads/page.tsx` now shows either "From Activity:
     SessionTitle → ... → LeafName" (clickable, jumps straight to that session's Activity
     registration editor) for linked ones, or "Standalone (not linked to any Activity)" for
     legacy freestanding ones — so admin can immediately tell which is which.
   - The "Registration Fields" editor in the edit form is now **read-only + redirected** for
     linked olympiads (shows a summary and a button to "Edit registration fields in Activity
     admin" instead of duplicate editable inputs) — per your rule that registration structure
     is Activity's job, not Olympiad's. **Standalone olympiads keep the exact same full editor
     as before** — nothing was removed for them.
   - Questions/MCQ/timer/relay/subjects/scheduling/result-publishing editors are **completely
     unchanged** for both linked and standalone olympiads — that content genuinely is
     Olympiad's job per §2, so it stays fully editable everywhere.
   - Added a guidance line above "New Olympiad" pointing admins to create things from
     Activities first; the button itself still works as before for genuinely standalone exams
     (kept, not removed, for backward compatibility/edge cases).
   - Delete now shows a stronger warning naming the linked Activity category when deleting a
     linked olympiad, since that would silently break that category's online registration.
9. **Registrants list view on Admin Activity Registration page** (#9) — done:
   - New endpoint `api/admin/activity-registrations-list/route.ts`: every registrant for a
     session, each tagged with its full category breadcrumb (e.g. "Online → Class 9-10 →
     Physics"), team size, payment status, and whether its category is an online leaf.
     Deliberately excludes submission files/exam answers — that stays on the Olympiad/organizer
     side per your instruction, so nothing is duplicated between the two admin views.
   - `admin/activity-registration/[sessionId]/page.tsx` now has a Builder / Registrants tab
     switcher. Registrants tab: searchable (name/phone/email/category) list, with a detail
     modal per registrant showing contact info, college/roll, team members if any, and payment
     status. Builder tab is exactly what was already there, untouched.

10. **Verified (#10)** — already fully present, no changes needed: every leaf has the
   "online-submission / exam round" checkbox (= online vs offline), `submission_config` for
   what students upload/fill on submit, and a direct link into the linked Olympiad's admin page
   to set `exam_type` (submission-only / live-only / mixed) plus relay mode and subject
   assignment — that's exactly the "submission / live exam / both / relay" choice from your
   spec, just split across the two admin pages per the ownership rule in §2 (Activity owns
   registration structure + online/offline; Olympiad owns exam *content*).
11. **Per-category "registration open" toggle (#11)** — done, at every level (leaf AND
   primary field, per your confirmation):
   - `MIGRATION_V7.sql` (new file, run after V6): adds `registration_open boolean default true`
     to `activity_reg_categories`.
   - Admin category builder (`admin/activity-registration/[sessionId]/page.tsx`): every node
     (leaf or non-leaf) now has an "Accepting new registrants / Closed to new registrants"
     checkbox right under its name/description.
   - Closing a non-leaf (primary field) automatically closes everything nested under it too,
     even if a child was individually left open — enforced both when building the public
     picker list and at submit time.
   - `api/activity-reg-categories-public/route.ts`: closed categories (and all descendants)
     are filtered out of what the public register-page picker even sees — they don't show up
     as a dead-end option, they just don't appear.
   - `api/activity-register/route.ts` (POST): also re-checks `registration_open` server-side,
     walking the full ancestor chain, so a closed category can't be registered against even via
     a direct API call (race condition where someone closes registration while a student has
     the form open) — not just hidden on the client.
12. File-size limits — **fully confirmed done** at every layer: registration-time
   `custom_fields` (client-enforced, added in step 4), and post-registration
   `submission_config` fields in the dashboard (already server-enforced in
   `api/activity-upload/route.ts` via `max_size_mb` — verified, no change needed).
13. Re-verify nothing in the relay system, exam timer, MCQ engine, short-answer engine,
   photo/file upload options, or the marking/scoring system regressed — explicit instruction,
   ongoing throughout. Two real regressions/bugs were found and fixed along the way (missing
   photo-question rendering in the new exam engine, and non-relay exams never creating their
   state row) — nothing else was found broken during this pass, but this check should keep
   happening any time these files are touched again.
14. ️ **Known, deliberately NOT done this round — organizer/marking parity for the new
   engine.** This needs to be said plainly rather than glossed over: `app/organizer/page.tsx`
   and `api/organizer/registrations/route.ts` still only read from the **legacy**
   `olympiad_registrations` table. They have no idea the new `relay_exam_state` /
   `activity_registrations` engine (the one `/olympiad` now routes people into) exists. That
   means **right now, an organizer cannot see or mark a single submission that came through the
   new unified flow** — only ones that came through the old standalone `/olympiad` register
   form. This is exactly the kind of "feature exists but is incomplete" gap you asked me to
   watch for, and it's the single biggest remaining piece before the legacy flow can be safely
   retired. It was not attempted in this round because organizer marking directly affects how
   students get scored — rushing it risked producing a half-correct marking view, which is a
   worse outcome than clearly flagging it as the next priority. **This should be the very next
   task in a future session**: give the organizer page (and the admin Olympiad page's own
   marking view) a second data source for `relay_exam_state.member_submissions[].question_results`
   /short-answer/photo answers, alongside the existing `olympiad_registrations`-based view —
   not replacing it, since legacy registrations still need marking too.

Each step above should be its own focused session/commit — this is too large for one pass,
and you've hit response limits mid-session before. After each step, this file should be
updated (checked-off items + any new findings) so a fresh Claude instance can resume exactly
here without re-discovering all of the above.

## 4. Open questions for you

1. Is this zip currently deployed, or ahead of what's live?
2. For the Olympiad page's "Register" button — confirm: clicking it should land the user on
   the *same* `/activities/[slug]/register` flow, pre-selecting that primary field and
   skipping straight to its sub-categories — correct?
3. For payment: should it remain SSLCommerz only, last step before "Complete Registration"?
4. Should the "registration open/closed" toggle live per-leaf, per-primary-field, or both?
