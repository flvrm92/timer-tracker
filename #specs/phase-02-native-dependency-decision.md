# Phase 02 — Native Dependency Decision Note

**Task:** Phase 2, Task 2.1 — Native Dependency Decision  
**Date:** 2026-05-07  
**Repo:** `d:\dev\fm\timer-tracker`  
**Phase ownership:** Authored Phase 2; decision exercised Phase 3  
**Scope:** Decision artifact only. No implementation changes are made in this task.

---

## Validation Command Output

```
npm ls sqlite3 --depth=0

time-tracker@1.0.0 D:\dev\fm\timer-tracker
└── sqlite3@5.1.7
```

`sqlite3@5.1.7` is the sole installed SQLite binding. It is a `dependency` (runtime), not devDependency. Confirmed present at correct version with no duplication or peer conflict.

---

## Current State Summary

| Property | Value |
|---|---|
| Installed binding | `sqlite3@5.1.7` |
| Binding type | Native, N-API (napi_versions 3 and 6) |
| Approved upgrade target | `sqlite3@6.0.1` (from Phase 02 dependency matrix) |
| Host Node | v24.2.0 |
| Electron-bundled Node | ~20.18.x (Electron 33 series) |
| Rebuild tool | `@electron/rebuild` (via `electron-forge rebuild`) |
| Unpack plugin | `@electron-forge/plugin-auto-unpack-natives` (configured in `forge.config.js`) |
| Dev-mode startup | SUCCESS — `Connected to SQLite database. Current schema version: 1` (Phase 01 smoke report) |
| Packaged startup | SUCCESS — `node_sqlite3.node` correctly located in `app.asar.unpacked\node_modules\sqlite3\build\Release\` (Phase 01 packaging smoke) |

---

## Preferred Path

**Upgrade `sqlite3` from 5.1.7 to 6.0.1 in-place.**

### Rationale

- `sqlite3@6.0.1` is the approved target in the Phase 02 dependency matrix (see `phase-02-dependency-matrix.md`).
- The upgrade closes four transitive audit findings present in v5.1.7: `http-proxy-agent`, `cacache`, `make-fetch-happen`, and `@tootallnate/once`.
- `sqlite3` uses N-API, which is ABI-stable across Node versions. The existing N-API version range (napi_versions 3 and 6) is expected to remain compatible with both Electron 33 (Node ~20.18.x) and the Phase 3 Electron 36.x target (Node ~22.x).
- The `@electron-forge/plugin-auto-unpack-natives` plugin is already configured in `forge.config.js` and handles `node_sqlite3.node` exclusion from ASAR at package time. No plugin changes are required for v6.
- The `src/infra/database.js` API surface (callback-based `sqlite3.Database`) does not change between v5 and v6. No application code changes are required.
- Rebuild against Electron-bundled Node headers is performed automatically by `electron-forge package` and `electron-forge make` via `@electron/rebuild`.

### Rebuild Target Constraint

The `@electron/rebuild` step **must** target the Electron-bundled Node version, not the host Node (24.2.0). This is enforced by Forge automatically when `electron-forge package` invokes rebuild. Manual `npx electron-rebuild` invocations must pass `--electronVersion` explicitly:

```
npx electron-rebuild --electronVersion <target-electron-version>
```

This constraint applies to both the preferred path and the fallback path.

### SSH Dependency Note

The current lockfile routes `@electron/node-gyp` through an SSH git dependency (`ssh://git@github.com/electron/node-gyp.git`). This is a known blocker for CI and Store build pipelines (see Phase 01 Store Compatibility Note, item B6, and Section 8). Upgrading `@electron-forge/*` to 7.11.1 in Phase 2 (prior to the sqlite3 upgrade in Phase 3) is expected to replace the lockfile's SSH path with the standard npm registry version for `@electron/node-gyp`. Confirm with `npm ls @electron/node-gyp` after the forge upgrade.

---

## Approved Fallback Path

**Replace `sqlite3` with `better-sqlite3` if the preferred path fails.**

### Rationale

- `better-sqlite3` uses N-API (compiled native module), is synchronous, and provides prebuilt binaries through the npm registry without relying on `node-pre-gyp` SSH git dependencies.
- It eliminates the SSH `@electron/node-gyp` lockfile entry entirely, unblocking CI and Store pipelines.
- It is actively maintained and widely used in Electron applications as of 2026.

### API Impact

