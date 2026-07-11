'use client'
import { useEffect, useState } from 'react'

type Video = { id: string; title: string; youtube_url: string; display_order: number; is_active: boolean }
const empty = { title: '', youtube_url: '', display_order: 0, is_active: true }

export default function ScienceMediaAdmin() {
  const [items, setItems] = useState<Video[]>([])
  const [form, setForm] = useState<any>(empty)
  const [editing, setEditing] = useState<string | null>(null)
  const [msg, setMsg] = useState('')

  const load = () => fetch('/api/admin/science-media').then(r => r.json()).then(d => setItems(Array.isArray(d) ? d : []))
  useEffect(() => { load() }, [])

  const save = async () => {
    const method = editing ? 'PUT' : 'POST'
    const body = editing ? { ...form, id: editing } : form
    const res = await fetch('/api/admin/science-media', {
      method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    })
    if (res.ok) { setMsg('Saved!'); setForm(empty); setEditing(null); load() }
    else { const d = await res.json(); setMsg(d.error) }
  }

  const del = async (id: string) => {
    if (!confirm('Delete?')) return
    await fetch('/api/admin/science-media', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    load()
  }

  const inp = 'w-full rounded-lg px-3 py-2.5 text-sm outline-none'
  const s = { background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--white)' }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6" style={{ fontFamily: "'Orbitron',sans-serif", color: 'var(--blue)' }}>
        Science Media
      </h1>

      <div className="rounded-xl border p-6 mb-8" style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}>
        <h2 className="font-bold mb-4 text-sm uppercase tracking-wider" style={{ color: 'var(--blue)' }}>
          {editing ? 'Edit Video' : 'Add Video'}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs mb-1.5 uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Title</label>
            <input className={inp} style={s} value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Video title" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs mb-1.5 uppercase tracking-wider" style={{ color: 'var(--muted)' }}>YouTube URL</label>
            <input className={inp} style={s} value={form.youtube_url}
              onChange={e => setForm({ ...form, youtube_url: e.target.value })} placeholder="https://youtube.com/watch?v=..." />
          </div>
          <div>
            <label className="block text-xs mb-1.5 uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Display Order</label>
            <input type="number" className={inp} style={s} value={form.display_order}
              onChange={e => setForm({ ...form, display_order: parseInt(e.target.value) })} />
          </div>
          <div className="flex items-center gap-2 mt-5">
            <input type="checkbox" checked={form.is_active}
              onChange={e => setForm({ ...form, is_active: e.target.checked })} />
            <label className="text-sm" style={{ color: 'var(--muted)' }}>Active (homepage এ দেখাবে)</label>
          </div>
        </div>
        {msg && <p className="mt-3 text-sm" style={{ color: 'var(--success)' }}>{msg}</p>}
        <div className="flex gap-3 mt-4">
          <button onClick={save} className="px-6 py-2.5 rounded-lg text-sm font-bold text-black" style={{ background: 'var(--blue)' }}>
            {editing ? 'Update' : 'Add Video'}
          </button>
          {editing && (
            <button onClick={() => { setEditing(null); setForm(empty) }}
              className="px-6 py-2.5 rounded-lg text-sm font-bold" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--muted)' }}>
              Cancel
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {items.map(item => (
          <div key={item.id} className="flex items-center justify-between p-4 rounded-xl border"
            style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}>
            <div>
              <p className="font-bold text-sm" style={{ color: 'var(--white)' }}>{item.title}</p>
              <p className="text-xs mt-1 truncate max-w-xs" style={{ color: 'var(--muted)' }}>{item.youtube_url}</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => { setEditing(item.id); setForm({ title: item.title, youtube_url: item.youtube_url, display_order: item.display_order, is_active: item.is_active }) }}
                className="px-3 py-1.5 rounded text-xs font-bold" style={{ background: 'rgba(var(--blue-rgb), 0.1)', color: 'var(--blue)' }}>Edit</button>
              <button onClick={() => del(item.id)}
                className="px-3 py-1.5 rounded text-xs font-bold" style={{ background: 'rgba(var(--danger-rgb), 0.1)', color: 'var(--danger)' }}>Delete</button>
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="text-center py-8 text-sm" style={{ color: 'var(--muted)' }}>No videos yet.</p>}
      </div>
    </div>
  )
}