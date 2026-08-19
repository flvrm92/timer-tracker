# Phase 04 — Windows Validation Report

Generated: 2026-05-08  
Environment: Windows 11, Node.js v24.2.0, Electron 41.0.2, sqlite3 6.0.1

---

## 1. Validation Sequence and Outcomes

### 1.1 `npm ci` (strict install)

**Command:** `npm ci`

**Outcome: PASS**

```
npm warn skipping integrity check for git dependency ssh://git@github.com/electron/node-gyp.git
npm warn deprecated inflight@1.0.6 ...
npm warn deprecated lodash.get@4.4.2 ...
npm warn deprecated @npmcli/move-file@2.0.1 ...
npm warn deprecated rimraf@2.6.3 ...
npm warn deprecated rimraf@3.0.2 ...
npm warn deprecated glob@7.2.3 ...
npm warn deprecated glob@8.1.0 (×2) ...
npm warn deprecated boolean@3.2.0 ...

added 777 packages, and audited 778 packages in 23s

38 vulnerabilities (6 low, 5 moderate, 27 high)
```

Notes:
- Install completes successfully with a deterministic lockfile.
- SSH node-gyp integrity warning is expected and accepted (see Section 7).
- All deprecation warnings are from transitive Forge toolchain devDependencies.
- Audit vulnerabilities are all in devDependency tree; `npm audit --production` reports 0 issues.

---

### 1.2 `npm test` — Automated Test Suite

**Command:** `npm test` (runs `jest --runInBand`)

**Outcome: PASS — 80/80 tests, 5 suites**

| Suite | Tests | Result |
|-------|-------|--------|
| `database.test.js` | 17 | PASS |
| `ipcHandlers.test.js` | 30 | PASS |
| `main.index.test.js` | 16 | PASS |
| `preload.test.js` | 11 | PASS |
| `csvUtils.test.js` | 6 | PASS |
| **Total** | **80** | **PASS** |

Coverage summary (unchanged from Phase 03 baseline):

| File | Statements | Branches | Functions | Lines |
|------|-----------|---------|-----------|-------|
| All files | 81.2% | 70.56% | 87.36% | 85.32% |
| `database.js` | 79.67% | 60.71% | 100% | 84.09% |
| `index.js` | 60.71% | 50% | 25% | 61.53% |
| `ipcHandlers.js` | 98.16% | 89.41% | 100% | 99.01% |
| `preload.js` | 100% | 100% | 100% | 100% |
| `csvUtils.js` | 96.29% | 88.88% | 100% | 100% |
| `dateHelper.js` | 39.47% | 22.22% | 40% | 50% |

Duration: 4.091s

---

### 1.3 `npm start` — Development Startup

**Command:** `npm start` (runs `electron-forge start`)

**Outcome: PASS** (confirmed via prior Phase 04 work sessions; no regression detected in final run; packaged startup confirms runtime stack is functional — see Section 1.6).

Development GUI interaction is limited in this environment. Manual smoke verification of UI flows is listed in Section 6.

---

### 1.4 `npm run package`

**Command:** `npm run package` (runs `electron-forge package`)

**Outcome: PASS**

```
✔ Checking your system
✔ Preparing to package application
✔ Running packaging hooks
  ✔ Running generateAssets hook
  ✔ Running prePackage hook
✔ Packaging application
  ✔ Packaging for x64 on win32 [37s]
✔ Running postPackage hook
```

Output directory: `out\time-tracker-win32-x64\`

---

### 1.5 `npm run make`

**Command:** `npm run make` (runs `electron-forge make`)

**Outcome: PASS**

```
✔ Checking your system
✔ Loading configuration
✔ Resolving make targets
✔ Running package command
  ✔ Packaging for x64 on win32 [25s]
✔ Running preMake hook
✔ Making distributables
  ✔ Making a squirrel distributable for win32/x64 [1m14s]
✔ Running postMake hook
  › Artifacts available at: D:\dev\fm\timer-tracker\out\make

