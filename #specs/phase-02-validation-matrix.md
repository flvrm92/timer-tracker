# Phase 02 — Validation Matrix

**Task:** Phase 2, Task 4.1 — Build Practical Validation Matrix  
**Date:** 2026-05-07  
**Repo:** `d:\dev\fm\timer-tracker`  
**Baseline stack verified:** Electron 33.4.11 / Forge 7.8.3 / sqlite3 5.1.7 / Jest 29.7.0 / Node 24.2.0 (host)  
**Test run result:** 80 tests, 5 suites — ALL PASS (`npm test` exit code 0)

---

## 1. Phase 02 Accomplishments Summary

| Deliverable | Status | Artifact |
|---|---|---|
| Dependency audit and approved target matrix | ✅ Complete | `phase-02-dependency-matrix.md` |
| Native dependency decision note | ✅ Complete | `phase-02-native-dependency-decision.md` |
| Preload bridge contract tests (NEW) | ✅ Complete | `tests/preload.test.js` — 11 tests, **100% coverage** |
| Main-process startup tests (NEW) | ✅ Complete | `tests/main.index.test.js` — 16 tests |
| IPC handler coverage expansion | ✅ Complete | `tests/ipcHandlers.test.js` — 30 tests, **98.16% stmt coverage** |
| Validation matrix (this document) | ✅ Complete | `phase-02-validation-matrix.md` |
| Store compatibility checklist | ✅ Complete | `phase-02-store-compatibility-checklist.md` — produced as Phase 02 close-out task |
| Version bump: Forge 7.8.3 → 7.11.1 | ⏳ Deferred | Approved in matrix; implementation deferred to Phase 03 |
| Version bump: `@electron/fuses` 1.8.0 → 2.1.1 | ⏳ Deferred | Approved in matrix; implementation deferred to Phase 03 |
| Version bump: `sqlite3` 5.1.7 → 6.0.1 | ⏳ Deferred | Approved in matrix; implementation deferred to Phase 03 |

> **Note on version bumps:** The Phase 02 strategy document states "this phase may include low-risk test additions and planning docs, but it does not yet upgrade the main runtime stack." The approved target matrix designated Forge, fuses, and sqlite3 as "Move Phase: 2" but no version changes have been applied. Those moves are reassigned to Phase 03 along with the Electron upgrade.

---

## 2. Coverage Snapshot (as of 2026-05-07)

| File | % Stmts | % Branch | % Funcs | % Lines | Phase 02 Δ |
|---|---|---|---|---|---|
| `src/infra/database.js` | 79.67 | 60.71 | 100 | 84.09 | Existing |
| `src/main/ipcHandlers.js` | **98.16** | 89.41 | 100 | 99.01 | Expanded |
| `src/main/index.js` | 59.37 | 50.00 | 25 | 60.00 | **NEW** |
| `src/settings/preload.js` | **100** | 100 | 100 | 100 | **NEW** |
| `src/shared/utils/csvUtils.js` | 96.29 | 88.88 | 100 | 100 | Existing |
| `src/shared/utils/dateHelper.js` | 39.47 | 22.22 | 40 | 50.00 | Existing — **gap** |
| **All files** | **80.89** | **70.40** | **87.36** | **84.94** | — |

**Coverage gaps requiring attention:**

- `dateHelper.js` — 39.47% statements / 22.22% branch / 40% functions. The uncovered functions are not exercised by any test and are not on a known hotpath for the Electron upgrade, but low branch coverage means date parsing edge cases are not validated. Documented as Phase 03 test backlog.
- `main/index.js` — 59.37% statements / 25% functions. The gap is structural: Electron app lifecycle callbacks (`activate`, `window-all-closed` in packaged context, Tray construction) cannot be fully exercised in a headless Jest environment. The critical startup path (DB_PATH setup, `whenReady`, BrowserWindow creation, menu wiring, IPC setup) is covered. Remaining lines are Electron-lifecycle-specific; accepted as headless test ceiling.
- `database.js` branch gap — 60.71% branch. Uncovered branches are primarily error-path callbacks in migration code (lines 371–372, 383–384). Low regression risk for the Electron upgrade; documented as Phase 03 test backlog.

