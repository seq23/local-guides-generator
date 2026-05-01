const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const tier = process.argv[2];
if (!tier || !['hard_fail','warning','developer'].includes(tier)) {
  console.error('Usage: node scripts/validation/run_validator_tier.js <hard_fail|warning|developer>');
  process.exit(1);
}

const repoRoot = path.resolve(__dirname, '..', '..');
const reportsDir = path.join(repoRoot, 'reports');
fs.mkdirSync(reportsDir, { recursive: true });
const policy = JSON.parse(fs.readFileSync(path.join(repoRoot, 'data', 'contracts', 'validator_tiering_policy.json'), 'utf8'));
const validators = policy[tier] || [];
const results = [];
let failed = 0;

for (const file of validators) {
  const started = new Date().toISOString();
  try {
    cp.execFileSync(process.execPath, [path.join(repoRoot, file)], { cwd: repoRoot, stdio: 'pipe' });
    results.push({ file, tier, status: 'pass', started_at: started });
  } catch (error) {
    failed += 1;
    results.push({
      file,
      tier,
      status: 'fail',
      started_at: started,
      code: error.status || 1,
      stdout: (error.stdout || '').toString().slice(0, 4000),
      stderr: (error.stderr || '').toString().slice(0, 4000)
    });
  }
}

const summary = { tier, total: validators.length, passed: validators.length - failed, failed };
fs.writeFileSync(path.join(reportsDir, `phase8_${tier}_run.json`), JSON.stringify({ summary, results }, null, 2));
console.log(JSON.stringify(summary, null, 2));
if (tier === 'hard_fail' && failed > 0) process.exit(1);
