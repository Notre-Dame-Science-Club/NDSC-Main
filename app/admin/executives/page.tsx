'use client'
import { useEffect, useRef, useState } from 'react'

type Executive = {
  id: string
  full_name: string
  position: string
  panel: string
  dept: string
  photo_url: string
  facebook_url: string
  linkedin_url: string
  email: string
  whatsapp: string
  instagram_url: string
  github_url: string
  x_url: string
  display_order: number
  session_year: string
  is_active: boolean
}

const PANELS = [
  { value: 'committee', label: 'Executive Committee' },
  { value: 'moderators', label: 'Chief Patron & Moderators' },
  { value: 'former_moderators', label: 'Former Moderators' },
]

const empty = {
  full_name: '', position: '', panel: 'committee', dept: '',
  photo_url: '', facebook_url: '', linkedin_url: '',
  email: '', whatsapp: '', instagram_url: '', github_url: '', x_url: '',
  display_order: 0, session_year: '2025-26', is_active: true,
}

export default function AdminExecutivesPage() {
  const [items, setItems] = useState<Executive[]>([])
  const [form, setForm] = useState<any>(empty)
  const [editing, setEditing] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadError, setUploadError] = useState('')
  const [cropMode, setCropMode] = useState<'cover' | 'contain' | 'top' | 'center'>('top')
  const [msg, setMsg] = useState('')
  const [msgOk, setMsgOk] = useState(true)
  const [filterPanel, setFilterPanel] = useState('committee')
  const [filterYear, setFilterYear] = useState('2025-26')
  const photoRef = useRef<HTMLInputElement>(null)

  const load = async () => {
    const res = await fetch('/api/admin/executives')
    const data = await res.json()
    setItems(Array.isArray(data) ? data : [])
  }

  useEffect(() => { load() }, [])

  const uploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // File size check — max 4.5 MB
    if (file.size > 4.5 * 1024 * 1024) {
      setUploadError(`File too large: ${(file.size / 1024 / 1024).toFixed(1)} MB. Maximum allowed is 4.5 MB.`)
      return
    }

    setUploadError('')
    setUploading(true)
    setUploadProgress(0)

    const fd = new FormData()
    fd.append('file', file)
    fd.append('folder', 'executives')

    // XHR for progress
    const xhr = new XMLHttpRequest()
    xhr.upload.addEventListener('progress', (ev) => {
      if (ev.lengthComputable) {
        setUploadProgress(Math.round((ev.loaded / ev.total) * 100))
      }
    })

    xhr.addEventListener('load', () => {
      try {
        const data = JSON.parse(xhr.responseText)
        if (data.url) setForm((f: any) => ({ ...f, photo_url: data.url }))
        else setUploadError(data.error || 'Upload failed')
      } catch {
        setUploadError('Upload failed')
      }
      setUploading(false)
      setUploadProgress(0)
    })

    xhr.addEventListener('error', () => {
      setUploadError('Network error. Try again.')
      setUploading(false)
      setUploadProgress(0)
    })

    xhr.open('POST', '/api/admin/upload')
    xhr.send(fd)
  }

  const save = async () => {
    if (!form.full_name || !form.position) return (setMsg('Name and position required'), setMsgOk(false))
    setLoading(true)
    setMsg('')
    const method = editing ? 'PUT' : 'POST'
    const body = editing ? { ...form, id: editing } : form
    const res = await fetch('/api/admin/executives', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setLoading(false)
    if (res.ok) {
      setMsg('✅ Saved!')
      setMsgOk(true)
      setForm(empty)
      setEditing(null)
      load()
    } else {
      const d = await res.json()
      setMsg(d.error)
      setMsgOk(false)
    }
  }

  const del = async (id: string) => {
    if (!confirm('Delete this executive?')) return
    await fetch('/api/admin/executives', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    load()
  }

  const edit = (item: Executive) => {
    setEditing(item.id)
    setForm({
      full_name: item.full_name || '',
      position: item.position || '',
      panel: item.panel || 'committee',
      dept: item.dept || '',
      photo_url: item.photo_url || '',
      facebook_url: item.facebook_url || '',
      linkedin_url: item.linkedin_url || '',
      email: item.email || '',
      whatsapp: item.whatsapp || '',
      instagram_url: item.instagram_url || '',
      github_url: item.github_url || '',
      x_url: item.x_url || '',
      display_order: item.display_order || 0,
      session_year: item.session_year || '2025-26',
      is_active: item.is_active,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const filtered = items.filter(i => i.panel === filterPanel && i.session_year === filterYear)
  const years = [...new Set(items.map(i => i.session_year))].sort((a, b) => b.localeCompare(a))

  const inp = 'w-full rounded-lg px-3 py-2.5 text-sm outline-none'
  const s = { background: 'rgba(255,255,255,0.04)', border: '1px solid #0f2a4a', color: '#e8f4ff' }
  const lbl = 'block text-xs mb-1.5 font-medium uppercase tracking-wider'

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6"
        style={{ fontFamily: "'Orbitron', sans-serif", color: '#00d4ff' }}>
        Executives
      </h1>

      {/* Form */}
      <div className="rounded-xl border p-6 mb-8"
        style={{ background: '#050d1a', borderColor: '#0f2a4a' }}>
        <h2 className="font-bold mb-5 text-sm uppercase tracking-wider"
          style={{ color: '#00d4ff' }}>
          {editing ? '✏️ Edit Executive' : '➕ Add Executive'}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          <div>
            <label className={lbl} style={{ color: '#6a8faf' }}>Full Name *</label>
            <input className={inp} style={s}
              value={form.full_name}
              onChange={e => setForm({ ...form, full_name: e.target.value })}
              placeholder="Full name" />
          </div>

          <div>
            <label className={lbl} style={{ color: '#6a8faf' }}>Position *</label>
            <input className={inp} style={s}
              value={form.position}
              onChange={e => setForm({ ...form, position: e.target.value })}
              placeholder="e.g. President, General Secretary" />
          </div>

          <div>
            <label className={lbl} style={{ color: '#6a8faf' }}>Panel *</label>
            <select className={inp} style={s}
              value={form.panel}
              onChange={e => setForm({ ...form, panel: e.target.value })}>
              {PANELS.map(p => (
                <option key={p.value} value={p.value} style={{ background: '#050d1a' }}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={lbl} style={{ color: '#6a8faf' }}>Department (optional)</label>
            <input className={inp} style={s}
              value={form.dept}
              onChange={e => setForm({ ...form, dept: e.target.value })}
              placeholder="e.g. Publication, R&D" />
          </div>

          <div>
            <label className={lbl} style={{ color: '#6a8faf' }}>Session Year</label>
            <input className={inp} style={s}
              value={form.session_year}
              onChange={e => setForm({ ...form, session_year: e.target.value })}
              placeholder="e.g. 2025-26" />
          </div>

          <div>
            <label className={lbl} style={{ color: '#6a8faf' }}>Display Order</label>
            <input type="number" className={inp} style={s}
              value={form.display_order}
              onChange={e => setForm({ ...form, display_order: parseInt(e.target.value) || 0 })}
              placeholder="0 = first" />
          </div>

          {/* Photo Upload */}
          <div className="md:col-span-2">
            <label className={lbl} style={{ color: '#6a8faf' }}>Photo</label>

            {/* Crop mode selector */}
            <div className="flex gap-2 mb-2 flex-wrap">
              {(['top', 'center', 'cover', 'contain'] as const).map(mode => (
                <button key={mode} type="button" onClick={() => setCropMode(mode)}
                  className="px-3 py-1 rounded text-xs font-bold border transition-all"
                  style={{
                    background: cropMode === mode ? 'rgba(0,212,255,0.2)' : 'transparent',
                    borderColor: cropMode === mode ? '#00d4ff' : '#0f2a4a',
                    color: cropMode === mode ? '#00d4ff' : '#6a8faf',
                  }}>
                  {mode === 'top' ? '👤 Face (Top)' : mode === 'center' ? '⊙ Center' : mode === 'cover' ? '⛶ Fill' : '⊡ Fit'}
                </button>
              ))}
              <span className="text-xs self-center" style={{ color: '#6a8faf' }}>Max: 4.5 MB</span>
            </div>

            <button onClick={() => { setUploadError(''); photoRef.current?.click() }}
              disabled={uploading}
              className="w-full py-2.5 rounded-lg text-sm border-dashed border-2 mb-2 transition-all"
              style={{ borderColor: uploading ? '#00d4ff' : '#0f2a4a', color: uploading ? '#00d4ff' : '#6a8faf' }}>
              {uploading ? `⏳ Uploading... ${uploadProgress}%` : '📷 Upload Photo'}
            </button>

            {/* Progress bar */}
            {uploading && (
              <div className="w-full rounded-full overflow-hidden mb-2" style={{ height: '4px', background: 'rgba(255,255,255,0.06)' }}>
                <div className="h-full rounded-full transition-all duration-200"
                  style={{ width: `${uploadProgress}%`, background: 'linear-gradient(90deg, #00d4ff, #0099cc)' }} />
              </div>
            )}

            {/* Error */}
            {uploadError && (
              <p className="text-xs mb-2 font-medium" style={{ color: '#ff7070' }}>⚠️ {uploadError}</p>
            )}

            <input ref={photoRef} type="file" accept="image/*" className="hidden"
              onChange={uploadPhoto} />

            {form.photo_url && (
              <div className="flex items-center gap-3">
                <img src={form.photo_url} alt="preview"
                  className="w-16 h-20 rounded-lg"
                  style={{ objectFit: cropMode === 'contain' ? 'contain' : 'cover', objectPosition: cropMode === 'top' ? 'top' : 'center' }} />
                <div>
                  <p className="text-xs mb-1" style={{ color: '#6a8faf' }}>Preview ({cropMode})</p>
                  <button onClick={() => setForm({ ...form, photo_url: '' })}
                    className="text-xs" style={{ color: '#ff5050' }}>Remove</button>
                </div>
              </div>
            )}
          </div>

          {/* Social Links */}
          <div>
            <label className={lbl} style={{ color: '#6a8faf' }}>Facebook URL</label>
            <input className={inp} style={s}
              value={form.facebook_url}
              onChange={e => setForm({ ...form, facebook_url: e.target.value })}
              placeholder="https://facebook.com/..." />
          </div>

          <div>
            <label className={lbl} style={{ color: '#6a8faf' }}>LinkedIn URL</label>
            <input className={inp} style={s}
              value={form.linkedin_url}
              onChange={e => setForm({ ...form, linkedin_url: e.target.value })}
              placeholder="https://linkedin.com/in/..." />
          </div>

          <div>
            <label className={lbl} style={{ color: '#6a8faf' }}>Email</label>
            <input className={inp} style={s}
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              placeholder="email@example.com" />
          </div>

          <div>
            <label className={lbl} style={{ color: '#6a8faf' }}>WhatsApp Number</label>
            <input className={inp} style={s}
              value={form.whatsapp}
              onChange={e => setForm({ ...form, whatsapp: e.target.value })}
              placeholder="+8801..." />
          </div>

          <div>
            <label className={lbl} style={{ color: '#6a8faf' }}>Instagram URL</label>
            <input className={inp} style={s}
              value={form.instagram_url}
              onChange={e => setForm({ ...form, instagram_url: e.target.value })}
              placeholder="https://instagram.com/..." />
          </div>

          <div>
            <label className={lbl} style={{ color: '#6a8faf' }}>GitHub URL</label>
            <input className={inp} style={s}
              value={form.github_url || ''}
              onChange={e => setForm({ ...form, github_url: e.target.value })}
              placeholder="https://github.com/..." />
          </div>

          <div>
            <label className={lbl} style={{ color: '#6a8faf' }}>X (Twitter) URL</label>
            <input className={inp} style={s}
              value={form.x_url || ''}
              onChange={e => setForm({ ...form, x_url: e.target.value })}
              placeholder="https://x.com/..." />
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="active" checked={form.is_active}
              onChange={e => setForm({ ...form, is_active: e.target.checked })} />
            <label htmlFor="active" className="text-sm" style={{ color: '#6a8faf' }}>
              Active (website এ দেখাবে)
            </label>
          </div>
        </div>

        {msg && (
          <p className="mt-4 text-sm font-medium"
            style={{ color: msgOk ? '#00ff80' : '#ff7070' }}>{msg}</p>
        )}

        <div className="flex gap-3 mt-5">
          <button onClick={save} disabled={loading}
            className="px-6 py-2.5 rounded-lg text-sm font-bold text-black"
            style={{ background: '#00d4ff', opacity: loading ? 0.6 : 1 }}>
            {loading ? 'Saving...' : editing ? '✅ Update' : '➕ Add Executive'}
          </button>
          {editing && (
            <button onClick={() => { setEditing(null); setForm(empty) }}
              className="px-6 py-2.5 rounded-lg text-sm font-bold"
              style={{ background: 'rgba(255,255,255,0.05)', color: '#6a8faf' }}>
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Filter */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex gap-2">
          {PANELS.map(p => (
            <button key={p.value} onClick={() => setFilterPanel(p.value)}
              className="px-4 py-1.5 rounded text-xs font-bold border transition-all"
              style={{
                background: filterPanel === p.value ? '#00d4ff' : 'transparent',
                color: filterPanel === p.value ? '#000' : '#6a8faf',
                borderColor: filterPanel === p.value ? '#00d4ff' : '#0f2a4a',
              }}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap">
          {years.map(y => (
            <button key={y} onClick={() => setFilterYear(y)}
              className="px-3 py-1.5 rounded text-xs font-bold border transition-all"
              style={{
                background: filterYear === y ? 'rgba(0,212,255,0.15)' : 'transparent',
                color: filterYear === y ? '#00d4ff' : '#6a8faf',
                borderColor: filterYear === y ? '#00d4ff' : '#0f2a4a',
              }}>
              {y}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {filtered
          .sort((a, b) => a.display_order - b.display_order)
          .map(item => (
            <div key={item.id} className="rounded-xl border overflow-hidden"
              style={{ background: '#050d1a', borderColor: '#0f2a4a' }}>
              <div className="relative" style={{ height: 140 }}>
                {item.photo_url ? (
                  <img src={item.photo_url} alt={item.full_name}
                    className="w-full h-full object-cover object-top" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"
                    style={{ background: '#0a1f35' }}>
                    <span className="text-3xl">👤</span>
                  </div>
                )}
              </div>
              <div className="p-3">
                <p className="font-bold text-xs mb-0.5" style={{ color: '#e8f4ff' }}>{item.full_name}</p>
                <p className="text-xs mb-0.5" style={{ color: '#00d4ff' }}>{item.position}</p>
                {item.dept && <p className="text-xs" style={{ color: '#6a8faf' }}>{item.dept}</p>}
                <div className="flex gap-2 mt-2">
                  <button onClick={() => edit(item)}
                    className="flex-1 py-1 rounded text-xs"
                    style={{ background: 'rgba(0,212,255,0.1)', color: '#00d4ff' }}>
                    Edit
                  </button>
                  <button onClick={() => del(item.id)}
                    className="flex-1 py-1 rounded text-xs"
                    style={{ background: 'rgba(255,80,80,0.1)', color: '#ff5050' }}>
                    Del
                  </button>
                </div>
              </div>
            </div>
          ))}
        {filtered.length === 0 && (
          <div className="col-span-4 text-center py-12" style={{ color: '#6a8faf' }}>
            No executives for this panel/year. Add one above!
          </div>
        )}
      </div>
    </div>
  )
}
