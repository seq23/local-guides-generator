# TRT example providers (city-specific)

Optional.

If a file exists at:
- data/example_providers/trt/<citySlug>.json

Then the city hub page will include an "Examples of nearby providers" section (non-exhaustive, no rankings, no endorsements).

File format: JSON array of objects (max 12 items used):
- name
- official_site_url

Example:
[
  {"name": "Example Clinic Name", "official_site_url": "https://example.com"}
]

Sourcing plan (when you decide to populate TRT lists):
- Use official sites only (no Yelp/aggregators)
- Verify state licensing resources first (preferred)
- Keep the list non-exhaustive and neutral (alphabetical ordering recommended)
