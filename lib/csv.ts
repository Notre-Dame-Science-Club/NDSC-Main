// Tiny CSV serialization helper. Not RFC 4180-perfect, but handles the
// cases the platform actually needs: embedded commas, embedded quotes
// (escaped as ""), embedded newlines, and empty values. We don't need
// streaming — registration lists are small (low thousands at worst).

export type CsvCell = string | number | null | undefined

function escapeCell(v: CsvCell): string {
  if (v === null || v === undefined) return ''
  const s = typeof v === 'number' ? String(v) : String(v)
  // Quote when the value contains a comma, quote, or newline.
  if (/[",\r\n]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

export function rowsToCsv(headers: string[], rows: CsvCell[][]): string {
  const lines: string[] = []
  lines.push(headers.map(escapeCell).join(','))
  for (const row of rows) {
    lines.push(row.map(escapeCell).join(','))
  }
  return lines.join('\r\n')
}

/** Stable deduped column header list preserving first-seen order. */
export function dedupHeaders(headers: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const h of headers) {
    if (!h) continue
    if (seen.has(h)) continue
    seen.add(h)
    out.push(h)
  }
  return out
}
