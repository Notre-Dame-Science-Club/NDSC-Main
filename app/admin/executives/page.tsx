'use client'
import { useEffect, useRef, useState, useCallback } from 'react'

/* ══════════════════════════════════
   TYPES
══════════════════════════════════ */
type Executive = {
  id: string; full_name: string; position: string; panel: string; dept: string;
  photo_url: string; photo_position: string;
  facebook_url: string; linkedin_url: string; email: string; whatsapp: string;
  instagram_url: string; github_url: string; x_url: string;
  display_order: number; session_year: string; is_active: boolean;
}

const PANELS = [
  { value: 'committee',         label: 'Executive Committee' },
  { value: 'moderators',        label: 'Chief Patron & Moderators' },
  { value: 'former_moderators', label: 'Former Moderators' },
  { value: 'founder',           label: 'Founder' },
]

const empty: Record<string, unknown> = {
  full_name: '', position: '', panel: 'committee', dept: '',
  photo_url: '', photo_position: '50% 15%',
  facebook_url: '', linkedin_url: '',
  email: '', whatsapp: '', instagram_url: '', github_url: '', x_url: '',
  display_order: 0, session_year: '2025-26', is_active: true,
}

/* ══════════════════════════════════
   IMAGE POSITION PICKER
══════════════════════════════════ */
function ImagePositionPicker({
  src, position, onChange,
}: {
  src: string
  position: string
  onChange: (pos: string) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)

  const parse = (p: string): [number, number] => {
    const parts = p.split(' ')
    return [parseFloat(parts[0]) || 50, parseFloat(parts[1]) || 15]
  }
  const [xp, yp] = parse(position)

  const updateFromEvent = useCallback((clientX: number, clientY: number) => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100))
    const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100))
    onChange(`${Math.round(x)}% ${Math.round(y)}%`)
  }, [onChange])

  const onMouseDown = (e: React.MouseEvent) => { setDragging(true); updateFromEvent(e.clientX, e.clientY) }
  const onMouseMove = (e: React.MouseEvent) => { if (dragging) updateFromEvent(e.clientX, e.clientY) }
  const onMouseUp = () => setDragging(false)

  const onTouchStart = (e: React.TouchEvent) => { setDragging(true); updateFromEvent(e.touches[0].clientX, e.touches[0].clientY) }
  const onTouchMove = (e: React.TouchEvent) => { if (dragging) updateFromEvent(e.touches[0].clientX, e.touches[0].clientY) }
  const onTouchEnd = () => setDragging(false)

  const presets = [
    { label: '👤 Face (Top)', val: '50% 10%' },
    { label: '⊙ Center',     val: '50% 50%' },
    { label: '⬇ Bottom',     val: '50% 80%' },
  ]

  return (
    <div>
      <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6, fontFamily: 'monospace' }}>
        Drag the crosshair to set which part of the photo shows in the card &amp; circle.
        Current: <strong style={{ color: 'var(--blue)' }}>{position}</strong>
      </p>

      {/* Preset buttons */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        {presets.map(p => (
          <button key={p.val} type="button" onClick={() => onChange(p.val)}
            style={{
              padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
              border: `1px solid ${position === p.val ? 'var(--blue)' : 'var(--border)'}`,
              background: position === p.val ? 'rgba(var(--blue-rgb), 0.15)' : 'transparent',
              color: position === p.val ? 'var(--blue)' : 'var(--muted)', cursor: 'pointer',
            }}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Drag area */}
      <div
        ref={containerRef}
        onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        style={{
          position: 'relative', width: '100%', maxWidth: 340,
          aspectRatio: '1 / 1.3',
          borderRadius: 12, overflow: 'hidden',
          border: '1px solid rgba(var(--blue-rgb), 0.3)',
          cursor: dragging ? 'grabbing' : 'crosshair',
          userSelect: 'none', touchAction: 'none',
        }}
      >
        <img src={src} alt="photo"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: position, userSelect: 'none', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', pointerEvents: 'none' }} />
        <div style={{
          position: 'absolute',
          left: `${xp}%`, top: `${yp}%`,
          transform: 'translate(-50%,-50%)',
          pointerEvents: 'none',
          zIndex: 10,
        }}>
          <div style={{ position: 'absolute', left: -40, right: -40, top: '50%', height: 1, background: 'var(--blue)', opacity: 0.85 }} />
          <div style={{ position: 'absolute', top: -40, bottom: -40, left: '50%', width: 1, background: 'var(--blue)', opacity: 0.85 }} />
          <div style={{
            width: 14, height: 14, borderRadius: '50%',
            background: 'var(--blue)', border: '2px solid #fff',
            boxShadow: '0 0 8px rgba(var(--blue-rgb), 0.8)',
            position: 'absolute', left: '50%', top: '50%',
            transform: 'translate(-50%,-50%)',
          }} />
        </div>
        <div style={{
          position: 'absolute', inset: 0,
          border: '2px dashed rgba(var(--blue-rgb), 0.4)',
          borderRadius: 12, pointerEvents: 'none',
        }} />
      </div>

      {/* Previews */}
      <div style={{ marginTop: 10, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div>
          <p style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>Card preview</p>
          <div style={{ width: 72, aspectRatio: '1/1.2', borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(var(--blue-rgb), 0.25)' }}>
            <img src={src} alt="Card preview" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: position }} />
          </div>
        </div>
        <div>
          <p style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>Circle preview</p>
          <div style={{ width: 72, height: 72, borderRadius: '50%', overflow: 'hidden', border: '1px solid rgba(var(--blue-rgb), 0.25)' }}>
            <img src={src} alt="Circle preview" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: position }} />
          </div>
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════
   MAIN ADMIN PAGE
══════════════════════════════════ */
export default function AdminExecutivesPage() {
  const [items,           setItems]           = useState<Executive[]>([])
  const [form,            setForm]            = useState<Record<string, unknown>>(empty)
  const [editing,         setEditing]         = useState<string | null>(null)
  const [loading,         setLoading]         = useState(false)
  const [uploading,       setUploading]       = useState(false)
  const [uploadProgress,  setUploadProgress]  = useState(0)
  const [uploadError,     setUploadError]     = useState('')
  const [msg,             setMsg]             = useState('')
  const [msgOk,           setMsgOk]           = useState(true)
  const [filterPanel,     setFilterPanel]     = useState('committee')
  const [filterYear,      setFilterYear]      = useState('2025-26')
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
    if (file.size > 4.5 * 1024 * 1024) {
      setUploadError(`File too large: ${(file.size / 1024 / 1024).toFixed(1)} MB. Max 4.5 MB.`)
      return
    }
    setUploadError(''); setUploading(true); setUploadProgress(0)
    const fd = new FormData()
    fd.append('file', file); fd.append('folder', 'executives')
    const xhr = new XMLHttpRequest()
    xhr.upload.addEventListener('progress', ev => {
      if (ev.lengthComputable) setUploadProgress(Math.round((ev.loaded / ev.total) * 100))
    })
    xhr.addEventListener('load', () => {
      try {
        const data = JSON.parse(xhr.responseText)
        if (data.url) {
          setForm(f => ({ ...f, photo_url: data.url, photo_position: '50% 15%' }))
        } else setUploadError(data.error || 'Upload failed')
      } catch { setUploadError('Upload failed') }
      setUploading(false); setUploadProgress(0)
    })
    xhr.addEventListener('error', () => { setUploadError('Network error. Try again.'); setUploading(false); setUploadProgress(0) })
    xhr.open('POST', '/api/admin/upload')
    xhr.send(fd)
  }

  const save = async () => {
    if (!form.full_name || !form.position) {
      setMsg('Name and position required'); setMsgOk(false); return
    }
    setLoading(true); setMsg('')
    const method = editing ? 'PUT' : 'POST'
    const body   = editing ? { ...form, id: editing } : form
    const res = await fetch('/api/admin/executives', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setLoading(false)
    if (res.ok) {
      setMsg('✅ Saved!'); setMsgOk(true); setEditing(null); setForm(empty); load()
    } else {
      const d = await res.json(); setMsg(d.error || 'Save failed'); setMsgOk(false)
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
      full_name: item.full_name || '', position: item.position || '',
      panel: item.panel || 'committee', dept: item.dept || '',
      photo_url: item.photo_url || '', photo_position: item.photo_position || '50% 15%',
      facebook_url: item.facebook_url || '', linkedin_url: item.linkedin_url || '',
      email: item.email || '', whatsapp: item.whatsapp || '',
      instagram_url: item.instagram_url || '', github_url: item.github_url || '',
      x_url: item.x_url || '', display_order: item.display_order || 0,
      session_year: item.session_year || '2025-26', is_active: item.is_active,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const years    = [...new Set(items.map(i => i.session_year))].sort((a, b) => b.localeCompare(a))
  const filtered = items.filter(i =>
    i.panel === filterPanel &&
    (filterPanel !== 'committee' || i.session_year === filterYear)
  )

  /* ── Shared styles ── */
  const s   = { background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--white-soft)', borderRadius: '8px' } as React.CSSProperties
  const lbl = 'block text-xs font-bold mb-1 uppercase tracking-wider'
  const inp = 'w-full px-3 py-2 text-sm outline-none'

  return (
    <div className="p-6" style={{ maxWidth: 1100, margin: '0 auto' }}>
      <h1 className="text-2xl font-bold mb-6" style={{ fontFamily: "'Orbitron',sans-serif", color: 'var(--blue)' }}>
        Executives Manager
      </h1>

      {/* ── Form ── */}
      <div className="rounded-xl p-6 mb-8" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
        <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--blue)' }}>
          {editing ? '✏️ Edit Executive' : '➕ Add Executive'}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={lbl} style={{ color: 'var(--muted)' }}>Full Name *</label>
            <input className={inp} style={s} value={String(form.full_name ?? '')}
              onChange={e => setForm({ ...form, full_name: e.target.value })} placeholder="Full name" />
          </div>

          <div>
            <label className={lbl} style={{ color: 'var(--muted)' }}>Position *</label>
            <input className={inp} style={s} value={String(form.position ?? '')}
              onChange={e => setForm({ ...form, position: e.target.value })} placeholder="e.g. President, General Secretary" />
          </div>

          <div>
            <label className={lbl} style={{ color: 'var(--muted)' }}>Panel *</label>
            <select aria-label="Panel" className={inp} style={s}
              value={String(form.panel ?? 'committee')}
              onChange={e => setForm({ ...form, panel: e.target.value })}>
              {PANELS.map(p => (
                <option key={p.value} value={p.value} style={{ background: 'var(--bg2)' }}>{p.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={lbl} style={{ color: 'var(--muted)' }}>Department (optional)</label>
            <input className={inp} style={s} value={String(form.dept ?? '')}
              onChange={e => setForm({ ...form, dept: e.target.value })} placeholder="e.g. Publication, R&D" />
          </div>

          <div>
            <label className={lbl} style={{ color: 'var(--muted)' }}>Session Year</label>
            <input className={inp} style={s} value={String(form.session_year ?? '')}
              onChange={e => setForm({ ...form, session_year: e.target.value })} placeholder="e.g. 2025-26" />
          </div>

          <div>
            <label className={lbl} style={{ color: 'var(--muted)' }}>Display Order</label>
            <input type="number" className={inp} style={s} value={Number(form.display_order ?? 0)}
              onChange={e => setForm({ ...form, display_order: parseInt(e.target.value) || 0 })} placeholder="0 = first" />
          </div>

          {/* ── Photo Upload + Position Picker ── */}
          <div className="md:col-span-2">
            <label className={lbl} style={{ color: 'var(--muted)' }}>Photo &amp; Position</label>
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
              {/* Upload button */}
              <div style={{ flex: '0 0 auto' }}>
                <button type="button"
                  onClick={() => { setUploadError(''); photoRef.current?.click() }}
                  disabled={uploading}
                  style={{
                    padding: '10px 20px', borderRadius: 10,
                    border: '2px dashed var(--border)', background: 'transparent',
                    color: uploading ? 'var(--blue)' : 'var(--muted)',
                    fontSize: 13, cursor: 'pointer', minWidth: 160,
                    display: 'block', marginBottom: 8,
                  }}>
                  {uploading ? `⏳ ${uploadProgress}%` : '📷 Upload Photo'}
                </button>
                {uploading && (
                  <div style={{ width: 160, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 4, marginBottom: 8, overflow: 'hidden' }}>
                    <div style={{ width: `${uploadProgress}%`, height: '100%', background: 'linear-gradient(90deg,var(--blue),#0099cc)', transition: 'width 0.2s' }} />
                  </div>
                )}
                {uploadError && <p style={{ color: 'var(--danger-soft)', fontSize: 11, marginBottom: 6 }}>⚠️ {uploadError}</p>}
                <p style={{ fontSize: 10, color: '#3a5a7a' }}>Max 4.5 MB · JPG/PNG/WEBP</p>
                <input ref={photoRef} type="file" accept="image/*" aria-label="Upload executive photo" style={{ display: 'none' }} onChange={uploadPhoto} />
              </div>

              {/* Drag-to-position picker */}
              {form.photo_url && (
                <div style={{ flex: 1, minWidth: 280 }}>
                  <ImagePositionPicker
                    src={String(form.photo_url)}
                    position={String(form.photo_position || '50% 15%')}
                    onChange={pos => setForm(f => ({ ...f, photo_position: pos }))}
                  />
                  <button type="button"
                    onClick={() => setForm(f => ({ ...f, photo_url: '', photo_position: '50% 15%' }))}
                    style={{ marginTop: 8, fontSize: 11, color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer' }}>
                    ✕ Remove photo
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Social Links */}
          {([
            ['Facebook URL',    'facebook_url',  'https://facebook.com/...'],
            ['LinkedIn URL',    'linkedin_url',  'https://linkedin.com/in/...'],
            ['Email',           'email',         'email@example.com'],
            ['WhatsApp Number', 'whatsapp',      '+8801...'],
            ['Instagram URL',   'instagram_url', 'https://instagram.com/...'],
            ['GitHub URL',      'github_url',    'https://github.com/...'],
            ['X (Twitter) URL', 'x_url',         'https://x.com/...'],
          ] as [string, string, string][]).map(([label, field, ph]) => (
            <div key={field}>
              <label className={lbl} style={{ color: 'var(--muted)' }}>{label}</label>
              <input className={inp} style={s} value={String(form[field] ?? '')}
                onChange={e => setForm({ ...form, [field]: e.target.value })} placeholder={ph} />
            </div>
          ))}

          <div className="flex items-center gap-2">
            <input type="checkbox" id="active" aria-label="Active status"
              checked={Boolean(form.is_active)}
              onChange={e => setForm({ ...form, is_active: e.target.checked })} />
            <label htmlFor="active" className="text-sm" style={{ color: 'var(--muted)' }}>
              Active (website এ দেখাবে)
            </label>
          </div>
        </div>

        {msg && <p className="mt-4 text-sm font-medium" style={{ color: msgOk ? 'var(--success)' : 'var(--danger-soft)' }}>{msg}</p>}

        <div className="flex gap-3 mt-5">
          <button onClick={save} disabled={loading}
            className="px-6 py-2.5 rounded-lg text-sm font-bold text-black"
            style={{ background: 'var(--blue)', opacity: loading ? 0.6 : 1 }}>
            {loading ? 'Saving...' : editing ? '✅ Update' : '➕ Add Executive'}
          </button>
          {editing && (
            <button onClick={() => { setEditing(null); setForm(empty) }}
              className="px-6 py-2.5 rounded-lg text-sm font-bold"
              style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--muted)' }}>
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* ── Filter ── */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <select aria-label="Filter by panel"
          value={filterPanel} onChange={e => setFilterPanel(e.target.value)}
          className={inp} style={{ ...s, maxWidth: 200 }}>
          {PANELS.map(p => (
            <option key={p.value} value={p.value} style={{ background: 'var(--bg2)' }}>{p.label}</option>
          ))}
        </select>
        {filterPanel === 'committee' && (
          <select aria-label="Filter by year"
            value={filterYear} onChange={e => setFilterYear(e.target.value)}
            className={inp} style={{ ...s, maxWidth: 160 }}>
            {years.map(y => (
              <option key={y} value={y} style={{ background: 'var(--bg2)' }}>{y}</option>
            ))}
          </select>
        )}
      </div>

      {/* ── Table ── */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
        <table className="w-full text-sm">
          <thead style={{ background: 'var(--bg2)' }}>
            <tr>
              {['Photo', 'Name', 'Position', 'Dept', 'Order', 'Active', ''].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider"
                  style={{ color: 'var(--blue)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm" style={{ color: '#3a5a7a' }}>
                  No executives found.
                </td>
              </tr>
            ) : filtered.map((item, i) => {
              const pos = item.photo_position || '50% 15%'
              return (
                <tr key={item.id} style={{ background: i % 2 === 0 ? 'var(--bg)' : '#030c16', borderTop: '1px solid var(--border)' }}>
                  <td className="px-4 py-3">
                    {item.photo_url ? (
                      <div style={{ width: 40, height: 48, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)' }}>
                        <img src={item.photo_url} alt={item.full_name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: pos }} />
                      </div>
                    ) : (
                      <div style={{ width: 40, height: 48, borderRadius: 6, background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>👤</div>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--white-soft)' }}>{item.full_name}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--blue)' }}>{item.position}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--muted)' }}>{item.dept || '—'}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--muted)' }}>{item.display_order}</td>
                  <td className="px-4 py-3">
                    <span style={{
                      padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                      background: item.is_active ? 'rgba(var(--success-rgb), 0.12)' : 'rgba(var(--danger-rgb), 0.1)',
                      color: item.is_active ? 'var(--success)' : 'var(--danger)',
                    }}>
                      {item.is_active ? 'Active' : 'Hidden'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => edit(item)}
                        className="px-3 py-1 rounded text-xs font-bold"
                        style={{ background: 'rgba(var(--blue-rgb), 0.12)', color: 'var(--blue)', border: '1px solid rgba(var(--blue-rgb), 0.2)' }}>
                        Edit
                      </button>
                      <button onClick={() => del(item.id)}
                        className="px-3 py-1 rounded text-xs font-bold"
                        style={{ background: 'rgba(var(--danger-rgb), 0.1)', color: 'var(--danger)', border: '1px solid rgba(var(--danger-rgb), 0.2)' }}>
                        Del
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}