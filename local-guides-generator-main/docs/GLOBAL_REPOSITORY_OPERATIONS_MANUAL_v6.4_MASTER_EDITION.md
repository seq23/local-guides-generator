# **GLOBAL REPOSITORY OPERATIONS MANUAL**

## **v6.2 MASTER EDITION**

---

# **FRONT MATTER**

## **1\. Preface**

This document serves as the single authoritative operational standard for multi-repository AI development environments. It replaces all fragmented runbooks. By formalizing determinism, reversibility, and strict validation, this manual ensures that any operator—human or AI—can interact with the system safely and predictably. **Nothing operational exists only in memory; this document contains actual scripts, commands, and procedures.**

## **2\. Audience and Scope**

**Audience:** AI Assistants (LLMs), human software engineers, DevOps operators, and automated CI/CD pipelines.  
 **Authoritative Scope:** All repositories under the designated organization (e.g., `https://github.com/seq23`), including static sites, generator repositories, AI-content GEO repositories, infrastructure repositories, velocity content repositories, and automation pipelines.

## **3\. How to Use This Manual**

This manual is meant to be strictly executed. AI operators must read and adhere to the relevant sections before executing any operations. When a user issues the command *"Follow Universal Repo Protocol"*, the operator must immediately enter Diagnostic Mode (Section 39\) and halt all code execution until parameters are defined.

## **4\. Definitions and Terminology**

* **Repository:** A version-controlled project containing code, scripts, configuration, or generated artifacts.  
* **Snapshot:** A packaged representation of the full repository filesystem state. Replaces the full repo state.  
* **Patch:** A partial update containing only a subset of repository files. Applied without deleting existing files.  
* **Baseline:** A trusted snapshot representing a known-good repository state.  
* **Validator:** A command that verifies repository correctness before deployment.  
* **Artifact:** A build output representing repository state.

## **5\. Repository Operations Philosophy**

Repository operations must be:

* Deterministic  
* Reversible  
* Validated before commit  
* Auditable via commit \+ tag history

No repository change should occur without validator gates and rollback capability.

## **6\. Prime Directive**

You are working on a **live system** unless explicitly told otherwise.  
 Default operational behavior:  
 **modify in place → delete unnecessary → add only if unavoidable**  
 Never introduce parallel implementations, shadow systems, or architectural replacements without explicit approval. The assistant is a **maintainer by default**. It becomes a builder only when explicitly authorized.

## **7\. System Safety Principles**

* Never run destructive commands without validation and confirmation.  
* Never bypass CI checks or validator gates.  
* Always maintain a clean working tree before initiating a sync.  
* Every change must leave the system buildable, validated, and reproducible.

---

# **PART I — CORE GOVERNANCE**

## **8\. Repository Governance Model**

All repositories are governed as immutable artifacts where possible. Manual edits are restricted to patching and debugging; standard deployment is governed by snapshot replacement. Repositories must enforce strict Git hygiene, ensuring `main` always reflects a validated, working state.

## **9\. Operational Authority Hierarchy**

1. **Human Lead Operator:** Has ultimate override authority.  
2. **Automated CI/CD / Validators:** Have veto authority over any commit or deployment.  
3. **AI Operator / Assistant:** Operates strictly within requested modes and cannot override validators or human directives.

## **10\. Universal Repository Rules**

All changes must:

* Follow the Change Protocol (Part V).  
* Trigger safety tags before structural modifications.  
* Be isolated to a single concern.  
* Provide a rollback path.

## **11\. Anti-Duplication Rule**

If something exists: **EDIT IT**.  
 Never:

* Wrap it.  
* Duplicate it.  
* Replace it with a parallel system.  
* Create v2 beside v1.  
   Replacement requires explicit removal of the previous system.

## **12\. Complexity Control Doctrine**

Preferred characteristics: simpler logic, fewer files, fewer dependencies, readable code.  
 Avoid: unnecessary abstractions, premature optimization, clever solutions that reduce clarity. If a solution works in 10 lines, do not produce 100\.

## **13\. Dependency Governance Policy**

A dependency may only be added when:

* Required.  
* Justified.  
* Secure.  
* Smaller than writing a secure equivalent.  
   You must explain why it is needed, alternatives considered, and the impact on build size and security.

## **14\. Security Baseline Requirements**

Secrets must never exist in repositories. Use environment variables or secret managers. Dependencies must be audited regularly. Use least privilege repository permissions. Validate inputs everywhere.

## **15\. Data Integrity and Migration Policy**

For schema or storage changes:

* Never destroy data silently.  
* Include migration strategy.  
* Include rollback procedure.  
* Include backup step prior to execution.

---

# **PART II — REPOSITORY CLASSIFICATION**

## **16\. Repository Types**

Every repository in the ecosystem falls into one of the following canonical classifications. Operational procedures change based on the repo type.

## **17\. Static Site Repositories**

HTML, CSS, and static content websites. Deployed strictly via Snapshot mode. Do not contain application logic.

## **18\. Application Repositories**

Frontend or backend application code, or full-stack integrations (frontend, backend, and database logic). Managed via standard Git workflows and Patch Mode for active development.

## **19\. Infrastructure Repositories**

CI/CD pipelines, DevOps configurations, IaC (Infrastructure as Code). Highest risk tolerance. Modifying requires Architecture Mode approval.

## **20\. Generator Repositories**

Repositories that generate artifacts for other repositories (e.g., `local-guides-generator`). Contains templates, build scripts, and data sets.

## **21\. Artifact Repositories**

Repositories containing only generated output (Velocity Repos). Humans and AI operators must not edit files manually; they must be updated exclusively via Snapshot Mode from the respective Generator Repository.

## **22\. Multi-Repository Systems**

Large systems spanning multiple repos. Deployment order is strictly enforced: Generator → Artifact → Infrastructure.

---

# **PART III — OPERATIONAL MODES**

## **23\. Patch Mode**

Use for: text/content edits, minor styling, configuration edits.  
 Rules: modify only, no new systems, no new dependencies, minimal file changes, no structural changes.

## **24\. Refactor Mode**

Use for: simplifying logic, removing duplication, cleaning layout or code.  
 Rules: delete before adding, reduce complexity, same behavior must remain, codebase should end simpler.

## **25\. Feature Mode**

Use for: adding new capabilities.  
 Rules: isolate feature, do not modify unrelated areas, include documentation, include basic tests if applicable.

## **26\. Debug Mode**

Use for: fixing broken behavior.  
 Rules: identify root cause first, smallest possible fix, no redesign.

## **27\. Performance Mode**

Use for: optimization.  
 Rules: no functional changes, measurable improvement required, provide before/after expectation.

## **28\. Security Mode**

Use for: vulnerabilities, auth changes, permissions.  
 Rules: least privilege principle, do not expose secrets, validate inputs everywhere.

## **29\. Architecture Mode**

Use for: major structural change. High Risk.  
 Rules: propose plan only first, migration plan required, rollback plan required, no immediate implementation.

## **30\. Emergency Mode**

Use for: catastrophic failure, production outages, severe data corruption.  
 Rules: Stop all automated processes. Focus exclusively on diagnostic discovery and rollback execution. No new features or refactoring allowed.

---

# **PART IV — REPOSITORY LIFECYCLE**

## **31\. Repository Creation**

1. Create GitHub repo.  
2. Clone locally.  
3. Create baseline structure.  
4. Add root files.  
5. Initial commit.  
6. Push to `main`.  
7. Configure deployment.

## **32\. Baseline Initialization**

