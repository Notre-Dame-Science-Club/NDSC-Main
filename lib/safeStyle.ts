/**
 * safeStyle.ts: allowlist validators for every value that comes out of the
 * database (or an admin form) and ends up inside CSS or a style attribute.
 *
 * Why this exists: React escapes HTML, not CSS. A value like
 *   Inter;--bg3:url(https://evil/ad.png)
 * placed in `style={{ '--font-body': value }}` is serialised as extra
 * declarations in the style attribute, so whoever can write that row can restyle
 * (or cover) every page. Validate with an allowlist at render time (the DB can be
 * written by other paths) AND at write time (so bad values never get stored).
 *
 * Client-safe: no Node imports.
 */
import { isThemeId, parseThemeList } from './themes'

// ── Font stacks ──────────────────────────────────────────────────────────────
// Accepts what the admin Appearance page produces: 'Poppins', sans-serif
// i.e. up to 6 comma-separated names, each either a quoted family name or a bare
// identifier. No ; : ( ) { } / \ @ ! so no new declaration, url(), comment or
// escape can be formed.
const FONT_ITEM = String.raw`(?:'[A-Za-z0-9][A-Za-z0-9 \-]{0,59}'|[A-Za-z][A-Za-z0-9\-]{0,59})`
const FONT_STACK = new RegExp(`^${FONT_ITEM}(?:\\s*,\\s*${FONT_ITEM}){0,5}$`)

export function safeFontStack(v: unknown): string {
  if (typeof v !== 'string') return ''
  const s = v.trim()
  return s.length <= 400 && FONT_STACK.test(s) ? s : ''
}

// ── Colours ──────────────────────────────────────────────────────────────────
const HEX = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/
const CSS_VAR = /^var\(--[a-z0-9-]{1,40}\)$/
const NUM = String.raw`\d{1,3}(?:\.\d+)?`
const RGB = new RegExp(`^rgba?\\(\\s*${NUM}\\s*,\\s*${NUM}\\s*,\\s*${NUM}\\s*(?:,\\s*(?:0|1|0?\\.\\d+|1\\.0+)\\s*)?\\)$`)

/** '#hex' | 'var(--token)' | 'rgb()/rgba()' | 'transparent'. Anything else becomes ''. */
export function safeCssColor(v: unknown): string {
  if (typeof v !== 'string') return ''
  const s = v.trim()
  if (s.length > 64) return ''
  return HEX.test(s) || CSS_VAR.test(s) || RGB.test(s) || s === 'transparent' ? s : ''
}

// ── Image / asset URLs ───────────────────────────────────────────────────────
// Hosts come from NEXT_PUBLIC_ALLOWED_IMAGE_HOSTS (comma list, '*.example.com'
// allowed). The default matches images.remotePatterns in next.config.ts.
const DEFAULT_IMAGE_HOSTS =
  'uploads.ndscbd.net,ndscbd.net,www.ndscbd.net,arnob.ndscbd.net,*.supabase.co,img.youtube.com'

function allowedImageHosts(): string[] {
  return (process.env.NEXT_PUBLIC_ALLOWED_IMAGE_HOSTS || DEFAULT_IMAGE_HOSTS)
    .split(',').map(h => h.trim().toLowerCase()).filter(Boolean)
}

function hostAllowed(host: string): boolean {
  return allowedImageHosts().some(p =>
    p.startsWith('*.') ? host.endsWith(p.slice(1)) : host === p)
}

/** https URL on an allowed host (or a same-site /path). Returns '' if not allowed. */
export function safeImageUrl(v: unknown): string {
  if (typeof v !== 'string') return ''
  const s = v.trim()
  if (!s || s.length > 2048) return ''
  if (s.startsWith('/') && !s.startsWith('//')) {
    return /^\/[A-Za-z0-9_\-./%]*$/.test(s) ? s : ''
  }
  let u: URL
  try { u = new URL(s) } catch { return '' }
  if (u.protocol !== 'https:' || u.username || u.password) return ''
  if (!hostAllowed(u.hostname.toLowerCase())) return ''
  // href has " < > ` space etc. percent-encoded; also encode what can end an
  // unquoted url( ) or a quoted-with-' string.
  return u.href.replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/'/g, '%27')
}

/** Safe value for a CSS background-image: url("...") or 'none'. */
export function cssUrl(v: unknown): string {
  const u = safeImageUrl(v)
  return u ? `url("${u}")` : 'none'
}

/** Only an https://fonts.googleapis.com/... stylesheet. Returns '' otherwise. */
export function safeGoogleFontsUrl(v: unknown): string {
  if (typeof v !== 'string') return ''
  const s = v.trim()
  if (!s || s.length > 2048) return ''
  let u: URL
  try { u = new URL(s) } catch { return '' }
  if (u.protocol !== 'https:' || u.hostname !== 'fonts.googleapis.com') return ''
  if (u.username || u.password || u.port) return ''
  return u.href
}

// ── Appearance settings (homepage_settings rows) ─────────────────────────────
export const APPEARANCE_SETTING_KEYS = [
  'default_theme', 'theme_switcher_enabled', 'theme_switcher_themes',
  'font_family', 'font_google_url', 'header_size', 'accent_color',
  'about_hero_video_url', 'about_hero_poster_url',
] as const

export function isAppearanceKey(key: unknown): boolean {
  return typeof key === 'string' && (APPEARANCE_SETTING_KEYS as readonly string[]).includes(key)
}

export type SettingCheck = { ok: boolean; value: string; error: string }
const okv = (value: string): SettingCheck => ({ ok: true, value, error: '' })
const bad = (error: string): SettingCheck => ({ ok: false, value: '', error })

/** Validate (and normalise) a value before it is stored. Empty string = clear the setting. */
export function validateAppearanceSetting(key: string, raw: unknown): SettingCheck {
  if (raw !== null && raw !== undefined && !['string', 'number', 'boolean'].includes(typeof raw)) {
    return bad('Value must be text.')
  }
  const value = raw === null || raw === undefined ? '' : String(raw).trim()
  if (value === '') return okv(value)

  switch (key) {
    case 'font_family': {
      const v = safeFontStack(value)
      return v ? okv(v) : bad("Font must look like 'Poppins', sans-serif (letters, digits, spaces, hyphens and commas only).")
    }
    case 'font_google_url': {
      const v = safeGoogleFontsUrl(value)
      return v ? okv(v) : bad('Only https://fonts.googleapis.com/ URLs are allowed.')
    }
    case 'accent_color':
      return /^#?(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value) ? okv(value) : bad('Accent colour must be a 3 or 6 digit hex value.')
    case 'header_size':
      return ['compact', 'default', 'large'].includes(value) ? okv(value) : bad('Unknown header size.')
    case 'default_theme':
      return isThemeId(value) ? okv(value) : bad('Unknown theme.')
    case 'theme_switcher_enabled':
      return value === '0' || value === '1' ? okv(value) : bad("Must be '0' or '1'.")
    case 'theme_switcher_themes':
      return /^[a-z]+(?:,[a-z]+)*$/.test(value) && parseThemeList(value).length > 0 ? okv(value) : bad('Unknown theme list.')
    case 'about_hero_video_url':
    case 'about_hero_poster_url': {
      const v = safeImageUrl(value)
      return v ? okv(v) : bad('URL must be https on an allowed host (see NEXT_PUBLIC_ALLOWED_IMAGE_HOSTS).')
    }
    default:
      return bad('Unknown appearance setting.')
  }
}
