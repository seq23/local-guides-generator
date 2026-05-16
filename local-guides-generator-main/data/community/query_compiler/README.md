# Query Compiler Bridge

Optional bridge inputs for fan-out query clusters.

Supported files:
- `shared.json`
- `<vertical>.json` (for example: `pi.json`, `dentistry.json`, `trt.json`, `neuro.json`, `uscis_medical.json`)

Shape:

```json
{
  "overrides": {
    "guides-hub:/guides/": {
      "addItems": [
        {
          "groupId": "custom",
          "groupLabel": "Observed prompts",
          "query": "sample observed prompt",
          "href": "/guides/",
          "label": "Guides hub"
        }
      ]
    }
  }
}
```

Keys may target:
- exact page kind + route, for example `guide-detail:/guides/sample-guide/`
- exact route only, for example `/guides/sample-guide/`
- page-kind wildcard, for example `city:*`
- global wildcard `*`
