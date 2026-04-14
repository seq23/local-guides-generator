#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { PACK_SITE_CONFIG } = require("../lib/pack_site_config");

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

function getFallbackSiteConfig() {
  const site = readJsonSafe(SITE_JSON, {});
  const siteUrl = String(site.siteUrl || "").trim().replace(/\/$/, "");
  const brandName = String(site.brandName || "Site").trim() || "Site";
  return siteUrl ? { siteUrl, brandName } : null;
}

function getSiteConfigForVertical(vertical) {
  const key = String(vertical || "").trim();
  const fromPack = PACK_SITE_CONFIG[key];
  if (fromPack && fromPack.siteUrl) {
    return {
      siteUrl: String(fromPack.siteUrl).trim().replace(/\/$/, ""),
      brandName: String(fromPack.brandName || "Site").trim() || "Site",
    };
  }

  const envUrl = String(process.env.SITE_URL || "").trim().replace(/\/$/, "");
  const envBrand = String(process.env.BRAND_NAME || "Site").trim() || "Site";
  if (envUrl) return { siteUrl: envUrl, brandName: envBrand };

  const fallback = getFallbackSiteConfig();
  if (fallback) return fallback;

  throw new Error(
    `Unable to resolve site config for vertical '${key}'. Add it to PACK_SITE_CONFIG or provide SITE_URL.`
  );
}

function renderPage(c, pageUrl, siteUrl, brandName) {
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
    isPartOf: { "@type": "WebSite", name: brandName, url: `${siteUrl}/` },
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

function normalizePageRecord(page) {
  const relFile = String(page.file || "").replace(/\\/g, "/");
  const vertical = String(page.vertical || "").trim() || relFile.split("/").filter(Boolean)[1] || "";
  return { ...page, file: relFile, vertical };
}

function writeReferencePage(page, candidateRecord) {
  const relFile = String(page.file || "").replace(/\\/g, "/");
  if (!relFile) return;
  const outFile = path.join(ROOT, relFile);
  if (!fs.existsSync(outFile) && !candidateRecord) return;

  const siteCfg = getSiteConfigForVertical(page.vertical);
  const pageUrl = `${siteCfg.siteUrl}/${relFile.replace(/index\.html$/, "").replace(/\\/g, "/")}`;
  const candidate = candidateRecord || {
    id: page.id,
    vertical: page.vertical,
    query: page.query || page.id || relFile,
    source: page.source || "repo-local",
    cluster: Array.isArray(page.cluster) && page.cluster.length ? page.cluster : ["reference"],
  };

  ensureDir(path.dirname(outFile));
  fs.writeFileSync(outFile, renderPage(candidate, pageUrl, siteCfg.siteUrl, siteCfg.brandName));
}

function main() {
  ensureDir(DATA_DIR);
  ensureDir(REFERENCE_ROOT);

  const incoming = readJsonSafe(INCOMING, []);
  const registry = readJsonSafe(REGISTRY, { processed_ids: [], pages: [], promoted_ids: [] });

  if (!Array.isArray(registry.processed_ids)) registry.processed_ids = [];
  if (!Array.isArray(registry.pages)) registry.pages = [];
  if (!Array.isArray(registry.promoted_ids)) registry.promoted_ids = [];

  registry.pages = registry.pages.map(normalizePageRecord);

  const incomingById = new Map(
    incoming.filter((c) => c && typeof c.id === "string").map((c) => [c.id, c])
  );

  const usedFiles = new Set(registry.pages.map((p) => p.file));

  let count = 0;
  for (const c of incoming) {
    if (count >= MAX_NEW_PAGES_PER_RUN) break;

    let slug = slugify(c.id);
    let relFile = path.join("reference", c.vertical, slug, "index.html").replace(/\\/g, "/");
    let collisionCounter = 2;
    while (usedFiles.has(relFile)) {
      slug = `${slugify(c.id)}-${collisionCounter++}`;
      relFile = path.join("reference", c.vertical, slug, "index.html").replace(/\\/g, "/");
    }
    usedFiles.add(relFile);

    const page = {
      id: c.id,
      vertical: c.vertical,
      source: c.source,
      query: c.query,
      cluster: c.cluster,
      file: relFile,
      promoted: false,
      created_at: new Date().toISOString(),
    };

    writeReferencePage(page, c);
    registry.processed_ids.push(c.id);
    registry.pages.push(page);
    count++;
  }

  for (const page of registry.pages) {
    writeReferencePage(page, incomingById.get(page.id));
  }

  registry.updated_at = new Date().toISOString();
  fs.writeFileSync(REGISTRY, JSON.stringify(registry, null, 2));
  console.log(`generate_from_candidates: wrote ${count} reference page(s)`);
}

main();
