# Phase 01 Baseline Report — Baseline and Toolchain Readiness

## Scope and Date

- **Date:** 2026-05-07
- **Repo:** `d:\dev\fm\timer-tracker`
- **Branch/commit:** current working tree (no modifications made)
- **Phase scope:** Task 1.1 (audit only) and Task 1.2 (clean install and report)
- **Objective:** Establish a reproducible factual baseline before any dependency upgrade begins.

---

## Toolchain Baseline

| Item | Value |
|---|---|
| Node.js (host) | v24.2.0 |
| npm (host) | 11.3.0 |
| Platform | Windows 11 |
| Electron (locked) | 33.4.11 |
| Electron bundled Node | ~20.18.x (Electron 33 series) |
| Lockfile version | 3 |

**Host/embedded Node mismatch (Risk):** The host Node.js (24.2.0) is four major versions ahead of the Node.js embedded in Electron 33 (~20.18.x). Native modules built against the host Node will not load in the Electron runtime. Electron Forge's rebuild step must target Electron's Node headers. This must be verified before any upgrade changes the Electron version.

---

## Dependency Inventory Snapshot

Resolved from lockfile after `npm ci`:

| Package | Resolved Version | Type | Notes |
|---|---|---|---|
| `electron` | 33.4.11 | devDependency | Core runtime |
| `sqlite3` | 5.1.7 | dependency | Native, N-API (versions 3, 6) |
| `electron-squirrel-startup` | 1.0.1 | dependency | Squirrel install event handler |
| `@electron-forge/cli` | 7.8.3 | devDependency | Build tooling |
| `@electron-forge/maker-squirrel` | 7.8.3 | devDependency | Windows installer maker |
| `@electron-forge/maker-zip` | 7.8.3 | devDependency | macOS zip maker |
| `@electron-forge/maker-deb` | 7.8.3 | devDependency | Linux deb maker |
| `@electron-forge/maker-rpm` | 7.8.3 | devDependency | Linux rpm maker |
| `@electron-forge/plugin-auto-unpack-natives` | 7.8.3 | devDependency | Unpacks native .node files from asar |
| `@electron-forge/plugin-fuses` | 7.8.3 | devDependency | Electron fuse configuration |
| `@electron/fuses` | 1.8.0 | devDependency | Fuse definitions |
| `electron-reload` | 2.0.0-alpha.1 | devDependency | Hot reload (alpha) |
| `electron-reloader` | 1.2.3 | devDependency | Hot reload (stable) |
| `jest` | 29.7.0 | devDependency | Test runner |
| `@types/jest` | 29.5.x | devDependency | Jest type definitions |

Total packages installed: **719**

---

## Clean Install Result

**Command sequence:**

```
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
npm ci
npm ls electron sqlite3 electron-squirrel-startup @electron-forge/cli @electron-forge/maker-squirrel --depth=0
```

**Pre-clean-install state:** `npm ls` reported `invalid: "^33.2.0"` for electron and `invalid: "^5.1.7"` for sqlite3, indicating the existing node_modules was corrupted or incomplete. Exit code 1.

**npm ci result: SUCCESS**

```
added 719 packages, and audited 720 packages in 20s
```

**Post-install npm ls (all resolved correctly):**

```
time-tracker@1.0.0
├── @electron-forge/cli@7.8.3
├── @electron-forge/maker-squirrel@7.8.3
├── electron-squirrel-startup@1.0.1
├── electron@33.4.11
└── sqlite3@5.1.7
```

### Install Warnings and Anomalies

**Deprecated packages (transitive, all from forge/sqlite3 toolchain):**

| Package | Reason |
|---|---|
| `inflight@1.0.6` | Memory leak — not supported |
| `gar@1.0.4` | No longer supported |
| `@npmcli/move-file@1.1.2` | Moved to `@npmcli/fs` |
| `@npmcli/move-file@2.0.1` | Moved to `@npmcli/fs` |
| `lodash.get@4.4.2` | Use optional chaining instead |
| `npmlog@6.0.2` | No longer supported |
| `rimraf@2.6.3` | Pre-v4 not supported |
| `rimraf@3.0.2` | Pre-v4 not supported |
| `glob@7.2.3` | Pre-v9 not supported |
| `glob@8.1.0` | Pre-v9 not supported (x2) |
| `are-we-there-yet@3.0.1` | No longer supported |
| `sudo-prompt@9.2.1` | No longer supported |
| `gauge@4.0.4` | No longer supported |
| `boolean@3.2.0` | No longer supported |

