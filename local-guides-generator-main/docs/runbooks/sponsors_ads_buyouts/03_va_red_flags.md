# VA Red Flags — What You Must NOT Touch

## Do NOT touch these unless Owner explicitly tells you
- `scripts/` (anything in scripts)
- `data/_generated/` (if present)
- `data/sponsors/global.json` **if it has an AUTO-GENERATED header**
- `data/sponsors/<city>.json` **if AUTO-GENERATED**
- `scripts/validate_*` or `scripts/build_*`
- any Cloudflare DNS / Pages / Redirect settings not explicitly in the runbook

## Never do these actions
- Do not delete any sponsor intake folders.
- Do not rename sponsor slugs after a campaign is created.
- Do not upload non-image files into sponsor asset folders.
- Do not “fix it” by editing generated JSON directly.
- Do not change Cloudflare token permissions or rotate tokens without telling Owner.

## If something fails, do this
1) Stop.
2) Capture:
   - command run
   - error output
   - file paths of sponsor.json + campaign json
3) Send to Owner.
