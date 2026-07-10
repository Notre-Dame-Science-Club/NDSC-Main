import { supabaseAdmin } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import PdfViewer from './PdfViewer'
import { normalizeUploadUrl, normalizeUploadUrls } from '@/lib/uploadUrl'
import ActivityRegisterButton from './ActivityRegisterButton'
import { ActivityIcon } from '@/lib/activityIcons'
import { CalendarDays, MapPin, FileText, Download, Images } from 'lucide-react'

export const dynamic = 'force-dynamic'

function getYoutubeId(url: string) {
  if (!url) return null
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)
  return m ? m[1] : null
}

function renderMarkdown(text: string) {
  if (!text) return ''
  return text
    .replace(/^## (.+)$/gm, '<h2 style="font-size:1.25rem;font-weight:700;margin:1.5rem 0 0.5rem;color:var(--white)">$1</h2>')
    .replace(/^### (.+)$/gm, '<h3 style="font-size:1rem;font-weight:700;margin:1.25rem 0 0.5rem;color:var(--white)">$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:var(--white)">$1</strong>')
    .replace(/^- (.+)$/gm, '<li style="margin-left:1.5rem;list-style:disc;color:#a0b4c8">$1</li>')
    .replace(/\n\n/g, '</p><p style="margin:0.75rem 0;color:#a0b4c8;line-height:1.7">')
}

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const { data: session } = await supabaseAdmin
    .from('activity_sessions')
    .select('*')
    .eq('slug', slug)
    .eq('is_published', true)
    .maybeSingle()

  if (!session) notFound()

  session.cover_image_url = normalizeUploadUrl(session.cover_image_url)
  session.pdf_url = normalizeUploadUrl(session.pdf_url)
  session.gallery_urls = normalizeUploadUrls(session.gallery_urls)

  let typeName = 'Activities'
  let typeSlug = ''
  let typeIcon = 'microscope'

  if (session.activity_type_id) {
    const { data: typeData } = await supabaseAdmin
      .from('activity_types')
      .select('name, slug, icon')
      .eq('id', session.activity_type_id)
      .single()
    if (typeData) { typeName = typeData.name; typeSlug = typeData.slug; typeIcon = typeData.icon || 'microscope' }
  }

  let versionLabel = ''
  if (session.activity_version_id) {
    const { data: verData } = await supabaseAdmin
      .from('activity_versions')
      .select('version_number, version_label')
      .eq('id', session.activity_version_id)
      .single()
    if (verData) versionLabel = verData.version_label || `v${verData.version_number}`
  }

  const ytId = getYoutubeId(session.youtube_url)

  return (
    <div className="min-h-screen" style={{ paddingTop: '72px', background: 'var(--bg)' }}>

      <div className="max-w-4xl mx-auto px-4 pt-8 pb-4">
        <Link href={typeSlug ? `/activities?tab=${typeSlug}` : '/activities'}
          className="inline-flex items-center gap-2 text-sm transition-colors hover:text-white"
          style={{ color: 'var(--muted)' }}>
          ← Back to {typeName}
        </Link>
      </div>

      <div className="max-w-4xl mx-auto px-4 pb-20">

        {ytId && (
          <div className="rounded-2xl overflow-hidden mb-8 border" style={{ borderColor: 'var(--border)' }}>
            <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0 }}>
              <iframe src={`https://www.youtube.com/embed/${ytId}`} title={session.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }} />
            </div>
          </div>
        )}

        {!ytId && session.cover_image_url && (
          <div className="rounded-2xl overflow-hidden mb-8 border" style={{ borderColor: 'var(--border)' }}>
            <img src={session.cover_image_url} alt={session.title}
              style={{ width: '100%', maxHeight: '480px', objectFit: 'cover' }} />
          </div>
        )}

        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1.5"
            style={{ background: 'rgba(var(--blue-rgb), 0.1)', color: 'var(--blue)', border: '1px solid rgba(var(--blue-rgb), 0.3)' }}>
            <ActivityIcon icon={typeIcon} size={12} /> {typeName}
          </span>
          {versionLabel && (
            <span className="px-3 py-1 rounded-full text-xs font-bold"
              style={{ background: 'rgba(var(--blue-rgb), 0.06)', color: '#6a9fbf', border: '1px solid rgba(var(--blue-rgb), 0.15)' }}>
              {versionLabel}
            </span>
          )}
        </div>

        <h1 className="text-3xl md:text-4xl font-black mb-5"
          style={{ fontFamily: "'Orbitron',sans-serif", color: 'var(--white)' }}>
          {session.title}
        </h1>

        <div className="flex flex-wrap gap-4 text-sm mb-6" style={{ color: 'var(--muted)' }}>
          {session.event_dates && session.event_dates.length > 0 ? (
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays size={14} /> {session.event_dates.map((d: string) =>
                new Date(d).toLocaleDateString('en-BD', { month: 'short', day: 'numeric' })
              ).join(' · ')}
              {session.event_dates.length > 1 && ` (${session.event_dates.length}-day event)`}
            </span>
          ) : session.session_date && (
            <span className="inline-flex items-center gap-1.5"><CalendarDays size={14} /> {new Date(session.session_date).toLocaleDateString('en-BD', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            })}</span>
          )}
          {session.location && <span className="inline-flex items-center gap-1.5"><MapPin size={14} /> {session.location}</span>}
        </div>

        {/* ── Registration CTA — smart Register / Dashboard toggle ── */}
        {session.is_upcoming && session.registration_enabled && (
          <div className="rounded-2xl border p-6 mb-8 flex items-center justify-between gap-4 flex-wrap"
            style={{ background: 'rgba(var(--blue-rgb), 0.06)', borderColor: 'rgba(var(--blue-rgb), 0.3)' }}>
            <div>
              <p className="font-bold text-base mb-1" style={{ color: 'var(--white)' }}>Registration is open</p>
              {session.registration_note && (
                <p className="text-sm" style={{ color: 'var(--muted)' }}>{session.registration_note}</p>
              )}
            </div>
            {/* Client component: checks localStorage and shows Register or Go to Dashboard */}
            <ActivityRegisterButton slug={session.slug} sessionId={session.id} />
          </div>
        )}

        {/* Always-visible dashboard link for returning participants */}
        {!session.registration_enabled && (
          <div className="mb-8">
            <Link href={`/activities/${session.slug}/dashboard`}
              className="inline-flex items-center gap-2 text-sm underline" style={{ color: 'var(--blue)' }}>
              Already registered? View your dashboard →
            </Link>
          </div>
        )}

        {session.description && (
          <div className="rounded-2xl border p-8 mb-8"
            style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            <p style={{ color: '#a0b4c8', lineHeight: 1.8 }}
              dangerouslySetInnerHTML={{ __html: renderMarkdown(session.description) }} />
          </div>
        )}

        {session.pdf_url && (
          <div className="rounded-2xl border overflow-hidden mb-8"
            style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <span className="font-bold text-sm flex items-center gap-2"
                style={{ fontFamily: "'Orbitron',sans-serif", color: 'var(--blue)' }}>
                <FileText size={15} /> Session Notes / PDF
              </span>
              <a href={session.pdf_url} target="_blank" rel="noopener noreferrer"
                className="text-xs px-3 py-1 rounded font-bold inline-flex items-center gap-1.5"
                style={{ background: 'rgba(var(--blue-rgb), 0.1)', color: 'var(--blue)' }}>
                <Download size={12} /> Download
              </a>
            </div>
            <PdfViewer url={session.pdf_url} />
          </div>
        )}

        {session.gallery_urls && session.gallery_urls.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold mb-5 flex items-center gap-2"
              style={{ fontFamily: "'Orbitron',sans-serif", color: 'var(--white)' }}>
              <Images size={18} /> Gallery
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {session.gallery_urls.map((url: string, i: number) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                  className="group overflow-hidden rounded-xl block">
                  <img src={url} alt={`Photo ${i + 1}`}
                    className="w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    style={{ height: '200px' }} />
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
