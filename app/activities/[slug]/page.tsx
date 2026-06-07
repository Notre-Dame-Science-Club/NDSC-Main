import { supabaseAdmin } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import PdfViewer from './PdfViewer'
import { normalizeUploadUrl, normalizeUploadUrls } from '@/lib/uploadUrl'
export const dynamic = 'force-dynamic'

function getYoutubeId(url: string) {
  if (!url) return null
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)
  return m ? m[1] : null
}

function renderMarkdown(text: string) {
  if (!text) return ''
  return text
    .replace(/^## (.+)$/gm, '<h2 style="font-size:1.25rem;font-weight:700;margin:1.5rem 0 0.5rem;color:#e8f4ff">$1</h2>')
    .replace(/^### (.+)$/gm, '<h3 style="font-size:1rem;font-weight:700;margin:1.25rem 0 0.5rem;color:#e8f4ff">$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#e8f4ff">$1</strong>')
    .replace(/^- (.+)$/gm, '<li style="margin-left:1.5rem;list-style:disc;color:#a0b4c8">$1</li>')
    .replace(/\n\n/g, '</p><p style="margin:0.75rem 0;color:#a0b4c8;line-height:1.7">')
}

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  // Query WITHOUT join — simple select
  const { data: session } = await supabaseAdmin
    .from('activity_sessions')
    .select('*')
    .eq('slug', slug)
    .eq('is_published', true)
    .maybeSingle()

  if (!session) notFound()

  // Normalize upload URLs
  session.cover_image_url = normalizeUploadUrl(session.cover_image_url)
  session.pdf_url = normalizeUploadUrl(session.pdf_url)
  session.gallery_urls = normalizeUploadUrls(session.gallery_urls)

  // Get type info separately if type_id exists
  let typeName = 'Activities'
  let typeSlug = ''
  let typeIcon = '🔬'

  if (session.activity_type_id) {
    const { data: typeData } = await supabaseAdmin
      .from('activity_types')
      .select('name, slug, icon')
      .eq('id', session.activity_type_id)
      .single()
    if (typeData) {
      typeName = typeData.name
      typeSlug = typeData.slug
      typeIcon = typeData.icon || '🔬'
    }
  }

  // Get version info separately if version_id exists
  let versionLabel = ''
  if (session.activity_version_id) {
    const { data: verData } = await supabaseAdmin
      .from('activity_versions')
      .select('version_number, version_label')
      .eq('id', session.activity_version_id)
      .single()
    if (verData) {
      versionLabel = verData.version_label || `v${verData.version_number}`
    }
  }

  const ytId = getYoutubeId(session.youtube_url)

  return (
    <div className="min-h-screen" style={{ paddingTop: '72px', background: 'var(--bg)' }}>

      {/* Back */}
      <div className="max-w-4xl mx-auto px-4 pt-8 pb-4">
        <Link
          href={typeSlug ? `/activities?tab=${typeSlug}` : '/activities'}
          className="inline-flex items-center gap-2 text-sm transition-colors hover:text-white"
          style={{ color: 'var(--muted)' }}>
          ← Back to {typeName}
        </Link>
      </div>

      <div className="max-w-4xl mx-auto px-4 pb-20">

        {/* YouTube embed */}
        {ytId && (
          <div className="rounded-2xl overflow-hidden mb-8 border" style={{ borderColor: 'var(--border)' }}>
            <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0 }}>
              <iframe
                src={`https://www.youtube.com/embed/${ytId}`}
                title={session.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
              />
            </div>
          </div>
        )}

        {/* Cover image */}
        {!ytId && session.cover_image_url && (
          <div className="rounded-2xl overflow-hidden mb-8 border" style={{ borderColor: 'var(--border)' }}>
            <img
              src={session.cover_image_url}
              alt={session.title}
              style={{ width: '100%', maxHeight: '480px', objectFit: 'cover' }}
            />
          </div>
        )}

        {/* Badges */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="px-3 py-1 rounded-full text-xs font-bold"
            style={{ background: 'rgba(0,212,255,0.1)', color: 'var(--blue)', border: '1px solid rgba(0,212,255,0.3)' }}>
            {typeIcon} {typeName}
          </span>
          {versionLabel && (
            <span className="px-3 py-1 rounded-full text-xs font-bold"
              style={{ background: 'rgba(0,212,255,0.06)', color: '#6a9fbf', border: '1px solid rgba(0,212,255,0.15)' }}>
              {versionLabel}
            </span>
          )}
        </div>

        {/* Title */}
        <h1 className="text-3xl md:text-4xl font-black mb-5"
          style={{ fontFamily: "'Orbitron',sans-serif", color: 'var(--white)' }}>
          {session.title}
        </h1>

        {/* Meta */}
        <div className="flex flex-wrap gap-4 text-sm mb-10" style={{ color: 'var(--muted)' }}>
          {session.session_date && (
            <span>📅 {new Date(session.session_date).toLocaleDateString('en-BD', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            })}</span>
          )}
          {session.location && <span>📍 {session.location}</span>}
        </div>

        {/* Description */}
        {session.description && (
          <div className="rounded-2xl border p-8 mb-8"
            style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            <p style={{ color: '#a0b4c8', lineHeight: 1.8 }}
              dangerouslySetInnerHTML={{ __html: renderMarkdown(session.description) }} />
          </div>
        )}

        {/* PDF */}
        
{session.pdf_url && (
  <div className="rounded-2xl border overflow-hidden mb-8"
    style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
    <div className="flex items-center justify-between px-6 py-4 border-b"
      style={{ borderColor: 'var(--border)' }}>
      <span className="font-bold text-sm flex items-center gap-2"
        style={{ fontFamily: "'Orbitron',sans-serif", color: 'var(--blue)' }}>
        📄 Session Notes / PDF
      </span>
      <a href={session.pdf_url} target="_blank" rel="noopener noreferrer"
        className="text-xs px-3 py-1 rounded font-bold"
        style={{ background: 'rgba(0,212,255,0.1)', color: 'var(--blue)' }}>
        ↓ Download
      </a>
    </div>
<PdfViewer url={session.pdf_url} />
  </div>
)}
        
        {/* Gallery */}
        {session.gallery_urls && session.gallery_urls.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold mb-5"
              style={{ fontFamily: "'Orbitron',sans-serif", color: 'var(--white)' }}>
              📸 Gallery
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {session.gallery_urls.map((url: string, i: number) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                  className="group overflow-hidden rounded-xl block">
                  <img
                    src={url}
                    alt={`Photo ${i + 1}`}
                    className="w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    style={{ height: '200px' }}
                  />
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
