# Release Validation and Deployment Checklist

## Before packaging a release

1. run `npm run build:all`
2. run `npm run validate:all`
3. run `npm run qa:release` for release candidates
4. inspect `dist/`
5. verify canonical domains and conversion surfaces
6. package the baseline snapshot from the true repo root
7. reopen the ZIP and confirm required root files exist

## Required root files

- `.gitignore`
- `README.md`
- `package.json`
- `_headers`
- `_redirects` when applicable
