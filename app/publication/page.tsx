'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BookOpen, Download, X, ChevronRight } from 'lucide-react'
import PdfViewer from './PdfViewer'

type Publication = {
  id: string
  title: string
  description: string
  category: string
  published_year: number
  cover_image_url: string
  pdf_url: string
}

const FEATURED_CATEGORIES = ['annual_magazine', 'wall_magazine', 'trimatrik', 'abhishkar'] as const

const CATEGORY_META: Record<string, { sectionLabel: string; title: string; subtitle: string; accent: string; linkLabel: string }> = {
  annual_magazine: { sectionLabel: 'Annual Publication', title: 'অদ্রি (AUDRI)', subtitle: 'Annual Publication', accent: 'var(--blue)', linkLabel: 'VIEW PREVIOUS' },
  wall_magazine: { sectionLabel: 'Club Publication', title: 'WALL MAGAZINE', subtitle: 'Club Publication', accent: 'var(--blue)', linkLabel: 'VIEW PREVIOUS' },
  trimatrik: { sectionLabel: '3D Wall Magazine', title: 'TRIMATRIK', subtitle: '3D Wall Magazine', accent: 'var(--accent2)', linkLabel: 'VIEW PREVIOUS' },
  abhishkar: { sectionLabel: 'Focus Publication', title: 'ABHISHKAR FOCUS', subtitle: 'Focus Publication', accent: 'var(--accent)', linkLabel: 'VIEW PREVIOUS' },
}

const formatCategoryLabel = (category: string) => {
  const cleaned = category.replace(/_/g, ' ').trim()
  if (!cleaned) return 'Publication'
  return cleaned.replace(/\b\w/g, (char) => char.toUpperCase())
}

const getCategoryMeta = (category: string) => {
  const known = CATEGORY_META[category]
  if (known) return known
  return {
    sectionLabel: 'Publication',
    title: formatCategoryLabel(category),
    subtitle: 'Publication',
    accent: 'var(--blue)',
    linkLabel: 'VIEW PREVIOUS',
  }
}

