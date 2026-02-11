#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const repoRoot = process.cwd();
const distRoot = path.join(repoRoot, 'dist');
const outDir = path.join(distRoot, 'verification');
const outHtml = path.join(outDir, 'index.html');
const outJson = path.join(distRoot, '_verification.json');

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function nowUtcIso() {
  return new Date().toISOString();
}

const refreshedAt = nowUtcIso();
const VERTICAL = process.env.LKG_VERTICAL || 'all';
const NOTES = process.env.LKG_NOTES || '';
const CADENCE = process.env.LKG_CADENCE || 'nightly integrity + rotating vertical refresh';

const verification = {
  version: 'LKG_VERIFICATION_V1',
  refreshed_at_utc: refreshedAt,
  rotating_focus: VERTICAL,
  cadence: CADENCE,
  notes: NOTES,
  runbook: {
    validate_all: 'npm run validate:all',
    refresh_page: 'node scripts/automation/refresh_verification_page.js',
    snapshot: 'node scripts/snapshot_lkg.js',
  },
};

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Verification & Updates</title>
  <meta name="description" content="How this directory is verified, validated, and updated over time." />
  <link rel="canonical" href="https://example.com/verification/" />
  <style>
    body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;margin:0;background:#fff;color:#111}
    main{max-width:860px;margin:0 auto;padding:32px 18px 64px}
    h1{font-size:28px;margin:0 0 8px}
    h2{font-size:18px;margin:26px 0 8px}
    p,li{line-height:1.5}
    code,pre{background:#f6f6f6;border:1px solid #e5e5e5;border-radius:8px}
    pre{padding:12px;overflow:auto}
    .meta{margin:10px 0 18px;padding:12px 14px;border:1px solid #e5e5e5;border-radius:10px;background:#fafafa}
    .meta strong{display:inline-block;min-width:160px}
    .small{font-size:13px;color:#444}
    a{color:#0b57d0;text-decoration:none}
    a:hover{text-decoration:underline}
  </style>
</head>
<body>
<main>
  <h1>Verification & Updates</h1>
  <p class="small">This page is intentionally plain and operational. It exists to make updates auditable.</p>

  <div class="meta">
    <div><strong>Last refreshed (UTC):</strong> ${refreshedAt}</div>
    <div><strong>Rotating focus:</strong> ${VERTICAL}</div>
    <div><strong>Cadence:</strong> ${CADENCE}</div>
    ${NOTES ? `<div><strong>Notes:</strong> ${NOTES}</div>` : ``}
  </div>

  <h2>What gets checked</h2>
  <ul>
    <li><strong>Schema / contracts:</strong> buyouts schema, exports contract, Next Steps CTA contract.</li>
    <li><strong>Coverage authority:</strong> inventory ↔ runtime parity (SEV‑1 hard‑fail when configured).</li>
    <li><strong>Sales parity:</strong> canonical ad inventory in docs must match what is rendered publicly.</li>
    <li><strong>Link integrity:</strong> internal links and required public pages are audited.</li>
  </ul>

  <h2>What triggers changes</h2>
  <ul>
    <li>New states/cities added to authoritative inventories.</li>
    <li>New sponsor / buyout rules, contracts, or compliance updates.</li>
    <li>Bug fixes to generators, validators, or templates.</li>
  </ul>

  <h2>What does <em>not</em> change</h2>
  <ul>
    <li>No rankings or “best of” endorsements.</li>
    <li>No legal advice or case evaluation.</li>
    <li>No guarantees of outcomes.</li>
  </ul>

  <h2>How to independently verify</h2>
  <ol>
    <li>Review repository commits and automation logs.</li>
    <li>Run <code>npm run validate:all</code> locally.</li>
    <li>Confirm the canonical ad inventory doc matches the embedded JSON on <code>/for-providers/</code>.</li>
  </ol>

  <h2>Machine-readable snapshot</h2>
  <pre>${JSON.stringify(verification, null, 2)}</pre>

  <p class="small">Related: <a href="/methodology/">Methodology</a> · <a href="/for-providers/">Advertising</a> · <a href="/disclaimer/">Disclaimer</a></p>
</main>
</body>
</html>
`;

ensureDir(outDir);
fs.writeFileSync(outHtml, html);
fs.writeFileSync(outJson, JSON.stringify(verification, null, 2) + '\n');
console.log('OK: refreshed', path.relative(repoRoot, outHtml));
console.log('OK: refreshed', path.relative(repoRoot, outJson));
