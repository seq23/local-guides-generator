# CONFLICT + HIERARCHY RULES (CANONICAL)

**Status: LOCKED CANONICAL AUTHORITY**

This is the decision doctrine for conflicts across Guide/City/State/Vertical contracts. Validators and sponsor-apply scripts must implement these rules, and must hard-fail on illegal overlaps.

---

## Buyout precedence (lowest → highest)

1. Guide Spotlight
2. City Buyout
3. State Buyout (PI only)
4. Vertical Pack Buyout

**Rule: higher tiers override lower tiers only where they do not violate signed contracts.**

---

## Deferred Vertical Buyout (the $75K sale)

If a City / State / Guide buyout is already active, a Vertical Pack Buyout can still be sold **as a Deferred Vertical Buyout**:

- The vertical buyer receives all unsold inventory immediately.
- Inventory covered by active lower-tier contracts is **excluded until expiry**.
- Exclusions must be deterministically computed (no manual guessing) and logged.
- When a lower-tier contract expires, the vertical buyout automatically applies on the next build.

---

## Live Buyout CTA (runtime)

The Next Steps CTA is a **runtime** mechanism that exists ONLY when a Vertical Pack Buyout is LIVE.

**Canonical CTA copy (universal across packs):**

> Speak directly with a vetted provider serving your location.

CTA placement (Option A):

- Vertical hub hero
- City pages
- Guide pages
- PI state pages (PI pack only)

CTA suppression:

- CTA must be suppressed on any page excluded by a higher-priority, active lower-tier contract.

---

## Canonical buyout record model

```json
{
  "scope": "guide" | "city" | "state" | "vertical",
  "targets": ["guides/trt/what-is-trt", "atlanta-ga", "tx", "ALL"],
  "starts_on": "2026-02-01",
  "ends_on": "2026-08-01",
  "priority": 2,
  "buyout": true,
  "live": true
}
```

Notes:

- `scope=vertical` uses `targets:["ALL"]` to represent “this vertical pack”.
- `priority` resolves conflicts deterministically.
- `live=true` is the on/off switch for runtime behavior (including CTA).
