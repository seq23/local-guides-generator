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
const DEFAULT_LOCAL_FILE = HOME
  ? path.join(
      HOME,
      "Documents",
      "GitHub",
      "local-guides-citation-velocity",
      "content",
      "_shared",
      "promotion_candidates.json"
    )
  : "";

const DEFAULT_URL = "";
const RAW_URL = process.env.REPO2_PROMOTION_CANDIDATES_URL || DEFAULT_URL;
const LOCAL_FILE = process.env.REPO2_PROMOTION_CANDIDATES_FILE || "";
const EXPECTED_CONTRACT_VERSION = "1.0";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data", "reference");
const INCOMING = path.join(DATA_DIR, "incoming_candidates.json");
const REGISTRY = path.join(DATA_DIR, "reference_registry.json");
const LAST_PULL = path.join(DATA_DIR, "last_pull_manifest.json");

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

function resolveSource() {
  if (LOCAL_FILE) {
    return { kind: "file", value: path.resolve(LOCAL_FILE) };
  }
  if (fs.existsSync(DEFAULT_REPO_LOCAL_FILE)) {
    return { kind: "file", value: DEFAULT_REPO_LOCAL_FILE };
  }
  if (DEFAULT_LOCAL_FILE && fs.existsSync(DEFAULT_LOCAL_FILE)) {
    return { kind: "file", value: DEFAULT_LOCAL_FILE };
  }
  if (RAW_URL.startsWith("file://")) {
    return { kind: "file", value: RAW_URL.replace(/^file:\/\//, "") };
  }
  if (RAW_URL) {
    return { kind: "url", value: RAW_URL };
  }
  throw new Error(
    "No promotion candidates source found. Set REPO2_PROMOTION_CANDIDATES_FILE or commit data/reference/promotion_candidates.source.json"
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
  console.log(`pull_velocity_candidates: wrote ${filtered.length} incoming candidate(s)`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
