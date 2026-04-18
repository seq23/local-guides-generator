# Buyout and Sponsor Operations Model — Canonical

## Canonical products
- City Buyout
- State Buyout
- Vertical Buyout

## Canonical live model
- Sponsor identity + assets live in `data/sponsor_intake/sponsors/<slug>/`
- Live activation lives in `data/buyouts.json`
- CTA takeover and lead routing are controlled by the live buyout entry

## Directory rule
If a page has a directory and `directory_cta_takeover` is enabled, the CTA above the directory becomes the sponsor feature surface.

## Guide rule
Guide pages are covered only under vertical buyout.