export default function PublicationPage() {
  const [pubs, setPubs] = useState<Publication[]>([])
  const [localCategories, setLocalCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [pdfOpen, setPdfOpen] = useState(false)
  const [selectedPub, setSelectedPub] = useState<Publication | null>(null)

  useEffect(() => {
    fetch('/api/publications?latest=true')
      .then(r => r.json())
      .then(d => { setPubs(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    // Categories are derived from the publications data already fetched
  }, [])

  const get = (cat: string) => pubs.find(p => p.category === cat) || null
  const openPdf = (pub: Publication) => { setSelectedPub(pub); setPdfOpen(true) }

  const audri = get('annual_magazine')
  const wall = get('wall_magazine')
  const trimatrik = get('trimatrik')
  const abhishkar = get('abhishkar')
  const extraCategories = Array.from(new Set([
    ...localCategories,
    ...pubs.map(pub => pub.category),
  ].filter((category) => !FEATURED_CATEGORIES.includes(category as (typeof FEATURED_CATEGORIES)[number]))))

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ paddingTop: '72px' }}>
      <p style={{ color: 'var(--muted)', fontFamily: "'Share Tech Mono', monospace" }}>LOADING...</p>
    </div>
  )

  return (
    <div className="min-h-screen" style={{ paddingTop: '72px', background: 'var(--bg)' }}>

      {pdfOpen && selectedPub && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'rgba(0,0,0,0.97)' }}>
          <div className="flex items-center justify-between px-6 py-3 border-b shrink-0"
            style={{ borderColor: 'var(--border)', background: 'var(--bg2)' }}>
            <span className="text-sm font-bold truncate"
              style={{ fontFamily: "'Orbitron',sans-serif", color: 'var(--blue)' }}>
              {selectedPub.title}
            </span>
            <div className="flex items-center gap-3 shrink-0">
              <a href={selectedPub.pdf_url} download
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold border"
                style={{ borderColor: 'var(--blue)', color: 'var(--blue)' }}>
                <Download size={12} /> Download
              </a>
              <button onClick={() => setPdfOpen(false)}
                className="p-1.5 rounded border"
                style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>
                <X size={16} />
              </button>
            </div>
          </div>
          <PdfViewer url={selectedPub.pdf_url} />
        </div>
      )}

      {/* AUDRI */}
      <section className="py-24 border-b"
        style={{ background: 'linear-gradient(180deg, var(--bg2), var(--bg))', borderColor: 'var(--border)' }}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="section-label mb-2">Annual Publication</div>
          <div className="flex flex-col lg:flex-row items-center gap-16">
            {audri ? (
              <div className="shrink-0 cursor-pointer group" onClick={() => audri.pdf_url && openPdf(audri)}>
                <div className="relative rounded-xl overflow-hidden shadow-2xl" style={{ width: 240 }}>
                  {audri.cover_image_url ? (
                    <img src={audri.cover_image_url} alt={audri.title} className="w-full h-auto object-contain" />
                  ) : (
                    <div className="w-full flex items-center justify-center text-6xl"
                      style={{ height: 320, background: 'var(--bg2)' }}>
                      📘
                    </div>
                  )}
                  {audri.pdf_url && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ background: 'rgba(0,0,0,0.6)' }}>
                      <span className="text-xs font-bold tracking-widest px-4 py-2 rounded border"
                        style={{ borderColor: 'var(--blue)', color: 'var(--blue)', fontFamily: "'Orbitron',sans-serif" }}>
                        READ
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="shrink-0 w-60 rounded-xl flex items-center justify-center text-6xl opacity-20"
                style={{ height: 320, border: '2px dashed var(--border)', background: 'var(--bg2)' }}>
                📘
              </div>
            )}

            <div>
              <h1 className="text-4xl md:text-5xl font-black mb-2"
                style={{ fontFamily: "'Orbitron',sans-serif" }}>
                অদ্রি <span style={{ color: 'var(--blue)' }}>(AUDRI)</span>
              </h1>
              {audri ? (
                <div className="flex flex-col gap-4">
                  <h2 className="text-lg font-bold" style={{ color: 'var(--muted)' }}>{audri.title}</h2>
                  {audri.description && (
                    <p className="text-sm leading-relaxed max-w-lg" style={{ color: 'var(--muted)' }}>
                      {audri.description}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-4 mt-2">
                    {audri.pdf_url && (
                      <a 
                        href="https://heyzine.com/flip-book/a9df397b9b.html"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-6 py-3 font-black text-sm tracking-widest rounded inline-flex"
                        style={{ background: 'var(--blue)', color: '#000', fontFamily: "'Orbitron',sans-serif" }}
                      >
                        <BookOpen size={16} /> READ ONLINE
                      </a>
                    )}
                    {audri.pdf_url && (
                      <a href={audri.pdf_url} download
                        className="flex items-center gap-2 px-6 py-3 font-black text-sm tracking-widest rounded border"
                        style={{ borderColor: 'var(--blue)', color: 'var(--blue)', fontFamily: "'Orbitron',sans-serif" }}>
                        DOWNLOAD
                      </a>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm" style={{ color: 'var(--muted)' }}>Coming soon.</p>
              )}
            </div>
          </div>

          {/* Previous AUDRI editions */}
          <PreviousEditions category="annual_magazine" accentColor="var(--blue)" />
        </div>
      </section>

      {/* Wall Magazine */}
      <section className="py-20 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="section-label mb-2">Club Publication</div>
          <div className="flex items-end justify-between mb-10 flex-wrap gap-4">
            <h2 className="text-3xl font-black" style={{ fontFamily: "'Orbitron',sans-serif" }}>
              WALL <span style={{ color: 'var(--blue)' }}>MAGAZINE</span>
            </h2>
            <Link href="/publication/wall_magazine"
              className="flex items-center gap-1.5 text-xs font-bold tracking-widest"
              style={{ color: 'var(--muted)', fontFamily: "'Share Tech Mono',monospace" }}>
              VIEW PREVIOUS <ChevronRight size={12} />
            </Link>
          </div>
          {wall ? (
            <FeatureCard pub={wall} accentColor="var(--blue)" imageRight={false} onRead={openPdf} />
          ) : (
            <EmptyState label="Wall Magazine" />
          )}
        </div>
      </section>

      {/* Trimatrik */}
      <section className="py-20 border-b"
        style={{ borderColor: 'var(--border)', background: 'var(--bg2)' }}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="section-label mb-2">3D Wall Magazine</div>
          <div className="flex items-end justify-between mb-10 flex-wrap gap-4">
            <h2 className="text-3xl font-black" style={{ fontFamily: "'Orbitron',sans-serif" }}>
              <span style={{ color: 'var(--accent2)' }}>TRIMATRIK</span>
            </h2>
            <Link href="/publication/trimatrik"
              className="flex items-center gap-1.5 text-xs font-bold tracking-widest"
              style={{ color: 'var(--muted)', fontFamily: "'Share Tech Mono',monospace" }}>
              VIEW PREVIOUS <ChevronRight size={12} />
            </Link>
          </div>
          {trimatrik ? (
            <FeatureCard pub={trimatrik} accentColor="var(--accent2)" imageRight={true} onRead={openPdf} />
          ) : (
            <EmptyState label="Trimatrik" />
          )}
        </div>
      </section>

      {/* Abhishkar */}
      <section className="py-20" style={{ background: 'var(--bg)' }}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="section-label mb-2">Focus Publication</div>
          <div className="flex items-end justify-between mb-10 flex-wrap gap-4">
            <h2 className="text-3xl font-black" style={{ fontFamily: "'Orbitron',sans-serif" }}>
              <span style={{ color: 'var(--accent)' }}>ABHISHKAR</span> FOCUS
            </h2>
            <Link href="/publication/abhishkar"
              className="flex items-center gap-1.5 text-xs font-bold tracking-widest"
              style={{ color: 'var(--muted)', fontFamily: "'Share Tech Mono',monospace" }}>
              VIEW PREVIOUS <ChevronRight size={12} />
            </Link>
          </div>
          {abhishkar ? (
            <FeatureCard pub={abhishkar} accentColor="var(--accent)" imageRight={false} onRead={openPdf} />
          ) : (
            <EmptyState label="Abhishkar Focus" />
          )}
        </div>
      </section>

      {extraCategories.map((category) => {
        const meta = getCategoryMeta(category)
        const pub = get(category)
        return (
          <section key={category} className="py-20 border-t" style={{ borderColor: 'var(--border)', background: 'var(--bg2)' }}>
            <div className="max-w-7xl mx-auto px-6">
              <div className="section-label mb-2">{meta.sectionLabel}</div>
              <div className="flex items-end justify-between mb-10 flex-wrap gap-4">
                <h2 className="text-3xl font-black" style={{ fontFamily: "'Orbitron',sans-serif" }}>
                  <span style={{ color: meta.accent }}>{meta.title.toUpperCase()}</span>
                </h2>
                <Link href={`/publication/${category}`}
                  className="flex items-center gap-1.5 text-xs font-bold tracking-widest"
                  style={{ color: 'var(--muted)', fontFamily: "'Share Tech Mono',monospace" }}>
                  {meta.linkLabel} <ChevronRight size={12} />
                </Link>
              </div>
              {pub ? (
                <FeatureCard pub={pub} accentColor={meta.accent} imageRight={false} onRead={openPdf} />
              ) : (
                <EmptyState label={meta.title} />
              )}
              <PreviousEditions category={category} accentColor={meta.accent} />
            </div>
          </section>
        )
      })}
    </div>
  )
}

function PreviousEditions({ category, accentColor }: { category: string; accentColor: string }) {
  const [items, setItems] = useState<Publication[]>([])

  useEffect(() => {
    fetch(`/api/publications?category=${category}`)
      .then(r => r.json())
      .then(d => setItems(Array.isArray(d) ? d.slice(1) : []))
      .catch(() => {})
  }, [category])

  if (items.length === 0) return null

  return (
    <div className="mt-16 pt-10 border-t" style={{ borderColor: 'var(--border)' }}>
      <p className="text-xs font-bold tracking-widest mb-6"
        style={{ color: 'var(--muted)', fontFamily: "'Share Tech Mono',monospace" }}>
        READ PREVIOUS EDITIONS
      </p>
      <div className="flex flex-wrap gap-5">
        {items.map(pub => (
          <PrevCover key={pub.id} pub={pub} accentColor={accentColor} />
        ))}
      </div>
    </div>
  )
}

function PrevCover({ pub, accentColor }: { pub: Publication; accentColor: string }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'rgba(0,0,0,0.97)' }}>
          <div className="flex items-center justify-between px-6 py-3 border-b shrink-0"
            style={{ borderColor: 'var(--border)', background: 'var(--bg2)' }}>
            <span className="text-sm font-bold" style={{ fontFamily: "'Orbitron',sans-serif", color: accentColor }}>
              {pub.title}
            </span>
            <div className="flex items-center gap-3">
              {pub.pdf_url && (
                <a href={pub.pdf_url} download
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold border"
                  style={{ borderColor: accentColor, color: accentColor }}>
                  <Download size={12} /> Download
                </a>
              )}
              <button onClick={() => setOpen(false)}
                className="p-1.5 rounded border"
                style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>
                <X size={16} />
              </button>
            </div>
          </div>
          {pub.pdf_url && (
            <PdfViewer url={pub.pdf_url} />
          )}
        </div>
      )}

      <div className="group cursor-pointer" style={{ width: 120 }}
        onClick={() => pub.pdf_url && setOpen(true)}>
        <div className="relative rounded-lg overflow-hidden mb-2 transition-transform duration-300 group-hover:-translate-y-1"
          style={{ border: `1px solid var(--border)` }}>
          {pub.cover_image_url ? (
            <img src={pub.cover_image_url} alt={pub.title} className="w-full h-auto object-contain" />
          ) : (
            <div className="w-full flex items-center justify-center text-3xl opacity-30"
              style={{ height: 160, background: 'var(--bg2)' }}>
              📘
            </div>
          )}
          {pub.pdf_url && (
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ background: 'rgba(0,0,0,0.65)' }}>
              <BookOpen size={20} style={{ color: accentColor }} />
            </div>
          )}
        </div>
        <p className="text-xs font-bold text-center truncate" style={{ color: 'var(--muted)' }}>
          {pub.published_year}
        </p>
      </div>
    </>
  )
}

