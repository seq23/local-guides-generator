# Production HTTP verification probe

Run `node scripts/operations/probe_canonical_urls.js reports/production_http_probe.json` on a connected runner to inspect the six canonical sites and Industry Guides Velocity host. It issues read-only GETs to homepage, robots.txt, sitemap.xml, and selected previously published/merged guide URLs.

The result distinguishes HTTP failures from network inability to reach the site, records canonical tags, response status and robots meta. **HTTP 200 does not imply Google indexing**, the script does not access Search Console, and a network error must never be represented as a website 404.

This command does not create a lead or touch Airtable/email/provider systems. To validate those systems, use designated test recipients and verify actual downstream receipts with authorized credentials. No existing geographic routes, indexes or frozen content are altered by this tool.

Optional `PROBE_BASE_URLS=https://your-staging-host` restricts the targets for controlled operator tests. The command exits with status 2 if any HTTP or network checks fail so the caller must review evidence, not silently treat the check as green.