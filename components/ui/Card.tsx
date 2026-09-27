import type { HTMLAttributes, ReactNode } from 'react'

export type CardPadding = 'none' | 'sm' | 'md'

export interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'className'> {
  children: ReactNode
  padding?: CardPadding
  /** Use the tighter `rounded-xl` radius (table/list wrappers) instead of the default `rounded-2xl` (dialogs, standalone panels). */
  rounded?: 'lg' | 'xl'
  className?: string
}

const paddingCls: Record<CardPadding, string> = {
  none: '',
  sm: 'p-4',
  md: 'p-5',
}

const roundedCls: Record<NonNullable<CardProps['rounded']>, string> = {
  lg: 'rounded-xl',
  xl: 'rounded-2xl',
}

/**
 * Consolidates the `rounded-xl border ...` / `rounded-2xl border p-6 ...`
 * panel wrapper redefined inline (as a local `style={s}` object, usually
 * `{ background: 'var(--card)', border: '1px solid var(--border)' }`)
 * throughout app/admin/**\/page.tsx — table wrappers, achievement rows,
 * confirm dialogs, form sections all use this same shell.
 */
export default function Card({
  children,
  padding = 'md',
  rounded = 'lg',
  className = '',
  style,
  ...rest
}: CardProps) {
  return (
    <div
      className={`${roundedCls[rounded]} border ${paddingCls[padding]} ${className}`}
      style={{ background: 'var(--card)', border: '1px solid var(--border)', ...style }}
      {...rest}
    >
      {children}
    </div>
  )
}
