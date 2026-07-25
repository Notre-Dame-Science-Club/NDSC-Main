# Local dev stack

Spin up a real Postgres + PostgREST in Docker, point the Next.js app at
it, and exercise the new form-graph system end-to-end before any
migration touches production.

The goal: every line of SQL the migrations would run, every form
submission through `FormRunner`, and every CSV download, should be
testable locally without a Supabase account.

## One-time bring-up

```bash
# 1. Start Postgres + PostgREST in Docker (port 5432 + 3001)
npm run db:up

# 2. Apply db/schema.sql + every db/migration_*.sql in order
npm run db:init

# 3. Insert the realistic seed (1 activity with a 3-level picker tree,
#    1 olympiad with 5 MCQs + 3 short answers + 1 photo, 4 sample
#    registrations so the CSV exports have real rows)
npm run db:seed

# 4. Mint the two static dev JWTs PostgREST will accept and write them
#    to .env.local.localstack (separate from your prod .env.local)
npm run dev:jwt

# 5. Run the app pointed at the local stack
npm run dev:local
```

If anything goes wrong and you want to start over:

```bash
npm run db:reset   # tears down the volume, brings it back, re-applies schema + seed
```

## What you should see

### Admin (open http://localhost:3000)

| URL | What it does |
| --- | --- |
| `/admin/form-builder` | Lists both seeded graphs (activity + olympiad) |
| `/admin/form-builder/<graphId>` | React Flow diagram. The activity graph should show a 3-level tree: Common details → Choose your track → Physics track / Chemistry track → Beginner / Advanced / General Chemistry. The olympiad graph should show Common details → Questions. |
| `/admin/form-builder/<graphId>/node/<nodeId>` | Edit fields, appearance, behavior. Try adding a `link_button` block with `target_node_id` = another node's id to test the sub-segment jump. |
| `/admin/activity-registration/11111111-1111-1111-1111-111111111111` | Registrants list. There's a new **All rows CSV** button (server-built) next to the old **Export CSV** (client-built). Both should work. |
| `/admin/olympiads` → click "CSV" on either row | Downloads the olympiad CSV. One column per question, with mcq/short/photo answers split correctly. |

### Public

| URL | What it does |
| --- | --- |
| `/olympiad` | Independent olympiad listing. Each olympiad is a card with a Register button → `/register/olympiad/<id>`. Olympiads and activities are separate sectors but share the same form-builder system. |
| `/register/activity/11111111-1111-1111-1111-111111111111` | Walks the picker tree. Common details → Choose your track → pick "Physics track" → pick "Beginner" or "Advanced" → fill custom fields → submit. The submission goes to the activity's real Postgres. |
| `/register/olympiad/44444444-4444-4444-4444-444444444444` | Common details → Questions. The questions node is wrapped in the anti-cheat provider: 45-second timer, copy/paste blocked, autosubmit at 0. |
| `/register/activity/.../...` → reload mid-flow | LocalStorage (`ndsc_form_reg_*`) restores the in-progress registration so refreshes don't lose answers. |

The olympiad's "Common details" form (the registration step *before* the
exam) uses a different accent color and a different label from the
activity's, so even though both go through the same FormRunner, they
read as distinct sectors — olympiads are independent from activities.

## Admin login (local)

The seed inserts one admin row and the dev-jwt script sets the matching
env var, so the local admin login at `/admin/login` works out of the
box:

- **Email**: `admin@ndsc.local`
- **Password**: `localdev` (matches `ADMIN_PASSWORD=localdev` written
  to `.env.local.localstack` by `npm run dev:jwt`)

To change it: edit `ADMIN_PASSWORD=...` in `.env.local.localstack`,
update the `admins` table row to match if you also want a different
email, restart `npm run dev:local`.

## Member login (local)

The local stack has no Supabase Auth / GoTrue, so the standard
`supabase.auth.signInWithPassword` flow doesn't work. We work around
it with a small in-house auth layer that lives only in
`SUPABASE_ENV=local` mode:

1. **Password storage** — the `members` table has a `password_hash`
   column (added by `db/migration_member_password_07.sql`). It's a
   salted SHA-256 of the password (`<salt>$<sha256(salt::password)>`),
   the same shape any password store would expect. NEVER ship this
   column to a real Supabase project; in prod, GoTrue owns the
   password.
