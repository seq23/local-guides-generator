#!/usr/bin/env python3
"""Inspect priority URLs against the Search Console URL Inspection API.

WHY THIS WAS REWRITTEN (2026-08-27)
The previous version looped over every priority URL with no cap, no pacing and no
error handling, then crashed on the first quota rejection:

    googleapiclient.errors.HttpError: <HttpError 429 ...
    "Quota exceeded for sc-domain:hormonesivhair.com"

Two consequences, and the second is worse than the first:

  1. Every result collected before the 429 was DISCARDED. The write happened after
     the loop, so a crash at URL 12 threw away 11 good inspections.
  2. deploy_distribution.sh calls this with `|| echo "WARNING: ..."`, so the crash
     became a warning and the job reported success. URL inspection has therefore
     been failing silently on every run while the pipeline looked green.

Google's quota is 2,000 inspections/day and 600/minute per property. A full
priority file exceeds the daily quota on its own, so hitting 429 is the normal
outcome of the old design, not an anomaly.

WHAT THIS DOES NOW
  - Caps the run (GSC_INSPECTION_LIMIT, default 20) so a single pack cannot burn
    the daily quota for every other pack in the matrix.
  - Paces requests (GSC_INSPECTION_SLEEP, default 0.2s) to stay under 600/min.
  - Treats 429 as a STOP, not a crash: it keeps what it has, records why it
    stopped, and exits 0 -- quota exhaustion is an expected operating condition.
  - Retries 500/503 with backoff, because those are transient.
  - Writes results even on failure, so partial work survives.
  - Exits non-zero only for real faults (bad credentials, unreadable input),
    which is the case the caller's `|| echo WARNING` should actually surface.
"""
import json
import os
import sys
import time
from pathlib import Path

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

DEFAULT_LIMIT = 20
DEFAULT_SLEEP = 0.2
MAX_RETRIES = 3


def load_urls(path):
    urls = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line.startswith("http://") or line.startswith("https://"):
                urls.append(line)
    return urls


def env_int(name, default):
    raw = (os.getenv(name) or "").strip()
    if not raw:
        return default
    try:
        value = int(raw)
        return value if value > 0 else default
    except ValueError:
        return default


def env_float(name, default):
    raw = (os.getenv(name) or "").strip()
    if not raw:
        return default
    try:
        value = float(raw)
        return value if value >= 0 else default
    except ValueError:
        return default


def write_report(output_json, payload):
    out = Path(output_json)
    out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)


def main():
    if len(sys.argv) != 5:
        print("Usage: gsc_inspect_urls.py <service-account.json> <siteUrl> <urlFile> <outputJson>")
        sys.exit(1)

    creds_path, site_url, url_file, output_json = sys.argv[1:5]
    limit = env_int("GSC_INSPECTION_LIMIT", DEFAULT_LIMIT)
    sleep_s = env_float("GSC_INSPECTION_SLEEP", DEFAULT_SLEEP)

    scopes = ["https://www.googleapis.com/auth/webmasters.readonly"]
    creds = service_account.Credentials.from_service_account_file(creds_path, scopes=scopes)
    service = build("searchconsole", "v1", credentials=creds)

    all_urls = load_urls(url_file)
    urls = all_urls[:limit]
    deferred = len(all_urls) - len(urls)

    results = []
    stopped_reason = None

    for index, url in enumerate(urls):
        body = {"inspectionUrl": url, "siteUrl": site_url, "languageCode": "en-US"}
        for attempt in range(MAX_RETRIES):
            try:
                print(f"Inspecting ({index + 1}/{len(urls)}): {url}")
                results.append(service.urlInspection().index().inspect(body=body).execute())
                break
            except HttpError as err:
                status = getattr(getattr(err, "resp", None), "status", None)
                if status == 429:
                    # Expected. 2,000/day and 600/min per property; a full priority
                    # file exceeds the daily quota on its own.
                    stopped_reason = f"quota_exceeded_after_{len(results)}_inspections"
                    print(f"QUOTA: stopping after {len(results)} inspection(s) -- {site_url} quota exhausted.")
                    break
                if status in (500, 503) and attempt < MAX_RETRIES - 1:
                    backoff = 2 ** attempt
                    print(f"TRANSIENT {status}: retrying in {backoff}s ({attempt + 1}/{MAX_RETRIES})")
                    time.sleep(backoff)
                    continue
                stopped_reason = f"http_error_{status}_after_{len(results)}_inspections"
                print(f"ERROR {status} on {url}: stopping and keeping {len(results)} result(s).")
                break
        if stopped_reason:
            break
        if sleep_s:
            time.sleep(sleep_s)

    payload = {
        "schema_version": "2.0",
        "site_url": site_url,
        "urls_in_priority_file": len(all_urls),
        "limit_applied": limit,
        "deferred_by_limit": deferred,
        "inspected": len(results),
        "stopped_reason": stopped_reason,
        "results": results,
    }
    write_report(output_json, payload)

    print(f"Wrote {len(results)} inspection result(s) to {output_json}")
    if deferred:
        print(f"NOTE: {deferred} priority URL(s) not inspected this run (limit {limit}). Not silently dropped -- recorded as deferred_by_limit.")
    if stopped_reason and stopped_reason.startswith("quota_exceeded"):
        # Quota exhaustion is an operating condition, not a fault. Exit 0 so the
        # caller does not mask a real failure behind the same WARNING line.
        print("Quota exhausted. This is expected on a full priority file and is not a build failure.")
        return
    if stopped_reason:
        sys.exit(1)


if __name__ == "__main__":
    main()
