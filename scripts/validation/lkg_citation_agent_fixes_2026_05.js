const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..', '..');
const ledgerPath = path.join(root, 'data', 'citation_agent_fixes', 'lkg_citation_agent_2026_05.json');
function fail(msg){ console.error('LKG citation agent fixes contract FAIL'); console.error('- ' + msg); process.exit(1); }
function readJSON(p){ return JSON.parse(fs.readFileSync(p, 'utf8')); }
if (!fs.existsSync(ledgerPath)) fail('missing ledger: data/citation_agent_fixes/lkg_citation_agent_2026_05.json');
const ledger = readJSON(ledgerPath);
const markers = Array.isArray(ledger.markers) ? ledger.markers : [];
if (markers.length < 20) fail(`expected at least 20 guide markers, found ${markers.length}`);
for (const rel of ledger.guide_source_files || []) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) fail(`missing guide source file: ${rel}`);
  const txt = fs.readFileSync(p, 'utf8');
  if (!txt.includes('citation-agent-fix')) fail(`guide source lacks citation-agent-fix marker: ${rel}`);
}

// Artifact-driven city enrichment must prevent drift *inside* each vertical without flattening
// all verticals into one generic city-page contract. This extends the existing citation-agent
// lane only; it does not create a new renderer architecture.
const verticalCityModules = {
  uscis_medical: {
    title: 'Local civil surgeon comparison checklist',
    requiredTerms: ['civil surgeon', 'i-693', 'sealed packet', 'vaccines', 'cost', 'correction']
  },
  neuro: {
    title: 'City-specific neuro evaluation decision checklist',
    requiredTerms: ['evaluation', 'report', 'insurance', 'testing', 'adult', 'child']
  },
  trt: {
    title: 'Local TRT and hormone clinic authority checklist',
    requiredTerms: ['lab', 'monitoring', 'clinician', 'fertility', 'hair', 'cost']
  },
  dentistry: {
    title: 'Local dentist selection and payment checklist',
    requiredTerms: ['payment', 'insurance', 'specialty', 'new-patient', 'pricing', 'review']
  }
};
for (const [vertical, contract] of Object.entries(verticalCityModules)) {
  const dir = path.join(root, 'data', 'city_content', vertical);
  if (!fs.existsSync(dir)) fail(`missing city content directory: data/city_content/${vertical}`);
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort();
  if (!files.length) fail(`no city files for vertical: ${vertical}`);

  let expectedCount = null;
  for (const file of files) {
    const rel = `data/city_content/${vertical}/${file}`;
    const data = readJSON(path.join(dir, file));
    const block = data.primary_city_decision_block || {};
    if (block.type !== 'decision_checklist') fail(`${rel}: primary_city_decision_block.type must remain decision_checklist`);
    if (block.title !== contract.title) fail(`${rel}: city decision block title drifted from vertical contract`);
    if (!Array.isArray(block.items) || block.items.length < 5) fail(`${rel}: city decision block must have at least 5 artifact-driven items`);
    if (expectedCount === null) expectedCount = block.items.length;
    if (block.items.length !== expectedCount) fail(`${rel}: city decision block item count drifted within ${vertical}`);

    const combined = JSON.stringify(data).toLowerCase();
    for (const term of contract.requiredTerms) {
      if (!combined.includes(term)) fail(`${rel}: missing required ${vertical} enrichment term: ${term}`);
    }
  }
}
console.log(`LKG citation agent fixes contract PASS: ${markers.length} guide markers; ${Object.keys(verticalCityModules).length} intra-vertical city module contracts checked`);
