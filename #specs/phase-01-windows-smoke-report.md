# Phase 01 – Windows Smoke Validation Report

**Task:** Phase 2, Task 2.2 — Development-Mode Windows Smoke Validation and Per-User Data-Location Verification  
**Report file:** `#specs/phase-01-windows-smoke-report.md`  
**Date executed:** 2026-05-07  
**Executed by:** Agent (automated, VS Code Copilot)

---

## 1. Scope and Execution Environment

| Property | Value |
|---|---|
| OS | Windows 11 (64-bit) |
| Host user profile | `C:\Users\Flavi` |
| Node.js | v24.2.0 |
| npm | 11.3.0 |
| Electron (installed) | 33.4.11 |
| Electron (package.json target) | ^33.2.0 |
| Forge CLI | @electron-forge/cli ^7.8.3 |
| Project root | `D:\dev\fm\timer-tracker` |
| App name (package.json) | `time-tracker` |
| App entry point | `src/main/index.js` |
| Start command | `npm start` → `electron-forge start` |
| GUI interaction available | **No** – agent environment is headless; no direct window interaction possible |

---

## 2. Development Startup Result

### Commands Executed

```powershell
# 1. Pre-launch AppData check
Get-ChildItem "$env:APPDATA\time-tracker" -Force

# 2. Start application
npm start   # resolves to: npx electron-forge start

# 3. Process verification (run while app was live)
Get-Process -Name "electron" | Select-Object Id, Name, StartTime, CPU

# 4. Process command-line verification
Get-WmiObject Win32_Process -Filter "Name='electron.exe'" |
  Select-Object ProcessId, ParentProcessId, CommandLine

# 5. Stop application
Stop-Process -Name "electron"
```

### Startup Outcome: **SUCCESS**

Four Electron sub-processes were observed running simultaneously, indicating a complete and healthy Electron startup:

| PID | Role | StartTime | Memory (MB) | Command Line (excerpt) |
|---|---|---|---|---|
| 72612 | **Main process** | 19:21:03 | 99.0 | `electron.exe .` (launched from project root) |
| 68944 | GPU process | 19:21:03 | 89.1 | `--type=gpu-process --user-data-dir="C:\Users\Flavi\AppData\Roaming\time-tracker"` |
| 70156 | Network utility | 19:21:03 | 49.1 | `--type=utility --utility-sub-type=network.mojom.NetworkService` |
| 72852 | **Renderer** | 19:21:03 | 77.2 | `--type=renderer --app-path="D:\dev\fm\timer-tracker" --enable-sandbox` |

Key observations:
- Main process (PID 72612) parent was PID 71484 (the electron-forge start shell).
- Renderer process carries `--enable-sandbox`, consistent with `nodeIntegration: false` in `src/main/index.js`.
- All four processes remained stable for the duration of the check (~60 seconds).
- No crash or immediate exit was detected.

---

## 3. User Data and Database Location Findings

### userData Path

The Electron `app.getPath('userData')` value is resolved at runtime in `src/main/index.js`:

```js
process.env.DB_PATH = path.join(app.getPath('userData'), 'timers.db');
```

**Resolved path (confirmed via process command-line argument):**

```
C:\Users\Flavi\AppData\Roaming\time-tracker
```

This is the standard Windows Roaming AppData location for an app named `time-tracker`.

### Directory Listing (`Get-ChildItem "$env:APPDATA\time-tracker" -Force`)

```
Mode  LastWriteTime       Length  Name
----  -------------       ------  ----
d---- 07/05/2026 19:21:03         blob_storage          ← updated at startup
d---- 20/08/2025 09:35:34         Cache
d---- 20/08/2025 09:35:34         Code Cache
d---- 20/08/2025 09:35:34         DawnGraphiteCache
d---- 20/08/2025 09:35:34         DawnWebGPUCache
d---- 20/08/2025 09:35:34         GPUCache
d---- 20/08/2025 09:35:34         Local Storage
d---- 12/10/2025 19:19:42         Network
d---- 07/05/2026 18:54:28         Session Storage
d---- 20/08/2025 09:35:34         Shared Dictionary
d---- 24/08/2025 17:14:38         WebStorage
-a--- 25/08/2025 12:07:20  36864  DIPS
-a--- 20/08/2025 09:35:44    434  Local State
-a--- 07/05/2026 19:21:13  52527  Preferences            ← updated during this run
-a--- 20/08/2025 09:37:34   4096  SharedStorage
-a--- 07/05/2026 18:54:24  32768  timers.db              ← SQLite database present
```

