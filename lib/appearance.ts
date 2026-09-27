// Shared appearance-resolution helpers for the activity register page and
// the admin Appearance tab. Originally lived inline in
// app/activities/[slug]/register/page.tsx; moved here so the admin editor
// can use the same code to live-preview the form while editing.

type EcMember = { id: string; full_name: string; position: string; email?: string | null; whatsapp?: string | null; facebook_url?: string | null }
export type FormContactPerson = { name: string; post?: string; phone?: string; email?: string; whatsapp?: string; facebook?: string }

/** 'default' | '#hexcolor' | 'var(--preset)' → CSS color usable in inline style. */
export function resolveAccent(theme: string | undefined | null): string {
  if (theme && theme !== 'default') return theme
  return 'var(--blue)'
}

// Matching "-rgb" triplet var for each theme preset, so we can build translucent tints/rings
// (rgba(var(--x-rgb), alpha)) the same way the rest of the site already does.
const THEME_RGB_VAR: Record<string, string> = {
  'var(--blue)': 'var(--blue-rgb)',
  'var(--accent2)': 'var(--accent2-rgb)',
  'var(--cat-teal)': 'var(--cat-teal-rgb)',
  'var(--warning)': 'var(--warning-rgb)',
  'var(--danger-soft)': 'var(--danger-soft-rgb)',
}

function hexToRgbTriplet(hex: string): string {
  let h = hex.replace('#', '')
  if (h.length === 3) h = h.split('').map(c => c + c).join('')
  const r = parseInt(h.slice(0, 2), 16) || 0
  const g = parseInt(h.slice(2, 4), 16) || 0
  const b = parseInt(h.slice(4, 6), 16) || 0
  return `${r}, ${g}, ${b}`
}

export function resolveAccentRgbTriplet(theme: string | undefined | null): string {
  const accent = resolveAccent(theme)
  if (/^#[0-9a-fA-F]{3,8}$/.test(accent)) return hexToRgbTriplet(accent)
  return THEME_RGB_VAR[accent] || 'var(--blue-rgb)'
}

/** form_configs.font_family token → real CSS font stack. */
export function resolveFont(font: string | undefined | null): string {
  switch (font) {
    case 'orbitron': return "'Orbitron', sans-serif"
    case 'rajdhani': return "'Rajdhani', sans-serif"
    case 'jakarta': return "'Plus Jakarta Sans', sans-serif"
    case 'mono': return "'JetBrains Mono', monospace"
    default: return 'inherit'
  }
}

// contact_persons is stored as either a plain array of manual entries, or
// `{ use_ec_page: true, ec_ids: [...] }` when the admin chose to pull
// contacts from the Executive Committee page. This helper normalizes both
// shapes into a flat list of FormContactPerson, fetching EC members when
// needed.
export function resolveContactPersons(
  contactPersons: any,
  ecMembers: EcMember[] = []
): FormContactPerson[] {
  if (Array.isArray(contactPersons)) return contactPersons
  if (contactPersons && contactPersons.use_ec_page === true && Array.isArray(contactPersons.ec_ids)) {
    return contactPersons.ec_ids
      .map((id: string) => ecMembers.find(m => m.id === id))
      .filter(Boolean)
      .map((ec: EcMember) => ({
        name: ec.full_name,
        post: ec.position,
        phone: '',
        email: ec.email || '',
        whatsapp: ec.whatsapp || '',
        facebook: ec.facebook_url || '',
      }))
  }
  return []
}
