// Loud, hard-to-miss server log lines for things an operator must notice (email delivery down,
// possible abuse...). Written with console.error so hosts like Vercel tag them as errors (red),
// and wrapped in a banner + ANSI colour so they also stand out in a terminal.
//
// Never pass secrets, tokens, passwords or full email addresses: use maskEmail() for addresses.

const BAR = '!'.repeat(78)

/** a***@gmail.com - enough to recognise, not enough to harvest. */
export function maskEmail(email: string): string {
  const at = String(email || '').lastIndexOf('@')
  if (at < 1) return '***'
  return `${email.slice(0, 1)}***${email.slice(at)}`
}

/** Trims and flattens an error/detail into one short, log-safe string. */
function brief(detail: unknown): string {
  const raw = detail instanceof Error ? detail.message : typeof detail === 'string' ? detail : JSON.stringify(detail ?? '')
  return String(raw).replace(/\s+/g, ' ').slice(0, 500)
}

export function serverAlert(tag: string, message: string, detail?: unknown): void {
  const badge = `\x1b[1;97;41m 🚨 ${tag} \x1b[0m`
  const lines = [`\n${BAR}`, `${badge} \x1b[1;31m${message}\x1b[0m`]
  if (detail !== undefined && detail !== '') lines.push(`   detail: ${brief(detail)}`)
  lines.push(`${BAR}\n`)
  console.error(lines.join('\n'))
}
