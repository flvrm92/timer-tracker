# Phase 05 — Windows Packaging Readiness Checklist

Generated: 2026-05-08 (refreshed: 2026-05-08 Phase 05 T1–T7)  
Environment: Windows 11, Node.js v24.2.0, Electron 41.0.2, sqlite3 6.0.1  
Inputs: package.json, forge.config.js, Phase 04 validation report, Phase 05 spec, live command output  
Validations re-run: npm test, npm run package, npm run make, artifact inventory, Get-Process, signing check, icon check, node-gyp SSH check, npm audit --production  
T5/T6/T7 re-run: 2026-05-08 ~15:58–16:10 (all commands re-executed from clean state)

---

## Legend

| Status | Meaning |
|--------|---------|
| **PASS** | Verified correct; no action required |
| **OPEN** | Gap identified; action required before gate |
| **DEFERRED** | Not required for current lane; documented for future lane |
| **BLOCKED** | Cannot close without human action outside automated tooling |

---

## Section 1: Build Pipeline — Current Windows/Squirrel Lane

### 1.1 `npm run package`

**Command run:** `npm run package` (T6 re-run 2026-05-08 ~16:00; original T1 run ~15:30)

| Step | Result |
|------|--------|
| Checking your system | ✔ |
| Running packaging hooks (generateAssets, prePackage) | ✔ |
| Packaging for x64 on win32 [~22s] | ✔ |
| Running postPackage hook | ✔ |

**Status: PASS**

