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
const STATUS = path.join(DATA_DIR, "ingestion_sync_status.json");
const SHOULD_WRITE_PULL_MANIFEST = process.env.REFERENCE_WRITE_PULL_MANIFEST === "1";

// A NAMED STOP is a legitimate Rule 0 outcome: the lane did no work, and said
// exactly why, naming the credential that would let it do work. It is only
// legitimate where an unreachable upstream is a KNOWN, accepted condition --
// that is, in the scheduled CI lane, which cannot read another private repo
// with only GITHUB_TOKEN. A human running `npm run ingestion:pull` by hand has
// no such excuse: for them an unreachable source is an error and still exits 1.
const ALLOW_NAMED_STOP = process.env.INGESTION_SYNC_ALLOW_NAMED_STOP === "1";

const CREDENTIAL_INSTRUCTIONS = [
  "The cross-repo source is UNREACHABLE and no substitute was configured.",
  "",
  "local-guides-citation-velocity holds the promotion candidates for the five",
  "properties this repo generates, at content/_shared/promotion_candidates.json.",
  "CI checks out only this repository and only GITHUB_TOKEN is available, which",
  "cannot read another private repo, so that file is not reachable from a run.",
  "",
  "The committed stub data/reference/promotion_candidates.source.json carries 0",
  "candidates and is therefore not treated as a source: preferring it on mere",
  "existence is what made this lane a silent no-op from April onward.",
  "",
  "MISSING CREDENTIAL -- wire exactly one of:",
  "  1. secret REPO2_PROMOTION_CANDIDATES_URL",
  "     an https URL serving that JSON; set it as an env var on the pull step.",
  "  2. a cross-repo PAT with read access to local-guides-citation-velocity",
  "     used by an actions/checkout of that repo in ingestion_sync.yml, with",
  "     REPO2_PROMOTION_CANDIDATES_FILE pointed at the checked-out path.",
  "  3. the manual lane: commit real candidates into",
  "     data/reference/promotion_candidates.source.json and let",
  "     promote_reference.yml run on the PR.",
];

function writeStatus(state, detail, extra) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(
    STATUS,
    JSON.stringify(
      {
        stage: "pull_velocity_candidates",
        state,
        detail,
        ...extra,
        recorded_at: new Date().toISOString(),
      },
      null,
      2
    ) + "\n"
  );
}

function namedStop(reason) {
  const block = [
    "",
    "=".repeat(72),
    "NAMED STOP: pull_velocity_candidates did no work, on purpose.",
    "=".repeat(72),
    "",
    reason,
    "",
    ...CREDENTIAL_INSTRUCTIONS,
    "",
    "Until one of those is wired this lane will keep reporting this stop. It is",
    "NOT a silent success: data/reference/ingestion_sync_status.json records",
    "state=named_stop on every run, and the workflow surfaces this block in the",
    "run summary.",
    "=".repeat(72),
    "",
  ].join("\n");

  writeStatus("named_stop", "no candidate source reachable", {
    missing_credential: [
      "REPO2_PROMOTION_CANDIDATES_URL",
      "REPO2_PROMOTION_CANDIDATES_FILE (needs a cross-repo PAT checkout)",
    ],
    accepted_count: 0,
  });

  if (ALLOW_NAMED_STOP) {
    console.log(block);
    if (process.env.GITHUB_STEP_SUMMARY) {
      fs.appendFileSync(
        process.env.GITHUB_STEP_SUMMARY,
        "## Ingestion Sync: NAMED STOP\n\n```\n" + block + "\n```\n"
      );
    }
    if (process.env.GITHUB_OUTPUT) {
      fs.appendFileSync(process.env.GITHUB_OUTPUT, "named_stop=true\n");
    }
    process.exit(0);
  }
  console.error(block);
  console.error(
    "Exiting non-zero: this was a manual run. Set INGESTION_SYNC_ALLOW_NAMED_STOP=1\n" +
      "only in the scheduled lane, where an unreachable cross-repo source is a known\n" +
      "and accepted condition rather than a mistake."
  );
  process.exit(1);
}

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
  // No source at all. Not an exception: a NAMED STOP, handled by main() so the
  // lane leaves a receipt and names the missing credential either way.
  return null;
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
  if (!source) {
    namedStop(
      "resolveSource() found no reachable promotion candidates source."
    );
    return;
  }
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

  // DO NOT mark these processed here.
  //
  // This step used to do `filtered.forEach((c) => processed.add(c.id))`, so a
  // candidate was recorded as consumed the instant it was PULLED, before
  // anything had been generated from it. Every candidate the next stage then
  // skipped -- unsupported vertical, missing folder, per-run cap -- was
  // permanently swallowed: the id was in processed_ids, so no later run would
  // ever pull it again. The committed registry is the evidence: 86 processed
  // ids against only 25 generated pages. Sixty-one candidates were consumed by
  // a stage that produced nothing from them.
  //
  // processed_ids now means "a draft guide was generated from this", and only
  // generate_from_candidates.js writes it. A candidate that is pulled but not
  // generated stays pending and is pulled again next run, where the next stage
  // reports it as skipped rather than silently dropping it.
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

  // The previous Rule 0 guard here tested for `resolvedToEmptyStub` -- source
  // resolution having landed on the committed stub with zero candidates. That
  // condition became UNREACHABLE in the same change that introduced it:
  // resolveSource() gained stubHasCandidates(), so the stub can only ever win
  // resolution when it is non-empty, and the guard's own precondition
  // (candidates.length === 0) can then never hold. It was a guard that could
  // not reach what it governs. The named stop above replaces it and fires at
  // the point resolution actually fails.

  writeStatus("pulled", `resolved ${source.kind}:${source.value}`, {
    accepted_count: filtered.length,
    source_kind: source.kind,
    source_value: source.value,
    upstream_candidate_count: payload.candidates.length,
  });

  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `## Ingestion Sync: pulled ${filtered.length} candidate(s)\n\n` +
        `Source: \`${source.kind}:${source.value}\` — ` +
        `${payload.candidates.length} upstream, ${filtered.length} pending after ` +
        `filtering against already-generated ids.\n`
    );
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
