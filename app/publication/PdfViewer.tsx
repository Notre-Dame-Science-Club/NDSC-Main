'use client'
import { useState } from 'react'

/**
 * Publication PDF / flip-book viewer.
 *
 * BUG FIX: this component used to render a single hardcoded Heyzine
 * flip-book URL (the AUDRI 2025 issue) and ignored its `url` prop entirely,
 * so every older issue — AUDRI 2021, previous wall magazines, everything in
 * "READ PREVIOUS EDITIONS" — opened the 2025 flip-book instead of its own file.
 *
 * Now: if the publication has its own `flipbookUrl` (Heyzine etc.) we embed
 * that; otherwise we fall back to viewing the publication's actual PDF.
 */
export default function PdfViewer({ url, flipbookUrl }: { url: string; flipbookUrl?: string | null }) {
  const [mode, setMode] = useState<'gdocs' | 'direct' | 'failed'>('gdocs')

  const frameStyle = {
    border: '1px solid lightgray',
    width: '100%',
    height: '100%',
    display: 'block',
    background: '#fff',
  } as const

  if (flipbookUrl) {
    return (
      <div style={{ height: '85vh', position: 'relative', background: 'var(--surface)' }}>
        <iframe
          allowFullScreen
          allow="clipboard-write"
          scrolling="no"
          className="fp-iframe"
          style={frameStyle}
          src={flipbookUrl}
          title="Flip book"
        />
      </div>
    )
  }

  if (!url) {
    return (
      <div className="flex items-center justify-center" style={{ height: '85vh' }}>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>This issue has no file attached yet.</p>
      </div>
    )
  }

  const gdocsUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`

  if (mode === 'failed') {
    return (
      <div className="flex flex-col items-center justify-center gap-4" style={{ height: '85vh' }}>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>Inline viewer কাজ করছে না।</p>
        <a href={url} target="_blank" rel="noopener noreferrer"
          className="px-6 py-3 rounded font-bold text-sm"
          style={{ background: 'var(--blue)', color: '#000' }}>
          নতুন Tab এ খুলুন ↗
        </a>
      </div>
    )
  }

  return (
    <div style={{ height: '85vh', position: 'relative', background: 'var(--surface)' }}>
      <iframe
        key={mode}
        src={mode === 'gdocs' ? gdocsUrl : url}
        style={frameStyle}
        title="PDF viewer"
        onError={() => setMode(mode === 'gdocs' ? 'direct' : 'failed')}
      />
    </div>
  )
}
