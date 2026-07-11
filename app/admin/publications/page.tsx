'use client'
import { type ChangeEvent, useEffect, useRef, useState } from 'react'
import { Pencil, Plus, Upload, Loader2, X, FileText, CheckCircle2, BookOpen } from 'lucide-react'

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

type CategoryOption = {
  value: string
  label: string
}

type PublicationForm = {
  title: string
  description: string
  category: string
  published_year: number
  cover_image_url: string
  pdf_url: string
  is_published: boolean
}

const DEFAULT_CATEGORIES: CategoryOption[] = [
  { value: 'annual_magazine', label: 'Annual Magazine (AUDRI)' },
  { value: 'wall_magazine', label: 'Wall Magazine' },
  { value: 'trimatrik', label: 'Trimatrik (3D Magazine)' },
  { value: 'abhishkar', label: 'Abhishkar Focus' },
]

const createEmptyForm = (defaultCategory: string): PublicationForm => ({
  title: '',
  description: '',
  category: defaultCategory,
  published_year: new Date().getFullYear(),
  cover_image_url: '',
  pdf_url: '',
  is_published: true,
})

const slugifyCategory = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

const formatCategoryLabel = (value: string) => {
  const cleaned = value.replace(/_/g, ' ').replace(/\s+/g, ' ').trim()
  if (!cleaned) return 'Untitled Category'
  return cleaned.replace(/\b\w/g, (char) => char.toUpperCase())
}

const mergeCategories = (prev: CategoryOption[], incoming: CategoryOption[]) => {
  const map = new Map<string, CategoryOption>()
  prev.forEach((cat) => map.set(cat.value, cat))
  incoming.forEach((cat) => map.set(cat.value, { value: cat.value, label: cat.label }))
  return Array.from(map.values())
}

export default function AdminPublicationsPage() {
  const [items, setItems] = useState<Publication[]>([])
  const [categories, setCategories] = useState<CategoryOption[]>(DEFAULT_CATEGORIES)
  const [newCategory, setNewCategory] = useState('')
  const [form, setForm] = useState<PublicationForm>(createEmptyForm(DEFAULT_CATEGORIES[0].value))
  const [editing, setEditing] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState<number>(0)
  const [msg, setMsg] = useState('')
  const [msgOk, setMsgOk] = useState(true)
  const coverRef = useRef<HTMLInputElement>(null)
  const pdfRef = useRef<HTMLInputElement>(null)

  const persistCategories = (next: CategoryOption[]) => {
    setCategories(next)
  }

  const loadCategories = async () => {
    try {
      const res = await fetch('/api/admin/publications/categories')
      const data = await res.json()
      if (Array.isArray(data) && data.length) {
        persistCategories(data)
        return
      }
      persistCategories(DEFAULT_CATEGORIES)
    } catch {
      persistCategories(DEFAULT_CATEGORIES)
    }
  }

  const load = async () => {
    try {
      const res = await fetch('/api/admin/publications?admin=1')
      const data = await res.json()
      const nextItems = Array.isArray(data) ? data : []
      setItems(nextItems)

      const derivedCategories = nextItems
        .map((item: Publication) => item.category)
        .filter((value): value is string => Boolean(value))
        .map((value) => ({ value: value.trim(), label: formatCategoryLabel(value.trim()) }))

      if (derivedCategories.length > 0) {
        const merged = mergeCategories(categories, derivedCategories)
        persistCategories(merged)
        await fetch('/api/admin/publications/categories', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ categories: merged }),
        })
      }
    } catch {
      setMsg('Failed to reload publications')
      setMsgOk(false)
    }
  }

  useEffect(() => {
    loadCategories()
  }, [])

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    if (categories.length && !categories.some((cat) => cat.value === form.category)) {
      setForm((prev) => ({ ...prev, category: categories[0].value }))
    }
  }, [categories, form.category])

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
   
  
  const handleCover = async (e: ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0]
  if (!file) return
  setUploading('cover')
  setUploadProgress(0)
  const url = await uploadFile(file, 'activity-covers', (pct) => setUploadProgress(pct))
  if (url) setForm((f: any) => ({ ...f, cover_image_url: url }))
  setUploading(null)
  setUploadProgress(0)
}

