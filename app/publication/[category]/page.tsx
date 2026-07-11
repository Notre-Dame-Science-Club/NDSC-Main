'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, BookOpen, Download, X, Newspaper, Gem, Microscope, Library } from 'lucide-react'

type Publication = {
  id: string; title: string; description: string; category: string
  published_year: number; cover_image_url: string; pdf_url: string
}

const formatCategoryLabel = (category: string) => {
  const cleaned = category.replace(/_/g, ' ').trim()
  if (!cleaned) return 'Publication'
  return cleaned.replace(/\b\w/g, (char) => char.toUpperCase())
}

const CATEGORY_META: Record<string, { label: string; icon: typeof BookOpen; color: string }> = {
  wall_magazine: { label: 'Wall Magazine',     icon: Newspaper,  color: 'var(--blue)' },
  trimatrik:     { label: 'Trimatrik',         icon: Gem,        color: 'var(--accent2)' },
  abhishkar:     { label: 'Abhishkar Focus',   icon: Microscope, color: 'var(--accent)' },
  annual_magazine: { label: 'AUDRI Archive',   icon: BookOpen,   color: 'var(--blue)' },
}

export default function PublicationArchivePage() {
  const params = useParams()
  const router = useRouter()
  const category = params.category as string
  const meta = CATEGORY_META[category] || { label: formatCategoryLabel(category), icon: Library, color: 'var(--blue)' }

  const [items, setItems] = useState<Publication[]>([])
  const [loading, setLoading] = useState(true)
  const [pdfOpen, setPdfOpen] = useState(false)
  const [selectedPub, setSelectedPub] = useState<Publication | null>(null)

  useEffect(() => {
    fetch(`/api/publications?category=${category}`)
      .then(r => r.json())
      .then(d => { setItems(Array.isArray(d) ? d : []); setLoading(false) })
  }, [category])

  const openPdf = (pub: Publication) => {
    setSelectedPub(pub)
    setPdfOpen(true)
  }

  return (
    <div className="min-h-screen" style={{ paddingTop: '72px', background: 'var(--bg)' }}>

      {/* PDF Modal */}
      {pdfOpen && selectedPub && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'rgba(0,0,0,0.97)' }}>
          <div className="flex items-center justify-between px-6 py-3 border-b shrink-0"
            style={{ borderColor: 'var(--border)', background: 'var(--bg2)' }}>
            <span className="text-sm font-bold" style={{ fontFamily: "'Orbitron',sans-serif", color: meta.color }}>
              {selectedPub.title} — {selectedPub.published_year}
            </span>
            <div className="flex items-center gap-3">
              <a href={selectedPub.pdf_url} download
                className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-bold border"
                style={{ borderColor: meta.color, color: meta.color }}>
                <Download size={12} /> PDF
              </a>
              <button onClick={() => setPdfOpen(false)}
                className="p-1.5 rounded border" style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>
                <X size={16} />
              </button>
            </div>
          </div>
          <iframe src={selectedPub.pdf_url} className="flex-1 w-full border-0" title={selectedPub.title} />
        </div>
      )}

      {/* Header */}
      <div className="border-b py-12" style={{ borderColor: 'var(--border)', background: 'var(--bg2)' }}>
        <div className="max-w-6xl mx-auto px-6">
          <button onClick={() => router.push('/publication')}
            className="flex items-center gap-2 text-sm mb-6 transition-colors hover:text-[var(--blue)]"
            style={{ color: 'var(--muted)', fontFamily: "'Share Tech Mono',monospace" }}>
            <ArrowLeft size={14} /> BACK TO PUBLICATIONS
          </button>
          <div className="section-label mb-2">Archive</div>
          <h1 className="text-3xl md:text-4xl font-black inline-flex items-center gap-3" style={{ fontFamily: "'Orbitron',sans-serif" }}>
            <meta.icon size={30} style={{ color: meta.color }} /> <span style={{ color: meta.color }}>{meta.label}</span>
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--muted)' }}>
            {items.length} issue{items.length !== 1 ? 's' : ''} found
          </p>
        </div>
      </div>

      {/* Grid */}
      <div className="max-w-6xl mx-auto px-6 py-16">
        {loading ? (
          <div className="text-center py-24" style={{ color: 'var(--muted)' }}>Loading...</div>
        ) : items.length === 0 ? (
          <div className="text-center py-24">
            <div className="mb-4 flex justify-center" style={{ color: 'var(--muted)' }}><BookOpen size={40} /></div>
            <p style={{ color: 'var(--muted)' }}>No {meta.label} issues found yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
            {items.map(pub => (
              <div key={pub.id}
                className="group rounded-xl border overflow-hidden transition-all duration-300 hover:border-[var(--blue)] hover:-translate-y-1"
                style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
                {/* Cover */}
                <div className="relative overflow-hidden" style={{ height: 200 }}>
                  {pub.cover_image_url ? (
                    <img src={pub.cover_image_url} alt={pub.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"
                      style={{ background: 'var(--bg2)', color: meta.color, opacity: 0.5 }}>
                      <meta.icon size={36} />
                    </div>
                  )}
                  <div className="absolute inset-0"
                    style={{ background: 'linear-gradient(0deg,rgba(2,8,16,.75) 0%,transparent 60%)' }} />
                  <div className="absolute bottom-2 left-2 text-xs font-bold px-2 py-0.5 rounded"
                    style={{ background: 'rgba(0,0,0,0.6)', color: meta.color,
                      fontFamily: "'Orbitron',sans-serif", border: `1px solid ${meta.color}33` }}>
                    {pub.published_year}
                  </div>
                </div>
                {/* Info */}
                <div className="p-3">
                  <p className="text-xs font-bold mb-1 truncate" style={{ color: 'var(--white)' }}>{pub.title}</p>
                  {pub.description && (
                    <p className="text-xs leading-relaxed line-clamp-2 mb-3" style={{ color: 'var(--muted)' }}>
                      {pub.description}
                    </p>
                  )}
                  {pub.pdf_url && (
                    <button onClick={() => openPdf(pub)}
                      className="w-full py-1.5 rounded text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                      style={{ background: `${meta.color}15`, color: meta.color, border: `1px solid ${meta.color}33` }}>
                      <BookOpen size={11} /> Read
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
