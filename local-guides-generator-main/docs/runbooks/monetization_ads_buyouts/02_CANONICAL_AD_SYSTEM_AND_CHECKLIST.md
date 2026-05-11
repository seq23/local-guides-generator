# CANONICAL AD SYSTEM AND CHECKLIST

This document is the authoritative source for the sponsorship model. The active model is buyout-only and CTA-driven.

```json
{
  "version": "CANONICAL_AD_INVENTORY_V1",
  "model": "buyout_only_cta_and_lead_flow",
  "surfaces": {
    "guide": {
      "placements": [
        "top",
        "bottom"
      ],
      "availability": "vertical_buyout_only",
      "cta_source_of_truth": "runtime",
      "lead_flow": "sponsor_when_buyout_active"
    },
    "city": {
      "placements": [
        "top",
        "mid",
        "bottom"
      ],
      "availability": "city_buyout_or_vertical_buyout_when_covered",
      "cta_source_of_truth": "runtime",
      "lead_flow": "sponsor_when_buyout_active"
    },
    "state": {
      "placements": [
        "top",
        "mid"
      ],
      "availability": "state_buyout_or_vertical_buyout_when_covered",
      "cta_source_of_truth": "runtime",
      "lead_flow": "sponsor_when_buyout_active"
    },
    "state_pi": {
      "placements": [
        "top",
        "mid"
      ],
      "availability": "state_buyout_or_vertical_buyout_when_covered",
      "cta_source_of_truth": "runtime",
      "lead_flow": "sponsor_when_buyout_active"
    },
    "vertical_hub": {
      "placements": [
        "hero"
      ],
      "availability": "vertical_buyout_only",
      "cta_source_of_truth": "runtime",
      "lead_flow": "sponsor_when_buyout_active"
    }
  },
  "products": {
    "city_buyout": {
      "includes": [
        "city_cta_layer",
        "city_lead_flow",
        "directory_entry_cta_when_present"
      ]
    },
    "state_buyout": {
      "includes": [
        "state_cta_layer",
        "state_lead_flow",
        "directory_entry_cta_when_present"
      ]
    },
    "vertical_buyout": {
      "includes": [
        "vertical_hub",
        "guide",
        "cta_layer",
        "lead_flow",
        "up_to_10_cities",
        "corresponding_states"
      ],
      "pi_city_pages_rendered": false,
      "additional_city_pricing": "contract_required"
    }
  },
  "runtime_conversion_flow": {
    "surface_renderer": "shared_sponsor_surface_renderer",
    "cta_model": "runtime_ctas_are_source_of_truth",
    "directory_feature_rule": "cta_above_directory_becomes_sponsor_feature_surface",
    "lead_destination": "all_leads_go_to_sponsor_when_buyout_is_active",
    "training_behavior": "starter_v1_may_replay_the_same_surface_modes_using_fake_sponsor_data"
  },
  "guardrails": {
    "cta_adjacency": "forbidden",
    "guide_shared_inventory": "forbidden",
    "directory_reordering": "forbidden"
  }
}
```

## Required Checks

- CTA ownership switches under buyout
- Lead form routes correctly under buyout
- CTA above directory exists where a directory exists
- No adjacent CTAs
- Guide pages only show sponsor behavior under vertical buyout
- Runtime CTAs remain the source of truth
