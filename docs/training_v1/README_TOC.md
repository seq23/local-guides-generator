# 📘 MASTER VA TRAINING — LISTINGS / LKG (training_v1)
**Status:** 🔒 READ-ONLY (versioned via baseline ZIPs)  
**Audience:** Standard VA · Technical VA · Owner  
**OS:** macOS  

---

## Canonical docs locations
- **Runbooks (SOPs / operations):** `docs/runbooks/`
- **Training:** `docs/training_v1/`

Everything else is legacy and lives in `docs/_archive_*/`.

---

## Non-negotiable update discipline
### Baseline ZIP rule (snapshot mode allowed ONLY for this pattern)
`local-guides-generator-main_BASELINE_MM-DD-YY_<sha>.zip`
- `MM-DD-YY` = digits only
- `<sha>` = hex, 6–40 chars

### Patch mode is blocked by default
Patch mode is refused unless you explicitly set:
`LKG_ALLOW_PATCH=1`

---

## Table of contents
### A) Orientation & governance
- 00_ORIENTATION_AND_RULES.md
- 01_REQUIRED_ACCESS.md
- VA_PERMISSION_MATRIX_v3.md
- ESCALATION_PROTOCOL.md

### B) Day-0 setup
- 02_DAY0_SETUP_MAC.md
- TERMINAL_SETUP_ONE_SHOT.sh

### C) Core execution
- SOP_VALIDATION_CORE.md
- SOP_ROLLBACK_RECOVERY.md

### D) Sandbox practice (training only)
- 03_SANDBOX_PRACTICE_SOP.md

---

## When in doubt
Stop and escalate to Owner with:
- which SOP
- which step
- the full terminal output
- screenshots if relevant
