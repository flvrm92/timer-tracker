# Phase 01 – Shared Regression Checklist

**Purpose:** Phase gate for all upgrade phases (02–06). Every phase must pass every applicable item before proceeding. Manual-only items require a human tester with GUI access; they cannot be completed by the agent.

**Status values:** ✅ PASS | ❌ FAIL | ⏳ PENDING (manual) | N/A

**Last baseline captured:** 2026-05-07 (Phase 01)

---

## Section 1 — Install and Dependency Health

| # | Check | How to verify | Baseline |
|---|---|---|---|
| I1 | `npm ci` completes without error | Exit code 0; no unresolved peers | ✅ PASS (719 packages) |
| I2 | `npm ls electron sqlite3 electron-squirrel-startup @electron-forge/cli @electron-forge/maker-squirrel --depth=0` shows all resolved | All packages listed without `invalid:` prefix | ✅ PASS |
| I3 | No new deprecation warnings beyond the Phase 01 baseline list | Compare `npm ci` output against Phase 01 known deprecations | ✅ PASS (known list recorded in phase-01-baseline-report.md) |
| I4 | `npm audit` severity does not increase beyond Phase 01 baseline (47 vulns: 3 low, 7 moderate, 36 high, 1 critical) | `npm audit --json` | ✅ PASS (baseline only) |
| I5 | SSH git dependency (`node-gyp` via `ssh://git@github.com/...`) has not changed or been resolved | `npm ls` / lockfile check | ✅ PASS (documented risk, not yet resolved) |
| I6 | No new native rebuild errors during `npm ci` or `electron-forge start` | Console output scan | ✅ PASS |

---

## Section 2 — Automated Test Gate

| # | Check | How to verify | Baseline |
|---|---|---|---|
| T1 | `npm test` exits with code 0 | Jest exit code | ✅ PASS |
| T2 | No test regressions: all previously passing tests still pass | Jest summary — zero failures, zero new skips | ✅ PASS |
| T3 | Coverage does not drop below baseline thresholds | `database.js` ≥ 66 % statements, `ipcHandlers.js` ≥ 33 % statements, all-files ≥ 54 % statements | ✅ PASS (baseline) |
| T4 | `csvUtils`, `dateHelper`, `messages` utility tests all pass | Jest per-suite output | ✅ PASS |

---

## Section 3 — Dev Startup Gate

| # | Check | How to verify | Baseline |
|---|---|---|---|
| D1 | `npm start` (electron-forge start) launches without crash | 4 Electron processes visible via `Get-Process electron`; no immediate exit | ✅ PASS |
| D2 | Main process launched from project root | `Get-WmiObject Win32_Process` — CommandLine contains `electron.exe .` from `D:\dev\fm\timer-tracker` | ✅ PASS |
| D3 | Renderer process carries `--enable-sandbox` | Process command-line check | ✅ PASS |
| D4 | `userData` resolves to `%APPDATA%\time-tracker` | `--user-data-dir` in GPU process command line | ✅ PASS |
| D5 | `timers.db` present in `%APPDATA%\time-tracker` after startup | `Test-Path "$env:APPDATA\time-tracker\timers.db"` | ✅ PASS |
| D6 | App remains stable for ≥ 60 seconds (no spontaneous crash) | Repeated `Get-Process` checks | ✅ PASS |
| D7 | No new unhandled-exception or crash log written to `%APPDATA%\time-tracker` | File listing before/after startup | ✅ PASS |

---

## Section 4 — Packaged Windows Build Gate

| # | Check | How to verify | Baseline |
|---|---|---|---|
| P1 | `npm run package` exits with code 0 | Exit code; Forge output ends with `✔ Running postPackage hook` | ✅ PASS (~29 s) |
| P2 | `npm run make` exits with code 0 | Exit code; Squirrel distributable produced | ✅ PASS (~53 s) |
| P3 | `out\time-tracker-win32-x64\time-tracker.exe` exists and is ≥ 100 MB | `Get-Item` size check | ✅ PASS (188 MB) |
| P4 | `out\make\squirrel.windows\x64\time-tracker-*.*.* Setup.exe` present | `Get-ChildItem` | ✅ PASS (112.74 MB) |
| P5 | `app.asar.unpacked\node_modules\sqlite3\build\Release\node_sqlite3.node` present in package output | `Test-Path` check | ✅ PASS (1.8 MB) |
| P6 | Packaged app spawns 4 processes and stays stable for ≥ 10 seconds | `Start-Process` + `Get-Process time-tracker` after 5 s | ✅ PASS |
| P7 | Packaged app startup stdout contains `Connected to SQLite database` and `Database initialization completed successfully` | Captured stdout from launch | ✅ PASS |
| P8 | Renderer in packaged build carries `--enable-sandbox` | Process command-line check | ✅ PASS |
| P9 | `DeprecationWarning [DEP0187]` during `npm run make` is the only new warning (from Squirrel tooling — not app code) | Console output diff | ✅ PASS |
| P10 | Identity fields: `FileVersion`, `ProductVersion`, `FileDescription`, `Product` all read `1.0.0` / `time-tracker` | `(Get-Item time-tracker.exe).VersionInfo` | ✅ PASS |
| P11 | `maker-squirrel.name` identity mismatch (`my_app` vs `time-tracker`) has not silently widened | `forge.config.js` diff | ✅ PASS (documented, unchanged) |

