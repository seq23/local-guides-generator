const fs = require('fs');
const path = require('path');
const { resolveIndexNowKey } = require('./lib/resolve_indexnow_key');

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');

if (!fs.existsSync(DIST)) {
  throw new Error('dist/ not found');
}

const resolved = resolveIndexNowKey();
const from = path.join(ROOT, resolved.keyFile);
const to = path.join(DIST, resolved.keyFile);

fs.copyFileSync(from, to);
console.log(`copy_indexnow_key_to_dist: copied ${resolved.keyFile} to dist/`);