`better-sqlite3` exposes a **synchronous** API, while `sqlite3` exposes an **asynchronous** callback API. Switching to the fallback requires rewriting `src/infra/database.js` to use synchronous calls and updating all IPC handlers in `src/main/ipcHandlers.js` that await or use callbacks from the database layer. This is a meaningful but bounded code change.

The fallback is **not implemented in this phase**. This entry records the approved path so that Phase 3 can execute it without re-deliberating if the preferred path fails.

---

## Trigger Criteria for Switching to Fallback

Switch from the preferred path to the approved fallback if **any** of the following conditions are observed during Phase 3 execution:

1. `electron-forge package` fails at the `@electron/rebuild` step for `sqlite3@6.0.1` with a compile or link error that cannot be resolved by correcting the rebuild target or toolchain configuration within two attempts.
2. `npm ls sqlite3 --depth=0` shows an error, missing, or version mismatch after `npm install sqlite3@6.0.1`.
3. The packaged app (`out\time-tracker-win32-x64\time-tracker.exe`) fails to start with a native module load error (`Cannot find module`, `NODE_MODULE_VERSION mismatch`, or `The specified module could not be found`).
4. The SSH git dependency for `@electron/node-gyp` persists in the lockfile after the forge 7.11.1 upgrade and cannot be replaced through normal `npm install` resolution.

---

## Acceptance Criteria

### 1. Rebuild Acceptance

- `electron-forge rebuild` (or `electron-forge package`, which includes rebuild) completes with exit code 0.
- `node_sqlite3.node` (preferred) or the `better-sqlite3` equivalent `.node` file is present in `app.asar.unpacked\node_modules\<package>\build\Release\` after packaging.
- `npm ls sqlite3 --depth=0` (preferred) or `npm ls better-sqlite3 --depth=0` (fallback) reports the target version with no error flag.

### 2. Packaged Startup Acceptance

- `out\time-tracker-win32-x64\time-tracker.exe` launches without error in development-equivalent mode.
- Application stdout (captured via electron log or process output) contains: `Connected to SQLite database. Current schema version: 1`
- No native module error is logged at startup.
- Timer and project data round-trips (create, read) through the database layer complete without error in a manual smoke test.

### 3. Store-Oriented Acceptance Constraints

| Constraint | Required Outcome |
|---|---|
| `.node` file location | Must remain in `app.asar.unpacked`, **not** inside the ASAR archive, to be accessible from the MSIX read-only install root |
| SSH git dependency | Must be absent from `package-lock.json` after forge + sqlite upgrade; `npm ls @electron/node-gyp` must resolve to an npm registry source |
| Rebuild reproducibility | `npm ci && electron-forge package` must succeed in a clean environment without SSH GitHub access |
| N-API version | Rebuilt `.node` file must declare N-API compatibility with the Electron-bundled Node version in use at packaging time |
| No write to install root | The binding must only write to `app.getPath('userData')` (database file); no writes to the module install path at runtime |

---

## Phase Ownership and Exercise Timeline

| Phase | Action |
|---|---|
| **Phase 2** (current) | Forge 7.8.3 → 7.11.1 upgrade; SSH dependency expected to resolve; this decision artifact authored |
| **Phase 3** | Electron upgrade (33.4.11 → 36.x) **and** `sqlite3` upgrade (5.1.7 → 6.0.1) executed as a paired, atomic commit; acceptance criteria verified; fallback triggered if criteria above are met |
| **Phase 4** | If Electron is further upgraded to 40–42.x, repeat rebuild acceptance check for the SQLite binding against the new Electron-bundled Node version |
| **Phase 5** | Store-oriented acceptance constraints verified in the context of MSIX packaging; `.node` file location and SSH-free rebuild confirmed before Store submission preparation |

---

## Decision Summary

| Item | Decision |
|---|---|
| **Preferred path** | Upgrade `sqlite3` in-place: 5.1.7 → **6.0.1** |
| **Fallback path** | Replace with **`better-sqlite3`** (synchronous N-API binding) |
| **Fallback trigger** | Rebuild failure, module load failure, or unresolvable SSH dependency after forge upgrade |
| **Phase of exercise** | **Phase 3** (paired with Electron 36.x upgrade) |
| **Application code changes (preferred)** | None — API surface unchanged between sqlite3 v5 and v6 |
| **Application code changes (fallback)** | `src/infra/database.js` and `src/main/ipcHandlers.js` must be rewritten for synchronous API |
| **Store blocker resolved by preferred path** | SSH git dependency eliminated (via forge 7.11.1 prerequisite); `.node` unpack behavior preserved |