**EPERM cleanup warning (non-fatal):**

```
npm warn cleanup Failed to remove some directories [
  'D:\dev\fm\timer-tracker\node_modules\electron-installer-redhat\node_modules\yargs\build'
  [Error: EPERM: operation not permitted, rmdir ...]
]
```

This is a non-fatal Windows file-lock issue in the redhat maker (not used on Windows). Does not affect install correctness.

**Git dependency integrity warning:**

```
npm warn skipping integrity check for git dependency ssh://git@github.com/electron/node-gyp.git
```

A transitive dependency resolves from an SSH GitHub URL instead of the npm registry. Integrity verification is skipped. This could fail in environments without SSH access to GitHub (CI, Store build pipelines).

**Vulnerability audit:**

```
47 vulnerabilities (3 low, 7 moderate, 36 high, 1 critical)
```

All are in the transitive dependency tree (primarily forge, sqlite3 build tooling). None are in the direct runtime code paths. Requires further audit to confirm none affect packaged app behavior. Remediation deferred to Phase 02/05 per upgrade plan.

---

## Repo-Specific Baseline Risks

### Risk 1 — Host Node vs Electron embedded Node mismatch

- Host: Node.js 24.2.0. Electron 33 embeds ~Node 20.18.x.
- `sqlite3` 5.1.7 is a native N-API module (napi_versions 3 and 6).
- N-API is ABI-stable across Node versions within the same napi_version, which reduces but does not eliminate rebuild risk.
- Electron Forge's `@electron-forge/plugin-auto-unpack-natives` is present and will unpack `.node` files from the asar at runtime.
- **Risk:** If native rebuild does not target Electron's Node headers explicitly, sqlite3 will fail to load in packaged builds.
- **Mitigation in place:** `@electron-forge/plugin-auto-unpack-natives` is configured. Must be verified with a packaged build.

### Risk 2 — forge.config.js identity inconsistencies

The Squirrel maker config contains values that conflict with `package.json`:

| Field | forge.config.js (Squirrel) | package.json |
|---|---|---|
| `name` | `my_app` | `time-tracker` |
| `version` | `0.0.1` | `1.0.0` |

These inconsistencies affect installer identity, update behavior (Squirrel uses the name for registry keys and paths), and future Microsoft Store package family name alignment. The `name: 'my_app'` will become the Windows application identity for Squirrel installs.

### Risk 3 — Preload channel exposure

`src/settings/preload.js` exposes `ipcRenderer.send` and `ipcRenderer.on` with no channel allowlisting:

```js
contextBridge.exposeInMainWorld('ipcRenderer', {
  send: (channel, data) => ipcRenderer.send(channel, data),
  on: (channel, callback) => ipcRenderer.on(channel, ...)
});
```

Any renderer-side code (or injected script) can invoke any IPC channel. This is a surface area concern for Store hardening in Phase 05.

### Risk 4 — No explicit contextIsolation in BrowserWindow

`src/main/index.js` creates the BrowserWindow without explicitly setting `contextIsolation: true`. Modern Electron defaults to `true`, but the omission is a readability and audit risk. `nodeIntegration: false` and `enableRemoteModule: false` are explicitly set.

### Risk 5 — Duplicate hot-reload packages

Both `electron-reload@2.0.0-alpha.1` (alpha, pre-release) and `electron-reloader@1.2.3` (stable) are in devDependencies. Neither appears to be actively used in `src/main/index.js` (no require call visible). The alpha status of `electron-reload` is a concern if it is used in the upgrade path.

### Risk 6 — Low test coverage on IPC handlers

Coverage after `npm test`:

| File | Statements | Branches | Functions | Lines |
|---|---|---|---|---|
| `database.js` | 66.31% | 52.67% | 73.68% | 69.88% |
| `ipcHandlers.js` | 33.94% | 21.17% | 25.00% | 35.29% |
| **All files** | **54.39%** | **39.08%** | **53.03%** | **57.19%** |

`ipcHandlers.js` has only 25% function coverage. Large IPC handler paths for `save-timer`, `delete-timer`, `add-project`, CSV export, and theme toggling are untested. These are upgrade-sensitive paths. Phase 02 must address this before proceeding with runtime changes.

### Risk 7 — DB_PATH env var injection pattern

`src/main/index.js` sets `process.env.DB_PATH` at module load time, before `require`-ing the database module (indirectly through ipcHandlers). `src/infra/database.js` reads `process.env.DB_PATH` at the top level when the module is first loaded. Tests override this env var before requiring database.js. This works but is an implicit ordering contract; if any code loads database.js before the env var is set, the database will open at `undefined`.

