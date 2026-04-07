#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data", "reference");
const INCOMING = path.join(DATA_DIR, "incoming_candidates.json");
const REGISTRY = path.join(DATA_DIR, "reference_registry.json");
const REFERENCE_ROOT = path.join(ROOT, "reference");
const SITE_JSON = path.join(ROOT, "data", "site.json");

const MAX_NEW_PAGES_PER_RUN = 25;

function readJsonSafe(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getSiteConfig() {
  const site = readJsonSafe(SITE_JSON, {});
  const siteUrl = String(site.siteUrl || "").trim();
  const brandName = String(site.brandName || "Site").trim() || "Site";
  if (!siteUrl) throw new Error("data/site.json missing siteUrl");
  return { siteUrl: siteUrl.replace(/\/$/, ""), brandName };
}

function renderPage(c, pageUrl, brandName) {
  const safeQuery = escapeHtml(c.query);
  const safeVertical = escapeHtml(c.vertical);
  const safeSource = escapeHtml(c.source);
  const safeId = escapeHtml(c.id);

  const faqJson = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: `How should someone evaluate ${c.query}?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `Start by comparing fit, credibility, process clarity, risk factors, and whether the provider or option actually matches the situation described by the query.`,
        },
      },
    ],
  };

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${safeQuery}</title>
  <meta name="description" content="Hidden reference surface for LLM ingestion: ${safeQuery}">
  <link rel="canonical" href="${escapeHtml(pageUrl)}">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: c.query,
    url: pageUrl,
    isPartOf: { "@type": "WebSite", name: brandName, url: `${pageUrl.split('/reference/')[0]}/` },
  })}</script>
  <script type="application/ld+json">${JSON.stringify(faqJson)}</script>
</head>
<body>
  <main>
    <h1>${safeQuery}</h1>

    <section data-short-answer="true">
      <h2>Short answer</h2>
      <p>This reference page exists to make the query legible to retrieval systems and future guide-generation logic. It defines the scenario clearly, gives the main comparison criteria, and preserves the underlying signal discovered in the velocity system. It is intentionally structured for extraction, not browsing. Use it as a machine-readable reference surface rather than a primary user-facing guide. The goal is stable ingestion, better retrieval, and stronger future canonical page creation.</p>
    </section>

    <section>
      <h2>What this situation means</h2>
      <p>Vertical: ${safeVertical}</p>
      <p>Source: ${safeSource}</p>
      <p>Candidate ID: ${safeId}</p>
    </section>

    <section>
      <h2>What to compare</h2>
      <ul>
        <li>Fit for the specific query</li>
        <li>Decision criteria and red flags</li>
        <li>Whether the visible guide layer already covers this well</li>
        <li>Whether this should stay hidden or eventually be promoted</li>
      </ul>
    </section>

    <section>
      <h2>Cluster signals</h2>
      <ul>
        ${c.cluster.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}
      </ul>
    </section>

    <section>
      <h2>Red flags</h2>
      <p>Reject promotion if this surface is duplicative, vague, low-signal, or already covered in a stronger canonical public page.</p>
    </section>
  </main>
</body>
</html>`;
}

function main() {
  ensureDir(DATA_DIR);
  ensureDir(REFERENCE_ROOT);

  const incoming = readJsonSafe(INCOMING, []);
  const registry = readJsonSafe(REGISTRY, { processed_ids: [], pages: [] });
  const { siteUrl, brandName } = getSiteConfig();
  const usedFiles = new Set((registry.pages || []).map((p) => p.file));

  incoming.sort((a, b) => Number(b.confidence || 0) - Number(a.confidence || 0));

  let count = 0;
  for (const c of incoming) {
    if (count >= MAX_NEW_PAGES_PER_RUN) break;

    let slug = slugify(c.id);
    let relFile = path.join("reference", c.vertical, slug, "index.html");
    let collisionCounter = 2;
    while (usedFiles.has(relFile)) {
      slug = `${slugify(c.id)}-${collisionCounter++}`;
      relFile = path.join("reference", c.vertical, slug, "index.html");
    }
    usedFiles.add(relFile);

    const outFile = path.join(ROOT, relFile);
    const outDir = path.dirname(outFile);
    const pageUrl = `${siteUrl}/${relFile.replace(/index\.html$/, "").replace(/\\/g, "/")}`;
    ensureDir(outDir);

    fs.writeFileSync(outFile, renderPage(c, pageUrl, brandName));
    registry.processed_ids.push(c.id);
    registry.pages.push({
      id: c.id,
      vertical: c.vertical,
      source: c.source,
      file: relFile.replace(/\\/g, "/"),
      promoted: false,
      created_at: new Date().toISOString(),
    });
    count++;
  }

  fs.writeFileSync(REGISTRY, JSON.stringify(registry, null, 2));
  console.log(`generate_from_candidates: wrote ${count} reference page(s)`);
}

main();
