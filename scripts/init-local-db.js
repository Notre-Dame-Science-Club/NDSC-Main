// Initialize the local Postgres with the production schema + every
// migration in db/ in alphabetical order. Safe to re-run (every
// migration is written to be idempotent on its own).
//
// Usage:   node scripts/init-local-db.js
// Expects: docker compose stack running.
//
// SQL is applied through whichever of these is reachable:
//   1. `psql` on PATH  (set PGHOST/PGPORT/PGUSER/PGPASSWORD to override)
//   2. `docker exec` into the ndsc-local-db container (the fallback
//      when running on a machine without the Postgres client tools —
//      common on Windows).

const { execSync, spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const DB = process.env.PGHOST || 'localhost'
const PORT = process.env.PGPORT || '5432'
const USER = process.env.PGUSER || 'postgres'
const PASS = process.env.PGPASSWORD || 'postgres'
const DOCKER_CONTAINER = 'ndsc-local-db'

function which(cmd) {
  const r = spawnSync(process.platform === 'win32' ? 'where' : 'which', [cmd], { encoding: 'utf8' })
  return r.status === 0 && r.stdout.trim().length > 0
}

function psql(file) {
  const abs = path.resolve(file)
  console.log(`→ ${path.basename(abs)}`)
  // `-v ON_ERROR_STOP=1` so a SQL error halts the script instead of
  // racing forward and leaving the DB in a half-applied state.
  if (which('psql')) {
    execSync(`psql -h ${DB} -p ${PORT} -U ${USER} -d postgres -v ON_ERROR_STOP=1 -q -f "${abs}"`, {
      stdio: 'inherit',
      env: { ...process.env, PGPASSWORD: PASS },
    })
    return
  }
  // Fallback: run psql inside the running Docker container. We pipe the
  // file in via stdin (-c -) so the container doesn't need to mount the
  // host's db/ directory.
  const sql = fs.readFileSync(abs, 'utf8')
  // Sanity-check the container is reachable so the error is helpful.
  try {
    execSync(`docker inspect -f "{{.State.Running}}" ${DOCKER_CONTAINER}`, { stdio: 'ignore' })
  } catch {
    throw new Error(`Neither psql nor the ${DOCKER_CONTAINER} container is available.\n` +
      '  - Install Postgres client tools (https://www.postgresql.org/download/windows/), OR\n' +
      '  - Run `npm run db:up` first so the container exists.')
  }
  execSync(`docker exec -i ${DOCKER_CONTAINER} psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q`, {
    stdio: ['pipe', 'inherit', 'inherit'],
    input: sql,
  })
}

const dbDir = path.resolve(__dirname, '..', 'db')

// 1. Base schema.
psql(path.join(dbDir, 'schema.sql'))

// 2. All migrations in db/migration_*.sql, alphabetical. The
//    new form_graph ones are picked up automatically.
const migrations = fs.readdirSync(dbDir)
  .filter(f => /^migration_.*\.sql$/i.test(f))
  .sort()
for (const m of migrations) {
  psql(path.join(dbDir, m))
}

// 3. Tell PostgREST to re-read the database schema. PostgREST caches the
//    tables/columns it exposes at boot, so any CREATE TABLE / ALTER TABLE
//    from a fresh migration is invisible until it re-scans. We do this once
//    at the end so the dev server starts seeing every table without a
//    container restart. (Migrations on Supabase cloud don't need this —
//    Supabase's PostgREST watches via a separate channel configured in
//    their image — but the stock postgrest/postgrest image we run here
//    only reloads on NOTIFY or restart.)
function reloadPostgrestSchema() {
  console.log('→ Reload PostgREST schema cache')
  const sql = `NOTIFY pgrst, 'reload schema';`
  if (which('psql')) {
    execSync(`psql -h ${DB} -p ${PORT} -U ${USER} -d postgres -v ON_ERROR_STOP=1 -q -c "${sql}"`, {
      stdio: 'inherit',
      env: { ...process.env, PGPASSWORD: PASS },
    })
    return
  }
  try {
    execSync(`docker inspect -f "{{.State.Running}}" ${DOCKER_CONTAINER}`, { stdio: 'ignore' })
  } catch {
    return
  }
  execSync(`docker exec -i ${DOCKER_CONTAINER} psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q -c "${sql}"`, {
    stdio: ['pipe', 'inherit', 'inherit'],
    input: sql,
  })
}
reloadPostgrestSchema()

console.log('\n✓ Local DB initialized.')
console.log('Next: npm run dev:jwt  (writes .env.local.localstack)')
console.log('Then: npm run db:seed')
