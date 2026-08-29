#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const https = require("https");

const HOME = process.env.HOME || "";
const DEFAULT_REPO_LOCAL_FILE = path.join(
  process.cwd(),
  "data",
  "reference",
  "promotion_candidates.source.json"
);
const VELOCITY_RELATIVE = path.join(
  "local-guides-citation-velocity",
  "content",
  "_shared",
  "promotion_candidates.json"
);
// Checkouts live at ~/GitHub on the maintainer's machine; ~/Documents/GitHub was
// the original guess and never existed, so a manual run without an explicit env
// var silently fell through to the empty committed stub.
const DEFAULT_LOCAL_CANDIDATES = HOME
  ? [
      path.join(HOME, "GitHub", VELOCITY_RELATIVE),
      path.join(HOME, "Documents", "GitHub", VELOCITY_RELATIVE),
    ]
  : [];

const DEFAULT_URL = "";
const RAW_URL = process.env.REPO2_PROMOTION_CANDIDATES_URL || DEFAULT_URL;
const LOCAL_FILE = process.env.REPO2_PROMOTION_CANDIDATES_FILE || "";
const EXPECTED_CONTRACT_VERSION = "1.0";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data", "reference");
const INCOMING = path.join(DATA_DIR, "incoming_candidates.json");
const REGISTRY = path.join(DATA_DIR, "reference_registry.json");
const LAST_PULL = path.join(DATA_DIR, "last_pull_manifest.json");
const SHOULD_WRITE_PULL_MANIFEST = process.env.REFERENCE_WRITE_PULL_MANIFEST === "1";

fs.mkdirSync(DATA_DIR, { recursive: true });

