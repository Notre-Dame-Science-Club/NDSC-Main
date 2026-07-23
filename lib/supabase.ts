import type { SupabaseClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const service = process.env.SUPABASE_SERVICE_ROLE_KEY || anon

// Local-mode flag. Server routes read SUPABASE_ENV; the browser reads
// NEXT_PUBLIC_SUPABASE_ENV (we can't expose the unprefixed one). They
// are set together in scripts/dev-jwt.js.
const IS_LOCAL_SERVER = (process.env.SUPABASE_ENV || '').toLowerCase() === 'local'
const IS_LOCAL_BROWSER = (typeof window !== 'undefined') &&
  (process.env.NEXT_PUBLIC_SUPABASE_ENV || '').toLowerCase() === 'local'
const IS_LOCAL = IS_LOCAL_SERVER || IS_LOCAL_BROWSER

// Local PostgREST (and any non-Supabase-hosted PostgREST) serves the API at
// the root, e.g. http://localhost:3001/form_graphs. The Supabase JS client
// always appends `/rest/v1/...` to NEXT_PUBLIC_SUPABASE_URL, so to make the
// local stack work we intercept fetch and strip that prefix when present.
// On production (real Supabase) the URL already includes `/rest/v1`, so
// the strip is a no-op there.
const REST_PREFIX = '/rest/v1'
// Auth goes through a different prefix. The supabase-js client builds
// `${NEXT_PUBLIC_SUPABASE_URL}/auth/v1/...` for all auth.* calls
// (signInWithPassword → /token, getUser → /user, etc.). On the local
// stack there is no GoTrue, so we rewrite those URLs to our own
// /api/auth/* endpoints. The list of routes the shim covers:
//   /auth/v1/user            → /api/auth/local-verify   (used by auth.getUser)
const AUTH_PREFIX = '/auth/v1'

function stripRestPrefix(target: string): string | null {
  if (!target) return null
  if (target.startsWith(url + REST_PREFIX)) return url + target.slice((url + REST_PREFIX).length)
  const urlNoSlash = url.replace(/\/$/, '')
  if (target.startsWith(urlNoSlash + REST_PREFIX)) return urlNoSlash + target.slice((urlNoSlash + REST_PREFIX).length)
  return null
}

// Map an `/auth/v1/<path>` URL on the local PostgREST base to the
// matching `/api/auth/<path>` route. Only the calls the app actually
// makes today are mapped; anything else falls through to the real
// network (and fails, which is what we want during dev — louder than
// silent half-broken).
//
// Node's native `fetch` doesn't accept relative URLs (it needs an
// absolute URL with scheme), so the rewritten path is resolved
// against the dev server's origin (http://localhost:3000) before
// being returned.
const DEV_ORIGIN = 'http://localhost:3000'
function rewriteAuthUrl(target: string): string | null {
  if (!target || !url) return null
  if (!target.startsWith(url + AUTH_PREFIX)) return null
  const tail = target.slice((url + AUTH_PREFIX).length) // e.g. "/user", "/token?grant_type=..."
  if (tail === '/user' || tail.startsWith('/user?')) {
    return `${DEV_ORIGIN}/api/auth/local-verify${tail.slice('/user'.length)}`
  }
  // For all other auth calls (signIn, signOut, etc.), there's no
  // shim. They'll 404 against our routes. We return null so the
  // caller falls through to the real network — which will also fail,
  // but at least the URL stays the same and the failure mode is
  // obvious (401 from the local stack, instead of a 200 from a
  // pretend shim that doesn't exist).
  return null
}

const localFetch: typeof fetch = async (input, init) => {
  let urlOut: string | Request | undefined
  let initOut: RequestInit | undefined = init

  if (typeof input === 'string') {
    const stripped = stripRestPrefix(input)
    const authed = !stripped ? rewriteAuthUrl(input) : null
    urlOut = stripped ?? authed ?? input
  } else if (input && typeof input === 'object' && 'url' in input) {
    const req = input as Request
    const stripped = stripRestPrefix(req.url)
    const authed = !stripped ? rewriteAuthUrl(req.url) : null
    const finalUrl = stripped ?? authed
    if (finalUrl) {
      // Reconstruct the request with the rewritten URL. We have to
      // clone the body manually because `new Request()` only accepts
      // a body from a stream, and the original body may already be
      // consumed.
      const headers = new Headers(req.headers)
      urlOut = finalUrl
      initOut = {
        method: req.method,
        headers,
        body: ['GET', 'HEAD'].includes(req.method) ? undefined : await req.clone().arrayBuffer(),
        duplex: 'half',
      } as RequestInit
    } else {
      urlOut = req
    }
  } else {
    urlOut = input as any
  }

  return fetch(urlOut as any, initOut as any)
}

// Local-stack-only `supabase.auth` shim.
//
// On a real Supabase project the auth namespace is a real GoTrue
// client. On the local stack there is no GoTrue, so this object
// stands in: it stores the local bearer in localStorage and
// re-implements the small slice of the supabase-js auth API the rest
// of the app uses (`getSession`, `getUser`, `signInWithPassword`,
// `signOut`, `setSession`, `onAuthStateChange`, `refreshSession`).
// Reads are answered from localStorage; writes either go through the
// local /api/auth/* routes (login) or just mutate the cache
// (setSession / signOut).
//
// Storage key matches supabase-js's default so the rest of the app
// (which only ever reads `data.session`) sees a single source of
// truth.
const LS_KEY = 'sb-' + (new URL(url || 'http://localhost').hostname).replace(/\./g, '-') + '-auth-token'

type AuthChangeEvent = 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED' | 'USER_UPDATED' | 'PASSWORD_RECOVERY' | 'INITIAL_SESSION'
type AuthChangeCallback = (event: AuthChangeEvent, session: any) => void

function readSession(): { access_token: string; refresh_token: string; expires_at?: number; user?: any } | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(LS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.access_token) return null
    return parsed
  } catch { return null }
}