const handlePdf = async (e: ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0]
  if (!file) return
  setUploading('pdf')
  setUploadProgress(0)
  const url = await uploadFile(file, 'activity-pdfs', (pct) => setUploadProgress(pct))
  if (url) setForm((f: any) => ({ ...f, pdf_url: url }))
  setUploading(null)
  setUploadProgress(0)
}
  
  const addCategory = () => {
    const raw = newCategory.trim()
    if (!raw) {
      setMsg('Category name required')
      setMsgOk(false)
      return
    }

    const value = slugifyCategory(raw)
    if (!value) {
      setMsg('Category name is invalid')
      setMsgOk(false)
      return
    }

    const exists = categories.some((cat) => cat.value === value)
    if (exists) {
      setForm((prev) => ({ ...prev, category: value }))
      setNewCategory('')
      setMsg('Category already exists')
      setMsgOk(true)
      return
    }

    const next = [...categories, { value, label: raw }]
    persistCategories(next)
    fetch('/api/admin/publications/categories', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categories: next }),
    }).catch(() => {})
    setForm((prev) => ({ ...prev, category: value }))
    setNewCategory('')
    setMsg(`Added category: ${raw}`)
    setMsgOk(true)
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
      setMsg('Saved successfully')
      setMsgOk(true)
      setForm(createEmptyForm(categories[0]?.value || DEFAULT_CATEGORIES[0].value))
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
      category: item.category || categories[0]?.value || DEFAULT_CATEGORIES[0].value,
      published_year: item.published_year || new Date().getFullYear(),
      cover_image_url: item.cover_image_url || '',
      pdf_url: item.pdf_url || '',
      is_published: item.is_published,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const inp = 'w-full rounded-lg px-3 py-2.5 text-sm outline-none'
  const s = { background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--white)' }
  const lbl = 'block text-xs mb-1.5 font-medium uppercase tracking-wider'

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6"
        style={{ fontFamily: "'Orbitron', sans-serif", color: 'var(--blue)' }}>
        Publications
      </h1>

      {/* Form */}
      <div className="rounded-xl border p-6 mb-8"
        style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}>
        <h2 className="font-bold mb-5 text-sm uppercase tracking-wider"
          style={{ color: 'var(--blue)' }}>
          <span className="inline-flex items-center gap-2">
            {editing ? <Pencil size={14} /> : <Plus size={14} />}
            {editing ? 'Edit Publication' : 'Add Publication'}
          </span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          <div className="md:col-span-2">
            <label className={lbl} style={{ color: 'var(--muted)' }}>Title *</label>
            <input className={inp} style={s}
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder="Publication title" />
          </div>

          <div>
            <label className={lbl} style={{ color: 'var(--muted)' }}>Category</label>
            <select className={inp} style={s}
              value={form.category}
              onChange={e => setForm({ ...form, category: e.target.value })}>
              {categories.map(c => (
                <option key={c.value} value={c.value} style={{ background: 'var(--bg2)' }}>
                  {c.label}
                </option>
              ))}
            </select>
            <div className="mt-2 flex gap-2">
              <input
                className={inp}
                style={{ ...s, paddingTop: '0.65rem', paddingBottom: '0.65rem' }}
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="New category name"
              />
              <button
                type="button"
                onClick={addCategory}
                className="px-3 py-2.5 rounded-lg text-xs font-bold whitespace-nowrap"
                style={{ background: 'rgba(var(--blue-rgb), 0.12)', color: 'var(--blue)' }}>
                Add
              </button>
            </div>
          </div>

          <div>
            <label className={lbl} style={{ color: 'var(--muted)' }}>Published Year</label>
            <input type="number" className={inp} style={s}
              value={form.published_year}
              onChange={e => setForm({ ...form, published_year: parseInt(e.target.value) })} />
          </div>

          <div className="md:col-span-2">
            <label className={lbl} style={{ color: 'var(--muted)' }}>Description</label>
            <textarea className={inp} style={{ ...s, height: '80px', resize: 'vertical' }}
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Short description..." />
          </div>

          {/* Cover Image */}
          <div>
            <label className={lbl} style={{ color: 'var(--muted)' }}>Cover Image</label>
            <button onClick={() => coverRef.current?.click()}
              className="w-full py-2.5 rounded-lg text-sm border-dashed border-2 mb-2"
              style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>
              <span className="inline-flex items-center gap-2">
                {uploading === 'cover' ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {uploading === 'cover' ? 'Uploading...' : 'Upload Cover'}
              </span>
            </button>
            {uploading === 'cover' && (
  <div className="mt-2">
    <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--muted)' }}>
      <span>Uploading...</span>
      <span>{uploadProgress}%</span>
    </div>
    <div className="w-full rounded-full overflow-hidden" style={{ height: 4, background: 'var(--border)' }}>
      <div className="h-full rounded-full transition-all duration-200"
        style={{ width: `${uploadProgress}%`, background: 'var(--blue)' }} />
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
                  style={{ background: 'rgba(var(--danger-rgb), 0.8)', color: 'white' }}><X size={12} /></button>
              </div>
            )}
          </div>

          {/* PDF Upload */}
          <div>
            <label className={lbl} style={{ color: 'var(--muted)' }}>PDF File</label>
            <button onClick={() => pdfRef.current?.click()}
              className="w-full py-2.5 rounded-lg text-sm border-dashed border-2 mb-2"
              style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>
              <span className="inline-flex items-center gap-2">
                {uploading === 'pdf' ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                {uploading === 'pdf' ? 'Uploading...' : 'Upload PDF'}
              </span>
            </button>
            {uploading === 'pdf' && (
  <div className="mt-2 mb-2">
    <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--muted)' }}>
      <span>Uploading PDF...</span>
      <span>{uploadProgress}%</span>
    </div>
    <div className="w-full rounded-full overflow-hidden" style={{ height: 4, background: 'var(--border)' }}>
      <div className="h-full rounded-full transition-all duration-200"
        style={{ width: `${uploadProgress}%`, background: 'var(--blue)' }} />
    </div>
  </div>
)}
            <input ref={pdfRef} type="file" accept=".pdf" className="hidden"
              onChange={handlePdf} />
            {form.pdf_url && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
                style={{ background: 'rgba(var(--blue-rgb), 0.05)', border: '1px solid var(--border)' }}>
                <FileText size={14} />
                <span className="text-xs flex-1 truncate" style={{ color: 'var(--blue)' }}>PDF uploaded</span>
                <CheckCircle2 size={14} style={{ color: 'var(--blue)' }} />
                <button onClick={() => setForm({ ...form, pdf_url: '' })}
                  className="text-xs" style={{ color: 'var(--danger)' }}>Remove</button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="pub" checked={form.is_published}
              onChange={e => setForm({ ...form, is_published: e.target.checked })} />
            <label htmlFor="pub" className="text-sm" style={{ color: 'var(--muted)' }}>
              Published (website এ দেখাবে)
            </label>
          </div>
        </div>

        {msg && (
          <p className="mt-4 text-sm font-medium"
            style={{ color: msgOk ? 'var(--success)' : 'var(--danger-soft)' }}>{msg}</p>
        )}

        <div className="flex gap-3 mt-5">
          <button onClick={save} disabled={loading}
            className="px-6 py-2.5 rounded-lg text-sm font-bold text-black"
            style={{ background: 'var(--blue)', opacity: loading ? 0.6 : 1 }}>
            <span className="inline-flex items-center gap-2">
              {!loading && (editing ? <CheckCircle2 size={14} /> : <Plus size={14} />)}
              {loading ? 'Saving...' : editing ? 'Update' : 'Add Publication'}
            </span>
          </button>
          {editing && (
            <button onClick={() => { setEditing(null); setForm(createEmptyForm(categories[0]?.value || DEFAULT_CATEGORIES[0].value)) }}
              className="px-6 py-2.5 rounded-lg text-sm font-bold"
              style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--muted)' }}>
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {items.map(item => (
          <div key={item.id} className="rounded-xl border overflow-hidden"
            style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}>
            <div className="relative" style={{ height: 200 }}>
              {item.cover_image_url ? (
                <img src={item.cover_image_url} alt={item.title}
                  className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center"
                  style={{ background: 'var(--surface-alt)' }}>
                  <BookOpen size={36} className="opacity-30" />
                </div>
              )}
              <div className="absolute top-2 left-2 px-2 py-1 rounded text-xs font-bold"
                style={{ background: 'rgba(var(--blue-rgb), 0.15)', color: 'var(--blue)', border: '1px solid rgba(var(--blue-rgb), 0.3)' }}>
                {item.category}
              </div>
              {item.pdf_url && (
                <div className="absolute top-2 right-2 px-2 py-1 rounded text-xs font-bold flex items-center gap-1"
                  style={{ background: 'rgba(var(--blue-rgb), 0.8)', color: '#000' }}>
                  PDF <CheckCircle2 size={12} />
                </div>
              )}
            </div>
            <div className="p-4">
              <h3 className="font-bold text-sm mb-1" style={{ color: 'var(--white)' }}>{item.title}</h3>
              <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>{item.published_year}</p>
              <div className="flex gap-2">
                <button onClick={() => edit(item)}
                  className="flex-1 py-1.5 rounded text-xs font-bold"
                  style={{ background: 'rgba(var(--blue-rgb), 0.1)', color: 'var(--blue)' }}>
                  Edit
                </button>
                <button onClick={() => del(item.id)}
                  className="flex-1 py-1.5 rounded text-xs font-bold"
                  style={{ background: 'rgba(var(--danger-rgb), 0.1)', color: 'var(--danger)' }}>
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div className="col-span-3 text-center py-12" style={{ color: 'var(--muted)' }}>
            No publications yet. Add one above!
          </div>
        )}
      </div>
    </div>
  )
}
