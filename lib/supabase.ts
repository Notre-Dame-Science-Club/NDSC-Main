import type { SupabaseClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const service = process.env.SUPABASE_SERVICE_ROLE_KEY || anon

// Mock client returned at build time when env vars are missing
// Prevents "Cannot destructure property 'auth'" crash during prerender
function createMockClient(): SupabaseClient {
  const noop = () => Promise.resolve({ data: null, error: null })
  const mock: any = new Proxy({}, {
    get(_t, prop: string) {
      if (prop === 'auth') {
        return new Proxy({}, {
          get() { return noop }
        })
      }
      if (prop === 'from') {
        return () => new Proxy({}, { get() { return () => Promise.resolve({ data: [], error: null }) } })
      }
      return noop
    }
  })
  return mock as SupabaseClient
}

let _supabase: SupabaseClient | null = null
let _supabaseAdmin: SupabaseClient | null = null

function getSupabase(): SupabaseClient {
  if (_supabase) return _supabase
  if (!url || !anon) return createMockClient()
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createClient } = require('@supabase/supabase-js')
    // This client is shared between server-side usage (some pages/routes
    // import `supabase`, not `supabaseAdmin`, for read-only queries) and
    // genuine browser usage (login, dashboard, navbar auth state). Sessions
    // only need to — and only *can* — persist in the browser, where
    // `window`/localStorage actually exist. Previously this was hardcoded to
    // `persistSession: false` everywhere, which meant a member's login
    // session was never actually saved to the browser: refreshing the page
    // (or even just the Navbar's auth check on a fresh page load) would see
    // no session and silently treat them as logged out, even seconds after
    // a successful login.
    const isBrowser = typeof window !== 'undefined'
    _supabase = createClient(url, anon, {
      auth: { persistSession: isBrowser, autoRefreshToken: isBrowser, detectSessionInUrl: false },
    })
    return _supabase!
  } catch {
    return createMockClient()
  }
}

function getSupabaseAdmin(): SupabaseClient {
  if (_supabaseAdmin) return _supabaseAdmin
  if (!url || !anon) return createMockClient()
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createClient } = require('@supabase/supabase-js')
    _supabaseAdmin = createClient(url, service || anon, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
    return _supabaseAdmin!
  } catch {
    return createMockClient()
  }
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_t, prop: string) {
    return (getSupabase() as any)[prop]
  },
})

export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_t, prop: string) {
    return (getSupabaseAdmin() as any)[prop]
  },
})
