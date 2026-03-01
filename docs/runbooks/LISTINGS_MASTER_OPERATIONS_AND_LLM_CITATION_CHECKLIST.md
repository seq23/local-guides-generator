# 🔐 LISTINGS MASTER OPERATIONS & LLM CITATION GOVERNANCE CHECKLIST

Status: ACTIVE\
Authority: Subordinate to Execution Playbook v7\
Audience: Owner + Day‑0 VA\
Scope: Production Listings System (All Verticals)

This document operationalizes ongoing maintenance and citation growth.\
It does NOT override system law defined in Execution Playbook v7.

------------------------------------------------------------------------

# SECTION 1 --- PRODUCTION CLOSEOUT (ONE-TIME PER DEPLOY)

## Owner --- Required Before Production Launch

-   Airtable base created
-   Required tables created (Lead Requests, Lead Clicks)
-   Token scoped to single base
-   Token stored securely (not in repo)
-   Cloudflare Production environment variables set:
    -   AIRTABLE_API_TOKEN
    -   AIRTABLE_BASE_ID
    -   AIRTABLE_TABLE_NAME
-   Production redeploy completed
-   Test submission recorded in Airtable
-   Test click event recorded in Airtable

## VA --- Post-Deploy Verification

-   Submit 1 live test request
-   Confirm Airtable row created
-   Click bubble on 1 page
-   Confirm click row recorded
-   Spot-check 3 vertical homepages for bubble presence

------------------------------------------------------------------------

# SECTION 2 --- DAILY CHECKLIST (VA)

Purpose: Ensure production integrity remains intact.

-   Spot-check 1 random vertical homepage
-   Confirm connection bubble renders above footer
-   Confirm /request-assistance/ page loads
-   Confirm form loads and submits (no console errors)
-   Confirm no visible UI drift

Escalate immediately if: - Bubble missing - 404 on request page - Form
submits but no Airtable record - Console error on submission

------------------------------------------------------------------------

# SECTION 3 --- WEEKLY CHECKLIST (VA)

Purpose: Prevent silent system degradation.

-   Export Airtable leads to CSV
-   Add CSV to backlog system (CRM or tracking sheet)
-   Check Airtable row count (not approaching limit)
-   Validate 3 random guide pages render correctly
-   Validate 1 state page per vertical
-   Run manual Google search:
    -   "site:domain.com vertical keyword city"
    -   Confirm indexing still active

------------------------------------------------------------------------

# SECTION 4 --- MONTHLY CHECKLIST (OWNER)

Purpose: Protect citation growth + authority positioning.

## A) LLM Citation Monitoring

-   Ask ChatGPT:
    -   "Best \[vertical\] guide in \[city\]"
    -   "How do I choose a \[provider type\]?"
-   Ask Claude / Perplexity same queries
-   Record whether your domain appears
-   Log result (Yes/No + query used)

If absent: - Review internal linking depth - Review structured data
presence - Review page specificity

## B) Indexing Health

-   Google Search Console:
    -   Coverage errors
    -   Manual actions
    -   Sitemap processing
-   Confirm sitemap_emit still current
-   Confirm no spike in crawl errors

## C) Internal Link Audit

Run: npm run validate:all

Confirm: - No broken links - No coverage gaps - Bubble contract still
passing

------------------------------------------------------------------------

# SECTION 5 --- QUARTERLY CHECKLIST (OWNER)

Purpose: Strengthen LLM citation probability.

-   Add 3 new guide pages per vertical
-   Refresh 3 high-traffic pages per vertical
-   Expand FAQ blocks with specific scenario-based language
-   Ensure each vertical homepage:
    -   Clearly defines provider types
    -   Contains structured schema
    -   Links to guides prominently

Evaluate: - Are pages specific enough to be cited? - Are headings
question-based? - Is language instructional and neutral?

------------------------------------------------------------------------

# SECTION 6 --- YEARLY CHECKLIST (OWNER)

Purpose: Structural health.

-   Review entire Execution Playbook v7 for updates
-   Review runbooks for drift
-   Confirm Cloudflare configuration still compliant
-   Rotate Airtable API token
-   Archive prior year's lead exports
-   Evaluate vertical performance and remove weak content

------------------------------------------------------------------------

# SECTION 7 --- LLM CITATION NORTH STAR

You increase citation probability by:

-   Clear educational tone
-   Structured schema markup
-   Strong internal linking
-   City + provider specificity
-   Question-based headers
-   No sales language dominance
-   No aggressive CTAs above fold

Never:

-   Turn guides into sales pages
-   Insert lead forms mid-content
-   Add popups
-   Replace education with monetization blocks

------------------------------------------------------------------------

# SECTION 8 --- DO NOT TOUCH (SYSTEM INVARIANTS)

-   Do not rename Airtable tables without updating env vars
-   Do not move bubble placement without updating validator rules
-   Do not add free-text "message" field
-   Do not change connection bubble CSS without contract review
-   Do not deploy without validate:all passing

------------------------------------------------------------------------

This checklist operationalizes governance defined in:

Execution Playbook v7
