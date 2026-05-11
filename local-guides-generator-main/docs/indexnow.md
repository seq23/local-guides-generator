# IndexNow (Bing/Yandex)

This repo supports IndexNow in a **deploy-safe** way.

## What you set in GitHub / Cloudflare

### Required
- **Secret:** `INDEXNOW_KEY`  
  Value **must be ONLY the 64-char key** (no extra text).

### Optional (recommended if you deploy multiple domains from one codebase)
- `INDEXNOW_HOSTS` (comma-separated hostnames, e.g. `theaccidentguides.com,dentistryguides.com`)
  - You can store this as a GitHub Actions secret or as a Cloudflare Pages env var.

### Required for correct canonicals + sitemaps
- `SITE_URL` must be the deployed domain url, e.g. `https://theaccidentguides.com`
  - In CI, `prepare_site.js` will hard-fail **only when** `INDEXNOW_KEY` is present (or `REQUIRE_SITE_URL=1`), to prevent generating wrong sitemap/canonicals.

## What the build does
- `npm run build` automatically runs `postbuild` which runs:
  - `node scripts/indexnow_emit.js` → writes `dist/indexnow.txt`

## What pings IndexNow
- `node scripts/indexnow_ping.js` reads:
  - `INDEXNOW_KEY` + (`INDEXNOW_HOSTS` or `INDEXNOW_HOST` or host from `SITE_URL`)
  - Sends one POST per host to `https://www.bing.com/indexnow`

## Common gotcha (fixed)
If you accidentally paste multiple lines into the `INDEXNOW_KEY` secret (e.g. key + `INDEXNOW_HOSTS=...`),
the scripts will still parse it correctly — but **don't do that** going forward.
