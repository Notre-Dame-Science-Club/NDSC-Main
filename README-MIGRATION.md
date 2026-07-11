# NDSC → New Supabase Project Migration

You have live credentials in your project's `.env.local` (URL, anon key,
service role key), so your **data is not actually lost** — you just can't
reach the dashboard. The service role key bypasses Row Level Security, so
it can read everything, including rows only admins normally see.

## Step 1 — Export from the OLD project

1. Copy `export-supabase-data.js` into the root of your NDSC project
   (next to `package.json` and `.env.local`).
2. Install dependencies if you don't already have them:
   ```
   npm install @supabase/supabase-js dotenv
   ```
3. Run it:
   ```
   node export-supabase-data.js
   ```
4. You'll get a `supabase-export/` folder containing:
   - `json/<table>.json` — full row data per table
   - `csv/<table>.csv` — same data, spreadsheet-friendly
   - `auth-users.json` — your `auth.users` list (emails, ids, metadata)
   - `_summary.json` — row counts, so you can sanity-check nothing's empty
     that shouldn't be

   **Passwords are not exportable** — Supabase hashes them irreversibly and
   never exposes them, even to the service role key. This is expected and
   not something lost due to your lockout.

## Step 2 — Set up the NEW project

1. Create a new Supabase project at supabase.com.
2. Open its SQL Editor and run all of `schema.sql` (recreates every table,
   matching what your app code actually expects — see the caveats comment
   at the top of that file).
3. Copy your **new** project's URL and service role key (Project Settings →
   API) somewhere you'll reference in Step 3.

## Step 3 — Import into the NEW project

1. Copy `import-supabase-data.js` next to your `supabase-export/` folder.
2. Add the new project's credentials, either as environment variables or
   in a `.env.local`:
   ```
   NEW_SUPABASE_URL=https://xxxx.supabase.co
   NEW_SUPABASE_SERVICE_ROLE_KEY=your-new-service-role-key
   ```
3. Run:
   ```
   node import-supabase-data.js
   ```
   Tables import in dependency order so foreign keys resolve correctly.

## Step 4 — Recreate auth.users

Since passwords can't be migrated, for each row in `auth-users.json` either:
- Call `supabase.auth.admin.createUser({ email, email_confirm: true })` on
  the new project (same `id` isn't preservable via that call — you'd then
  need to update `members.id` to match the new auth id), or
- Simpler: keep `members.id` as-is (already imported), then have each
  member sign up fresh on the new project and, in an admin script, update
  their new `auth.users.id` back onto their existing `members` row by
  matching on `email`.

## Step 5 — Update your app

1. Update `.env.local` (and any hosting provider's environment variables —
   Vercel, etc.) with the new project's URL and keys.
2. Re-check RLS policies (schema.sql includes a commented starting point) —
   these were not recoverable from your codebase and need to be redefined
   for your security model before going live.
3. Re-upload any storage bucket files (images, PDFs) if you used Supabase
   Storage — this script only covers Postgres table data, not Storage
   buckets. Let me know if you also need a Storage migration script.

## If something in export fails

If a specific table errors out (e.g. `appearance_settings` may not
actually exist — the app reuses `homepage_settings` for that instead), the
script logs it and continues with the rest. Check `_summary.json` after
running to see exactly what succeeded.