---

## 3. Critical Workflow → Verification Matrix

**Legend:** ✅ Automated | 🔲 Manual gate required | ⏳ Deferred | N/A Not applicable at this phase

### 3.1 Infrastructure and Data Layer

| # | Workflow | Automated Coverage | Test / Evidence | Manual Gate | Status | Phase 03 Implication |
|---|---|---|---|---|---|---|
| I1 | Database initialization and schema migration (v0→v1) | ✅ Full | `database.test.js` — migration exercised end-to-end; schema_version table verified | None | ✅ Ready | Rebuild against Electron-bundled Node must succeed |
| I2 | `timers.db` created at correct `userData` path | ✅ Partial | `main.index.test.js` — `DB_PATH` ends with `timers.db`; Phase 01 smoke confirms actual file creation | — | ✅ Ready | userData path unchanged across Electron upgrade |
| I3 | Native module load (`node_sqlite3.node`) in dev mode | ✅ Evidence | Phase 01 smoke: `Connected to SQLite database` in stdout | — | ✅ Ready | Must re-verify after sqlite3 v6 rebuild |
| I4 | Native module present in packaged `asar.unpacked` | ✅ Evidence | Phase 01 packaging: `node_sqlite3.node` at 1.8 MB in expected path | — | ✅ Ready | Must re-verify after forge 7.11.1 + sqlite3 v6 |
| I5 | SSH git dependency in lockfile | — | `@electron/node-gyp` routes via `ssh://github.com/...` — CI/Store blocker | 🔲 Manual | ⏳ Phase 03 | Expected to resolve when forge 7.11.1 updates lockfile |

### 3.2 IPC Contract Layer (Main ↔ Renderer)

| # | Workflow | Automated Coverage | Test / Evidence | Manual Gate | Status | Phase 03 Implication |
|---|---|---|---|---|---|---|
| C1 | Preload bridge exposes `ipcRenderer.send` | ✅ Full | `preload.test.js` — delegates to Electron `ipcRenderer.send`; 100% coverage | None | ✅ Ready | Verify bridge still loads after Electron upgrade |
| C2 | Preload bridge exposes `ipcRenderer.on` (event arg stripped) | ✅ Full | `preload.test.js` — wrapped callback verified | None | ✅ Ready | Same as C1 |
| C3 | Preload bridge exposes `darkMode.*` (toggle/system/setTheme/getTheme) | ✅ Full | `preload.test.js` — all four methods verified | None | ✅ Ready | Same as C1 |
| C4 | `get-timers` IPC — success and error paths | ✅ Full | `ipcHandlers.test.js` — 4 cases: success, count error, inner error, invalid date range | None | ✅ Ready | IPC API surface unchanged |
| C5 | `update-timer` IPC — success and error paths | ✅ Full | `ipcHandlers.test.js` — 2 cases | None | ✅ Ready | — |
| C6 | `add-project` IPC — legacy string and object payloads | ✅ Full | `ipcHandlers.test.js` — 4 cases (both payload shapes, both error paths) | None | ✅ Ready | — |
| C7 | `delete-project` IPC | ✅ Full | `ipcHandlers.test.js` — success and error | None | ✅ Ready | — |
| C8 | `get-projects` IPC | ✅ Full | `ipcHandlers.test.js` — success and error | None | ✅ Ready | — |
| C9 | `save-timer` IPC — billable project (calculates amount) | ✅ Full | `ipcHandlers.test.js` — billable rate × duration verified | None | ✅ Ready | — |
| C10 | `save-timer` IPC — non-billable project (null amount) | ✅ Full | `ipcHandlers.test.js` | None | ✅ Ready | — |
| C11 | `save-timer` IPC — fallback on `getProjectById` error | ✅ Full | `ipcHandlers.test.js` — inserts timer without amount on DB error | None | ✅ Ready | — |
| C12 | `delete-timer` IPC | ✅ Full | `ipcHandlers.test.js` — success and error-sends `timer-delete-error` | None | ✅ Ready | — |
| C13 | `export-csv` IPC — success (file written) | ✅ Full | `ipcHandlers.test.js` — file written, `csv-exported` sent | None | ✅ Ready | — |
| C14 | `export-csv` IPC — dialog cancel | ✅ Full | `ipcHandlers.test.js` — sends `csv-export-cancelled` | None | ✅ Ready | — |
| C15 | `export-csv` IPC — error paths (invalid date, DB error) | ✅ Full | `ipcHandlers.test.js` — 2 error cases | None | ✅ Ready | — |
| C16 | `export-csv` with projectId resolves project name | ✅ Full | `ipcHandlers.test.js` | None | ✅ Ready | — |
| C17 | `dark-mode:toggle` IPC | ✅ Full | `ipcHandlers.test.js` — toggled from light and dark | None | ✅ Ready | — |
| C18 | `dark-mode:system` / `dark-mode:set` / `dark-mode:get` IPC | ✅ Full | `ipcHandlers.test.js` — all handled; invalid theme throws | None | ✅ Ready | — |

