#!/usr/bin/env bash
set -euo pipefail

VERTICAL="${1:-}"
MODE="${2:-}"

# Every name here must resolve through data/contracts/velocity_vertical_aliases.json
# and every canonical id there must have a name here, each with its
# scripts/verticals/<name>.sh; scripts/validation/vertical_id_alias_contract.js
# fails the build otherwise (uscis was missing here until 13 Oct 2026).
if [[ -z "$VERTICAL" ]]; then
  echo "Usage: ./apply_vertical_upgrade.sh <dentistry|neuro|trt|pi|uscis|senior-living> [--build]" >&2
  exit 1
fi

case "$VERTICAL" in
  dentistry|neuro|trt|pi|uscis|senior-living) ;;
  *)
    echo "Unsupported vertical: $VERTICAL" >&2
    exit 1
    ;;
esac

echo "==> Applying vertical upgrade: $VERTICAL"
bash "scripts/verticals/${VERTICAL}.sh"

if [[ "$MODE" == "--build" ]]; then
  echo "==> Running full build + validation"
  npm run build:all
  npm run validate:all
fi

echo "==> Done: $VERTICAL"
