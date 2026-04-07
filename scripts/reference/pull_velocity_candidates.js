#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const https = require("https");

const DEFAULT_URL =
  "https://raw.githubusercontent.com/seq23/local-guides-citation-velocity/main/data/promotion_candidates.json";

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

function readPayload() {
  if (LOCAL_FILE) {
    return JSON.parse(fs.readFileSync(path.resolve(LOCAL_FILE), "utf8"));
  }
  if (RAW_URL.startsWith("file://")) {
    return JSON.parse(fs.readFileSync(RAW_URL.replace(/^file:\/\//, ""), "utf8"));
  }
  return fetchJson(RAW_URL);
}

function normalizePayload(payload) {
  if (Array.isArray(payload)) {
    return {
      contract_version: "legacy-array",
      source_repo: "legacy-array",
      generated_at: null,
      candidates: payload,
    };
  }

  if (!payload || typeof payload !== "object") {
    throw new Error("promotion candidates payload must be an array or object");
  }

  if (payload.contract_version !== EXPECTED_CONTRACT_VERSION) {
    throw new Error(
      `Unsupported contract_version: ${String(payload.contract_version || "missing")}`
    );
  }

  if (!Array.isArray(payload.candidates)) {
    throw new Error("promotion candidates object missing candidates array");
  }

  return payload;
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
  const payload = normalizePayload(await readPayload());

  const registry = readJsonSafe(REGISTRY, { processed_ids: [] });
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
        source_url: LOCAL_FILE ? null : RAW_URL,
        source_file: LOCAL_FILE || null
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