### 3.3 Business Logic and Utilities

| # | Workflow | Automated Coverage | Test / Evidence | Manual Gate | Status | Phase 03 Implication |
|---|---|---|---|---|---|---|
| B1 | Timer CRUD: insert, read, update (recalculate duration), delete | ✅ Full | `database.test.js` — 17 tests; validates SQL joins, duration math, date-order rejection | None | ✅ Ready | SQL schema unchanged; verify after sqlite3 v6 rebuild |
| B2 | Project CRUD: insert (billable + legacy), read by id, list, update, delete | ✅ Full | `database.test.js` | None | ✅ Ready | Same as B1 |
| B3 | Timer filtering by project and by date range | ✅ Full | `database.test.js` + `ipcHandlers.test.js` | None | ✅ Ready | — |
| B4 | `getTimersForExport` with and without date filter | ✅ Full | `database.test.js` — 2 cases | None | ✅ Ready | — |
| B5 | CSV generation: formatting, escaping, header row | ✅ Full | `csvUtils.test.js` — 6 tests; comma-in-field, ISO date, duration format | None | ✅ Ready | — |
| B6 | `dateHelper` format functions | ⚠️ Partial | `csvUtils.test.js` indirectly exercises some paths; `dateHelper.test.js` does NOT exist | 🔲 **Manual gate** | ⚠️ Gap | Add `dateHelper.test.js` as Phase 03 test backlog item |
| B7 | Billable hourly-rate × duration calculation | ✅ Full | `ipcHandlers.test.js` + `database.test.js` | None | ✅ Ready | — |

### 3.4 Main Process Startup

| # | Workflow | Automated Coverage | Test / Evidence | Manual Gate | Status | Phase 03 Implication |
|---|---|---|---|---|---|---|
| S1 | `DB_PATH` set before `app.whenReady` | ✅ Full | `main.index.test.js` — ordering assertion | None | ✅ Ready | Must rerun after userData path logic survives Electron upgrade |
| S2 | `BrowserWindow` created with correct dimensions and security config | ✅ Full | `main.index.test.js` — `nodeIntegration: false`, `enableRemoteModule: false`, `preload` path, sandbox | None | ✅ Ready | Verify options still valid in Electron 36.x |
| S3 | Menu built and applied with expected labels | ✅ Full | `main.index.test.js` — Projects, Timers, Window, View, Exit | None | ✅ Ready | — |
| S4 | `setupIpcHandlers` called at startup | ✅ Full | `main.index.test.js` | None | ✅ Ready | — |
| S5 | `window-all-closed` and `activate` handlers registered | ✅ Full | `main.index.test.js` | None | ✅ Ready | — |
| S6 | App stable for ≥ 60 seconds after `npm start` | — | Phase 01 smoke report (headless, process check) | 🔲 Manual | ⏳ Carry-forward (M1–M8) | Re-run after Electron upgrade |
| S7 | App stable for ≥ 10 seconds after packaged `time-tracker.exe` | — | Phase 01 packaging smoke | 🔲 Manual | ⏳ Carry-forward (P6) | Re-run after forge + Electron + sqlite3 upgrade |

### 3.5 UI and Renderer Workflows (Manual Only)

> All items in this section are manual-only. The agent environment is headless. No renderer automation exists in the current test suite.

