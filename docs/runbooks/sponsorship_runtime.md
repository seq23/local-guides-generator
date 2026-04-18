# Sponsorship Runtime

## Canonical runtime model
- Sponsor identity comes from `data/sponsor_intake/sponsors/<slug>/sponsor.json`
- Live activation comes from `data/buyouts.json`
- CTA takeover and lead routing depend on the active buyout record
- If `directory_cta_takeover` is enabled, the CTA above the directory becomes the sponsor feature surface
