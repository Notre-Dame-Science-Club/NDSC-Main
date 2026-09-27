// lib/authConfig.ts
//
// OAuth sign-in configuration. A plain module (no next/headers, no
// server-only secrets) so both Client and Server Components can import it.
//
// Two knobs, both NEXT_PUBLIC_ so they are inlined into the browser bundle:
//
//   NEXT_PUBLIC_AUTH_ENABLE_OAUTH   — master switch, ON by default. Set it
//                                     to 'false' to hide the "Continue with
//                                     <provider>" button on /login and
//                                     /register and fall back to the normal
//                                     email/password login. Anything except
//                                     an explicit false value (false/0/no/off)
//                                     leaves OAuth enabled.
//   NEXT_PUBLIC_AUTH_OAUTH_PROVIDER — which Supabase Auth provider to use
//                                     (default 'google').
//
// NEXT_PUBLIC_SITE_URL is not read directly here but documented alongside:
// it anchors the callback URL that Supabase redirects the browser back to,
// and it must be whitelisted in Supabase → Authentication → URL
// Configuration → Redirect URLs.
//
// Production default is OAuth ON. The provider must be configured in the
// Supabase dashboard (Authentication → Providers) and the callback URL
// whitelisted, or the button will error out on click. Set the env var to
// 'false' to turn OAuth off and use email/password only.

import type { Provider } from '@supabase/supabase-js'

/** Supabase Auth providers the button supports. A subset of supabase-js's
 *  full Provider union — enough for this app, and easy to extend. */
export const OAUTH_PROVIDERS = [
  'google',
  'github',
  'facebook',
  'microsoft',
  'apple',
  'discord',
  'gitlab',
  'linkedin',
  'twitter',
  'bitbucket',
] as const

export type OAuthProviderName = (typeof OAUTH_PROVIDERS)[number]

const DEFAULT_PROVIDER: OAuthProviderName = 'google'

/** True when the env switch turns OAuth sign-in on. ON by default —
 *  only an explicit false value (false/0/no/off) disables it. */
export function isOAuthEnabled(): boolean {
  const raw = (process.env.NEXT_PUBLIC_AUTH_ENABLE_OAUTH || '').trim().toLowerCase()
  return raw !== 'false' && raw !== '0' && raw !== 'no' && raw !== 'off'
}

/** The configured provider name, validated against the known list and
 *  falling back to 'google' for anything unrecognized. */
export function getOAuthProvider(): OAuthProviderName {
  const raw = (process.env.NEXT_PUBLIC_AUTH_OAUTH_PROVIDER || '').trim().toLowerCase()
  return (OAUTH_PROVIDERS as readonly string[]).includes(raw)
    ? (raw as OAuthProviderName)
    : DEFAULT_PROVIDER
}

/** 'google' → 'Google', 'github' → 'Github', etc. — for button copy. */
export function getOAuthProviderLabel(): string {
  const p = getOAuthProvider()
  return p.charAt(0).toUpperCase() + p.slice(1)
}

/** The provider as supabase-js's `Provider` type. Our list is a strict
 *  subset of theirs, so this cast is safe. */
export function getOAuthProviderForSupabase(): Provider {
  return getOAuthProvider() as Provider
}

/** Site origin. In the browser it is window.location.origin (so local/dev
 *  and preview deployments work without configuration); server-side it
 *  falls back to NEXT_PUBLIC_SITE_URL. */
export function getSiteUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/$/, '')
  }
  return (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '')
}

/**
 * The URL Supabase redirects the browser back to after the provider flow.
 * Must be whitelisted in Supabase's Authentication → URL Configuration →
 * Redirect URLs (i.e. `${NEXT_PUBLIC_SITE_URL}/auth/callback`).
 */
export function getAuthCallbackUrl(): string {
  return `${getSiteUrl()}/auth/callback`
}
