const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const cityDir = path.join(root, 'data', 'city_content');

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

function readJson(fp) {
  return JSON.parse(fs.readFileSync(fp, 'utf8'));
}

const rootFiles = fs.readdirSync(cityDir, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
  .map((entry) => entry.name);

if (rootFiles.length) {
  fail(`root-level city_content JSON files are not allowed: ${rootFiles.join(', ')}`);
}

const problems = [];
const verticalDirs = fs.readdirSync(cityDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

for (const vertical of verticalDirs) {
  const dir = path.join(cityDir, vertical);
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    const fp = path.join(dir, entry.name);
    const raw = readJson(fp);
    const declaredVertical = String(raw.vertical || '').trim();
    if (!declaredVertical) {
      problems.push(`${path.relative(root, fp)}: missing vertical field`);
      continue;
    }
    if (declaredVertical !== vertical) {
      problems.push(`${path.relative(root, fp)}: vertical field ${declaredVertical} does not match parent directory ${vertical}`);
    }
    const slug = String(raw.city_slug || '').trim();
    if (slug && `${slug}.json` !== entry.name) {
      problems.push(`${path.relative(root, fp)}: filename does not match city_slug`);
    }
  }
}

if (problems.length) fail(problems.join('\n'));
console.log(`OK: city_content normalized into vertical directories (${verticalDirs.length} vertical directories checked)`);
