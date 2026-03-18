# Executable Bit Restore & Verification

## Purpose

Protect snapshot-mode updates from silent loss of executable permissions on shell helpers.

## Canonical files

The authoritative executable file list lives at:

```text
scripts/validation/executable_files_manifest.json
```

## Repair step

After snapshot apply and before validation, run:

```bash
bash scripts/repair_executable_bits.sh
```

This reapplies `chmod +x` to every path in the canonical manifest.

## Verification step

Run:

```bash
npm run validate:all
```

Expected pass line:

```text
EXECUTABLE BITS CONTRACT PASS
```

## Failure mode

If executable validation fails:
1. Run the repair script.
2. Re-run validation.
3. If still failing, inspect the manifest for stale/missing paths.
4. Update the manifest only when the canonical executable set truly changed.

## Why this exists

ZIP and rsync flows can normalize file modes. This contract prevents silent breakage in operator shell helpers.
