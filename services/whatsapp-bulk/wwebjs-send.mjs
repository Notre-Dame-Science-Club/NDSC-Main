// whatsapp-web.js version. Run: npm run wwebjs
import pkg from "whatsapp-web.js";
import qrcode from "qrcode-terminal";
import { cfg, runBatch } from "./common.mjs";

const { Client, LocalAuth, MessageMedia } = pkg;

if (cfg.dry) {
  await runBatch({});
  process.exit(0);
}

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: cfg.authDir }), // session saved, QR only needed once
  puppeteer: { headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] },
});

client.on("qr", (qr) => {
  console.log("Scan this QR: WhatsApp > Settings > Linked devices > Link a device");
  qrcode.generate(qr, { small: true });
});

client.on("ready", async () => {
  console.log("Connected.");
  const media = cfg.logo ? MessageMedia.fromFilePath(cfg.logo) : null;
  await runBatch({
    resolveId: async (phone) => (await client.getNumberId(phone))?._serialized ?? null,
    send: (id, text) =>
      media
        ? client.sendMessage(id, media, { caption: text, sendSeen: false })
        : client.sendMessage(id, text, { sendSeen: false }),
  });
  await client.destroy();
  process.exit(0);
});

client.on("auth_failure", (m) => console.error("Auth failure:", m));
client.initialize();
