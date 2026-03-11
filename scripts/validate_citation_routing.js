/* eslint-disable no-console */
const path = require('path');
const citationRoutingBundle = require('./validation/citation_routing_bundle');

function main() {
  const repoRoot = path.join(__dirname, '..');
  citationRoutingBundle.run({ repoRoot });
}

main();
