'use client'
import { useEffect, useState } from 'react'

const FIELDS = [
  { key: 'last_event_label', label: 'Last Event Text', placeholder: 'Workshop on AI — 3 days ago' },
  { key: 'last_event_url', label: 'Last Event URL', placeholder: '/activities/slug' },
  { key: 'next_event_label', label: 'Next Event Text', placeholder: 'Science Sunday — This Friday' },
  { key: 'next_event_url', label: 'Next Event URL', placeholder: '/activities/slug' },
  { key: 'science_media_title', label: 'Science Media Section Title', placeholder: 'Check Out Our Science Media' },
  { key: 'messenger_group_link', label: 'Member Messenger Group Link', placeholder: 'https://m.me/j/AbC123...' },
]

export default function HomepageSettingsAdmin() {
  const [values, setValues] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState<Record<string, boolean>>({})

  useEffect(() => {
    fetch('/api/admin/homepage-settings').then(r => r.json()).then(d => setValues(d))
  }, [])

  const save = async (key: string) => {
    const res = await fetch('/api/admin/homepage-settings', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value: values[key] || '' })
    })
    if (res.ok) { setSaved(s => ({ ...s, [key]: true })); setTimeout(() => setSaved(s => ({ ...s, [key]: false })), 2000) }
  }

  const inp = 'w-full rounded-lg px-3 py-2.5 text-sm outline-none'
  const s = { background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--white)' }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6" style={{ fontFamily: "'Orbitron',sans-serif", color: 'var(--blue)' }}>
        Homepage Settings
      </h1>
      <div className="rounded-xl border p-6 space-y-6" style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}>
        {FIELDS.map(f => (
          <div key={f.key}>
            <label className="block text-xs mb-1.5 uppercase tracking-wider" style={{ color: 'var(--muted)' }}>{f.label}</label>
            <div className="flex gap-3">
              <input className={inp} style={s} value={values[f.key] || ''} placeholder={f.placeholder}
                onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))} />
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