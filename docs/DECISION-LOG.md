# Decision log

Owner decisions that govern this repo, newest first. Each entry names the PRs that landed it
and the check that enforces it.

## 2026-10-12 — Every canonical is a property of The Industry Guides

- **Decision:** uscisexam.com, dentistryguides.com, hormonesivhair.com, neuroevalguides.com and
  theaccidentguides.com belong to one company, The Industry Guides, with one contact,
  hello@theindustryguides.com. Footer, About, Methodology, Contact, For Providers, Request
  Assistance and every Next Steps page say so. Spry Labs, spryvc.com, joinwestpeek.com and
  westpeek.ventures never appear on these properties.
- **Why:** a lead email went From hello@joinwestpeek.com To info@spryvc.com; the guides must stand
  alone as their own company.
- **Landed:** #61 (footers + global pages), #62 (request-assistance, next steps, dist-wide scan),
  #63 (Pages Functions scan, West Peek domains), #64 (lead sender pinned to
  The Industry Guides <hello@theindustryguides.com>, cryptoclearr Resend account).
- **Source of truth:** `PARENT_COMPANY`, `CONTACT_EMAIL` in `scripts/lib/pack_site_config.js`.
- **Enforced by:** `scripts/validation/footer_contract.js` (run by `scripts/validate_core.js`).
- **Runbook:** `docs/HEAD_VA_OPERATIONS_RUNBOOK.md` → "Company, contact and footer".
