'use client'
import { useEffect, useState } from 'react'

const FIELDS: { key: string; label: string; hint: string; options: { value: string; label: string }[] }[] = [
  {
    key: 'default_theme',
    label: 'Default Theme',
    hint: 'What first-time visitors see. Anyone who has already toggled dark/light on their own device keeps their own choice.',
    options: [
      { value: 'dark', label: 'Dark' },
      { value: 'light', label: 'Light' },
    ],
  },
  {
    key: 'font_family',
    label: 'Site Font',
    hint: 'Applied to body text and headings across the whole site.',
    options: [
      { value: "'Poppins', 'Plus Jakarta Sans', sans-serif", label: 'Poppins (default)' },
      { value: "'Plus Jakarta Sans', 'Poppins', sans-serif", label: 'Plus Jakarta Sans' },
      { value: "'Montserrat', 'Poppins', sans-serif", label: 'Montserrat' },
      { value: "'Inter', 'Poppins', sans-serif", label: 'Inter' },
      { value: "'Share Tech Mono', monospace", label: 'Share Tech Mono' },
    ],
  },
  {
    key: 'header_size',
    label: 'Header Size',
    hint: 'Controls the navbar height and logo size site-wide.',
    options: [
      { value: 'compact', label: 'Compact (56px)' },
      { value: 'default', label: 'Default (64px)' },
      { value: 'large', label: 'Large (76px)' },
    ],
  },
]

export default function AppearanceSettingsAdmin() {
  const [values, setValues] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/appearance-settings')
      .then(r => r.json())
      .then(d => setValues(d))
      .finally(() => setLoading(false))
  }, [])

  const save = async (key: string) => {
    const value = values[key] ?? FIELDS.find(f => f.key === key)?.options[0].value ?? ''
    const res = await fetch('/api/admin/appearance-settings', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value })
    })
    if (res.ok) { setSaved(s => ({ ...s, [key]: true })); setTimeout(() => setSaved(s => ({ ...s, [key]: false })), 2000) }
  }

  const inp = 'w-full rounded-lg px-3 py-2.5 text-sm outline-none'
  const s = { background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--white)' }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6" style={{ fontFamily: "'Orbitron',sans-serif", color: 'var(--blue)' }}>
        Appearance
      </h1>
      <div className="rounded-xl border p-6 space-y-6" style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}>
        {loading ? (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Loading…</p>
        ) : FIELDS.map(f => (
          <div key={f.key}>
            <label className="block text-xs mb-1.5 uppercase tracking-wider" style={{ color: 'var(--muted)' }}>{f.label}</label>
            <p className="text-xs mb-2" style={{ color: 'var(--muted)', opacity: 0.75 }}>{f.hint}</p>
            <div className="flex gap-3">
              <select className={inp} style={s} value={values[f.key] || f.options[0].value}
                onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}>
                {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <button onClick={() => save(f.key)}
                className="px-4 py-2 rounded-lg text-sm font-bold shrink-0"
                style={{ background: saved[f.key] ? 'var(--success)' : 'var(--blue)', color: '#000' }}>
                {saved[f.key] ? 'Saved!' : 'Save'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
