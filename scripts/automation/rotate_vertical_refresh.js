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
    // add at top after title
    const m = s.match(/^#\s+Changelog\s*\n+/);
    if (m) {
      const idx = m[0].length;
      s = s.slice(0, idx) + `# ${dateKey}\n` + s.slice(idx);
    } else {
      s = `# Changelog\n\n# ${dateKey}\n\n` + s;
    }
  }
  // insert bullets under that header
  const headerRe = new RegExp(`(# ${dateKey}\\n)`);
  const parts = s.split(headerRe);
  if (parts.length < 3) {
    s += `\n# ${dateKey}\n`;
    parts.length = 0;
  }
  // Re-find header position
  const idx = s.indexOf(`# ${dateKey}\n`);
  let afterHeader = s.slice(idx + (`# ${dateKey}\n`).length);
  // ensure blank line
  if (!afterHeader.startsWith('\n')) afterHeader = '\n' + afterHeader;
  // add new bullets at top of section
  const insert = lines.map(l => `- ${l}`).join('\n') + '\n';
  // place after first blank line
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
run('node scripts/automation/refresh_verification_page.js', {
  LKG_VERTICAL: chosen.key,
  LKG_NOTES: notes,
  LKG_CADENCE: 'nightly integrity + rotating vertical refresh',
});

// Refresh snapshot JSON (acts as an auditable “we re-validated” signal)
run('node scripts/snapshot_lkg.js');

addChangelogEntry([
  `Revalidated core contracts and inventories (rotating focus: ${chosen.label}).`,
  'Updated Verification & Updates page and machine-readable snapshot.',
]);

console.log('DONE rotate refresh:', chosen.key);
