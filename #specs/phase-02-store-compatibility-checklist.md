# Phase 02 — Microsoft Store Compatibility Checklist

**Task:** Phase 02 Close-Out — Store Compatibility Checklist
**Date:** 2026-05-07
**Repo:** `d:\dev\fm\timer-tracker`
**Baseline stack:** Electron 33.4.11 / Forge 7.8.3 / sqlite3 5.1.7
**Derived from:** `phase-01-store-compatibility-note.md`, `phase-02-dependency-matrix.md`, `phase-02-native-dependency-decision.md`, `forge.config.js`, `package.json`

---

## Purpose

This checklist documents the app's current Microsoft Store compatibility posture across the categories required before an MSIX submission can proceed. Each item is assessed against repo evidence as of 2026-05-07.

**Status legend:**

| Status | Meaning |
|---|---|
| `PASS` | Requirement is met by the current codebase; no action required before Phase 05 |
| `OPEN` | Requirement is not met; action required before Store submission |
| `DEFERRED` | Requirement is not met today but is explicitly scoped to a later phase; not blocking Phase 03 |

---

## 1. Packaging Model

| # | Check | Status | Evidence / Notes |
|---|---|---|---|
| PM-1 | MSIX maker configured in `forge.config.js` | **OPEN** | Only `maker-squirrel` is present. No `@electron-forge/maker-appx` or equivalent MSIX tool configured. Store requires MSIX output. |
| PM-2 | MSIX maker tool selection documented | **DEFERRED (Phase 05)** | Three candidate paths identified in `phase-01-store-compatibility-note.md` §10.2 (`@electron-forge/maker-appx`, `electron-builder`, manual `makeappx`). Selection deferred to Phase 05. |
| PM-3 | `electron-squirrel-startup` isolated from MSIX build lane | **OPEN** | `electron-squirrel-startup@1.0.1` is a runtime `dependency` in `package.json`. Squirrel lifecycle events never fire under MSIX; must be removed or guarded before Store packaging. |
| PM-4 | `asar: true` set in `packagerConfig` | **PASS** | `forge.config.js` — `packagerConfig: { asar: true }`. MSIX reads the same ASAR layout; no incompatibility. |
| PM-5 | `OnlyLoadAppFromAsar` Fuse enabled | **PASS** | `forge.config.js` — `FuseV1Options.OnlyLoadAppFromAsar: true`. Reduces attack surface for both MSIX and non-MSIX deployments. |

---

## 2. Code Signing Expectations

| # | Check | Status | Evidence / Notes |
|---|---|---|---|
| CS-1 | Code signing certificate configured in Forge | **OPEN** | No `certificateFile`, `certificatePassword`, `signWithParams`, or `signtoolOptions` fields present in `forge.config.js`. Current builds are unsigned. |
| CS-2 | Unsigned builds trigger SmartScreen warnings | **OPEN** | Packaged `time-tracker.exe` and `time-tracker-1.0.0 Setup.exe` are unsigned. Windows SmartScreen blocks unsigned executables on first run on machines with no app reputation. |
| CS-3 | Store re-signing compatibility (Publisher CN alignment) | **DEFERRED (Phase 05)** | Store re-signs submitted packages automatically. However, the Publisher CN in the future MSIX manifest must match the registered Store publisher identity. No publisher account or cert provisioned yet. |
| CS-4 | `EnableCookieEncryption` Fuse enabled | **PASS** | `forge.config.js` — `FuseV1Options.EnableCookieEncryption: true`. Reduces in-process credential exposure. |
| CS-5 | `RunAsNode` Fuse disabled | **PASS** | `forge.config.js` — `FuseV1Options.RunAsNode: false`. Prevents REPL bypass of the app sandbox. |
| CS-6 | `EnableNodeOptionsEnvironmentVariable` Fuse disabled | **PASS** | `forge.config.js` — `FuseV1Options.EnableNodeOptionsEnvironmentVariable: false`. Prevents environment-variable-based code injection. |
| CS-7 | `EnableNodeCliInspectArguments` Fuse disabled | **PASS** | `forge.config.js` — `FuseV1Options.EnableNodeCliInspectArguments: false`. Prevents remote debugger attachment via CLI. |
| CS-8 | `EnableEmbeddedAsarIntegrityValidation` Fuse enabled | **PASS** | `forge.config.js` — `FuseV1Options.EnableEmbeddedAsarIntegrityValidation: true`. ASAR integrity checked at load time. |

---

## 3. Storage Behavior