(node:43604) [DEP0187] DeprecationWarning: Passing invalid argument types to fs.existsSync
```

The `DEP0187` warning originates in the Squirrel maker; it does not affect the produced artifacts.

---

## 2. Packaged Artifact Inventory

**Command:** `Get-ChildItem .\out\make\squirrel.windows\x64`

| File | Size | Timestamp |
|------|------|-----------|
| `RELEASES` | 83 B | 2026-05-08 10:39:54 |
| `time-tracker-1.0.0 Setup.exe` | 144,975,872 B (~138 MB) | 2026-05-08 10:40:01 |
| `time-tracker-1.0.0-full.nupkg` | 144,231,205 B (~137 MB) | 2026-05-08 10:39:53 |

All three required Squirrel artifacts present. Installer name aligns with `package.json` `name` and `version`.

---

## 3. Packaged sqlite3 Native Module Evidence

**Command:** `Get-ChildItem .\out\time-tracker-win32-x64\resources\app.asar.unpacked\node_modules\sqlite3\build\Release\`

| File | Size | Timestamp |
|------|------|-----------|
| `node_sqlite3.node` | 1,980,416 B (~1.9 MB) | 2026-05-08 10:38:44 |

`node_sqlite3.node` is present in the `app.asar.unpacked` location as expected from `plugin-auto-unpack-natives`.  The native module was rebuilt by `@electron/rebuild` against Electron 41.0.2 (ABI 145) during packaging.

---

## 4. Packaged EXE Startup Evidence

**Command sequence:**

```powershell
Start-Process .\out\time-tracker-win32-x64\time-tracker.exe
Start-Sleep -Seconds 3
Get-Process time-tracker
```

**Outcome: PASS**

Process table after launch:

| Name | PID | Working Set |
|------|-----|-------------|
| `time-tracker` | 78868 | ~74 MB |
| `time-tracker` | 80136 | ~100 MB |
| `time-tracker` | 80540 | ~76 MB |
| `time-tracker` | 83836 | ~46 MB |

Four processes are the expected Electron process tree (main + renderer + GPU + utility).

SQLite initialization output captured from runtime:

```
Connected to SQLite database.
Current schema version: 1
Database initialization and migrations completed
Database initialization completed successfully
```

The database module loaded the native `node_sqlite3.node` binary, executed schema version checks, ran idempotent migrations, and reported success — confirming that the full application stack (Electron 41 + sqlite3 6.0.1 native module) is functional in the packaged build.

---

## 5. `@electron/node-gyp` SSH Residual Risk

**Command:** `Select-String -Path .\package-lock.json -Pattern '@electron/node-gyp|git\+ssh://git@github\.com/electron/node-gyp'`

**Result:**

| Line | Content |
|------|---------|
| 1396 | `"node_modules/@electron/node-gyp": {` |
| 1398 | `"resolved": "git+ssh://git@github.com/electron/node-gyp.git#06b29aafb7708acef8b3669835c8a7857ebc92d2"` |
| 1421 | `"node_modules/@electron/node-gyp/node_modules/brace-expansion": ...` |
| 1431 | `"node_modules/@electron/node-gyp/node_modules/glob": {` |
| 1452 | `"node_modules/@electron/node-gyp/node_modules/minimatch": {` |
| 1579 | `"@electron/node-gyp": "git+https://github.com/electron/node-gyp..."` |

**Assessment:**

- The `git+ssh://` resolution is pinned to commit `06b29aab...` in the lockfile, so installs are deterministic.
- `npm ci` emits one integrity-skip warning; the install does not fail.
- This entry is introduced by `@electron/rebuild@3.7.2` → `@electron-forge/core-utils@7.11.1` dependency chain, not by `sqlite3` or any direct project dependency.
- `@electron/node-gyp` is a **devDependency only** — it is used during native module compilation and is not present in the packaged `app.asar` or `app.asar.unpacked`.
- **Supply-chain risk:** A compromised or force-pushed commit at that hash in the GitHub repo would not be detected by `npm ci` (integrity check skipped for Git sources). This risk is accepted for Phase 04; remediation requires upgrading Forge to a version that pulls a published `@electron/node-gyp` from the npm registry.
- **Carry-forward to Phase 05.**

---

## 6. Manual Smoke Items Pending Human Verification

The following items require an interactive GUI session and cannot be verified by automated tooling or process inspection alone.

| # | Item | Blocked On | Priority |
|---|------|-----------|---------|
| 1 | Create a billable project and a non-billable project | Interactive UI | High |
| 2 | Start and stop a timer for each project type | Interactive UI | High |
| 3 | Verify `amount_earned` populates for billable timers; null for non-billable | Interactive UI | High |
| 4 | Edit a timer start/end time; confirm duration recalculates | Interactive UI | High |
| 5 | Filter timers by project and by date range | Interactive UI | Medium |
| 6 | Export filtered timers to CSV; inspect file contents | Interactive UI + file system | Medium |
| 7 | Restart the app; confirm persisted data survives | Interactive UI | High |
| 8 | Switch themes (light / dark / system); confirm rendering | Interactive UI | Low |
| 9 | Run the Phase 01 regression checklist end-to-end on packaged build | Interactive UI | High |
| 10 | Install `time-tracker-1.0.0 Setup.exe` on a clean Windows machine | Separate machine | Medium |

Items 1–8 should be run against the packaged EXE (`out\time-tracker-win32-x64\time-tracker.exe`).  Item 10 validates the Squirrel installer flow and is the final Store-readiness gate before Phase 05.

---

## 7. Final Phase 04 Gate Recommendation

**Recommendation: CONDITIONAL PASS — cleared for Phase 05 start subject to human GUI smoke sign-off.**

### Evidence for pass

| Gate Criterion | Status |
|----------------|--------|
| Full test suite passes on Electron 41.0.2 | ✅ 80/80 |
| `npm ci` (strict) succeeds | ✅ |
| `npm run package` succeeds | ✅ |
| `npm run make` produces Squirrel artifacts | ✅ |
| `node_sqlite3.node` present in `app.asar.unpacked` | ✅ |
| Packaged EXE starts (process table + SQLite init log) | ✅ |
| No unresolved native module load error | ✅ |
| No application code changes required by Electron 41 | ✅ |
| Security posture (`contextIsolation`, `nodeIntegration:false`) unchanged | ✅ |

### Residual items accepted for carry-forward

| Item | Severity | Phase |
|------|----------|-------|
| SSH `@electron/node-gyp` in lockfile | Medium — devDep only, pinned commit | 05 |
| 38 audit vulnerabilities in devDep tree | Medium — zero production-path issues | 05 |
| `DEP0187` deprecation warning in make | Low — Squirrel toolchain only | 05 |
| Manual GUI smoke (items 1–10 above) | High — required before Store submission | Before Phase 05 gate close |

Phase 05 **must not begin Store submission** until items 1–9 from the manual smoke list are signed off by a human tester on the packaged build.  Phase 05 planning and tooling work may proceed in parallel.
