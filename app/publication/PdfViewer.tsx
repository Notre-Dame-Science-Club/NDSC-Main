'use client'
export default function PdfViewer({ url }: { url: string }) {
  return (
    <div style={{ height: '85vh', position: 'relative', background: 'var(--surface)' }}>
      <iframe
        allowFullScreen={true}
        allow="clipboard-write"
        scrolling="no"
        className="fp-iframe"
        style={{ border: '1px solid lightgray', width: '100%', height: '100%', display: 'block', background: '#fff' }}
        src="https://heyzine.com/flip-book/a9df397b9b.html"
      />
    </div>
  )
}
