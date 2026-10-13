#!/usr/bin/env bash
set -euo pipefail
# senior-living has no generated guide set to upsert: its guides and its
# licensed-facility directory are authored sources. The upgrade step re-proves
# both. Refresh the directory itself with
#   python3 scripts/research/pull_senior_living_facilities.py
node scripts/validation/senior_living_facilities_contract.js
node scripts/validation/senior_living_guides_contract.js