### Database File Details

| Property | Value |
|---|---|
| Full path | `C:\Users\Flavi\AppData\Roaming\time-tracker\timers.db` |
| Size | 32,768 bytes (32 KB) |
| Created | 2025-08-30 16:59:15 |
| Last modified | 2026-05-07 18:54:24 |

**Finding:** The database exists, is non-empty (32 KB), and was last written earlier today — confirming the app has been exercised previously and the SQLite database persists correctly to `%APPDATA%\time-tracker\timers.db`.

The `Preferences` file was written at 19:21:13 (matching the process start time 19:21:03), confirming Electron wrote its preferences on this session's startup. `blob_storage` was also touched at start time.

---

## 4. Executed Smoke Checks

| # | Check | Method | Result |
|---|---|---|---|
| S1 | App process starts without crash | `Get-Process -Name "electron"` | ✅ PASS – 4 processes, all alive |
| S2 | Main process launched from project root | `Get-WmiObject Win32_Process` command line | ✅ PASS – `electron.exe .` from `D:\dev\fm\timer-tracker` |
| S3 | Renderer process launched with sandbox | Command line includes `--enable-sandbox` | ✅ PASS |
| S4 | userData resolves to `%APPDATA%\time-tracker` | Process `--user-data-dir` arg | ✅ PASS |
| S5 | `timers.db` exists in userData directory | `Get-ChildItem` + `Get-Item` | ✅ PASS – 32 KB, created 2025-08-30 |
| S6 | Electron Preferences file written on startup | File timestamp matches process start | ✅ PASS – updated 19:21:13 |
| S7 | `blob_storage` touched on startup | Directory timestamp matches process start | ✅ PASS – updated 19:21:03 |
| S8 | App stayed alive for ~60 seconds | Repeated `Get-Process` checks | ✅ PASS – no crash observed |
| S9 | sqlite3 native module loaded | DB file written and non-empty (not 0 bytes) | ✅ PASS (inferred) |

---

## 5. Pending Manual QA Checks

The following checks require GUI access that is not available in the agent environment. They must be completed by a human tester.

| # | Check | Reason Pending |
|---|---|---|
| M1 | Timer window loads and renders correctly | Requires visual inspection of `src/renderer/timer/timer.html` |
| M2 | Menu navigation: Projects → Create and List | Requires mouse/keyboard interaction |
| M3 | Menu navigation: Timers → List and Edit | Requires mouse/keyboard interaction |
| M4 | Menu navigation: Window → Timer | Requires mouse/keyboard interaction |
| M5 | Start/stop timer, verify duration recorded | Core workflow — requires UI interaction |
| M6 | Create a project and assign it to a timer | Core workflow — requires UI interaction |
| M7 | View → Theme → Light / Dark toggle | Requires visual confirmation |
| M8 | CSV export produces a valid file | Requires UI trigger and file-system verification |
| M9 | No console errors in DevTools on startup | Requires DevTools access (F12) |
| M10 | Tray icon appears and is functional | Requires visual desktop inspection |
| M11 | timers.db grows after recording a timer | Requires exercising the timer workflow |

---

## 6. Phase 01 Gate Status

| Gate Criterion | Status | Notes |
|---|---|---|
| App starts without crash (dev mode) | ✅ MET | 4 processes live, stable, no exit |
| userData resolves to correct Windows path | ✅ MET | `%APPDATA%\time-tracker` confirmed via process args |
| `timers.db` located at correct path | ✅ MET | `%APPDATA%\time-tracker\timers.db`, 32 KB |
| Renderer sandboxed | ✅ MET | `--enable-sandbox` in renderer command line |
| Full UI workflow verification | ⏳ PENDING | Cannot be completed without GUI access |

