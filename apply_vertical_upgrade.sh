#!/usr/bin/env bash
set -euo pipefail

VERTICAL="${1:-}"
MODE="${2:-}"

if [[ -z "$VERTICAL" ]]; then
  echo "Usage: ./apply_vertical_upgrade.sh <dentistry|neuro|trt|pi> [--build]" >&2
  exit 1
fi

case "$VERTICAL" in
  dentistry|neuro|trt|pi) ;;
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
