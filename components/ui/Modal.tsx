'use client'

import { useEffect } from 'react'
import type { ReactNode } from 'react'

export interface ModalProps {
  title: string
  onClose: () => void
  children: ReactNode
  maxWidth?: string
}

/**
 * Consolidates the local `Modal` component redefined in
 * app/admin/activities/page.tsx and similar pages: dark overlay,
 * click-outside-to-close, centered card. Adds Escape-to-close, which none
 * of the originals had.
 */
export default function Modal({ title, onClose, children, maxWidth = '32rem' }: ModalProps) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.8)' }}
      onClick={onClose}
    >
      <div
        className="w-full rounded-2xl p-6 max-h-[90vh] overflow-y-auto"
        style={{ background: 'var(--card)', border: '1px solid var(--border)', maxWidth }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 style={{ fontFamily: "'Orbitron',sans-serif", color: 'var(--blue)', fontSize: 16 }}>
            {title}
          </h3>
          <button
            onClick={onClose}
            style={{ color: 'var(--muted)', fontSize: 20 }}
            className="hover:text-white"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
