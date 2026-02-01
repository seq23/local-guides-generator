#!/usr/bin/env node
/* eslint-disable no-console */
const path = require('path');

const ctx = {
  repoRoot: path.resolve(__dirname, '..')
};

const steps = [
  { name: 'BUYOUTS_SCHEMA', mod: './validation/buyouts_schema' },
  { name: 'BUYOUT_NEXT_STEPS_HARDFAIL', mod: './validation/buyout_next_steps_hardfail' },
  { name: 'FOR_PROVIDERS_INQUIRY', mod: './validation/for_providers_inquiry' },
  { name: 'GUIDES_INDEX_LINKS', mod: './validation/guides_index_links' },
  { name: 'FOOTER_CONTRACT', mod: './validation/footer_contract' },
  { name: 'GOLDEN_MAJOR_BLOCKS', mod: './validation/golden_major_blocks' },
  { name: 'LINK_AUDIT', mod: './validation/link_audit' }
];

for (const s of steps) {
  try {
    const mod = require(s.mod);
    if (!mod || typeof mod.run !== 'function') {
      throw new Error(`Validation module ${s.mod} missing run()`);
    }
    mod.run(ctx);
  } catch (e) {
    const tag = e && e._validation ? e._validation : s.name;
    console.error(`\n❌ CORE VALIDATION FAIL (${tag})`);
    console.error(e && e.message ? e.message : String(e));
    process.exit(1);
  }
}

console.log('CORE VALIDATION PASS');
