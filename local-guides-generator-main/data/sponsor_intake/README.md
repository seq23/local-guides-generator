# Sponsor Intake

## Canonical model
- One sponsor record per sponsor
- One asset folder per sponsor
- One activation entry in `data/buyouts.json`

## Paths
- sponsor record → `data/sponsor_intake/sponsors/<slug>/sponsor.json`
- assets → `data/sponsor_intake/sponsors/<slug>/assets/`

## Required assets
- `logo.png`
- `hero.jpg`
- `directory-cta.jpg`

## Make live
VAs should not need to edit multiple config systems. The live switch belongs in `data/buyouts.json`.
