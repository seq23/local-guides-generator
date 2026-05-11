#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const args = new Set(process.argv.slice(2));
const mode = args.has('--post') ? 'post' : 'pre';
const root = process.cwd();
const watchlistPath = path.join(root, 'docs', 'releases', 'CRITICAL_SURFACES.json');
const allowDelete = process.env.LKG_ALLOW_CRITICAL_DELETE === '1';

function fail(message) {
  console.error(`❌ RELEASE GUARD (${mode}) FAIL: ${message}`);
  process.exit(1);
}

if (!fs.existsSync(watchlistPath)) {
  fail(`missing watchlist: ${watchlistPath}`);
}

let watchlist;
try {
  watchlist = JSON.parse(fs.readFileSync(watchlistPath, 'utf8'));
} catch (error) {
  fail(`unable to parse watchlist: ${error.message}`);
}

const groups = watchlist.critical_surfaces || {};
const missing = [];
for (const [group, relPaths] of Object.entries(groups)) {
  for (const relPath of relPaths) {
    const absPath = path.join(root, relPath);
    if (!fs.existsSync(absPath)) {
      missing.push({ group, relPath });
    }
  }
}

if (missing.length > 0) {
  const formatted = missing.map(item => `- [${item.group}] ${item.relPath}`).join('\n');
  if (!allowDelete) {
    fail(`critical surfaces missing:\n${formatted}\n\nSet LKG_ALLOW_CRITICAL_DELETE=1 only for an intentional, approved removal.`);
  }
  console.warn(`⚠️ RELEASE GUARD (${mode}) WARNING: critical surfaces missing but override enabled:\n${formatted}`);
} else {
  console.log(`✅ RELEASE GUARD (${mode}) PASS`);
}
