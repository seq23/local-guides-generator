# CANONICAL AD SYSTEM + CHECKLIST (AUTHORITATIVE)

**Status: LOCKED CANONICAL AUTHORITY**

This document is the single **sales ⇄ renderer ⇄ validators** contract for advertising inventory, buyouts, conflicts, hero behavior, and runtime conversion surfaces.

If the **for-providers** sales page, renderer behavior, or validators disagree with this document, that is a **SEV-1 system defect** and must be corrected before shipping.

---

## 1) Definitions (no ambiguity)

### 1.1 Placement
A **placement** is a fixed, deterministic slot on a page.

- Placements are not auction-driven.
- Placements are not rotating.
- Placements are validated at build time.

### 1.2 Shared placement (stacked)
A **shared placement** means multiple sponsors may appear **stacked vertically** within that placement.

- **Static + stacked only**
- **No rotation model**
- **No side-by-side ad cards**
- **No randomized ordering**

### 1.3 Buyout (exclusive)
A **buyout** means the covered surface becomes exclusive.

- The buying sponsor does **not** share placements on that scope.
- Exclusivity applies to **all placements that exist for that surface** (not only Top).
- The **Top placement upgrades into a hero-style format** (no new slot is created).

### 1.4 Hero rule (buyouts only)
There is **no hero position** unless a buyout is active for that scope.

- For Guide / City / PI State buyouts: the **Top placement** renders hero-style.
- This is a styling upgrade of the Top placement, not an additional placement.

### 1.5 Vertical Pack Buyout ($75,000)
A **Vertical Pack Buyout** is a vertical-wide contract that:

- Includes the **vertical hub hero** (buyout-only surface)
- Enables the **runtime Next Steps CTA** on eligible pages
- May be sold as a **Deferred Vertical Buyout** when lower-tier buyouts are already active

---

## 1.6 Machine contract (validator)

The validator extracts the JSON block below and compares it to the rendered `/for-providers/` page.

```json
{
  "version": "CANONICAL_AD_INVENTORY_V1",
  "surfaces": {
    "guide": {
      "placements": [
        "top",
        "bottom"
      ],
      "shared_model": "stacked",
      "buyout": {
        "exclusive": true,
        "top_upgrades_to": "hero"
      }
    },
    "city": {
      "placements": [
        "top",
        "mid",
        "bottom"
      ],
      "shared_model": "stacked",
      "buyout": {
        "exclusive": true,
        "top_upgrades_to": "hero",
        "note": "mid and bottom separated by content"
      }
    },
    "state_pi": {
      "placements": [
        "top",
        "mid"
      ],
      "shared_model": "exclusive_only",
      "buyout": {
        "exclusive": true,
        "top_upgrades_to": "hero"
      }
    },
    "vertical_hub": {
      "placements": [
        "hero"
      ],
      "buyout_only": true
    }
  },
  "runtime_next_steps_cta": {
    "enabled_when": "vertical_buyout_live_or_pi_state_buyout_live_on_state_page",
    "copy": "Speak directly with a vetted provider serving your location.",
    "button": "Speak directly",
    "placement_option": "A",
    "eligible_surfaces": [
      "vertical_hub",
      "city",
      "guide",
      "state_pi"
    ],
    "suppressed_when": "excluded_by_active_lower_tier_contract"
  }
}
```


## 2) Authoritative placement surfaces + slot counts

These are the ONLY placement surfaces that exist.

### 2.1 Guide pages
Placements per guide page:

- **Top**
- **Bottom**

Total: **2 placements**

### 2.2 City pages
Placements per city page:

- **Top**
- **Middle**
- **Bottom**

Total: **3 placements**

Important:

- **Middle and Bottom placements are separated by editorial content**; they are not adjacent.

### 2.3 State pages (PERSONAL INJURY vertical only)
Placements per PI state hub page:

- **Top** (renders hero-style under state buyout)
- **Middle**

Total: **2 placements**

Notes:

- PI state pages are a PI-only surface.
- State placement is cumulative and includes the state hub page and all city pages within that state, as defined by the pack’s runtime inventory.

### 2.4 Vertical hub (Industry Vertical Home Page)
Placements per vertical hub:

- **Hero (top of page)** — buyout-only

Total: **1 placement**

Rule:

- There is no hero on the vertical hub unless a vertical buyout is active.

---

## 3) Buyout scopes (canonical model)

Buyouts exist in these scopes:

- **guide**
- **city**
- **state** (PI-only)
- **vertical** (full vertical pack)

Buyouts are recorded in `data/buyouts.json` and resolved deterministically at build time.

---

## 4) Conflict + hierarchy doctrine (canonical)

### 4.1 Precedence (lowest → highest)

1. Guide buyout
2. City buyout
3. State buyout (PI only)
4. Vertical Pack Buyout

Rule: higher tiers override lower tiers only where they do not violate signed contracts.

### 4.2 Deferred Vertical Buyout (the $75K sale)
If a Guide / City / State buyout is already active, a Vertical Pack Buyout can still be sold as deferred:

- The vertical buyer receives all unsold inventory immediately.
- Inventory covered by active lower-tier contracts is excluded until expiry.
- Exclusions must be deterministically computed (no manual guessing) and logged.
- When a lower-tier contract expires, the vertical buyout automatically applies on the next build.

---

## 5) Runtime conversion mechanism (Next Steps CTA)

### 5.1 What the Next Steps page is

The Next Steps page is a **handoff-only runtime surface** used for PI buyouts.
It exists to route the consumer **directly to the buying firm’s secure intake system**.

The platform does **not** collect lead data.

---

### 5.2 Routing model (authoritative)

- Routing is **URL-based only**
- Destination is the sponsor-provided `intake_url`
- The URL is expected to be an external, secure inquiry form owned by the firm
- The platform never intermediates intake

**Explicitly not supported:**
- `mailto:` consumer routing
- Platform-hosted contact forms
- Multiple routing destinations

---

### 5.3 CTA copy (locked)

Button label (exact):
**“Continue to secure inquiry form”**

Supporting copy explains the user is being routed to a vetted provider serving their location.

---

### 5.4 Placement (Option A only)

- Appears only when a buyout is LIVE
- Rendered on eligible surfaces per hierarchy rules
- Suppressed when excluded by higher-priority contracts

---

### 5.5 Ownership boundaries

- Intake hours, call handling, and follow-up are **entirely the sponsor’s responsibility**
- Performance reporting is based on **inquiry counts**, not outcomes

## 6) Renderer contract (must match sales page)
 Renderer contract (must match sales page)

### 6.1 Shared (stacked) behavior
- Multiple sponsors may appear stacked within a placement.
- There is no side-by-side placement rendering.
- There is no rotation model.

### 6.2 Page-scope buyout behavior (guide/city/state)
Under a page-scope buyout:

- **Top placement renders hero-style**
- **All other placements for that surface still render**
- Exclusivity means only the buyout sponsor appears in those placements (subject to hierarchy rules)

### 6.3 Vertical buyout behavior
Under a LIVE vertical buyout:

- The runtime Next Steps CTA is enabled on eligible pages.
- Standard placements still render (fixed inventory), but **conversion surfaces like /for-providers/ must be removed** from sponsor blocks under LIVE buyouts.

---

## 7) Canonical “what we sell” summary (sales-parity checklist)

The for-providers page must match these claims exactly.

### 7.1 Shared tiers (monthly)
- **Guide — Shared (Stacked):** 2 placements (Top + Bottom), stacked sponsors
- **City — Shared (Stacked):** 3 placements (Top + Middle + Bottom), stacked sponsors

### 7.2 Buyout tiers (monthly unless stated)
- **Guide Buyout (Exclusive):** 2 placements (Top hero + Bottom), exclusive
- **City Buyout (Exclusive):** 3 placements (Top hero + Middle + Bottom), exclusive
- **State Buyout (PI-only):** 2 placements (Top hero + Middle), cumulative PI scope

### 7.3 Vertical Pack (total website) Buyout ($75,000)
- Includes vertical hub hero
- Enables runtime Next Steps CTA on eligible pages
- Can be deferred around existing lower-tier buyouts

---

## 8) Hard-fail validation checklist (must be enforced)

This checklist is required before any deploy and must be enforced by validators where possible.

### 8.1 Slot existence and counts (golden contract)
- City pages: exactly **1 Top + 1 Middle + 1 Bottom** placement markers exist
- Guide pages: exactly **1 Top + 1 Bottom** placement markers exist
- PI state pages: exactly **1 Top + 1 Middle** placement markers exist (PI pack only)

### 8.2 Hero invariants
- Hero styling must not appear unless a page-scope buyout is active for that page
- Hero styling is only an upgrade of the Top placement (no extra slot)

### 8.3 CTA contract (vertical buyout live)
If vertical buyout is LIVE:

- Eligible pages must render `data-next-steps-cta="true"`
- CTA copy must match canonical text exactly
- CTA must be suppressed on excluded pages under active lower-tier buyouts

If vertical buyout is NOT live:

- CTA must not render anywhere

### 8.4 Sales parity hard check (non-negotiable)
The output in `dist/for-providers/index.html` must match this document’s slot counts and rules. Any mismatch is SEV-1.

---

## 9) Manual verification steps (Owner + Day-0 VA)

### 9.1 For-providers parity
Open `/for-providers/` and confirm:

- Slot counts per surface match this doc
- No mention of rotation or side-by-side layouts
- Vertical pack buyout language matches the $75K scope
- PI state scope claims match the pack reality

### 9.2 Dist markers spot-check
Confirm expected markers exist on representative pages:

- `data-sponsored-placement="top"`
- `data-sponsored-placement="mid"` (city/state as applicable)
- `data-sponsored-placement="bottom"` (city/guide as applicable)
- `data-next-steps-cta="true"` only under LIVE vertical buyout

---

## 10) Red flags (do not allow)
- Any mention of rotation, randomized ordering, or auctions
- Side-by-side “two sponsors in one row” rendering
- Hero rendering without an active buyout
- Suppressing mid/bottom placements under page-scope buyouts while still selling them as included inventory
- CTA copy drifting from canonical text
