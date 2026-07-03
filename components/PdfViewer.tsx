'use client'

// components/PdfViewer.tsx
//
// DEDUP NOTE: this repo has three PdfViewer.tsx files:
//   - app/activities/[slug]/PdfViewer.tsx
//   - app/admin/PdfViewer.tsx
//   - app/publication/PdfViewer.tsx
//
// The first two are byte-for-byte identical (Google Docs viewer embed, with
// a "direct" iframe fallback, then a final "open/download" fallback). This
// component replaces that duplicated implementation — new code should
// import this instead of copy-pasting a fourth PdfViewer.
//
// app/publication/PdfViewer.tsx is NOT the same component: it renders a
// hardcoded Heyzine flip-book embed and ignores its `url` prop entirely
// (worth a bug ticket, but out of scope here — this task only adds new
// shared files). It's intentionally not merged into this one since its
// actual behavior (a fixed external flip-book URL) is different from "view
// this PDF", not just a styling difference.
//
// Migrating the two identical call sites to this component is left to
// whoever owns those pages, since this task doesn't modify app/.

import { useState } from 'react'

export interface PdfViewerProps {
  url: string
  /** CSS height of the viewer area. Default matches the activities/admin originals. */
  height?: string
  /** Override the fallback copy (defaults match the original Bengali strings). */
  labels?: {
    failedMessage?: string
    openInNewTab?: string
    download?: string
    directTry?: string
  }
}

const defaultLabels: Required<NonNullable<PdfViewerProps['labels']>> = {
  failedMessage: 'Inline viewer কাজ করছে না।',
  openInNewTab: 'নতুন Tab এ খুলুন',
  download: 'Download PDF',
  directTry: 'Direct Try',
}

/**
 * Renders a PDF via Google Docs' viewer embed, with graceful fallback:
 * gdocs viewer → direct iframe → open/download links, in that order, each
 * triggered by the iframe's onError.
 */
export default function PdfViewer({ url, height = '80vh', labels }: PdfViewerProps) {
  const [mode, setMode] = useState<'gdocs' | 'direct' | 'failed'>('gdocs')
  const t = { ...defaultLabels, ...labels }
  const gdocsUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`

  if (mode === 'failed') {
    return (
      <div
        className="flex flex-col items-center justify-center gap-4 py-16"
        style={{ background: '#0a1628' }}
      >
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          {t.failedMessage}
        </p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-6 py-3 rounded font-bold text-sm"
          style={{ background: 'var(--blue)', color: '#000', fontFamily: "'Orbitron',sans-serif" }}
        >
          {t.openInNewTab} ↗
        </a>
        <a
          href={url}
          download
          className="flex items-center gap-2 px-6 py-3 rounded font-bold text-sm border"
          style={{ borderColor: 'var(--blue)', color: 'var(--blue)', fontFamily: "'Orbitron',sans-serif" }}
        >
          ↓ {t.download}
        </a>
      </div>
    )
  }

  return (
    <div style={{ height, position: 'relative', background: '#0a1628' }}>
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
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 rounded text-xs font-bold"
          style={{
            background: 'rgba(0,212,255,0.15)',
            color: 'var(--blue)',
            border: '1px solid rgba(0,212,255,0.3)',
            backdropFilter: 'blur(4px)',
          }}
        >
          ↗ {t.openInNewTab}
        </a>
        {mode === 'gdocs' && (
          <button
            onClick={() => setMode('direct')}
            className="px-3 py-1.5 rounded text-xs font-bold"
            style={{
              background: 'rgba(255,255,255,0.08)',
              color: 'var(--muted)',
              border: '1px solid var(--border)',
              backdropFilter: 'blur(4px)',
            }}
          >
            {t.directTry}
          </button>
        )}
      </div>
    </div>
  )
}
