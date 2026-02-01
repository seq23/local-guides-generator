# 🔴 OWNER-ONLY — ACCESS CONTROL (MAC)

**Policy (locked):**
- VAs do NOT push code.
- VAs email requested changes to info@spryvc.com.
- Owner applies changes using the LKG Update Runbook.

## What is a PR?
A PR (“Pull Request”) is a GitHub workflow for proposing changes for review before merging.  
You are not using PRs in this system. Owner updates main directly after validation.

## GitHub access (recommended)
- Prefer: **no VA GitHub write access**
- If you must grant access to a technical VA:
  - grant read-only access
  - or grant write access only to a temporary branch repo (not main)
  - revoke after project ends

## Cloudflare access
- Add user as a member
- Use least privilege:
  - DNS edit only if needed
  - Workers edit only if needed
  - Pages view only for most VAs

## Owner workflow (canonical)
1) VA emails a patch ZIP or explicit change request.
2) Owner applies with LKG Update Runbook (snapshot/patch as appropriate).
3) Owner runs:
   - npm run validate:all
   - npm run qa:release
4) Owner tags and pushes.
