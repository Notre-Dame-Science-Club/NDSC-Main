'use client'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { X, Megaphone, ArrowRight } from 'lucide-react'
import SurveyForm from './SurveyForm'

type ActiveSurvey = {
  id: string
  title: string
  description?: string
  cover_image_url?: string
  show_notification: boolean
  notification_title?: string
  notification_message?: string
  question_count: number
}

const DISMISSED_KEY = 'ndsc-survey-dismissed'
const ANSWERED_KEY = 'ndsc-survey-answered'

function readIdSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key)
    return new Set(raw ? JSON.parse(raw) : [])
  } catch {
    return new Set()
  }
}
function addToIdSet(key: string, id: string) {
  try {
    const set = readIdSet(key)
    set.add(id)
    localStorage.setItem(key, JSON.stringify(Array.from(set)))
  } catch { /* localStorage unavailable — non-critical, just means it may re-prompt */ }
}

/**
 * Mounted once in the root layout. Because the root layout persists across
 * client-side navigations in the App Router (only `children` swaps), this
 * effect runs once per actual site visit / hard reload — matching "pop on
 * website visit", not "pop on every internal link click".
 */
export default function SurveyNotification() {
  const pathname = usePathname()
  const [survey, setSurvey] = useState<ActiveSurvey | null>(null)
  const [visible, setVisible] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const onAdminRoute = pathname?.startsWith('/admin')

  useEffect(() => {
    if (onAdminRoute) return
    let cancelled = false
    ;(async () => {
      let token: string | null = null
      try {
        const { supabase } = await import('@/lib/supabase')
        const { data } = await supabase.auth.getSession()
        token = data.session?.access_token || null
      } catch { /* not logged in / supabase unavailable */ }

      try {
        const res = await fetch('/api/survey-active', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        if (!res.ok || cancelled) return
        const surveys: ActiveSurvey[] = await res.json()

        const dismissed = readIdSet(DISMISSED_KEY)
        const answered = readIdSet(ANSWERED_KEY)
        const next = surveys.find(s => s.show_notification && !dismissed.has(s.id) && !answered.has(s.id))
        if (next && !cancelled) {
          setSurvey(next)
          // Small delay so it slides in after the page has settled, rather
          // than fighting for attention the instant the page paints.
          setTimeout(() => setVisible(true), 900)
        }
      } catch { /* silent — a failed notification check shouldn't disrupt browsing */ }
    })()
    return () => { cancelled = true }
  }, [onAdminRoute])

  const dismiss = () => {
    if (survey) addToIdSet(DISMISSED_KEY, survey.id)
    setVisible(false)
    setTimeout(() => { setSurvey(null); setExpanded(false) }, 300)
  }

  const handleSubmitted = () => {
    if (survey) addToIdSet(ANSWERED_KEY, survey.id)
    setTimeout(dismiss, 1400)
  }

  if (!survey) return null

  return (
    <>
      {/* Compact prompt card, bottom-right (bottom sheet on mobile) */}
      {!expanded && (
        <div
          className="fixed z-[70] left-4 right-4 bottom-4 sm:left-auto sm:right-6 sm:bottom-6 sm:w-96 transition-all duration-300 ease-out"
          style={{
            transform: visible ? 'translateY(0)' : 'translateY(24px)',
            opacity: visible ? 1 : 0,
            pointerEvents: visible ? 'auto' : 'none',
          }}
        >
          <div
            className="rounded-2xl border p-4 shadow-2xl backdrop-blur-xl"
            style={{ background: 'rgba(10, 22, 40, 0.92)', borderColor: 'var(--border)', boxShadow: '0 8px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(0,212,255,0.08)' }}
          >
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(var(--blue-rgb), 0.15)', color: 'var(--blue)' }}>
                <Megaphone size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm" style={{ color: 'var(--white)', fontFamily: "'Orbitron', sans-serif" }}>
                  {survey.notification_title || survey.title}
                </p>
                <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--muted)' }}>
                  {survey.notification_message || survey.description || `${survey.question_count} quick question${survey.question_count === 1 ? '' : 's'} — we\u2019d love your input.`}
                </p>
              </div>
              <button onClick={dismiss} className="flex-shrink-0 opacity-60 hover:opacity-100" style={{ color: 'var(--muted)' }} aria-label="Dismiss">
                <X size={15} />
              </button>
            </div>
            <button onClick={() => setExpanded(true)}
              className="mt-3 w-full py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5"
              style={{ background: 'var(--blue)', color: '#000', fontFamily: "'Orbitron', sans-serif" }}>
              ANSWER NOW <ArrowRight size={13} />
            </button>
          </div>
        </div>
      )}

      {/* Expanded modal with the full survey form */}
      {expanded && (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{ background: 'rgba(2,8,16,0.85)' }} onClick={dismiss}>
          <div
            className="w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border p-6"
            style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-end mb-1">
              <button onClick={dismiss} style={{ color: 'var(--muted)' }} aria-label="Close"><X size={18} /></button>
            </div>
            <SurveyForm surveyId={survey.id} compact onSubmitted={handleSubmitted} />
          </div>
        </div>
      )}
    </>
  )
}
