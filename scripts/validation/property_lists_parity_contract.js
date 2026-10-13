#!/usr/bin/env node
'use strict';
/**
 * Hard-fail: every property this repo deploys is in every list that measures it.
 *
 * The deploy list is scripts/lib/pack_site_config.js (each entry is a
 * Cloudflare Pages project built with that pack's PAGE_SET_FILE) plus the
 * Deploy Distribution matrix. Each of those hosts must also be in:
 *   - data/search_intelligence/sites.json (the daily measured loop: Search
 *     Console truth, CTA clicks, search plan, publishing freeze);
 *   - distribution.config.json indexnow.hosts and gsc.sites (post-deploy
 *     IndexNow ping and sitemap submission);
 *   - scripts/build_all_packs.js PACKS (the CI build and hygiene validators);
 *   - data/clarity_projects.json projects, or its pending list with a reason;
 *   - data/site_brand_assets.json hosts (favicon and og:image).
 * A property added to one list and not the others is a site nobody measures,
 * which is the defect this guards (memphisseniorcarehomes.com, 13 Oct 2026).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const { PACK_SITE_CONFIG } = require('../lib/pack_site_config');

function check(lists) {
  const out = [];
  if (!lists.deploy.length) out.push('the deploy list is empty; nothing to check');
  for (const host of lists.deploy) {
    for (const [name, set] of Object.entries(lists.measured)) {
      if (!set.has(host)) out.push(`${host} is deployed but missing from ${name}`);
    }
  }
  return out;
}

const deployHosts = Object.entries(PACK_SITE_CONFIG).filter(([k]) => k !== 'starter').map(([, c]) => new URL(c.siteUrl).hostname);
const wf = read('.github/workflows/deploy-distribution.yml');
const matrixHosts = [...wf.matchAll(/gsc_site:\s*sc-domain:([a-z0-9.-]+)/g)].map((m) => m[1]);
const deploy = [...new Set([...deployHosts, ...matrixHosts])];

const dist = JSON.parse(read('distribution.config.json'));
const clarity = JSON.parse(read('data/clarity_projects.json'));
const packsSrc = read('scripts/build_all_packs.js');
const packFiles = [...packsSrc.matchAll(/'data\/page_sets\/examples\/([a-z_]+_v1\.json)'/g)].map((m) => m[1]);
const builtHosts = new Set(Object.values(PACK_SITE_CONFIG).filter((c) => c.pageSetSlugs.some((s) => packFiles.includes(s))).map((c) => new URL(c.siteUrl).hostname));

const lists = {
  deploy,
  measured: {
    'data/search_intelligence/sites.json': new Set(JSON.parse(read('data/search_intelligence/sites.json')).sites.map((s) => s.host)),
    'distribution.config.json indexnow.hosts': new Set(dist.indexnow.hosts),
    'distribution.config.json gsc.sites': new Set(dist.gsc.sites.map((s) => s.host)),
    'the Deploy Distribution matrix': new Set(matrixHosts),
    'scripts/build_all_packs.js PACKS': builtHosts,
    'data/clarity_projects.json (projects or pending)': new Set([...Object.keys(clarity.projects || {}), ...Object.keys(clarity.pending || {})]),
    'data/site_brand_assets.json hosts': new Set(Object.keys(JSON.parse(read('data/site_brand_assets.json')).hosts)),
  },
};

const problems = check(lists);
// Negative proof every run: a deployed host absent from the measured loop must fail.
const hostile = check({ deploy: ['example-new-site.com'], measured: { 'sites.json': new Set(deploy) } });
if (!hostile.length) problems.push('negative proof no longer caught: deployed host missing from the measured loop');

if (problems.length) {
  console.error('PROPERTY LISTS PARITY CONTRACT FAIL');
  problems.forEach((p) => console.error('  - ' + p));
  process.exit(1);
}
console.log(`✅ PROPERTY LISTS PARITY CONTRACT PASS (${deploy.length} deployed properties, each in ${Object.keys(lists.measured).length} measurement lists)`);
