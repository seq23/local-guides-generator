#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const distDir = path.join(repoRoot, 'dist');
const dataDir = path.join(repoRoot, 'data');

function fail(msg) {
  console.error(`LKG SNAPSHOT FAILED: ${msg}`);
  process.exit(1);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function walkFiles(dir, predicate) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    const entries = fs.readdirSync(cur, { withFileTypes: true });
    for (const e of entries) {
      const p = path.join(cur, e.name);
      if (e.isDirectory()) stack.push(p);
      else if (predicate(p)) out.push(p);
    }
  }
  return out;
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function writeJson(filePath, obj) {
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

function basenameNoExt(p) {
  return path.basename(p).replace(/\.[^.]+$/, '');
}

function indexOfOrNeg(haystack, needle) {
  const i = haystack.indexOf(needle);
  return i >= 0 ? i : -1;
}

function makeCityHubMarkerSnapshot(html) {
  // Markers are intentionally substring-based so they remain stable across formatting changes.
  // Validators enforce order separately; this snapshot exists for audit + diffing.
  return {
    cityHubTop: indexOfOrNeg(html, 'data-sponsor-stack="city_hub_top"'),
    cityHubMid: indexOfOrNeg(html, 'data-sponsor-stack="city_hub_mid"'),
    cityHubBottom: indexOfOrNeg(html, 'data-sponsor-stack="city_hub_bottom"'),
    evalFramework: indexOfOrNeg(html, 'data-eval-framework="true"'),
    aiVisibility: indexOfOrNeg(html, 'data-ai-visibility="true"'),
    startHere: indexOfOrNeg(html, 'Start here'),
    exampleProviders: indexOfOrNeg(html, 'data-example-providers="true"'),
    stateLookup: indexOfOrNeg(html, 'id="state-lookup"'),
    faq: indexOfOrNeg(html, 'id="city-faq"'),
    guides: indexOfOrNeg(html, '>Guides<')
  };
}

function summarizeMarkers(markerObj) {
  const missing = [];
  for (const [k, v] of Object.entries(markerObj)) {
    if (v === -1) missing.push(k);
  }
  return { missing, missingCount: missing.length };
}

function tryReadJson(p) {
  try {
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function rel(p) {
  return p.replace(repoRoot + path.sep, '').replaceAll('\\', '/');
}

function resolvePageSetPath(pageSetFile) {
  const direct = path.join(dataDir, 'page_sets', pageSetFile);
  if (fs.existsSync(direct)) return direct;

  // Allow passing "examples/<file>.json" or bare file name.
  const normalized = pageSetFile.replace(/^\.\//, '');
  const ex1 = path.join(dataDir, 'page_sets', normalized);
  if (fs.existsSync(ex1)) return ex1;

  const ex2 = path.join(dataDir, 'page_sets', 'examples', pageSetFile);
  if (fs.existsSync(ex2)) return ex2;

  fail(`Could not resolve pageSetFile "${pageSetFile}" under data/page_sets/`);
  return null;
}

function main() {
  const siteJsonPath = path.join(dataDir, 'site.json');
  if (!fs.existsSync(siteJsonPath)) fail('Missing data/site.json');

  const site = readJson(siteJsonPath);
  const pageSetFile = site.pageSetFile;
  if (!pageSetFile) fail('data/site.json is missing pageSetFile');

  const pageSetPath = resolvePageSetPath(pageSetFile);
  const pageSet = readJson(pageSetPath);

  if (!fs.existsSync(distDir)) fail('dist/ does not exist. Run build first.');

  const htmlFiles = walkFiles(distDir, (p) => p.endsWith('.html'))
    .map(rel)
    .sort();

  const routes = htmlFiles.map((r) => r.replace(/^dist\//, ''));

  const nextStepsPages = routes.filter((r) => /(^|\/)next-steps(\/|$)/i.test(r));

  const counts = {
    htmlFiles: routes.length,
    hasHomepage: routes.includes('index.html'),
    guidePages: routes.filter((r) => r.startsWith('guides/') && r.endsWith('/index.html')).length,
    cityHubPages: routes.filter((r) => /^[^/]+\/index\.html$/.test(r) && !r.startsWith('guides/')).length,
    nextStepsPages: nextStepsPages.length
  };

  const snapshot = {
    createdAt: new Date().toISOString(),
    site: {
      brandName: site.brandName,
      siteUrl: site.siteUrl,
      pageSetFile: pageSetFile
    },
    pack: {
      educationOnly: !!pageSet.educationOnly,
      sponsorship: pageSet.sponsorship || {},
      cityFeatures: pageSet.cityFeatures || null
    },
    counts,
    nextStepsSample: nextStepsPages.slice(0, 10),
    routesSample: routes.slice(0, 25)
  };

  const outPath = path.join(distDir, '_lkg_snapshot.json');
  writeJson(outPath, snapshot);

  // Also write a copy at repo root for CI convenience.
  writeJson(path.join(repoRoot, '_lkg_snapshot.json'), snapshot);

  // --- Hub Render Contract Snapshot (Project 7) ---
  // Capture stable markers from rendered city hub pages so we can detect template drift
  // and produce diffs between releases.
  const cityHubFiles = walkFiles(distDir, (p) => /\/[^/]+\/index\.html$/.test(p.replaceAll('\\', '/')))
    .filter((p) => !/\/guides\//.test(p.replaceAll('\\', '/')))
    .sort();

  const hubContracts = {
    createdAt: new Date().toISOString(),
    pageSetFile,
    counts: {
      cityHubPages: cityHubFiles.length
    },
    samples: []
  };

  // Snapshot first N city hub pages for audit; this keeps artifact small and deterministic.
  const LIMIT = 50;
  let missingAnyMarkersCount = 0;
  for (const fp of cityHubFiles.slice(0, LIMIT)) {
    const html = readText(fp);
    const markers = makeCityHubMarkerSnapshot(html);
    const summary = summarizeMarkers(markers);
    if (summary.missingCount > 0) missingAnyMarkersCount += 1;
    hubContracts.samples.push({
      path: rel(fp),
      markers,
      missing: summary.missing
    });
  }
  hubContracts.counts.sampled = hubContracts.samples.length;
  hubContracts.counts.sampledWithMissingMarkers = missingAnyMarkersCount;

  const hubOutPath = path.join(distDir, '_hub_contracts_snapshot.json');
  writeJson(hubOutPath, hubContracts);
  writeJson(path.join(repoRoot, '_hub_contracts_snapshot.json'), hubContracts);

  console.log(`OK: Wrote hub contracts snapshot: ${rel(hubOutPath)}`);

  // --- Release Artifact Index (Project 9) ---
  // Maintain an append-only index of release snapshots for audit/rollback.
  // Tag/commit can be supplied via env vars; if unavailable, we still record a deterministic snapshot.
  const releasesDir = path.join(repoRoot, 'releases');
  const releasesIndexPath = path.join(releasesDir, 'releases_index.json');
  if (!fs.existsSync(releasesDir)) fs.mkdirSync(releasesDir, { recursive: true });

  const safeExec = (cmd) => {
    try {
      return String(execSync(cmd, { cwd: repoRoot, stdio: ['ignore', 'pipe', 'ignore'] })).trim();
    } catch {
      return null;
    }
  };

  const gitCommit = safeExec('git rev-parse HEAD');
  const gitBranch = safeExec('git rev-parse --abbrev-ref HEAD');
  const gitTag = safeExec('git describe --tags --exact-match');
  const releaseTag = process.env.LKG_RELEASE_TAG || process.env.RELEASE_TAG || gitTag || null;

  const entry = {
    recordedAt: new Date().toISOString(),
    releaseTag,
    git: {
      commit: gitCommit,
      branch: gitBranch
    },
    site: snapshot.site,
    pack: snapshot.pack,
    counts: snapshot.counts
  };

  let idx = { updatedAt: new Date().toISOString(), releases: [] };
  if (fs.existsSync(releasesIndexPath)) {
    try {
      idx = JSON.parse(fs.readFileSync(releasesIndexPath, 'utf8'));
    } catch {
      // If corrupted, preserve a minimal structure.
      idx = { updatedAt: new Date().toISOString(), releases: [] };
    }
  }
  if (!Array.isArray(idx.releases)) idx.releases = [];

  // De-dupe by (releaseTag, commit, pageSetFile, recordedAt day bucket)
  // We still allow multiple entries when tag is null or commit changes.
  const dedupeKey = `${releaseTag || 'untagged'}|${gitCommit || 'nocommit'}|${snapshot.site.pageSetFile}`;
  const exists = idx.releases.some((r) => `${r.releaseTag || 'untagged'}|${(r.git && r.git.commit) || 'nocommit'}|${(r.site && r.site.pageSetFile) || ''}` === dedupeKey);
  if (!exists) idx.releases.unshift(entry);
  idx.updatedAt = new Date().toISOString();
  // Persist the hub contracts snapshot into releases/ for diffing and audits.
  const hubContractsDir = path.join(releasesDir, 'hub_contracts');
  if (!fs.existsSync(hubContractsDir)) fs.mkdirSync(hubContractsDir, { recursive: true });
  const hubContractsArtifact = path.join(
    hubContractsDir,
    `${new Date().toISOString().replace(/[:.]/g, '').slice(0, 15)}_${basenameNoExt(pageSetFile)}_hub_contracts.json`
  );
  writeJson(hubContractsArtifact, hubContracts);

  entry.artifacts = {
    snapshot: rel(outPath),
    hubContracts: rel(hubContractsArtifact)
  };

  // --- Coverage Diff & Drift Reporter (Project 6) ---
  // Compare current hub contract snapshot + counts with the most recent prior entry
  // for the same pageSetFile and write a diff artifact.
  const diffsDir = path.join(releasesDir, 'diffs');
  if (!fs.existsSync(diffsDir)) fs.mkdirSync(diffsDir, { recursive: true });

  const findPrevious = () => {
    if (!Array.isArray(idx.releases)) return null;
    for (const r of idx.releases) {
      if (r === entry) continue;
      if (!r || !r.site || r.site.pageSetFile !== pageSetFile) continue;
      // Skip if same commit (when available) to avoid duplicate diffs in CI reruns.
      const prevCommit = r.git && r.git.commit;
      if (prevCommit && gitCommit && prevCommit === gitCommit) continue;
      return r;
    }
    return null;
  };

  const prev = findPrevious();
  if (prev && prev.artifacts && prev.artifacts.hubContracts) {
    const prevHubPathAbs = path.join(repoRoot, prev.artifacts.hubContracts);
    const prevHub = tryReadJson(prevHubPathAbs);
    if (prevHub) {
      const diff = {
        createdAt: new Date().toISOString(),
        pageSetFile,
        from: {
          releaseTag: prev.releaseTag || null,
          commit: (prev.git && prev.git.commit) || null,
          counts: prev.counts || null,
          hubCounts: (prevHub && prevHub.counts) || null
        },
        to: {
          releaseTag,
          commit: gitCommit,
          counts: snapshot.counts,
          hubCounts: hubContracts.counts
        },
        delta: {
          htmlFiles: (snapshot.counts.htmlFiles || 0) - ((prev.counts && prev.counts.htmlFiles) || 0),
          guidePages: (snapshot.counts.guidePages || 0) - ((prev.counts && prev.counts.guidePages) || 0),
          cityHubPages: (snapshot.counts.cityHubPages || 0) - ((prev.counts && prev.counts.cityHubPages) || 0),
          sampledWithMissingMarkers: (hubContracts.counts.sampledWithMissingMarkers || 0) - ((prevHub.counts && prevHub.counts.sampledWithMissingMarkers) || 0)
        }
      };

      const diffPath = path.join(
        diffsDir,
        `${new Date().toISOString().replace(/[:.]/g, '').slice(0, 15)}_${basenameNoExt(pageSetFile)}_diff.json`
      );
      writeJson(diffPath, diff);
      console.log(`OK: Wrote coverage diff: ${rel(diffPath)}`);
    }
  }

  writeJson(releasesIndexPath, idx);

  console.log(`OK: Updated release artifact index: ${rel(releasesIndexPath)}`);

  console.log(`OK: Wrote LKG snapshot: ${rel(outPath)}`);
}

main();
