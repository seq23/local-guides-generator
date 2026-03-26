#!/usr/bin/env node
/* eslint-disable no-console */

// DEPRECATED ENTRYPOINT.
// Canonical: npm run validate:all (node scripts/validate_core.js)

const mod = require('./validation/for_providers_inquiry');
try {
  mod.run({ repoRoot: require('path').resolve(__dirname, '..') });
} catch (e) {
  process.exit(1);
}
