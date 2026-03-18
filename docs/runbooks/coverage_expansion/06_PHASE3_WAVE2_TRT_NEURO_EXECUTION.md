# Phase 3 Wave 2 — TRT + Neuro Execution

## Scope

Wave 2 expands TRT and Neuro using the shared 20-city set already used for USCIS planning.

## Shared city set

- Atlanta, GA
- Boston, MA
- Charlotte, NC
- Chicago, IL
- Dallas, TX
- Denver, CO
- Houston, TX
- Las Vegas, NV
- Los Angeles, CA
- Miami, FL
- Minneapolis, MN
- New York City, NY
- Orlando, FL
- Philadelphia, PA
- Phoenix, AZ
- Sacramento, CA
- San Diego, CA
- San Francisco, CA
- Seattle, WA
- Tampa, FL

## TRT grouped-provider rule

Each promoted TRT city must render three grouped example-provider sections:

1. TRT / men's health clinics
2. IV hydration / IV therapy clinics
3. Hair restoration providers

Each group must contain exactly three alphabetized provider names.

## Neuro grouped-provider rule

Each promoted Neuro city must render two grouped example-provider sections:

1. ADHD evaluation providers
2. Autism evaluation providers

Each group must contain exactly three alphabetized provider names.

## Runtime support

`coverage_runtime_support.csv` must include promoted rows for TRT and Neuro.

`runtime_ready=true` is allowed only when:

- listing json exists
- all grouped provider files exist
- each group has exactly three provider names

## Validation

Required commands:

```bash
npm run build:all
LKG_VALIDATE_DIST=1 npm run validate:all
```

Validation must hard-fail if grouped provider files are missing, group counts are wrong, provider names are duplicated within a group, or city pages publish without grouped rendering.
