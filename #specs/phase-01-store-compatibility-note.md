# Phase 01 — Microsoft Store Compatibility Baseline Note

**Task:** Phase 4, Task 4.2 — Store Compatibility Baseline  
**Date:** 2026-05-07  
**Repo:** `d:\dev\fm\timer-tracker`  
**Scope:** Factual baseline only. No fixes proposed. Findings are derived from `package.json`, `package-lock.json`, `forge.config.js`, `README.md`, `src/main/index.js`, the Phase 01 baseline report, and the Phase 01 Windows smoke report.

---

## 1. Current Installer and Distribution Strategy

The app currently uses **Electron Forge with the Squirrel.Windows maker** as its Windows distribution mechanism:

- `npm run make` produces `out\make\squirrel.windows\x64\time-tracker-1.0.0 Setup.exe` (112.74 MB) and a companion NuGet package (`my_app-0.0.1-full.nupkg`, 112 MB).
- `npm run package` produces a portable directory (`out\time-tracker-win32-x64\`) with a bare `time-tracker.exe` (188 MB) — no installer.
- macOS and Linux makers (`maker-zip`, `maker-deb`, `maker-rpm`) are configured but not relevant to Store planning.
- **No MSIX maker is configured.** The package `@electron-forge/maker-appx` or any equivalent MSIX-producing tool is absent from both `package.json` and `forge.config.js`.
- `electron-squirrel-startup@1.0.1` is a runtime `dependency` (not devDependency). It handles Squirrel install-event lifecycle (shortcut creation, first-run, uninstall cleanup). This dependency is Squirrel-specific and has no equivalent role under MSIX.

---

## 2. Package Identity and Naming Fields

Multiple identity fields are currently set independently and do not agree with each other:

| Field | Location | Value |
|---|---|---|
| `name` | `package.json` | `time-tracker` |
| `version` | `package.json` | `1.0.0` |
| `author` | `package.json` | `flvrm92` |
| `description` | `package.json` | `time tracker electron app` |
| `maker-squirrel.name` | `forge.config.js` | `my_app` |
| `maker-squirrel.version` | `forge.config.js` | `0.0.1` |
| `maker-squirrel.authors` | `forge.config.js` | `['Flavio Moreno @flvrm92']` |
| EXE FileDescription | packaged artifact | `time-tracker` |
| EXE ProductVersion | packaged artifact | `1.0.0` |
| NuGet package name | `out\make\…` artifact | `my_app-0.0.1-full.nupkg` |
| RELEASES manifest entry | `out\make\…` artifact | `my_app-0.0.1-full.nupkg` |

The `maker-squirrel.name` value (`my_app`) diverges from the npm package name (`time-tracker`) in all installer artifacts. The `maker-squirrel.version` (`0.0.1`) diverges from `package.json` version (`1.0.0`).

For a future MSIX or Store submission, the Microsoft Store requires a **Package Identity** with a consistent `Name`, `Publisher`, and `Version` across the MSIX manifest, the Developer Center registration, and the signing certificate. None of these fields currently satisfy that requirement as-is.

---

## 3. Version Alignment Issues

Two independent version strings are in active use:

- `package.json` → `"version": "1.0.0"` — used by Electron Forge for EXE version resources and the installer filename (`time-tracker-1.0.0 Setup.exe`).
- `forge.config.js` `maker-squirrel.config.version` → `"0.0.1"` — used for the NuGet package name and the RELEASES manifest.

These produce artifacts that assert different version identities simultaneously. Squirrel's update mechanism keys on the version in the RELEASES file; if the two ever diverge further, silent update failures are possible. The Store's strict version monotonicity requirement (four-part `Major.Minor.Build.Revision`, must always increase) is not addressed by either value today.

---

## 4. Code Signing Status

**No code signing is configured.** Inspection of `forge.config.js` shows no `certificateFile`, `certificatePassword`, `signWithParams`, `signtoolOptions`, or any signing-related fields in either `packagerConfig` or the `maker-squirrel` config block.

- The packaged `time-tracker.exe` and `time-tracker-1.0.0 Setup.exe` are **unsigned**.
- Microsoft Store MSIX submission requires the package to be signed with a certificate whose Publisher CN matches the Store-registered publisher identity. Distribution through the Store itself re-signs the package, but sideload/enterprise scenarios require a valid certificate.
- Unsigned Squirrel installers trigger Windows SmartScreen warnings on first run on machines where the app has no reputation.
- No `osslsigncode`, `signtool`, or CI signing step is present in the repo's scripts or any documented workflow.

---

## 5. Update and Install Assumptions

The current Squirrel-based update/install model assumes:

- Installation into the user's `%LOCALAPPDATA%\time-tracker` directory (Squirrel per-user install default).
- Squirrel lifecycle events (`squirrel-install`, `squirrel-updated`, `squirrel-uninstall`, `squirrel-obsolete`) handled by `electron-squirrel-startup`, which creates/removes Start Menu shortcuts and handles first-run detection.
- Delta updates via NuGet package diffing and the RELEASES manifest.

Under MSIX or the Windows Store:
- Updates are delivered through the Store update pipeline or MSIX provisioning — there is no Squirrel RELEASES file or NuGet delta patching.
- `electron-squirrel-startup` shortcut management is replaced by the MSIX manifest's `<Applications>` entry and the Store's tile/shortcut infrastructure.
- Install events that `electron-squirrel-startup` currently handles (e.g., `app.quit()` on Squirrel lifecycle calls in `src/main/index.js`) would not fire and the quit-on-install pattern would be inert — but the dependency itself would be dead weight.

---

## 6. Admin-Rights Expectations

- Squirrel installs per-user by default (no UAC elevation required). This is compatible with Store distribution, which also installs per-user.
- The app writes user data exclusively to `app.getPath('userData')` (`%APPDATA%\time-tracker`), which does not require admin rights.
- No writes to `Program Files`, `HKLM` registry, or other system-wide locations were observed in source or smoke tests.
- No UAC manifest (`requestedExecutionLevel`) is set in the current build config. The packaged EXE defaults to `asInvoker`, which is correct for a per-user app.
- **No admin-rights elevation is expected or required** by the current codebase. This aspect is already compatible with Store distribution policy.

---

## 7. User Data and File Write Location Behavior

**Confirmed path (from Windows smoke report):**

```
%APPDATA%\time-tracker\timers.db
→ C:\Users\Flavi\AppData\Roaming\time-tracker\timers.db
```

Set in `src/main/index.js`:
```js
process.env.DB_PATH = path.join(app.getPath('userData'), 'timers.db');
```

`app.getPath('userData')` under Electron (non-MSIX) resolves to `%APPDATA%\<app-name>`, which is the Chromium-default **Roaming** AppData path.

Behavior under MSIX:
- When an Electron app is packaged as MSIX, `app.getPath('userData')` is redirected by the MSIX filesystem virtualization layer to a path inside the package's container: `%LOCALAPPDATA%\Packages\<PackageFamilyName>\LocalCache\Roaming\<app-name>`. The path changes at first MSIX launch.
- **Existing user data** at `C:\Users\<user>\AppData\Roaming\time-tracker\timers.db` (from Squirrel or dev installs) **will not be visible** to the MSIX-packaged app without an explicit migration step.
- The Chromium profile data (Preferences, blob_storage, Session Storage, etc.) observed in the smoke report at the same userData directory would similarly be invisible to the MSIX container, resulting in a loss of theme settings and other Electron-persisted preferences.
- The database contains accumulated timer and project data. No migration logic exists in the current codebase.

Additional write locations observed in smoke report (all within `%APPDATA%\time-tracker`):
- `Preferences`, `Local State`, `Session Storage`, `Local Storage`, `Cache`, `Code Cache`, `GPUCache`, `blob_storage`, `DawnGraphiteCache`, `DawnWebGPUCache`, `Shared Dictionary`, `WebStorage`, `SharedStorage`, `DIPS` — all standard Chromium/Electron userData files.
- CSV export uses `dialog.showSaveDialog` to write to a user-chosen path. That path is outside the userData directory and is not affected by MSIX virtualization.

---

## 8. Native Module Packaging Implications

`sqlite3@5.1.7` is a native N-API module (napi_versions 3 and 6). Its packaging behavior in the current build:

- `@electron-forge/plugin-auto-unpack-natives` is configured in `forge.config.js` and correctly unpacks `node_sqlite3.node` (1.8 MB) to `app.asar.unpacked\node_modules\sqlite3\build\Release\` at package time.
- `asar: true` is set in `packagerConfig`, meaning the app bundle is an ASAR archive. The native `.node` file is correctly excluded from the ASAR and co-located in the `app.asar.unpacked` sibling directory — confirmed by the Phase 01 packaging smoke test.
- Packaged app startup stdout confirmed: `Connected to SQLite database. Current schema version: 1` — native module loaded and ran in the packaged build.

Under MSIX:
- MSIX installs the app into a **read-only virtualized install root** (`%ProgramFiles%\WindowsApps\<PackageFamilyName>\`). The `app.asar.unpacked` directory and the `.node` file reside there.
- Native `.node` files in the read-only install root are loadable at runtime (they are read, not written). This is not inherently incompatible with MSIX.
- However, the host Node.js / Electron rebuild step must target the exact Electron binary in the packaged app. The Phase 01 baseline report notes a host Node.js (24.2.0) vs Electron-embedded Node (~20.18.x) mismatch. While N-API is ABI-stable, the rebuild target must be explicitly specified for MSIX builds.
- An SSH-based git dependency resolves `node-gyp` via `ssh://git@github.com/electron/node-gyp.git` in the lockfile. Microsoft Store build pipelines (or any isolated CI environment) will not have SSH GitHub access, which would cause native module rebuild to fail.

---

## 9. Current Behavior That Would Not Transfer Cleanly to MSIX or Store

The following behaviors are present today and are incompatible with or require changes for MSIX/Store packaging:

| # | Behavior | Evidence | MSIX/Store Impact |
|---|---|---|---|
| B1 | `electron-squirrel-startup` install-event lifecycle | `dependencies` in `package.json`; Squirrel maker in `forge.config.js` | Dead/incorrect behavior under MSIX — Squirrel lifecycle events never fire |
| B2 | `maker-squirrel` as sole Windows installer | `forge.config.js`; no `maker-appx` present | No MSIX output; Store requires MSIX |
| B3 | `app.getPath('userData')` → `%APPDATA%\time-tracker` | `src/main/index.js`; smoke report confirmed path | Path redirected under MSIX virtualization; existing data unreachable without migration |
| B4 | No code signing | `forge.config.js` (no signing fields) | Store re-signs, but sideload/enterprise requires a cert; SmartScreen blocks unsigned builds |
| B5 | Identity fields inconsistent (`my_app` / `time-tracker`, `0.0.1` / `1.0.0`) | `forge.config.js`, `package.json`, artifacts | MSIX Package Identity requires a single consistent Name/Version/Publisher across all fields |
| B6 | SSH git dependency for `node-gyp` | `package-lock.json` (noted in baseline report) | Breaks native rebuild in Store/CI build pipelines without SSH GitHub access |
| B7 | `devTools` conditionally enabled via `env === 'development'` check | `src/main/index.js` | `NODE_ENV` is not guaranteed to be set to `'production'` in all Store build pipelines; DevTools must be explicitly disabled in packaged builds |
| B8 | `electron-reloader` active in dev via `require` guard | `src/main/index.js` (`if (env === 'development')` block) | Acceptable if `NODE_ENV` is reliable; Store builds must confirm dev code paths are excluded |
| B9 | `Menu.setApplicationMenu(null)` only in non-development mode | `src/main/index.js` | No menu in production is intentional, but relies on `NODE_ENV` correctness |
| B10 | No MSIX manifest metadata | `forge.config.js`, `package.json` | Store submission requires display name, publisher display name, description, capabilities, and Visual Assets; none are present |

---

## 10. Recommended Follow-Up Topics for Later Phases

The following topics are identified for later-phase investigation. No fixes are proposed here; this is a baseline enumeration only.

1. **Identity field alignment** — Consolidate `package.json` `name`/`version`, `forge.config.js` `maker-squirrel` `name`/`version`, and any future MSIX `Identity` element into a single source of truth before MSIX work begins.

2. **MSIX maker evaluation** — Assess `@electron-forge/maker-appx` (deprecated upstream) vs `electron-builder` MSIX target vs manual `makeappx` post-processing. Choose a supported path before Phase 05 packaging work.

3. **Code signing setup** — Establish a Windows code signing certificate and integrate it into the Forge build pipeline. Required for SmartScreen reputation and Store sideload scenarios regardless of MSIX status.

4. **userData path migration strategy** — Design a migration path for existing user data in `%APPDATA%\time-tracker\timers.db` to the MSIX container path. The database contains user-created project and timer records; silent data loss at first MSIX launch is a user-facing regression.

5. **`electron-squirrel-startup` replacement plan** — Determine what install-event handling (if any) is needed under MSIX. If Squirrel is retained for a non-Store distribution lane alongside an MSIX Store lane, dual-path startup handling will be required.

6. **SSH git dependency resolution** — Replace the lockfile's `ssh://git@github.com/electron/node-gyp.git` transitive dependency with the standard npm registry version to unblock CI and Store build pipelines.

7. **MSIX manifest Visual Assets** — Store submission requires a complete set of logo assets (44x44, 50x50, 150x150, 300x300, splash screen, store logo). No assets directory or icon set was identified in the repo.

8. **`NODE_ENV` reliability in packaged builds** — Audit how Electron Forge sets `NODE_ENV` in packaged and made outputs. Confirm that dev-mode code paths (`electron-reloader`, `devTools`, `Menu.setApplicationMenu(null)`) behave correctly when the app is launched outside of `electron-forge start`.

9. **Store category, capabilities, and publisher account** — The app currently has no MSIX capability declarations (e.g., `runFullTrust`), no Store category, and no publisher account association. These are prerequisites for any Store submission timeline.

10. **47 npm audit vulnerabilities** — One critical and 36 high-severity findings are present in the transitive dependency tree (noted in baseline report). Store review policies and security requirements for enterprise deployment warrant resolution before Phase 05 hardening.

---

## Summary Table

| Area | Current State | Store-Ready? |
|---|---|---|
| Installer format | Squirrel (`.exe` + `.nupkg`) | No — MSIX required |
| Code signing | Not configured | No |
| Package identity fields | Inconsistent across 3 locations | No |
| Version alignment | Two independent version strings | No |
| userData write path | `%APPDATA%\time-tracker` | Incompatible — path changes under MSIX |
| Admin-rights requirement | None (per-user, no UAC) | Compatible |
| Native module unpack | Correctly handled via `auto-unpack-natives` | Conditionally compatible |
| MSIX manifest metadata | Absent | No |
| Install-event handling | Squirrel-specific (`electron-squirrel-startup`) | No — mechanism changes under MSIX |
| SSH git dependency | Present in lockfile | Blocks Store build pipelines |

---

## 11. Phase 2.1 Checkpoint — Native Dependency Decision Cross-Reference

**Reference:** `#specs/phase-02-native-dependency-decision.md`  
**Checkpoint date:** 2026-05-07

### Summary

Phase 2, Task 2.1 authored a native dependency decision artifact for `sqlite3`. The decision and its Store-relevant implications are summarised here for traceability.

**Preferred path:** Upgrade `sqlite3` in-place from 5.1.7 to **6.0.1** (semver major). API surface is unchanged; no application code changes required. Exercise in Phase 3 paired with the Electron 36.x upgrade.

**Approved fallback path:** Replace `sqlite3` with **`better-sqlite3`** (synchronous N-API binding, no SSH git dependency). Requires rewriting `src/infra/database.js` and `src/main/ipcHandlers.js`. Exercise only if preferred path fails rebuild or packaged startup acceptance criteria.

### Store-Relevant Implications

The following Store-blocking findings documented in this note are directly addressed (or conditioned) by the native dependency decision:

| Finding (this note) | Implication from native dependency decision |
|---|---|
| **B6** — SSH git dependency for `@electron/node-gyp` in lockfile blocks Store and CI build pipelines | The preferred path (sqlite3 v6) combined with the forge 7.11.1 upgrade (Phase 2) is expected to replace the SSH-routed `@electron/node-gyp` with the npm registry version. The Store-oriented acceptance criteria in the decision artifact require this to be confirmed before Phase 5 packaging. If the SSH dependency persists, the fallback path (`better-sqlite3`) eliminates it entirely. |
| **Section 8** — N-API rebuild must target Electron-bundled Node, not host Node | The decision artifact records this as a hard rebuild constraint for both the preferred and fallback paths. The acceptance criteria require `electron-forge package` to succeed in a clean environment without SSH access — a prerequisite for any MSIX or Store pipeline. |
| **Section 8** — `.node` file must remain in `app.asar.unpacked` for MSIX read-only install root compatibility | The Store-oriented acceptance criteria in the decision artifact explicitly require the `.node` file to remain outside the ASAR archive after the upgrade. No regression from the current working configuration is permitted. |

### What Is Not Resolved Here

The native dependency decision does not address the following Store blockers from this note; they remain open for later phases:

- B1 (`electron-squirrel-startup`), B2 (no MSIX maker), B3 (userData path migration), B4 (code signing), B5 (identity field inconsistency), B7–B9 (`NODE_ENV` reliability), B10 (MSIX manifest metadata).
- Section 4 (userData migration strategy), Section 10 items 1–5 and 7–9 (identity, MSIX maker, signing, Visual Assets, publisher account).
