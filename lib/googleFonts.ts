// Google Fonts helpers for the Appearance settings page.
//
// Two ways to pick a font:
// 1. Search the curated list below and click a result (we build the
//    stylesheet URL ourselves).
// 2. Paste any Google Fonts URL directly (e.g. copied from fonts.google.com's
//    "Get font" panel) and we parse the family name out of it.

export const CURATED_GOOGLE_FONTS = [
  'Poppins', 'Plus Jakarta Sans', 'Montserrat', 'Inter', 'Roboto', 'Open Sans',
  'Lato', 'Nunito', 'Raleway', 'Work Sans', 'Rubik', 'Manrope',
  'Space Grotesk', 'Sora', 'DM Sans', 'Outfit', 'Urbanist', 'Barlow',
  'Karla', 'Mulish', 'Josefin Sans', 'Quicksand', 'Fira Sans',
  'Source Sans 3', 'Libre Franklin', 'IBM Plex Sans', 'Red Hat Display',
  'Epilogue', 'Figtree', 'Lexend', 'Public Sans', 'Archivo',
  'Bricolage Grotesque', 'Instrument Sans', 'Share Tech Mono',
  'JetBrains Mono', 'Orbitron', 'Exo 2', 'Chakra Petch', 'Syne',
  'Playfair Display', 'Merriweather', 'Bebas Neue', 'Oswald', 'Anton',
]

export function searchGoogleFonts(query: string, limit = 8): string[] {
  const q = query.trim().toLowerCase()
  if (!q) return CURATED_GOOGLE_FONTS.slice(0, limit)
  return CURATED_GOOGLE_FONTS.filter((f) => f.toLowerCase().includes(q)).slice(0, limit)
}

export function buildGoogleFontsUrl(family: string, weights: number[] = [300, 400, 500, 600, 700, 800]): string {
  return `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weights.join(';')}&display=swap`
}

/** Best-effort extraction of a font family name from a pasted Google Fonts URL. */
export function parseGoogleFontsFamily(url: string): string | null {
  try {
    const u = new URL(url.trim())
    const family = u.searchParams.get('family')
    if (!family) return null
    // family param can be "Roboto:wght@400;700" or "Roboto|Open+Sans" (css1) — take the first family only
    const first = family.split('|')[0].split(':')[0]
    const name = first.replace(/\+/g, ' ').trim()
    return name || null
  } catch {
    return null
  }
}

export function isGoogleFontsUrl(url: string): boolean {
  try {
    const u = new URL(url.trim())
    return u.hostname === 'fonts.googleapis.com'
  } catch {
    return false
  }
}