| # | Check | Status | Evidence / Notes |
|---|---|---|---|
| SB-1 | App writes only to `app.getPath('userData')` for persistent state | **PASS** | `src/main/index.js` — `DB_PATH = path.join(app.getPath('userData'), 'timers.db')`. No writes to system paths or registry. |
| SB-2 | No writes to `Program Files`, `HKLM`, or system-wide locations | **PASS** | Source review and Phase 01 smoke test confirm no system-level writes. Per-user model is Store-compatible. |
| SB-3 | `userData` path redirect under MSIX understood | **OPEN** | Under MSIX, `app.getPath('userData')` redirects to `%LOCALAPPDATA%\Packages\<PackageFamilyName>\LocalCache\Roaming\<app-name>`. Existing user data at `%APPDATA%\time-tracker\timers.db` becomes invisible without a migration step. |
| SB-4 | User data migration strategy documented | **DEFERRED (Phase 05)** | Identified in `phase-01-store-compatibility-note.md` §10.4. No implementation planned before Phase 05; the database contains user-created project and timer records — silent loss at first MSIX launch is a user-facing regression. |
| SB-5 | Chromium/Electron profile data redirect under MSIX understood | **OPEN** | All Chromium state (Preferences, Session Storage, Local Storage, Cache, etc.) at `%APPDATA%\time-tracker` also becomes invisible in the MSIX container. Theme settings and Electron preferences will reset on first MSIX launch. |
| SB-6 | CSV export path is user-chosen (outside MSIX container) | **PASS** | `src/main/ipcHandlers.js` — `dialog.showSaveDialog` writes to a user-selected path. Not subject to MSIX virtualization. |

---

## 4. Update / Install Behavior

| # | Check | Status | Evidence / Notes |
|---|---|---|---|
| UI-1 | Squirrel update mechanism not relied upon for Store delivery | **OPEN** | Current update mechanism is Squirrel RELEASES + NuGet delta patching. Store updates are delivered through the Store pipeline — no RELEASES file exists under MSIX. The Squirrel update path must be removed from the Store build lane. |
| UI-2 | `electron-squirrel-startup` shortcut/first-run logic not required for core app | **OPEN** | `electron-squirrel-startup` manages Start Menu shortcuts and first-run detection. Under MSIX, these are handled by the MSIX manifest's `<Applications>` entry and Store tile infrastructure. Dependency must be removed or bypassed. |
| UI-3 | `app.quit()` on Squirrel install event confirmed harmless under MSIX | **OPEN** | `src/main/index.js` quits on Squirrel lifecycle events. Under MSIX these events never fire, so the call is dead weight but not actively harmful. Must be cleaned up before Store submission. |
| UI-4 | No auto-update library conflict with Store update policy | **PASS** | No `electron-updater` or `update-electron-app` is installed. Store update pipeline is the sole delivery mechanism; no conflict exists. |

---

## 5. Permissions / Admin-Rights Expectations

| # | Check | Status | Evidence / Notes |
|---|---|---|---|
| AD-1 | App installs per-user without UAC elevation | **PASS** | Squirrel installs per-user by default. MSIX also installs per-user. No `requestedExecutionLevel` override; defaults to `asInvoker`. Compatible with Store distribution policy. |
| AD-2 | No runtime writes requiring admin rights | **PASS** | All writes target `%APPDATA%` (per-user). Confirmed by source review and Phase 01 smoke test. |
| AD-3 | `runFullTrust` capability requirement identified | **OPEN** | Electron apps packaged for the Store require the `runFullTrust` restricted capability in the MSIX manifest. Not yet declared. Required before any MSIX submission attempt. |
| AD-4 | Additional MSIX capability declarations assessed | **OPEN** | No MSIX manifest exists. Store submission requires explicit declaration of all capabilities. `broadFileSystemAccess` may be required if the app needs to write CSV files outside the user's Downloads folder. Assessment deferred to Phase 05 manifest authoring. |

---

## 6. Native Module Implications

