// Demo mode (npm run demo): fake SIMs that "connect" after a moment and "send" instantly.
// Lets you click through the whole panel without linking a real WhatsApp number. Nothing is sent.
export function mockConnect(simId, authDir, h) {
  let open = false, closed = false
  const t1 = setTimeout(() => h.onQr('demo-qr-' + simId + '-' + Date.now()), 300)
  const t2 = setTimeout(() => { if (!closed) { open = true; h.onOpen({ phone: '88017' + String(Math.floor(Math.random() * 1e8)).padStart(8, '0') }) } }, 4000)
  const need = () => { if (!open) throw Object.assign(new Error('Connection Closed'), { output: { statusCode: 428 } }) }
  return {
    async exists(phone) { need(); return phone.endsWith('9') ? null : phone + '@s.whatsapp.net' },
    async send() { need(); await new Promise(r => setTimeout(r, 200)); if (process.env.DEMO_ERRORS === '1' && Math.random() < 0.1) throw new Error('rate-overlimit') },
    async setProfile() { need() },
    async logout() {}, close() { closed = true; clearTimeout(t1); clearTimeout(t2) },
  }
}
