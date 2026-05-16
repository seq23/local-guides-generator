# SOP — TURN ON BUYOUT (NEXT STEPS MECHANISM) — OWNER ONLY

**Policy:** VAs do not push code. VAs email change requests to info@spryvc.com. Owner executes.

## What you are doing
You are enabling an exclusive buyout (City / State / Vertical / Category) that:
- suppresses competing conversion surfaces on scoped pages
- adds a **Next Steps** CTA
- routes leads to the paying provider via email prefill

## Live rule (ALL required)
A buyout is LIVE only if:
1) record exists
2) `live: true`
3) today is within `[startDate, endDate]`

## File to edit
`data/buyouts.json`

## Templates (copy/paste)

### Total City Buyout
```json
{
  "id": "buyout_city_EXAMPLE_2026-02",
  "scope": "city",
  "vertical": "dentistry",
  "citySlug": "charlotte-nc",
  "toEmail": "leads@provider.com",
  "live": true,
  "startDate": "2026-02-01",
  "endDate": "2026-02-28"
}
```

### Total State Buyout
```json
{
  "id": "buyout_state_EXAMPLE_2026-02",
  "scope": "state",
  "vertical": "dentistry",
  "state": "NC",
  "toEmail": "leads@provider.com",
  "live": true,
  "startDate": "2026-02-01",
  "endDate": "2026-02-28"
}
```

### Total Vertical Buyout
```json
{
  "id": "buyout_vertical_EXAMPLE_2026-02",
  "scope": "vertical",
  "vertical": "dentistry",
  "toEmail": "leads@provider.com",
  "live": true,
  "startDate": "2026-02-01",
  "endDate": "2026-02-28"
}
```

### Category (single guide) Buyout
```json
{
  "id": "buyout_category_EXAMPLE_2026-02",
  "scope": "category",
  "vertical": "dentistry",
  "guideSlug": "cosmetic-dentistry",
  "toEmail": "leads@provider.com",
  "live": true,
  "startDate": "2026-02-01",
  "endDate": "2026-02-28"
}
```

## Validation bundle (must pass)
```bash
npm ci
npm run validate:buyouts:schema
npm run validate:all
npm run smoke:buyouts
npm run audit:buyouts
npm run audit:links
npm run qa:release
```

## Rollback
- Set `live: false` (do NOT delete record)
- Re-run `npm run validate:all`
