// Shared presets for the per-session form appearance editor (and the legacy
// /admin/forms page, which still uses these for the global
// `activity_register` / `olympiad_register` / `membership` rows). Single
// source of truth so a new color or font only has to be added here, not in
// each editor.

export const THEME_PRESETS: { value: string; label: string; swatch: string }[] = [
  { value: 'default', label: 'NDSC Blue (default)', swatch: 'var(--blue)' },
  { value: 'var(--accent2)', label: 'Violet', swatch: 'var(--accent2)' },
  { value: 'var(--cat-teal)', label: 'Green', swatch: 'var(--cat-teal)' },
  { value: 'var(--warning)', label: 'Amber', swatch: 'var(--warning)' },
  { value: 'var(--danger-soft)', label: 'Red', swatch: 'var(--danger-soft)' },
]

export const FONT_OPTIONS: { value: string; label: string }[] = [
  { value: 'default', label: 'Default (Inter)' },
  { value: 'orbitron', label: 'Orbitron (techy, display)' },
  { value: 'rajdhani', label: 'Rajdhani (condensed)' },
  { value: 'jakarta', label: 'Plus Jakarta Sans (soft, modern)' },
  { value: 'mono', label: 'Monospace' },
]

export const COVER_RATIO_OPTIONS: { value: string; label: string }[] = [
  { value: 'auto', label: 'Native (as uploaded)' },
  { value: '16/9', label: 'Widescreen 16:9' },
  { value: '4/3', label: 'Standard 4:3' },
  { value: '1/1', label: 'Square 1:1' },
  { value: '21/9', label: 'Banner 21:9' },
]