Output directory `out\time-tracker-win32-x64\` produced successfully.

---

### 1.2 `npm run make` / Squirrel Artifact Inventory

**Command:** `npm run make` then `Get-ChildItem .\out\make\squirrel.windows\x64`  
T6 re-run (2026-05-08 ~15:58); make duration ~1m10s; one `DEP0187` deprecation warning emitted by Squirrel maker toolchain (non-blocking, no artifact impact). Result unchanged from T1 baseline.

| File | Size | Timestamp | Status |
|------|------|-----------|--------|
| `RELEASES` | 83 B | 2026-05-08 15:58:48 | **PASS** |
| `time-tracker-1.0.0 Setup.exe` | 144,989,696 B (~138.3 MB) | 2026-05-08 15:58:54 | **PASS** |
| `time-tracker-1.0.0-full.nupkg` | 144,245,285 B (~137.6 MB) | 2026-05-08 15:58:47 | **PASS** |

All three required Squirrel artifacts present. Installer name aligns with `package.json` `name` and `version`. Artifact sizes are consistent with Phase 04 (~138 MB range); minor size delta is expected from a fresh rebuild.

**Status: PASS**

---

### 1.3 Native Module Packaging

`node_sqlite3.node` is present in `out\time-tracker-win32-x64\resources\app.asar.unpacked\node_modules\sqlite3\build\Release\` (~1.9 MB), rebuilt against Electron 41.0.2 (ABI 145) by `plugin-auto-unpack-natives`.

**Status: PASS**

---

### 1.4 Packaged EXE Startup

Packaged EXE (`out\time-tracker-win32-x64\time-tracker.exe`) starts successfully. Four-process Electron tree observed. SQLite initialization log:
```
Connected to SQLite database.
Current schema version: 1
Database initialization and migrations completed
Database initialization completed successfully
```

**Status: PASS** (T6 re-run 2026-05-08: 4-process Electron tree confirmed via `Get-Process time-tracker`; SQLite initialization log identical to Phase 04/T1 baseline)

---

### 1.5 Automated Test Suite

**Command:** `npx jest --runInBand` (Phase 05 T1 re-run, 2026-05-08)

| Suite | Tests | Result |
|-------|-------|--------|
| `database.test.js` | 17 | PASS |
| `ipcHandlers.test.js` | 30 | PASS |
| `main.index.test.js` | 18 | PASS |
| `preload.test.js` | 11 | PASS |
| `csvUtils.test.js` | 6 | PASS |
| **Total** | **82** | **PASS** |

Duration: ~1s. Two new tests added in Phase 05 T4 (`main.index.test.js`: Squirrel startup guard).

**Status: PASS** — 82/82 tests pass (T6 re-run 2026-05-08 confirmed), no packaging-related regression.

---

### 1.6 `npm ci` (Strict Install)

Completes successfully with one integrity-skip warning for the SSH-resolved `@electron/node-gyp` entry (see Section 4.1). All packages install deterministically.

**Status: PASS**

---

## Section 2: Packaging Identity and Asset Review

### 2.1 Package Name and Version Alignment

| Location | Field | Value | Aligned |
|----------|-------|-------|---------|
| `package.json` | `name` | `time-tracker` | — |
| `package.json` | `version` | `1.0.0` | — |
| `forge.config.js` maker | `name` | `time-tracker` | ✔ |
| Produced installer | filename | `time-tracker-1.0.0 Setup.exe` | ✔ |
| Produced installer | RELEASES | `time-tracker-1.0.0-full.nupkg` | ✔ |

**Status: PASS** — identity is consistent across all layers for the current Squirrel lane.

---

### 2.2 `productName` Configuration

`forge.config.js` does not set `packagerConfig.productName`. The application window title and process name default to the `name` field (`time-tracker`). For distribution quality the product name should be a human-readable string (e.g. `Time Tracker`).

**Status: OPEN**  
_Action: Add `productName: 'Time Tracker'` to `packagerConfig` in `forge.config.js`._  
_Risk: Changing `productName` does not affect `app.getPath('userData')` because Electron resolves userData from the `name` field, not `productName`. Safe to add without data migration risk._

---

### 2.3 Icon Assets

**Command:** `Get-ChildItem . -Recurse -Include *.ico,*.png,*.jpg,*.jpeg`

No `.ico` or application icon file was found anywhere in the project source tree (only tooling artifacts in `coverage/` and `node_modules/`). `forge.config.js` has no `icon` key in `packagerConfig` and no `setupIcon` in the Squirrel maker config.

| Asset | Status |
|-------|--------|
| Application `.ico` file | Missing |
| `packagerConfig.icon` in forge.config.js | Not set |
| `makers[squirrel].config.setupIcon` | Not set |

Without an icon the packaged EXE and installer use Electron's default icon.

**Status: OPEN**  
_Action: Create a 256×256 (minimum) `.ico` file, place it in the project (e.g. `assets/icons/icon.ico`), and set `packagerConfig.icon` and Squirrel maker `setupIcon` accordingly._  
_Required before Store submission; recommended before any public Squirrel release._

**T5 assessment (2026-05-08):** No `.ico` file found anywhere in the project source tree (`Get-ChildItem -Recurse -Include *.ico` returned no results outside `node_modules`/`out`). `forge.config.js` contains no `icon` or `setupIcon` keys (only a comment). No packaging or configuration changes have been made this task. Item remains **OPEN/DEFERRED** pending a dedicated icon-creation task.

---

### 2.4 Squirrel Maker Metadata

| Field | Value | Status |
|-------|-------|--------|
| `name` | `time-tracker` | PASS |
| `authors` | `['Flavio Moreno @flvrm92']` | PASS |
| `description` | `A simple timer tracker` | PASS |

Metadata is present and non-default.

---

### 2.5 Code Signing

**Command:** `Get-AuthenticodeSignature '.\out\make\squirrel.windows\x64\time-tracker-1.0.0 Setup.exe'` (T6 re-run, 2026-05-08 15:58 artifacts)

| Artifact | Status (PowerShell) | SignerCertificate | Status |
|----------|-------------------|------------------|--------|
| `time-tracker-1.0.0 Setup.exe` | NotSigned | None | **NotSigned** |
| `time-tracker.exe` | NotSigned | None | **NotSigned** |

Both the packaged EXE and Squirrel installer are unsigned.

**Status: OPEN**  
_Impact (Squirrel lane):_ Windows SmartScreen will display an "Unknown publisher" prompt on first run of the installer. The app will launch but users must click through a warning. For internal/developer use this is acceptable; for public release or Store submission it is a hard requirement.  
_Action: Obtain an Extended Validation (EV) or standard code signing certificate, configure `packagerConfig.osxSign` equivalent (`win.certificateFile`/`win.certificatePassword` or `signWithParams`) in `forge.config.js` before any public release. This is a pre-Store gate._

**T5 assessment (2026-05-08):** No certificate file (`.p12`, `.pfx`, `.pem`, `.crt`, `.cer`) found anywhere in the project tree. No `certificateFile`, `signWithParams`, or equivalent signing keys are present in `forge.config.js`. No configuration changes have been made this task. Item remains **OPEN** pending certificate acquisition.

---

## Section 3: Storage, Data, and Security Review

### 3.1 Database Storage Location

```javascript
// src/main/index.js
process.env.DB_PATH = path.join(app.getPath('userData'), 'timers.db');
```

Database is stored in `%APPDATA%\time-tracker\timers.db` (the per-user `userData` path). This is the correct Windows-friendly per-user location. No admin elevation is required.

**Status: PASS**

---

### 3.2 CSV Export — User-Selected Path

```javascript
// src/main/ipcHandlers.js
const result = await dialog.showSaveDialog({ ... });
```

CSV export uses `dialog.showSaveDialog`, giving the user explicit path control. No background file writes to arbitrary locations occur.

**Status: PASS**

---

### 3.3 No Admin Elevation Required

The Squirrel installer performs per-user installation (installs to `%LOCALAPPDATA%\<appname>`). The application uses `app.getPath('userData')` for persistence. No registry writes outside HKCU or system-level operations are performed.

**Status: PASS**

---

### 3.4 Electron Security Configuration (Fuses)

| Fuse | Setting | Status |
|------|---------|--------|
| `RunAsNode` | `false` | PASS |
| `EnableCookieEncryption` | `true` | PASS |
| `EnableNodeOptionsEnvironmentVariable` | `false` | PASS |
| `EnableNodeCliInspectArguments` | `false` | PASS |
| `EnableEmbeddedAsarIntegrityValidation` | `true` | PASS |
| `OnlyLoadAppFromAsar` | `true` | PASS |

**Status: PASS**

---

### 3.5 Renderer Security Configuration

| Setting | Value | Status |
|---------|-------|--------|
| `contextIsolation` | `true` | PASS |
| `nodeIntegration` | `false` (default) | PASS |
| `devTools` | `!app.isPackaged` (disabled in package) | PASS |

**Status: PASS**

---

### 3.6 `electron-squirrel-startup` — Unused Runtime Dependency

`electron-squirrel-startup@1.0.1` is listed as a `dependency` in `package.json` and is bundled into the packaged `app.asar`. As of Phase 05 T4 it is imported and active: `require('electron-squirrel-startup')` is called as the first statement after imports in `src/main/index.js`, short-circuiting the process before any app bootstrap fires when a Squirrel install/update/uninstall event is detected.

**Status: PASS** (Phase 05 T4)  
_Resolution: Wired `require('electron-squirrel-startup')` at the top of `src/main/index.js`. Squirrel lifecycle events (install, update, uninstall) now call `app.quit()` and exit before normal bootstrap. Two new tests in `tests/main.index.test.js` cover both the short-circuit path (squirrel returns true → `app.quit` called) and the normal path (squirrel returns false → no quit)._

---

## Section 4: Residual Risks Carried Forward from Phase 04

### 4.1 SSH `@electron/node-gyp` in `package-lock.json`

**Command (T6 re-run 2026-05-08):** `Select-String -Path .\package-lock.json -Pattern 'node-gyp'`

Confirmed still present: line 1396 (`node_modules/@electron/node-gyp`), line 1398 (`resolved: git+ssh://git@github.com/electron/node-gyp.git#06b29aab...`), line 1579 (spec reference).

