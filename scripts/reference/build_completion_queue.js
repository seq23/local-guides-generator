#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, '.tmp');
const OUT_FILE = path.join(OUT_DIR, 'promoted_guide_completion_queue.json');
const SKIP_NAMES = new Set(['guides.json', 'home.json']);

const RULES = {
  dentistry: { sections: ['definition', 'cost', 'recovery', 'candidacy', 'questions', 'red-flags', 'next-steps'] },
  neuro: { sections: ['definition', 'pricing', 'trust', 'process', 'questions', 'next-steps'] },
  trt: { sections: ['definition', 'cost', 'safety', 'candidacy', 'questions', 'red-flags', 'next-steps'] },
  pi: { sections: ['definition', 'when-to-call', 'cost', 'evidence', 'questions', 'red-flags', 'next-steps'] },
  uscis_medical: { sections: ['quick-answer', 'cost', 'documents', 'process', 'questions', 'next-steps'] }
};

function detectVertical(relPath) {
  if (relPath.includes('/dentistry_global_pages/')) return 'dentistry';
  if (relPath.includes('/neuro_global_pages/')) return 'neuro';
  if (relPath.includes('/trt_global_pages/')) return 'trt';
  if (relPath.includes('/uscis_medical_global_pages/')) return 'uscis_medical';
  if (relPath.includes('/pi_global_pages/')) return 'pi';
  return null;
}

function loadJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relPath), 'utf8'));
}

function getDiffFiles() {
  const before = process.env.BEFORE_SHA || process.env.GITHUB_EVENT_BEFORE || '';
  const head = process.env.HEAD_SHA || process.env.GITHUB_SHA || 'HEAD';
  const cmd = before && !/^0+$/.test(before)
    ? `git diff --name-status ${before} ${head}`
    : 'git diff --name-status HEAD^ HEAD';
  const out = execSync(cmd, { encoding: 'utf8' });
  return out.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
    const parts = line.split(/\s+/);
    return { status: parts[0], file: parts[parts.length - 1] };
  });
}

function hasSectionId(html, id) {
  return html.includes(`id="${id}"`) || html.includes(`id='${id}'`);
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const changed = getDiffFiles();
  const queue = [];
  for (const row of changed) {
    const relPath = row.file.replace(/\\/g, '/');
    if (!/^data\/page_sets\/examples\/.+\.json$/.test(relPath)) continue;
    if (SKIP_NAMES.has(path.basename(relPath))) continue;
    const vertical = detectVertical(relPath);
    if (!vertical) continue;
    const json = loadJson(relPath);
    const route = String(json.route || '').trim();
    if (!route.startsWith('/guides/') || route === '/guides/') continue;
    const html = String(json.main_html || '');
    const required = RULES[vertical].sections;
    const missing = required.filter((id) => !hasSectionId(html, id));
    const looksDrafty = /generated from candidate evidence|generated from a velocity candidate package|Use this draft as a starting point/i.test(html);
    if (!looksDrafty && row.status !== 'A') continue;
    if (!missing.length && !looksDrafty) continue;
    queue.push({
      status: row.status,
      vertical,
      file: relPath,
      route,
      title: String(json.title || ''),
      description: String(json.description || ''),
      missing_section_ids: missing,
      draft_marker_detected: looksDrafty
    });
  }
  const payload = { generated_at: new Date().toISOString(), total_changed_files: changed.length, queued: queue.length, items: queue };
  fs.writeFileSync(OUT_FILE, JSON.stringify(payload, null, 2) + '\n');
  console.log(`build_completion_queue: queued ${queue.length} promoted guide(s)`);
  for (const item of queue) console.log(` - ${item.vertical}: ${item.file} (${item.missing_section_ids.join(', ') || 'draft-marker'})`);
}

main();