All new repositories must be initialized with a baseline snapshot to ensure deterministic starting states. Required root files include `.gitignore`, `README.md`, `package.json` (if applicable), `_headers`, and `_redirects`.

## **33\. Repository Structure Standards**

Root directories must be kept clean. Generator input (e.g., `templates/`, `data/`) must be strictly separated from generator output (e.g., `dist/`). Build outputs must be `.gitignore`'d in generator repos and explicitly included in artifact repos.

## **34\. Development Lifecycle**

Follows Universal Change Protocol (Part V). Development occurs in Patch, Feature, or Refactor modes.

## **35\. Maintenance Lifecycle**

Encompasses Dependency Governance, Security Mode patching, and Debug Mode operations. Handled via automated CI checks and minimal manual intervention.

## **36\. Release Lifecycle**

Handled via Snapshot Packaging. A Release involves running validators, building the artifact, packaging the ZIP, and dispatching to the target deployment or Artifact repository.

## **37\. Repository Archival**

When a repository is no longer actively maintained, it must be locked, tagged with an `ARCHIVED_YYYY_MM_DD` tag, and marked read-only in the access control layer.

---

# **PART V — UNIVERSAL REPO CHANGE PROTOCOL**

## **38\. Change Protocol Overview**

Every change must follow the sequence below. Skipping any step is forbidden.

1. Diagnose repository state  
2. Classify change  
3. Select operating mode  
4. Plan change  
5. Implement change  
6. Validate repository  
7. Commit changes  
8. Push changes

## **39\. Diagnostic Phase**

You may NOT write code, propose fixes, or suggest architecture until completing Diagnostic Mode.  
 Run: `git status`, `git branch --show-current`, `git log --oneline -10`.  
 Verify: working tree clean, correct branch, no unresolved merges.

## **40\. Change Classification**

Ask the operator:

1. What kind of change?  
2. Should the structure remain the same?  
3. Are we modifying existing behavior or adding new behavior?  
4. Is deletion allowed?  
5. Is backward compatibility required?

## **41\. Operating Mode Selection**

Declare the operating mode (Patch, Refactor, Feature, Debug, Performance, Security, Architecture) based on the classification and explain why. Await approval.

## **42\. Change Planning**

Before modifying files define:

1. Files affected  
2. Elements to REMOVE  
3. Elements to MODIFY  
4. Elements to ADD  
5. Risks introduced  
6. Rollback method  
7. Expected outcome

## **43\. Implementation Rules**

Modify repository files ensuring minimal edits, no duplication, and no hidden architecture change.

## **44\. Validation Rules**

Run repository validators (e.g., `npm run validate:all`). Validator failure stops deployment. If validation fails, stop immediately and fix issues.

## **45\. Commit Standards**

Stage repository changes (`git add -A`). Commit message must describe:

* Change type  
* Affected system  
* Reason for change  
   Example: `fix: validator coverage mismatch in PI generator`

## **46\. Push and Deployment Rules**

Pull with rebase to prevent non-fast-forward errors: `git pull --rebase origin main`.  
 Push repository to remote: `git push origin main`. Verify push completed successfully.

## **47\. Post-Change Verification**

Ensure CI pipelines passed. Ensure tags are created (`repo_post_update_TIMESTAMP`). System must remain buildable, validated, and reproducible.

---

# **PART VI — TERMINAL MODE OPERATIONS**

## **48\. Terminal Mode Overview**

Terminal Mode is the controlled procedure used when guiding operators through repository changes using a command line interface. It exists to prevent accidental destructive commands, command chaining errors, skipped validation steps, and hidden command failures.

## **49\. Terminal Mode Safety Rules**

1. Only **one command may be executed at a time**.  
2. The operator must **run the command exactly as written and paste the output** before the next command.  
3. Commands must **never be abbreviated or inferred**.  
4. Never skip inspection commands.

## **50\. Command Execution Discipline**

Step 1: Operator receives command.  
 Step 2: Operator runs command.  
 Step 3: Operator reports output.  
 Step 4: Next command is issued.  
 The next step must **never be issued before verifying the previous output**.

## **51\. Command Logging Requirements**

Operators must record: Command executed, Timestamp, Output result.

## **52\. Operator Verification Protocol**

The AI or leading operator must explicitly state whether the provided output matches expectations before issuing the next instruction. No hidden assumptions.

## **53\. Forbidden Terminal Behaviors**

* Command chaining (e.g., `npm install && npm run build`).  
* Implicit assumptions about filesystem state.  
* Skipping validation commands.  
* Running destructive commands without confirmation.

---

# **PART VII — SNAPSHOT ARCHITECTURE**

## **54\. Snapshot Deployment Model**

Snapshot architecture treats repository state as an artifact. Instead of manually editing files, the entire site state is produced externally and applied as a snapshot. Snapshot updates are atomic repository state replacements.

## **55\. Artifact-First Repository Philosophy**

Velocity repos are artifact-first repositories. The entire site state is produced externally. This ensures deterministic deployments, zero manual merge conflicts, and highly reproducible builds.

## **56\. Snapshot vs Patch Strategy**

* **Snapshot Mode (Default):** Entire repository replaced using artifact snapshot. Safe for `rsync --delete`. ZIP must contain true repo root. Default delivery format is full baseline snapshot ZIP only.  
* **Patch Mode (Restricted):** Partial update applied without deleting files. **Patch ZIPs must never be the default.** Patch mode is exceptional and should only be used if explicitly requested. If patch mode is supported in tooling, it requires an explicit gate such as `LKG_ALLOW_PATCH=1`.

## **57\. Deterministic Deployment Model**

Workflow:  
 `BUILD ARTIFACT` → `ZIP SNAPSHOT` → `LOCAL APPLY SCRIPT` → `GIT COMMIT` → `GITHUB PUSH`

## **58\. Snapshot Safety Procedures**

Snapshot mode assumes: Repository after update \= exact snapshot contents. If a file exists locally but is NOT in the snapshot ZIP, snapshot mode will delete it. Therefore, the ZIP must be a true full snapshot.

Canonical snapshot-mode full safety sequence:

1. Inspect ZIP manifest  
2. Extract ZIP  
3. Detect true root  
4. Verify required root files  
5. Run rsync dry-run  
6. Create pre-update safety tag  
7. Apply rsync (`rsync --delete`)  
8. Repair executable bits if needed (e.g., `find scripts -type f -name "*.sh" -exec chmod +x {} \;`)  
9. Reinstall dependencies if needed  
10. Run validators (`npm run validate:all`)  
11. Commit  
12. Push  
13. Create post-update tag

## **59\. Snapshot Logging Standards**

The update scripts must log outputs to a safe temporary directory, including:

* ZIP manifest top  
* ZIP top-level entries  
* rsync dry-run report  
* rsync applied log  
* `git diff --stat` and full patch  
* Validation and NPM logs

## **60\. Snapshot Failure Detection**

If a snapshot applies but validators fail, the workflow must hard-stop. Do not push a repo as updated if validation fails. The operator must review the broken link report or validation error, correct the generator, regenerate the snapshot, and retry, OR rollback using the pre-sync tag.

---

# **PART VIII — ZIP ARTIFACT PACKAGING SYSTEM**

## **61\. Snapshot Artifact Definition**

A Snapshot Artifact is a ZIP file containing the total, exact intended filesystem state for the target repository. It must be a full repository snapshot, built from the true repo root, named using canonical naming, and safe for `rsync --delete`.

## **62\. Baseline ZIP Naming Convention**

All full baseline snapshot ZIPs must use this exact naming pattern:  
 `<repo>-main_BASELINE_MM-DD-YY_<sha>.zip`

