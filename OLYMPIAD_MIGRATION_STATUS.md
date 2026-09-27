# Olympiad → Form-Graph Migration Status

**Last Updated:** 2026-09-25 05:15 UTC

## ✅ Completed Work

### 1. Verification (Step 0)
- ✅ Verified all claimed migration work from previous session is correct:
  - `lib/formBlocks.ts` has `subject_id?: string` field
  - `lib/server/olympiadQuestions.ts` exists and works correctly
  - `components/admin/FormBlocksBuilder.tsx` has subject picker for relay mode
  - API routes use `getOlympiadQuestionFields()` helper
  - Admin olympiad page's legacy editor was removed

### 2. Dashboard Routing Fix (Step 2)
- ✅ **File:** `app/dashboard/page.tsx`
- ✅ Changed lines 462 & 475 from `/olympiad?id=${o.id}` to `/register/olympiad/${o.id}`
- ✅ Eliminates "confusing double register" UX — dashboard now links directly to registration form

### 3. Olympiad Admin Content/Form Linking (Step 3)
- ✅ **File:** `app/admin/olympiads/page.tsx`
- ✅ Added "Form & Content Linking" UI section in editing modal (after Basic Info, before Exam Settings)
- ✅ Shows attached form graph status with Create/Detach buttons
- ✅ Links to Form Builder for editing attached form graphs
- ✅ Parent Activity picker for informational olympiad entries
- ✅ `useEffect` hook to load attached form graph when editing modal opens
- ✅ Backend functions already existed: `loadAttachedFormGraph()`, `createFormGraph()`, `detachFormGraph()`
- ✅ **File:** `app/olympiad/page.tsx`
- ✅ Added `parent_activity_session_id` to Olympiad type
- ✅ Fetches activity session details for olympiads with parent activities
- ✅ Shows "Register for [Activity]" CTA when parent activity is set
- ✅ Routes to `/activities/[slug]/register` instead of olympiad's own form

### 4. Copy UUID Button (Step 4)
- ✅ Already exists in `app/admin/form-builder/page.tsx` (lines 203-205)
- ✅ Copies form graph UUID to clipboard with visual confirmation

### 4. SQL Migrations (Step 1)
- ✅ **Created:** `db/27_migration_drop_olympiad_legacy_columns.sql`
  - Drops `olympiads.questions` column
  - Drops `olympiads.registration_fields` column
  - Safe to run (no olympiad data exists)

- ✅ **Created:** `db/28_migration_olympiad_parent_activity.sql`
  - Adds `olympiads.parent_activity_session_id` column
  - Enables purely informational olympiad entries that link to parent Activity

- ✅ **Updated:** `db/00_UNIFIED_MASTER_SCHEMA.sql`
  - Removed `registration_fields` and `questions` columns from olympiads table definition
  - Added `parent_activity_session_id` column with FK constraint

### 5. Code Cleanup
- ✅ **File:** `app/api/admin/activity-reg-categories/route.ts`
- ✅ Removed `registration_fields: []` and `questions: []` from `createLinkedOlympiad()`

## ⏳ Remaining Work

### 1. Database Schema Updates

- [ ] Run migration: `db/28_migration_olympiad_parent_activity.sql` (adds `parent_activity_session_id` column)
- [ ] Run migration: `db/27_migration_drop_olympiad_legacy_columns.sql` (drops `questions` and `registration_fields` columns)
- [ ] Verify schema changes work with admin UI and API routes

### 2. API Route Verification

- [ ] Verify `/api/admin/olympiads` GET/PUT handles `parent_activity_session_id` correctly
- [ ] Verify `/api/olympiad` listing endpoint returns `parent_activity_session_id`

## 🧪 Testing Tasks (Require Running Instance)

These cannot be completed without a dev/local Supabase instance:

1. **Test form builder with preset_olympiad_questions**
   - Create test olympiad
   - Add preset_olympiad_questions node
   - Verify subject picker appears for relay mode
   - Verify MCQ/checkbox/short_answer questions save correctly

2. **Test normal olympiad exam flow**
   - Register for non-relay olympiad
   - Take exam
   - Verify ResponseDetailModal shows questions correctly

3. **Test relay-mode olympiad flow**
   - Register team for relay olympiad
   - Assign subjects to members
   - Take exam with subject filtering
   - Verify scoring works with `subject_id` filter

4. **Test registrations CSV export**
   - Create olympiad with questions
   - Add registrations
   - Export CSV at `/api/admin/olympiads/[olympiadId]/registrations.csv`
   - Verify column headers and data

5. **Test API list endpoints**
   - Verify `/api/admin/olympiads` loads without error
   - Verify `/api/organizer/olympiads` loads without error
   - Verify question count is correct

## 📋 Files Changed

### Modified Files (This Session - 2026-09-25)
1. `app/admin/olympiads/page.tsx` — Added Form & Content Linking UI section with create/detach form graph buttons and parent activity picker
2. `app/olympiad/page.tsx` — Added parent activity support: fetches activity sessions, shows "Register for [Activity]" CTA when parent is set
3. `OLYMPIAD_MIGRATION_STATUS.md` — Updated status to reflect completed Step 3 work

### Modified Files (Previous Session - 2026-09-24)
1. `app/dashboard/page.tsx` — Dashboard routing fix
2. `app/api/admin/activity-reg-categories/route.ts` — Removed legacy fields
3. `db/00_UNIFIED_MASTER_SCHEMA.sql` — Updated olympiads table definition

### New Files
1. `db/27_migration_drop_olympiad_legacy_columns.sql` — Drop legacy columns
2. `db/28_migration_olympiad_parent_activity.sql` — Add parent activity FK

### Files Verified (No Changes Needed)
- `lib/formBlocks.ts`
- `lib/server/olympiadQuestions.ts`
- `components/admin/FormBlocksBuilder.tsx`
- `app/api/relay-exam/route.ts`
- `app/api/olympiad/route.ts`
- `app/api/admin/form-graphs/[id]/route.ts`
- `app/admin/form-builder/page.tsx`
- `app/admin/form-builder/[graphId]/node/[nodeId]/page.tsx`

## ⚠️ Important Notes

1. **Zero Data Loss Risk:** No olympiad registrations exist in production, so schema changes are safe.

2. **Don't Touch Activities:** Never modify schema or data for:
   - `activities`
   - `activity_registrations`
   - `activity_reg_categories`
   - `activity_submissions`

3. **Form Graphs are Source of Truth:** After migration runs, all olympiad questions and registration fields must be managed through Form Builder (`/admin/form-builder`).

4. **Dead Route:** The POST handler in `app/api/olympiad-register/route.ts` is still actively used for creating registrations — **do not delete it**. Only the GET handler was confirmed unused, but it's also used for resume functionality, so keep the entire file.

5. **Scheduled Child Forms (Spec Point 3):** Intentionally out of scope for this pass — deferred as separate architectural work.

## 🚀 Next Steps

1. **Immediate:** Complete olympiad admin refactor by adding form graph picker and parent activity linking
2. **After Code Complete:** Run migrations on dev/staging Supabase
3. **Testing:** Execute all 5 testing tasks with live data
4. **Production:** After successful testing, run migrations on production

## 📝 How to Continue This Work

If resuming in a new session:

1. Read this file first for context
2. Pick up at "Remaining Work" section
3. Start with olympiad admin refactor (most complex remaining task)
4. Test locally before deploying to production

---

**Migration initiated:** Previous session  
**Status document created:** 2026-09-24 19:01 UTC  
**Completion estimate:** ~2-3 hours (code) + testing time
