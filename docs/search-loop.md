# Search loop (canonical side)

The shared search engine is [seq23/search-loop](https://github.com/seq23/search-loop) (`@v1`).
Owner ruling, 1 Nov 2026 (spry brain, "Search growth loop on every selling site"): the
**velocity repo builds the daily new pages; this repo gets no daily new-page build.** Here the
loop runs three stages for the six canonical sites, daily at 15:41 UTC after
`rotating_refresh.yml` has committed the day's Search Console truth.

| Stage | What it does | Where |
|---|---|---|
| MISSING-GUIDE | Reads the velocity repo's `data/search-loop/missing-guides.json`. A topic with no canonical guide here is drafted on the $0 router, sourced (every source must answer), gated (the canonical section shape from `vertical_guide_depth_contract.js`, PI wording rules, health gate, near-duplicate check) and written as a page-set guide with a hub card. Then the repo's own build, validators and cadence gate run; anything they refuse is reverted and recorded as dropped. Published straight away on `main` and deployed. | `scripts/search_loop/canonical_loop.mjs` |
| CHECK + REPAIR | Loop guides at 2/4/8 weeks and 90 days with the engine's own checkpoint/decision code; near-page-one guides strengthened at source (`search_strengthening`, before/after hash, undo); every measured demand family the build requires served and not yet served is strengthened here; the lead path (request page + lead endpoint, empty-payload 400 probe — nothing stored) is probed live on every site. | same |
| REPORT | `search-loop-week-v1` per site, Actions artifact `search-loop-week`. | `reports/search-loop/` |

- **Config:** `search-loop.config.json` — each `sites[]` entry must pass the engine's own config check (`tests/search_loop/canonical_loop.test.mjs`).
- **Pace for new pages:** missing guides only, at most the engine pace and never above `new_pages_per_week` in `data/cadence/policy.json` per site per week.
- **Ledger:** `data/search-loop/<host>/` (`pages.json`, `missing-guides.json`, `pace.json`, `snapshots/`).
- **Throttle all sites:** `gh variable set SEARCH_LOOP_MODE --body slow -R seq23/search-loop` (normal | slow | off).
- **Proof run:** a pull request touching the loop drafts, gates and builds one fixture topic (`tests/search_loop/fixtures/proof-missing-guides.json`) and commits nothing.
- **Retired 1 Nov 2026:** the velocity candidate-promotion lane (`ingestion_sync.yml`, `promote_reference.yml`, `complete_promoted_guides.yml` and their scripts/validators) and the 11 Oct publishing freeze.
