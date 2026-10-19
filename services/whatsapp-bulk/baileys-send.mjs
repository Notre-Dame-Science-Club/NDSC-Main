// Baileys version. Run: npm run baileys
import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from "@whiskeysockets/baileys";
import qrcode from "qrcode-terminal";
import pino from "pino";
import fs from "node:fs";
import { cfg, runBatch } from "./common.mjs";

if (cfg.dry) {
  await runBatch({});
  process.exit(0);
}

const logo = cfg.logo ? fs.readFileSync(cfg.logo) : null;
let running = false;

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState(cfg.authDir); // QR only needed once
  const { version } = await fetchLatestBaileysVersion();
  const sock = makeWASocket({ version, auth: state, logger: pino({ level: "silent" }) });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log("Scan this QR: WhatsApp > Settings > Linked devices > Link a device");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "open" && !running) {
      running = true;
      console.log("Connected.");
      await runBatch({
        resolveId: async (phone) => {
          const [r] = (await sock.onWhatsApp(`${phone}@s.whatsapp.net`)) || [];
          return r?.exists ? r.jid : null;
        },
        send: (id, text) => (logo ? sock.sendMessage(id, { image: logo, caption: text }) : sock.sendMessage(id, { text })),
      });
      process.exit(0);
    }

    if (connection === "close") {
      const code = lastDisconnect?.error?.output?.statusCode;
      if (code === DisconnectReason.loggedOut) {
        console.error(`Logged out. Delete ${cfg.authDir} and run again to re-scan the QR.`);
        process.exit(1);
      }
      if (!running) start(); // also needed once right after the first QR scan
    }
  });
}

start();