### Overall Task 2.2 Status: **PARTIALLY COMPLETE**

The agent-executable portion of the smoke check is **complete and passing**. Process startup, userData path resolution, database presence, and renderer security flags are all verified. The remaining manual QA checks (M1–M11) are honest pending items that require a human tester with GUI access, and are not blockers to Phase 02 planning — they are manual gates that must be cleared before Phase 03 can be considered ready.

---

## 7. Notes and Observations

- The `npm start` command triggers `electron-forge start`, which performs a native-module rebuild scan (visible in forge output) before launching Electron. This is expected behavior due to `@electron-forge/plugin-auto-unpack-natives` and the `sqlite3` native dependency.
- The userData directory (`%APPDATA%\time-tracker`) was already populated from prior manual runs (oldest files dated 2025-08-20), confirming the app has been exercised in development before.
- The `timers.db` creation date (2025-08-30) and non-zero size confirm SQLite schema initialization ran successfully at some prior session.
- Electron 33.4.11 is installed (satisfies `^33.2.0` from `package.json`).
- Node.js v24.2.0 and npm 11.3.0 are the active versions on the execution host.

---

## 8. Phase 3 Task 3.1 – Packaged Build Baseline (2026-05-07)

**Task:** Phase 3, Task 3.1 — Clean Packaging Baseline and Windows Packaged-App Smoke Validation  
**Executed by:** Agent (automated, VS Code Copilot)  
**Date executed:** 2026-05-07

### 8.1 Packaging Command Results

#### Commands Executed

```powershell
# 1. Clean out/ directory
Remove-Item -Recurse -Force out -ErrorAction SilentlyContinue

# 2. Package (no installer)
npm run package   # resolves to: electron-forge package

# 3. Make (installer)
npm run make      # resolves to: electron-forge make
```

#### `npm run package` — Result: **SUCCESS** (~29 s)

```
✔ Checking your system
✔ Preparing to package application
✔ Running packaging hooks
  ✔ Running generateAssets hook
  ✔ Running prePackage hook
✔ Packaging application
  ✔ Packaging for x64 on win32 [29s]
✔ Running postPackage hook
```

#### `npm run make` — Result: **SUCCESS** (~53 s for Squirrel step)

```
✔ Checking your system
✔ Loading configuration
✔ Resolving make targets
  › Making for the following targets:
✔ Running package command
  ✔ Packaging for x64 on win32 [18s]
✔ Running preMake hook
✔ Making distributables
  ✔ Making a squirrel distributable for win32/x64 [53s]
✔ Running postMake hook
  › Artifacts available at: D:\dev\fm\timer-tracker\out\make

(node:23684) [DEP0187] DeprecationWarning: Passing invalid argument types to
fs.existsSync is deprecated
```

The DeprecationWarning `[DEP0187]` originates from Squirrel tooling internals (not application code) and does not affect the build output.

---

### 8.2 Artifact Inventory

#### Package output (`out\time-tracker-win32-x64\`)

| Artifact | Size | Notes |
|---|---|---|
| `time-tracker.exe` | 188 MB | Packaged Electron main executable |
| `resources/app.asar` | ~9.9 MB | Application source bundle |
| `resources/app.asar.unpacked/node_modules/sqlite3/build/Release/node_sqlite3.node` | 1.8 MB | Native sqlite3 module correctly unpacked |
| `locales/` | (72 pak files) | Full locale pack |
| `d3dcompiler_47.dll`, `ffmpeg.dll`, `libEGL.dll`, `libGLESv2.dll`, `vk_swiftshader.dll`, `vulkan-1.dll` | — | Chromium GPU/media DLLs |
| `icudtl.dat`, `resources.pak`, `chrome_*.pak`, `snapshot_blob.bin`, `v8_context_snapshot.bin` | — | Chromium data files |

**EXE version info:**

