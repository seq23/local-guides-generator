# Sponsor Ops — Process Map (Simple Sponsor Record + One Activation File)

## What this system does
A VA or Head VA can make a sponsor live with:
- one sponsor record
- one asset folder
- one activation entry

## Canonical objects
- **Sponsor** → `data/sponsor_intake/sponsors/<slug>/sponsor.json`
- **Assets** → `data/sponsor_intake/sponsors/<slug>/assets/`
- **Live activation** → `data/buyouts.json`

## What changes when a buyout is live
- CTA layer routes to sponsor
- lead form routes to sponsor
- CTA directly above a directory becomes the sponsor feature surface when enabled

## Products
- City Buyout
- State Buyout
- Vertical Buyout

## Determinism rules
- sponsor identity lives in the sponsor record only
- assets live in the sponsor folder only
- VAs make sponsors live by editing `data/buyouts.json` only
- validation must fail if a live buyout points at a missing sponsor record or missing assets
