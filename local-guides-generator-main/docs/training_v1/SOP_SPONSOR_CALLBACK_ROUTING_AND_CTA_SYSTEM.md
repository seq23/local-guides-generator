# Training SOP — Sponsor Callback Routing and CTA System

## Purpose
Practice the same sponsor-live model used by production with fake sponsor data.

## Training paths
- sponsor record → `data/sponsor_intake/sponsors/<slug>/sponsor.json`
- live activation → `data/buyouts.json`

## What to verify
- CTA layer changes under buyout
- lead email is present for the active sponsor
- CTA above directory acts as sponsor feature surface when enabled