function readJsonSafe(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function readJsonFile(file) {
  return JSON.parse(fs.readFileSync(path.resolve(file), "utf8"));
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 15000 }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} fetching ${url}`));
        res.resume();
        return;
      }
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(body));
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on("timeout", () => req.destroy(new Error(`Timeout fetching ${url}`)));
    req.on("error", reject);
  });
}

function stubHasCandidates(file) {
  if (!fs.existsSync(file)) return false;
  const payload = readJsonSafe(file, null);
  if (!payload) return false;
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(payload.items)
    ? payload.items
    : Array.isArray(payload.candidates)
    ? payload.candidates
    : [];
  return list.length > 0;
}

function resolveSource() {
  if (LOCAL_FILE) {
    return { kind: "file", value: path.resolve(LOCAL_FILE) };
  }
  // The committed stub is a legitimate source for the manual promote_reference
  // PR lane, but it is committed as an EMPTY file. It therefore always existed
  // and always won this resolution order, so the daily cross-repo sync cron
  // resolved to it every run and ingested nothing. Only prefer it when it
  // actually carries candidates.
  if (stubHasCandidates(DEFAULT_REPO_LOCAL_FILE)) {
    return { kind: "file", value: DEFAULT_REPO_LOCAL_FILE };
  }
  for (const candidatePath of DEFAULT_LOCAL_CANDIDATES) {
    if (fs.existsSync(candidatePath)) {
      return { kind: "file", value: candidatePath };
    }
  }
  if (RAW_URL.startsWith("file://")) {
    return { kind: "file", value: RAW_URL.replace(/^file:\/\//, "") };
  }
  if (RAW_URL) {
    return { kind: "url", value: RAW_URL };
  }
  throw new Error(
    [
      "No promotion candidates source reachable.",
      "",
      "The committed stub data/reference/promotion_candidates.source.json carries 0",
      "candidates, so it is not treated as a source. The real candidates live in",
      "local-guides-citation-velocity at content/_shared/promotion_candidates.json,",
      "which is not checked out in this environment.",
      "",
      "Previously this condition resolved to the empty stub and logged",
      "'wrote 0 incoming candidate(s)', which is indistinguishable from a genuinely",
      "empty upstream -- the scheduled Ingestion Sync cron therefore ingested nothing",
      "for months without anyone being told. It now stops with this message instead.",
      "",
      "Fix by one of:",
      "  - set REPO2_PROMOTION_CANDIDATES_URL to a reachable copy of that file",
      "  - check out the velocity repo in .github/workflows/ingestion_sync.yml and set",
      "    REPO2_PROMOTION_CANDIDATES_FILE to its path",
      "  - commit real candidates into the stub for the manual promote_reference lane",
    ].join("\n")
  );
}

async function readPayload(source) {
  if (source.kind === "file") {
    return readJsonFile(source.value);
  }
  return fetchJson(source.value);
}

function normalizeLegacyItem(item) {
  return {
    id: item.id,
    vertical: item.vertical,
    query: item.query,
    cluster: Array.isArray(item.cluster)
      ? item.cluster
      : typeof item.cluster === "string" && item.cluster.trim()
      ? [item.cluster.trim()]
      : [],
    source: item.source || item.source_bucket || "repo2",
    status: item.status || item.promotion_status || "candidate",
    geo: item.geo ?? null,
    confidence: item.confidence ?? null,
    evidence: item.evidence ?? null,
  };
}

function normalizePayload(payload) {
  if (Array.isArray(payload)) {
    return {
      contract_version: EXPECTED_CONTRACT_VERSION,
      source_repo: "legacy-array",
      generated_at: null,
      candidates: payload.map(normalizeLegacyItem),
    };
  }

  if (!payload || typeof payload !== "object") {
    throw new Error("promotion candidates payload must be an array or object");
  }

  if (Array.isArray(payload.items)) {
    return {
      contract_version: EXPECTED_CONTRACT_VERSION,
      source_repo: payload.source_repo || "local-guides-citation-velocity",
      generated_at: payload.generated_at || null,
      candidates: payload.items.map(normalizeLegacyItem),
    };
  }

  if (payload.contract_version !== EXPECTED_CONTRACT_VERSION) {
    throw new Error(
      `Unsupported contract_version: ${String(payload.contract_version || "missing")}`
    );
  }

  if (!Array.isArray(payload.candidates)) {
    throw new Error("promotion candidates object missing candidates array");
  }

  return {
    ...payload,
    candidates: payload.candidates.map(normalizeLegacyItem),
  };
}

function validCandidate(c) {
  return (
    c &&
    typeof c.id === "string" &&
    typeof c.vertical === "string" &&
    typeof c.query === "string" &&
    Array.isArray(c.cluster) &&
    c.cluster.length > 0 &&
    typeof c.source === "string" &&
    typeof c.status === "string"
  );
}

(async function main() {
  const source = resolveSource();
  const payload = normalizePayload(await readPayload(source));

  const registry = readJsonSafe(REGISTRY, {
    processed_ids: [],
    pages: [],
    promoted_ids: [],
  });

  if (!Array.isArray(registry.processed_ids)) {
    throw new Error("reference_registry.json missing processed_ids array");
  }
  if (!Array.isArray(registry.pages)) {
    registry.pages = [];
  }
  if (!Array.isArray(registry.promoted_ids)) {
    registry.promoted_ids = [];
  }

  const processed = new Set(registry.processed_ids || []);
  const seenKeys = new Set();

  const filtered = payload.candidates
    .filter(validCandidate)
    .filter((c) => !processed.has(c.id))
    .filter((c) => {
      const key = `${c.vertical}::${String(c.query).trim().toLowerCase()}`;
      if (seenKeys.has(key)) return false;
      seenKeys.add(key);
      return true;
    });

  filtered.forEach((c) => processed.add(c.id));

  registry.processed_ids = Array.from(processed);
  registry.updated_at = new Date().toISOString();

  fs.writeFileSync(REGISTRY, JSON.stringify(registry, null, 2));
  fs.writeFileSync(INCOMING, JSON.stringify(filtered, null, 2));
  if (SHOULD_WRITE_PULL_MANIFEST) {
    fs.writeFileSync(
      LAST_PULL,
      JSON.stringify(
        {
          source_repo: payload.source_repo || null,
          contract_version: payload.contract_version || null,
          generated_at: payload.generated_at || null,
          accepted_count: filtered.length,
          pulled_at: new Date().toISOString(),
          source_url: source.kind === "url" ? source.value : null,
          source_file: source.kind === "file" ? source.value : null,
        },
        null,
        2
      )
    );
  }
  console.log(
    `pull_velocity_candidates: wrote ${filtered.length} incoming candidate(s) from ${source.kind}:${source.value}`
  );

  // Rule 0: no stage may exit 0 having done nothing.
  //
  // This lane is the cross-repo seam: local-guides-citation-velocity produces
  // promotion candidates for the five guide properties this repo generates. The
  // scheduled Ingestion Sync cron resolved to the committed EMPTY stub on every
  // run (CI checks out only this repo, so no other source is reachable) and
  // logged "wrote 0 incoming candidate(s)" -- indistinguishable from a genuinely
  // empty upstream. It has ingested nothing since April while real candidates
  // accumulated across the seam.
  //
  // An empty PULL is legitimate when a source was explicitly configured and had
  // nothing new. It is NOT legitimate when no real source was reachable at all:
  // that is the lane silently declining work nobody is told about.
  const explicitlyConfigured = Boolean(LOCAL_FILE || RAW_URL);
  const resolvedToEmptyStub =
    source.kind === "file" &&
    path.resolve(source.value) === path.resolve(DEFAULT_REPO_LOCAL_FILE) &&
    payload.candidates.length === 0;

  if (resolvedToEmptyStub && !explicitlyConfigured) {
    console.error(
      [
        "pull_velocity_candidates: NO CANDIDATE SOURCE REACHABLE.",
        "",
        "Resolved to the committed stub data/reference/promotion_candidates.source.json,",
        "which carries 0 candidates, and no REPO2_PROMOTION_CANDIDATES_FILE or",
        "REPO2_PROMOTION_CANDIDATES_URL was configured. Nothing was ingested and no",
        "upstream was actually consulted, so this is a silent no-op rather than an",
        "empty upstream.",
        "",
        "local-guides-citation-velocity holds the real candidates at",
        "content/_shared/promotion_candidates.json. To make this lane real, either:",
        "  - set REPO2_PROMOTION_CANDIDATES_URL to a reachable copy of that file, or",
        "  - check the velocity repo out in the Ingestion Sync workflow and set",
        "    REPO2_PROMOTION_CANDIDATES_FILE to its path, or",
        "  - commit real candidates into the stub for the manual promote_reference lane.",
      ].join("\n")
    );
    process.exit(1);
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