`@electron/rebuild@3.7.2` (via `@electron-forge/core-utils@7.11.1`) resolves `@electron/node-gyp` from a git+ssh URL pinned to commit `06b29aab...` rather than a published npm registry version. `npm ci` emits an integrity-skip warning but completes successfully.

| Property | Value |
|----------|-------|
| Scope | devDependency only — not bundled in packaged app |
| Risk | Supply-chain (compromised commit not detected by integrity check) |
| Severity | Medium |
| Remediation | Upgrade Forge to a version that resolves `@electron/node-gyp` from npm registry |

**Status: OPEN** (carry-forward from Phase 04; still present as of Phase 05 T1; medium risk accepted)

---

### 4.2 Production Dependency Audit

**Command (T6 re-run 2026-05-08):** `npm audit --production`

```
tar-fs  2.0.0 - 2.1.3
Severity: high
tar-fs has a symlink validation bypass if destination directory is predictable
with a specific tarball — GHSA-vj76-c3g6-qr5v
node_modules/tar-fs  (pulled by sqlite3@6.0.1)
1 high severity vulnerability
```

`tar-fs` is a transitive dependency of `sqlite3@6.0.1`; it is used during binary download/install-time operations, not by the sqlite3 runtime itself. The packaged `app.asar.unpacked` contains only `node_sqlite3.node`; `tar-fs` is not present in the packaged artifact. Fix is available via `npm audit fix`; not yet applied (risk of breaking native build not assessed).

