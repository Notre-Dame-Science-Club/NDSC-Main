import type { ReactNode } from 'react'

export type BadgeTone = 'success' | 'warning' | 'danger' | 'neutral' | 'info'

export interface BadgeProps {
  children: ReactNode
  tone?: BadgeTone
}

const toneStyle: Record<BadgeTone, React.CSSProperties> = {
  success: { background: 'rgba(46,204,113,0.12)', color: '#2ecc71', border: '1px solid rgba(46,204,113,0.3)' },
  warning: { background: 'rgba(255,193,7,0.12)', color: '#ffc107', border: '1px solid rgba(255,193,7,0.3)' },
  danger: { background: 'rgba(255,71,87,0.12)', color: '#ff4757', border: '1px solid rgba(255,71,87,0.3)' },
  info: { background: 'rgba(0,212,255,0.12)', color: 'var(--blue)', border: '1px solid rgba(0,212,255,0.3)' },
  neutral: { background: 'rgba(255,255,255,0.06)', color: 'var(--muted)', border: '1px solid var(--border)' },
}

/**
 * Small pill for the many status/enum fields across the schema —
 * `payment_status` (paid/pending/failed), `is_published`, `review_status`,
 * `is_active`, etc. Pick the tone yourself based on the value; this
 * component doesn't hardcode a status→tone mapping since that mapping
 * differs per field (e.g. "pending" is a warning for payments but neutral
 * for a draft publication).
 */
export default function Badge({ children, tone = 'neutral' }: BadgeProps) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
      style={toneStyle[tone]}
    >
      {children}
    </span>
  )
}
