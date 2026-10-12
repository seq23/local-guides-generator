# Head VA Operations Runbook

## Sponsor go-live model
Head VA should use the simplified sponsor model:
- sponsor record → `data/sponsor_intake/sponsors/<slug>/sponsor.json`
- sponsor assets → `data/sponsor_intake/sponsors/<slug>/assets/`
- live activation → `data/buyouts.json`

## Head VA checklist
1. Confirm sponsor folder exists
2. Confirm logo, hero image, and directory CTA image exist
3. Confirm sponsor.json contains website, phone, and lead email
4. Add one live buyout entry to `data/buyouts.json`
5. Rebuild
6. Validate
7. Click-audit affected routes

## Company, contact and footer

Owner decision, 12 Oct 2026 (PRs #61, #62, #63; log entry in `docs/DECISION-LOG.md`).

- **One company.** Every canonical site (uscisexam.com, dentistryguides.com, hormonesivhair.com,
  neuroevalguides.com, theaccidentguides.com) is a property of **The Industry Guides**.
- **Footer** on every page and 404: `© <year> <brand> · A property of The Industry Guides · Contact: hello@theindustryguides.com`.
- **Same company, same single contact** on About, Methodology, Contact, For Providers, Request
  Assistance and every Next Steps page.
- **Only copies:** `PARENT_COMPANY` and `CONTACT_EMAIL` in `scripts/lib/pack_site_config.js`.
  Change them there; never hard-code the name or address anywhere else.
- **Never** Spry Labs, spryvc.com, joinwestpeek.com or westpeek.ventures on these properties.

**How a canonical gets its brand:** each Cloudflare Pages project sets `PAGE_SET_FILE` →
`scripts/prepare_site.js` → `getPackSiteConfig()` in `scripts/lib/pack_site_config.js` (the
`brandName`/`siteUrl` per pack) → `data/site.json` → build. `releases/releases_index.json`'s
`brandName` is a historical record; for the five canonicals it drives nothing (its only reader,
`scripts/automation/refresh_verification_page.sh`, uses it solely as a fallback when no pack resolves).

**Leads and mail:**
- hello@theindustryguides.com routes through Cloudflare Email Routing to the owner's inbox.
- `functions/api/request-assistance.js` writes each request to the Airtable **Lead Requests** table
  and emails a notification to `LEAD_TO` (info@spryvc.com today; Pages project config).
- Notifications go through the **cryptoclearr Resend account** (vault `resend-industry-guides-api-key`,
  set as `RESEND_API_KEY` on the Pages projects), never the West Peek Resend account.
- **Sender as of origin/main 16050ae (12 Oct 2026):** the From is read from the Pages env var
  `EMAIL_FROM` (value lives in Cloudflare, not in the repo). PR #64 (open at time of writing) pins it
  in code as `The Industry Guides <hello@theindustryguides.com>` and stops reading `EMAIL_FROM`;
  update this line when it lands.

**Enforced by** `scripts/validation/footer_contract.js` (hard-fail for every real pack via
`scripts/validate_core.js`; warn-only for the starter training pack). It asserts:
- every `<footer>` in `dist/` carries the year, ©, the site's own `brandName`, "A property of
  `PARENT_COMPANY`" and `CONTACT_EMAIL` and no other address; fails if zero footers are found;
- no file anywhere in the pack's `dist/` matches Spry Labs / spryvc.com / joinwestpeek.com /
  westpeek.ventures; fails on any hit or on zero files scanned;
- no Pages Function under `functions/` matches the same names; fails on any hit or on zero files.
