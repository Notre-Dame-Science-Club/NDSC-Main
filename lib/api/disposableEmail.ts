// Well-known throwaway-mail domains plus obvious typo domains. Best-effort only: this is a
// speed bump for signup abuse, not a guarantee (new disposable domains appear constantly).
const DISPOSABLE_DOMAINS = new Set<string>([
  'mailinator.com', 'guerrillamail.com', 'guerrillamail.net',
  'guerrillamail.org', 'guerrillamail.biz', 'guerrillamailblock.com',
  '10minutemail.com', '10minutemail.net', 'tempmail.com',
  'temp-mail.org', 'temp-mail.io', 'tempmail.net',
  'tempmailo.com', 'yopmail.com', 'yopmail.net',
  'yopmail.fr', 'trashmail.com', 'trashmail.net',
  'trashmail.de', 'sharklasers.com', 'grr.la',
  'getnada.com', 'nada.email', 'throwawaymail.com',
  'maildrop.cc', 'dispostable.com', 'fakeinbox.com',
  'mohmal.com', 'emailondeck.com', 'mintemail.com',
  'mailnesia.com', 'mytemp.email', 'tempinbox.com',
  'spamgourmet.com', 'getairmail.com', 'moakt.com',
  'mailcatch.com', 'meltmail.com', 'spambox.us',
  'burnermail.io', 'discard.email', 'discardmail.com',
  'mailtemp.info', 'tmpmail.org', 'tmpmail.net',
  'inboxkitten.com', 'emailfake.com', 'fakemail.net',
  'tempr.email', 'dropmail.me', 'harakirimail.com',
  'jetable.org', 'mailforspam.com',
])

const TYPO_DOMAINS = new Set<string>([
  'gmail.coml', 'gamil.com', 'gmial.com',
  'gmai.com', 'gmail.con',
])

export function isDisposableEmail(email: string): boolean {
  const at = String(email || '').lastIndexOf('@')
  if (at < 0) return false
  const domain = email.slice(at + 1).trim().toLowerCase()
  return DISPOSABLE_DOMAINS.has(domain) || TYPO_DOMAINS.has(domain)
}
