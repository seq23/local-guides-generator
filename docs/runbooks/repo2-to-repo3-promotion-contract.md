# Repo 2 → Repo 3 Promotion Contract

## Purpose

This contract defines the machine-readable handoff from the velocity repo to the canonical repo.

Repo 2 exports promotion candidates.
Repo 3 ingests candidates into hidden reference surfaces only.

## Source manifest

Default source:

`data/promotion_candidates.json` in Repo 2.

Repo 3 accepts two wire formats:

1. **Contract object (preferred)**
2. **Legacy top-level array**

### Preferred contract object

```json
{
  "contract_version": "1.0",
  "source_repo": "local-guides-citation-velocity",
  "generated_at": "2026-04-07T00:00:00.000Z",
  "candidates": [
    {
      "id": "example-id",
      "vertical": "personal-injury",
      "geo": null,
      "query": "best personal injury lawyer for rear-end accident",
      "cluster": ["rear end accident lawyer", "injury lawyer comparison"],
      "source": "repo2",
      "confidence": 0.86,
      "evidence": {},
      "status": "candidate"
    }
  ]
}
```

## Required candidate fields

- `id`
- `vertical`
- `query`
- `cluster`
- `source`
- `status`

## Repo 3 ingestion rules

- reject malformed payloads
- reject unsupported `contract_version`
- discard already-processed IDs
- dedupe by `vertical + query`
- write accepted records to `data/reference/incoming_candidates.json`
- write receipt metadata to `data/reference/last_pull_manifest.json`

## Notes

- Visible guides are not updated by this contract.
- Hidden ingestion only.
- Promotion to visible surfaces remains a separate gated workflow.
