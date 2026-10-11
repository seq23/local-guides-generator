#!/usr/bin/env python3
"""Daily Search Console truth for the five properties in data/search_intelligence/sites.json.

Per site, into data/search_intelligence/<host>/:
  gsc_search_analytics_export.json  query+page rows for the rolling 28 complete days
                                    (ending 3 days ago, Search Console's data lag),
                                    plus per-query and per-page rollups.
  gsc_sitemaps.json                 sitemaps.list; the live sitemaps are submitted
                                    ONLY when the property lists none.
  index_coverage.json               urlInspection.index.inspect, 8 requests in
                                    parallel, at most 150 URLs per site per day
                                    (5 x 150 = 750 of the 2,000/day quota, leaving
                                    room for the other portfolio repos). Rotation:
                                    homepage, then never-inspected sitemap URLs in
                                    sitemap order, then the oldest inspection, so
                                    every sitemap URL is covered over time. Rows
                                    merge with the previous file; counts are by
                                    coverageState over every URL inspected so far.

A missing credential, or a property the service account cannot read, is a
NAMED STOP line with exit 0 and that site's files left as they were (Rule 0: the
line says what did not happen). Any site that was read writes all its files.

Usage: collect_gsc.py [--only <host>] [data_dir]
"""
import concurrent.futures as cf
import datetime as dt
import json
import os
import re
import sys
import threading
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

READONLY = "https://www.googleapis.com/auth/webmasters.readonly"
WRITE = "https://www.googleapis.com/auth/webmasters"  # sitemaps.submit only
CAP_PER_SITE = 150
PARALLEL = 8
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))


def read_json(path, default=None):
    try:
        with open(path) as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return default