* `<repo>`: repository name (lowercase, hyphenated, matching the actual repo slug)  
* `main`: indicates the branch used (baseline ZIPs should be created from `main`)  
* `BASELINE`: indicates this is a full snapshot baseline (not a patch, not partial)  
* `MM-DD-YY`: date of creation  
* `<sha>`: short git commit SHA associated with the repo state.

**Example command to get the short SHA:**

bashCopy code  
git rev-parse \--short HEAD

*Example output:* `f9c8e21`  
 *Example valid filename:* `local-guides-generator-main_BASELINE_03-12-26_f9c8e21.zip`  
 *Example valid filename:* `sprylabs-hpc-site-main_BASELINE_03-12-26_f9c8e21.zip`

**Forbidden suffixes / naming variants:**  
 Do NOT add random suffixes to baseline ZIPs.  
 Forbidden examples: `_PATCH`, `_ROOTFIX`, `_UPDATED`, `_FINAL`, `_FIXED`.  
 Bad example: `sprylabs-hpc-site-main_BASELINE_03-12-26_f9c8e21_ROOTFIX.zip`

## **63\. Required Root Files**

The ZIP must be created from the true repository root. That means when extracted, the archive should contain the real repo root files and directories.

**Minimum expected root files:**  
 `.gitignore`  
 `README.md`  
 `package.json`

**Strongly expected when applicable:**  
 `package-lock.json`  
 `_headers`  
 `_redirects`

**The .gitignore Rule:**  
 `.gitignore` must exist at the repo root for snapshot-compatible baseline ZIPs. It is used as a proxy signal that the archive is actually a repo root snapshot. If missing from the root of the ZIP, snapshot mode should treat the ZIP as suspicious and reject it. Missing root files mean the archive was built from the wrong folder, which causes accidental deletions during `rsync --delete`.

## **64\. Packaging Process**

Run from the true repo root. Directories that should usually be excluded because they are not source-of-truth repo state (they bloat the archive and cause inconsistent behavior) are: `.git/`, `node_modules/`, `dist/`, `coverage/`, `tmp/`, `.DS_Store`.

**Canonical baseline ZIP creation command:**

bashCopy code  
zip \-r \<repo\>\-main\_BASELINE\_MM-DD-YY\_\<sha\>.zip . \\  
  \-x ".git/\*" "node\_modules/\*" "dist/\*" "coverage/\*" "tmp/\*" ".DS\_Store"

## **65\. Packaging Validation**

GitHub and other ZIP systems often wrap contents inside a top-level folder. This is normal. The safe snapshot updater must inspect the ZIP manifest, extract the ZIP, detect whether there is a wrapper folder, and descend into the true repo root inside it. It must confirm required root files exist, and refuse to run if they are missing.

## **66\. Snapshot Distribution**

Snapshots are downloaded directly to the operator's machine (e.g., `~/Downloads`) and passed as the primary argument to the authorized update scripts.

---

# **PART IX — SCRIPT LIBRARY**

## **67\. Script Library Overview**

This library contains the canonical bash scripts required to safely package, diagnose, repair, and deploy repositories under the Universal Protocol. All operational docs must use actual scripts, not summaries.

## **68\. Snapshot Update Script (Generic)**

bashCopy code  
**\#\!/usr/bin/env bash**  
\# \============================================================  
\# SNAPSHOT UPDATE SCRIPT (GENERIC REPOSITORY) v2  
\# \============================================================  
set \-euo pipefail

ZIP\_PATH\="$1"  
REPO\_PATH\="$2"  
MODE\="${3:-snapshot}"  
VALIDATE\_CMD\="${4:-npm run validate:all}"

bold() { echo \-e "\\n\=== $\* \==="; }  
note() { echo "• $\*"; }  
fail() { echo "ERROR: $\*" \>**&2**; exit 1; }

TMP\_DIR\="$(mktemp \-d \~/tmp/repo\_zip\_update\_XXXX)"

bold "GENERIC REPO ZIP UPDATER v2"  
note "ZIP : $ZIP\_PATH"  
note "REPO: $REPO\_PATH"  
note "MODE: $MODE"\[ \-f "$ZIP\_PATH" \] || fail "ZIP not found"  
\[ \-d "$REPO\_PATH/.git" \] || fail "Not a git repo"

unzip \-q "$ZIP\_PATH" \-d "$TMP\_DIR/unzipped"

\# Detect true wrapper root  
ROOT\="$(find "$TMP\_DIR/unzipped" \-maxdepth 2 \-type d | head \-n1)"

bold "Snapshot safety checks"  
\[ \-f "$ROOT/.gitignore" \] || fail "Snapshot ZIP missing .gitignore"

bold "Dry run"  
rsync \-av \--delete \--dry-run "$ROOT/" "$REPO\_PATH/" | tee "$TMP\_DIR/rsync\_dry\_run.txt"

PRETAG\="repo\_pre\_update\_$(date \+%Y%m%d\_%H%M%S)"  
bold "Creating safety tag $PRETAG"  
git \-C "$REPO\_PATH" tag "$PRETAG"

bold "Applying snapshot"  
rsync \-av \--delete "$ROOT/" "$REPO\_PATH/" | tee "$TMP\_DIR/rsync\_apply.txt"

bold "Re-applying executable bits"  
find "$REPO\_PATH/scripts" \-type f \-name "\*.sh" \-exec chmod \+x {} \\;

if\[ \-n "$VALIDATE\_CMD" \]; then  
  bold "Running validation"  
  cd "$REPO\_PATH"  
  eval "$VALIDATE\_CMD"  
fi

POSTTAG\="repo\_post\_update\_$(date \+%Y%m%d\_%H%M%S)"  
bold "Creating post tag $POSTTAG"  
git \-C "$REPO\_PATH" tag "$POSTTAG"

bold "Done"

## **69\. Snapshot Update Script (LKG)**

bashCopy code  
cat \> \~/update\_lkg\_from\_zip\_v3.sh \<\<'BASH'  
\#\!/usr/bin/env bash  
\# \============================================================  
\# SNAPSHOT UPDATE SCRIPT (LKG REPOSITORY) v3  
\# \============================================================  
set \-euo pipefail

bold() { printf "\\033\[1m%s\\033\[0m\\n" "$\*"; }  
note() { printf "%s\\n" "$\*"; }

ZIP\_PATH="${1:-}"  
REPO\_PATH="${2:-}"  
MODE="${3:-}"

\# Support heredoc input:  
\# line1: zip path  
\# line2: repo path  
\# line3: mode (snapshot|patch)\[optional; defaults to snapshot\]  
if \[\[ \-z "${ZIP\_PATH}" || \-z "${REPO\_PATH}" \]\]; then  
  read \-r ZIP\_PATH || true  
  read \-r REPO\_PATH || true  
  read \-r MODE || true  
fi

MODE="${MODE:-snapshot}"

\# Expand \~  
ZIP\_PATH="${ZIP\_PATH/\#\\\~/$HOME}"  
REPO\_PATH="${REPO\_PATH/\#\\\~/$HOME}"

echo  
bold "=== LKG UNZIP \+ UPDATE (v3) \==="  
echo  
bold "Modes:"  
echo "  snapshot (default): repo := ZIP exactly (rsync \--delete)\[DESTRUCTIVE if ZIP is not a full snapshot\]"  
echo "  patch:              apply ZIP changes without deleting missing files (rsync without \--delete)"  
echo  
echo "ZIP : $ZIP\_PATH"  
echo "REPO: $REPO\_PATH"  
echo "MODE: $MODE"  
echo

