'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, ChevronRight, Loader2 } from 'lucide-react'

// Surfaces the user's existing enrollment in this event above the segment
// list. If they're enrolled in one or more segments of this event, show a
// strip with the segment name(s) and a "Open dashboard" link. Other segments
// remain open for additional enrollments.
//
// Storage model:
//   new: localStorage 'ndsc_seg_<sessionId>' = { [segmentId]: registrationId }
//   legacy: localStorage 'ndsc_reg_<sessionId>' = registrationId
export default function MyRegistrationStrip({ slug, sessionId, segments }: { slug: string; sessionId: string; segments: { id: string; name: string }[] }) {
  const [enrolled, setEnrolled] = useState<{ segmentId: string; name: string; regId: string }[] | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`ndsc_seg_${sessionId}`)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed && typeof parsed === 'object') {
          const list = Object.entries(parsed)
            .filter(([, v]) => v)
            .map(([segId, regId]) => ({
              segmentId: segId,
              regId: regId as string,
              name: segments.find(s => s.id === segId)?.name || 'Registration',
            }))
          setEnrolled(list)
          setLoaded(true)
          return
        }
      }
    } catch { /* ignore */ }
    // Legacy fallback
    const regId = localStorage.getItem(`ndsc_reg_${sessionId}`) || localStorage.getItem('ndsc_activity_reg_id')
    if (regId) {
      setEnrolled([{ segmentId: '__legacy__', name: 'Your registration', regId }])
    } else {
      setEnrolled([])
    }
    setLoaded(true)
  }, [sessionId, segments])

  if (!loaded || !enrolled || enrolled.length === 0) return null

  return (
    <div className="rounded-2xl border p-5 mb-6" style={{ background: 'rgba(var(--cat-teal-rgb), 0.06)', borderColor: 'rgba(var(--cat-teal-rgb), 0.4)' }}>
      <div className="flex items-center gap-2 mb-2">
        <CheckCircle2 size={16} style={{ color: 'var(--cat-teal)' }} />
        <p className="text-sm font-bold" style={{ color: 'var(--white)' }}>
          You're registered in {enrolled.length === 1 ? enrolled[0].name : `${enrolled.length} segments`}
        </p>
      </div>
      {enrolled.length > 1 && (
        <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>
          {enrolled.map(e => e.name).join(' · ')}
        </p>
      )}
      <Link
        href={`/activities/${slug}/dashboard`}
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold"
        style={{ background: 'var(--cat-teal)', color: '#000' }}
      >
        Open dashboard <ChevronRight size={13} />
      </Link>
    </div>
  )
}