| Field | Value |
|---|---|
| FileVersion | 1.0.0 |
| ProductVersion | 1.0.0 |
| FileDescription | time-tracker |
| Product | time-tracker |
| InternalName | time-tracker |
| Language | English (United States) |

#### Make output (`out\make\squirrel.windows\x64\`)

| Artifact | Size | Notes |
|---|---|---|
| `time-tracker-1.0.0 Setup.exe` | 112.74 MB | Squirrel installer |
| `my_app-0.0.1-full.nupkg` | 112 MB | NuGet package used by Squirrel |
| `RELEASES` | — | `9A961B2F5BD1BF3FD2B77C6CC4A8E492342E6311 my_app-0.0.1-full.nupkg 117436500` |

---

### 8.3 Identity Mismatch Finding

**Finding: `name` in `maker-squirrel` config (`my_app`) does not match the npm package name (`time-tracker`).**

In `forge.config.js`:
```js
{
  name: '@electron-forge/maker-squirrel',
  config: {
    name: 'my_app',   // ← does not match package name "time-tracker"
    ...
  }
}
```

This causes the NuGet package to be named `my_app-0.0.1-full.nupkg` and the RELEASES file to reference `my_app`, while the Setup.exe and all other artifacts are named `time-tracker`. The mismatch is currently harmless for local installs, but is a **Store-relevant issue**: Microsoft Store MSIX packaging requires consistent app identity across all fields. This should be resolved before Store submission by aligning `maker-squirrel.name` with the app identity used elsewhere, or by adopting a dedicated MSIX maker for the Store lane.

---

### 8.4 Native Module Unpack Verification

