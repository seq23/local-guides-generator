#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function readJson(p, fallback = null) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}
function readText(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return ''; }
}
function lines(text) {
  return String(text || '').split(/\r?\n/).map(s => s.trim().replace(/^[-*]\s+/, '')).filter(Boolean);
}
function xmlLocs(text) {
  return Array.from(String(text || '').matchAll(/<loc>([^<]+)<\/loc>/g)).map(m => m[1].trim());
}
function bucketLinkCount(pageFamily) {
  if (['home','guides-hub'].includes(pageFamily)) return 'very-high';
  if (['guide-detail','city-home'].includes(pageFamily)) return 'high';
  if (['state','state-next-steps'].includes(pageFamily)) return 'medium';
  return 'low';
}
function freshnessClass(updatedAt) {
  if (!updatedAt) return 'unknown';
  const t = new Date(updatedAt).getTime();
  if (!Number.isFinite(t)) return 'unknown';
  const ageDays = (Date.now() - t) / 86400000;
  if (ageDays <= 3) return 'fresh-3d';
  if (ageDays <= 14) return 'fresh-14d';
  if (ageDays <= 45) return 'fresh-45d';
  return 'stale';
}

function run() {
  const dist = path.join(process.cwd(), 'dist');
  if (!fs.existsSync(dist)) throw new Error('distribution_manifest_emit: dist/ missing');

  const citation = readJson(path.join(dist, 'citation-manifest.json'), {});
  const pages = Array.isArray(citation.pages) ? citation.pages : [];
  if (!pages.length) throw new Error('distribution_manifest_emit: dist/citation-manifest.json pages[] missing/empty');

  const sitemapFiles = ['sitemap-core.xml','sitemap-guides.xml','sitemap-cities.xml','sitemap-states.xml','sitemap-fresh.xml'];
  const sitemapMembership = new Map();
  for (const name of sitemapFiles) {
    const urls = new Set(xmlLocs(readText(path.join(dist, name))));
    for (const url of urls) {
      const arr = sitemapMembership.get(url) || [];
      arr.push(name);
      sitemapMembership.set(url, arr);
    }
  }

  const llms = new Set(lines(readText(path.join(dist, 'llms.txt'))).filter(l => /^https?:\/\//i.test(l)));
  const llmsFull = new Set(lines(readText(path.join(dist, 'llms-full.txt'))).filter(l => /^https?:\/\//i.test(l)));
  const llmsGuides = new Set(lines(readText(path.join(dist, 'llms-guides.txt'))).filter(l => /^https?:\/\//i.test(l)));
  const idxBatch = new Set(lines(readText(path.join(dist, 'indexnow-batch.txt'))).filter(l => /^https?:\/\//i.test(l)));
  const idxPriority = new Set(lines(readText(path.join(dist, 'indexnow-priority.txt'))).filter(l => /^https?:\/\//i.test(l)));
  const priorityReview = readText(path.join(dist, 'distribution-priority-urls.txt'));

  // Whether the rendered page is actually indexable.
  //
  // Without this, distribution_dominance_contract.js asks every city-home page to
  // be in the sitemap, while sitemap_emit.js deliberately drops noindex pages - so
  // a page that is correctly held back from search reads as a distribution failure.
  // The two rules cannot both be satisfied, and the one that has to give is the
  // one asking a noindex page to be advertised.
  const isNoindex = (route) => {
    const rel = String(route || '/').replace(/^\/+|\/+$/g, '');
    const file = path.join(dist, rel, 'index.html');
    if (!fs.existsSync(file)) return false;
    const m = /<meta\s+name=["']robots["']\s+content=["']([^"']*)["']/i.exec(fs.readFileSync(file, 'utf8'));
    return m ? /\bnoindex\b/i.test(m[1]) : false;
  };

  const records = pages.map((p) => {
    const url = String(p.url || '');
    const pageFamily = String(p.pageFamily || 'unknown');
    const sitemaps = sitemapMembership.get(url) || [];
    const noindex = isNoindex(p.route);
    return {
      route: p.route || '/',
      url,
      pageFamily,
      title: p.title || '',
      priority: Number(p.priority || 0),
      updatedAt: p.updatedAt || '',
      freshnessClass: freshnessClass(p.updatedAt),
      priorityTier: ['home','guides-hub'].includes(pageFamily) ? 'tier-1' : ['guide-detail','city-home'].includes(pageFamily) ? 'tier-2' : ['state','state-next-steps'].includes(pageFamily) ? 'tier-3' : 'tier-4',
      noindex,
      indexable: !noindex,
      sitemapFiles: sitemaps,
      inSitemap: sitemaps.length > 0,
      inFreshSitemap: sitemaps.includes('sitemap-fresh.xml'),
      inCitationManifest: true,
      inLlms: llms.has(url),
      inLlmsFull: llmsFull.has(url),
      inLlmsGuides: llmsGuides.has(url),
      inIndexNowBatch: idxBatch.has(url),
      inIndexNowPriority: idxPriority.has(url),
      inPriorityReview: priorityReview.includes(`URL: ${url}`),
      internalLinkCountClass: bucketLinkCount(pageFamily),
    };
  });

  const counts = {
    totalPages: records.length,
    familyCounts: records.reduce((acc, r) => { acc[r.pageFamily] = (acc[r.pageFamily] || 0) + 1; return acc; }, {}),
    inFreshSitemap: records.filter(r => r.inFreshSitemap).length,
    inIndexNowPriority: records.filter(r => r.inIndexNowPriority).length,
    inIndexNowBatch: records.filter(r => r.inIndexNowBatch).length,
    inLlms: records.filter(r => r.inLlms).length,
    inLlmsFull: records.filter(r => r.inLlmsFull).length,
    inLlmsGuides: records.filter(r => r.inLlmsGuides).length,
  };

  const focusFamilies = ['home','guides-hub','guide-detail','city-home'];
  const focus = {};
  for (const fam of focusFamilies) {
    const famRecords = records.filter(r => r.pageFamily === fam);
    const total = famRecords.length || 1;
    focus[fam] = {
      total: famRecords.length,
      freshSitemapPct: +(100 * famRecords.filter(r => r.inFreshSitemap).length / total).toFixed(1),
      priorityPct: +(100 * famRecords.filter(r => r.inIndexNowPriority).length / total).toFixed(1),
      batchPct: +(100 * famRecords.filter(r => r.inIndexNowBatch).length / total).toFixed(1),
      llmsPct: +(100 * famRecords.filter(r => r.inLlms || r.inLlmsFull || r.inLlmsGuides).length / total).toFixed(1),
    };
  }

  const underexposed = records
    .filter(r => ['home','guides-hub','guide-detail','city-home'].includes(r.pageFamily))
    .filter(r => !(r.inSitemap && (r.inIndexNowPriority || r.inIndexNowBatch) && (r.inLlms || r.inLlmsFull || r.inLlmsGuides)))
    .slice(0, 40)
    .map(r => ({ url: r.url, pageFamily: r.pageFamily, route: r.route }));

  const out = {
    generatedAt: new Date().toISOString(),
    site: citation.site || null,
    counts,
    focus,
    underexposed,
    pages: records,
  };
  fs.writeFileSync(path.join(dist, 'distribution-manifest.json'), JSON.stringify(out, null, 2));

  const summaryLines = [];
  summaryLines.push('# distribution-summary.txt', '');
  summaryLines.push(`Generated: ${out.generatedAt}`);
  summaryLines.push(`Total pages tracked: ${counts.totalPages}`);
  summaryLines.push('');
  summaryLines.push('Focus family coverage:');
  for (const fam of focusFamilies) {
    const x = focus[fam];
    summaryLines.push(`- ${fam}: total=${x.total}, fresh-sitemap=${x.freshSitemapPct}%, indexnow-priority=${x.priorityPct}%, indexnow-batch=${x.batchPct}%, llms=${x.llmsPct}%`);
  }
  summaryLines.push('');
  summaryLines.push('Underexposed high-priority pages (first 15):');
  for (const item of underexposed.slice(0, 15)) {
    summaryLines.push(`- [${item.pageFamily}] ${item.url}`);
  }
  if (!underexposed.length) summaryLines.push('- none');
  summaryLines.push('');
  summaryLines.push('Next bottleneck: external submissions + recrawl cadence after deploy.');
  fs.writeFileSync(path.join(dist, 'distribution-summary.txt'), summaryLines.join('\n') + '\n');

  console.log(`distribution_manifest_emit: wrote distribution-manifest.json + distribution-summary.txt (${records.length} pages)`);
}

if (require.main === module) run();
module.exports = { run };
