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
  "runtime_next_steps_cta": {
    "enabled_when": "vertical_buyout_live_or_pi_state_buyout_live_on_state_page",
    "copy": "Review the local next-step guide before choosing a provider.",
    "button": "View next steps",
    "placement_option": "A",
    "eligible_surfaces": [
      "vertical_hub",
      "city",
      "guide",
      "state",
      "state_pi"
    ],
    "suppressed_when": "excluded_by_active_lower_tier_contract"
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
        "cta_buyout"
      ]
    }
  }
}
```

## Checklist
- City Shared Placement + City Buyout + State Buyout (PI only) + Vertical Buyout never sells homepage or guide inventory
- Statewide Buyout = state page + up to 10 selected cities
- Guides are vertical-buyout-only
- Homepage is vertical-buyout-only
- CTA buyout is vertical-buyout-only
