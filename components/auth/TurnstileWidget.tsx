'use client'
// Cloudflare Turnstile (free, privacy-friendly captcha). Renders the widget and
// reports the one-time token to the parent. Tokens are single-use: bump
// `resetSignal` after every failed submit to get a fresh one.
//
// If NEXT_PUBLIC_TURNSTILE_SITE_KEY is not set the widget renders nothing
// (fine for local dev; the server decides whether that is acceptable).

import { useEffect, useRef } from 'react'

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string
      reset: (id?: string) => void
      remove: (id?: string) => void
    }
  }
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ''

function loadScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.turnstile) return resolve()
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('turnstile load failed')))
      return
    }
    const s = document.createElement('script')
    s.src = SCRIPT_SRC
    s.async = true
    s.defer = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('turnstile load failed'))
    document.head.appendChild(s)
  })
}

export default function TurnstileWidget({
  onToken,
  resetSignal = 0,
}: {
  onToken: (token: string) => void
  resetSignal?: number
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const idRef = useRef<string | undefined>(undefined)
  const onTokenRef = useRef(onToken)
  onTokenRef.current = onToken

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return
    let cancelled = false
    loadScript()
      .then(() => {
        if (cancelled || !boxRef.current || !window.turnstile) return
        idRef.current = window.turnstile.render(boxRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          theme: 'dark',
          callback: (t: string) => onTokenRef.current(t),
          'expired-callback': () => onTokenRef.current(''),
          'error-callback': () => onTokenRef.current(''),
        })
      })
      .catch(() => onTokenRef.current(''))
    return () => {
      cancelled = true
      if (idRef.current && window.turnstile) window.turnstile.remove(idRef.current)
    }
  }, [])

  useEffect(() => {
    if (resetSignal > 0 && idRef.current && window.turnstile) {
      onTokenRef.current('')
      window.turnstile.reset(idRef.current)
    }
  }, [resetSignal])

  if (!TURNSTILE_SITE_KEY) return null
  return <div ref={boxRef} className="flex justify-center" />
}
