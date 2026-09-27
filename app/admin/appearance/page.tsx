'use client'
import { useEffect, useState, useCallback } from 'react'
import { CURATED_GOOGLE_FONTS, searchGoogleFonts, buildGoogleFontsUrl, parseGoogleFontsFamily, isGoogleFontsUrl } from '@/lib/googleFonts'
import { isValidHex } from '@/lib/color'
import { normalizeUploadUrl } from '@/lib/uploadUrl'
import { Search, Link2, Check, AlertCircle, Upload, X, Video, Image as ImageIcon } from 'lucide-react'
import { THEMES, THEME_IDS, ThemeId, parseThemeList, resolveAppearance } from '@/lib/themes'

const HEADER_SIZE_OPTIONS = [
  { value: 'compact', label: 'Compact (56px)' },
  { value: 'default', label: 'Default (64px)' },
  { value: 'large', label: 'Large (76px)' },
]

const ACCENT_PRESETS = [
  { value: 'var(--blue)', label: 'Cyan (default)' },
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
  const [uploadProgress, setUploadProgress] = useState<{ video: number | null; poster: number | null }>({ video: null, poster: null })

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

  // Upload helper for video/poster — goes straight to Hostinger, bypassing the
  // Vercel serverless function's ~4.5MB request-body cap (that cap is what was
  // producing the 413s; /api/admin/upload's own 200MB check never even ran).
  const UPLOAD_FOLDERS: Record<string, string> = {
    'about-hero-video': 'about-hero',
    'about-hero-poster': 'about-hero',
  }

  const uploadFile = useCallback(async (
    file: File,
    folderKey: string,
    onProgress?: (pct: number) => void
  ): Promise<string | null> => {
    // Step 1: get a short-lived upload token from our own API (this call is tiny,
    // so it's unaffected by the body-size limit)
    let uploadUrl: string
    let secret: string
    try {
      const res = await fetch('/api/admin/upload-token')
      const data = await res.json()
      if (!res.ok || !data.uploadUrl || !data.secret) {
        alert(data.error || 'Could not get upload token')
        return null
      }
      uploadUrl = data.uploadUrl
      secret = data.secret
    } catch {
      alert('Upload error: could not reach server')
      return null
    }

    // Step 2: upload directly to Hostinger from the browser
    const folder = UPLOAD_FOLDERS[folderKey] ?? 'misc'
    const fd = new FormData()
    fd.append('file', file)
    fd.append('folder', folder)

    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest()
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100))
      })
      xhr.addEventListener('load', () => {
        try {
          const data = JSON.parse(xhr.responseText)
          if (xhr.status >= 200 && xhr.status < 300 && data.url) {
            resolve(normalizeUploadUrl(data.url))
          } else {
            alert(data.error || `Upload failed (${xhr.status})`)
            resolve(null)
          }
        } catch {
          alert('Upload failed: invalid response from upload server')
          resolve(null)
        }
      })
      xhr.addEventListener('error', () => { alert('Upload error'); resolve(null) })
      xhr.open('POST', uploadUrl)
      xhr.setRequestHeader('X-Upload-Secret', secret)
      xhr.send(fd)
    })
  }, [])

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('video/')) { alert('Please select a video file'); return }
    if (file.size > 5 * 1024 * 1024) { alert('Video must be ≤5MB'); return }
    setUploadProgress(p => ({ ...p, video: 0 }))
    const url = await uploadFile(file, 'about-hero-video', (pct) => setUploadProgress(p => ({ ...p, video: pct })))
    if (url) {
      setValues(v => ({ ...v, about_hero_video_url: url }))
      save('about_hero_video_url', url)
    }
    setUploadProgress(p => ({ ...p, video: null }))
    e.target.value = ''
  }

  const handlePosterUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { alert('Please select an image file'); return }
    if (file.size > 10 * 1024 * 1024) { alert('Poster image must be ≤10MB'); return }
    setUploadProgress(p => ({ ...p, poster: 0 }))
    const url = await uploadFile(file, 'about-hero-poster', (pct) => setUploadProgress(p => ({ ...p, poster: pct })))
    if (url) {
      setValues(v => ({ ...v, about_hero_poster_url: url }))
      save('about_hero_poster_url', url)
    }
    setUploadProgress(p => ({ ...p, poster: null }))
    e.target.value = ''
  }

  const clearVideo = () => {
    setValues(v => ({ ...v, about_hero_video_url: '' }))
    save('about_hero_video_url', '')
  }

  const clearPoster = () => {
    setValues(v => ({ ...v, about_hero_poster_url: '' }))
    save('about_hero_poster_url', '')
  }

  // Theme-model state, read through the same resolver the site uses so the
  // panel can never disagree with what visitors actually get.
  const { defaultTheme, switcherEnabled } = resolveAppearance(values)
  const switchable: ThemeId[] = (() => {
    const list = parseThemeList(values.theme_switcher_themes)
    const base = list.length ? list : [...THEME_IDS]
    return base.includes(defaultTheme) ? base : [defaultTheme, ...base]
  })()

  const toggleSwitchable = (id: ThemeId) => {
    if (id === defaultTheme) return // always on — see the tooltip
    const next = switchable.includes(id)
      ? switchable.filter((t) => t !== id)
      : [...switchable, id]
    // Keep a stable order so the navbar buttons don't reshuffle on each save.
    save('theme_switcher_themes', THEME_IDS.filter((t) => next.includes(t)).join(','))
  }

  const results = fontQuery ? searchGoogleFonts(fontQuery, 8) : []
  const currentFontName = values.font_family?.split("'")[1] || 'Poppins'
  const currentAccent = values.accent_color || 'var(--blue)'

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: 'inherit', color: 'var(--blue)' }}>
        Appearance
      </h1>
      <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
        Changes save instantly and apply site-wide for every visitor.
      </p>

      {loading ? (
        <p className="text-sm" style={{ color: 'var(--muted)' }}>Loading…</p>
      ) : (
        <div className="space-y-5">

          {/* THEME MODEL */}
          <div className="rounded-xl border p-6" style={sectionCard}>
            <label className="block text-xs mb-1.5 uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Default Theme Model</label>
            <p className="text-xs mb-4" style={{ color: 'var(--muted)', opacity: 0.75 }}>
              What a first-time visitor sees. A model repaints the whole site — navbar, footer, every page's background and text. Visitors who have picked their own model with the switcher keep their choice.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {THEME_IDS.map((id) => {
                const meta = THEMES[id]
                const active = defaultTheme === id
                return (
                  <button key={id} onClick={() => save('default_theme', id)}
                    className="text-left rounded-xl border p-3 transition-colors"
                    style={{
                      borderColor: active ? 'var(--blue)' : 'var(--border)',
                      background: active ? 'rgba(var(--blue-rgb), 0.08)' : 'transparent',
                    }}>
                    {/* Swatch — background, surface, accent, in that order */}
                    <span className="flex gap-1 mb-2.5">
                      {meta.swatch.map((c, i) => (
                        <span key={i} className="h-6 flex-1 rounded"
                          style={{ background: c, border: '1px solid rgba(127,127,127,0.25)' }} />
                      ))}
                    </span>
                    <span className="flex items-center gap-1.5 text-sm font-semibold"
                      style={{ color: active ? 'var(--blue)' : 'var(--white)' }}>
                      {meta.label}
                      {active && <Check size={13} />}
                    </span>
                    <span className="block text-xs mt-1" style={{ color: 'var(--muted)', opacity: 0.8 }}>
                      {meta.description}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* PUBLIC THEME SWITCHER */}
          <div className="rounded-xl border p-6" style={sectionCard}>
            <label className="block text-xs mb-1.5 uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Theme Switcher Button</label>
            <p className="text-xs mb-4" style={{ color: 'var(--muted)', opacity: 0.75 }}>
              Shows a small button in the navbar, right of Login, so visitors can change the model themselves. Turn it off and everyone stays on the default above.
            </p>

            <div className="flex gap-2 mb-5">
              {[{ v: '1', l: 'Show button' }, { v: '0', l: 'Hide button' }].map((o) => {
                const active = (switcherEnabled ? '1' : '0') === o.v
                return (
                  <button key={o.v} onClick={() => save('theme_switcher_enabled', o.v)}
                    className="px-4 py-2 rounded-lg text-sm font-semibold border transition-colors"
                    style={{
                      borderColor: active ? 'var(--blue)' : 'var(--border)',
                      color: active ? 'var(--blue)' : 'var(--muted)',
                      background: active ? 'rgba(var(--blue-rgb), 0.08)' : 'transparent',
                    }}>
                    {o.l}
                  </button>
                )
              })}
            </div>

            <div style={{ opacity: switcherEnabled ? 1 : 0.4, pointerEvents: switcherEnabled ? 'auto' : 'none' }}>
              <label className="block text-xs mb-1.5 uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Models the button can switch between</label>
              <p className="text-xs mb-3" style={{ color: 'var(--muted)', opacity: 0.75 }}>
                Tick at least two. The default model is always included — otherwise the button could strand someone on a model you've since removed.
              </p>
              <div className="flex flex-wrap gap-2">
                {THEME_IDS.map((id) => {
                  const on = switchable.includes(id)
                  const locked = id === defaultTheme
                  return (
                    <button key={id} onClick={() => toggleSwitchable(id)} disabled={locked}
                      title={locked ? 'The default model is always switchable' : undefined}
                      className="flex items-center gap-2 px-3.5 py-2 rounded-full text-sm border transition-colors"
                      style={{
                        borderColor: on ? 'var(--blue)' : 'var(--border)',
                        color: on ? 'var(--blue)' : 'var(--muted)',
                        background: on ? 'rgba(var(--blue-rgb), 0.08)' : 'transparent',
                        cursor: locked ? 'not-allowed' : 'pointer',
                      }}>
                      <span className="w-3.5 h-3.5 rounded-sm border flex items-center justify-center"
                        style={{ borderColor: on ? 'var(--blue)' : 'var(--border)', background: on ? 'var(--blue)' : 'transparent' }}>
                        {on && <Check size={10} color="#000" />}
                      </span>
                      {THEMES[id].label}
                    </button>
                  )
                })}
              </div>
              {switchable.length < 2 && (
                <p className="flex items-start gap-1.5 text-xs mt-3" style={{ color: 'var(--warning)' }}>
                  <AlertCircle size={13} className="shrink-0 mt-0.5" />
                  With only one model ticked the button has nowhere to switch to, so it stays hidden.
                </p>
              )}
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
                placeholder="var(--blue)" />
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
                      className="w-full text-left px-3 py-2 text-sm transition-colors hover:bg-[rgba(var(--blue-rgb), 0.06)]"
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
                    background: (values.header_size || 'default') === o.value ? 'rgba(var(--blue-rgb), 0.08)' : 'transparent',
                  }}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* ABOUT PAGE HERO VIDEO */}
          <div className="rounded-xl border p-6" style={sectionCard}>
            <label className="block text-xs mb-1.5 uppercase tracking-wider flex items-center gap-2" style={{ color: 'var(--muted)' }}>
              <Video size={13} /> About Page Hero Video
            </label>
            <p className="text-xs mb-4" style={{ color: 'var(--muted)', opacity: 0.75 }}>
              3s loop, ≤5MB H.264 MP4. Shows as background on /about page. Poster displays while loading.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {/* Video Upload */}
              <div>
                <label className="block text-xs mb-1.5 uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--muted)' }}>
                  <Video size={11} /> Video File (MP4)
                </label>
                <div className="relative">
                  <input
                    type="file"
                    accept="video/mp4"
                    onChange={handleVideoUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="rounded-lg border-2 border-dashed p-6 text-center transition-colors"
                    style={{
                      borderColor: 'var(--border)',
                      background: 'rgba(255,255,255,0.02)',
                    }}>
                    <Upload size={24} className="mx-auto mb-2" style={{ color: 'var(--muted)' }} />
                    <p className="text-sm" style={{ color: 'var(--muted)' }}>
                      {uploadProgress.video !== null ? `Uploading… ${uploadProgress.video}%` : values.about_hero_video_url ? 'Click to replace' : 'Click to upload'}
                    </p>
                    <p className="text-xs mt-1" style={{ color: 'var(--muted)', opacity: 0.7 }}>MP4, ≤5MB</p>
                  </div>
                </div>
                {values.about_hero_video_url && (
                  <div className="mt-3 relative rounded-lg overflow-hidden">
                    <video src={values.about_hero_video_url} controls className="w-full" style={{ height: 140 }} />
                    <button
                      onClick={clearVideo}
                      className="absolute top-2 right-2 p-1.5 rounded-full transition-colors"
                      style={{ background: 'rgba(0,0,0,0.6)', color: 'var(--white)' }}
                      title="Remove video"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>
              
              {/* Poster Upload */}
              <div>
                <label className="block text-xs mb-1.5 uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--muted)' }}>
                  <ImageIcon size={11} /> Poster Image (JPG/PNG)
                </label>
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePosterUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="rounded-lg border-2 border-dashed p-6 text-center transition-colors"
                    style={{
                      borderColor: 'var(--border)',
                      background: 'rgba(255,255,255,0.02)',
                    }}>
                    <Upload size={24} className="mx-auto mb-2" style={{ color: 'var(--muted)' }} />
                    <p className="text-sm" style={{ color: 'var(--muted)' }}>
                      {uploadProgress.poster !== null ? `Uploading… ${uploadProgress.poster}%` : values.about_hero_poster_url ? 'Click to replace' : 'Click to upload'}
                    </p>
                    <p className="text-xs mt-1" style={{ color: 'var(--muted)', opacity: 0.7 }}>JPG/PNG, first frame fallback</p>
                  </div>
                </div>
                {values.about_hero_poster_url && (
                  <div className="mt-3 relative rounded-lg overflow-hidden">
                    <img src={values.about_hero_poster_url} className="w-full" style={{ height: 140, objectFit: 'cover' }} />
                    <button
                      onClick={clearPoster}
                      className="absolute top-2 right-2 p-1.5 rounded-full transition-colors"
                      style={{ background: 'rgba(0,0,0,0.6)', color: 'var(--white)' }}
                      title="Remove poster"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>
            
            {/* Status */}
            <div className="flex flex-wrap gap-2 text-xs">
              {values.about_hero_video_url && (
                <span className="px-2 py-1 rounded-full" style={{ background: 'rgba(var(--success-rgb), 0.15)', color: 'var(--success)' }}>
                  Video: Ready
                </span>
              )}
              {values.about_hero_poster_url && (
                <span className="px-2 py-1 rounded-full" style={{ background: 'rgba(var(--success-rgb), 0.15)', color: 'var(--success)' }}>
                  Poster: Ready
                </span>
              )}
              {!values.about_hero_video_url && !values.about_hero_poster_url && (
                <span className="px-2 py-1 rounded-full" style={{ background: 'rgba(var(--muted-rgb), 0.15)', color: 'var(--muted)' }}>
                  No video configured
                </span>
              )}
            </div>
          </div>

        </div>
      )}
    </div>
  )
}
