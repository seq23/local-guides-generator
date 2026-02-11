# Validation — Quick Card (Mac Only)

**Audience:** Day‑0 VA + Owner  
**Rule:** Validation is blocking. If it fails, stop and email Owner.

---

## One Command You Run
```bash
npm ci
npm run validate:all
```

---

## What “PASS” Looks Like
You should see:
```
CORE VALIDATION PASS
```

If you see a ❌ line, validation has FAILED.

---

## What validate:all Actually Checks (Only These)

1. **Buyouts schema**
   - `data/buyouts.json` structure
   - 0 records is OK

2. **Buyouts LIVE hard‑fail**
   - If no LIVE buyouts → SKIP
   - If LIVE → Next Steps pages + CTAs must exist

3. **For‑Providers inquiry**
   - Exactly ONE mailto template
   - Must include:
     - Full name:
     - Work email:
     - Phone:
     - How did you find us?:

4. **Guides index links**
   - Guides index must link to every generated guide slug

5. **Footer compliance**
   - Footer exists on every page
   - Wrapper: `<footer>...</footer> (no required attribute)`
   - Matches canonical wording from:
     - `docs/policies/footer_canonical.md`
   - No exact copyright substring requirement (encoding varies)

6. **Golden city flow (structure only)**
   - Required block markers present (order matters)
   - No sentence‑level enforcement

7. **Link integrity**
   - No broken internal links
   - No empty hrefs

---

## If Validation FAILS (Exact Protocol)

1. **Do not push**
2. Copy:
   - the FIRST ❌ line
   - the FIRST stack‑trace line below it
3. Email Owner:
   - **To:** info@spryvc.com
   - **Subject:** VALIDATION FAIL — <check name>
   - **Body:** paste copied output + what you changed

---

## Do NOT Do These
- Do NOT bypass validation
- Do NOT add new validators
- Do NOT edit validation scripts
- Do NOT “fix forward” blindly

If unsure → stop and email Owner.

---

## Owner Reference
- Orchestrator: `scripts/validate_core.js`
- Canonical footer: `docs/policies/footer_canonical.md`
