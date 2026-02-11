# 03 — SANDBOX PRACTICE SOP
**Status:** IMMUTABLE v1 · READ-ONLY  
**Audience:** 🟢 Standard VA / 🟡 Technical VA  
**Environment:** macOS only  
**Risk Level:** ZERO (No production impact)

---

## Purpose

This SOP exists so you can practice **without fear**.

Nothing you do here:
- affects live sites
- changes domains
- pushes code
- touches Cloudflare

If something breaks here, that is expected.

---

## What You Will Practice

- running validation
- building the site locally
- opening generated pages
- visually checking layout and ads
- performing a light click audit

---

## Step 1 — Confirm You Are in Sandbox Mode

You should:
- NOT be logged into Cloudflare
- NOT have permission to push code
- be working locally only

If unsure, stop.

---

## Step 2 — Run Validation

In Terminal:
```
npm run validate:all
```

You are practicing:
- reading output
- recognizing PASS vs FAIL

---

## Step 3 — Build Locally

Run:
```
npm run build
```

This creates a local `dist/` folder.

---

## Step 4 — Open Pages Locally

Open any generated HTML file in your browser.

Check:
- footer exists
- advertising is clearly labeled
- page is readable (not one flat block of text)

---

## Step 5 — Practice Escalation (Dry Run)

Pretend something looks wrong.

Draft (but do not send) an escalation email:
- SOP name
- what you saw
- screenshot

---

## Completion Criteria

You are done when:
- validation runs successfully
- you opened at least one page
- you understand what “looks wrong”

---

**END OF FILE**
