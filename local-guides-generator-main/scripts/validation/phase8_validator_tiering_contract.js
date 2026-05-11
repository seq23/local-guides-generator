const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const policyPath = path.join(repoRoot, 'data', 'contracts', 'validator_tiering_policy.json');
const policy = JSON.parse(fs.readFileSync(policyPath, 'utf8'));

const seen = new Map();
for (const tier of ['hard_fail', 'warning', 'developer']) {
  for (const file of policy[tier] || []) {
    const full = path.join(repoRoot, file);
    if (!fs.existsSync(full)) {
      console.error(`Missing validator in ${tier}: ${file}`);
      process.exit(1);
    }
    if (seen.has(file)) {
      console.error(`Validator assigned to multiple tiers: ${file} (${seen.get(file)}, ${tier})`);
      process.exit(1);
    }
    seen.set(file, tier);
  }
}
console.log(`OK: validator tiering policy valid (${seen.size} active validators).`);
