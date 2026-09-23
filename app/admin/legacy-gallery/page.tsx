'use client'

import { useEffect, useState } from 'react'
import { Plus, Trash2, Save, Upload, GripVertical } from 'lucide-react'
import { uploadFile } from '@/lib/uploadClient'
import FocalPointPicker from '@/components/admin/FocalPointPicker'

type Row = {
  id: string
  image_url: string | null
  year_label: string | null
  desktop_focal_x: number
  desktop_focal_y: number
  mobile_focal_x: number
  mobile_focal_y: number
  display_order: number
  is_active: boolean
}

const MAX_SLOTS = 10

const sectionCard: React.CSSProperties = {
  background: 'var(--card)',
  borderColor: 'var(--border)',
}

export default function LegacyGalleryAdminPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [uploadPct, setUploadPct] = useState<Record<string, number>>({})

  useEffect(() => {
    fetch('/api/admin/legacy-gallery')
      .then((r) => r.json())
      .then((d) => setRows(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false))
  }, [])

  const patch = (id: string, fields: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...fields } : r)))

  async function addSlot() {
    const res = await fetch('/api/admin/legacy-gallery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_order: rows.length, is_active: true }),
    })
    const row = await res.json()
    setRows((rs) => [...rs, row])
  }

  async function removeSlot(id: string) {
    if (!confirm('Remove this photo slot?')) return
    await fetch('/api/admin/legacy-gallery', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setRows((rs) => rs.filter((r) => r.id !== id))
  }

  async function save(row: Row) {
    setSavingId(row.id)
    const res = await fetch('/api/admin/legacy-gallery', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(row),
    })
    const updated = await res.json()
    patch(row.id, updated)
    setSavingId(null)
  }

  async function onUpload(row: Row, file: File) {
    const url = await uploadFile(file, 'legacy-gallery', (pct) =>
      setUploadPct((p) => ({ ...p, [row.id]: pct }))
    )
    setUploadPct((p) => ({ ...p, [row.id]: 0 }))
    if (url) patch(row.id, { image_url: url })
  }

  if (loading) return <div className="p-8" style={{ color: 'var(--muted)' }}>Loading…</div>

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--white)' }}>Legacy Gallery</h1>
        <button
          onClick={addSlot}
          disabled={rows.length >= MAX_SLOTS}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border disabled:opacity-40"
          style={{ borderColor: 'var(--blue)', color: 'var(--blue)' }}
        >
          <Plus size={15} /> Add Photo ({rows.length}/{MAX_SLOTS})
        </button>
      </div>
      <p className="text-sm mb-8" style={{ color: 'var(--muted)' }}>
        The vintage, black-and-white photo strip on the homepage — right after the club intro, before
        the founder profile. Old, low-quality scans are exactly the point; don&apos;t retouch them.
      </p>

      <div className="space-y-6">
        {rows.map((row) => (
          <div key={row.id} className="rounded-xl border p-5" style={sectionCard}>
            <div className="flex items-start gap-4">
              <GripVertical size={16} className="mt-2 shrink-0" style={{ color: 'var(--muted)' }} />
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-5">
                <FocalPointPicker
                  label="Desktop crop (landscape strip)"
                  imageUrl={row.image_url}
                  aspect="4/3"
                  x={row.desktop_focal_x}
                  y={row.desktop_focal_y}
                  onChange={(x, y) => patch(row.id, { desktop_focal_x: x, desktop_focal_y: y })}
                />
                <FocalPointPicker
                  label="Mobile crop"
                  imageUrl={row.image_url}
                  aspect="4/3"
                  x={row.mobile_focal_x}
                  y={row.mobile_focal_y}
                  onChange={(x, y) => patch(row.id, { mobile_focal_x: x, mobile_focal_y: y })}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 mt-4">
              <label
                className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm border cursor-pointer"
                style={{ borderColor: 'var(--border)', color: 'var(--white)' }}
              >
                <Upload size={14} />
                {uploadPct[row.id] ? `Uploading… ${uploadPct[row.id]}%` : 'Upload photo'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && onUpload(row, e.target.files[0])}
                />
              </label>

              <input
                value={row.year_label ?? ''}
                onChange={(e) => patch(row.id, { year_label: e.target.value })}
                placeholder="Year, e.g. 1962"
                className="px-3 py-2 rounded-lg text-sm border w-32"
                style={{ borderColor: 'var(--border)', background: 'transparent', color: 'var(--white)' }}
              />

              <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--muted)' }}>
                <input
                  type="checkbox"
                  checked={row.is_active}
                  onChange={(e) => patch(row.id, { is_active: e.target.checked })}
                />
                Visible
              </label>

              <div className="flex-1" />

              <button
                onClick={() => save(row)}
                disabled={savingId === row.id}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
                style={{ background: 'var(--blue)', color: '#001018' }}
              >
                <Save size={14} /> {savingId === row.id ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={() => removeSlot(row.id)}
                className="p-2 rounded-lg border"
                style={{ borderColor: 'var(--danger, #dc2626)', color: 'var(--danger, #dc2626)' }}
                title="Remove this slot"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}

        {rows.length === 0 && (
          <p className="text-sm text-center py-12" style={{ color: 'var(--muted)' }}>
            No photos yet — add up to {MAX_SLOTS}.
          </p>
        )}
      </div>
    </div>
  )
}