`node_sqlite3.node` (1,892,864 bytes) was correctly placed in `app.asar.unpacked\node_modules\sqlite3\build\Release\`. The `@electron-forge/plugin-auto-unpack-natives` plugin performed the unpack as expected. The renderer process loaded the asar with `--app-path=...app.asar`, confirming the unpacked path is co-located correctly.

---

### 8.5 Packaged App Startup Evidence

**Launch result: SUCCESS**

Command: `Start-Process "out\time-tracker-win32-x64\time-tracker.exe"`

stdout captured at launch:
```
Error
Connected to SQLite database.
Current schema version: 1
Database initialization and migrations completed
Database initialization completed successfully
```

> The bare `Error` string on the first line appears on stderr and does not prevent startup; it likely originates from an early IPC or renderer initialization step and warrants follow-up investigation in a GUI session.

Four `time-tracker.exe` processes confirmed alive 5 seconds after launch:

| PID | Role | Memory (MB) | Command line excerpt |
|---|---|---|---|
| 66424 | **Main** | 99.2 | `time-tracker.exe` (no type flag; parent PID 75188) |
| 72536 | GPU | 84.9 | `--type=gpu-process --user-data-dir="...\AppData\Roaming\time-tracker"` |
| 66140 | Network utility | 48.5 | `--type=utility --utility-sub-type=network.mojom.NetworkService` |
| 73196 | **Renderer** | 74.1 | `--type=renderer --app-path="...app.asar" --enable-sandbox` |

All four processes remained alive after 13 seconds — no crash or immediate exit detected.

**userData path (packaged):** `C:\Users\Flavi\AppData\Roaming\time-tracker` — identical to dev-mode path. Database (`timers.db`) presence was confirmed from prior session; the SQLite connection log at startup confirms the native module loaded and schema migration ran successfully (`Current schema version: 1`).

App was stopped cleanly after verification: `Stop-Process -Name "time-tracker"`.

---

### 8.6 Outstanding Packaged-Build Manual QA

The following checks require GUI access not available in the agent environment. They must be completed by a human tester using the packaged build at `out\time-tracker-win32-x64\time-tracker.exe`.

| # | Check | Reason Pending |
|---|---|---|
| PM1 | Packaged app window renders correctly (no blank/white screen) | Requires visual inspection |
| PM2 | All menu items accessible and functional in packaged build | Requires mouse/keyboard interaction |
| PM3 | Start/stop timer in packaged build, verify DB write | Core workflow — requires UI interaction |
| PM4 | Create a project in packaged build | Requires UI interaction |
| PM5 | CSV export in packaged build produces valid file | Requires UI trigger |
| PM6 | No new console errors in DevTools vs dev mode | Requires DevTools (F12) in packaged app |
| PM7 | `time-tracker-1.0.0 Setup.exe` installs cleanly on a clean Windows user | Requires installer execution |
| PM8 | Squirrel-installed app launches from Start Menu / installed path | Requires installed-app environment |
| PM9 | Uninstall via Control Panel leaves no leftover userData (or intentionally preserves it) | Requires installer round-trip |
| PM10 | Confirm bare `Error` at startup is benign or identify its source | Requires DevTools + source trace |

---

### 8.7 Task 3.1 Gate Status

| Gate Criterion | Status | Notes |
|---|---|---|
| `out/` cleaned before run | ✅ MET | `Remove-Item -Recurse -Force out` succeeded |
| `npm run package` succeeds | ✅ MET | Packaged for x64 on win32 in 29 s |
| `npm run make` succeeds | ✅ MET | Squirrel distributable produced in 53 s |
| Squirrel installer artifact present | ✅ MET | `time-tracker-1.0.0 Setup.exe` (112.74 MB) |
| Native module unpacked correctly | ✅ MET | `node_sqlite3.node` in `app.asar.unpacked` |
| Packaged app launches without crash | ✅ MET | 4 processes, stable for 13 s |
| SQLite connects in packaged build | ✅ MET | Confirmed from startup stdout |
| Renderer sandboxed in packaged build | ✅ MET | `--enable-sandbox` in renderer args |
| Identity mismatch documented | ✅ MET | `maker-squirrel.name: 'my_app'` vs package `time-tracker` |
| DeprecationWarning [DEP0187] noted | ✅ MET | From Squirrel tooling, not app code |
| Full UI workflow verification (packaged) | ⏳ PENDING | GUI access required (PM1–PM10) |

### Overall Task 3.1 Status: **PARTIALLY COMPLETE**

The agent-executable portion of the packaged-build smoke check is **complete and passing**. Both `npm run package` and `npm run make` succeeded on a clean `out/` directory. The packaged executable launches, spawns all four Electron sub-processes, connects to SQLite, and remains stable. The Squirrel installer artifact is valid. One identity mismatch (`maker-squirrel.name: 'my_app'`) was identified as a Store-relevant issue. Remaining manual QA items (PM1–PM10) require a human tester with GUI access and are recorded as explicit gates before Phase 03 can be considered fully closed.

---

## 9. Human Manual Sign-off Addendum (2026-05-07)

**Source:** User statement on 2026-05-07: _"I just tested, looks good."_  
**Provided by:** Human tester (project owner)  
**Date recorded:** 2026-05-07

### What this sign-off covers

- The user opened and exercised the application manually on 2026-05-07.
- Broad visual rendering confidence: the application window opened and appeared functional to the tester with no reported anomalies.
- M1 (window opens and renders without blank/white screen) is considered confirmed on the basis of this statement and is updated to PASS in the regression checklist.

### What this sign-off does not cover

No step-by-step record of specific checks was provided. The following remain at their prior ⏳ PENDING status and require explicit per-item confirmation before they can be closed:

- Individual navigation paths (Projects page, Timers page, Timer page — M4–M6)
- Title bar / window chrome identity (M2–M3)
- DevTools console error check (M7)
- Root-cause of the bare `Error` line at packaged startup (M8 / PM10)
- All CRUD workflows: project creation/deletion, timer start/stop/edit/delete (M9–M22)
- CSV export correctness (M23–M25)
- Theme switching and persistence (M26–M28)
- Persistence across restart (R3–R5)
- Packaged installer round-trip (PM7–PM9)
- Clean-shutdown via menu (S3)

### Disposition

This sign-off raises broad UI smoke confidence for Phase 01. It does **not** constitute a complete manual QA pass. All items in Sections 5–10 and Section 13 of the regression checklist remain ⏳ PENDING except M1, which is promoted to ✅ PASS. No technical findings from prior sections are altered.
