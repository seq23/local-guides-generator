#!/usr/bin/env bash
set -euo pipefail

echo "== Sponsor Verify =="
node scripts/sponsors/verify.js

echo "== Sample tree =="
ls -la data/sponsor_intake/sponsors || true
ls -la data/sponsors || true

echo "PASS ✅"
