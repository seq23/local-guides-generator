# 05 — IndexNow and LLM Surface Freshness

Purpose:
- keep Bing discovery aligned with the current public surface
- expose a machine-readable llms.txt file for existing public pages
- improve sitemap freshness with lastmod fields

Contracts:
- `dist/sitemap.xml` must contain the current crawlable surface
- sitemap entries now include `<lastmod>` derived from built page mtimes
- `npm run postbuild` emits `dist/llms.txt`
- `npm run indexnow:ping` submits the current public surface from `dist/sitemap.xml` when available

Why this exists:
- submitting the current built surface is stronger than pinging only the homepage and sitemap
- `llms.txt` is not a hard validator target, but it gives agents a concise discovery file alongside the canonical sitemap

Operator checks:
1. build the site
2. run `npm run postbuild`
3. confirm `dist/sitemap.xml` contains `<lastmod>`
4. confirm `dist/llms.txt` exists
5. if production config is present, run `npm run indexnow:ping`

Failure handling:
- if `SITE_URL` is missing locally, `llms_emit` skips instead of blocking local work
- if IndexNow host config is missing in CI while the key is set, fail configuration rather than shipping a broken setup
