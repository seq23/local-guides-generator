const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const policyPath = path.join(repoRoot, 'data', 'contracts', 'validator_tiering_policy.json');
const reportsDir = path.join(repoRoot, 'reports');
fs.mkdirSync(reportsDir, { recursive: true });

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files = files.concat(walk(full));
    else if (entry.isFile() && entry.name.endsWith('.js')) files.push(full);
  }
  return files;
}

const validationDir = path.join(repoRoot, 'scripts', 'validation');
const topLevelDir = path.join(repoRoot, 'scripts');
const discovered = [
  ...walk(validationDir),
  ...fs.readdirSync(topLevelDir)
    .filter((name) => /^validate_.*\.js$/.test(name))
    .map((name) => path.join(topLevelDir, name))
].map((full) => path.relative(repoRoot, full).replace(/\\/g, '/')).sort();

const policy = JSON.parse(fs.readFileSync(policyPath, 'utf8'));
const tiers = new Map();
for (const tier of ['hard_fail', 'warning', 'developer']) {
  for (const file of policy[tier] || []) tiers.set(file, tier);
}

const inventory = discovered.map((file) => ({
  path: file,
  tier: tiers.get(file) || 'dormant',
  exists: fs.existsSync(path.join(repoRoot, file))
}));

const summary = {
  discovered_total: inventory.length,
  hard_fail_total: inventory.filter((x) => x.tier === 'hard_fail').length,
  warning_total: inventory.filter((x) => x.tier === 'warning').length,
  developer_total: inventory.filter((x) => x.tier === 'developer').length,
  dormant_total: inventory.filter((x) => x.tier === 'dormant').length
};

fs.writeFileSync(path.join(reportsDir, 'phase8_validator_inventory.json'), JSON.stringify(inventory, null, 2));
fs.writeFileSync(path.join(reportsDir, 'phase8_validator_inventory_summary.json'), JSON.stringify(summary, null, 2));
for (const tier of ['hard_fail', 'warning', 'developer']) {
  fs.writeFileSync(path.join(reportsDir, `validator_tier_${tier}.json`), JSON.stringify(inventory.filter((x) => x.tier === tier), null, 2));
}
console.log(JSON.stringify(summary, null, 2));