def write_json(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as fh:
        json.dump(obj, fh, indent=2)
        fh.write("\n")


def creds_for(scope):
    from google.oauth2 import service_account
    raw = os.environ.get("GSC_SERVICE_ACCOUNT_JSON", "")
    info = json.load(open(raw)) if os.path.exists(raw) else json.loads(raw)
    return service_account.Credentials.from_service_account_info(info, scopes=[scope]), info.get("client_email")


def service(creds):
    from googleapiclient.discovery import build
    return build("searchconsole", "v1", credentials=creds, cache_discovery=False)


def site_root(site):
    if site.startswith("sc-domain:"):
        return "https://" + site.split(":", 1)[1] + "/"
    return site if site.endswith("/") else site + "/"


def in_property(site, url):
    if site.startswith("sc-domain:"):
        domain = site.split(":", 1)[1].lower()
        host = urllib.parse.urlsplit(url).hostname or ""
        return host == domain or host.endswith("." + domain)
    return url.startswith(site_root(site))


def fetch(url, timeout=20):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (compatible; lkg-search-intelligence)"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def local(tag):
    return tag.rsplit("}", 1)[-1]


def discover(site):
    """Live sitemaps (robots.txt Sitemap: lines, else /sitemap.xml, following index children) and their page URLs."""
    root, notes, declared = site_root(site), [], []
    try:
        for line in fetch(root + "robots.txt").decode("utf-8", "replace").splitlines():
            m = re.match(r"\s*sitemap\s*:\s*(\S+)", line, re.I)
            if m and m.group(1) not in declared:
                declared.append(m.group(1))
    except Exception as exc:
        notes.append(f"robots.txt unreadable: {str(exc)[:200]}")
    if not declared:
        declared = [root + "sitemap.xml"]
    sitemaps, pages, queue, seen = [], [], list(declared), set()
    while queue and len(seen) < 200:
        url = queue.pop(0)
        if url in seen:
            continue
        seen.add(url)
        try:
            tree = ET.fromstring(fetch(url))
        except Exception as exc:
            notes.append(f"sitemap unreadable {url}: {str(exc)[:200]}")
            continue
        sitemaps.append(url)
        kind = local(tree.tag)
        for node in tree:
            loc = next((c.text.strip() for c in node if local(c.tag) == "loc" and c.text), None)
            if loc and kind == "sitemapindex":
                queue.append(loc)
            elif loc and loc not in pages:
                pages.append(loc)
    return [u for u in sitemaps if in_property(site, u)], [u for u in pages if in_property(site, u)], notes


def bucket(idx):
    state = (idx.get("coverageState") or "").lower()
    if "unknown to google" in state:
        return "unknown"
    if "crawled" in state and "not indexed" in state:
        return "crawled_not_indexed"
    if "discovered" in state and "not indexed" in state:
        return "discovered_not_indexed"
    if idx.get("verdict") == "PASS" or ("indexed" in state and "not indexed" not in state):
        return "indexed"
    return "other"


def sa_query(svc, site, start, end, dims, limit=25000):
    body = {"startDate": start, "endDate": end, "rowLimit": limit}
    if dims:
        body["dimensions"] = dims
    return svc.searchanalytics().query(siteUrl=site, body=body).execute().get("rows", [])


def metrics(r):
    return {"clicks": r.get("clicks", 0), "impressions": r.get("impressions", 0),
            "ctr": round(r.get("ctr", 0), 4), "position": round(r.get("position", 0), 1)}


def analytics(svc, site, now):
    end = dt.date.today() - dt.timedelta(days=3)
    start = end - dt.timedelta(days=27)
    s, e = start.isoformat(), end.isoformat()
    tot = sa_query(svc, site, s, e, None, 1)
    rows = [{"query": r["keys"][0], "page": r["keys"][1], **metrics(r)} for r in sa_query(svc, site, s, e, ["query", "page"])]
    rows.sort(key=lambda x: (-x["impressions"], x["query"], x["page"]))
    by_query = sorted(({"query": r["keys"][0], **metrics(r)} for r in sa_query(svc, site, s, e, ["query"])), key=lambda x: (-x["impressions"], x["query"]))
    by_page = sorted(({"page": r["keys"][0], **metrics(r)} for r in sa_query(svc, site, s, e, ["page"])), key=lambda x: (-x["impressions"], x["page"]))
    return {"schema_version": "1.0", "truth_source": "google_search_console_search_analytics", "site_url": site,
            "start_date": s, "end_date": e, "window_days": 28, "collected_at": now,
            "totals": metrics(tot[0]) if tot else {"clicks": 0, "impressions": 0, "ctr": 0, "position": 0},
            "query_count": len(by_query), "page_count": len(by_page), "row_count": len(rows),
            "rows": rows, "by_query": by_query, "by_page": by_page}


def sitemap_state(entries):
    return {e["path"]: {"lastSubmitted": e.get("lastSubmitted"), "lastDownloaded": e.get("lastDownloaded"),
                        "isPending": e.get("isPending"), "errors": int(e.get("errors", 0) or 0),
                        "warnings": int(e.get("warnings", 0) or 0)} for e in entries}


def sitemaps(svc_w, site, live, now):
    before = sitemap_state(svc_w.sitemaps().list(siteUrl=site).execute().get("sitemap", []))
    submitted, errors = [], {}
    if not before:  # submit only when the property lists no sitemap at all
        for url in live:
            try:
                svc_w.sitemaps().submit(siteUrl=site, feedpath=url).execute()
                submitted.append(url)
            except Exception as exc:
                errors[url] = str(exc)[:300]
    after = sitemap_state(svc_w.sitemaps().list(siteUrl=site).execute().get("sitemap", [])) if submitted else before
    return {"schema_version": "1.0", "site_url": site, "collected_at": now, "live_sitemaps": live,
            "listed_before": before, "submitted": submitted, "submit_errors": errors, "listed_after": after}


def coverage(creds, site, pages, notes, prev, now):
    home = site_root(site)
    universe = [home] + [u for u in pages if u.rstrip("/") != home.rstrip("/")]
    keep = set(universe)
    prev_rows = {r["url"]: r for r in (prev or {}).get("urls", []) if r.get("url") in keep}
    order = {u: i for i, u in enumerate(universe)}
    rest = sorted(universe[1:], key=lambda u: (u in prev_rows, (prev_rows.get(u) or {}).get("inspected_at") or "", order[u]))
    batch = ([home] + rest)[:CAP_PER_SITE]
    tl = threading.local()

    def inspect(url):
        if not hasattr(tl, "svc"):
            tl.svc = service(creds)
        try:
            idx = tl.svc.urlInspection().index().inspect(body={"inspectionUrl": url, "siteUrl": site}).execute() \
                .get("inspectionResult", {}).get("indexStatusResult", {})
            return {"url": url, "bucket": bucket(idx), "coverageState": idx.get("coverageState"),
                    "verdict": idx.get("verdict"), "lastCrawlTime": idx.get("lastCrawlTime"),
                    "googleCanonical": idx.get("googleCanonical"), "userCanonical": idx.get("userCanonical"),
                    "inspected_at": now}
        except Exception as exc:
            return {"url": url, "bucket": "error", "error": str(exc)[:300]}

    with cf.ThreadPoolExecutor(PARALLEL) as pool:
        fresh = list(pool.map(inspect, batch))
    ok = [r for r in fresh if r["bucket"] != "error"]
    for r in ok:
        prev_rows[r["url"]] = r
    rows = [prev_rows[u] for u in universe if u in prev_rows]
    by_state, buckets = {}, {}
    for r in rows:
        by_state[r["coverageState"] or r["bucket"]] = by_state.get(r["coverageState"] or r["bucket"], 0) + 1
        buckets[r["bucket"]] = buckets.get(r["bucket"], 0) + 1
    return {"schema_version": "1.0", "truth_source": "google_search_console_url_inspection", "site_url": site,
            "collected_at": now, "state": "OK" if ok else "NAMED_STOP",
            "named_stop": None if ok else f"URL Inspection failed for all {len(batch)} URLs: {(fresh[0].get('error') if fresh else 'no URLs')}",
            "sitemap_url_count": len(universe), "inspected_this_run": len(ok), "errors_this_run": len(fresh) - len(ok),
            "inspected_total": len(rows), "never_inspected": len(universe) - len(rows),
            "quota": {"daily_limit_per_property": 2000, "cap_per_site_per_day": CAP_PER_SITE, "parallel": PARALLEL},
            "rotation": "homepage, then never-inspected sitemap URLs in sitemap order, then oldest inspection first",
            "summary": {"by_coverage_state": dict(sorted(by_state.items())), "buckets": dict(sorted(buckets.items()))},
            "truth_boundary": "URL Inspection reports Google's index state per URL at inspected_at; impressions come from gsc_search_analytics_export.json.",
            "notes": notes, "urls": rows}


def main():
    args = sys.argv[1:]
    only = None
    if args[:1] == ["--only"]:
        only, args = args[1], args[2:]
    data_dir = args[0] if args else os.path.join(ROOT, "data", "search_intelligence")
    sites = [s for s in read_json(os.path.join(ROOT, "data", "search_intelligence", "sites.json"))["sites"] if not only or s["host"] == only]
    if not sites:
        sys.exit("no site selected from data/search_intelligence/sites.json")
    if not os.environ.get("GSC_SERVICE_ACCOUNT_JSON"):
        print("NAMED STOP: GSC_SERVICE_ACCOUNT_JSON is not set; Search Console files left as they were")
        return
    now = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
    creds, account = creds_for(READONLY)
    wcreds, _ = creds_for(WRITE)
    svc, svc_w = service(creds), service(wcreds)
    read_ok = 0
    for s in sites:
        site, out = s["gsc_site"], os.path.join(data_dir, s["host"])
        try:
            a = analytics(svc, site, now)
        except Exception as exc:
            print(f"NAMED STOP: {site} search analytics unreadable as {account}: {str(exc)[:300]}")
            continue
        read_ok += 1
        write_json(os.path.join(out, "gsc_search_analytics_export.json"), a)
        live, pages, notes = discover(site)
        try:
            write_json(os.path.join(out, "gsc_sitemaps.json"), sitemaps(svc_w, site, live, now))
        except Exception as exc:
            print(f"NAMED STOP: {site} sitemaps.list unreadable: {str(exc)[:300]}")
        prev = read_json(os.path.join(out, "index_coverage.json"))
        cov = coverage(creds, site, pages, notes, prev, now)
        if cov["state"] == "OK":
            write_json(os.path.join(out, "index_coverage.json"), cov)
        else:
            print(f"NAMED STOP: {site} {cov['named_stop']}")
        print(f"{s['host']}: analytics rows={a['row_count']} impressions={a['totals']['impressions']} | coverage "
              f"+{cov['inspected_this_run']} -> {cov['inspected_total']}/{cov['sitemap_url_count']} {cov['summary']['buckets']}")
    if read_ok == 0:
        print("NAMED STOP: no property was readable; nothing written")


if __name__ == "__main__":
    main()
