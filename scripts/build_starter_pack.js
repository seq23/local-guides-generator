#!/usr/bin/env node
const { spawnSync } = require('node:child_process');
const env = { ...process.env, PAGE_SET_FILE: 'data/page_sets/starter_v1.json', LKG_ENV: 'training' };
function run(cmd, args) {
  const res = spawnSync(cmd, args, { stdio: 'inherit', env });
  if (res.status !== 0) process.exit(res.status || 1);
}
run('node', ['scripts/prepare_site.js']);
run('node', ['scripts/build_city_sites.js']);
run('node', ['scripts/sitemap_emit.js']);
run('node', ['scripts/llms_emit.js']);
run('node', ['scripts/citation_manifest_emit.js']);
run('node', ['scripts/indexnow_emit.js']);
run('node', ['scripts/distribution_manifest_emit.js']);
run('node', ['scripts/redirects_emit.js']);
run('node', ['scripts/snapshot_lkg.js']);
console.log('STARTER PACK BUILD PASS');
