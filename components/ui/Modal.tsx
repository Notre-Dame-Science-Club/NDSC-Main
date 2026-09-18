'use client'

import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'

export interface ModalProps {
  title: string
  onClose: () => void
  children: ReactNode
  maxWidth?: string
}

/**
 * Consolidates the local `Modal` component redefined in
 * app/admin/activities/page.tsx and similar pages: dark overlay,
 * click-outside-to-close, centered card. Adds Escape-to-close, focus trap,
 * body scroll lock, and restores focus to the trigger on close — none of
 * which the originals had.
 */
export default function Modal({ title, onClose, children, maxWidth = '32rem' }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)
  // Stash the latest onClose in a ref so the mount effect doesn't have to
  // depend on it. Otherwise, any parent that passes an inline
  // `onClose={() => setX(false)}` re-runs the effect every render — which
  // means body-scroll lock flicker and focus recapture on every keystroke.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    // Remember the trigger element so we can restore focus when the modal closes.
    previouslyFocused.current = document.activeElement as HTMLElement | null

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current()
        return
      }
      // Tab focus trap — cycle within the panel.
      if (e.key === 'Tab' && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        if (focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    // Lock body scroll while modal is open.
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)
    // Move focus into the panel on open.
    requestAnimationFrame(() => {
      const first = panelRef.current?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      first?.focus()
    })
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prevOverflow
      // Restore focus to whatever opened the modal. Guard with isConnected
      // because the trigger may have been removed from the DOM (e.g. list
      // item that opened an edit modal was deleted while the modal was up).
      const prev = previouslyFocused.current
      if (prev && document.contains(prev)) prev.focus()
    }
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      style={{ background: 'rgba(0,0,0,0.78)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ndsc-modal-title"
    >
      <div
        ref={panelRef}
        className="w-full rounded-2xl p-6 max-h-[90vh] overflow-y-auto"
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          maxWidth,
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(var(--blue-rgb), 0.06)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3
            id="ndsc-modal-title"
            style={{ fontFamily: "'Poppins', sans-serif", color: 'var(--white)', fontSize: 16, fontWeight: 700 }}
          >
            {title}
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded transition-colors hover:text-white"
            style={{ color: 'var(--muted)' }}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
