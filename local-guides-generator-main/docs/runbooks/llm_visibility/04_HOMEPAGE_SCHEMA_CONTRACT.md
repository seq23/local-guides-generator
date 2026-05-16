# Homepage Schema Contract

## Purpose

Protect the existing homepage LLM / machine-readable surface without locking copy.

## Hard-fail rule

`dist/index.html` must include valid JSON-LD containing these types:

- `Organization`
- `WebSite`
- `WebPage`

This is a type-level contract only.
It does **not** lock headlines, body copy, or field-level wording.

## Verification

Run:

```bash
LKG_VALIDATE_DIST=1 npm run validate:all
```

Expected pass line:

```text
HOMEPAGE SCHEMA CONTRACT PASS
```

## Failure handling

1. Confirm `dist/index.html` exists.
2. Open the JSON-LD block in the built homepage.
3. Restore the missing type in the homepage render path.
4. Re-run validation.

## Why this exists

This protects machine-readable homepage integrity while avoiding brittle hard-copy validation.
