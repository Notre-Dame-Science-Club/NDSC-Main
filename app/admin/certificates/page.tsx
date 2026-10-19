'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Award, Check, Copy, Plus } from 'lucide-react'

type CertificateRow = {
  id: string
  title: string
  slug: string
  is_active: boolean
  recipient_count: number
  template_pdf_url: string | null
  created_at: string
}

const s = { background: 'var(--bg2)', borderColor: 'var(--border)' }
const h = { fontFamily: 'inherit', color: 'var(--blue)' }

const slugify = (value: string) =>
  value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

export default function AdminCertificatesPage() {
  const [items, setItems] = useState<CertificateRow[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [error, setError] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/certificates')
      const data = await res.json()
      setItems(Array.isArray(data) ? data : [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleTitleChange = (value: string) => {
    setTitle(value)
    if (!slugTouched) setSlug(slugify(value))
  }

  const handleCreate = async () => {
    if (!title.trim() || !slug.trim()) return
    setCreating(true)
    setError('')
    try {
      const res = await fetch('/api/certificates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), slug: slug.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to create batch.')
        return
      }
      setTitle('')
      setSlug('')
      setSlugTouched(false)
      await load()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setCreating(false)
    }
  }

  const copyLink = (row: CertificateRow) => {
    const url = `${window.location.origin}/certificate/${row.slug}`
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(row.id)
      setTimeout(() => setCopiedId((c) => (c === row.id ? null : c)), 1500)
    })
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Award size={22} style={{ color: 'var(--blue)' }} />
        <div>
          <h1 className="text-2xl font-bold" style={h}>Certificates</h1>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Self-service certificate batches — a template plus a recipient list, each with its own public URL.
          </p>
        </div>
      </div>

      {/* New batch */}
      <div className="mb-6 p-4 rounded-xl border" style={s}>
        <label className="block text-sm font-bold mb-3" style={{ color: 'var(--white)' }}>New Certificate Batch</label>
        <div className="grid sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Title</label>
            <input
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="ICT Olympiad 2026 — Certificate of Participation"
              className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--white)' }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Slug (public URL)</label>
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: 'var(--muted)' }}>/certificate/</span>
              <input
                value={slug}
                onChange={(e) => { setSlug(slugify(e.target.value)); setSlugTouched(true) }}
                placeholder="ict-2026"
                className="flex-1 px-3 py-2 rounded-lg text-sm border outline-none font-mono"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--white)' }}
              />
            </div>
          </div>
        </div>
        {error && <p className="text-xs mb-3" style={{ color: 'var(--danger)' }}>{error}</p>}
        <button
          onClick={handleCreate}
          disabled={creating || !title.trim() || !slug.trim()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: 'var(--blue)', color: '#000' }}
        >
          <Plus size={14} /> {creating ? 'Creating…' : 'Create Batch'}
        </button>
      </div>

      {/* List */}
      <div className="rounded-xl border overflow-hidden" style={s}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(var(--blue-rgb), 0.05)' }}>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--muted)' }}>Title</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--muted)' }}>Public Link</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--muted)' }}>Recipients</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--muted)' }}>Status</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--muted)' }}></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-sm" style={{ color: 'var(--muted)' }}>Loading…</td></tr>
              )}
              {!loading && items.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-sm" style={{ color: 'var(--muted)' }}>No certificate batches yet.</td></tr>
              )}
              {items.map((row) => (
                <tr key={row.id} style={{ borderBottom: '1px solid var(--surface-alt)' }}>
                  <td className="px-4 py-3">
                    <Link href={`/admin/certificates/${row.id}`} className="font-medium hover:underline" style={{ color: 'var(--white)' }}>
                      {row.title}
                    </Link>
                    {!row.template_pdf_url && (
                      <div className="text-xs mt-0.5" style={{ color: 'var(--danger-soft)' }}>No template uploaded yet</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => copyLink(row)}
                      className="flex items-center gap-1.5 text-xs font-mono hover:underline"
                      style={{ color: 'var(--blue)' }}
                    >
                      /certificate/{row.slug}
                      {copiedId === row.id ? <Check size={12} /> : <Copy size={12} />}
                    </button>
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--muted)' }}>{row.recipient_count}</td>
                  <td className="px-4 py-3">
                    {row.is_active ? (
                      <span className="text-xs font-bold" style={{ color: 'var(--success)' }}>Active</span>
                    ) : (
                      <span className="text-xs font-bold" style={{ color: 'var(--muted)' }}>Inactive</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/certificates/${row.id}`}
                      className="px-3 py-1.5 rounded text-xs font-bold"
                      style={{ background: 'rgba(var(--blue-rgb), 0.1)', color: 'var(--blue)', border: '1px solid rgba(var(--blue-rgb), 0.3)' }}
                    >
                      Manage
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
