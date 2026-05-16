# LKG Citation Agent Run — 2026-05 Data Trace

Source artifacts: USCIS, Neuro, TRT/Hair Loss, and Dentistry CSV/PDF reports.

Flow:

```text
PDF/CSV citation report
→ classify Velocity-owned vs canonical LKG-owned recommendations
→ apply only canonical LKG items in this repo
→ patch durable source layers
   - data/page_sets/examples/*_global_pages/*.json
   - data/city_content/*/*.json
→ record ledger at data/citation_agent_fixes/lkg_citation_agent_2026_05.json
→ build active pack or all packs
→ validate source and rendered contracts
→ distribution workflow submits IndexNow only after build/validation
```

Canonical LKG repair surfaces used:

- USCIS: `data/page_sets/examples/uscis_medical_global_pages/*.json` and `data/city_content/uscis_medical/*.json`
- Neuro: `data/page_sets/examples/neuro_global_pages/*.json` and `data/city_content/neuro/*.json`
- TRT/Hair Loss: `data/page_sets/examples/trt_global_pages/*.json` and `data/city_content/trt/*.json`
- Dentistry: `data/page_sets/examples/dentistry_global_pages/*.json` and `data/city_content/dentistry/*.json`

Velocity-owned `theindustryguides.com` recommendations are not patched here; they belong in the Velocity repo.
