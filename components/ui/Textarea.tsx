import type { TextareaHTMLAttributes } from 'react'

export type TextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'> & {
  className?: string
}

/** Textarea sibling of Input.tsx — same visual language. */
export default function Textarea({ className = '', style, rows = 4, ...rest }: TextareaProps) {
  return (
    <textarea
      rows={rows}
      className={`w-full rounded-lg px-3 py-2 text-sm outline-none transition-colors resize-y ${className}`}
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid var(--border)',
        color: 'var(--white)',
        ...style,
      }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = 'var(--blue)'
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = 'var(--border)'
      }}
      {...rest}
    />
  )
}
