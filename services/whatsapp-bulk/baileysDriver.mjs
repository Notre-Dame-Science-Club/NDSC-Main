// Real WhatsApp connection for one SIM, using Baileys (multi-device "Linked devices" login).
// Matches the `connect(simId, authDir, handlers)` contract the Engine expects.

import makeWASocket, {
  useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, jidNormalizedUser, Browsers,
} from '@whiskeysockets/baileys'
import pino from 'pino'

const CAPTION_LIMIT = 1000 // WhatsApp captions are capped at 1024 characters
const MAX_QR_CYCLES = 4 // stop re-issuing QR codes if nobody scans

export function baileysConnect(simId, authDir, h) {
  let sock = null
  let closed = false
  let retries = 0
  let qrCycles = 0
  let version

  async function start() {
    if (closed) return
    const { state, saveCreds } = await useMultiFileAuthState(authDir)
    if (!version) { try { ({ version } = await fetchLatestBaileysVersion()) } catch { /* use the bundled default */ } }
    const s = sock = makeWASocket({
      version, auth: state, logger: pino({ level: 'silent' }),
      browser: Browsers.macOS('Desktop'), markOnlineOnConnect: false, syncFullHistory: false,
    })
    s.ev.on('creds.update', saveCreds)
    s.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
      if (s !== sock || closed) return
      if (qr) {
        if (++qrCycles > MAX_QR_CYCLES) {
          closed = true
          try { s.end(undefined) } catch { /* ignore */ }
          h.onClose({ gaveUp: true, message: 'QR code expired without being scanned. Press Connect to try again.' })
          return
        }
        h.onQr(qr)
      }
      if (connection === 'open') {
        retries = 0; qrCycles = 0
        const id = s.user?.id || ''
        h.onOpen({ phone: id.split(':')[0].split('@')[0], name: s.user?.name })
      }
      if (connection === 'close') {
        const code = lastDisconnect?.error?.output?.statusCode
        if (code === DisconnectReason.loggedOut) {
          closed = true
          h.onClose({ loggedOut: true, message: 'This number was logged out (removed from Linked devices on the phone). Scan the QR again.' })
          return
        }
        h.onClose({ loggedOut: false, code, message: lastDisconnect?.error?.message || 'Connection closed' })
        // restartRequired (515) happens right after the first QR scan and must reconnect straight away
        setTimeout(() => start().catch(e => h.onClose({ message: e.message })), code === DisconnectReason.restartRequired ? 300 : Math.min(30000, 2000 * ++retries))
      }
    })
  }
  start().catch(e => h.onClose({ message: e.message }))

  const live = () => {
    if (!sock?.user) throw Object.assign(new Error('Connection closed: SIM is not connected'), { output: { statusCode: 428 } })
    return sock
  }

  return {
    async exists(phone) {
      const [r] = (await live().onWhatsApp(`${phone}@s.whatsapp.net`)) || []
      return r?.exists ? r.jid : null
    },
    async send(jid, { text, image }) {
      const s = live()
      if (image && text.length <= CAPTION_LIMIT) return s.sendMessage(jid, { image, caption: text })
      if (image) await s.sendMessage(jid, { image }) // text too long for a caption: logo first, then the text
      return s.sendMessage(jid, { text })
    },
    async setProfile({ name, picture }) {
      const s = live()
      if (name) await s.updateProfileName(name)
      if (picture) await s.updateProfilePicture(jidNormalizedUser(s.user.id), picture)
    },
    async logout() { await sock?.logout() },
    close() { closed = true; try { sock?.end(undefined) } catch { /* ignore */ } },
  }
}
