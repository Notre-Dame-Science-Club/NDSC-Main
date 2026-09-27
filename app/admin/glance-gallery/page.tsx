'use client'

import { useEffect, useState } from 'react'
import { Save, Upload } from 'lucide-react'
import { uploadFile } from '@/lib/uploadClient'
import FocalPointPicker from '@/components/admin/FocalPointPicker'
import { GLANCE_ITEMS } from '@/app/_components/home2/glanceGalleryContent'

type Row = {
  slot_key: string
  image_url: string | null
  desktop_focal_x: number
  desktop_focal_y: number
  mobile_focal_x: number
  mobile_focal_y: number
  learn_more_url: string | null
  is_active: boolean
}

const sectionCard: React.CSSProperties = { background: 'var(--card)', borderColor: 'var(--border)' }

export default function GlanceGalleryAdminPage() {
  const [rows, setRows] = useState<Record<string, Row>>({})
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [uploadPct, setUploadPct] = useState<Record<string, number>>({})

  useEffect(() => {
    fetch('/api/admin/glance-gallery')
      .then((r) => r.json())
      .then((d: Row[]) => {
        const map: Record<string, Row> = {}
        ;(Array.isArray(d) ? d : []).forEach((r) => (map[r.slot_key] = r))
        setRows(map)
      })
      .finally(() => setLoading(false))
  }, [])

  const patch = (slotKey: string, fields: Partial<Row>) =>
    setRows((rs) => ({ ...rs, [slotKey]: { ...rs[slotKey], ...fields } }))

  async function save(slotKey: string) {
    const row = rows[slotKey]
    setSavingKey(slotKey)
    const res = await fetch('/api/admin/glance-gallery', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(row),
    })
    const updated = await res.json()
    patch(slotKey, updated)
    setSavingKey(null)
  }

  async function onUpload(slotKey: string, file: File) {
    const url = await uploadFile(file, 'glance-gallery', (pct) =>
      setUploadPct((p) => ({ ...p, [slotKey]: pct }))
    )
    setUploadPct((p) => ({ ...p, [slotKey]: 0 }))
    if (url) patch(slotKey, { image_url: url })
  }

  if (loading) return <div className="p-8" style={{ color: 'var(--muted)' }}>Loading…</div>

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">
      <h1 className="text-xl font-semibold mb-2" style={{ color: 'var(--white)' }}>What We Do at a Glance</h1>
      <p className="text-sm mb-8" style={{ color: 'var(--muted)' }}>
        The 14 tiles sit right after Departments, before the live Activities feed. Titles and
        descriptions are fixed — this page only sets each tile&apos;s photo and its &quot;Learn
        More&quot; link.
      </p>

      <div className="space-y-6">
        {GLANCE_ITEMS.map((item, i) => {
          const row = rows[item.slotKey] ?? {
            slot_key: item.slotKey,
            image_url: null,
            desktop_focal_x: 50,
            desktop_focal_y: 50,
            mobile_focal_x: 50,
            mobile_focal_y: 50,
            learn_more_url: '',
            is_active: true,
          }
          return (
            <div key={item.slotKey} className="rounded-xl border p-5" style={sectionCard}>
              <div className="flex items-baseline gap-3 mb-4">
                <span className="text-xs font-mono" style={{ color: 'var(--muted)' }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div>
                  <b style={{ color: 'var(--white)' }}>{item.title}</b>
                  <span className="ml-2 text-xs uppercase tracking-wider" style={{ color: 'var(--blue)' }}>
                    {item.small} · {item.big ? 'BIG TILE (desktop)' : 'MEDIUM TILE (desktop)'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-4">
                <FocalPointPicker
                  label="Desktop crop"
                  imageUrl={row.image_url}
                  aspect={item.big ? '21/9' : '4/3'}
                  x={row.desktop_focal_x}
                  y={row.desktop_focal_y}
                  onChange={(x, y) => patch(item.slotKey, { desktop_focal_x: x, desktop_focal_y: y })}
                />
                <FocalPointPicker
                  label="Mobile crop"
                  imageUrl={row.image_url}
                  aspect="6/4"
                  x={row.mobile_focal_x}
                  y={row.mobile_focal_y}
                  onChange={(x, y) => patch(item.slotKey, { mobile_focal_x: x, mobile_focal_y: y })}
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <label
                  className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm border cursor-pointer"
                  style={{ borderColor: 'var(--border)', color: 'var(--white)' }}
                >
                  <Upload size={14} />
                  {uploadPct[item.slotKey] ? `Uploading… ${uploadPct[item.slotKey]}%` : 'Upload photo'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && onUpload(item.slotKey, e.target.files[0])}
                  />
                </label>

                <input
                  value={row.learn_more_url ?? ''}
                  onChange={(e) => patch(item.slotKey, { learn_more_url: e.target.value })}
                  placeholder="Learn More link (https://…)"
                  className="flex-1 min-w-[220px] px-3 py-2 rounded-lg text-sm border"
                  style={{ borderColor: 'var(--border)', background: 'transparent', color: 'var(--white)' }}
                />

                <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--muted)' }}>
                  <input
                    type="checkbox"
                    checked={row.is_active}
                    onChange={(e) => patch(item.slotKey, { is_active: e.target.checked })}
                  />
                  Visible
                </label>

                <button
                  onClick={() => save(item.slotKey)}
                  disabled={savingKey === item.slotKey}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
                  style={{ background: 'var(--blue)', color: '#001018' }}
                >
                  <Save size={14} /> {savingKey === item.slotKey ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
