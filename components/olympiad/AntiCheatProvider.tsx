'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { AlertTriangle, Clock } from 'lucide-react'

// Anti-cheat provider for olympiad form-graph question nodes.
//
// v1 enforces two things, both client-side best-effort:
//   1. A countdown timer. Initialized from `initialSeconds` (which the
//      caller resolved server-side: form_node.behavior.timer_override_minutes
//      || form_graph.settings.timer_minutes || 60). When it hits 0 we
//      invoke `onExpire` — typically the runner's submit handler.
//   2. No copy / no paste / no context menu. We block oncopy, oncut,
//      onpaste, oncontextmenu via document listeners while mounted.
//      We also block keyboard shortcuts that are commonly used to copy
//      answers out (Ctrl/Cmd+C/X/V/P, PrintScreen, F12, Ctrl+Shift+I/J/C).
//      These are best-effort — a determined user can disable JS — but
//      combined with the dashboard re-grading on submit they're a
//      reasonable v1 deterrent.
//
// v1 deliberately does NOT enforce: fullscreen, screenshot blocking,
// devtools detection, blur/visibility loss. The user explicitly chose
// to defer those for a later version.

export type AntiCheatProviderProps = {
  initialSeconds: number
  // Called when the timer hits 0. The runner should submit whatever
  // answers the user has so far.
  onExpire: () => void
  // Optional: called every second so the runner can render its own
  // timer display (e.g. as part of a header).
  onTick?: (secondsRemaining: number) => void
  // Children rendered inside the protected area.
  children: React.ReactNode
}

const BLOCKED_KEYS = new Set([
  'F12',
  'PrintScreen',
])

function isBlockedShortcut(e: KeyboardEvent): boolean {
  const k = (e.key || '').toLowerCase()
  const ctrl = e.ctrlKey || e.metaKey
  // Common copy/paste/print/screenshot combos.
  if (ctrl && (k === 'c' || k === 'x' || k === 'v' || k === 'p' || k === 's' || k === 'u' || k === 'a')) return true
  // Devtools.
  if (ctrl && e.shiftKey && (k === 'i' || k === 'j' || k === 'c')) return true
  return false
}

export default function AntiCheatProvider({ initialSeconds, onExpire, onTick, children }: AntiCheatProviderProps) {
  const [secondsLeft, setSecondsLeft] = useState<number>(initialSeconds)
  const expiredRef = useRef(false)
  const onExpireRef = useRef(onExpire)
  onExpireRef.current = onExpire
  const onTickRef = useRef(onTick)
  onTickRef.current = onTick

  // Timer — started once on mount, ticks every second, fires onExpire at 0.
  useEffect(() => {
    if (!initialSeconds || initialSeconds <= 0) return
    const id = setInterval(() => {
      setSecondsLeft(prev => {
        const next = prev - 1
        onTickRef.current?.(next)
        if (next <= 0 && !expiredRef.current) {
          expiredRef.current = true
          // Fire after render so React state is consistent.
          setTimeout(() => onExpireRef.current?.(), 0)
        }
        return Math.max(0, next)
      })
    }, 1000)
    return () => clearInterval(id)
  }, [initialSeconds])

  // No-copy enforcement. We attach to `document` so it works regardless
  // of where the user clicks. We use capture phase to prevent the default
  // before the focused element gets the event.
  useEffect(() => {
    const block = (e: Event) => { e.preventDefault() }
    const blockKey = (e: KeyboardEvent) => {
      if (isBlockedShortcut(e) || BLOCKED_KEYS.has(e.key)) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    document.addEventListener('copy', block, true)
    document.addEventListener('cut', block, true)
    document.addEventListener('paste', block, true)
    document.addEventListener('contextmenu', block, true)
    document.addEventListener('keydown', blockKey, true)
    return () => {
      document.removeEventListener('copy', block, true)
      document.removeEventListener('cut', block, true)
      document.removeEventListener('paste', block, true)
      document.removeEventListener('contextmenu', block, true)
      document.removeEventListener('keydown', blockKey, true)
    }
  }, [])

  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60
  const lowTime = secondsLeft <= 60
  const dangerouslyLow = secondsLeft <= 10

  return (
    <div>
      {/* Sticky header with the timer — the user can always see how
          much time they have left, and a warning banner when it's low. */}
      <div className="sticky top-0 z-10 mb-4">
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg"
          style={{
            background: dangerouslyLow ? 'rgba(var(--danger-rgb), 0.15)' : (lowTime ? 'rgba(var(--warning-rgb), 0.15)' : 'var(--surface)'),
            border: `1px solid ${dangerouslyLow ? 'var(--danger-soft)' : (lowTime ? 'var(--warning)' : 'var(--border)')}`,
            color: dangerouslyLow ? 'var(--danger-soft)' : (lowTime ? 'var(--warning)' : 'var(--white)'),
          }}>
          <div className="flex items-center gap-2 text-xs font-bold">
            <Clock size={14} />
            <span>Exam timer</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-lg font-bold tabular-nums">
              {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
            </span>
          </div>
        </div>
        {dangerouslyLow && (
          <p className="text-xs mt-1.5 px-2 flex items-center gap-1" style={{ color: 'var(--danger-soft)' }}>
            <AlertTriangle size={11} /> Less than 10 seconds left — your answers will be submitted automatically.
          </p>
        )}
      </div>
      {children}
    </div>
  )
}