### Risk 8 — 47 npm audit vulnerabilities including 1 critical

All appear to be in transitive build/dev tooling. The critical finding requires review to confirm it is not reachable in the packaged app bundle. Deferred to Phase 02 dependency audit.

### Risk 9 — SSH-based git dependency in lockfile

The lockfile resolves `node-gyp` via `ssh://git@github.com/electron/node-gyp.git`. This will fail on systems without SSH GitHub access and prevents integrity verification. A future CI configuration or Store build pipeline may not have this access.

---

## Automated Test Baseline

### Task 2.1 Run — 2026-05-07

**Commands:**

```
npm test
npx jest --runInBand --listTests
```

**Result: ALL PASS**

```
Test Suites: 3 passed, 3 total
Tests:       20 passed, 20 total
Snapshots:   0 total
Time:        0.74 s (estimated 6 s — Jest warm cache; prior baseline run was 6.906 s)
```

Note: The prior baseline run (Task 1.2) recorded 6.906 s. The Task 2.1 run completed in 0.74 s due to Jest module cache. Functional results are identical — all 20 tests green on both runs.

### Test Inventory Snapshot

**Command:** `npx jest --runInBand --listTests`

**Resolved test files (3 total):**

```
D:\dev\fm\timer-tracker\tests\database.test.js
D:\dev\fm\timer-tracker\tests\ipcHandlers.test.js
D:\dev\fm\timer-tracker\tests\csvUtils.test.js
```

| File | Tests | Subject |
|---|---|---|
| `tests/database.test.js` | 10 | SQLite CRUD, filtering, date ranges, schema migrations |
| `tests/ipcHandlers.test.js` | 4 | IPC `get-timers` (success + error), `update-timer` (success + error) |
| `tests/csvUtils.test.js` | 6 | Date/time formatting, duration formatting, CSV field escaping, CSV generation, filename generation |
| **Total** | **20** | |

**Jest configuration (`jest.config.js`):**

- `testEnvironment`: `node`
- `testMatch`: `**/tests/**/*.test.js`
- `collectCoverage`: `true`
- `collectCoverageFrom`: `src/infra/database.js`, `src/main/ipcHandlers.js` only — explicit, limited scope

### Coverage Summary

```
-----------------|---------|----------|---------|---------|---------------------
File             | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-----------------|---------|----------|---------|---------|---------------------
All files        |   54.39 |    39.08 |   53.03 |   57.19 |
 infra           |   66.31 |    52.67 |   73.68 |   69.88 |
  database.js    |   66.31 |    52.67 |   73.68 |   69.88 | 330–331, 340–386
 main            |   33.94 |    21.17 |      25 |   35.29 |
  ipcHandlers.js |   33.94 |    21.17 |      25 |   35.29 | multiple ranges
-----------------|---------|----------|---------|---------|---------------------
```

---

## Coverage Gap Analysis — Upgrade-Sensitive Surfaces

The following surfaces are not directly protected by the current automated tests and represent risk during an Electron or native-module upgrade. Gaps are ordered by upgrade sensitivity.

### Gap 1 — IPC Handlers: 75% of handlers have zero coverage (HIGH)

Only `get-timers` (success + error) and `update-timer` (success + error) are exercised. All other registered handlers are uncovered:

| Handler | Registration | Upgrade Risk |
|---|---|---|
| `add-project` | `ipcMain.on` | Legacy-vs-object format branch untested; IPC `on` semantics change risk |
| `delete-project` | `ipcMain.on` | Unverified delete path |
| `get-projects` | `ipcMain.on` | Unverified read path |
| `save-timer` | `ipcMain.on` | Billable calculation + `getProjectById` call chain; fallback error path untested |
| `delete-timer` | `ipcMain.on` | Unverified delete path |
| `export-csv` | `ipcMain.on` (async) | Uses `dialog.showSaveDialog` and `fs.writeFileSync` — Electron dialog API changes are common between major versions |
| `dark-mode:toggle` | `ipcMain.handle` | `nativeTheme` API; behavior changed in Electron 28+ |
| `dark-mode:system` | `ipcMain.handle` | As above |
| `dark-mode:set` | `ipcMain.handle` | As above — includes input validation logic |
| `dark-mode:get` | `ipcMain.handle` | As above |

The four `dark-mode:*` handlers use `ipcMain.handle` while all other handlers use `ipcMain.on`. An upgrade that changes return-value semantics for `handle` vs `on` or deprecates either form would not be detected by current tests.

