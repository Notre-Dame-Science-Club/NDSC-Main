# Local Testing Guide - Olympiad Migration

**Before running ANY database migrations on production**, follow this guide to test all changes locally.

## Prerequisites

- Docker Desktop installed and running
- Node.js installed
- Project dependencies installed (`npm install`)

## Step 1: Start Local Database

```bash
# Navigate to project root
cd D:\Projects\Websites\NDSC-Main\main

# Start local Postgres + PostgREST
npm run db:up

# Wait for containers to be healthy (about 10 seconds)
docker ps
```

You should see two containers running:
- `ndsc-local-db` (Postgres)
- `ndsc-local-postgrest` (REST API)

## Step 2: Initialize Database with Current Schema

```bash
# Apply the unified master schema (includes everything BEFORE our new migrations)
npm run db:init

# This runs: scripts/init-local-db.js
# Which applies: db/00_UNIFIED_MASTER_SCHEMA.sql
```

**IMPORTANT:** At this point, the database still has the OLD schema with:
- ✅ `olympiads.questions` column (still exists)
- ✅ `olympiads.registration_fields` column (still exists)
- ❌ `olympiads.parent_activity_session_id` (doesn't exist yet)

## Step 3: Verify Current Code Works (Pre-Migration)

```bash
# Start the Next.js dev server
npm run dev:local

# Server should start at http://localhost:3000
```

### Test Checklist (Pre-Migration State):

1. **Admin Login**
   - Go to: http://localhost:3000/admin
   - Login with admin credentials
   - Should load without errors

2. **Form Builder Access**
   - Navigate to: http://localhost:3000/admin/form-builder
   - Click "New form graph"
   - Create a test olympiad form graph
   - ✅ **Copy UUID button** should work (click icon, should show checkmark)

3. **Olympiad Admin Basic Functions**
   - Go to: http://localhost:3000/admin/olympiads
   - Click "+ New Olympiad"
   - Fill in basic info (name, description)
   - Upload cover image
   - Save
   - Should save successfully (even though we removed `questions`/`registration_fields` from API)

4. **Dashboard Routing Fix**
   - Create a test olympiad with `is_active: true` and `scheduled_start_at` in the future
   - Go to: http://localhost:3000/dashboard
   - Find the olympiad in "Live/Upcoming" section
   - Click the olympiad card
   - ✅ **Should go directly to** `/register/olympiad/[id]` (NOT `/olympiad?id=...`)

If any of these fail, STOP and debug before proceeding.

## Step 4: Apply New Migrations

Now that we've verified the current code works, apply our new migrations:

```bash
# Connect to local database and apply migrations
docker exec -i ndsc-local-db psql -U postgres -d postgres < db/27_migration_drop_olympiad_legacy_columns.sql

docker exec -i ndsc-local-db psql -U postgres -d postgres < db/28_migration_olympiad_parent_activity.sql
```

Verify migrations applied successfully:

```bash
# Check that columns were dropped
docker exec -it ndsc-local-db psql -U postgres -d postgres -c "\d olympiads"
```

You should see:
- ❌ `questions` column is GONE
- ❌ `registration_fields` column is GONE  
- ✅ `parent_activity_session_id` column EXISTS

## Step 5: Verify Post-Migration Functionality

### Test Checklist (Post-Migration State):

1. **API Routes Still Work**
   - Restart dev server (Ctrl+C, then `npm run dev:local`)
   - Go to: http://localhost:3000/admin/olympiads
   - Try to create a new olympiad
   - Should work (no longer tries to insert into dropped columns)
   - ✅ Check browser console - no errors about missing columns

2. **Form Builder Integration**
   - Go to existing olympiad's Form Builder
   - Add a `preset_olympiad_questions` node
   - Add MCQ questions with subjects (for relay mode)
   - Save
   - Should save to `form_nodes.fields` (not old `olympiads.questions`)

3. **Question Reading (Server-Side)**
   - Open browser dev tools → Network tab
   - Go to: http://localhost:3000/api/admin/olympiads
   - Check the response JSON
   - Each olympiad should have a `questions` array (synthesized from form_nodes)
   - ✅ Questions come from `getOlympiadQuestionFields()` helper

## Step 6: Test Olympiad Admin Refactor (When Ready)

Once you complete the olympiad admin refactor code:

1. **Form Graph Picker**
   - Create a form graph via Form Builder
   - Copy its UUID
   - Edit an olympiad
   - New section should appear: "FORM & CONTENT LINKING"
   - Paste UUID or select from dropdown
   - Save
   - Reload - should persist

2. **Parent Activity Linking**
   - Create a test Activity session
   - Edit an olympiad
   - Set "Parent Activity" to the test activity
   - Save
   - Go to: http://localhost:3000/olympiad
   - That olympiad card should show "Register for [Activity]" instead of direct form

## Step 7: End-to-End Olympiad Flow

Test the complete user journey:

1. **Registration**
   - As a visitor, go to: http://localhost:3000/olympiad
   - Click an olympiad
   - Should go to: `/register/olympiad/[id]`
   - Fill out registration form
   - Submit
   - Should succeed

2. **Exam Taking (Normal Mode)**
   - Create olympiad with questions via Form Builder
   - Register
   - Take exam
   - Submit answers
   - Should save to `olympiad_registrations.mcq_answers` etc.

3. **Exam Taking (Relay Mode)**
   - Create relay olympiad with subjects
   - Add questions with `subject_id` assigned
   - Register as team
   - Assign subjects to members
   - Each member takes exam
   - Should only see questions for their subject

4. **CSV Export**
   - Go to: http://localhost:3000/admin/olympiads
   - Click "Registrations" for an olympiad with submissions
   - Click "CSV" button
   - Should download CSV with question columns
   - Open CSV - should have columns like "Q1", "Q2", etc.

## Step 8: Database Cleanup (If You Want to Start Fresh)

```bash
# Complete reset - destroys ALL local data
npm run db:reset

# This will:
# 1. Stop containers and delete volumes
# 2. Start containers fresh
# 3. Apply unified schema
# 4. Apply migrations
# 5. Seed test data
```

## Troubleshooting

### Docker containers won't start
```bash
# Check if port 5432 is already in use
netstat -ano | findstr :5432

# If something is using it, either stop that service or change the port in docker-compose.local.yml
```

### Database connection errors
```bash
# Check .env.local has correct settings
cat .env.local | grep SUPABASE

# Should point to local PostgREST:
NEXT_PUBLIC_SUPABASE_URL=http://localhost:3001
NEXT_PUBLIC_SUPABASE_ANON_KEY=<dev-jwt-token>
SUPABASE_SERVICE_ROLE_KEY=<dev-jwt-token>
```

### Migration fails with "column already exists"
```bash
# Migrations use IF EXISTS / IF NOT EXISTS, so they're idempotent
# If it fails, check which migration failed and why:
docker exec -it ndsc-local-db psql -U postgres -d postgres

# Then manually inspect:
\d olympiads
```

### Code changes not reflecting
```bash
# Restart dev server
Ctrl+C
npm run dev:local
```

## When Everything Passes

Once all tests pass locally:

1. ✅ Commit all code changes to git
2. ✅ Push to staging/preview branch
3. ✅ Run migrations on staging Supabase
4. ✅ Test on staging environment
5. ✅ Only then run migrations on production

## Quick Test Commands

```bash
# Full cycle from scratch
npm run db:reset && npm run dev:local

# Just restart database (keeps data)
npm run db:down && npm run db:up

# Just restart dev server
# Ctrl+C, then:
npm run dev:local

# Check database schema
docker exec -it ndsc-local-db psql -U postgres -d postgres -c "\d olympiads"

# Check what's running
docker ps
```

---

**Created:** 2026-09-24 19:06 UTC  
**Related:** OLYMPIAD_MIGRATION_STATUS.md
