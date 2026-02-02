# BUYOUT + INVENTORY MODEL (CANONICAL)

**Status: LOCKED CANONICAL AUTHORITY**

This document defines the buyout tiers, inventory counting rules, and which pages are affected. Validators and sponsor-apply logic must match this 1:1.

---

## Live Buyout CTA (runtime)

When a **Vertical Pack Buyout** is LIVE, a runtime CTA must render on eligible pages (suppressed by conflicts per the doctrine below).

**Canonical CTA copy (must be identical):**

> Speak directly with a vetted provider serving your location.

(Implementation uses `data-next-steps-cta="true"` for validation.)

---

## Scopes

- **guide** — a specific guide route (e.g. `guides/trt/what-is-trt`)
- **city** — a specific city page (e.g. `atlanta-ga`)
- **state** — PI-only state page (e.g. `tx`), only in PI packs
- **vertical** — the full vertical pack (the $75K buyout)

---

## Inventory counting rules (locked)

These are the surfaces that count as inventory when included in a scope.

- **City pages**: 3 placements per city page (**all count**)
- **Guide pages**: 2 placements per guide page (**all count**)
- **PI state pages**: included in PI packs; placements count (state page inventory is defined by the current PI page contract)
- **Hub hero**: counts as 1 placement

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
  "live": false
}
```

Notes:
- `targets:["ALL"]` is only valid for `scope:"vertical"`.
- `priority` resolves overlaps deterministically.