| Property | Value |
|----------|-------|
| Advisory | GHSA-vj76-c3g6-qr5v |
| Affected package | tar-fs 2.0.0–2.1.3 |
| Pull chain | `sqlite3@6.0.1` → `tar-fs@2.1.3` |
| Exploitable in packaged app? | No — tar-fs used only during sqlite3 install, not at runtime |
| Severity | High (npm advisory classification); Low practical runtime risk |
| Fix available | `npm audit fix` (may bump sqlite3 dependencies) |

**Status: OPEN**  
_Action: Assess whether `npm audit fix` resolves tar-fs without breaking sqlite3 native build. If not, evaluate sqlite3 patch release that pins a fixed tar-fs version. This item should be resolved before public Squirrel release._

---

### 4.3 `DEP0187` Deprecation Warning

Node.js `DEP0187` (`fs.existsSync` invalid argument types) warning emitted by the Squirrel maker toolchain during `npm run make`. This is a non-blocking Squirrel maker issue; it does not affect produced artifacts.

**Status: OPEN** (low; no artifact impact; carry-forward until Forge or Squirrel maker update resolves it)

---

### 4.4 Dead Menu Code (Minor)

`src/main/index.js` calls `Menu.setApplicationMenu(null)` synchronously at module load time under the `if (app.isPackaged)` guard. Because `app.whenReady().then(() => createWindow())` fires asynchronously after module load and `createWindow()` itself calls `Menu.setApplicationMenu(menu)`, the null-set has no runtime effect. This is dead code.

Additionally, the "Toggle DevTools" menu item remains visible in packaged builds even though `devTools: !app.isPackaged` prevents DevTools from opening.

**Status: OPEN** (low severity; no packaging blocker; documented for cleanup)

---

## Section 5: Human-Gated Blocker — Packaged GUI Smoke

**T7 documentation gate — recorded 2026-05-08.** This section is the formal manual gate required before Phase 05 can be considered closed. It was established as T7 documentation during the Phase 05 T5–T7 run (2026-05-08). No automated tooling can substitute for these interactive GUI checks.

**⚠ Phase 05 closed as CONDITIONAL PASS (automated validation complete; manual smoke not yet performed). This gate has been carried forward into Phase 06 as a hard RC approval gate (T06-4). Phase 06 RC approval is blocked until a human tester completes and signs off items 1–10 below.**

