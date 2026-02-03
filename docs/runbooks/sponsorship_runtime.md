# Sponsorship + Buyouts Runtime — Hero vs Slots + Next Steps

Last updated: 2026-02-02

This doc describes the runtime rules that decide:

- whether a page renders sponsor slots
- when a **buyout** upgrades the **Top slot to hero**
- when **Vertical Buyout** enables the **Next Steps** runtime CTA

---

## 1) Source data files

- Buyouts live in: `data/buyouts.json`
- Sponsor campaigns live under: `data/sponsor_intake/…` (campaign JSONs)

Validation / contracts ensure these don’t drift.

---

## 2) Runtime decision layer (code)

Core helper:

- `scripts/helpers/sponsorship.js`

This layer is responsible for:

- reading buyouts safely
- determining whether a buyout is LIVE for the current vertical + page context
- deciding if **Next Steps** should render

---

## 3) Canonical rules (what the site must do)

### A) Non-buyout pages
- Sponsor surfaces render in standard slot layout.
- No hero sponsor block should appear unless there is a qualifying buyout.

### B) Page-level buyout (Guide/City/State)
When a qualifying buyout is LIVE for a given page surface:

- The **Top** placement renders as a **hero-style sponsor block**
- Competing hero blocks must not render
- Shared placements for that surface are suppressed or relocated per contract rules

### C) Vertical Buyout
When a Vertical Buyout is LIVE:

- Vertical buyout can override page-level hero behavior where defined by the hierarchy
- **Next Steps** runtime CTA becomes eligible on the defined page types
- The CTA copy must match the canonical contract text

---

## 4) Where the HTML is produced

The generator’s build scripts produce the final page HTML, using:

- `templates/base.html` for the global frame
- build scripts (e.g. `scripts/build_city_sites.js`) for page-specific bodies

The runtime contract marker for Next Steps is:

- `data-next-steps-cta="true"`

If that marker is missing under a LIVE vertical buyout, validation should fail.

---

## 5) Manual verification checklist (fast)

Use these checks per pack:

- Pick 1 guide that is under a guide buyout → confirm Top renders hero
- Pick 1 city under a city buyout → confirm Top renders hero
- Pick 1 vertical with a LIVE vertical buyout → confirm Next Steps CTA appears + copy matches
- Pick 1 control (no buyout) → confirm no hero sponsor blocks render

---

## 6) Related docs

- Monetization runbook: `docs/runbooks/monetization_ads_buyouts.md`
- Guides rendering: `docs/runbooks/guides_rendering.md`