### Gap 2 — Main Process Initialization: zero coverage (HIGH)

`src/main/index.js` is excluded from `collectCoverageFrom` and has no tests. It contains:

- `BrowserWindow` creation with `webPreferences` (`nodeIntegration: false`, `contextIsolation` absent — defaults to `true` in modern Electron but is not explicit)
- `app` lifecycle events (`ready`, `window-all-closed`, `activate`)
- `DB_PATH` env var injection before `ipcHandlers` `require` — implicit ordering contract

BrowserWindow API option names, default values, and deprecated fields change frequently between Electron major versions. No automated regression covers any of this behavior.

### Gap 3 — Preload Script: zero coverage (HIGH)

`src/settings/preload.js` is not in any test and not in `collectCoverageFrom`. It exposes `ipcRenderer.send` and `ipcRenderer.on` globally via `contextBridge` with no channel allowlisting. The `contextBridge` and `ipcRenderer` security model is regularly updated in Electron major releases. No automated test verifies the exposed surface shape or that `contextBridge.exposeInMainWorld` succeeds under the runtime webPreferences in use.

### Gap 4 — Database Project and Delete Functions: zero branch coverage (MODERATE)

`database.js` lines 330–331 and 340–386 are uncovered. This range includes `insertProject`, `getProjectById`, `deleteProject`, and `deleteTimer`. The `save-timer` IPC handler calls `getProjectById` before inserting a timer to compute the billable amount. If the native module rebuild after an upgrade changes the callback error shape for `getProjectById`, the billing path silently falls back with no test catching it.

### Gap 5 — Renderer Scripts: entirely outside test scope (MODERATE)

`src/renderer/timer/timer.js`, `src/renderer/timers/timers.js`, and `src/renderer/projects/projects.js` have no tests. These files invoke IPC channels via `window.ipcRenderer` (the preload-exposed interface). Any change to channel names or payload shape introduced by an upgrade will break silently in the renderer with no automated detection.

### Gap 6 — Theme Utility: zero coverage (LOW)

`src/shared/utils/theme.js` is not in `collectCoverageFrom` and has no tests. Theme behavior depends on `nativeTheme`, which changed default behavior in Electron 28+. Risk is lower because the `dark-mode:*` IPC handlers are a more direct test point once they are covered.

### Coverage Gap Summary Table

| Surface | Instrumented | Coverage | Upgrade Risk |
|---|---|---|---|
| `ipcHandlers.js` — `export-csv`, `dark-mode:*` | Yes | 0% (lines excluded) | HIGH |
| `main/index.js` | No | 0% | HIGH |
| `settings/preload.js` | No | 0% | HIGH |
| `database.js` — project + delete functions | Yes | 0% (lines 330–386) | MODERATE |
| `renderer/**/*.js` | No | 0% | MODERATE |
| `shared/utils/theme.js` | No | 0% | LOW |

---

## Phase 01 Status

| Criterion | Status | Notes |
|---|---|---|
| Clean install succeeds with selected Node.js toolchain | PASS | `npm ci` succeeded, 719 packages |
| Existing automated test suite passes | PASS | 20/20 tests green |
| Toolchain baseline documented | PASS | Node 24.2.0, npm 11.3.0, Electron 33.4.11 |
| Dependency inventory captured | PASS | See inventory table above |
| Baseline risks identified | PASS | 9 risks documented |
| Automated test baseline recorded (Task 2.1) | PASS | 3 suites, 20 tests, all pass; 0.74 s |
| Test inventory snapshot captured (Task 2.1) | PASS | 3 test files confirmed via `--listTests` |
| Coverage gap analysis completed (Task 2.1) | PASS | 6 upgrade-sensitive gaps documented |
| Development startup verified | PASS | Dev-mode smoke verified: 4 processes live, stable 60 s, userData path confirmed (see `phase-01-windows-smoke-report.md` §2–4) |
| Packaged Windows build verified | PASS | `npm run package` + `npm run make` exit 0; EXE 188 MB; Setup.exe 112.74 MB; sqlite3 native loaded; SQLite stdout confirmed (see `phase-01-windows-smoke-report.md` §8) |
| Regression checklist written | PASS | `phase-01-regression-checklist.md` complete with 12 sections, all agent-verifiable items marked |
| Store compatibility note | PASS | `phase-01-store-compatibility-note.md` complete with 10 documented areas |
| Manual UI smoke verification | PARTIAL | Agent environment is headless; all visual and interaction checks remain PENDING human tester (see below) |

