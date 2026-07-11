import type { ReactNode } from 'react'

export interface ErrorMessageProps {
  children: ReactNode
}

/**
 * Consolidates the `{error && <div className="mb-4 p-3 rounded-lg text-sm"
 * style={{ background: 'rgba(255,80,80,0.1)', color: '#ff7070', border:
 * '1px solid rgba(255,80,80,0.3)' }}>{error}</div>}` block duplicated
 * across app/admin/**\/page.tsx. Caller still owns the `{error && ...}`
 * conditional — this only renders the banner markup.
 */
export default function ErrorMessage({ children }: ErrorMessageProps) {
  return (
    <div
      className="mb-4 p-3 rounded-lg text-sm"
      style={{ background: 'rgba(255,80,80,0.1)', color: '#ff7070', border: '1px solid rgba(255,80,80,0.3)' }}
    >
      {children}
    </div>
  )
}
