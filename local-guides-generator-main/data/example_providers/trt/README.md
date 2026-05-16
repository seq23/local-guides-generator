# TRT example providers (city-specific)

Optional.

If a file exists at:
- data/example_providers/trt/<citySlug>.json

Then the city hub page will include an "Examples of nearby providers" section (non-exhaustive, no rankings, no endorsements).

File format: JSON array of objects (max 12 items used):
- name

Example:
[
  {"name": "Example Clinic Name"}
]

Sourcing plan (when you decide to populate TRT lists):
- Verify relevant state or provider-verification resources first where available
- Keep the list non-exhaustive and neutral (alphabetical ordering recommended)
- Do not include public outbound provider destination URLs in the public example-provider files
