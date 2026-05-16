#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = process.cwd();
const REPORT_DIR = path.join(ROOT, 'reports');
const REPORT_PATH = path.join(REPORT_DIR, 'promoted_guide_completion_queue.json');

const REQUIRED_SECTION_IDS = {
  dentistry: ['definition', 'cost', 'recovery', 'candidacy', 'questions', 'next-steps'],
  neuro: ['definition', 'pricing', 'trust', 'process', 'questions', 'next-steps'],
  trt: ['definition', 'cost', 'safety', 'candidacy', 'questions', 'next-steps'],
  pi: ['definition', 'when-to-call', 'cost', 'evidence', 'questions', 'next-steps'],
  uscis_medical: ['cost', 'documents', 'process', 'questions', 'next-steps'],
};

function git(command) {
  return execSync(command, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function gitSafe(command) {
  try {
    return git(command);
  } catch {
    return '';
  }
}

function commitExists(rev) {
  if (!rev) return false;
  try {
    execSync(`git cat-file -e ${rev}^{commit}`, {
      cwd: ROOT,
      stdio: ['ignore', 'ignore', 'ignore'],
    });
    return true;
  } catch {
    return false;
  }
}

function resolveDiffRange() {
  const head = process.env.GITHUB_SHA || gitSafe('git rev-parse HEAD') || 'HEAD';
  const before = process.env.GITHUB_EVENT_BEFORE || process.env.GITHUB_BEFORE || '';

  if (before && !/^0+$/.test(before) && commitExists(before) && commitExists(head)) {
    return {
      base: before,
      head,
      mode: 'event_before',
    };
  }

  if (commitExists('HEAD~1')) {
    return {
      base: 'HEAD~1',
      head: 'HEAD',
      mode: 'fallback_head_prev',
    };
  }

  return {
    base: null,
    head: 'HEAD',
    mode: 'single_head',
  };
}

function getChangedFiles(range) {
  let raw = '';

  if (range.base) {
    try {
      raw = git(`git diff --name-status ${range.base} ${range.head}`);
    } catch {
      if (commitExists('HEAD~1')) {
        raw = gitSafe('git diff --name-status HEAD~1 HEAD');
      } else {
        raw = gitSafe('git show --name-status --format= HEAD');
      }
    }
  } else {
    raw = gitSafe('git show --name-status --format= HEAD');
  }

  if (!raw) return [];

  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split('\t');
      const status = parts[0];
      const filePath = parts[parts.length - 1];
      return { status, filePath };
    });
}

function isCandidateGuideFile(filePath) {
  if (!filePath.startsWith('data/page_sets/examples/')) return false;
  if (!filePath.includes('_global_pages/')) return false;
  if (!filePath.endsWith('.json')) return false;

  const base = path.basename(filePath);
  if (base === 'guides.json' || base === 'home.json') return false;

  return true;
}

function getVerticalFromPath(filePath) {
  const match = filePath.match(/^data\/page_sets\/examples\/([^/]+)_global_pages\/[^/]+\.json$/);
  return match ? match[1] : null;
}

function readJson(absPath) {
  return JSON.parse(fs.readFileSync(absPath, 'utf8'));
}

function getMissingSectionIds(mainHtml, requiredIds) {
  const html = String(mainHtml || '');
  return requiredIds.filter((id) => {
    const idPattern = new RegExp(`id=["']${id}["']`, 'i');
    const hashPattern = new RegExp(`#${id}(?:["'\\s<])`, 'i');
    return !idPattern.test(html) && !hashPattern.test(html);
  });
}

function buildQueueItems() {
  const range = resolveDiffRange();
  const changedFiles = getChangedFiles(range);

  const queueItems = [];

  for (const entry of changedFiles) {
    if (!['A', 'M', 'R', 'C'].some((prefix) => entry.status.startsWith(prefix))) {
      continue;
    }

    if (!isCandidateGuideFile(entry.filePath)) {
      continue;
    }

    const vertical = getVerticalFromPath(entry.filePath);
    if (!vertical || !REQUIRED_SECTION_IDS[vertical]) {
      continue;
    }

    const absPath = path.join(ROOT, entry.filePath);
    if (!fs.existsSync(absPath)) {
      continue;
    }

    let json;
    try {
      json = readJson(absPath);
    } catch {
      continue;
    }

    const route = json.route || '';
    if (!route.startsWith('/guides/')) {
      continue;
    }

    const missingSectionIds = getMissingSectionIds(json.main_html, REQUIRED_SECTION_IDS[vertical]);
    if (missingSectionIds.length === 0) {
      continue;
    }

    queueItems.push({
      vertical,
      filePath: entry.filePath,
      route,
      status: entry.status,
      requiredSectionIds: REQUIRED_SECTION_IDS[vertical],
      missingSectionIds,
      title: json.title || '',
    });
  }

  return { range, changedFiles, queueItems };
}

function writeReport(report) {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
}

function main() {
  const { range, changedFiles, queueItems } = buildQueueItems();

  const report = {
    generatedAt: new Date().toISOString(),
    diffMode: range.mode,
    base: range.base,
    head: range.head,
    changedFileCount: changedFiles.length,
    queuedCount: queueItems.length,
    items: queueItems,
  };

  writeReport(report);

  console.log(
    `build_completion_queue: queued ${queueItems.length} skeletal promoted guide(s) using ${range.mode}`
  );

  if (queueItems.length > 0) {
    for (const item of queueItems) {
      console.log(` - queued: ${item.vertical} -> ${item.filePath}`);
    }
  }
}

main();
