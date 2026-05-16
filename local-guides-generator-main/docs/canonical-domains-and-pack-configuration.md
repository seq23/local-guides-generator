# Canonical Domains and Pack Configuration

Each pack resolves to a real canonical domain.

- PI → `https://theaccidentguides.com`
- Dentistry → `https://dentistryguides.com`
- TRT → `https://hormonesivhair.com`
- Neuro → `https://neuroevalguides.com`
- USCIS → `https://uscisexam.com`

## Important behavior

`data/site.json` is stateful. It reflects the active pack that was most recently prepared or built. That is expected behavior in this repo.