if \[\[ \! \-f "$ZIP\_PATH" \]\]; then  
  echo "ERROR: ZIP not found: $ZIP\_PATH" \>&2  
  exit 1  
fi

if \[\[ \! \-d "$REPO\_PATH" \]\]; then  
  echo "ERROR: Repo path not found: $REPO\_PATH" \>&2  
  exit 1  
fi

if \[\[ "$MODE" \!= "snapshot" && "$MODE" \!= "patch" \]\]; then  
  echo "ERROR: MODE must be 'snapshot' or 'patch' (got: $MODE)" \>&2  
  exit 1  
fi

TS="$(date '+%Y-%m-%d\_%H%M%S')"  
TMP\_DIR="$HOME/tmp/lkg\_patch\_${TS}"  
mkdir \-p "$TMP\_DIR"

\# \-------------------------------------------------------------------  
\# 0\) Repo preflight: must be clean unless overridden  
\# Override by setting env var: LKG\_ALLOW\_DIRTY=1  
\# \-------------------------------------------------------------------  
bold "-\> Repo preflight (clean working tree check)"  
ALLOW\_DIRTY="${LKG\_ALLOW\_DIRTY:-0}"  
(  
  cd "$REPO\_PATH"  
  BRANCH="$(git rev-parse \--abbrev-ref HEAD)"  
  HEADSHA="$(git rev-parse HEAD)"  
  REMOTEURL="$(git remote get-url origin 2\>/dev/null || true)"  
  STATUS\_PORC="$(git status \--porcelain)"

  echo "branch=$BRANCH" | tee "$TMP\_DIR/repo\_branch.txt" \>/dev/null  
  echo "head=$HEADSHA"  | tee "$TMP\_DIR/repo\_head.txt" \>/dev/null  
  echo "origin=$REMOTEURL" | tee "$TMP\_DIR/repo\_origin.txt" \>/dev/null

  \# Save full status and porcelain for forensics  
  git status \> "$TMP\_DIR/git\_status\_full.txt"  
  printf "%s\\n" "$STATUS\_PORC" \> "$TMP\_DIR/git\_status\_porcelain.txt"

  if \[\[ "$BRANCH" \!= "main" \]\]; then  
    echo "WARNING: You are on branch '$BRANCH' (expected: main)."  
    echo "Saved: $TMP\_DIR/repo\_branch.txt"  
  fi

  if \[\[ \-n "$STATUS\_PORC" && "$ALLOW\_DIRTY" \!= "1" \]\]; then  
    echo  
    echo "ERROR: Repo has uncommitted changes (dirty working tree)."  
    echo "Refusing to proceed because syncing could mix changes and create chaos."  
    echo  
    echo "Fix options:"  
    echo "  A) Commit or stash your changes, then re-run."  
    echo "  B) If you intentionally want to proceed anyway:"  
    echo "     LKG\_ALLOW\_DIRTY=1 \~/update\_lkg\_from\_zip\_v3.sh \<\<'EOF'"  
    echo "     $ZIP\_PATH"  
    echo "     $REPO\_PATH"  
    echo "     $MODE"  
    echo "     EOF"  
    echo  
    echo "Diagnostics saved:"  
    echo "  \- $TMP\_DIR/git\_status\_full.txt"  
    echo "  \- $TMP\_DIR/git\_status\_porcelain.txt"  
    exit 10  
  fi  
)

\# \-------------------------------------------------------------------  
\# 1\) ZIP manifest \+ smell checks  
\# \-------------------------------------------------------------------  
bold "-\> ZIP manifest (top portion)"  
MANIFEST\_TOP="$TMP\_DIR/zip\_manifest\_top.txt"  
unzip \-l "$ZIP\_PATH" | sed \-n '1,250p' | tee "$MANIFEST\_TOP" \>/dev/null

bold "-\> ZIP top-level folder smell check (single wrapper folder warning)"  
ZIP\_TOPLEVEL="$TMP\_DIR/zip\_toplevel\_entries.txt"  
unzip \-l "$ZIP\_PATH" | awk '  
  BEGIN { inlist=0 }  
  /^\[ \]\*Length\[ \]+Date\[ \]+Time\[ \]+Name\[ \]\*$/ { inlist=1; next }  
  inlist==1 && /^\[ \]\*\[0-9\]+/ {  
    name=$NF  
    sub(/\\/.\*/, "", name)  
    if (name \!= "") print name  
  }  
' | sort | uniq \> "$ZIP\_TOPLEVEL"

TOPCOUNT="$(wc \-l \< "$ZIP\_TOPLEVEL" | tr \-d ' ')"  
if \[\[ "$TOPCOUNT" \-eq 1 \]\]; then  
  ONLY="$(cat "$ZIP\_TOPLEVEL")"  
  echo "WARNING: ZIP appears to contain a single top-level folder: $ONLY"  
  echo "  \- This can be normal (GitHub Download ZIP wrapper folder)."  
  echo "  \- It can also be a partial ZIP smell depending on contents."  
else  
  echo "OK: ZIP has $TOPCOUNT top-level entries."  
fi  
echo "Saved: $ZIP\_TOPLEVEL"  
echo "Saved: $MANIFEST\_TOP"  
echo

bold "-\> Unzipping to $TMP\_DIR"  
unzip \-q "$ZIP\_PATH" \-d "$TMP\_DIR"

\# Many ZIPs contain a single wrapper folder; detect "real root"  
detect\_root() {  
  local dir="$1"  
  local dcount fcount  
  dcount="$(find "$dir" \-mindepth 1 \-maxdepth 1 \-type d | wc \-l | tr \-d ' ')"  
  fcount="$(find "$dir" \-mindepth 1 \-maxdepth 1 \-type f | wc \-l | tr \-d ' ')"  
  if \[\[ "$dcount" \-eq 1 && "$fcount" \-eq 0 \]\]; then  
    find "$dir" \-mindepth 1 \-maxdepth 1 \-type d | head \-n 1  
  else  
    echo "$dir"  
  fi  
}

SRC\_ROOT="$(detect\_root "$TMP\_DIR")"  
bold "-\> ZIP root detected as: $SRC\_ROOT"

\# \-------------------------------------------------------------------  
\# 2\) Snapshot safety check: refuse snapshot if key roots missing  
\# \-------------------------------------------------------------------  
if \[\[ "$MODE" \== "snapshot" \]\]; then  
  bold "Preflight: verifying ZIP looks like a full repo snapshot..."  
  missing=()  
  for f in ".gitignore" "package.json" "package-lock.json" "README.md"; do  
    if \[\[ \! \-e "$SRC\_ROOT/$f" \]\]; then  
      missing+=("$f")  
    fi  
  done

  if \[\[ "${\#missing\[@\]}" \-gt 0 \]\]; then  
    echo  
    echo "Refusing snapshot mode because ZIP is missing key root files:"  
    for m in "${missing\[@\]}"; do  
      echo "  \- $m"  
    done  
    echo  
    echo "Use PATCH mode instead to avoid deletions:"  
    echo "  \~/update\_lkg\_from\_zip\_v3.sh \\"$ZIP\_PATH\\" \\"$REPO\_PATH\\" patch"  
    echo  
    exit 2  
  fi  
  bold "OK: ZIP looks like a full snapshot."  
fi

