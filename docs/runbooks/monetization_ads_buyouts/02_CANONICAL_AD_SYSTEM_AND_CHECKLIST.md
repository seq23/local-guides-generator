# CANONICAL AD SYSTEM + CHECKLIST (AUTHORITATIVE)

This document is the source-of-truth contract for runtime, sales page, and validation.

```json
{
  "version": "CANONICAL_AD_INVENTORY_V1",
  "surfaces": {
    "guide": {
      "placements": ["top", "bottom"],
      "availability": "vertical_buyout_only",
      "buyout": {"exclusive": true, "top_upgrades_to": "hero"}
    },
    "city": {
      "placements": ["top", "mid", "bottom"],
      "availability": "city_and_state_placement_or_buyout",
      "buyout": {"exclusive": true, "top_upgrades_to": "hero"}
    },
    "state": {
      "placements": ["top", "mid"],
      "availability": "city_and_state_placement_or_statewide_buyout",
      "buyout": {"exclusive": true, "top_upgrades_to": "hero"}
    },
    "state_pi": {
      "placements": ["top", "mid"],
      "availability": "city_and_state_placement_or_statewide_buyout",
      "buyout": {"exclusive": true, "top_upgrades_to": "hero"}
    },
    "vertical_hub": {
      "placements": ["hero"],
      "buyout_only": true
    }
  },
  "products": {
    "city_and_state_placement": {
      "includes": ["city", "state"],
      "excludes": ["guide", "vertical_hub", "cta_buyout"]
    },
    "statewide_buyout": {
      "includes": ["state", "selected_cities_up_to_10"],
      "excludes": ["guide", "vertical_hub", "cta_buyout"],
      "extra_city_pricing": "contract_required"
    },
    "vertical_buyout": {
      "includes": ["vertical_hub", "guide", "city", "state", "cta_buyout"]
    }
  },
  "runtime_next_steps_cta": {
    "enabled_when": "vertical_buyout_live_or_pi_state_buyout_live_on_state_page",
    "copy": "Review the local next-step guide before choosing a provider.",
    "button": "View next steps",
    "eligible_surfaces": ["vertical_hub", "city", "guide", "state"],
    "hero_button_rule": "hero_cta_must_route_to_same_next_steps_path"
  }
}
```

## Checklist
- City & State Placement never sells homepage or guide inventory
- Statewide Buyout = state page + up to 10 selected cities
- Guides are vertical-buyout-only
- Homepage is vertical-buyout-only
- CTA buyout is vertical-buyout-only