function writeSession(session: any) {
  if (typeof window === 'undefined') return
  try {
    if (session) window.localStorage.setItem(LS_KEY, JSON.stringify(session))
    else window.localStorage.removeItem(LS_KEY)
  } catch { /* ignore */ }
}

// Tiny pub-sub so `onAuthStateChange` callbacks fire on login/logout.
const subscribers: Set<AuthChangeCallback> = new Set()
function emit(event: AuthChangeEvent, session: any) {
  for (const cb of subscribers) {
    try { cb(event, session) } catch { /* ignore */ }
  }
}

function buildAuthShim() {
  return {
    async getSession() {
      const session = readSession()
      if (!session) return { data: { session: null }, error: null }
      return { data: { session: { ...session, expires_in: 60 * 60 * 24 * 7 } }, error: null }
    },
    async getUser() {
      const session = readSession()
      if (!session) return { data: { user: null }, error: null }
      // Hit the local verify endpoint with our bearer. The endpoint
      // echoes back the user row from `members`.
      try {
        const res = await fetch('/api/auth/local-verify', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        const json = await res.json().catch(() => null)
        if (!res.ok || !json) return { data: { user: null }, error: new Error(json?.error || 'Auth failed') }
        return { data: { user: json }, error: null }
      } catch (e: any) {
        return { data: { user: null }, error: e }
      }
    },
    async signInWithPassword({ email, password }: { email: string; password: string }) {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        return { data: { user: null, session: null }, error: { message: json?.error || 'Login failed.', status: res.status } }
      }
      const session = json.session
      writeSession(session)
      emit('SIGNED_IN', session)
      return { data: { user: session.user, session }, error: null }
    },
    async setSession({ access_token, refresh_token }: { access_token: string; refresh_token: string }) {
      // No GoTrue round-trip; just stash. The next getUser() will
      // call /api/auth/local-verify, which will accept the bearer.
      const session = { access_token, refresh_token }
      writeSession(session)
      emit('SIGNED_IN', session)
      return { data: { session, user: null }, error: null }
    },
    async refreshSession() {
      // No refresh flow in local. Hand back whatever we have.
      const session = readSession()
      return { data: { session, user: null }, error: null }
    },
    async signOut() {
      writeSession(null)
      emit('SIGNED_OUT', null)
      return { error: null }
    },
    onAuthStateChange(cb: AuthChangeCallback) {
      subscribers.add(cb)
      // Fire INITIAL_SESSION on subscribe so the consumer's
      // `useEffect` doesn't have to call getSession separately to
      // render the "logged in" state on first paint.
      const current = readSession()
      // Defer to next tick — fires before React has flushed, which is
      // fine for the navbar/dashboard use case (they read this in
      // their own useEffect).
      setTimeout(() => {
        try { cb('INITIAL_SESSION', current) } catch { /* ignore */ }
      }, 0)
      return {
        data: {
          subscription: {
            unsubscribe: () => { subscribers.delete(cb) },
          },
        },
      }
    },
  }
}

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
    const isBrowser = typeof window !== 'undefined'
    _supabase = createClient(url, anon, {
      auth: { persistSession: isBrowser, autoRefreshToken: isBrowser, detectSessionInUrl: false },
      global: { fetch: localFetch },
    })
    if (IS_LOCAL && isBrowser) {
      // Replace the auth namespace with our shim. The real GoTrue
      // would call back to a server that doesn't exist in local mode,
      // so we swap it for an in-browser equivalent.
      ;(_supabase as any).auth = buildAuthShim()
    }
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
      global: { fetch: localFetch },
    })
    // No need to swap auth on the admin client — the server-side
    // routes call `supabaseAdmin.auth.getUser(token)` directly, and
    // the `localFetch` shim above routes that call to
    // /api/auth/local-verify.
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