\# \-------------------------------------------------------------------  
\# 3\) Preflight visibility: rsync dry-run report  
\# \-------------------------------------------------------------------  
DRYRUN\_REPORT="$TMP\_DIR/rsync\_dryrun\_report.txt"  
bold "-\> Preflight rsync dry-run report: $DRYRUN\_REPORT"  
if \[\[ "$MODE" \== "snapshot" \]\]; then  
  rsync \-avun \--delete \\  
    \--exclude ".git" \\  
    \--exclude "node\_modules" \\  
    \--exclude "dist" \\  
    \--exclude "dist/" \\  
    \--exclude "dist/\_lkg\_snapshot.json" \\  
    "$SRC\_ROOT/" "$REPO\_PATH/" \> "$DRYRUN\_REPORT"  
else  
  rsync \-avun \\  
    \--exclude ".git" \\  
    \--exclude "node\_modules" \\  
    \--exclude "dist" \\  
    \--exclude "dist/" \\  
    \--exclude "dist/\_lkg\_snapshot.json" \\  
    "$SRC\_ROOT/" "$REPO\_PATH/" \> "$DRYRUN\_REPORT"  
fi

\# \-------------------------------------------------------------------  
\# 4\) Safety tag BEFORE sync (rollback anchor)  
\# \-------------------------------------------------------------------  
bold "-\> Safety tag (pre-sync) for rollback"  
(  
  cd "$REPO\_PATH"  
  PRETAG="lkg-pre-${TS}"  
  git tag "$PRETAG" || true  
  echo "$PRETAG" \> "$TMP\_DIR/pre\_sync\_tag.txt"  
  echo "Created (local): $PRETAG"  
  echo "Saved: $TMP\_DIR/pre\_sync\_tag.txt"  
)

\# \-------------------------------------------------------------------  
\# 5\) Rsync applied \+ capture applied log  
\# \-------------------------------------------------------------------  
APPLIED\_RSYNC\_LOG="$TMP\_DIR/rsync\_applied\_log.txt"  
bold "-\> Rsync into repo (applied). Log: $APPLIED\_RSYNC\_LOG"

if \[\[ "$MODE" \== "snapshot" \]\]; then  
  rsync \-avu \--delete \\  
    \--exclude ".git" \\  
    \--exclude "node\_modules" \\  
    \--exclude "dist" \\  
    \--exclude "dist/" \\  
    \--exclude "dist/\_lkg\_snapshot.json" \\  
    "$SRC\_ROOT/" "$REPO\_PATH/" | tee "$APPLIED\_RSYNC\_LOG" \>/dev/null  
else  
  rsync \-avu \\  
    \--exclude ".git" \\  
    \--exclude "node\_modules" \\  
    \--exclude "dist" \\  
    \--exclude "dist/" \\  
    \--exclude "dist/\_lkg\_snapshot.json" \\  
    "$SRC\_ROOT/" "$REPO\_PATH/" | tee "$APPLIED\_RSYNC\_LOG" \>/dev/null  
fi

\# \-------------------------------------------------------------------  
\# 6\) Save git diff reports (post-rsync, pre-commit)  
\# \-------------------------------------------------------------------  
bold "-\> Saving git diff \--stat (post-rsync, pre-commit)"  
DIFFSTAT\_REPORT="$TMP\_DIR/git\_diff\_stat.txt"  
(cd "$REPO\_PATH" && git diff \--stat) | tee "$DIFFSTAT\_REPORT" \>/dev/null  
echo "Saved: $DIFFSTAT\_REPORT"

bold "-\> Saving FULL git diff (post-rsync, pre-commit)"  
DIFF\_REPORT="$TMP\_DIR/git\_diff\_full.patch"  
(cd "$REPO\_PATH" && git diff) \> "$DIFF\_REPORT"  
echo "Saved: $DIFF\_REPORT"  
echo

\# \-------------------------------------------------------------------  
\# 7\) Dependency install \+ validation (logs saved)  
\# \-------------------------------------------------------------------  
bold "-\> npm ci (log saved)"  
NPM\_CI\_LOG="$TMP\_DIR/npm\_ci.log"  
( cd "$REPO\_PATH" && npm ci ) 2\>&1 | tee "$NPM\_CI\_LOG" \>/dev/null

bold "-\> npm run validate:all (log saved)"  
VALIDATE\_LOG="$TMP\_DIR/npm\_validate\_all.log"  
set \+e  
( cd "$REPO\_PATH" && npm run validate:all ) 2\>&1 | tee "$VALIDATE\_LOG" \>/dev/null  
VALIDATE\_EXIT="${PIPESTATUS\[0\]:-1}"  
set \-e

\# If broken link report exists, copy into TMP\_DIR for VA debugging  
if \[\[ \-f "$REPO\_PATH/dist/\_broken\_links.csv" \]\]; then  
  cp "$REPO\_PATH/dist/\_broken\_links.csv" "$TMP\_DIR/\_broken\_links.csv" || true  
  echo "NOTE: Copied dist/\_broken\_links.csv \-\> $TMP\_DIR/\_broken\_links.csv"  
fi

if \[\[ "$VALIDATE\_EXIT" \-ne 0 \]\]; then  
  echo  
  echo "FAILED: validate:all"  
  echo "Logs saved:"  
  echo "  \- $NPM\_CI\_LOG"  
  echo "  \- $VALIDATE\_LOG"  
  echo  
  echo "Forensics saved:"  
  echo "  \- $DRYRUN\_REPORT"  
  echo "  \- $APPLIED\_RSYNC\_LOG"  
  echo "  \- $DIFFSTAT\_REPORT"  
  echo "  \- $DIFF\_REPORT"  
  echo "  \- $MANIFEST\_TOP"  
  echo "  \- $ZIP\_TOPLEVEL"  
  echo  
  echo "If there is a broken links report:"  
  echo "  \- $TMP\_DIR/\_broken\_links.csv"  
  echo  
  exit "$VALIDATE\_EXIT"  
fi

\# \-------------------------------------------------------------------  
\# 8\) Commit \+ pull \--rebase \+ push \+ tag \+ push tag  
\# \-------------------------------------------------------------------  
bold "-\> git status"  
(cd "$REPO\_PATH" && git status)

bold "-\> git add \-A"  
(cd "$REPO\_PATH" && git add \-A)

COMMIT\_MSG="LKG update: ${MODE} sync ${TS}"  
bold "-\> git commit \-m \\"$COMMIT\_MSG\\""  
(cd "$REPO\_PATH" && git commit \-m "$COMMIT\_MSG" || true)

bold "-\> Pull \--rebase (avoid non-fast-forward) \+ push"  
(cd "$REPO\_PATH" && git pull \--rebase origin main)  
(cd "$REPO\_PATH" && git push origin main)

TAG="lkg-${TS}"  
bold "-\> Tag \+ push tag: $TAG"  
(cd "$REPO\_PATH" && git tag "$TAG")  
(cd "$REPO\_PATH" && git push origin "$TAG")

\# Optional: push pre-sync tag too (helps rollback from remote, not just local)  
bold "-\> Push pre-sync tag (rollback anchor) to origin"  
(  
  cd "$REPO\_PATH"  
  PRETAG="$(cat "$TMP\_DIR/pre\_sync\_tag.txt")"  
  git push origin "$PRETAG" || true  
)

echo  
bold "DONE ✅  $TS"  
echo "Mode: $MODE"  
echo "Tag:  $TAG"  
echo "Temp folder: $TMP\_DIR"  
echo "Saved artifacts:"  
echo "  \- ZIP manifest top:      $MANIFEST\_TOP"  
echo "  \- ZIP top-level entries: $ZIP\_TOPLEVEL"  
echo "  \- rsync dry-run report:  $DRYRUN\_REPORT"  
echo "  \- rsync applied log:     $APPLIED\_RSYNC\_LOG"  
echo "  \- git status (full):     $TMP\_DIR/git\_status\_full.txt"  
echo "  \- git status porcelain:  $TMP\_DIR/git\_status\_porcelain.txt"  
echo "  \- git diff \--stat:       $DIFFSTAT\_REPORT"  
echo "  \- git diff full:         $DIFF\_REPORT"  
echo "  \- npm ci log:            $NPM\_CI\_LOG"  
echo "  \- validate log:          $VALIDATE\_LOG"  
echo "  \- pre-sync tag:          $(cat "$TMP\_DIR/pre\_sync\_tag.txt")"  
echo  
BASH

