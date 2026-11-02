#!/usr/bin/env node
/* eslint-disable no-console */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');

function run(cmd, env = {}) {
  console.log(`$ ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd: repoRoot, env: { ...process.env, ...env } });
}

function yyyyMmDd(d) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addChangelogEntry(lines) {
  const changelogPath = path.join(repoRoot, 'CHANGELOG.md');
  const now = new Date();
  const dateKey = yyyyMmDd(now);
  let s = fs.existsSync(changelogPath) ? fs.readFileSync(changelogPath, 'utf8') : '# Changelog\n\n';

  if (!s.includes(`# ${dateKey}`)) {
    const m = s.match(/^#\s+Changelog\s*\n+/);
    if (m) {
      const idx = m[0].length;
      s = s.slice(0, idx) + `# ${dateKey}\n` + s.slice(idx);
    } else {
      s = `# Changelog\n\n# ${dateKey}\n\n` + s;
    }
  }

  const idx = s.indexOf(`# ${dateKey}\n`);
  let afterHeader = s.slice(idx + (`# ${dateKey}\n`).length);
  if (!afterHeader.startsWith('\n')) afterHeader = '\n' + afterHeader;

  const insert = lines.map(l => `- ${l}`).join('\n') + '\n';
  const firstBlank = afterHeader.indexOf('\n');
  const newAfter = afterHeader.slice(0, firstBlank + 1) + insert + afterHeader.slice(firstBlank + 1);
  s = s.slice(0, idx + (`# ${dateKey}\n`).length) + newAfter;

  fs.writeFileSync(changelogPath, s);
}

function ensureSiteJsonBootstrapped(chosenKey) {
  const siteJsonPath = path.join(repoRoot, 'data', 'site.json');

  if (fs.existsSync(siteJsonPath)) return;

  // One list: scripts/lib/pack_site_config.js (it used to be copied here and
  // drifted; senior_living was missing from both copies).
  const { PACK_SITE_CONFIG } = require('../lib/pack_site_config');
  const cfg = PACK_SITE_CONFIG[chosenKey];
  const packConfigMap = cfg ? { [chosenKey]: { brandName: cfg.brandName, siteUrl: cfg.siteUrl, pageSetFile: `data/page_sets/examples/${cfg.pageSetSlugs[0]}` } } : {};
  const pack = packConfigMap[chosenKey];
  if (!pack) {
    throw new Error(`No bootstrap site config found for vertical: ${chosenKey}`);
  }

  fs.writeFileSync(siteJsonPath, JSON.stringify(pack, null, 2) + '\n');
  console.log(`Bootstrapped data/site.json for ${chosenKey}`);
}
const now = new Date();
const day = now.getUTCDay(); // 0 Sun..6 Sat
const { PACK_SITE_CONFIG } = require('../lib/pack_site_config');
const rotation = Object.entries(PACK_SITE_CONFIG)
  .filter(([key]) => key !== 'starter')
  .map(([key, cfg]) => ({ key, label: cfg.brandName }));
const chosen = rotation[day % rotation.length];

const notes = `Rotating refresh focus: ${chosen.label}.`;

const pageSetMap = {
  ...Object.fromEntries(rotation.map(({ key }) => [key, `data/page_sets/examples/${PACK_SITE_CONFIG[key].pageSetSlugs[0]}`])),
};

const pageSetFile = pageSetMap[chosen.key];
if (!pageSetFile) {
  throw new Error(`No page set mapping found for vertical: ${chosen.key}`);
}

ensureSiteJsonBootstrapped(chosen.key);

// Build the chosen pack with `npm run build` - the same page-mutating steps, in
// the same order, as scripts/build_all_packs.js - so refresh:verification's
// lastmod_apply.js below hashes the page that ships.
//
// What this replaced, and what it cost. This used to run build_city_sites.js
// alone, without retrofit_recommendation_summary, install_clarity,
// install_site_head_assets and apply_robots_policy (which rewrites <main>). So
// this step hashed a different page than the ledger's producer did, every page
// looked changed, and lastmod_apply.js wrote that different hash with today's
// date. The record step's `build_all_packs.js --refresh-ledger` then put the
// real hash back but kept today's date: 176 uscisexam.com entries moved lastmod
// forward on unchanged content (1 and 2 Nov 2026, runs 41311930760 and 41454308802), which
// lastmod_date_invariant_contract.js caught. It also passed `--page-set`, a flag
// build_city_sites.js never read, so the pack built was whatever data/site.json
// held, not the vertical the rotation chose. PAGE_SET_FILE is what
// prepare_site.js (the first step of `npm run build`) actually reads.
// scripts/validation/lastmod_hash_point_contract.js pins this pipeline.
run('npm run build', {
  PAGE_SET_FILE: pageSetFile,
  LKG_ENV: 'baseline',
});

run('npm run refresh:verification', {
  PAGE_SET_FILE: pageSetFile,
  LKG_VERTICAL: chosen.key,
  LKG_NOTES: notes,
  LKG_CADENCE: 'nightly integrity + rotating vertical refresh',
  LKG_ENV: 'baseline',
});

run('node scripts/snapshot_lkg.js');

addChangelogEntry([
  `Revalidated core contracts and inventories (rotating focus: ${chosen.label}).`,
  'Updated Verification & Updates page and machine-readable snapshot.',
]);

console.log('DONE rotate refresh:', chosen.key);