2. **Registration** — `app/api/auth/register/route.ts` branches on
   `SUPABASE_ENV=local`: on local it skips
   `supabaseAdmin.auth.admin.createUser` and inserts straight into
   `members` with a freshly-generated salt + SHA-256 hash. Production
   path is unchanged.
3. **Login** — `app/api/auth/login/route.ts` branches the same way.
   On local it looks the member up by email, verifies the password
   against `password_hash`, and signs a self-contained HMAC token via
   `lib/localAuth.ts`. The token is `<payload>.<sig>` where `sig =
   HMAC-SHA256(SECRET, payload)` and `payload` is the member id +
   expiry.
4. **Server-side verification** — every server route that calls
   `supabaseAdmin.auth.getUser(bearer)` (e.g. `/api/member-shoutbox`,
   `/api/member-profile`, `/api/survey-active`) is reached through
   the `localFetch` shim in `lib/supabase.ts`. The shim rewrites
   `GET <url>/auth/v1/user` → `GET /api/auth/local-verify`, which
   decodes the same token and returns a Supabase-shaped user object.
5. **Client side** — `lib/supabase.ts` swaps `supabase.auth` for an
   in-browser stub when `NEXT_PUBLIC_SUPABASE_ENV=local`. The stub
   reads/writes the bearer from `localStorage` and re-implements the
   slice of the supabase-js auth API the rest of the app uses
   (`getSession`, `getUser`, `signInWithPassword`, `signOut`,
   `setSession`, `onAuthStateChange`).

A test member is seeded so you can log in immediately:

- **Email**: `testmember@ndsc.local`
- **Password**: `localdev`

Both the local dev login (`/login`) and the legacy `/api/auth/login`
route accept these credentials. After login, `/dashboard` should
show the test member's profile.

To rotate the test password, edit the `password_hash` value in
`db/seed_local.sql` (or update the row directly in the
`members` table) and re-run `npm run db:seed`. To change the
algorithm entirely, edit `lib/localAuth.ts` and the matching hash
function in `app/api/auth/register/route.ts` and
`app/api/auth/login/route.ts`.

## Known limitations of the local stack

1. **No Supabase Auth.** Replaced by the local auth shim described
   above. Admin login still uses the cookie-based path
   (`/api/admin/login`); member login uses the local shim. Both
   work end-to-end against the docker stack.
2. **No Supabase Storage.** Photo upload fields work but the file
   upload endpoint (`/api/activity-upload`) is wired to Supabase
   Storage. Uploads will fail; submission still records the URL field
   empty.
3. **No Row Level Security.** The migrations' `create policy` blocks
   do nothing here — the service-role JWT bypasses them anyway. Don't
   infer prod row-visibility behavior from what you see locally.
4. **JWTs are long-lived and trivial.** They're signed with a dev
   secret in `docker-compose.local.yml` and last 10 years. Do not
   reuse them anywhere.

## Files added

```
docker-compose.local.yml        Postgres 15 + PostgREST 12.2 stack
scripts/dev-jwt.js              Mints anon + service_role JWTs
scripts/run-dev-local.js        Spawns next dev with the local env loaded
scripts/init-local-db.js        Applies schema + every migration (psql or docker exec)
scripts/seed-local-db.js        Applies the seed (psql or docker exec)
db/seed_local.sql               Realistic seed (idempotent)
.env.local.localstack           Generated by dev:jwt; gitignored below
```

`.env.local.localstack` is in `.gitignore` so the dev JWTs never leak.

## Notes for Windows users

`psql` isn't on the host by default. Both `npm run db:init` and
`npm run db:seed` auto-detect this and fall back to running psql
*inside* the Docker container via `docker exec`. No extra setup
needed.

If you'd rather have psql natively (e.g. for ad-hoc queries), install
the Postgres client tools from
https://www.postgresql.org/download/windows/ and add `C:\Program
Files\PostgreSQL\<version>\bin` to PATH.

Ad-hoc queries without installing psql:

```bash
docker exec -it ndsc-local-db psql -U postgres -d postgres
```

## Resetting the DB

```bash
npm run db:reset
```

Tears the Docker volume down, brings it back, reapplies schema +
migrations + seed. Useful when you change `db/schema.sql` or
`db/migration_*.sql` and want a clean run.
