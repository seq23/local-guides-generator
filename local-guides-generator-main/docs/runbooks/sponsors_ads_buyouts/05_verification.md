# Verification Bundle — Sponsor System

## Quick checks (local)
1) Validate sponsor intake + generated configs:
```bash
npm run sponsors:verify
```

2) Spot-check generated output:
- `data/sponsors/global.json`
- `assets/sponsors/<slug>/manifest.json`

## Runtime checks (after deploy)
- open the site
- verify:
  - images load
  - CTA opens correct URL
  - Next Steps shows correct sponsor on scoped pages

## Curl checks (when applicable)
```bash
curl -I "https://<domain>/"
curl -I "https://<domain>/some/path?x=1"
```

Expect:
- status 200 on canonical
- ad assets served
- Next Steps visible where enabled