| # | Workflow | Manual Check | Regression Checklist Ref | Status |
|---|---|---|---|---|
| U1 | App window opens — no blank/white screen | Human visual confirm | M1 | ✅ PASS (2026-05-07 human sign-off) |
| U2 | Title bar shows expected app name | Human visual confirm | M2 | ⏳ Pending |
| U3 | Menu bar shows File / Window / View equivalents | Human interaction | M3 | ⏳ Pending |
| U4 | Timer page renders | Human visual confirm | M4 | ⏳ Pending |
| U5 | Projects page renders | Human visual confirm | M5 | ⏳ Pending |
| U6 | Timers page renders | Human visual confirm | M6 | ⏳ Pending |
| U7 | No JS console errors on startup (DevTools F12) | Human DevTools check | M7 | ⏳ Pending |
| U8 | Bare `Error` line in packaged stdout is benign | Human investigation | M8 | ⏳ Pending |
| U9 | Create standard project — appears in list | Human UI interaction | M9 | ⏳ Pending |
| U10 | Create billable project — appears with billable indicator | Human UI interaction | M10 | ⏳ Pending |
| U11 | Delete project — removed from list | Human UI interaction | M11 | ⏳ Pending |
| U12 | Delete project — no crash | Human UI interaction | M12 | ⏳ Pending |
| U13 | Select project + start timer — timer counts | Human UI interaction | M13 | ⏳ Pending |
| U14 | Stop timer — duration recorded in list | Human UI interaction | M14 | ⏳ Pending |
| U15 | Billable timer start/stop — billable flag preserved | Human UI interaction | M15 | ⏳ Pending |
| U16 | No duplicate timer entries per start/stop cycle | Human UI inspection | M16 | ⏳ Pending |
| U17 | Open timer for edit — all fields editable | Human UI interaction | M17 | ⏳ Pending |
| U18 | Save edited entry — changes persist | Human UI interaction | M18 | ⏳ Pending |
| U19 | Filter timers by project — list narrows | Human UI interaction | M19 | ⏳ Pending |
| U20 | Filter timers by date range — list narrows | Human UI interaction | M20 | ⏳ Pending |
| U21 | Delete timer entry — entry removed | Human UI interaction | M21 | ⏳ Pending |
| U22 | `timers.db` file size grows after recording timer | `Test-Path` + size check | M22 | ⏳ Pending |

> **Acceptance basis:** U1 has a human sign-off ("looks good," 2026-05-07) covering broad UI smoke. U2–U22 remain pending explicit per-item confirmation. These are accepted as phase carry-forward manual gates. They must be completed before Phase 03 output is accepted as a release candidate.

### 3.6 Build and Packaging

| # | Workflow | Automated Coverage | Manual Gate | Status | Phase 03 Implication |
|---|---|---|---|---|---|
| K1 | `npm ci` exits 0; all direct deps resolved | Phase 01 checklist (I1–I2) | 🔲 Re-run after upgrade | ⏳ Phase 03 | First step in Phase 03 upgrade sequence |
| K2 | `npm run package` exits 0 (≤ 60 s) | Phase 01 checklist (P1) | 🔲 Re-run after upgrade | ⏳ Phase 03 | Must pass with forge 7.11.1 + sqlite3 v6 |
| K3 | `npm run make` exits 0; Squirrel installer produced | Phase 01 checklist (P2–P4) | 🔲 Re-run after upgrade | ⏳ Phase 03 | Must pass with forge 7.11.1 |
| K4 | `node_sqlite3.node` present in `asar.unpacked` after package | Phase 01 checklist (P5) | 🔲 Re-run after sqlite3 v6 rebuild | ⏳ Phase 03 | plugin-auto-unpack-natives must still handle v6 |
| K5 | `npm audit` severity does not exceed Phase 01 baseline | Phase 01 checklist (I4) | 🔲 Run after each upgrade step | ⏳ Phase 03 | Forge 7.11.1 expected to close majority of findings |
| K6 | SSH git dep (`@electron/node-gyp`) removed from lockfile | — | 🔲 `npm ls @electron/node-gyp` post-forge-upgrade | ⏳ Phase 03 | Forge 7.11.1 upgrade expected to resolve this |
| K7 | Duplicate hot-reload packages (`electron-reload` + `electron-reloader`) | — | 🔲 Remove before Phase 03 build | ⏳ Phase 03 | Clean up dev tooling before runtime upgrade |

