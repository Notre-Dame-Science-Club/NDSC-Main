/**
 * NDSC Supabase data import (for the NEW project)
 * ------------------------------------------------
 * Loads the JSON files produced by export-supabase-data.js into a new
 * Supabase project. Run db/schema.sql on the new project FIRST.
 *
 * Usage:
 *   1. Create a NEW Supabase project.
 *   2. Run db/schema.sql in its SQL Editor.
 *   3. Copy your NEW project's URL + service role key into a .env.local
 *      here (or edit NEW_SUPABASE_URL / NEW_SERVICE_ROLE_KEY below).
 *   4. Place this file next to the supabase-export/ folder produced by
 *      export-supabase-data.js.
 *   5. npm install @supabase/supabase-js dotenv
 *   6. node scripts/import-supabase-data.js
 *
 * Tables are inserted in dependency order (parents before children) so
 * foreign keys resolve correctly.
 */

const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const NEW_SUPABASE_URL = process.env.NEW_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const NEW_SERVICE_ROLE_KEY = process.env.NEW_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!NEW_SUPABASE_URL || !NEW_SERVICE_ROLE_KEY) {
  console.error('Set NEW_SUPABASE_URL and NEW_SUPABASE_SERVICE_ROLE_KEY (in .env.local or env vars)')
  console.error('pointing at your NEW Supabase project — not the old one.')
  process.exit(1)
}

const supabase = createClient(NEW_SUPABASE_URL, NEW_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

// Parents first, children after — required for FK constraints to succeed.
const IMPORT_ORDER = [
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
  'olympiads', // before activity_reg_categories (linked_olympiad_id FK)
  'activity_reg_categories',
  'activity_registrations',
  'payment_transactions',
  'activity_submissions',
  'relay_exam_state',
  'team_subject_assignments',
  'olympiad_registrations',
  'form_configs',
  'surveys',
  'survey_responses',
]

const JSON_DIR = path.join(__dirname, 'supabase-export', 'json')
const BATCH_SIZE = 500

async function importTable(table) {
  const file = path.join(JSON_DIR, `${table}.json`)
  if (!fs.existsSync(file)) {
    console.log(`  ${table}: no export file found, skipping`)
    return
  }
  const rows = JSON.parse(fs.readFileSync(file, 'utf-8'))
  if (rows.length === 0) {
    console.log(`  ${table}: 0 rows, skipping`)
    return
  }

  let inserted = 0
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    const { error } = await supabase.from(table).upsert(batch)
    if (error) {
      console.error(`  ${table}: FAILED at batch starting row ${i} — ${error.message}`)
      return
    }
    inserted += batch.length
  }
  console.log(`  ${table}: ${inserted} rows imported`)
}

async function main() {
  console.log(`Importing into: ${NEW_SUPABASE_URL}\n`)
  console.log('Make sure you already ran db/schema.sql on this project.\n')

  for (const table of IMPORT_ORDER) {
    await importTable(table)
  }

  console.log('\nDone. Notes:')
  console.log('  - auth.users / auth-users.json is NOT imported by this script.')
  console.log('    Passwords cannot be recovered — recreate accounts via')
  console.log('    supabase.auth.admin.createUser() with the same emails, or send')
  console.log('    password-reset invites, then let members.id map to the new')
  console.log('    auth.users.id.')
  console.log('  - Re-check RLS policies before going live (see bottom of db/schema.sql).')
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
