// Shared config + sending loop used by both wwebjs-send.mjs and baileys-send.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const abs = (p) => (path.isAbsolute(p) ? p : path.join(root, p));
const env = process.env;

export const cfg = {
  contacts: abs(env.CONTACTS_FILE || "contacts.csv"),
  messageFile: abs(env.MESSAGE_FILE || "message.txt"),
  logo: env.LOGO_FILE ? abs(env.LOGO_FILE) : "",
  authDir: abs(env.AUTH_DIR || ".auth"),
  groupLink: env.GROUP_LINK || "",
  cc: env.DEFAULT_COUNTRY_CODE || "880",
  minDelay: Number(env.MIN_DELAY_MS || 8000),
  maxDelay: Number(env.MAX_DELAY_MS || 20000),
  maxPerRun: Number(env.MAX_PER_RUN || 0), // 0 = no limit
  dry: env.DRY_RUN === "true",
};

const sentLog = abs("sent.log"); // numbers already sent, so re-running is safe
const failedLog = abs("failed.csv");

if (cfg.logo && !fs.existsSync(cfg.logo)) {
  console.error(`LOGO_FILE not found: ${cfg.logo}  (put your logo there or clear LOGO_FILE)`);
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (a, b) => Math.floor(a + Math.random() * Math.max(0, b - a));

function normalizePhone(raw) {
  let d = String(raw).replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0")) d = cfg.cc + d.slice(1); // 01XXXXXXXXX -> 8801XXXXXXXXX
  return d;
}

function loadContacts() {
  const [header, ...rows] = fs.readFileSync(cfg.contacts, "utf8").split(/\r?\n/).filter(Boolean);
  const cols = header.split(",").map((c) => c.trim().toLowerCase());
  const pi = cols.indexOf("phone");
  const ni = cols.indexOf("name");
  if (pi === -1) throw new Error("contacts file needs a 'phone' column");
  const seen = new Set();
  return rows
    .map((r) => {
      const c = r.split(",");
      return { phone: normalizePhone(c[pi]), name: (ni >= 0 ? c[ni] : "").trim() || "Member" };
    })
    .filter((c) => c.phone && !seen.has(c.phone) && seen.add(c.phone));
}

function renderMessage(contact) {
  return fs
    .readFileSync(cfg.messageFile, "utf8")
    .replaceAll("{name}", contact.name)
    .replaceAll("{link}", cfg.groupLink)
    .trim();
}

// resolveId(phone) -> chat id or null (number not on WhatsApp)
// send(id, text) -> sends the message (+ logo if configured)
export async function runBatch({ resolveId, send }) {
  const sent = new Set(fs.existsSync(sentLog) ? fs.readFileSync(sentLog, "utf8").split("\n").filter(Boolean) : []);
  const pending = loadContacts().filter((c) => !sent.has(c.phone));
  const todo = cfg.maxPerRun > 0 ? pending.slice(0, cfg.maxPerRun) : pending;
  console.log(`${sent.size} already sent, ${pending.length} pending, sending ${todo.length} now${cfg.dry ? " [DRY RUN]" : ""}`);

  let ok = 0;
  let fail = 0;
  for (const [i, c] of todo.entries()) {
    if (cfg.dry) {
      console.log(`[dry] ${c.phone} (${c.name})`);
      continue;
    }
    try {
      const id = await resolveId(c.phone);
      if (!id) throw new Error("not on WhatsApp");
      await send(id, renderMessage(c));
      fs.appendFileSync(sentLog, c.phone + "\n");
      ok++;
      console.log(`[${i + 1}/${todo.length}] sent -> ${c.phone}`);
    } catch (err) {
      fail++;
      fs.appendFileSync(failedLog, `${c.phone},${c.name},"${String(err.message).replace(/"/g, "'")}"\n`);
      console.error(`[${i + 1}/${todo.length}] FAILED -> ${c.phone}: ${err.message}`);
    }
    if (i < todo.length - 1) await sleep(rand(cfg.minDelay, cfg.maxDelay));
  }
  console.log(`Done. ok=${ok} failed=${fail}`);
}
