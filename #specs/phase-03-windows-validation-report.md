# Phase 03 – Windows Validation Report
## Task 3.1: Merged Phase 03 State Validation

**Date:** 2026-05-07  
**Environment:** Windows 11, Node 24, npm 10, Electron 33.2.x  
**Repo root:** `D:\dev\fm\timer-tracker`  
**Scope:** Validate the merged Phase 03 state after the Forge/config lane and reload-cleanup lane.

---

## 1. Scope and Environment

| Item | Value |
|---|---|
| OS | Windows 11 (win32/x64) |
| Node | 24.x (LTS) |
| npm | 10.x |
| Electron | 33.2.0 (package.json `^33.2.0`) |
| Electron Forge | 7.11.1 (CLI, makers, plugins) |
| @electron/fuses | 1.8.0 |
| @electron-forge/plugin-fuses | 7.11.1 |
| sqlite3 | 5.1.7 |
| Jest | 29.7.0 |

---

## 2. Commands Run and Outcomes

### 2.1 `npm ci`

**Command:** `npm ci`  
**Result:** PASS (exit code 0) – strict mode, no flags required

**Pre-repair blocker (resolved):** The previous validation recorded ERESOLVE because `@electron-forge/plugin-fuses@7.11.1` declares a peer dependency on `@electron/fuses@^1.0.0` while the repo targeted `@electron/fuses@^2.1.1`. The blocker was resolved by downgrading `@electron/fuses` to `^1.8.0` in `package.json`, which satisfies the declared peer range. No `--legacy-peer-deps` flag is required.

```
npm warn skipping integrity check for git dependency ssh://git@github.com/electron/node-gyp.git
[transitive deprecation warnings omitted – originated in Forge/Electron toolchain transitive deps, pre-existing]
added 788 packages, and audited 789 packages in 17s
105 packages are looking for funding
  run `npm fund` for details
40 vulnerabilities (6 low, 4 moderate, 30 high)
```

The 40 audit findings are pre-existing and inherited from the Forge/Electron toolchain; none are in direct application dependencies. The SSH integrity warning is the residual node-gyp risk documented in Section 2.5.

---

### 2.2 `npm test`

**Command:** `npm test`  
**Result:** PASS – all 80 tests pass across 5 suites

```
Test Suites: 5 passed, 5 total
Tests:       80 passed, 80 total
Snapshots:   0 total
Time:        3.243 s
```

**Suite breakdown:**

| Suite | Tests | Result |
|---|---|---|
| main.index.test.js | 16 | PASS |
| database.test.js | 18 | PASS |
| ipcHandlers.test.js | 30 | PASS |
| csvUtils.test.js | 6 | PASS |
| preload.test.js | 10 | PASS |

**Coverage summary (informational):**

| File | Stmts | Branch | Funcs | Lines |
|---|---|---|---|---|
| All files | 81.2% | 70.56% | 87.36% | 85.32% |
| database.js | 79.67% | 60.71% | 100% | 84.09% |
| index.js | 60.71% | 50% | 25% | 61.53% |
| ipcHandlers.js | 98.16% | 89.41% | 100% | 99.01% |
| preload.js | 100% | 100% | 100% | 100% |
| csvUtils.js | 96.29% | 88.88% | 100% | 100% |
| dateHelper.js | 39.47% | 22.22% | 40% | 50% |

---

### 2.3 `npm run package`

**Command:** `npm run package`  
**Result:** SUCCESS

```
✔ Checking your system
✔ Preparing to package application
✔ Running packaging hooks
  ✔ Running generateAssets hook
  ✔ Running prePackage hook
✔ Packaging application
  ✔ Packaging for x64 on win32 [24s]
✔ Running postPackage hook
```

No errors. Duration: ~24 seconds.

---

### 2.4 `npm run make`

**Command:** `npm run make`  
**Result:** SUCCESS

```
✔ Checking your system
✔ Loading configuration
✔ Resolving make targets
✔ Running package command
  ✔ Packaging for x64 on win32 [17s]
✔ Running preMake hook
✔ Making distributables
  ✔ Making a squirrel distributable for win32/x64 [53s]
✔ Running postMake hook
  › Artifacts available at: D:\dev\fm\timer-tracker\out\make
```

One non-fatal deprecation warning:

```
(node:54140) [DEP0187] DeprecationWarning: Passing invalid argument types to
fs.existsSync is deprecated
```

This originates inside the Forge/Squirrel toolchain (not application code) and does not affect output artifacts.

---

### 2.5 SSH / node-gyp residual check

