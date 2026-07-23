// Run `next dev` with the local stack's env vars loaded. Sources
// .env.local.localstack (which scripts/dev-jwt.js produces) into the
// current process before spawning Next, so the app talks to
// http://localhost:3001 instead of the real Supabase project.
//
// Usage:   npm run dev:local
// Or:      node scripts/run-dev-local.js
//
// It does NOT touch .env.local — that file still points at production.
// When you want to go back to prod, just run `npm run dev`.

const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')

const envFile = path.resolve(__dirname, '..', '.env.local.localstack')
if (!fs.existsSync(envFile)) {
  console.error('Missing .env.local.localstack. Run `npm run dev:jwt` first.')
  process.exit(1)
}

// Parse .env.local.localstack into a process.env-friendly object.
const env = { ...process.env }
for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
  if (!line || line.trim().startsWith('#')) continue
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2]
}

console.log('→ Starting Next.js with local stack env:')
console.log(`    SUPABASE_ENV=${env.SUPABASE_ENV || '(unset)'}`)
console.log(`    NEXT_PUBLIC_SUPABASE_URL=${env.NEXT_PUBLIC_SUPABASE_URL}`)
console.log('  (anon + service role keys are HS256-signed with the dev secret in docker-compose.local.yml)')
console.log()

const child = spawn('npx', ['next', 'dev'], {
  stdio: 'inherit',
  env,
  shell: process.platform === 'win32',
})

child.on('exit', code => process.exit(code ?? 0))
process.on('SIGINT', () => child.kill('SIGINT'))
process.on('SIGTERM', () => child.kill('SIGTERM'))