The following functional smoke tests require an interactive GUI session against the packaged build (`out\time-tracker-win32-x64\time-tracker.exe`) and cannot be automated by any tooling currently in the project.

| # | Item | Priority | Status |
|---|------|----------|--------|
| 1 | Create a billable project and a non-billable project | High | **BLOCKED** |
| 2 | Start and stop a timer for each project type | High | **BLOCKED** |
| 3 | Verify `amount_earned` populates for billable timers; null for non-billable | High | **BLOCKED** |
| 4 | Edit a timer start/end time; confirm duration recalculates | High | **BLOCKED** |
| 5 | Filter timers by project and by date range | Medium | **BLOCKED** |
| 6 | Export filtered timers to CSV; inspect file contents | Medium | **BLOCKED** |
| 7 | Restart the app; confirm persisted data survives | High | **BLOCKED** |
| 8 | Switch themes (light / dark / system); confirm rendering | Low | **BLOCKED** |
| 9 | Run Phase 01 regression checklist end-to-end on packaged build | High | **BLOCKED** |
| 10 | Install `time-tracker-1.0.0 Setup.exe` on a clean Windows machine | Medium | **BLOCKED** |

Items 1–9: run against packaged EXE.  
Item 10: validates the Squirrel installer flow (shortcut creation, per-user install path, uninstall).

**Status: BLOCKED — human tester required**

---

## Section 6: Future Microsoft Store / MSIX Lane Readiness

**Phase 05 scope decision:** The current release lane is **Windows/Squirrel only**. MSIX packaging and Microsoft Store submission are explicitly **out of scope for Phase 05**. No MSIX-specific code, tooling, or configuration changes will be introduced in this phase. The Squirrel lane must be fully gated (Sections 1–5 complete, human smoke test signed off) before any Store-lane work begins.

**Later Store-specific work (deferred to a future phase):**

These items are not required for the current Squirrel lane but must be resolved before any Store submission.

| ID | Item | Resolution | Status |
|----|------|-----------|--------|
| MS-1 | MSIX maker | `@electron-forge/maker-msix` 7.11.2 (`maker-appx` is deprecated upstream; the winapp-CLI route was the alternative considered) | **DONE** |
| MS-2 | Publisher identity for MSIX manifest | `packaging/identity.json` is the single source; substituted into the manifest at build time. No certificate needed — the Store re-signs submitted MSIX packages with a Microsoft certificate | **DONE** (real Partner Center values still to be filled in) |
| MS-3 | Four-part Store version (`1.0.0.0`) | `forge.config.js` `storeVersion()` widens `package.json` semver; rejects a leading 0 | **DONE** |
| MS-4 | `electron-squirrel-startup` removal | Dependency and its require removed along with `maker-squirrel` | **DONE** |
| MS-5 | `userData` path migration strategy | `importLegacyDatabase()` in `src/main/index.js` copies a pre-MSIX `%APPDATA%\time-tracker\timers.db` on first run. Idempotent, non-fatal, covered by 6 tests. `packagerConfig.name` deliberately unset so `app.getName()` stays `time-tracker` | **DONE** |
| MS-6 | Auto-update strategy | Store-only lane. Squirrel dropped; the Store update pipeline delivers new versions and the app carries no self-update code | **DONE** |
| MS-7 | Store listing metadata | Category, age rating, screenshots and submission fields documented in the Releasing section of README.md | **DONE** (submission itself pending a Partner Center account) |
| MS-8 | Privacy policy and permissions | `runFullTrust` is the only declared capability. App is fully local: no network calls, no telemetry (verified by grep across `src/`). Policy written to `PRIVACY.md` | **DONE** (URL live once the repo is public) |
| MS-9 | MSIX-compatible icon set | `packaging/icon.svg` + `scripts/generate-icons.js` produce all 12 visual assets and a multi-resolution `icon.ico` | **DONE** |

