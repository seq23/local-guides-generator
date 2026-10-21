/* eslint-disable no-console */
//
// Regenerates data/contracts/schema_org_vocab.json, the checked-in schema.org
// vocabulary that scripts/validation/structured_data_vocab_contract.js reads.
//
//   curl -sL https://schema.org/version/latest/schemaorg-current-https.jsonld -o /tmp/schemaorg.jsonld
//   node scripts/validation/schema_org_vocab_build.js /tmp/schemaorg.jsonld
//
// Output: { version, types: { Type: [direct parents] }, properties: { prop: [domain types] } }.
// Checked in (not fetched at build time) so the build never depends on the network.
const fs = require('fs');
const path = require('path');

const src = process.argv[2];
if (!src || !fs.existsSync(src)) {
  console.error('usage: node scripts/validation/schema_org_vocab_build.js <schemaorg-current-https.jsonld>');
  process.exit(1);
}
const doc = JSON.parse(fs.readFileSync(src, 'utf8'));
const graph = doc['@graph'] || [];
const short = (id) => String(id || '').replace(/^schema:/, '').replace(/^https?:\/\/schema\.org\//, '');
const list = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]).map((x) => short(x && x['@id']));
const types = {};
const properties = {};
for (const n of graph) {
  const t = [].concat(n['@type'] || []);
  const id = short(n['@id']);
  if (!id || n['schema:supersededBy']) continue;
  if (t.includes('rdfs:Class')) types[id] = list(n['rdfs:subClassOf']).filter(Boolean);
  else if (t.includes('rdf:Property')) properties[id] = list(n['schema:domainIncludes']).filter(Boolean);
  // Enumeration members (e.g. schema:Monday) are typed by their enumeration, not by
  // rdfs:Class; they are values, not node types, so they are not recorded.
}
const sortObj = (o) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k].sort()]));
const out = { source: 'https://schema.org/version/latest/schemaorg-current-https.jsonld', generated_at: new Date().toISOString().slice(0, 10), types: sortObj(types), properties: sortObj(properties) };
const dest = path.join(__dirname, '..', '..', 'data', 'contracts', 'schema_org_vocab.json');
fs.writeFileSync(dest, JSON.stringify(out) + '\n');
console.log(`schema_org_vocab_build: ${Object.keys(types).length} types, ${Object.keys(properties).length} properties -> ${path.relative(process.cwd(), dest)}`);
