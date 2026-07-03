// lib/api-response.ts
//
// Thin helpers around NextResponse.json so every new route handler produces
// the same error shape the existing ~40 routes already use by convention:
// `NextResponse.json({ error: '...' }, { status: N })`. These don't change
// what existing routes return — this is for NEW routes to build on, so the
// error contract stays consistent as more people add endpoints.
//
// Success responses are deliberately NOT forced into one shape here, because
// the existing API surface already returns several different ones (a bare
// array, a bare row, `{ members: [...] }`, `{ success: true }`, etc — see
// ARCHITECTURE.md's "API response conventions" section). `apiSuccess` is a
// light wrapper for the common "just return this JSON with a 200/201"
// case; reach for `NextResponse.json(...)` directly if you need something
// more specific to match a sibling endpoint's existing shape.

import { NextResponse } from 'next/server'
import type { ApiErrorBody, ApiOkBody } from '@/types/api'

/** `{ error: message }` with the given status (default 400). */
export function apiError(message: string, status = 400): NextResponse<ApiErrorBody> {
  return NextResponse.json({ error: message }, { status })
}

/** `{ error: 'Unauthorized' }`, 401. Use when there's no valid session at all. */
export function apiUnauthorized(message = 'Unauthorized'): NextResponse<ApiErrorBody> {
  return NextResponse.json({ error: message }, { status: 401 })
}

/** `{ error: 'Forbidden' }`, 403. Use when there IS a session, but it lacks permission. */
export function apiForbidden(message = 'Forbidden'): NextResponse<ApiErrorBody> {
  return NextResponse.json({ error: message }, { status: 403 })
}

/** `{ error: 'Not found' }`, 404. */
export function apiNotFound(message = 'Not found'): NextResponse<ApiErrorBody> {
  return NextResponse.json({ error: message }, { status: 404 })
}

/**
 * `{ error: message }`, 500. Pass the caught error so the message is
 * consistent with how existing routes surface Supabase errors
 * (`error.message`), without ever leaking a raw Error object to the client.
 */
export function apiServerError(err: unknown, fallback = 'Something went wrong.'): NextResponse<ApiErrorBody> {
  const message = err instanceof Error ? err.message : fallback
  return NextResponse.json({ error: message }, { status: 500 })
}

/** `{ success: true }`, 200. For mutations with no payload worth returning. */
export function apiOk(status = 200): NextResponse<ApiOkBody> {
  return NextResponse.json({ success: true }, { status })
}

/** Return `data` as-is with the given status (default 200). */
export function apiSuccess<T>(data: T, status = 200): NextResponse<T> {
  return NextResponse.json(data, { status })
}

// ── Naming-compatibility aliases ───────────────────────────────────────────
// The original task plan named these `ok(data, status)` / `fail(message,
// status)`. Kept as `apiSuccess`/`apiError` above (grouped with the more
// specific `apiUnauthorized`/`apiForbidden`/`apiNotFound`/`apiServerError`
// siblings this file also needed), but exported under both names since
// downstream code may reference either.
export const ok = apiSuccess
export const fail = apiError
