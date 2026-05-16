# LISTINGS Master Index Addendum v5 — CTA Sponsor Surfaces

## Status
Active addendum to the canonical master index.

## Purpose
This addendum updates the runtime monetization model from empty ad-slot placeholders to sponsor-owned CTA surfaces.

## Runtime rule
- Empty ad-slot placeholders must not render on public pages.
- Sponsor surfaces render inside CTA blocks only when a live buyout is active for the covered page.
- The top CTA upgrades into the hero sponsor surface when a sponsor is live.
- The CTA above a directory remains the special directory-entry sponsor surface when `directory_cta_takeover` is enabled.

## Disclosure rule
Sponsor CTA surfaces must include visible disclosure language:
`Sponsored placement • fixed inventory • disclosed`

## Asset rule
Sponsor records may include:
- `assets.top_cta_image`
- `assets.mid_cta_image`
- `assets.bottom_cta_image`
- `assets.directory_cta_image`

## State-page ordering rule
On state pages, the `Cities we cover in [state]` block must appear immediately below the short answer block.

## Directory naming rule
Directory/example blocks should use `Directory Listings (...)` naming across verticals.
