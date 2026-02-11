# Sponsor Scripts Bundle

## Files
- `scripts/sponsors/apply.js` — ingest assets, apply campaigns, generate outputs (optional CF Images upload)
- `scripts/sponsors/verify.js` — validate intake + outputs

## Environment for optional Cloudflare Images
- `CF_ACCOUNT_ID`
- `CF_API_TOKEN`

## Token scopes required (Cloudflare Images mode)
At minimum:
- Account: Cloudflare Images: Edit (or equivalent)
- Account: Account Settings: Read (optional)
No DNS or Pages permissions are required for Images upload.

## How to run
```bash
npm run sponsors:apply
npm run sponsors:verify
```

Cloudflare Images mode:
```bash
export CF_ACCOUNT_ID="..."
export CF_API_TOKEN="..."
npm run sponsors:apply:cf
npm run sponsors:verify
```