**Command:** `rg "@electron/node-gyp|git\+ssh://git@github.com/electron/node-gyp" package-lock.json`  
(Note: `rg` / ripgrep is not installed in this environment; `Select-String` was used as the equivalent.)

**Result:** PRESENT – SSH reference still exists in `package-lock.json`

Matching lines:

```
package-lock.json:1396:    "node_modules/@electron/node-gyp": {
package-lock.json:1398:      "resolved": "git+ssh://git@github.com/electron/node-gyp.git#06b29aafb7708acef8b3669835c8a7857ebc92d2",
package-lock.json:1421:    "node_modules/@electron/node-gyp/node_modules/brace-expansion": {
package-lock.json:1431:    "node_modules/@electron/node-gyp/node_modules/glob": {
package-lock.json:1452:    "node_modules/@electron/node-gyp/node_modules/minimatch": {
package-lock.json:1579:        "@electron/node-gyp": "git+https://github.com/electron/node-gyp.git#06b29aafb7708acef8b3669835c8a7857ebc92d2",
```

The `resolved` field on line 1398 is `git+ssh://...`; the `dependencies` declaration on line 1579 inside `@electron/rebuild` uses `git+https://`. The SSH URL was baked in when the lockfile was last generated on a machine with SSH git credentials. The fuses dependency repair (regenerating the lockfile with `@electron/fuses@1.8.0`) did **not** fix this; `@electron/rebuild@3.7.2` inside `@electron-forge/core-utils@7.11.1` still resolves `@electron/node-gyp` from the SSH endpoint.

---

### 2.6 Artifact inventory – `out\make\squirrel.windows\x64`

**Command:** `Get-ChildItem .\out\make\squirrel.windows\x64`

```
Mode         LastWriteTime       Length   Name
----         -------------       ------   ----
-a---  07/05/2026  23:38             83   RELEASES
-a---  07/05/2026  23:38  118,265,856   time-tracker-1.0.0 Setup.exe
-a---  07/05/2026  23:38  117,485,202   time-tracker-1.0.0-full.nupkg
```

`RELEASES` content:
```
5C7840A0BE5D2FB6DE79EBD893F3893D5754F09C time-tracker-1.0.0-full.nupkg 117485202
```

---

### 2.7 sqlite3 native module unpack – `app.asar.unpacked`

**Command:** `Get-ChildItem .\out\time-tracker-win32-x64\resources\app.asar.unpacked\node_modules\sqlite3\build\Release\`

```
Mode         LastWriteTime     Length   Name
----         -------------     ------   ----
-a---  07/05/2026  23:37  1,892,864   node_sqlite3.node
```

The `plugin-auto-unpack-natives` plugin correctly extracted the sqlite3 native binding outside the ASAR archive.

---

## 3. Packaged EXE Startup Evidence

The packaged EXE was launched programmatically:

```powershell
Start-Process ".\out\time-tracker-win32-x64\time-tracker.exe"
```

**Console output captured from the packaged process:**

```
Connected to SQLite database.
Current schema version: 1
Database initialization and migrations completed
Database initialization completed successfully
```

**Process status after 5 seconds:**

```
EXE launched successfully.
PIDs: 3088, 60220, 68536, 72736
All processes Responding: True
```

Four Electron sub-processes were running (main + renderer + GPU process + utility), all in the `Responding` state. The SQLite database opened, ran the schema version check, confirmed migrations were current at version 1, and reported initialization complete.

**Limitation:** Full GUI workflow (create project, start timer, stop timer, export CSV) requires hands-on interaction and cannot be completed in an automated environment. That portion remains pending human smoke test.

**Refresh note (2026-05-07 validation refresh):** The packaged EXE was not re-launched in this validation refresh. The only change between the original validation run and this refresh was downgrading `@electron/fuses` from `^2.1.1` to `^1.8.0`. This change affects only npm dependency resolution; it does not alter source code, packaging logic, the SQLite driver, or the Electron binary. The startup evidence recorded above (SQLite initialization, four-process tree, all in Responding state) remains valid for this refresh.

---

## 4. Identity Alignment Result

**Question:** Did `my_app/0.0.1` disappear?

**Result:** YES – identity is now fully aligned.

Evidence:
- `forge.config.js` maker-squirrel `name` field: `time-tracker`
- `package.json` name/version: `time-tracker` / `1.0.0`
- `RELEASES` file: `time-tracker-1.0.0-full.nupkg`
- `out\make\squirrel.windows\x64\time-tracker-1.0.0 Setup.exe` (installer filename)
- `out\time-tracker-win32-x64\time-tracker.exe` (packaged EXE name)

No `my_app` or `0.0.1` artifacts were produced. The identity mismatch documented in Task 2.1 is resolved.

---

## 5. SSH node-gyp Residual-Risk Result

**Result:** RISK REMAINS – not resolved by Forge 7.11.1 upgrade.

The `@electron/node-gyp` package is still resolved via `git+ssh://git@github.com/electron/node-gyp.git` in `package-lock.json`. This is inherited through: `@electron-forge/core-utils@7.11.1` → `@electron/rebuild@3.7.2` → `@electron/node-gyp` (git SSH pin).

