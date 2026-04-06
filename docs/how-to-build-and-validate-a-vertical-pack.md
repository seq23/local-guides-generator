# How to Build and Validate a Vertical Pack

## Build one pack

```bash
PAGE_SET_FILE=data/page_sets/examples/uscis_medical_v1.json npm run prepare:site
PAGE_SET_FILE=data/page_sets/examples/uscis_medical_v1.json npm run build
LKG_VALIDATE_DIST=1 npm run validate:all
```

Replace the page set file with the pack you want to build.

## Build all packs

```bash
npm run build:all
npm run validate:all
```

## Key outputs

- generated HTML in `dist/`
- sitemap files
- llms.txt
- redirects
- release artifacts and audit snapshots


## Page-set path contract
Always pass `PAGE_SET_FILE` as a canonical repo-relative path under `data/page_sets/`. Do not use bare `examples/...`, `page_sets/...`, or guessed shortcuts.
