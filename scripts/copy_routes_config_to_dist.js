const fs = require('fs');
const path = require('path');

/**
 * Keep the Pages Functions route config with the build output.
 *
 * Why this exists. functions/_middleware.js sets X-Robots-Tag: noindex on any
 * *.pages.dev hostname, which is the only way to stop the domainless base
 * project publishing a full duplicate of all five verticals — the hostname is
 * known per request, not at build time, so it cannot live in the generator.
 * But with no _routes.json, adding a root middleware widens the Functions route
 * from /api/* to /*, so every request on all five production domains invokes a
 * Worker, static assets included.
 *
 * _routes.json narrows that back down. The middleware still runs for HTML, where
 * the hostname check matters, and assets are served straight from the edge.
 * Excluding by extension rather than by directory covers the generated files
 * (sitemaps, llms.txt, citation manifests) that sit at the dist root alongside
 * the pages.
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
console.log(`copy_routes_config_to_dist: copied ${NAME} to dist/ (${parsed.exclude.length} exclude rules)`);
