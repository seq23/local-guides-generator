# Sitemap Crawl Parity (Hard Gate)

## Purpose

Protect crawlability and LLM retrieval integrity by ensuring the public crawl surface in `dist/` exactly matches `dist/sitemap.xml`.

## Hard-fail rule

Validation must fail if either of these is true:

- a crawlable built page exists in `dist/` but is omitted from `dist/sitemap.xml`
- a URL exists in `dist/sitemap.xml` but no corresponding crawlable page exists in `dist/`

This validator is structural. It does **not** lock marketing copy or hard-code page text.

## Crawlable page definition

For this repo, crawlable pages are canonical HTML endpoints rendered as:

- `dist/index.html` → `/`
- `dist/**/index.html` → `/<path>/`

Assets, snapshots, redirects, and internal build artifacts are out of scope.

## Operator workflow

1. Build the active pack.
2. Run postbuild so `dist/sitemap.xml` is emitted.
3. Run `LKG_VALIDATE_DIST=1 npm run validate:all`.
4. If parity fails, inspect the listed missing paths.
5. Fix sitemap emission or page generation.
6. Re-run validation. Never bypass the validator.

## Owner + VA checklist

- `dist/` exists
- `dist/sitemap.xml` exists
- all intended crawlable pages are present
- no orphan URLs in sitemap
- validation passes cleanly

## Rollback

If parity failures cannot be resolved cleanly in the active batch:

1. stop
2. compare the current diff against the pre-batch tag
3. revert the sitemap/page-generation change set
4. re-run validation

## Notes

- This validator is intentionally non-brittle with respect to page copy.
- It protects trust, crawlability, and downstream discovery only.
