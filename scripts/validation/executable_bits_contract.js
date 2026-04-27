const fs = require('fs');
const path = require('path');

function fail(msg) {
  console.error(`EXECUTABLE BITS CONTRACT FAIL: ${msg}`);
  process.exit(1);
}

function run() {
  const repoRoot = path.resolve(__dirname, '..', '..');
  const manifestPath = path.join(__dirname, 'executable_files_manifest.json');
  if (!fs.existsSync(manifestPath)) fail('manifest missing: scripts/validation/executable_files_manifest.json');

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const files = Array.isArray(manifest.files) ? manifest.files : [];
  if (!files.length) fail('manifest has no files');

  const failures = [];
  for (const rel of files) {
    const fp = path.join(repoRoot, rel);
    if (!fs.existsSync(fp)) {
      failures.push(`${rel}: missing`);
      continue;
    }
    const mode = fs.statSync(fp).mode;
    if ((mode & 0o111) === 0) {
      failures.push(`${rel}: not executable`);
    }
  }

  if (failures.length) {
    fail(`expected executable files failed check:\n- ${failures.join('\n- ')}`);
  }

  console.log(`EXECUTABLE BITS CONTRACT PASS (${files.length} files)`);
}

module.exports = { run };

if (require.main === module) run();