---

## Section 5 — Startup and Navigation (Manual)

> **Manual only.** Agent environment is headless. Requires a human tester to open the app and perform visual/keyboard checks.

| # | Check | Baseline |
|---|---|---|
| M1 | App window opens and renders without blank/white screen | ✅ PASS (human, 2026-05-07) |
| M2 | Title bar or window chrome shows expected app name | ⏳ PENDING |
| M3 | Menu bar present with File / Window / View (or equivalent) items | ⏳ PENDING |
| M4 | Navigating to Timer page renders the timer UI | ⏳ PENDING |
| M5 | Navigating to Projects page renders the project list | ⏳ PENDING |
| M6 | Navigating to Timers page renders the timer list | ⏳ PENDING |
| M7 | No JavaScript console errors visible in DevTools (F12) on startup | ⏳ PENDING |
| M8 | Bare `Error` line observed in packaged startup stdout is identified as benign or root-caused | ⏳ PENDING |

> **Human sign-off note (2026-05-07):** The project owner stated "I just tested, looks good." on 2026-05-07. This confirms broad UI smoke (app rendered, no anomalies reported) and is recorded as the basis for M1 PASS above. No step-by-step record was provided; M2–M8 and all downstream manual checks remain ⏳ PENDING pending explicit per-item confirmation.

---

## Section 6 — Project Creation and Deletion (Manual)

| # | Check | Baseline |
|---|---|---|
| M9 | Create a standard (non-billable) project — project appears in the project list | ⏳ PENDING |
| M10 | Create a billable project — project appears in the project list with billable indicator | ⏳ PENDING |
| M11 | Delete a project — project is removed from the list immediately | ⏳ PENDING |
| M12 | Deleting a project does not crash or show an unhandled error | ⏳ PENDING |

---

## Section 7 — Billable Project and Timer Flow (Manual)

| # | Check | Baseline |
|---|---|---|
| M13 | Select a project and start a timer — timer begins counting | ⏳ PENDING |
| M14 | Stop the running timer — duration recorded and appears in timer list | ⏳ PENDING |
| M15 | Repeat start/stop for a billable project — billable flag preserved on the entry | ⏳ PENDING |
| M16 | No duplicate timer entries created by a single start/stop cycle | ⏳ PENDING |

---

## Section 8 — Timer Edit, Filter, and Delete (Manual)

| # | Check | Baseline |
|---|---|---|
| M17 | Open a timer entry for edit — all fields (project, start, end, notes) are editable | ⏳ PENDING |
| M18 | Save an edited entry — changes persist and are reflected in the list | ⏳ PENDING |
| M19 | Filter timers by project — list narrows to matching entries only | ⏳ PENDING |
| M20 | Filter timers by date range — list narrows to matching entries only | ⏳ PENDING |
| M21 | Delete a timer entry — entry removed from the list | ⏳ PENDING |
| M22 | `timers.db` file size grows after recording a new timer (vs pre-test size) | ⏳ PENDING |

---

## Section 9 — CSV Export (Manual)

| # | Check | Baseline |
|---|---|---|
| M23 | Trigger CSV export from the Timers page — file save dialog opens or file written to expected location | ⏳ PENDING |
| M24 | Exported CSV is valid (opens in a spreadsheet, has a header row, data rows match on-screen entries) | ⏳ PENDING |
| M25 | CSV export with an active date/project filter exports only the filtered rows | ⏳ PENDING |

---

## Section 10 — Theme Changes (Manual)

| # | Check | Baseline |
|---|---|---|
| M26 | View → Theme → Light switches the UI to light mode | ⏳ PENDING |
| M27 | View → Theme → Dark switches the UI to dark mode | ⏳ PENDING |
| M28 | Theme selection persists after app restart (preference saved to `Preferences` file) | ⏳ PENDING |

---

