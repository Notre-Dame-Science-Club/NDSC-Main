// Mints the two static JWTs the local dev stack uses. PostgREST in
// docker-compose.local.yml is configured with a known dev secret, so
// any JWT signed with it will authenticate. We bake two tokens (anon
// and service_role) and write them to .env.local so `npm run dev`
// picks them up.
//
// Usage:   node scripts/dev-jwt.js
// Output:  prints the lines you need to merge into .env.local, AND
//          writes .env.local.localstack (separate file) if you want
//          to keep the prod and local env files apart.
//
// The tokens are valid for 10 years. They're hardcoded to the local
// stack; never use them anywhere near real Supabase.

const crypto = require('crypto')

const SECRET = 'dev-only-not-a-real-secret-change-me-in-real-life'

function base64url(buf) {
  return Buffer.from(buf).toString('base64')
    .replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
}

function makeJwt(role) {
  const header = { alg: 'HS256', typ: 'JWT' }
  // `exp` 10 years out so the token never expires during normal dev use.
  const payload = {
    role,
    iss: 'postgrest',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365 * 10,
  }
  const h = base64url(JSON.stringify(header))
  const p = base64url(JSON.stringify(payload))
  const sig = base64url(crypto.createHmac('sha256', SECRET).update(`${h}.${p}`).digest())
  return `${h}.${p}.${sig}`
}

const anon = makeJwt('anon')
const service = makeJwt('service_role')

const lines = [
  `# Local dev stack — produced by scripts/dev-jwt.js on ${new Date().toISOString()}`,
  `# These tokens are HS256-signed with the dev secret in docker-compose.local.yml.`,
  `# Use SUPABASE_ENV=local (set below) to point the app at http://localhost:3001.`,
  `SUPABASE_ENV=local`,
  // NEXT_PUBLIC_* so the browser-side auth shim in lib/supabase.ts
  // can branch on local mode and skip GoTrue (which doesn't exist in
  // the local docker stack).
  `NEXT_PUBLIC_SUPABASE_ENV=local`,
  `NEXT_PUBLIC_SUPABASE_URL=http://localhost:3001`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY=${anon}`,
  `SUPABASE_SERVICE_ROLE_KEY=${service}`,
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${anon}`,
  `# Admin login: log in at /admin/login with admin@ndsc.local / localdev.`,
  `# The seed script inserts that row into the admins table.`,
  `ADMIN_PASSWORD=localdev`,
  '',
].join('\n')

require('fs').writeFileSync(require('path').join(__dirname, '..', '.env.local.localstack'), lines)
console.log('Wrote .env.local.localstack with two static dev JWTs.')
console.log('If you also want .env.local to read from these, see the Local dev section in README.')
console.log()
console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY =', anon)
console.log('SUPABASE_SERVICE_ROLE_KEY    =', service)