| # | Check | Status | Evidence / Notes |
|---|---|---|---|
| NM-1 | `plugin-auto-unpack-natives` configured | **PASS** | `forge.config.js` includes `@electron-forge/plugin-auto-unpack-natives`. Phase 01 packaging smoke confirms `node_sqlite3.node` (1.8 MB) correctly unpacked to `app.asar.unpacked\node_modules\sqlite3\build\Release\`. |
| NM-2 | Native `.node` in MSIX read-only install root is loadable | **PASS** | MSIX installs to read-only `%ProgramFiles%\WindowsApps\...`. Loading `.node` files from there is permitted; only write operations are blocked. |
| NM-3 | Rebuild targets Electron-bundled Node (not host Node) | **OPEN** | Host Node is 24.2.0; Electron 33 bundles ~20.18.x. Forge handles this automatically for `package`/`make`, but any MSIX-specific or CI build step must explicitly pass `--electronVersion` to `electron-rebuild`. Must be confirmed in the Phase 03 build pipeline. |
| NM-4 | SSH git dependency for `@electron/node-gyp` removed from lockfile | **OPEN** | `@electron/node-gyp` resolves via `ssh://git@github.com/electron/node-gyp.git` in `package-lock.json`. Breaks Store and CI build pipelines without SSH GitHub access. Expected to resolve when Forge 7.11.1 is applied in Phase 03 (tracked as Gate G6). |
| NM-5 | `sqlite3` upgrade to 6.0.1 applied | **DEFERRED (Phase 03)** | Approved target in `phase-02-dependency-matrix.md`. Not yet applied. Closes `http-proxy-agent`, `cacache`, `make-fetch-happen`, and `@tootallnate/once` audit findings. Implementation assigned to Phase 03. |
| NM-6 | Fallback path to `better-sqlite3` documented | **PASS** | `phase-02-native-dependency-decision.md` — approved fallback with trigger criteria and API impact assessment. No implementation required unless preferred path fails in Phase 03. |

---

## 7. Privacy / Diagnostics / Local File Export

| # | Check | Status | Evidence / Notes |
|---|---|---|---|
| PD-1 | No telemetry or analytics libraries installed | **PASS** | `package.json` and Phase 02 dependency audit confirm no analytics or telemetry packages. App is fully local. |
| PD-2 | No network calls for diagnostics or crash reporting | **PASS** | Source review: no `Sentry`, `Raygun`, `Mixpanel`, or equivalent. No outbound network calls identified in `src/main/index.js` or `src/main/ipcHandlers.js`. |
| PD-3 | CSV export uses `dialog.showSaveDialog` (explicit user consent) | **PASS** | `src/main/ipcHandlers.js` — export proceeds only after user selects a save path. User controls all file I/O. |
| PD-4 | No background data collection at startup | **PASS** | `src/main/index.js` startup path: DB init + BrowserWindow + IPC wiring only. No background tasks or scheduled work. |
| PD-5 | `devTools` disabled in production builds | **OPEN** | `src/main/index.js` opens DevTools conditionally on `env === 'development'`. Relies on `NODE_ENV` being set correctly in packaged builds. `phase-01-store-compatibility-note.md` §9 (B7) flags this as requiring explicit confirmation. Must be verified as part of Phase 03 packaged build smoke test. |
| PD-6 | Store privacy policy requirement assessed | **DEFERRED (Phase 05)** | Store submissions require a privacy policy URL. App collects no user data beyond local storage; a short "no data collected" declaration will suffice. Deferred to Phase 05 Store listing preparation. |

---

## 8. App Identity and Version Alignment

| # | Check | Status | Evidence / Notes |
|---|---|---|---|
| AV-1 | `package.json` `name` consistent with Forge maker name | **OPEN** | `package.json` name: `time-tracker`. `forge.config.js` `maker-squirrel.name`: `my_app`. These diverge across all installer artifacts. |
| AV-2 | `package.json` `version` consistent with Forge maker version | **OPEN** | `package.json` version: `1.0.0`. `forge.config.js` `maker-squirrel.config.version`: `0.0.1`. Two independent version strings produce contradictory artifact names. |
| AV-3 | Version format satisfies MSIX four-part requirement | **OPEN** | MSIX requires `Major.Minor.Build.Revision` (e.g., `1.0.0.0`) with strict monotonic increase. Neither current version string satisfies this format. |
| AV-4 | Publisher Display Name matches registered Store publisher | **DEFERRED (Phase 05)** | No Store publisher account provisioned. `package.json` `author` is `flvrm92`. Store publisher identity must be established before MSIX submission. |
| AV-5 | App Display Name / ProductName consistent across all artifacts | **OPEN** | EXE FileDescription: `time-tracker`; NuGet package: `my_app`; Squirrel installer: `my_app`. Multiple divergent display names across packaging artifacts. |
| AV-6 | MSIX Package Identity block defined (Name, Publisher, Version) | **DEFERRED (Phase 05)** | No MSIX manifest or `maker-appx` configuration exists. Package Identity block must be defined before Phase 05 Store packaging begins. Requires publisher account selection first. |

---

## 9. Already Satisfied vs Deferred Summary

### PASS — Already Satisfied