## Section 11 — Persistence After Restart

| # | Check | How to verify | Baseline |
|---|---|---|---|
| R1 | `timers.db` exists and is non-zero after stop/restart | `Get-Item "$env:APPDATA\time-tracker\timers.db"` — size > 0 | ✅ PASS (32 KB, confirmed) |
| R2 | Schema version remains at 1 after clean restart | Startup stdout includes `Current schema version: 1` | ✅ PASS |
| R3 | (Manual) Projects created before restart are visible after restart | ⏳ PENDING |
| R4 | (Manual) Timer entries created before restart are visible after restart | ⏳ PENDING |
| R5 | (Manual) Billable flag on projects/timers survives restart | ⏳ PENDING |

---

## Section 12 — Clean Shutdown

| # | Check | How to verify | Baseline |
|---|---|---|---|
| S1 | All Electron processes exit after `Stop-Process` (dev mode) | `Get-Process electron` returns nothing | ✅ PASS |
| S2 | All `time-tracker.exe` processes exit after `Stop-Process` (packaged) | `Get-Process time-tracker` returns nothing | ✅ PASS |
| S3 | No orphaned `electron.exe` or `time-tracker.exe` processes remain after a File → Quit or window close | ⏳ PENDING (manual) |
| S4 | `timers.db` is not locked or corrupted after clean shutdown | `Get-Item` + re-open succeeds | ✅ PASS (inferred from restart test) |

---

## Section 13 — Explicit Manual-Only Gates

The following items **cannot be completed by the agent** due to the headless environment. They must be signed off by a human tester before any phase that touches the UI, packaging, or installer can be considered fully closed.

| # | Check | Reason agent cannot complete |
|---|---|---|
| G1 | All items in Section 5 (Startup and Navigation) | No GUI/window access |
| G2 | All items in Section 6 (Project Creation/Deletion) | Requires IPC-driven UI flow |
| G3 | All items in Section 7 (Billable Project and Timer Flow) | Requires IPC-driven UI flow |
| G4 | All items in Section 8 (Timer Edit/Filter/Delete) | Requires IPC-driven UI flow |
| G5 | All items in Section 9 (CSV Export) | Requires file-save dialog or output path |
| G6 | All items in Section 10 (Theme Changes) | Requires visual confirmation |
| G7 | R3–R5 in Section 11 (Persistence — project/timer data) | Requires UI to write data before restart |
| G8 | S3 in Section 12 (Clean Shutdown via menu) | Requires File → Quit or window close |
| G9 | `time-tracker-1.0.0 Setup.exe` installs cleanly on a clean Windows user profile | Requires installer execution in isolated env |
| G10 | Squirrel-installed app launches from Start Menu / installed path | Requires installed-app environment |
| G11 | Uninstall via Control Panel — confirm userData handling (preserved or cleaned intentionally) | Requires installer round-trip |
| G12 | Packaged DevTools (F12): no new console errors vs dev-mode baseline | Requires DevTools in packaged app |

---

## Known Baseline Risks (Do Not Regress)

These are accepted Phase 01 findings. Later phases must not silently make them worse.

| Risk | Description | Phase to resolve |
|---|---|---|
| Host/embedded Node mismatch | Node 24.2.0 host vs Node ~20.18.x in Electron 33; sqlite3 rebuild must target Electron headers | Phase 04 |
| `maker-squirrel.name: 'my_app'` vs package `time-tracker` | Installer identity inconsistency; RELEASES file references wrong name | Phase 05 |
| Preload channel allowlist absent | `ipcRenderer.send/on` exposed without channel restriction | Phase 05 |
| `contextIsolation` not explicit in BrowserWindow | Modern Electron defaults to `true`, but omission is audit risk | Phase 05 |
| Duplicate hot-reload packages | `electron-reload@2.0.0-alpha.1` + `electron-reloader@1.2.3` both present, neither verified active | Phase 02 |
| Low IPC handler coverage | `ipcHandlers.js` at 25 % function coverage; save-timer, delete-timer, add-project, CSV, theme untested | Phase 02 |
| DB_PATH env ordering contract | `database.js` reads `process.env.DB_PATH` at module load; must be set before first require | Phase 02 |
| 47 npm audit vulnerabilities (1 critical) | All transitive/dev-tooling; critical requires review to confirm not reachable in packaged bundle | Phase 02/05 |
| SSH git dependency in lockfile | `node-gyp` via `ssh://github.com`; will fail in CI/Store build pipelines without SSH access | Phase 03/05 |
| Bare `Error` on packaged startup stderr | Source unknown; confirmed non-fatal but not yet traced | Phase 04 |
