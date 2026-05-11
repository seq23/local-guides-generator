# Request-Assistance Production Guardrail

## Purpose

Prevent production deploys from shipping a live request-assistance form when the Airtable backend is missing required environment variables.

## Hard-fail rule

In production context, validation must fail if any of these are missing:

- `AIRTABLE_API_TOKEN`
- `AIRTABLE_BASE_ID`
- `AIRTABLE_TABLE_NAME`

## Context rules

Production is detected from one of the following:

- `LKG_DEPLOY_ENV=production`
- `DEPLOY_ENV=production`
- `CONTEXT=production`
- Cloudflare Pages env indicating main branch production context

Non-production contexts only verify that the endpoint contract exists and references the canonical Airtable env variables.

## Verification

Non-production:

```bash
npm run validate:all
```

Production smoke:

```bash
LKG_DEPLOY_ENV=production AIRTABLE_API_TOKEN=test AIRTABLE_BASE_ID=test AIRTABLE_TABLE_NAME=test npm run validate:all
```

Expected pass lines:

```text
REQUEST ASSISTANCE PRODUCTION GUARDRAIL PASS
EXECUTABLE BITS CONTRACT PASS
```

## Failure handling

1. Add the missing Airtable environment variables to the production deploy context.
2. Re-run validation in explicit production mode.
3. Do not ship until the validator passes.

## Why this exists

A polished lead form with a dead backend is a money-path failure. This contract blocks that state.
