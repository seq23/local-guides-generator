# Request Assistance Airtable Flow

The public request-assistance page submits structured provider leads to `/api/request-assistance`.

## Endpoint behavior

The Cloudflare Pages Function:

- accepts a minimal validated JSON payload
- blocks honeypot submissions
- validates provider type, email, and consent
- writes records to Airtable when production env vars are present

## Required environment variables

- `AIRTABLE_BASE_ID`
- `AIRTABLE_TABLE_NAME`
- `AIRTABLE_API_TOKEN`

If those variables are missing, the endpoint should fail safely instead of pretending production capture is live.