chmod \+x \~/update\_lkg\_from\_zip\_v3.sh  
echo "Installed: \~/update\_lkg\_from\_zip\_v3.sh"

## **70\. Validation Runner Script**

bashCopy code  
**\#\!/usr/bin/env bash**  
\# \============================================================  
\# REPOSITORY VALIDATION RUNNER  
\# \============================================================  
set \-e

echo "Installing dependencies..."  
npm ci

echo "Running repository validators..."  
npm run validate:all

echo "Validation completed successfully."

## **71\. Snapshot Packaging Script**

bashCopy code  
**\#\!/usr/bin/env bash**  
\# \============================================================  
\# SNAPSHOT PACKAGING SCRIPT  
\# \============================================================  
set \-e

REPO\_PATH\="$1"  
REPO\_NAME\="$2"

if\[ \-z "$REPO\_PATH" \] ||\[ \-z "$REPO\_NAME" \]; then  
  echo "Usage: package\_snapshot.sh REPO\_PATH REPO\_NAME"  
  exit 1  
fi

cd "$REPO\_PATH"

SHA\=$(git rev-parse \--short HEAD)  
DATE\=$(date \+%m-%d-%y)

ZIP\_NAME\="${REPO\_NAME}\-main\_BASELINE\_${DATE}\_${SHA}.zip"

echo "Packaging snapshot $ZIP\_NAME"

zip \-r "$ZIP\_NAME" . \\  
  \-x ".git/\*" \\  
     "node\_modules/\*" \\  
     "dist/\*" \\  
     "coverage/\*" \\  
     "tmp/\*" \\  
     ".DS\_Store"

echo "Snapshot created: $ZIP\_NAME"

## **72\. CI Validation Script**

bashCopy code  
**\#\!/usr/bin/env bash**  
\# \============================================================  
\# CI VALIDATION SCRIPT  
\# \============================================================  
set \-e  
echo "Starting CI validation..."  
npm ci  
npm run validate:all  
echo "CI validation completed successfully."

## **73\. Repository Diagnostic Script**

bashCopy code  
**\#\!/usr/bin/env bash**  
\# \============================================================  
\# REPOSITORY DIAGNOSTIC SCRIPT  
\# \============================================================  
set \-e  
echo "Repository diagnostics"  
echo "Current branch:"  
git branch \--show-current  
echo "Status:"  
git status  
echo "Recent commits:"  
git log \--oneline \-10  
echo "Uncommitted changes:"  
git diff \--stat

## **74\. Dependency Repair Script**

bashCopy code  
**\#\!/usr/bin/env bash**  
\# \============================================================  
\# DEPENDENCY REPAIR SCRIPT  
\# \============================================================  
set \-e  
echo "Repairing dependencies..."  
rm \-rf node\_modules  
rm \-f package-lock.json  
npm install  
echo "Running validators..."  
npm run validate:all  
echo "Dependencies repaired."

## **75\. Snapshot Rollback Script**

bashCopy code  
**\#\!/usr/bin/env bash**  
\# \============================================================  
\# SNAPSHOT ROLLBACK SCRIPT  
\# \============================================================  
set \-e  
TAG\="$1"  
if \[ \-z "$TAG" \]; then  
  echo "Usage: rollback\_snapshot.sh TAG\_NAME"  
  exit 1  
fi  
echo "Rolling back to tag $TAG"  
git reset \--hard "$TAG"  
git push \--force origin main  
echo "Rollback completed."

## **76\. Repository Clean State Script**

bashCopy code  
**\#\!/usr/bin/env bash**  
\# \============================================================  
\# REPOSITORY CLEAN STATE SCRIPT  
\# \============================================================  
set \-e  
echo "Resetting repository to clean state..."  
git restore .  
git clean \-fd  
echo "Repository cleaned."

## **77\. Broken Link Validator Script**

bashCopy code  
**\#\!/usr/bin/env bash**  
\# \============================================================  
\# BROKEN LINK VALIDATION SCRIPT  
\# \============================================================  
set \-e  
echo "Running broken link detection..."  
if\[ \! \-f dist/\_broken\_links.csv \]; then  
  echo "Broken links report not found."  
  exit 1  
fi  
LINES\=$(wc \-l \< dist/\_broken\_links.csv)  
if\[ "$LINES" \-gt 1 \]; then  
  echo "Broken links detected:"  
  cat dist/\_broken\_links.csv  
  exit 1  
fi  
echo "No broken links found."

---

# **PART X — VALIDATION SYSTEMS**

## **78\. Validator Philosophy**

Validators are the definitive gatekeepers of state. A repository is considered broken unless all validators pass. Validators must be deterministic and executed on every deployment and PR.

## **79\. Validation Categories**

Validators fall into four categories: Schema, Link, Coverage, and Build Integrity. All must execute successfully via `npm run validate:all`.

## **80\. Schema Validation**

Ensures all JSON/YAML data files conform to expected strict structural schemas. Rejects missing keys, unapproved types, and unauthorized properties.

## **81\. Link Validation**

Verifies internal routing. A link must land somewhere valid in the `dist/` folder or the build must fail. Outputs a VA-friendly `_broken_links.csv`.

## **82\. Coverage Validation**

Ensures output parity with authoritative lists (e.g., authoritative research CSV entries must have correlating runtime pages generated). Mismatches fail the build.

## **83\. Build Integrity Validation**

Ensures that artifacts compile properly, required assets exist, and static generation completes without swallowed errors.

## **84\. Validator Failure Handling**

If validation fails:

1. Stop immediately.  
2. Inspect failure logs.  
3. If broken links exist, consult `dist/_broken_links.csv`.  
4. Fix issue and rerun `npm run validate:all`.  
5. If unfixable, rollback via pre-sync tag. Never bypass validators.

---

# **PART XI — FAILURE RECOVERY**

## **85\. Repository Diagnostics**

Run the panic diagnostic block to safely discover broken states:

bashCopy code  
git status  
git diff  
git log \--oneline \-10  
git branch \--show-current

## **86\. Dirty Repository Recovery**

If a script refuses to run due to a dirty working tree:

bashCopy code  
git add \-A && git commit \-m "WIP: save before sync"  
\# OR  
git stash \-u

## **87\. Snapshot Rollback Procedure**

If snapshot caused corruption or validators persistently fail:

bashCopy code  
git reset \--hard PREVIOUS\_TAG  \# e.g., lkg-pre-TIMESTAMP  
git push \--force origin main

*(Use force push cautiously and only when intentionally reverting remote state)*

## **88\. Dependency Repair Procedures**

If `node_modules` is corrupted or out of sync:

bashCopy code  
rm \-rf node\_modules dist  
npm ci  
npm run validate:all

## **89\. Rebase Failure Recovery**

If a remote is ahead and `git pull --rebase origin main` throws conflicts:

bashCopy code  
git rebase \--abort || true

Then resync local state, or fix conflicts, `git add -A`, and `git rebase --continue`.

## **90\. CI Failure Recovery**

If a commit passes locally but fails in CI, verify node/python environment parity, ensure no `.gitignore`'d files were locally depended upon, and run the CI Validation Script locally.

