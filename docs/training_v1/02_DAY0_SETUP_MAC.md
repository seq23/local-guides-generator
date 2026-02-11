# 02 — DAY-0 SETUP (MAC)
**Status:** READ-ONLY (training_v1)  
**Audience:** All VAs  

---

## Goal
Get your laptop ready to **build + validate** the repo safely.

## 0) Open Terminal
macOS:
- Applications → Utilities → Terminal

## 1) Go to the repo
```bash
cd /Users/sequoiataylor/Documents/GitHub/local-guides-generator
```

## 2) Run the one-shot setup script
This installs the correct Node version, builds, validates, and installs the hardened updater.

```bash
bash docs/training_v1/TERMINAL_SETUP_ONE_SHOT.sh
```

### Success looks like
- `npm run build` succeeds
- `npm run validate:all` succeeds
- you see `DONE ✅`

If anything fails:
- stop
- copy the full terminal output
- escalate to Owner

---

## STEP 2.5 — INSTALL HARDENED UPDATER (NON-NEGOTIABLE)
This is the guardrail that prevents the “patch vs snapshot” confusion permanently.

**Rules enforced:**
- **snapshot mode** only allowed if ZIP matches baseline name pattern:
  `local-guides-generator-main_BASELINE_MM-DD-YY_<sha>.zip`
- **patch mode** is refused unless you explicitly set: `LKG_ALLOW_PATCH=1`

Install / replace the updater:

```bash
cp -v ~/update_lkg_from_zip.sh ~/update_lkg_from_zip.sh.bak.$(date +%Y%m%d_%H%M%S) 2>/dev/null || true
cat docs/runbooks/releases/update_lkg_from_zip_hardened.sh > ~/update_lkg_from_zip.sh
chmod +x ~/update_lkg_from_zip.sh
```

Verify:
```bash
ls -la ~/update_lkg_from_zip.sh
head -n 30 ~/update_lkg_from_zip.sh
```

---

## STEP 3 — MINT NEW BASELINE ZIP (NON-NEGOTIABLE)
**Rule:** All future snapshot updates must use the latest minted:
`local-guides-generator-main_BASELINE_MM-DD-YY_<sha>.zip`

After you have a clean build + validate, mint a new baseline ZIP:

```bash
cd /Users/sequoiataylor/Documents/GitHub/local-guides-generator
SHORT_SHA=$(git rev-parse --short HEAD)

cd /Users/sequoiataylor/Documents/GitHub
ZIP_NAME="local-guides-generator-main_BASELINE_$(date +%m-%d-%y)_${SHORT_SHA}.zip"

zip -r "$HOME/Downloads/$ZIP_NAME" local-guides-generator \
  -x "local-guides-generator/.git/*" \
  -x "local-guides-generator/node_modules/*" \
  -x "local-guides-generator/dist/*" \
  -x "local-guides-generator/releases/*"

echo "WROTE: $HOME/Downloads/$ZIP_NAME"
```

Verification gate:
```bash
cd /Users/sequoiataylor/Documents/GitHub/local-guides-generator
echo "Repo SHA:" && git rev-parse --short HEAD
echo "ZIP:" && ls -lh "$HOME/Downloads/$ZIP_NAME"
```

**END OF FILE**
