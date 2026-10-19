'use client'
import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Download, ExternalLink, Loader2, ShieldAlert } from 'lucide-react'
import { supabase } from '@/lib/supabase'

// The recipient-facing side of the certificates system (see the build
// spec). Logged-out visitors are bounced to /login?redirect=this-page and
// come straight back; logged-in visitors get a silent eligibility check
// against /api/certificate/[slug]/me, and either their certificate opens
// inline or they see one honest, narrow "not on the list" message.
//
// The PDF is embedded directly via an <iframe src={downloadUrl}> rather
// than the app's shared Google-Docs-proxy PdfViewer: the download URL
// carries a signed token that expires in ~2 minutes, and routing it
// through an external proxy adds latency and a second fetch that could
// outlive the token. A native iframe renders it immediately, and modern
// browsers show a PDF inline without any viewer library.

type EligibilityState =
  | { status: 'loading' }
  | { status: 'need_login' }
  | { status: 'not_found' }
  | { status: 'inactive'; certificateTitle: string }
  | { status: 'not_ready'; certificateTitle: string }
  | { status: 'not_on_list'; certificateTitle: string }
  | { status: 'eligible'; certificateTitle: string; fullName: string; downloadUrl: string }
  | { status: 'error'; message: string }

export default function CertificatePage() {
  const params = useParams<{ slug: string }>()
  const router = useRouter()
  const slug = params.slug
  const [state, setState] = useState<EligibilityState>({ status: 'loading' })
  const [actionPending, setActionPending] = useState<'open' | 'download' | null>(null)
  const retriedExpiredToken = useRef(false)

  // Shared with checkEligibility's happy path, but returns the fresh URL
  // directly instead of going through setState — used by the "Open in
  // new tab" / "Download" buttons so a click that comes in after the
  // ~2 minute token has gone stale (the page sat open while the visitor
  // read the details) still gets a working link instead of a dead one.
  const fetchFreshDownloadUrl = async (): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return null
    try {
      const res = await fetch(`/api/certificate/${encodeURIComponent(slug)}/me`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.eligible) return null
      return data.downloadUrl as string
    } catch {
      return null
    }
  }

  const checkEligibility = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setState({ status: 'need_login' })
      return
    }

    try {
      const res = await fetch(`/api/certificate/${encodeURIComponent(slug)}/me`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const data = await res.json().catch(() => null)

      if (res.status === 401) {
        setState({ status: 'need_login' })
        return
      }
      if (!res.ok || !data) {
        setState({ status: 'error', message: data?.error || 'Something went wrong.' })
        return
      }

      if (!data.eligible) {
        if (data.status === 'not_found') setState({ status: 'not_found' })
        else if (data.status === 'inactive') setState({ status: 'inactive', certificateTitle: data.certificateTitle })
        else if (data.status === 'not_ready') setState({ status: 'not_ready', certificateTitle: data.certificateTitle })
        else setState({ status: 'not_on_list', certificateTitle: data.certificateTitle || '' })
        return
      }

      setState({
        status: 'eligible',
        certificateTitle: data.certificateTitle,
        fullName: data.full_name,
        downloadUrl: data.downloadUrl,
      })
    } catch {
      setState({ status: 'error', message: 'Network error. Please try again.' })
    }
  }

  useEffect(() => {
    if (!slug) return
    checkEligibility()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  // If the ~2 minute download token expired while the tab sat open, the
  // iframe's request comes back as an error. Silently mint a fresh one
  // instead of showing a dead-end error page, once, so this can't loop.
  const handleIframeError = () => {
    if (retriedExpiredToken.current) return
    retriedExpiredToken.current = true
    checkEligibility()
  }

  const goToLogin = () => {
    router.push(`/login?redirect=${encodeURIComponent(`/certificate/${slug}`)}`)
  }

  const handleOpenNewTab = async () => {
    if (actionPending) return
    setActionPending('open')
    // Open the tab synchronously, as part of this click, so popup
    // blockers don't treat it as an unsolicited window — then point it
    // at the freshly-minted URL once that fetch resolves.
    const win = window.open('', '_blank')
    const url = await fetchFreshDownloadUrl()
    if (url && win) {
      win.location.href = url
    } else {
      win?.close()
      checkEligibility() // reflect whatever changed (session/eligibility) in the page itself
    }
    setActionPending(null)
  }

  const handleDownload = async () => {
    if (actionPending) return
    setActionPending('download')
    const url = await fetchFreshDownloadUrl()
    if (url) {
      const a = document.createElement('a')
      a.href = url
      a.download = ''
      document.body.appendChild(a)
      a.click()
      a.remove()
    } else {
      checkEligibility()
    }
    setActionPending(null)
  }

  return (
    <div className="min-h-screen py-12 px-4" style={{ background: 'var(--bg)' }}>
      <div className="max-w-4xl mx-auto">
        {state.status === 'loading' && (
          <Centered>
            <Loader2 size={28} className="animate-spin" style={{ color: 'var(--blue)' }} />
            <p className="mt-3 text-sm" style={{ color: 'var(--muted)' }}>Checking your certificate…</p>
          </Centered>
        )}

        {state.status === 'need_login' && (
          <Centered>
            <ShieldAlert size={28} style={{ color: 'var(--blue)' }} />
            <h1 className="mt-3 text-lg font-bold" style={{ color: 'var(--white)' }}>Please log in</h1>
            <p className="mt-1 text-sm text-center max-w-sm" style={{ color: 'var(--muted)' }}>
              Log in with the account whose email is on this certificate&apos;s recipient list to view it.
            </p>
            <button
              onClick={goToLogin}
              className="btn-primary mt-5 px-5 py-2.5 rounded-lg font-semibold text-sm"
            >
              Log In
            </button>
          </Centered>
        )}

        {state.status === 'not_found' && (
          <Centered>
            <h1 className="text-lg font-bold" style={{ color: 'var(--white)' }}>Certificate not found</h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>This link doesn&apos;t match any certificate.</p>
          </Centered>
        )}

        {state.status === 'inactive' && (
          <Centered>
            <h1 className="text-lg font-bold" style={{ color: 'var(--white)' }}>{state.certificateTitle}</h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>This certificate is no longer available.</p>
          </Centered>
        )}

        {state.status === 'not_ready' && (
          <Centered>
            <h1 className="text-lg font-bold" style={{ color: 'var(--white)' }}>{state.certificateTitle}</h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>This certificate isn&apos;t ready yet. Please check back later.</p>
          </Centered>
        )}

        {state.status === 'not_on_list' && (
          <Centered>
            <h1 className="text-lg font-bold" style={{ color: 'var(--white)' }}>
              {state.certificateTitle || 'Certificate'}
            </h1>
            <p className="mt-2 text-sm text-center max-w-md" style={{ color: 'var(--muted)' }}>
              You&apos;re not on the recipient list for this certificate. If you think this is a mistake, contact the organizer.
            </p>
          </Centered>
        )}

        {state.status === 'error' && (
          <Centered>
            <h1 className="text-lg font-bold" style={{ color: 'var(--danger)' }}>Something went wrong</h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>{state.message}</p>
          </Centered>
        )}

        {state.status === 'eligible' && (
          <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between gap-4 px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <div>
                <h1 className="text-lg font-bold" style={{ color: 'var(--white)' }}>{state.certificateTitle}</h1>
                <p className="text-sm" style={{ color: 'var(--muted)' }}>{state.fullName}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleOpenNewTab}
                  disabled={actionPending !== null}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold disabled:opacity-50"
                  style={{ background: 'rgba(var(--blue-rgb), 0.1)', color: 'var(--blue)', border: '1px solid rgba(var(--blue-rgb), 0.3)' }}
                >
                  <ExternalLink size={13} /> Open in new tab
                </button>
                <button
                  onClick={handleDownload}
                  disabled={actionPending !== null}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold disabled:opacity-50"
                  style={{ background: 'var(--blue)', color: '#000' }}
                >
                  <Download size={13} /> Download
                </button>
              </div>
            </div>
            <iframe
              key={state.downloadUrl}
              src={state.downloadUrl}
              onError={handleIframeError}
              title={state.certificateTitle}
              className="w-full"
              style={{ height: '80vh', border: 'none', background: '#fff' }}
            />
          </div>
        )}
      </div>
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 rounded-2xl border" style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}>
      {children}
    </div>
  )
}
