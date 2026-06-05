'use client'
import { useEffect, useRef, useState } from 'react'

type Publication = {
  id: string
  title: string
  description: string
  category: string
  published_year: number
  cover_image_url: string
  pdf_url: string
  is_published: boolean
}

const CATEGORIES = [
  { value: 'annual_magazine', label: 'Annual Magazine (AUDRI)' },
  { value: 'wall_magazine',   label: 'Wall Magazine' },
  { value: 'trimatrik',       label: 'Trimatrik (3D Magazine)' },
  { value: 'abhishkar',       label: 'Abhishkar Focus' },
]

const empty = {
  title: '',
  description: '',
  category: 'annual_magazine',  // ← first valid category
  published_year: new Date().getFullYear(),
  cover_image_url: '',
  pdf_url: '',
  is_published: true,
}

export default function AdminPublicationsPage() {
  const [items, setItems] = useState<Publication[]>([])
  const [form, setForm] = useState<any>(empty)
  const [editing, setEditing] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState<number>(0)
  const [msg, setMsg] = useState('')
  const [msgOk, setMsgOk] = useState(true)
  const coverRef = useRef<HTMLInputElement>(null)
  const pdfRef = useRef<HTMLInputElement>(null)

  const load = async () => {
  const res = await fetch('/api/admin/publications?admin=1')  // ?admin=1 add করো
  const data = await res.json()
  setItems(Array.isArray(data) ? data : [])
}

  useEffect(() => { load() }, [])

  const uploadFile = (file: File, bucket: string, onProgress?: (pct: number) => void): Promise<string | null> => {
  return new Promise(async (resolve) => {
    // Step 1: token নাও
    let uploadUrl: string
    let secret: string
    try {
      const res = await fetch('/api/admin/upload-token')
      const data = await res.json()
      if (!data.uploadUrl || !data.secret) { resolve(null); return }
      uploadUrl = data.uploadUrl
      secret = data.secret
    } catch { resolve(null); return }

    // Step 2: সরাসরি Hostinger এ পাঠাও — Vercel bypass
    const BUCKET_TO_FOLDER: Record<string, string> = {
      'activity-covers': 'covers',
      'activity-gallery': 'gallery',
      'activity-pdfs': 'pdfs',
      'executive-photos': 'executives',
      'covers': 'covers',
      'gallery': 'gallery',
      'pdfs': 'pdfs',
      'executives': 'executives',
      'misc': 'misc',
    }
    const folder = BUCKET_TO_FOLDER[bucket] ?? 'misc'

    const fd = new FormData()
    fd.append('file', file)
    fd.append('folder', folder)

    const xhr = new XMLHttpRequest()

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    })

    xhr.addEventListener('load', () => {
      try {
        const data = JSON.parse(xhr.responseText)
        resolve(data.url || null)
      } catch { resolve(null) }
    })

    xhr.addEventListener('error', () => resolve(null))
    xhr.open('POST', uploadUrl)
    xhr.setRequestHeader('X-Upload-Secret', secret)
    xhr.send(fd)
  })
}
   
  
  const handleCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0]
  if (!file) return
  setUploading('cover')
  setUploadProgress(0)
  const url = await uploadFile(file, 'activity-covers', (pct) => setUploadProgress(pct))
  if (url) setForm((f: any) => ({ ...f, cover_image_url: url }))
  setUploading(null)
  setUploadProgress(0)
}

const handlePdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0]
  if (!file) return
  setUploading('pdf')
  setUploadProgress(0)
  const url = await uploadFile(file, 'activity-pdfs', (pct) => setUploadProgress(pct))
  if (url) setForm((f: any) => ({ ...f, pdf_url: url }))
  setUploading(null)
  setUploadProgress(0)
}
  
  const save = async () => {
    if (!form.title) return (setMsg('Title required'), setMsgOk(false))
    setLoading(true)
    setMsg('')
    const method = editing ? 'PUT' : 'POST'
    const body = editing ? { ...form, id: editing } : form
    const res = await fetch('/api/admin/publications', {
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
    if (!confirm('Delete?')) return
    await fetch('/api/admin/publications', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    load()
  }

  const edit = (item: Publication) => {
    setEditing(item.id)
    setForm({
      title: item.title || '',
      description: item.description || '',
      category: item.category || 'journal',
      published_year: item.published_year || new Date().getFullYear(),
      cover_image_url: item.cover_image_url || '',
      pdf_url: item.pdf_url || '',
      is_published: item.is_published,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const inp = 'w-full rounded-lg px-3 py-2.5 text-sm outline-none'
  const s = { background: 'rgba(255,255,255,0.04)', border: '1px solid #0f2a4a', color: '#e8f4ff' }
  const lbl = 'block text-xs mb-1.5 font-medium uppercase tracking-wider'

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6"
        style={{ fontFamily: "'Orbitron', sans-serif", color: '#00d4ff' }}>
        Publications
      </h1>

      {/* Form */}
      <div className="rounded-xl border p-6 mb-8"
        style={{ background: '#050d1a', borderColor: '#0f2a4a' }}>
        <h2 className="font-bold mb-5 text-sm uppercase tracking-wider"
          style={{ color: '#00d4ff' }}>
          {editing ? '✏️ Edit Publication' : '➕ Add Publication'}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          <div className="md:col-span-2">
            <label className={lbl} style={{ color: '#6a8faf' }}>Title *</label>
            <input className={inp} style={s}
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder="Publication title" />
          </div>

          <div>
            <label className={lbl} style={{ color: '#6a8faf' }}>Category</label>
            <select className={inp} style={s}
              value={form.category}
              onChange={e => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map(c => (
                <option key={c.value} value={c.value} style={{ background: '#050d1a' }}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={lbl} style={{ color: '#6a8faf' }}>Published Year</label>
            <input type="number" className={inp} style={s}
              value={form.published_year}
              onChange={e => setForm({ ...form, published_year: parseInt(e.target.value) })} />
          </div>

          <div className="md:col-span-2">
            <label className={lbl} style={{ color: '#6a8faf' }}>Description</label>
            <textarea className={inp} style={{ ...s, height: '80px', resize: 'vertical' }}
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Short description..." />
          </div>

          {/* Cover Image */}
          <div>
            <label className={lbl} style={{ color: '#6a8faf' }}>Cover Image</label>
            <button onClick={() => coverRef.current?.click()}
              className="w-full py-2.5 rounded-lg text-sm border-dashed border-2 mb-2"
              style={{ borderColor: '#0f2a4a', color: '#6a8faf' }}>
              {uploading === 'cover' ? '⏳ Uploading...' : '📷 Upload Cover'}
            </button>
            {uploading === 'cover' && (
  <div className="mt-2">
    <div className="flex justify-between text-xs mb-1" style={{ color: '#6a8faf' }}>
      <span>Uploading...</span>
      <span>{uploadProgress}%</span>
    </div>
    <div className="w-full rounded-full overflow-hidden" style={{ height: 4, background: '#0f2a4a' }}>
      <div className="h-full rounded-full transition-all duration-200"
        style={{ width: `${uploadProgress}%`, background: '#00d4ff' }} />
    </div>
  </div>
)}
            <input ref={coverRef} type="file" accept="image/*" className="hidden"
              onChange={handleCover} />
            {form.cover_image_url && (
              <div className="relative w-32">
                <img src={form.cover_image_url} alt="cover"
                  className="w-32 h-44 object-cover rounded-lg" />
                <button onClick={() => setForm({ ...form, cover_image_url: '' })}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full text-xs flex items-center justify-center"
                  style={{ background: 'rgba(255,80,80,0.8)', color: 'white' }}>✕</button>
              </div>
            )}
          </div>

          {/* PDF Upload */}
          <div>
            <label className={lbl} style={{ color: '#6a8faf' }}>PDF File</label>
            <button onClick={() => pdfRef.current?.click()}
              className="w-full py-2.5 rounded-lg text-sm border-dashed border-2 mb-2"
              style={{ borderColor: '#0f2a4a', color: '#6a8faf' }}>
              {uploading === 'pdf' ? '⏳ Uploading...' : '📄 Upload PDF'}
            </button>
            {uploading === 'pdf' && (
  <div className="mt-2 mb-2">
    <div className="flex justify-between text-xs mb-1" style={{ color: '#6a8faf' }}>
      <span>Uploading PDF...</span>
      <span>{uploadProgress}%</span>
    </div>
    <div className="w-full rounded-full overflow-hidden" style={{ height: 4, background: '#0f2a4a' }}>
      <div className="h-full rounded-full transition-all duration-200"
        style={{ width: `${uploadProgress}%`, background: '#00d4ff' }} />
    </div>
  </div>
)}
            <input ref={pdfRef} type="file" accept=".pdf" className="hidden"
              onChange={handlePdf} />
            {form.pdf_url && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
                style={{ background: 'rgba(0,212,255,0.05)', border: '1px solid #0f2a4a' }}>
                <span>📄</span>
                <span className="text-xs flex-1 truncate" style={{ color: '#00d4ff' }}>PDF uploaded ✓</span>
                <button onClick={() => setForm({ ...form, pdf_url: '' })}
                  className="text-xs" style={{ color: '#ff5050' }}>Remove</button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="pub" checked={form.is_published}
              onChange={e => setForm({ ...form, is_published: e.target.checked })} />
            <label htmlFor="pub" className="text-sm" style={{ color: '#6a8faf' }}>
              Published (website এ দেখাবে)
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
            {loading ? 'Saving...' : editing ? '✅ Update' : '➕ Add Publication'}
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

      {/* List */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {items.map(item => (
          <div key={item.id} className="rounded-xl border overflow-hidden"
            style={{ background: '#050d1a', borderColor: '#0f2a4a' }}>
            <div className="relative" style={{ height: 200 }}>
              {item.cover_image_url ? (
                <img src={item.cover_image_url} alt={item.title}
                  className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center"
                  style={{ background: '#0a1f35' }}>
                  <span className="text-4xl opacity-30">📚</span>
                </div>
              )}
              <div className="absolute top-2 left-2 px-2 py-1 rounded text-xs font-bold"
                style={{ background: 'rgba(0,212,255,0.15)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.3)' }}>
                {item.category}
              </div>
              {item.pdf_url && (
                <div className="absolute top-2 right-2 px-2 py-1 rounded text-xs font-bold"
                  style={{ background: 'rgba(0,212,255,0.8)', color: '#000' }}>
                  PDF ✓
                </div>
              )}
            </div>
            <div className="p-4">
              <h3 className="font-bold text-sm mb-1" style={{ color: '#e8f4ff' }}>{item.title}</h3>
              <p className="text-xs mb-3" style={{ color: '#6a8faf' }}>{item.published_year}</p>
              <div className="flex gap-2">
                <button onClick={() => edit(item)}
                  className="flex-1 py-1.5 rounded text-xs font-bold"
                  style={{ background: 'rgba(0,212,255,0.1)', color: '#00d4ff' }}>
                  Edit
                </button>
                <button onClick={() => del(item.id)}
                  className="flex-1 py-1.5 rounded text-xs font-bold"
                  style={{ background: 'rgba(255,80,80,0.1)', color: '#ff5050' }}>
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div className="col-span-3 text-center py-12" style={{ color: '#6a8faf' }}>
            No publications yet. Add one above!
          </div>
        )}
      </div>
    </div>
  )
}
