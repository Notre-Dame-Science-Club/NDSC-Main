/**
 * NDSC Supabase full data export
 * -------------------------------
 * Pulls every row from every known table using the SERVICE ROLE key
 * (bypasses RLS, so this gets everything including admin-only rows).
 *
 * Usage:
 *   1. Run from the project root (this file lives in scripts/, but Node still resolves .env.local from the cwd)
 *   2. npm install @supabase/supabase-js dotenv
 *   3. node scripts/export-supabase-data.js
 *
 * Output:
 *   ./supabase-export/json/<table>.json   (array of row objects)
 *   ./supabase-export/csv/<table>.csv     (flattened, jsonb columns as JSON strings)
 *   ./supabase-export/auth-users.json     (from auth.users, via admin API)
 *   ./supabase-export/_summary.json       (row counts per table)
 */

const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

// Every table found in the codebase (app/**/*.ts .from() calls) +
// appearance_settings from schema_update_04.sql (may be empty/unused —
// the app actually reuses homepage_settings for appearance, see
// app/api/admin/appearance-settings/route.ts).
const TABLES = [
  'admins',
  'members',
  'member_shoutbox',
  'announcements',
  'executives',
  'publications',
  'science_media',
  'homepage_settings',
  'appearance_settings',
  'activities',
  'activity_types',
  'activity_versions',
  'activity_sessions',
  'activity_reg_categories',
  'activity_registrations',
  'payment_transactions',
  'activity_submissions',
  'relay_exam_state',
  'team_subject_assignments',
  'olympiads',
  'olympiad_registrations',
  'form_configs',
  'surveys',
  'survey_responses',
]

const OUT_DIR = path.join(__dirname, 'supabase-export')
const JSON_DIR = path.join(OUT_DIR, 'json')
const CSV_DIR = path.join(OUT_DIR, 'csv')

for (const dir of [OUT_DIR, JSON_DIR, CSV_DIR]) {
  fs.mkdirSync(dir, { recursive: true })
}

const PAGE_SIZE = 1000

async function fetchAllRows(table) {
  let allRows = []
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .range(from, from + PAGE_SIZE - 1)

    if (error) {
      // Table might not exist (e.g. appearance_settings never actually created) — report, don't crash.
      return { error: error.message, rows: allRows }
    }
    if (!data || data.length === 0) break
    allRows = allRows.concat(data)
    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return { error: null, rows: allRows }
}

function csvEscape(value) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') value = JSON.stringify(value)
  const str = String(value)
  if (/[",\n\r]/.test(str)) {
    return '"' + str.replace(/"/g, '""') + '"'
  }
  return str
}

function rowsToCsv(rows) {
  if (rows.length === 0) return ''
  // Union of all keys across rows (rows can have slightly different shapes)
  const columns = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((k) => set.add(k))
      return set
    }, new Set())
  )
  const header = columns.map(csvEscape).join(',')
  const lines = rows.map((row) => columns.map((col) => csvEscape(row[col])).join(','))
  return [header, ...lines].join('\n')
}

async function exportAuthUsers() {
  let allUsers = []
  let page = 1
  const perPage = 1000
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
    if (error) {
      console.warn('  auth.users export failed:', error.message)
      return null
    }
    allUsers = allUsers.concat(data.users)
    if (data.users.length < perPage) break
    page += 1
  }
  return allUsers
}

async function main() {
  console.log(`Exporting from: ${SUPABASE_URL}\n`)
  const summary = {}

  for (const table of TABLES) {
    process.stdout.write(`Exporting ${table} ... `)
    const { error, rows } = await fetchAllRows(table)
    if (error) {
      console.log(`SKIPPED (${error})`)
      summary[table] = { error }
      continue
    }
    fs.writeFileSync(path.join(JSON_DIR, `${table}.json`), JSON.stringify(rows, null, 2))
    fs.writeFileSync(path.join(CSV_DIR, `${table}.csv`), rowsToCsv(rows))
    console.log(`${rows.length} rows`)
    summary[table] = { rows: rows.length }
  }

  process.stdout.write(`Exporting auth.users ... `)
  const users = await exportAuthUsers()
  if (users) {
    fs.writeFileSync(path.join(OUT_DIR, 'auth-users.json'), JSON.stringify(users, null, 2))
    console.log(`${users.length} users`)
    summary['auth.users'] = { rows: users.length }
  }

  fs.writeFileSync(path.join(OUT_DIR, '_summary.json'), JSON.stringify(summary, null, 2))

  console.log(`\nDone. Everything is in ./supabase-export/`)
  console.log(`  - json/<table>.json  → re-importable row data`)
  console.log(`  - csv/<table>.csv    → for spreadsheet viewing`)
  console.log(`  - auth-users.json    → auth.users (emails, ids, metadata — NOT passwords)`)
  console.log(`  - _summary.json      → row counts per table`)
  console.log(`\nNote: auth.users passwords cannot be exported (Supabase hashes them`)
  console.log(`irreversibly and never exposes them, even via service role). Users will`)
  console.log(`need to reset passwords, or you re-create accounts with the same emails`)
  console.log(`and send password-reset invites after importing into the new project.`)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
