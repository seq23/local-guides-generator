// Static HTML stays edge-cacheable and dynamic endpoints stay dynamic.
//
// 21 Oct 2026: every HTML page on the six canonical sites answered
// cf-cache-status: DYNAMIC (Ahrefs: "Slow page" on dentistryguides 69,
// theaccidentguides 59, uscisexam 30). Two causes, both pinned here:
//  1. a root functions/_middleware.js plus _routes.json include ["/*"] put a
//     Worker in front of every HTML request;
//  2. no zone cache rule, and Cloudflare never caches HTML by default.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = new URL('../../', import.meta.url).pathname;
const routes = JSON.parse(fs.readFileSync(path.join(ROOT, '_routes.json'), 'utf8'));
const headers = fs.readFileSync(path.join(ROOT, '_headers'), 'utf8');
const { cacheRule, CONFIG } = require('../../scripts/cloudflare/apply_edge_cache.js');
const { PACK_SITE_CONFIG } = require('../../scripts/lib/pack_site_config.js');

function functionFiles(dir, base = '') {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base + '/' + e.name;
    if (e.isDirectory()) out.push(...functionFiles(path.join(dir, e.name), rel));
    else if (/\.(js|ts|mjs)$/.test(e.name)) out.push(rel);
  }
  return out;
}

test('_routes.json sends only /api/* to Functions', () => {
  assert.deepEqual(routes.include, ['/api/*']);
  assert.ok(!routes.include.some((r) => r === '/*' || r === '/'), 'a catch-all include puts a Worker in front of every page');
});

test('every Pages Function lives under /api/ (so _routes.json reaches it) and none is a middleware', () => {
  const files = functionFiles(path.join(ROOT, 'functions'));
  assert.ok(files.length > 0, 'no functions found: the check examined nothing');
  for (const f of files) {
    assert.ok(f.startsWith('/api/'), `${f} is outside /api/ and would be unreachable or would widen the route`);
    assert.ok(!/_middleware\./.test(f), `${f}: a middleware runs a Worker in front of static pages`);
  }
});

test('_headers keeps every pages.dev hostname out of the index', () => {
  assert.match(headers, /^https:\/\/:project\.pages\.dev\/\*\n\s+X-Robots-Tag: noindex/m);
  assert.match(headers, /^https:\/\/:version\.:project\.pages\.dev\/\*\n\s+X-Robots-Tag: noindex/m);
  assert.ok(!/^\/\*\n[\s\S]*?Cache-Control:\s*(no-store|private)/im.test(headers), 'a site-wide no-store/private header would defeat the edge cache');
});

test('the edge cache rule covers every canonical site and caches static HTML for hours, never /api/', () => {
  const hosts = Object.values(PACK_SITE_CONFIG).map((c) => new URL(c.siteUrl).hostname).filter((h) => !h.endsWith('.pages.dev'));
  assert.ok(hosts.length >= 6, `expected the six canonical hosts, found ${hosts.length}`);
  const zones = CONFIG.sites.map((s) => s.zone);
  for (const h of hosts) assert.ok(zones.includes(h.replace(/^www\./, '')), `${h} has no edge cache rule in config/edge_cache.json`);
  const rule = cacheRule(CONFIG);
  assert.equal(rule.action, 'set_cache_settings');
  assert.equal(rule.action_parameters.cache, true);
  assert.equal(rule.action_parameters.edge_ttl.mode, 'override_origin');
  assert.ok(rule.action_parameters.edge_ttl.default >= 3600, 'edge TTL under an hour barely helps a crawl');
  assert.match(rule.expression, /not starts_with\(http\.request\.uri\.path, "\/api\/"\)/);
  assert.ok(rule.enabled);
});

test('the deploy workflow applies the rule and purges every zone after Pages deploys', () => {
  const wf = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'edge_cache.yml'), 'utf8');
  assert.match(wf, /branches:\s*\[\s*main\s*\]/);
  for (const step of ['apply_edge_cache.js rules', 'apply_edge_cache.js wait', 'apply_edge_cache.js purge']) assert.ok(wf.includes(step), `edge_cache.yml is missing: ${step}`);
  assert.match(wf, /CLOUDFLARE_EDGE_CACHE_TOKEN: \$\{\{ secrets\.CLOUDFLARE_EDGE_CACHE_TOKEN \}\}/);
});