**Remaining Store blockers:** the Windows SDK must be installed to run `makeappx` (`winget install --id Microsoft.WindowsSDK.10.0.26100`, needs elevation); a Partner Center account and reserved app name are needed to fill in `packaging/identity.json`; the packaged-GUI smoke test (Section 5) is still unperformed; and `PRIVACY.md` needs a public URL (the repo must be public, or the policy hosted elsewhere).

> **Update (2026-08-18):** The Squirrel lane has been retired. Distribution is now Microsoft Store / MSIX only. See the Releasing section of README.md.

---

## Section 7: Summary — Gate Recommendation

### Current Windows/Squirrel Lane

| # | Check | Status |
|---|-------|--------|
| 1 | `npm run package` succeeds | **PASS** |
| 2 | Squirrel artifacts produced (`RELEASES`, Setup.exe, .nupkg) | **PASS** |
| 3 | `node_sqlite3.node` in `app.asar.unpacked` | **PASS** |
| 4 | Packaged EXE starts; SQLite initializes | **PASS** |
| 5 | 82/82 unit tests pass | **PASS** |
| 6 | `npm ci` strict install | **PASS** |
| 7 | Package identity aligned (name/version/maker/artifact) | **PASS** |
| 8 | Storage in per-user `userData`; no admin elevation | **PASS** |
| 9 | CSV export via `showSaveDialog` (explicit user path) | **PASS** |
| 10 | Security fuses hardened | **PASS** |
| 11 | `contextIsolation: true`, `nodeIntegration: false` | **PASS** |
| 12 | `productName` not set (display name defaults to `time-tracker`) | **OPEN** |
| 13 | Application icon (`.ico`) missing; `packagerConfig.icon` not set | **OPEN** |
| 14 | Code signing: both EXE and installer unsigned | **OPEN** |
| 15 | `electron-squirrel-startup` wired; Squirrel lifecycle events short-circuit before bootstrap | **PASS** |
| 16 | tar-fs@2.1.3 production advisory (GHSA-vj76-c3g6-qr5v via sqlite3) | **OPEN** |
| 17 | SSH `@electron/node-gyp` in lockfile | **OPEN** |
| 18 | DEP0187 warning in make | **OPEN** (low) |
| 19 | Dead menu code (`Menu.setApplicationMenu(null)`) | **OPEN** (low) |
| 20 | Packaged GUI smoke (9 interactive items) | **BLOCKED — Phase 06 hard RC gate (T06-4)** |

### Recommendation

**CONDITIONAL PASS — Phase 05 automated validation complete (T6, 2026-05-08). T5: no packaging polish changes justified; no `.ico` asset and no signing cert are present so those items remain OPEN/DEFERRED without config changes. T7: manual smoke gate documented (Section 5). Phase 05 closed as CONDITIONAL PASS; manual packaged GUI smoke was not performed. Phase 06 has started; RC approval is blocked until Section 5 is signed off by a human tester.**

The automated pipeline is sound: packaging, making, native module loading, and all tests pass. The following gates remain open:

1. **BLOCKED — Phase 06 hard RC approval gate (T06-4):** Human packaged GUI smoke (Section 5, items 1–10) has not been completed. Phase 06 RC cannot be approved until a human tester signs off all items in Section 5.
2. **OPEN (recommended before public release):** Code signing (Section 2.5).
3. **OPEN (recommended before public release):** Application icon (Section 2.3).
4. **OPEN (security):** tar-fs production audit advisory resolved (Section 4.2).
5. ~~**OPEN (correctness):** `electron-squirrel-startup` status clarified~~ — **RESOLVED** (Phase 05 T4): wired into `src/main/index.js`.

**Phase 06 carry-forward (T06-4):** The packaged GUI smoke (Section 5) was not completed during Phase 05. It is now a hard approval gate in Phase 06. RC approval will not be granted until a human tester completes and signs off items 1–10 in Section 5. Store/MSIX work may proceed in planning only until the Squirrel lane is fully gated.
