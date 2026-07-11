'use client'
import { useEffect, useState } from 'react'
import { CURATED_GOOGLE_FONTS, searchGoogleFonts, buildGoogleFontsUrl, parseGoogleFontsFamily, isGoogleFontsUrl } from '@/lib/googleFonts'
import { isValidHex } from '@/lib/color'
import { Search, Link2, Check, AlertCircle } from 'lucide-react'

const THEME_OPTIONS = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
]

const HEADER_SIZE_OPTIONS = [
  { value: 'compact', label: 'Compact (56px)' },
  { value: 'default', label: 'Default (64px)' },
  { value: 'large', label: 'Large (76px)' },
]

const ACCENT_PRESETS = [
  { value: '#00d4ff', label: 'Cyan (default)' },
  { value: '#a78bfa', label: 'Violet' },
  { value: '#34d399', label: 'Emerald' },
  { value: '#fb923c', label: 'Amber' },
  { value: '#f472b6', label: 'Pink' },
  { value: '#f87171', label: 'Red' },
]

const inp = 'w-full rounded-lg px-3 py-2.5 text-sm outline-none'
const inpStyle = { background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--white)' }
const sectionCard = { background: 'var(--bg2)', borderColor: 'var(--border)' }

export default function AppearanceSettingsAdmin() {
  const [values, setValues] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState<Record<string, boolean>>({})

  // Font search UI state
  const [fontQuery, setFontQuery] = useState('')
  const [linkInput, setLinkInput] = useState('')
  const [linkError, setLinkError] = useState('')

  useEffect(() => {
    fetch('/api/admin/appearance-settings')
      .then((r) => r.json())
      .then((d) => setValues(d))
      .finally(() => setLoading(false))
  }, [])

  // Load whatever font is currently selected into the page so the preview text renders in it.
  useEffect(() => {
    const href = values.font_google_url
    if (!href) return
    const id = 'appearance-font-preview'
    let link = document.getElementById(id) as HTMLLinkElement | null
    if (!link) {
      link = document.createElement('link')
      link.id = id
      link.rel = 'stylesheet'
      document.head.appendChild(link)
    }
    link.href = href
  }, [values.font_google_url])

  const save = async (key: string, value: string) => {
    const res = await fetch('/api/admin/appearance-settings', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value }),
    })
    if (res.ok) {
      setValues((v) => ({ ...v, [key]: value }))
      setSaved((s) => ({ ...s, [key]: true }))
      setTimeout(() => setSaved((s) => ({ ...s, [key]: false })), 2000)
    }
  }

  const pickFont = (familyName: string) => {
    const url = buildGoogleFontsUrl(familyName)
    save('font_family', `'${familyName}', sans-serif`)
    save('font_google_url', url)
    setFontQuery('')
  }

  const useCustomLink = () => {
    setLinkError('')
    if (!linkInput.trim()) return
    if (!isGoogleFontsUrl(linkInput)) {
      setLinkError("That doesn't look like a fonts.googleapis.com link — paste the URL from a font's \"Get font\" → \"Get embed code\" panel on fonts.google.com.")
      return
    }
    const family = parseGoogleFontsFamily(linkInput)
    if (!family) {
      setLinkError("Couldn't find a font family in that link.")
      return
    }
    save('font_family', `'${family}', sans-serif`)
    save('font_google_url', linkInput.trim())
    setLinkInput('')
  }

  const results = fontQuery ? searchGoogleFonts(fontQuery, 8) : []
  const currentFontName = values.font_family?.split("'")[1] || 'Poppins'
  const currentAccent = values.accent_color || '#00d4ff'

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: "'Orbitron',sans-serif", color: 'var(--blue)' }}>
        Appearance
      </h1>
      <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
        Changes save instantly and apply site-wide for every visitor.
      </p>

      {loading ? (
        <p className="text-sm" style={{ color: 'var(--muted)' }}>Loading…</p>
      ) : (
        <div className="space-y-5">

          {/* THEME */}
          <div className="rounded-xl border p-6" style={sectionCard}>
            <label className="block text-xs mb-1.5 uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Default Theme</label>
            <p className="text-xs mb-3" style={{ color: 'var(--muted)', opacity: 0.75 }}>
              What first-time visitors see. Anyone who's already toggled dark/light on their own device keeps their own choice.
            </p>
            <div className="flex gap-2">
              {THEME_OPTIONS.map((o) => (
                <button key={o.value} onClick={() => save('default_theme', o.value)}
                  className="px-4 py-2 rounded-lg text-sm font-semibold border transition-colors"
                  style={{
                    borderColor: (values.default_theme || 'dark') === o.value ? 'var(--blue)' : 'var(--border)',
                    color: (values.default_theme || 'dark') === o.value ? 'var(--blue)' : 'var(--muted)',
                    background: (values.default_theme || 'dark') === o.value ? 'rgba(0,212,255,0.08)' : 'transparent',
                  }}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* ACCENT COLOR */}
          <div className="rounded-xl border p-6" style={sectionCard}>
            <label className="block text-xs mb-1.5 uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Accent Color</label>
            <p className="text-xs mb-3" style={{ color: 'var(--muted)', opacity: 0.75 }}>
              The site's core neon color — links, buttons, glows, highlights. Everything else (darker shade, glow, translucent overlays) is derived from this automatically.
            </p>
            <div className="flex flex-wrap gap-2 mb-3">
              {ACCENT_PRESETS.map((p) => (
                <button key={p.value} onClick={() => save('accent_color', p.value)} title={p.label}
                  className="w-9 h-9 rounded-full border-2 transition-transform hover:scale-110 flex items-center justify-center"
                  style={{ background: p.value, borderColor: currentAccent.toLowerCase() === p.value ? 'var(--white)' : 'transparent' }}>
                  {currentAccent.toLowerCase() === p.value && <Check size={16} color="#000" />}
                </button>
              ))}
              <label className="w-9 h-9 rounded-full border-2 flex items-center justify-center cursor-pointer overflow-hidden relative"
                style={{ borderColor: 'var(--border)', background: 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)' }}
                title="Custom color">
                <input type="color" value={isValidHex(currentAccent) ? currentAccent : '#00d4ff'}
                  onChange={(e) => save('accent_color', e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer" />
              </label>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded shrink-0" style={{ background: currentAccent }} />
              <input className={inp} style={{ ...inpStyle, maxWidth: 140 }} value={currentAccent}
                onChange={(e) => setValues((v) => ({ ...v, accent_color: e.target.value }))}
                onBlur={() => isValidHex(values.accent_color || '') && save('accent_color', values.accent_color!)}
                placeholder="#00d4ff" />
              {saved.accent_color && <span className="text-xs font-semibold" style={{ color: 'var(--success)' }}>Saved!</span>}
            </div>
          </div>

          {/* FONT */}
          <div className="rounded-xl border p-6" style={sectionCard}>
            <label className="block text-xs mb-1.5 uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Site Font</label>
            <p className="text-xs mb-3" style={{ color: 'var(--muted)', opacity: 0.75 }}>
              Search any Google Font, or paste a link from fonts.google.com. Applies to body text and headings everywhere.
            </p>

            {/* Live preview */}
            <div className="rounded-lg border px-4 py-3 mb-4" style={{ borderColor: 'var(--border)', background: 'rgba(255,255,255,0.02)' }}>
              <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--muted)' }}>Preview — {currentFontName}</div>
              <div style={{ fontFamily: values.font_family || "'Poppins', sans-serif", fontSize: '1.05rem', fontWeight: 600, color: 'var(--white)' }}>
                The quick brown fox jumps over the lazy dog — 0123456789
              </div>
            </div>

            {/* Search */}
            <div className="relative mb-3">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)' }} />
              <input className={inp} style={{ ...inpStyle, paddingLeft: 34 }} value={fontQuery}
                onChange={(e) => setFontQuery(e.target.value)}
                placeholder="Search Google Fonts — e.g. Roboto, Space Grotesk…" />
              {results.length > 0 && (
                <div className="mt-2 rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                  {results.map((f) => (
                    <button key={f} onClick={() => pickFont(f)}
                      className="w-full text-left px-3 py-2 text-sm transition-colors hover:bg-[rgba(0,212,255,0.06)]"
                      style={{ color: 'var(--white)', fontFamily: `'${f}', sans-serif` }}>
                      {f}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Quick picks */}
            <div className="flex flex-wrap gap-2 mb-4">
              {CURATED_GOOGLE_FONTS.slice(0, 8).map((f) => (
                <button key={f} onClick={() => pickFont(f)}
                  className="px-3 py-1.5 rounded-full text-xs border transition-colors"
                  style={{
                    borderColor: currentFontName === f ? 'var(--blue)' : 'var(--border)',
                    color: currentFontName === f ? 'var(--blue)' : 'var(--muted)',
                    fontFamily: `'${f}', sans-serif`,
                  }}>
                  {f}
                </button>
              ))}
            </div>

            {/* Paste link */}
            <div className="pt-4" style={{ borderTop: '1px solid var(--border)' }}>
              <label className="flex items-center gap-1.5 text-xs mb-2 uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
                <Link2 size={13} /> Or paste a font link
              </label>
              <div className="flex gap-2">
                <input className={inp} style={inpStyle} value={linkInput}
                  onChange={(e) => setLinkInput(e.target.value)}
                  placeholder="https://fonts.googleapis.com/css2?family=..." />
                <button onClick={useCustomLink}
                  className="px-4 py-2 rounded-lg text-sm font-bold shrink-0"
                  style={{ background: 'var(--blue)', color: '#000' }}>
                  Use link
                </button>
              </div>
              {linkError && (
                <p className="flex items-start gap-1.5 text-xs mt-2" style={{ color: 'var(--danger)' }}>
                  <AlertCircle size={13} className="shrink-0 mt-0.5" /> {linkError}
                </p>
              )}
            </div>
          </div>

          {/* HEADER SIZE */}
          <div className="rounded-xl border p-6" style={sectionCard}>
            <label className="block text-xs mb-1.5 uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Header Size</label>
            <p className="text-xs mb-3" style={{ color: 'var(--muted)', opacity: 0.75 }}>Controls the navbar height and logo size site-wide.</p>
            <div className="flex gap-2">
              {HEADER_SIZE_OPTIONS.map((o) => (
                <button key={o.value} onClick={() => save('header_size', o.value)}
                  className="px-4 py-2 rounded-lg text-sm font-semibold border transition-colors"
                  style={{
                    borderColor: (values.header_size || 'default') === o.value ? 'var(--blue)' : 'var(--border)',
                    color: (values.header_size || 'default') === o.value ? 'var(--blue)' : 'var(--muted)',
                    background: (values.header_size || 'default') === o.value ? 'rgba(0,212,255,0.08)' : 'transparent',
                  }}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
  )
}