---

## Phase 01 Gate Summary

| Gate | Status | Evidence / Notes |
|---|---|---|
| Toolchain baseline | **PASS** | Node 24.2.0, npm 11.3.0, Electron 33.4.11, lockfile v3 — all confirmed and documented |
| Clean install | **PASS** | `npm ci` exit 0; 719 packages; post-install `npm ls` shows all five key packages resolved without `invalid:` prefix |
| Automated tests | **PASS** | 20/20 tests pass across 3 suites (`database`, `ipcHandlers`, `csvUtils`); Jest exit 0 |
| Development startup | **PASS** | 4 Electron processes observed (`main`, `gpu`, `network`, `renderer`); stable for ≥ 60 s; `--user-data-dir` confirmed as `%APPDATA%\time-tracker`; no crash |
| Packaged Windows build | **PASS** | `npm run package` and `npm run make` both exit 0; `time-tracker.exe` 188 MB present; `time-tracker-1.0.0 Setup.exe` 112.74 MB present; `node_sqlite3.node` 1.8 MB correctly unpacked; startup stdout confirms SQLite connected and schema at version 1 |
| User-data storage verification | **PASS** | `%APPDATA%\time-tracker\timers.db` confirmed via process `--user-data-dir` argument and `Get-ChildItem`; 32 KB, non-empty, last written 2026-05-07; path set via `app.getPath('userData')` in `src/main/index.js` |
| Regression checklist artifact | **PASS** | `phase-01-regression-checklist.md` written with 12 sections covering install health, automated tests, dev startup, packaged build, manual UI flows, persistence, and shutdown; all agent-verifiable items resolved to baseline state |
| Store compatibility artifact | **PASS** | `phase-01-store-compatibility-note.md` written covering installer format, package identity, version alignment, code signing, update model, admin rights, userData path under MSIX, native module packaging, and 10 incompatibilities; 10 recommended follow-up topics enumerated |
| Manual UI smoke verification | **PARTIAL** | The agent environment is headless. Checks M1–M11 in `phase-01-windows-smoke-report.md` §5 and checks M1–M28, G1–G12 in `phase-01-regression-checklist.md` sections 5–13 are **all PENDING** a human tester with GUI access. This includes: window render, menu navigation, timer start/stop, project create/delete, timer edit/filter/delete, CSV export, theme toggle, persistence after restart, and installer round-trip. |

---

## Overall Phase 01 Status

**Conditionally ready for Phase 02**

All agent-executable gates pass. The automated toolchain, clean install, test suite, development startup, packaged build, user-data storage, regression checklist, and Store compatibility note are fully resolved and documented. Phase 02 dependency audit and coverage work can begin. The remaining manual UI smoke checks (M1–M28, G1–G12) are not blockers for Phase 02 planning and analysis, but must be completed before Phase 03 can be considered ready.

---

## Phase 02 Handoff — Priority Follow-Ups

The following items are the highest-priority actions at the start of Phase 02 or for immediate manual completion. They are listed in order of urgency.

| # | Item | Owner | Category |
|---|---|---|---|
| H1 | **Execute manual UI smoke checks** (M1–M28, G1–G12 in regression checklist) | Human tester | Manual gate — required before Phase 03 |
| H2 | **Root-cause the bare `Error` line** in packaged startup stderr (regression checklist M8) | Agent/developer | Packaged build health |
| H3 | **Resolve `maker-squirrel.name: 'my_app'` vs `time-tracker` identity mismatch** (Risk 2, Store note §2) — align `forge.config.js` with `package.json` before installer artifacts diverge further | Developer | Identity / packaging |
| H4 | **Expand IPC handler test coverage** — add tests for `add-project`, `delete-project`, `get-projects`, `save-timer`, `delete-timer`, `export-csv`, and `dark-mode:*` handlers (Risk 6, coverage gap §1) | Agent/developer | Test coverage — Phase 02 prerequisite |
| H5 | **Review the 1 critical npm audit vulnerability** to confirm it is not reachable in the packaged app runtime (Risk 8) | Developer | Security |
| H6 | **Replace the SSH git dependency** for `node-gyp` in the lockfile with the standard npm registry version (Risk 9, Store note §8) — required before any CI or Store build pipeline can run | Developer | CI / Store readiness |
| H7 | **Confirm `contextIsolation: true` is explicit** in the `BrowserWindow` `webPreferences` object (Risk 4) and add channel allowlisting to the preload script (Risk 3) | Developer | Security / hardening |
