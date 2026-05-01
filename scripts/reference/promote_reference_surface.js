#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const REGISTRY = path.join(ROOT, 'data', 'reference', 'reference_registry.json');
const QUEUE = path.join(ROOT, 'data', 'reference', 'promotion_queue.json');

function readJsonSafe(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}

function inferPublicSlug(page) {
  const fromPage = String(page.public_slug || '').trim();
  if (fromPage) return fromPage;
  const sourceFile = String(page.file || '').replace(/\\/g, '/');
  const parts = sourceFile.split('/').filter(Boolean);
  if (parts.length >= 4 && parts[0] === 'reference') {
    return `${parts[1]}/${parts[2]}`;
  }
  return String(page.id || '').trim();
}

function main() {
  const candidateId = String(process.argv[2] || '').trim();
  if (!candidateId) {
    throw new Error('Usage: node scripts/reference/promote_reference_surface.js <candidate_id>');
  }

  const registry = readJsonSafe(REGISTRY, null);
  if (!registry || !Array.isArray(registry.pages)) {
    throw new Error('data/reference/reference_registry.json missing or invalid');
  }

  const page = registry.pages.find((entry) => String(entry.id) === candidateId);
  if (!page) {
    throw new Error(`Candidate not found in reference registry: ${candidateId}`);
  }

  const relFile = String(page.file || '').replace(/\\/g, '/');
  if (!relFile) {
    throw new Error(`Registry entry missing file for candidate: ${candidateId}`);
  }

  const absFile = path.join(ROOT, relFile);
  if (!fs.existsSync(absFile)) {
    throw new Error(`Reference source file missing for candidate ${candidateId}: ${relFile}`);
  }

  const queue = readJsonSafe(QUEUE, { queue: [] });
  if (!Array.isArray(queue.queue)) queue.queue = [];

  const now = new Date().toISOString();
  const publicSlug = inferPublicSlug(page);

  const nextEntry = {
    id: candidateId,
    vertical: page.vertical || null,
    source_file: relFile,
    public_slug: publicSlug,
    queued_at: now,
    status: 'approved',
  };

  const existingIndex = queue.queue.findIndex((entry) => String(entry.id) === candidateId);
  if (existingIndex >= 0) {
    queue.queue[existingIndex] = {
      ...queue.queue[existingIndex],
      ...nextEntry,
      first_queued_at: queue.queue[existingIndex].first_queued_at || queue.queue[existingIndex].queued_at || now,
      queued_at: now,
    };
  } else {
    queue.queue.push({
      ...nextEntry,
      first_queued_at: now,
    });
  }

  page.promoted = true;
  page.promotion_status = 'queued';
  page.promoted_at = now;
  page.public_slug = publicSlug;

  registry.promoted_ids = Array.from(new Set([...(registry.promoted_ids || []), candidateId]));
  registry.updated_at = now;

  writeJson(REGISTRY, registry);
  writeJson(QUEUE, queue);

  console.log(`promote_reference_surface: queued ${candidateId} -> ${publicSlug}`);
}

main();
