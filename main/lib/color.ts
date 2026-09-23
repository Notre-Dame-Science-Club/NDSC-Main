// Small hex-color helpers used to derive the full accent palette
// (--blue2, --glow, --blue-rgb) from a single picked accent color.

function normalizeHex(hex: string): string {
  const h = hex.trim().replace('#', '')
  if (h.length === 3) return h.split('').map((c) => c + c).join('')
  return h
}

export function hexToRgbTuple(hex: string): [number, number, number] {
  const full = normalizeHex(hex)
  const bigint = parseInt(full, 16) || 0
  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255]
}

export function hexToRgbString(hex: string): string {
  return hexToRgbTuple(hex).join(', ')
}

export function darkenHex(hex: string, amount = 0.25): string {
  const [r, g, b] = hexToRgbTuple(hex)
  const d = (v: number) => Math.max(0, Math.round(v * (1 - amount)))
  return '#' + [d(r), d(g), d(b)].map((v) => v.toString(16).padStart(2, '0')).join('')
}

export function isValidHex(hex: string): boolean {
  return /^#?[0-9a-fA-F]{3}$|^#?[0-9a-fA-F]{6}$/.test(hex.trim())
}