function FeatureCard({
  pub, accentColor, imageRight, onRead
}: {
  pub: Publication; accentColor: string; imageRight: boolean; onRead: (p: Publication) => void
}) {
  const imgEl = (
    <div className="shrink-0 rounded-2xl overflow-hidden shadow-2xl" style={{ width: 260 }}>
      {pub.cover_image_url ? (
        <img src={pub.cover_image_url} alt={pub.title} className="w-full h-auto object-contain" />
      ) : (
        <div className="w-full flex items-center justify-center text-6xl opacity-20"
          style={{ height: 340, border: '2px dashed var(--border)', background: 'var(--bg2)', borderRadius: 16 }}>
          🔷
        </div>
      )}
    </div>
  )

  const textEl = (
    <div className="flex flex-col justify-center flex-1">
      <span className="text-xs font-bold tracking-widest mb-3"
        style={{ color: accentColor, fontFamily: "'Share Tech Mono',monospace" }}>
        {pub.published_year}
      </span>
      <h3 className="text-2xl md:text-3xl font-black mb-4" style={{ fontFamily: "'Orbitron',sans-serif" }}>
        {pub.title}
      </h3>
      {pub.description && (
        <p className="text-sm leading-loose mb-6 max-w-lg" style={{ color: 'var(--muted)' }}>
          {pub.description}
        </p>
      )}
      {pub.pdf_url && (
        <button onClick={() => onRead(pub)}
          className="self-start flex items-center gap-2 px-5 py-2.5 font-bold text-sm rounded"
          style={{ background: accentColor, color: '#000' }}>
          <BookOpen size={14} /> Read Now
        </button>
      )}
    </div>
  )

  return (
    <div className="flex flex-col md:flex-row gap-12 items-center rounded-2xl border p-8 md:p-10"
      style={{ borderColor: 'var(--border)', background: 'rgba(255,255,255,0.02)' }}>
      {imageRight ? <>{textEl}{imgEl}</> : <>{imgEl}{textEl}</>}
    </div>
  )
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border p-12 text-center"
      style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
      <p className="text-4xl mb-3">📭</p>
      <p className="text-sm" style={{ color: 'var(--muted)' }}>No {label} published yet.</p>
    </div>
  )
}
