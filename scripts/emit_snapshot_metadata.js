#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

function run(command) {
  try {
    return cp.execSync(command, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return 'unknown';
  }
}

function readSitePack(root) {
  try {
    const sitePath = path.join(root, 'data', 'site.json');
    const site = JSON.parse(fs.readFileSync(sitePath, 'utf8'));
    return site.pageSetFile || site.siteUrl || 'unknown';
  } catch {
    return 'unknown';
  }
}

const root = process.cwd();
const watchlistPath = path.join(root, 'docs', 'releases', 'CRITICAL_SURFACES.json');
let watchlistVersion = 'unknown';
try {
  const watchlist = JSON.parse(fs.readFileSync(watchlistPath, 'utf8'));
  watchlistVersion = String(watchlist.version ?? 'unknown');
} catch {}

const metadata = {
  repo: 'local-guides-generator',
  source_commit: process.env.GIT_SHA || run('git rev-parse --short HEAD'),
  artifact_sha256: process.env.ARTIFACT_SHA || 'unknown',
  active_pack: process.env.ACTIVE_PACK || readSitePack(root),
  timestamp: new Date().toISOString(),
  validate_all: process.env.VALIDATE_ALL_STATUS || 'unknown',
  qa_release: process.env.QA_RELEASE_STATUS || 'unknown',
  release_guard: process.env.RELEASE_GUARD_STATUS || 'unknown',
  watchlist_version: watchlistVersion
};

const outPath = path.join(root, 'SNAPSHOT_METADATA.json');
fs.writeFileSync(outPath, JSON.stringify(metadata, null, 2) + '\n');
console.log(`WROTE ${outPath}`);
