#!/usr/bin/env node
/* eslint-disable no-console */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');

function run(cmd, env = {}) {
  console.log(`$ ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd: repoRoot, env: { ...process.env, ...env } });
}

function yyyyMmDd(d) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addChangelogEntry(lines) {
  const changelogPath = path.join(repoRoot, 'CHANGELOG.md');
  const now = new Date();
  const dateKey = yyyyMmDd(now);
  let s = fs.existsSync(changelogPath) ? fs.readFileSync(changelogPath, 'utf8') : '# Changelog\n\n';
  if (!s.includes(`# ${dateKey}`)) {
    const m = s.match(/^#\s+Changelog\s*\n+/);
    if (m) {
      const idx = m[0].length;
      s = s.slice(0, idx) + `# ${dateKey}\n` + s.slice(idx);
    } else {
      s = `# Changelog\n\n# ${dateKey}\n\n` + s;
    }
  }

  const headerRe = new RegExp(`(# ${dateKey}\\n)`);
  const parts = s.split(headerRe);
  if (parts.length < 3) {
    s += `\n# ${dateKey}\n`;
    parts.length = 0;
  }

  const idx = s.indexOf(`# ${dateKey}\n`);
  let afterHeader = s.slice(idx + (`# ${dateKey}\n`).length);
  if (!afterHeader.startsWith('\n')) afterHeader = '\n' + afterHeader;

  const insert = lines.map(l => `- ${l}`).join('\n') + '\n';
  const firstBlank = afterHeader.indexOf('\n');
  const newAfter = afterHeader.slice(0, firstBlank + 1) + insert + afterHeader.slice(firstBlank + 1);
  s = s.slice(0, idx + (`# ${dateKey}\n`).length) + newAfter;

  fs.writeFileSync(changelogPath, s);
}

const now = new Date();
const day = now.getUTCDay(); // 0 Sun..6 Sat
const rotation = [
  { key: 'pi', label: 'PI' },
  { key: 'uscis_medical', label: 'USCIS Medical' },
  { key: 'trt', label: 'TRT' },
  { key: 'dentistry', label: 'Dentistry' },
  { key: 'neuro', label: 'Neuro' },
];
const chosen = rotation[day % rotation.length];

const notes = `Rotating refresh focus: ${chosen.label}.`;
const pageSetMap = {
  pi: 'data/page_sets/examples/pi_v1.json',
  uscis_medical: 'data/page_sets/examples/uscis_medical_v1.json',
  trt: 'data/page_sets/examples/trt_v1.json',
  dentistry: 'data/page_sets/examples/dentistry_v1.json',
  neuro: 'data/page_sets/examples/neuro_v1.json',
};

const pageSetFile = pageSetMap[chosen.key];
if (!pageSetFile) {
  throw new Error(`No page set mapping found for vertical: ${chosen.key}`);
}

run(`node scripts/build_city_sites.js --page-set "${pageSetFile}"`, {
  LKG_ENV: 'baseline',
});

run('npm run refresh:verification', {
  LKG_VERTICAL: chosen.key,
  LKG_NOTES: notes,
  LKG_CADENCE: 'nightly integrity + rotating vertical refresh',
  LKG_ENV: 'baseline',
});

run('node scripts/snapshot_lkg.js');

addChangelogEntry([
  `Revalidated core contracts and inventories (rotating focus: ${chosen.label}).`,
  'Updated Verification & Updates page and machine-readable snapshot.',
]);

console.log('DONE rotate refresh:', chosen.key);