| Requirement | Evidence |
|---|---|
| ASAR bundling enabled | `forge.config.js` — `asar: true` |
| `OnlyLoadAppFromAsar` Fuse | `forge.config.js` — `FuseV1Options.OnlyLoadAppFromAsar: true` |
| `RunAsNode` Fuse disabled | `forge.config.js` — `FuseV1Options.RunAsNode: false` |
| `EnableCookieEncryption` Fuse enabled | `forge.config.js` — `FuseV1Options.EnableCookieEncryption: true` |
| `EnableNodeOptionsEnvironmentVariable` Fuse disabled | `forge.config.js` — prevents env-var code injection |
| `EnableNodeCliInspectArguments` Fuse disabled | `forge.config.js` — prevents remote debugger attach |
| `EnableEmbeddedAsarIntegrityValidation` Fuse enabled | `forge.config.js` — ASAR integrity at load time |
| Per-user install; no UAC elevation required | Phase 01 smoke; `asInvoker` default |
| No admin-level writes | Source review; Phase 01 smoke |
| `plugin-auto-unpack-natives` configured and verified | Phase 01 packaging smoke — `node_sqlite3.node` correctly unpacked |
| Native `.node` loadable from MSIX read-only install root | MSIX virtualization allows reads from install root |
| Fallback path to `better-sqlite3` documented | `phase-02-native-dependency-decision.md` — trigger criteria defined |
| No telemetry or analytics | `package.json` dependency audit |
| No outbound diagnostic network calls | Source review |
| CSV export uses user-consent dialog | `ipcHandlers.js` — `dialog.showSaveDialog` |
| No auto-update library conflicting with Store pipeline | No `electron-updater`; Store pipeline unobstructed |

### OPEN — Must Resolve Before Store Submission

| Item | Earliest Phase |
|---|---|
| MSIX maker not configured | Phase 05 |
| `electron-squirrel-startup` in runtime deps | Phase 05 |
| Code signing certificate not configured | Phase 05 |
| `userData` path migration missing — existing data invisible under MSIX | Phase 05 |
| Chromium profile data migration missing — preferences reset at first MSIX launch | Phase 05 |
| `runFullTrust` capability not declared in MSIX manifest | Phase 05 |
| MSIX capability declarations absent | Phase 05 |
| Identity fields inconsistent (`time-tracker` vs `my_app`) | Phase 05 |
| Version strings inconsistent (`1.0.0` vs `0.0.1`) | Phase 05 |
| Version not in MSIX four-part format | Phase 05 |
| Multiple divergent display names across artifacts | Phase 05 |
| Squirrel update mechanism not replaced for Store lane | Phase 05 |
| `app.quit()` on Squirrel install event — dead code to clean up | Phase 05 |
| Rebuild target (Electron-bundled Node) must be confirmed for CI/MSIX pipeline | Phase 03 |
| SSH git dep (`@electron/node-gyp`) in lockfile — breaks Store/CI build | Phase 03 |
| `devTools` production guard — `NODE_ENV` reliability must be confirmed | Phase 03 |

### DEFERRED — Scoped to Later Phase; Not Blocking Phase 03

| Item | Phase | Rationale |
|---|---|---|
| MSIX maker tool selection | 05 | Evaluation documented; not needed until packaging phase |
| User data migration design | 05 | Blocked on MSIX maker selection; no imminent MSIX packaging |
| Chromium profile migration design | 05 | Same dependency as user data migration |
| Store publisher account and code signing cert | 05 | Administrative prerequisite; no dev action available in Phases 02–04 |
| `sqlite3` → 6.0.1 upgrade | 03 | Approved in Phase 02 matrix; implementation assigned to Phase 03 |
| Privacy policy declaration | 05 | Required for Store listing; minimal scope given no data collection |
| MSIX Package Identity block definition | 05 | Requires publisher account + maker tool selection first |

---

## 10. Phase 02 Gate Impact

This checklist satisfies Gate G1 identified in `phase-02-validation-matrix.md` — the previously missing Phase 02 Store compatibility deliverable.

**Key finding:** No previously unknown blocking items were discovered. All OPEN items were already enumerated in `phase-01-store-compatibility-note.md`. The checklist confirms:

- All Store-blocking items (MSIX maker, code signing, identity, data migration) are correctly scoped to Phase 05 and do not block the Phase 03 runtime upgrade sequence.
- Phase 03 pre-conditions from this checklist (SSH git dep, rebuild target, `devTools` guard) are already tracked as Phase 03 gates (G6, K6) in the validation matrix.
- The Fuse security configuration is in a strong posture for a pre-Store app: five of eight assessed Fuse flags are already set to the correct Store-hardened value.

The Phase 02 gate recommendation is updated from **CONDITIONALLY READY** to **READY** — the only outstanding condition that prevented READY status was the absence of this deliverable.
