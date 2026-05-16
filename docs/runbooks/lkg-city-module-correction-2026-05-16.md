# LKG City Module Correction — 2026-05-16

## Purpose

This pass corrects the Batch 5 city-page enrichment rule so it prevents drift within each vertical without forcing one cross-vertical city-page shape.

## Rule

- Cross-vertical sameness: no.
- Intra-vertical sameness: yes.
- City-specific enrichment: yes, but only inside that vertical's consistent city-page shape.

## Source lane

The correction stays inside the existing LKG citation-agent lane:

```text
AI-agent PDF/CSV recommendations
→ classify canonical/LKG city-page recommendations
→ patch durable city source JSON for named/enriched cities
→ renderer supplies the vertical-specific default module for every other city in the same vertical
→ keep each vertical's own city module shape
→ optionally enrich named cities inside existing fields
→ validate with existing city decision support + citation-agent validators
→ build all packs and a representative dist pack
```

## Durable source/edit surfaces

Named-city enrichment remains in:

```text
data/city_content/uscis_medical/*.json
data/city_content/neuro/*.json
data/city_content/trt/*.json
data/city_content/dentistry/*.json
```

Vertical-wide default module rendering is handled in:

```text
scripts/build_city_sites.js
```

The renderer only fills the default vertical module when a city does not already have an enriched source file. Named city files keep their local detail; non-named cities inherit the same vertical shape.

## Vertical-specific module shapes

### USCIS Medical

All USCIS city pages render the `Local civil surgeon comparison checklist` shape. Named city enrichment stays inside that shape for Houston, Atlanta, and Miami.

### Neuro

All Neuro city pages render the `City-specific neuro evaluation decision checklist` shape. Named city enrichment stays inside that shape for Atlanta, Houston, Chicago, and future Seattle coverage.

### TRT / Hair Loss

All TRT city pages render the `Local TRT and hormone clinic authority checklist` shape. Named city enrichment stays inside that shape for Atlanta, Dallas, and Miami.

### Dentistry

All Dentistry city pages render the `Local dentist selection and payment checklist` shape. Named city enrichment stays inside that shape for Dallas, Atlanta, and Chicago.

## Validator behavior

The existing city decision support contract was expanded, not replaced:

```text
scripts/validation/city_decision_support_contract.js
```

It now checks every rendered city page in the active pack, not just a sample, and confirms that the active vertical's city pages render the correct vertical-specific checklist.

The citation-agent validator remains source-layer oriented:

```text
scripts/validation/lkg_citation_agent_fixes_2026_05.js
```

It checks artifact guide markers and named city enrichment source files without creating a cross-vertical contract.

## Representative dist pack

The packaged ZIP includes `dist/` built from:

```text
PAGE_SET_FILE=data/page_sets/examples/uscis_medical_v1.json
```

The full verification pass also built each covered vertical independently and confirmed rendered city module coverage:

```text
Dentistry: 56/56 city pages render Local dentist selection and payment checklist
Neuro: 56/56 city pages render City-specific neuro evaluation decision checklist
TRT: 56/56 city pages render Local TRT and hormone clinic authority checklist
USCIS Medical: 56/56 city pages render Local civil surgeon comparison checklist
```