---

## 4. Manual / Deferred Gates — Consolidated List

The following items require human action or are explicitly deferred to Phase 03 before the upgrade sequence can proceed:

| Gate | Type | Owner | Phase |
|---|---|---|---|
| **G1** — Store compatibility checklist | Doc | repo owner | ✅ Resolved — `phase-02-store-compatibility-checklist.md` produced |
| **G2** — `dateHelper.js` test coverage (39.47% stmts) — add `dateHelper.test.js` | Test backlog | repo owner | Phase 03 |
| **G3** — Manual UI workflow sign-offs U2–U22 (regression checklist M2–M22) | Human QA | human tester | Before Phase 03 RC |
| **G4** — Packaged build re-validation (K1–K7) after version upgrades | Build | repo owner | Phase 03 execution |
| **G5** — `npm audit` re-check after each upgrade commit in Phase 03 | Build | repo owner | Phase 03 execution |
| **G6** — SSH git dependency removal confirmed post-forge upgrade | Build / CI | repo owner | Phase 03 |
| **G7** — Duplicate hot-reload tooling (`electron-reload` + `electron-reloader`) removed | Cleanup | repo owner | Phase 03 pre-upgrade |
| **G8** — `database.js` uncovered error branches (lines 371–372, 383–384) | Test backlog | repo owner | Phase 03 (low priority) |

---

## 5. Phase 03 Readiness Summary

| Area | Ready for Phase 03? | Blocking condition |
|---|---|---|
| Automated test gate (baseline stack) | ✅ Yes | None — 80/80 pass |
| Dependency upgrade plan | ✅ Yes | Matrix and decision docs complete |
| Preload contract coverage | ✅ Yes | 100% — safe to upgrade Electron around |
| IPC contract coverage | ✅ Yes | 98.16% — regression risk is low |
| Database layer coverage | ✅ Yes (qualified) | Core paths covered; branch gaps documented |
| Store compatibility documentation | ✅ Yes | `phase-02-store-compatibility-checklist.md` produced as Phase 02 close-out |
| UI regression baseline | ⚠️ Partial | U1 confirmed; U2–U22 pending human sign-off |
| Build and packaging baseline | ✅ Yes (Phase 01 basis) | Phase 01 verified; will require re-run after upgrade |
| `dateHelper.js` coverage | ⚠️ Gap | Below 40% stmt — documented, not blocking if manual gate accepted |

---

## 6. Phase 02 Gate Recommendation

> **READY**

*(Updated from CONDITIONALLY READY — Gate G1 resolved by `phase-02-store-compatibility-checklist.md`, 2026-05-07)*

Phase 02 has delivered its full set of planned artifacts: a complete dependency upgrade plan, a documented fallback strategy for the native SQLite binding, targeted automated coverage for the highest-risk upgrade surface (preload bridge at 100%, IPC handlers at 98.16%, main-process startup wiring covered), and the Store compatibility checklist. The full test suite (80 tests) passes cleanly on the baseline stack.

**Accepted carry-forwards before Phase 03 output is declared a release candidate:**

1. **Manual UI gate sign-offs (U2–U22 / M2–M22)** — accepted as carry-forward manual gates. Must be completed before any Phase 03 output is declared a release candidate. They do not block the Phase 03 upgrade sequence itself.
2. **`dateHelper.js` coverage gap** — accepted as a Phase 03 test backlog item with no associated manual gate (uncovered functions are not on the Electron upgrade hotpath).
3. **Version bumps** (Forge 7.11.1, `@electron/fuses` 2.1.1, `sqlite3` 6.0.1) — reassigned from Phase 02 to Phase 03, consistent with the strategy document statement that Phase 02 does not upgrade the runtime stack.
4. **Store-blocking items** (MSIX maker, code signing, identity alignment, data migration) — confirmed as Phase 05 scope in `phase-02-store-compatibility-checklist.md`; do not block Phase 03.

If the repo owner accepts conditions 1 and 2 above as carry-forward items (not blockers), Phase 03 may proceed.
