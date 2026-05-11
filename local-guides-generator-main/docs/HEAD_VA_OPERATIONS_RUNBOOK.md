# Head VA Operations Runbook

## Sponsor go-live model
Head VA should use the simplified sponsor model:
- sponsor record → `data/sponsor_intake/sponsors/<slug>/sponsor.json`
- sponsor assets → `data/sponsor_intake/sponsors/<slug>/assets/`
- live activation → `data/buyouts.json`

## Head VA checklist
1. Confirm sponsor folder exists
2. Confirm logo, hero image, and directory CTA image exist
3. Confirm sponsor.json contains website, phone, and lead email
4. Add one live buyout entry to `data/buyouts.json`
5. Rebuild
6. Validate
7. Click-audit affected routes
