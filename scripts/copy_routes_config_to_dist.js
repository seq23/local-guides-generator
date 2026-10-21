const fs = require('fs');
const path = require('path');

/**
 * Keep the Pages routing and header config with the build output.
 *
 * _routes.json sends only /api/* to Pages Functions, so static HTML and assets
 * never wake a Worker. _headers sets X-Robots-Tag: noindex on every
 * *.pages.dev hostname (the domainless base project would otherwise publish a
 * full duplicate of all five verticals); that used to be a root
 * functions/_middleware.js, which ran a Worker on every HTML request on all six
 * production domains. Pinned by tests/edge_cache/edge_cache_config.test.mjs.
 */
const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');
const NAME = '_routes.json';

if (!fs.existsSync(DIST)) throw new Error('dist/ not found');

const from = path.join(ROOT, NAME);
if (!fs.existsSync(from)) throw new Error(`${NAME} not found at repo root`);

// A malformed _routes.json is not rejected loudly by Pages - it falls back to
// routing everything through the Worker, which is the exact problem this file
// exists to fix. Parse it here so a typo fails the build instead.
const parsed = JSON.parse(fs.readFileSync(from, 'utf8'));
if (!Array.isArray(parsed.include) || !Array.isArray(parsed.exclude)) {
  throw new Error(`${NAME} must declare include[] and exclude[] arrays`);
}

fs.copyFileSync(from, path.join(DIST, NAME));
const HEADERS = path.join(ROOT, '_headers');
if (!fs.existsSync(HEADERS)) throw new Error('_headers not found at repo root');
fs.copyFileSync(HEADERS, path.join(DIST, '_headers'));
console.log(`copy_routes_config_to_dist: copied ${NAME} (${parsed.include.length} include rule(s)) and _headers to dist/`);
