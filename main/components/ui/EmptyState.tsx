import type { ReactNode } from 'react'

export interface EmptyStateProps {
  message: string
  icon?: ReactNode
  action?: ReactNode
}

/**
 * Standalone empty state for pages/panels with no rows to show outside a
 * table (Table.tsx already has its own inline "No X found." row for the
 * in-table case — use that instead when you're inside a `<table>`).
 */
export default function EmptyState({ message, icon, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-12 text-center">
      {icon && (
        <span style={{ color: 'var(--muted)', opacity: 0.6 }} aria-hidden="true">
          {icon}
        </span>
      )}
      <p className="text-sm" style={{ color: 'var(--muted)' }}>
        {message}
      </p>
      {action}
    </div>
  )
}
