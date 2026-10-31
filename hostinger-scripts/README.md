# hostinger-scripts/

This folder is **not part of the Next.js app** and Vercel won't deploy it —
it's just here so the updated `upload.php` ships with the rest of the
changes. It runs on Hostinger, at whatever path currently serves
`uploads.ndscbd.net`'s upload endpoint.

## To deploy this change

1. Open the existing `upload.php` on the Hostinger server.
2. Replace its contents with this file's — **except** keep the real
   `$secret` value from the live file (this copy has the placeholder
   `'____'`; don't overwrite the live secret with that).
3. Save. No restart needed for a plain PHP file on Apache/LiteSpeed.

## What changed from the version you pasted

- `$allowed_origins` now also includes `https://www.ndscbd.net` (previously
  only the bare apex domain and `arnob.ndscbd.net` were allowed, so a
  visitor on the `www` host would silently fail CORS on direct uploads).
- `$allowed_folders` now includes every folder the Next.js API route
  actually sends (`certificates`, `certificate-templates`,
  `olympiad-covers`, `olympiad-pdfs`, `survey-covers`, `publications`,
  `legacy-gallery`, `glance-gallery`) — previously anything outside the
  original short list silently landed in `misc/` instead of its intended
  folder.

Everything else is unchanged from what you pasted.
