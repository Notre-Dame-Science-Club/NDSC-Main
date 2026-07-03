'use client'
import { useState } from 'react'

export default function PdfViewer({ url }: { url: string }) {
  const [mode, setMode] = useState<'gdocs' | 'direct' | 'failed'>('gdocs')
  const gdocsUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`

  if (mode === 'failed') {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16"
        style={{ background: 'var(--surface)' }}>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          Inline viewer কাজ করছে না।
        </p>
        <a href={url} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 px-6 py-3 rounded font-bold text-sm"
          style={{ background: 'var(--blue)', color: '#000', fontFamily: "'Orbitron',sans-serif" }}>
          নতুন Tab এ খুলুন ↗
        </a>
        <a href={url} download
          className="flex items-center gap-2 px-6 py-3 rounded font-bold text-sm border"
          style={{ borderColor: 'var(--blue)', color: 'var(--blue)', fontFamily: "'Orbitron',sans-serif" }}>
          ↓ Download PDF
        </a>
      </div>
    )
  }

  return (
    <div style={{ height: '80vh', position: 'relative', background: 'var(--surface)' }}>
      <iframe
        key={mode}
        src={mode === 'gdocs' ? gdocsUrl : url}
        width="100%"
        height="100%"
        style={{ border: 'none', display: 'block' }}
        title="PDF Viewer"
        onError={() => {
          if (mode === 'gdocs') setMode('direct')
          else setMode('failed')
        }}
      />
      <div className="absolute bottom-3 right-3 flex gap-2" style={{ zIndex: 10 }}>
        <a href={url} target="_blank" rel="noopener noreferrer"
          className="px-3 py-1.5 rounded text-xs font-bold"
          style={{
            background: 'rgba(var(--blue-rgb), 0.15)', color: 'var(--blue)',
            border: '1px solid rgba(var(--blue-rgb), 0.3)', backdropFilter: 'blur(4px)'
          }}>
          ↗ নতুন Tab এ খুলুন
        </a>
        {mode === 'gdocs' && (
          <button onClick={() => setMode('direct')}
            className="px-3 py-1.5 rounded text-xs font-bold"
            style={{
              background: 'rgba(255,255,255,0.08)', color: 'var(--muted)',
              border: '1px solid var(--border)', backdropFilter: 'blur(4px)'
            }}>
            Direct Try
          </button>
        )}
      </div>
    </div>
  )
}