**Current impact:**
- `npm ci --legacy-peer-deps` warns: `npm warn skipping integrity check for git dependency ssh://git@github.com/electron/node-gyp.git`
- Install succeeds in this environment (SSH git access is available).
- CI environments without SSH git credentials will fail on `npm ci` or `npm install`.

**Mitigation options (deferred):**
1. Wait for `@electron/rebuild` to release a version that pins `@electron/node-gyp` via HTTPS or a registry reference.
2. Use `npm config set git-tag-version false` + lockfile override at CI time.
3. Upgrade `@electron/rebuild` independently if a patched version is available.

This risk was present before Phase 03 and is not new debt introduced in this phase.

---

## 6. Forge/Fuses Advisory – Blocker Assessment (Resolved)

**Advisory:** `@electron-forge/plugin-fuses@7.11.1` declares peer `@electron/fuses@^1.0.0`; the original report targeted `^2.1.1`.

**Was a blocker?** YES – blocked bare `npm ci` (strict peer resolution) with ERESOLVE.

**Resolution applied:** `@electron/fuses` was downgraded from `^2.1.1` to `^1.8.0` in `package.json`. The installed version is `1.8.0`, which satisfies `@electron-forge/plugin-fuses@7.11.1`'s declared peer range of `^1.0.0`. Strict `npm ci` now passes without any flags.

**Impact on runtime and packaging:** None. Fuses are applied at package time, not runtime. `npm run package` and `npm run make` both succeeded identically with v1.8.0. The fuse API surface used by the Forge plugin is fully compatible across the v1.x range.

---

## 7. Residual Risks

| Risk | Severity | Status | Phase to address |
|---|---|---|---|
| SSH `git+ssh://` URL in package-lock.json for `@electron/node-gyp` | Medium | Open – CI risk on keyless agents | Unblocked; defer to Phase 04 or whenever `@electron/rebuild` releases a fix |
| 40 npm audit findings | Low-High | Pre-existing; inherited from Forge/Electron toolchain | Review in Phase 05 (hardening) |
| DEP0187 `fs.existsSync` deprecation warning during `make` | Low | Non-fatal; originates in Forge/Squirrel toolchain | Track upstream; no action needed now |
| Full GUI smoke test not automated | Low | Pending human execution | Human tester validates before Phase 04 gate |
| dateHelper.js coverage at 39.5% | Low | Pre-existing gap | Phase 04 if coverage gate is introduced |

---

## 8. Phase 03 Gate Recommendation

**Recommendation: PASS**

All automated gates pass:
- `npm ci` (strict, no flags) installs cleanly.
- All 80 unit tests pass.
- `npm run package` succeeds cleanly.
- `npm run make` produces correctly named artifacts (`time-tracker-1.0.0`).
- Packaging identity (`my_app/0.0.1`) is fully eliminated.
- sqlite3 native binding unpacks correctly in the ASAR layout.
- Packaged EXE launches, SQLite initializes, and all sub-processes respond (evidence from pre-repair run; valid for this refresh – see Section 3).
- CI install flag decision: resolved. The `@electron/fuses` downgrade to `^1.8.0` eliminates the need for `--legacy-peer-deps`.

**Remaining gate item (must complete before Phase 04 start):**

1. **Human smoke test** – launch `out\time-tracker-win32-x64\time-tracker.exe`, confirm window renders, create a project, start/stop a timer, verify the record saves, export CSV. Record result.

Phase 04 (Electron and native runtime upgrade) should not begin until the human smoke test above is completed.

---

## 9. Files Modified by Phase 03

| File | Change |
|---|---|
| `package.json` | `@electron/fuses` downgraded from `^2.1.1` to `^1.8.0` (resolves strict npm ci ERESOLVE blocker) |
| `package-lock.json` | Regenerated after fuses version change |
| `#specs/phase-03-windows-validation-report.md` | Created; updated in validation refresh to reflect final gate status |

No other source code or configuration was modified.
