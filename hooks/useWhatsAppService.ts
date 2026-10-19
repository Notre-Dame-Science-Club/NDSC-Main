'use client'
import { useCallback, useEffect, useRef, useState } from 'react'

// Tracks whether the WhatsApp sender service is awake. A sleeping Render service takes
// roughly a minute to start, so we ping it, show "waking up" with a timer, and re-ping
// every few seconds until it answers. After GIVE_UP_AFTER_S it reports 'down' (with a
// manual retry) but keeps trying slowly in case it is just very slow.
//   unknown → first check running · awake · waking · down · unconfigured

export type ServiceState = 'unknown' | 'awake' | 'waking' | 'down' | 'unconfigured'
const GIVE_UP_AFTER_S = 150

export function useWhatsAppService(enabled = true) {
  const [state, setState] = useState<ServiceState>('unknown')
  const [elapsed, setElapsed] = useState(0)
  const since = useRef<number | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const alive = useRef(true)

  const check = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current)
    let next: ServiceState = 'waking'
    try {
      const r = await fetch('/api/admin/whatsapp-wake', { cache: 'no-store' })
      const j = await r.json().catch(() => ({}))
      next = r.ok && j.state ? j.state : 'waking'
    } catch { next = 'waking' }
    if (!alive.current) return

    if (next === 'awake' || next === 'unconfigured') { since.current = null; setElapsed(0); setState(next); return }
    if (since.current === null) since.current = Date.now()
    const secs = Math.round((Date.now() - since.current) / 1000)
    setElapsed(secs)
    setState(secs > GIVE_UP_AFTER_S ? 'down' : 'waking')
    timer.current = setTimeout(check, secs > GIVE_UP_AFTER_S ? 15_000 : 3_000)
  }, [])

  useEffect(() => {
    alive.current = true
    if (enabled) check()
    return () => { alive.current = false; if (timer.current) clearTimeout(timer.current) }
  }, [enabled, check])

  // Live seconds counter between checks.
  useEffect(() => {
    if (state !== 'waking' && state !== 'down') return
    const t = setInterval(() => { if (since.current) setElapsed(Math.round((Date.now() - since.current) / 1000)) }, 1000)
    return () => clearInterval(t)
  }, [state])

  const retry = useCallback(() => { since.current = null; setElapsed(0); setState('waking'); check() }, [check])
  return { state, elapsed, retry }
}