---

# **PART XII — MULTI-REPO GOVERNANCE**

## **91\. Multi-Repository Architecture**

Large systems decouple logic into:

* **Generator Repository:** Produces artifacts.  
* **Artifact Repository:** Stores generated outputs.  
* **Infrastructure Repository:** Controls deployment.

## **92\. Repository Dependency Graphs**

Changes in Generators propagate to Artifacts, which trigger Infrastructure deployments. Operators must never skip directly to editing Artifact repos if the source truth lives in the Generator.

## **93\. Cross-Repository Standards**

All repos follow identical operational rules (Universal Change Protocol). Terminal Mode is enforced identically across boundaries.

## **94\. Artifact Flow Architecture**

textCopy code

## **95\. Deployment Sequencing**

Order must be strictly respected:

1. Update Generator logic.  
2. Validate and Package Generator.  
3. Sync ZIP to Artifact Repository.  
4. Push Artifact Repository to trigger Infrastructure deployment.

---

# **PART XIII — CI/CD GOVERNANCE**

## **96\. Continuous Integration Requirements**

All production repositories must utilize CI to block bad code from entering main. Direct pushes to production branches bypassing CI are prohibited unless in Emergency Mode.

## **97\. Pipeline Architecture**

Required pipeline stages:

1. Install dependencies (`npm ci`)  
2. Run validators (`npm run validate:all`)  
3. Build artifacts (`npm run build`)  
4. Package snapshot  
5. Deploy

## **98\. Validator Enforcement Gates**

CI must execute the exact same validation scripts used in local pre-flight checks. A non-zero exit code from any script in the Validation Library instantly fails the pipeline.

## **99\. Artifact Packaging in CI**

Automated pipelines must capture the commit SHA, generate the baseline filename strictly according to the Baseline ZIP Naming Convention, and output the validated baseline ZIP.

## **100\. Deployment Safety Rules**

No breaking changes without warning. Environment variables must remain unchanged unless explicitly requested and approved via Architecture Mode.

## **101\. Rollback Strategies**

CI pipelines must support deploying from previous baseline tags (`repo_post_update_TIMESTAMP`). Rolling back is achieved by targeting a known-good tag.

---

# **PART XIV — SECURITY OPERATIONS**

## **102\. Secrets Management**

Secrets must never exist in repositories. All secrets must be injected via secure environment variables or a dedicated secret manager at runtime/build-time.

## **103\. Dependency Security**

Dependencies must be audited regularly. New dependencies require strict adherence to the Dependency Governance Policy (Section 13).

## **104\. Access Control Policy**

Use the principle of least privilege for repository permissions. Bots and CI/CD tools must use scoped tokens strictly limited to their operational requirements.

## **105\. Repository Permission Governance**

Operators do not have permission to disable branch protection rules. Only organization administrators may authorize the bypassing of validator gates in catastrophic scenarios.

## **106\. Audit Logging**

Every snapshot sync creates a pre-sync and post-sync tag. Git history and tagging serve as the immutable audit log for all system modifications.

---

# **PART XV — INCIDENT RESPONSE**

## **107\. Incident Classification**

Incidents are classified into: Build Failures, Validation Failures, CI Pipeline Blockages, Data Corruption, and Production Outages.

## **108\. Repository Failure Types**

* **Hidden Breaking Change:** Code compiles but output is logically incorrect.  
* **Parallel System Conflict:** Duplicated logic causing runtime races.  
* **Artifact Desync:** Snapshot applied incorrectly over a dirty tree.

## **109\. Emergency Stabilization**

Invoke Emergency Mode. Stop active development. Identify the last known-good tag via `git log` and `git tag`.

## **110\. Rollback Execution**

Execute the Snapshot Rollback Script (Section 75\) to restore the repository to the pre-incident tag.

## **111\. Post-Incident Review**

All rollbacks must be followed by a diagnostic review comparing the failed diff to the known-good state to identify the root cause before any further forward progress.

---

# **PART XVI — LOCAL GUIDES GENERATOR (LKG) RUNBOOK**

## **112\. LKG Repository Overview**

Known canonical path in environment: `/Users/sequoiataylor/Documents/GitHub/local-guides-generator`  
 Default downloads path for snapshots: `~/Downloads`  
 The LKG repository is a generator repo that compiles data sets and templates into static website outputs.

## **113\. LKG Repository Architecture**

Relies strictly on Snapshot Mode for receiving upstream updates. It generates a `dist/` directory that is strictly validated against internal link integrity and coverage requirements.

## **114\. LKG Snapshot Deployment Workflow**

1. Inspect ZIP manifest  
2. Extract ZIP  
3. Detect true root  
4. Verify required root files  
5. Run rsync dry-run  
6. Create pre-update safety tag  
7. Apply rsync (`rsync --delete`)  
8. Repair executable bits  
9. NPM ci / reinstall dependencies  
10. NPM run validate:all  
11. Commit  
12. Pull `--rebase` & Push  
13. Create and push post-update tag

## **115\. LKG Update Script Operation**

Execute the v3 Updater (installed via Section 69\) strictly via the non-interactive EOF block below:

**A) Snapshot sync (FULL REPO ZIP) — Default**

bashCopy code  
\~/update\_lkg\_from\_zip\_v3.sh \<\<'EOF'  
\~/Downloads/YOUR\_FULL\_REPO.zip  
/Users/sequoiataylor/Documents/GitHub/local-guides-generator  
snapshot  
EOF

**B) Patch mode (partial ZIP only, exception)**

bashCopy code  
\~/update\_lkg\_from\_zip\_v3.sh \<\<'EOF'  
\~/Downloads/YOUR\_PARTIAL\_PATCH.zip  
/Users/sequoiataylor/Documents/GitHub/local-guides-generator  
patch  
EOF

*Note: If patch mode is exceptionally required, use `patch` instead of `snapshot` on the third line, and ensure it passes the `LKG_ALLOW_PATCH=1` gate if enforced.*

## **116\. LKG Validator System**

Command: `npm run validate:all`  
 Validators must fail if:

* Broken links exist (outputs to `dist/_broken_links.csv`).  
* Required runtime JSON files missing.

## **117\. LKG Coverage Authority Rules**

Authoritative research CSV entries must have correlating generated runtime pages. A coverage mismatch will halt the build.

## **118\. LKG Failure Recovery**

1. Open report: `open dist/_broken_links.csv`  
2. Decide what is correct (add the missing target or remove the dead link).  
3. Re-run `npm run validate:all`.  
    If irrecoverable, `git reset --hard lkg-pre-TIMESTAMP`.

---

# **PART XVII — APPENDICES**

## **119\. Command Reference**

* **Unzip Manifest Inspect:** `unzip -l SNAPSHOT.zip | head -n 200`  
* **NPM Clean Install:** `npm ci`  
* **Run All Validators:** `npm run validate:all`  
* **Get Short SHA:** `git rev-parse --short HEAD`  
* **Executable Bit Repair:** `find scripts -type f -name "*.sh" -exec chmod +x {} \;`

## **120\. Git Operations Reference**

* **Check Status:** `git status`  
* **View Recent History:** `git log --oneline -10`  
* **Discard Local Uncommitted:** `git restore .`  
* **Safe Pull:** `git pull --rebase origin main`  
* **Abort Rebase:** `git rebase --abort`

## **121\. Rsync Operations Reference**

* **Snapshot Dry-Run:** `rsync -avun --delete SNAPSHOT_ROOT/ REPO_PATH/`  
* **Snapshot Apply:** `rsync -avu --delete SNAPSHOT_ROOT/ REPO_PATH/`  
* *(Omit `--delete` flag for Patch mode)*

