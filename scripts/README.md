# Scripts

Standalone maintenance/migration tooling. None of this is part of the
Next.js app build — run each file directly, from the **project root** (not
from inside `scripts/`), so `.env.local`/`.env` resolve correctly:

```
node scripts/list-admins.js
node scripts/export-supabase-data.js
node scripts/import-supabase-data.js
python scripts/export_storage_files.py
python scripts/migrate.py --all
```

## Setup

- **Node scripts** need `dotenv` (and `@supabase/supabase-js`, already a
  root app dependency). Run `npm install` once inside this folder:
  `cd scripts && npm install`.
- **Python scripts** need `pip install -r scripts/requirements.txt`.

## What each one does

| Script | Purpose |
|---|---|
| `list-admins.js` | Prints all rows from the `admins` table. |
| `export-supabase-data.js` | Dumps every table (JSON + CSV) plus `auth.users` from the **current** project, using the service-role key. Output: `scripts/supabase-export/`. |
| `export_storage_files.py` | Downloads every file from every Storage bucket in the current project. Output: `scripts/storage-export/`. |
| `import-supabase-data.js` | Loads the JSON from `export-supabase-data.js` into a **new** project. Run `db/schema.sql` on that new project first. |
| `migrate.py` | Full old-project → new-project migration: auth users, table data (respecting FK order), and storage files, from the exports above. |

`migrate.py` writes `scripts/auth_id_mapping.json` (old auth UUID → new auth
UUID) as it recreates users — needed so `members.id` (which mirrors
`auth.users.id`) gets remapped consistently. This file is gitignored since
it's real user-ID data, not source code.

## Credentials — read this before running `migrate.py`

`migrate.py` used to have a **live Supabase project URL and service_role key
hardcoded directly in the file**, despite its own docstring documenting
env-var configuration. That's been fixed — it now reads
`TARGET_SUPABASE_URL` / `TARGET_SUPABASE_SERVICE_ROLE_KEY` from a `.env`
file (or the shell environment) like the docstring always said it should.

**If this script (or the codebase it came from) was ever shared, committed,
or pushed anywhere with that key still hardcoded, treat that key as
compromised — rotate it immediately from the Supabase dashboard
(Project Settings → API → reset `service_role` key) and check the
project's API logs for unexpected activity.** A `service_role` key bypasses
Row Level Security entirely, so this is not a low-severity leak.
