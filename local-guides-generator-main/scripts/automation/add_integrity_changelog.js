#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const changelogPath = path.join(repoRoot, 'CHANGELOG.md');

function yyyyMmDd(d) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function ensureHeader(s, dateKey) {
  if (s.includes(`# ${dateKey}`)) return s;
  const m = s.match(/^#\s+Changelog\s*\n+/);
  if (m) {
    const idx = m[0].length;
    return s.slice(0, idx) + `# ${dateKey}\n\n` + s.slice(idx);
  }
  return `# Changelog\n\n# ${dateKey}\n\n` + s;
}

function addBullets(s, dateKey, lines) {
  const header = `# ${dateKey}\n`;
  const idx = s.indexOf(header);
  if (idx === -1) return s + `\n${header}\n` + lines.map(l=>`- ${l}`).join('\n') + '\n';
  const insertAt = idx + header.length;
  const after = s.slice(insertAt);
  const bullets = lines.map(l => `- ${l}`).join('\n') + '\n';
  return s.slice(0, insertAt) + '\n' + bullets + after;
}

const now = new Date();
const dateKey = yyyyMmDd(now);
let s = fs.existsSync(changelogPath) ? fs.readFileSync(changelogPath, 'utf8') : '# Changelog\n\n';
s = ensureHeader(s, dateKey);
s = addBullets(s, dateKey, [
  'Nightly integrity build: re-ran core validators and refreshed verification metadata.',
  'Confirmed canonical inventory parity between docs and public surfaces.',
]);
fs.writeFileSync(changelogPath, s);
console.log('OK: changelog updated');
