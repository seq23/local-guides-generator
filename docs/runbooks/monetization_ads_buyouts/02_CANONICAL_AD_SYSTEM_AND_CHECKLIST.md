# CANONICAL AD SYSTEM + CHECKLIST (AUTHORITATIVE)

This document is the source-of-truth contract for runtime, sales page, and validation.

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
    "state": {
      "placements": [
        "top",
        "mid"
      ],
      "shared_model": "stacked",
      "buyout": {
        "exclusive": true,
        "top_upgrades_to": "hero"
      },
      "availability": "buyout_or_runtime_only"
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
      },
      "availability": "state_buyout_only"
    },
    "vertical_hub": {
      "placements": [
        "hero"
      ],
      "buyout_only": true
    }
  },
  "products": {
    "city_shared_placement": {
      "includes": [
        "city"
      ],
      "excludes": [
        "state",
        "guide_tier",
        "vertical_hub",
        "cta_buyout"
      ],
      "model": "stacked"
    },
    "city_buyout": {
      "includes": [
        "city"
      ],
      "exclusive": true,
      "top_upgrades_to": "hero",
      "excludes": [
        "state",
        "guide_tier",
        "vertical_hub",
        "cta_buyout"
      ]
    },
    "state_buyout_pi": {
      "includes": [
        "state_pi",
        "covered_city_pages_in_state"
      ],
      "exclusive": true,
      "top_upgrades_to": "hero",
      "expansion_right": "additional_cities_within_same_state_upon_request",
      "excludes": [
        "guide_tier",
        "vertical_hub"
      ]
    },
    "vertical_buyout": {
      "includes": [
        "vertical_hub",
        "guide",
        "city",
        "state",
        "hero_buyout_behavior",
        "sponsor_form_routing"
      ]
    }
  },
  "runtime_conversion_flow": {
    "cta_model": "three_cta_buttons_remain_live",
    "buyout_behavior": "hero_ad_on_top_placement_with_sponsor_form_routing",
    "eligible_surfaces": [
      "vertical_hub",
      "city",
      "guide",
      "state",
      "state_pi"
    ],
    "lead_destination": "all_leads_go_to_sponsor_when_sponsor_flow_is_active"
  }
}
```

## Public-facing inventory checklist
- City Shared Placement + City Buyout + State Buyout (PI only) + Vertical Buyout are the only public-facing sponsorship products
- Guide pages remain eligible runtime surfaces
- Vertical hub / homepage visibility is a real runtime surface and must be named on the sales page
- Shared placement visuals should be shown for city and state examples
- Buyout hero visuals should be shown for city, state, guide, and vertical hub / homepage examples
- Sponsor lead-form flow should be shown with a note that leads go to sponsor
- Guide buyout does not exist as a standalone public-facing product
- State shared placement does not exist as a standalone public-facing product
- The /for-providers/ page must not use internal validator / contract-enforcement copy as sponsor-facing messaging
