# 📘 MASTER VA TRAINING SYSTEM — LISTINGS / LKG
**Version:** v1 (IMMUTABLE)  
**Status:** 🔒 READ-ONLY · VERSIONED ONLY  
**Audience:** Standard VA · Technical VA · Owner  
**Environment:** macOS only  
**Last Updated:** 2026-01-31  

---

## 🚨 READ THIS FIRST (DO NOT SKIP)

This is the **Master VA Training System** for the Listings / LKG business.

It is designed for:
- people who are **new**
- people who are **careful**
- people who do **not want to break anything**

It is written **slowly, deliberately, and explicitly on purpose**.

If you follow these documents **exactly**, you will not break the system.

---

## 🔒 IMMUTABILITY & CHANGE RULES (NON-NEGOTIABLE)

- This documentation is **READ-ONLY**
- You **do not edit** these files
- You **do not suggest changes in GitHub**
- You **do not “fix things yourself”**

If something is:
- unclear
- missing
- confusing
- broken
- outdated

👉 **Email the Owner only:**  
📩 **info@spryvc.com**

Include:
- SOP name
- step number
- what is unclear or broken
- screenshot if possible

Changes are issued only as **new versions** (v1.1, v2, etc.).

---

## 🧭 HOW TO USE THIS SYSTEM

1. Start with this file.
2. Read Orientation & Rules.
3. Confirm Required Access.
4. Complete Day-0 Setup.
5. Practice in the Sandbox.
6. Only then perform real tasks.

If unsure at any point: **stop and escalate**.

---

## 🟢🟡🔴 EXECUTION LABELS

- 🟢 **STANDARD VA (SAFE)**
- 🟡 **TECHNICAL VA (SUPERVISED)**
- 🔴 **OWNER ONLY**

If an SOP is not labeled 🟢, assume you cannot run it without permission.

---

## 📂 TABLE OF CONTENTS

### A. Orientation & Governance
- 00_ORIENTATION_AND_RULES.md
- 01_REQUIRED_ACCESS.md
- VA_PERMISSION_MATRIX_v3.md
- ESCALATION_PROTOCOL.md

### 🔴 Owner Only
- OWNER_REPO_AND_ACCESS_GOVERNANCE.md

### B. Day-0 Setup & Sandbox
- 02_DAY0_SETUP_MAC.md
- 03_SANDBOX_PRACTICE_SOP.md

### C. Core SOPs
- 04_VALIDATION_CORE_SOP.md
- SOP_LKG_UPDATE_SNAPSHOT.md
- SOP_RELEASE_TAGGING_VERIFY.md
- SOP_ROLLBACK_RECOVERY.md
- SOP_ADD_CITY_STATE.md
- SOP_GUIDES_AUTHOR_REGEN.md
- SOP_CLICK_AUDIT_FULL.md
- SOP_LLM_VISIBILITY_MONITORING.md

### D. Ongoing Operations
- FUTURE_PROOFING_CHECKS.md

---

**END OF FILE**

## Buyouts — Next Steps

- [SOP — Turn On Buyout](SOP_TURN_ON_BUYOUT.md)
- [SOP — Turn Off Buyout](SOP_TURN_OFF_BUYOUT.md)
- [_screenshots](./_screenshots/README.md)

\1- [Validation — Quick Card](CHEATSHEET_VALIDATION_QUICK_CARD.md)
- [SOP — Running Validation (Core Orchestrator)](SOP_VALIDATION_CORE.md)


## Validation System (Core)

- Single orchestrator: `scripts/validate_core.js`
- Run: `npm run validate:all`
- Canonical footer text: `docs/policies/footer_canonical.md`