## **122\. Snapshot Safety Checklist**

Use this before running a snapshot update:

* ZIP name matches `<repo>-main_BASELINE_MM-DD-YY_<sha>.zip`  
* ZIP is a full snapshot, not a patch  
* ZIP was built from true repo root  
* `.gitignore` exists at root  
* `README.md` exists at root  
* `package.json` exists at root when applicable  
* `package-lock.json` exists when applicable  
* `_headers` exists when applicable  
* `_redirects` exists when applicable  
* manifest inspected  
* rsync dry-run inspected  
* validators planned after apply

## **123\. Repository Change Checklist**

* Diagnose repo state (Diagnostic Phase).  
* Classify change and select operating mode.  
* Define affected files, remove/modify/add lists, and rollback plan.  
* Wait for explicit approval to proceed.  
* Execute change via Terminal Mode rules.

## **124\. Validation Checklist**

* `npm ci` succeeds.  
* `npm run validate:all` exits with code 0\.  
* No duplicate features or shadow systems introduced.  
* Code complexity minimized.  
* Safety tag generated and pushed.

---

# **END OF TABLE OF CONTENTS**

**GLOBAL REPOSITORY OPERATIONS MANUAL — v6.1 MASTER**



---
# REPOSITORY UPDATE TOOLING ARCHITECTURE (v6.2 ADDITION)

## Installed Update Scripts (Canonical)

Two repository update scripts exist in the operator environment.

Script A — LKG Updater
File:
~/update_lkg_from_zip.sh

Purpose:
Local Guides Generator repository only.

Enforced snapshot name:
local-guides-generator-main_BASELINE_MM-DD-YY_<sha>.zip

Reason:
The Local Guides Generator repository contains ARI coverage authority,
large rsync delete operations, and generator output. Strict naming
prevents destructive updates.

Script B — Generic Repository Updater
File:
~/update_repo_from_zip_generic_v2.sh

Purpose:
All repositories except local-guides-generator.

Naming rule:
<repo-slug>-main_BASELINE_MM-DD-YY_<sha>.zip

Examples:
spry-hpc-site-main_BASELINE_01-30-26_4fe921a.zip
west-peek-productions-llm-main_BASELINE_03-13-26_ba942b3.zip
local-guides-citation-velocity-main_BASELINE_03-11-26_2444aa4.zip

---
# REPOSITORY UPDATE DECISION RULE

If repository slug == local-guides-generator or repository slug == local-guides-citation-velocity
    use ~/update_lkg_from_zip.sh
Else
    use ~/update_repo_from_zip_generic_v2.sh

---
# REPOSITORY UPDATE WORKFLOW

Step 1 — Inspect snapshot

unzip -l <zip> | head -n 60

Verify root files exist:

.gitignore
README.md
_headers
_redirects

Step 2 — Identify repository slug

Example repo path:

/Users/.../GitHub/west-peek-productions-llm

Slug:
west-peek-productions-llm

Step 3 — Apply decision rule

local-guides-generator → LKG updater
all other repos → generic updater

Step 4 — Execute update

Generic example

~/update_repo_from_zip_generic_v2.sh "/Users/.../Downloads/west-peek-productions-llm-main_BASELINE_MM-DD-YY_<sha>.zip" "/Users/.../GitHub/west-peek-productions-llm" snapshot

LKG example

~/update_lkg_from_zip.sh "/Users/.../Downloads/local-guides-generator-main_BASELINE_MM-DD-YY_<sha>.zip" "/Users/.../GitHub/local-guides-generator" snapshot

---
# SNAPSHOT NAMING RULE

Snapshot archives must begin with the repository slug.

Example

Repository folder:
west-peek-productions-llm

Snapshot archive:
west-peek-productions-llm-main_BASELINE_MM-DD-YY_<sha>.zip

---
# SCRIPT DISCOVERY

List installed update scripts

ls -l ~/update*sh

---
# HIDDEN FILE VISIBILITY (macOS)

Show hidden files in Finder:

Command + Shift + .

---
# CHANGELOG

v6.2
Added dual updater architecture documentation.
Documented canonical scripts:
update_lkg_from_zip.sh
update_repo_from_zip_generic_v2.sh

Added repository update decision rule.
Added operator update workflow.
Added snapshot naming clarification.
Added script discovery command.
Added macOS hidden file visibility note.

---

# **PHASE 4 INTEGRATION ADDENDUM — INSTALLED SCRIPT ALIGNMENT**

## Universal Repo Update Router

File:
~/update_repo.sh

Purpose:
Provide a single deterministic entry point for repository updates.

The router performs three safety operations before dispatching
to the appropriate updater:

1. Verify ZIP file exists
2. Verify repository path is a git repository
3. Verify ZIP prefix matches repository slug when running snapshot mode

If the ZIP does not match the repository slug,
the script aborts to prevent cross-repo corruption.

Example failure:

repo: west-peek-productions-llm
zip : spry-hpc-site-main_BASELINE_...

Result:

ERROR: ZIP does not match repo


## **Canonical Operator Entry Point**

When available, the preferred operator entry point for repository updates is:

```bash
~/update_repo.sh <ZIP_PATH> <REPO_PATH> [snapshot|patch]
```

This wrapper removes operator friction by selecting the correct updater automatically from the repository slug.

Decision rule:

```text
If repository slug == local-guides-generator or repository slug == local-guides-citation-velocity
    route to ~/update_lkg_from_zip.sh
Else
    route to ~/update_repo_from_zip_generic_v2.sh
```

## **Installed Update Scripts (Canonical Set)**

The canonical installed update scripts are:

```text
~/update_repo.sh
    universal router script that verifies snapshot ZIP matches repo slug and routes to the correct updater

~/update_lkg_from_zip.sh
    restricted updater for Local Guides Generator repositories

~/update_repo_from_zip_generic_v2.sh
    generic snapshot updater for all non‑LKG repositories
    (v3 logic may replace the internal behavior while keeping the filename stable)
```

Purpose:

- `~/update_repo.sh` — preferred operator entry point for all repo updates
- `~/update_lkg_from_zip.sh` — Local Guides Generator only
- `~/update_repo_from_zip_generic_v2.sh` — all non-LKG repositories

## **Invocation Style Alignment**

Argument-based invocation is the preferred style for all installed scripts unless a repo-specific exception is explicitly documented.

Example preferred usage:

```bash
~/update_repo.sh "/Users/.../Downloads/<repo>-main_BASELINE_MM-DD-YY_<sha>.zip" "/Users/.../GitHub/<repo>" snapshot
```

## **Required Script Guardrails**

### LKG script wrong-repo guard

If `~/update_lkg_from_zip.sh` is used with a non-LKG repository, it should fail with an explicit redirect to the generic updater:

```text
This updater is restricted to the Local Guides Generator repository.
For other repositories use:
~/update_repo_from_zip_generic_v2.sh
```

### Generic updater slug-match guard

The generic updater should verify:

```text
repo slug == snapshot slug
```

and fail loudly if they do not match.

## **v6.3 Changelog**

- added canonical operator entry point: `~/update_repo.sh`
- aligned manual with installed script reality
- documented preferred invocation style
- documented LKG wrong-repo guard
- documented generic updater slug-match guard


---
# CHANGELOG ADDENDUM

v6.4
Corrected canonical update entrypoint to ~/update_repo.sh
Added universal router script documentation
Added ZIP slug verification rule to prevent cross‑repo updates
Expanded LKG routing to include local-guides-citation-velocity
Aligned documentation with installed script environment
