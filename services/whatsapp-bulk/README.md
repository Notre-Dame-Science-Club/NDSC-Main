# WhatsApp sender

A small service that keeps WhatsApp connections open and sends messages through them. Everything is managed in
its control panel (or from the NDSC website's Admin → WhatsApp): SIMs, credits, brand name, logo, and the message for each send.
Nothing about messages, contacts or links is configured in files.

```
npm install
npm start          # panel at http://localhost:3000 (or PORT)
npm run demo       # same panel with fake SIMs, nothing is really sent
npm test
```

## Settings (environment variables, server settings only; see `.env.example`)

| Variable | Purpose |
|---|---|
| `PORT` | Port to listen on (Render sets it) |
| `DATA_DIR` | Where SIM logins, credits, history and logo are stored (default `./data`). Keep it private and persistent |
| `WA_API_TOKEN` | Secret the NDSC website sends as `Authorization: Bearer …` |
| `WA_ADMIN_PASSWORD` | Lets you open the panel in a browser on a public address and sign in with this password |
| `NDSC_URL`, `NDSC_REGISTER_SECRET` | Optional: announce this service's URL and token to the website on every start |
| `WA_PUBLIC_URL` | This service's public address (Render supplies `RENDER_EXTERNAL_URL`) |

With neither `WA_API_TOKEN` nor `WA_ADMIN_PASSWORD`, the panel only opens on the same computer (127.0.0.1) and
refuses to listen on a public address.

## Using the panel

* **SIMs → Add SIM:** name it, set credits and a daily limit, scan the QR (WhatsApp → Linked devices → Link a device). Logins are remembered.
* **1 credit = 1 message sent.** Numbers not on WhatsApp and failed attempts cost nothing. The daily limit resets at midnight.
* **Send:** paste or upload contacts (`phone,name`), write the message (`{name}` becomes each person's name), **Check**, then **Start**.
  Tick *notice* to message people again who were messaged before; otherwise repeats are skipped.
* **Brand & message:** club/brand name (bold first line), logo, optional group link for `{link}`, saved default message, pacing, country code.
* Messages are spread over SIMs that still have credits. Rate limits cool a SIM down for 30 min; a possible restriction or 5 errors in a row pauses it.

Be careful: WhatsApp restricts numbers that message people who don't expect it. Only message people who asked to hear from you,
keep daily limits modest and waits long.

## Hosting on Render

Create a **Web Service** from this folder (`render.yaml` does it): build `npm ci`, start `npm start`, health check `/healthz`,
a **persistent disk** mounted at `/var/data`, and env vars `DATA_DIR=/var/data` plus `WA_API_TOKEN` and/or `WA_ADMIN_PASSWORD`.
`PORT`, host binding and the public URL are handled by Render.

Use a paid instance with a disk. Free Render services sleep after 15 minutes without traffic, take about a minute to wake,
and lose their disk on every sleep or redeploy, so every SIM would need a new QR scan.

### Connect it to the NDSC website

Either add the service URL and token in the website under Admin → Credentials, or let it register itself: set
`NDSC_URL` (the website) and `NDSC_REGISTER_SECRET` here, and the same value as `SERVICE_REGISTER_SECRET` on the website.
Each time the service starts (including after waking) it saves its URL and token there as an Auto-registered credential.
