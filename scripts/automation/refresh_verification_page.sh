#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DIST="$ROOT/dist"
OUT_DIR="$DIST/verification"
OUT="$OUT_DIR/index.html"

mkdir -p "$OUT_DIR"

UTC_NOW="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
SHA="${GITHUB_SHA:-unknown}"
RUN_ID="${GITHUB_RUN_ID:-local}"
REPO_SLUG="${GITHUB_REPOSITORY:-local}"

# Optional: include latest release ids if present
RELEASES_JSON="$ROOT/releases/releases_index.json"
LATEST_RELEASES=""
if [[ -f "$RELEASES_JSON" ]]; then
  # grab up to 10 most recent keys/ids using node if available, else raw
  if command -v node >/dev/null 2>&1; then
    LATEST_RELEASES="$(node -e 'const fs=require("fs");const j=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
      const arr=(j.releases||j||[]);
      const items=Array.isArray(arr)?arr:(arr.releases||[]);
      const out=items.slice(0,10).map(x=>x.id||x.ts||x.name||JSON.stringify(x)).join("\n");
      console.log(out);' "$RELEASES_JSON" 2>/dev/null || true)"
  fi
fi

cat > "$OUT" <<HTML
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Verification & Update Log</title>
  <meta name="robots" content="index,follow" />
  <link rel="canonical" href="/verification/" />
  <style>
    body{font-family:system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:900px;margin:32px auto;padding:0 16px;line-height:1.5}
    code,pre{background:#f5f5f5;padding:2px 6px;border-radius:6px}
    pre{padding:12px;overflow:auto}
    .card{border:1px solid #e6e6e6;border-radius:12px;padding:16px;margin:16px 0}
    h1{font-size:28px;margin:0 0 8px}
    h2{font-size:18px;margin:24px 0 8px}
    ul{margin:8px 0 0 20px}
  </style>
</head>
<body>
  <h1>Verification & Update Log</h1>
  <p>This page exists to provide a human- and crawler-readable record of what this site is, how it is maintained, and when it was last refreshed.</p>

  <div class="card">
    <h2>Current Build</h2>
    <ul>
      <li><b>Last refreshed (UTC):</b> <code>${UTC_NOW}</code></li>
      <li><b>Repository:</b> <code>${REPO_SLUG}</code></li>
      <li><b>Commit:</b> <code>${SHA}</code></li>
      <li><b>Workflow run:</b> <code>${RUN_ID}</code></li>
    </ul>
  </div>

  <div class="card">
    <h2>What this site is</h2>
    <ul>
      <li>Local guides + educational resources.</li>
      <li>No legal advice. No endorsements. No guarantee of outcomes.</li>
      <li>Advertising/sponsorship appears only when explicitly marked and contractually enabled.</li>
    </ul>
  </div>

  <div class="card">
    <h2>Key Policies</h2>
    <ul>
      <li><a href="/disclaimer/">Disclaimer</a></li>
      <li><a href="/privacy/">Privacy</a></li>
      <li><a href="/methodology/">Methodology</a></li>
      <li><a href="/for-providers/">Advertising & Provider Info</a></li>
      <li><a href="/contact/">Contact</a></li>
    </ul>
  </div>

  <div class="card">
    <h2>Recent Release IDs</h2>
    <p>(If available)</p>
    <pre>${LATEST_RELEASES}</pre>
  </div>

  <div class="card">
    <h2>Verification Notes</h2>
    <ul>
      <li>This file is regenerated on a schedule to provide a stable, auditable freshness signal.</li>
      <li>Core validation is executed in CI; failures prevent updates from being committed.</li>
    </ul>
  </div>

</body>
</html>
HTML

# Also bump a simple build marker
BUILD_JSON="$DIST/_build.json"
cat > "$BUILD_JSON" <<JSON
{"refreshed_utc":"${UTC_NOW}","repo":"${REPO_SLUG}","sha":"${SHA}","run_id":"${RUN_ID}"}
JSON

echo "OK: wrote $OUT and $BUILD_JSON"
