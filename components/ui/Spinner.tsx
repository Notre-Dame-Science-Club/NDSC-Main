export interface SpinnerProps {
  size?: number
  label?: string
}

/** Simple spin-animated ring, using the `animate-spin-slow` sped up via inline style override isn't needed — uses Tailwind's built-in `animate-spin`. */
export default function Spinner({ size = 20, label }: SpinnerProps) {
  return (
    <span className="inline-flex items-center gap-2" role="status" aria-live="polite">
      <span
        className="inline-block rounded-full animate-spin"
        style={{
          width: size,
          height: size,
          border: '2px solid var(--border)',
          borderTopColor: 'var(--blue)',
        }}
      />
      {label && (
        <span className="text-xs" style={{ color: 'var(--muted)' }}>
          {label}
        </span>
      )}
    </span>
  )
}
