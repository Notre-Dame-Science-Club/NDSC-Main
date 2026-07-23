// Apply db/seed_local.sql. Same auto-detect as init-local-db.js:
// prefers psql on PATH, falls back to docker exec.

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

const seedFile = path.resolve(__dirname, '..', 'db', 'seed_local.sql')

if (which('psql')) {
  execSync(`psql -h ${DB} -p ${PORT} -U ${USER} -d postgres -v ON_ERROR_STOP=1 -q -f "${seedFile}"`, {
    stdio: 'inherit',
    env: { ...process.env, PGPASSWORD: PASS },
  })
} else {
  const sql = fs.readFileSync(seedFile, 'utf8')
  execSync(`docker exec -i ${DOCKER_CONTAINER} psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q`, {
    stdio: ['pipe', 'inherit', 'inherit'],
    input: sql,
  })
}
console.log('\n✓ Seed applied.')
