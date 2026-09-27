'use client'
import { useEffect, useState } from 'react'

let katexModule: Promise<any> | null = null
function loadKatex() {
  if (!katexModule) katexModule = import('katex').then(m => (m as any).default || m)
  return katexModule
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Renders text that may contain inline `$...$` or block `$$...$$` LaTeX
 * math (as produced by the equation keyboard, or typed by hand) using
 * KaTeX. Falls back to plain text instantly and swaps in rendered math
 * once the library loads, so there's no layout jump for the common case
 * of plain (non-math) question text.
 */
export default function MathText({ text, className, style, as = 'span' }: {
  text?: string | null
  className?: string
  style?: React.CSSProperties
  as?: 'span' | 'div'
}) {
  const [html, setHtml] = useState<string | null>(null)
  const safeText = text ?? ''

  useEffect(() => {
    let cancelled = false
    if (!safeText || !safeText.includes('$')) { setHtml(null); return }
    loadKatex()
      .then(katex => {
        if (cancelled) return
        const parts = safeText.split(/(\$\$[^$]+\$\$|\$[^$]+\$)/g)
        const rendered = parts
          .map(part => {
            const isBlock = part.startsWith('$$') && part.endsWith('$$') && part.length > 3
            const isInline = !isBlock && part.startsWith('$') && part.endsWith('$') && part.length > 1
            if (isBlock || isInline) {
              const expr = part.slice(isBlock ? 2 : 1, part.length - (isBlock ? 2 : 1))
              try {
                return katex.renderToString(expr, { throwOnError: false, displayMode: isBlock })
              } catch {
                return escapeHtml(part)
              }
            }
            return escapeHtml(part)
          })
          .join('')
        setHtml(rendered)
      })
      .catch(() => setHtml(null))
    return () => { cancelled = true }
  }, [safeText])

  const Tag = as
  if (html == null) return <Tag className={className} style={style}>{safeText}</Tag>
  // eslint-disable-next-line react/no-danger
  return <Tag className={className} style={style} dangerouslySetInnerHTML={{ __html: html }} />
}
