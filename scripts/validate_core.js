
const {execSync}=require('child_process');
const steps=[
  'node scripts/validate_buyouts_schema.js',
  'node scripts/validate_buyout_next_steps_hardfail.js',
  'node scripts/validate_for_providers_inquiry.js',
  'node scripts/validators/guides_index_links.js',
  'node scripts/validators/footer_contract.js',
  'node scripts/validators/golden_major_blocks.js',
  'node scripts/crawl_dist_links.js'
];
for(const s of steps){
  execSync(s,{stdio:'inherit'});
}
console.log('CORE VALIDATION PASS');
