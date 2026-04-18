# LISTINGS Master Index Addendum v4 — Sponsor Operations and Live Activation

## Status
Active addendum to the canonical master index.

## Purpose
This addendum updates sponsor operations to the simplified live-activation model.

## Canonical sponsor-ops model
- One sponsor record per sponsor
- One sponsor asset folder per sponsor
- One live activation entry in `data/buyouts.json`

## Paths
- sponsor record → `data/sponsor_intake/sponsors/<slug>/sponsor.json`
- sponsor assets → `data/sponsor_intake/sponsors/<slug>/assets/`
- live activation → `data/buyouts.json`

## Required sponsor data
- logo
- hero image
- directory CTA image
- phone
- website URL
- lead email

## Runtime rule
When `directory_cta_takeover` is enabled for a live buyout, the CTA directly above the directory becomes the sponsor feature surface.

## VA rule
A VA should be able to make a sponsor live by:
1. creating/updating the sponsor record
2. dropping sponsor assets in the sponsor folder
3. adding one live entry to `data/buyouts.json`
4. rebuilding and validating

## Legacy note
`data/sponsorships.json` remains in the repo for legacy/supporting metadata, but it is not the Day-0 VA activation file.

## CTA hero rule
When a sponsor is live on a covered page, the top CTA upgrades into the hero sponsor surface for that page. The CTA directly above a directory keeps its special sponsor-feature behavior when `directory_cta_takeover` is enabled.
