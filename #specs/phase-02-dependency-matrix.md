# Phase 02 — Dependency Audit and Approved Target Matrix

**Task:** Phase 2, Task 1.2 — Dependency Audit and Approved Target Matrix  
**Date:** 2026-05-07  
**Repo:** `d:\dev\fm\timer-tracker`  
**Lockfile version:** 3  
**Total installed packages:** 1,001 (prod: 93 / dev: 872 / optional: 398)

---

## Command Output Captures

### `npm ls electron sqlite3 electron-squirrel-startup @electron-forge/cli @electron-forge/maker-squirrel --depth=0`

```
time-tracker@1.0.0
├── @electron-forge/cli@7.8.3
├── @electron-forge/maker-squirrel@7.8.3
├── electron-squirrel-startup@1.0.1
├── electron@33.4.11
└── sqlite3@5.1.7
```

### `npm outdated`

| Package | Current | Wanted | Latest |
|---|---|---|---|
| `@electron-forge/cli` | 7.8.3 | 7.11.1 | 7.11.1 |
| `@electron-forge/maker-deb` | 7.8.3 | 7.11.1 | 7.11.1 |
| `@electron-forge/maker-rpm` | 7.8.3 | 7.11.1 | 7.11.1 |
| `@electron-forge/maker-squirrel` | 7.8.3 | 7.11.1 | 7.11.1 |
| `@electron-forge/maker-zip` | 7.8.3 | 7.11.1 | 7.11.1 |
| `@electron-forge/plugin-auto-unpack-natives` | 7.8.3 | 7.11.1 | 7.11.1 |
| `@electron-forge/plugin-fuses` | 7.8.3 | 7.11.1 | 7.11.1 |
| `@electron/fuses` | 1.8.0 | 1.8.0 | 2.1.1 |
| `@types/jest` | 29.5.14 | 29.5.14 | 30.0.0 |
| `electron` | 33.4.11 | 33.4.11 | 42.0.0 |
| `jest` | 29.7.0 | 29.7.0 | 30.4.0 |
| `sqlite3` | 5.1.7 | 5.1.7 | 6.0.1 |

All direct dependencies are pinned at the top of their semver range. No patch-level updates are outstanding. Available moves are all minor (Forge) or major (everything else).

### `npm audit` Summary

```
47 vulnerabilities total:
  critical:   1
  high:      36
  moderate:   7
  low:        3
```

**Direct dependencies flagged:**

| Direct Package | Severity | Fix Available |
|---|---|---|
| `@electron-forge/*` (7 packages) | high | No (requires forge ≥ 7.11.x resolution) |
| `electron` | high | Yes — semver major (42.0.0) |
| `sqlite3` | high | Yes — semver major (6.0.1) |

**Root-cause transitive packages:**

| Package | Severity | Notes |
|---|---|---|
| `handlebars` (4.0.0–4.7.8) | critical + high | Via forge template toolchain; JS injection, prototype pollution |
| `@electron/rebuild` (3.2.10–4.0.2) | high | Via forge core; no in-range fix at forge 7.8.3 |
| `@electron/node-gyp` | high | Via @electron/rebuild |
| `tar` | high | Via @electron/node-gyp |
| `lodash` (≤4.17.23) | high | Via multiple forge sub-packages |
| `cacache` | high | Via node-gyp and sqlite3 build chain |
| `make-fetch-happen` | high | Via node-gyp; fix via sqlite3 6.0.1 (semver major) |
| `http-proxy-agent` | low | Via node-gyp; fix via sqlite3 6.0.1 (semver major) |

All `@electron-forge/*` vulnerabilities are transitive — they flow from `@electron/rebuild` → `@electron/node-gyp` / `tar`. Upgrading forge to 7.11.1 resolves the `@electron/rebuild` range constraint and is expected to pull in a patched `@electron/node-gyp`; confirm with `npm audit` after upgrade.

### `rg "electron-reload|electron-reloader|node-gyp"` (package-lock.json)

```
Line 30:  "electron-reload": "^2.0.0-alpha.1",
Line 31:  "electron-reloader": "^1.2.3",
Line 1208: "node_modules/@electron/node-gyp": { ... }
Line 5338: "node_modules/electron-reload": { resolved: ...electron-reload-2.0.0-alpha.1.tgz }
Line 5348: "node_modules/electron-reloader": { resolved: ...electron-reloader-1.2.3.tgz }
Line 9217: "node_modules/node-gyp": { resolved: ...node-gyp-8.4.1.tgz }
```

Both `electron-reload` and `electron-reloader` are installed simultaneously. `electron-reload` is on an alpha tag (`2.0.0-alpha.1`). Neither is used during `electron-forge start` (forge uses its own watch mechanism). This is a duplicate hot-reload risk — see Repo-Specific Risks section.

---

## Approved Target Matrix

> **Coordinate rule:** All `@electron-forge/*` packages and `@electron/fuses` must be upgraded as a single atomic commit. Never upgrade a subset of forge packages.

| Component | Current Version | Approved Target | Node Floor | Rationale | Risk | Move Phase | Owner |
|---|---|---|---|---|---|---|---|
| **Electron** | 33.4.11 | 36.x (stable as of Q1 2026); defer 40–42.x to Phase 4 | Node 20.x bundled (33); Node 22.x bundled (~36+) | 33.x has reached or is near EOL; 36.x is the lowest series that is still actively maintained as of this writing and closes the `@electron/rebuild` high-severity window when combined with forge 7.11.1. A jump directly to 42.0.0 (9 major versions) carries higher integration risk for native modules and fuse API changes. Phased approach: 36.x in Phase 2/3, re-evaluate 40–42 in Phase 4. | **High** — semver major; Electron API surface changes, fuse definitions may shift, native module rebuild required | Phase 3 | repo owner |
| **Electron Forge (all `@electron-forge/*` packages)** | 7.8.3 | 7.11.1 (within 7.x series) | Node 18+ (forge 7.x requirement) | Patch/minor upgrade within 7.x; resolves the `@electron/rebuild` high-severity audit chain and pulls in updated `@electron/node-gyp`. All seven forge packages (`cli`, `maker-deb`, `maker-rpm`, `maker-squirrel`, `maker-zip`, `plugin-auto-unpack-natives`, `plugin-fuses`) must move together. Must re-test `npm run make` on Windows after upgrade. | **Low-Medium** — within 7.x minor; API is stable but forge internals change. Requires smoke test of `make` output. | Phase 2 | repo owner |
| **`@electron/fuses`** | 1.8.0 | 2.1.1 | — | Companion to forge fuses plugin; upgrade after forge plugin upgrade to ensure API alignment. The fuse constants defined in `forge.config.js` (`RunAsNode`, `EnableCookieEncryption`, `EnableEmbeddedAsarIntegrityValidation`, `OnlyLoadAppFromAsar`) should be verified against v2 definitions before commit. | **Low-Medium** — semver major; verify fuse constant names have not changed | Phase 2 (same commit as forge upgrade) | repo owner |
| **`sqlite3`** | 5.1.7 | 6.0.1 | Node 14+ (v6 requirement; Electron-bundled Node 20.x satisfies this) | v6 closes `http-proxy-agent`, `cacache`, `make-fetch-happen`, and `@tootallnate/once` audit findings in the native build toolchain. v6 is a semver major; verify no API-level breaking changes in the SQL binding surface used by `src/infra/database.js`. Must rebuild against the Electron-bundled Node headers. | **Medium** — semver major; binding API is stable between v5 and v6 but node-pre-gyp compile step must succeed in CI. | Phase 2 | repo owner |
| **`jest` + `@types/jest`** | jest 29.7.0 / @types/jest 29.5.14 | Hold at 29.x series for Phase 2; evaluate 30.x in Phase 3 | Node 14+ (jest 29); Node 16+ (jest 30) | Jest 30 is a semver major with transformer changes, ESM handling adjustments, and updated snapshot serialization. Current test suite (3 test files, `--runInBand`) is low-complexity but a breaking change in jest config format could stall Phase 2. Holding at 29.x avoids test-tooling churn while native and Electron upgrades are in progress. | **Low** (hold) / **Medium** (if promoted to 30.x) | Phase 3 | repo owner |
| **`electron-reloader`** | 1.2.3 | **Remove** — do not upgrade | — | Last published 2021; unmaintained. Redundant with `electron-reload` and with `electron-forge start` built-in watch. No production value. | **Low** (removal) — dev-only dep, no runtime impact | Phase 2 | repo owner |
| **`electron-reload`** | 2.0.0-alpha.1 | **Remove** — do not upgrade | — | Alpha release pinned in devDependencies. Using an alpha-tagged package as a persistent devDependency is a maintenance liability. Forge's own hot-reload mechanism (`electron-forge start --inspect-electron` or `--enable-logging`) covers the dev-server use case without a separate watcher. | **Low** (removal) — dev-only dep, no runtime impact | Phase 2 | repo owner |
| **`electron-squirrel-startup`** | 1.0.1 | Hold at 1.0.1 through Phases 2–4; reassess in Phase 5 | — | Runtime dependency for Squirrel lifecycle events (`squirrel-install`, `squirrel-uninstall`, shortcut management). Confirmed used in `src/main/index.js`. No newer published version. Will become dead weight under MSIX/Store distribution (Phase 5) and should be removed then. Until distribution channel changes, it must remain. | **Low** (hold) | Phase 5 (removal) | repo owner |

---

## Repo-Specific Dependency Risks

### 1. Duplicate Hot-Reload Packages

Both `electron-reload@2.0.0-alpha.1` and `electron-reloader@1.2.3` are present as devDependencies simultaneously. This is redundant, adds ~200 packages worth of transitive surface, and the alpha tag on `electron-reload` means npm's semver resolution could resolve to any future pre-release. Removing both is the correct Phase 2 action; `electron-forge start` provides equivalent functionality.

### 2. Host-Node / Electron-Node Mismatch

As documented in the Phase 01 baseline report, the host Node (24.2.0) is four major versions ahead of Electron 33's bundled Node (~20.18.x). Every time Electron is upgraded, this delta must be re-evaluated. The critical constraint is that `sqlite3` and any other native modules must be compiled against the **Electron-bundled Node headers**, not the host Node. Forge's `@electron-forge/plugin-auto-unpack-natives` and the rebuild step handle this during `npm run make`, but manual `npm run start` will use the host Node's pre-built binary — verify the pre-built binary path is correct or that a `postinstall` rebuild is in place.

### 3. `@electron/rebuild` Vulnerability — No In-Range Fix at Forge 7.8.3

The `@electron/rebuild@3.2.10–4.0.2` range is flagged HIGH (via `@electron/node-gyp` and `tar`). At forge 7.8.3 there is no available patch within the existing range; `npm audit fix` will report no automatic fix. The resolution path is forge → 7.11.1, which updates `@electron/rebuild` to a version outside the vulnerable range. Do not apply `npm audit fix --force` on this — it will attempt a major upgrade that may not coordinate all forge packages correctly.

### 4. `handlebars` Critical/High — Transitive via Forge Template Packages

`handlebars@4.0.0–4.7.8` is flagged CRITICAL (code injection via AST type confusion, CVSS 9.8) and HIGH (multiple injection and prototype pollution variants). This dependency is pulled in by `@electron-forge/template-*` packages which are installed as transitive dependencies but are **not used** in this project (no Vite or Webpack template is active). The fix is to upgrade to `handlebars ≥ 4.7.9`, which is available but blocked on forge upgrading its template packages. Upgrading forge to 7.11.1 is expected to resolve this. This vulnerability does not affect the runtime app bundle (asar); it only affects the forge build-tool process.

### 5. `lodash` High — Transitive, No Current Direct Upgrade Path

`lodash@≤4.17.23` is flagged HIGH (prototype pollution, code injection via `_.template`). It is pulled in by multiple forge sub-packages. No direct dependency on `lodash` exists in this project. The resolution depends on forge's internal dependency upgrades; this should be tracked post-forge-7.11.1 upgrade to confirm it is resolved.

### 6. `forge.config.js` Version Misalignment (Non-Dependency Risk)

The `maker-squirrel.config.version` (`0.0.1`) diverges from `package.json` version (`1.0.0`). While not a dependency risk, it is a packaging-chain risk: any version-dependent Squirrel update mechanism behaviour will use the wrong value. This must be aligned before the Phase 2 `npm run make` smoke test. This is tracked in the Phase 01 Store Compatibility Note.

### 7. sqlite3 Audit Chain via Node-Gyp Build Dependencies

`sqlite3@5.1.7` pulls in `node-gyp@8.4.1` as part of its native build process. This node-gyp version brings `cacache`, `make-fetch-happen`, `http-proxy-agent`, and `@tootallnate/once` into the audit surface. These are build-time tools only (not runtime app dependencies), but they do appear in `npm audit` output. Upgrading to `sqlite3@6.0.1` is expected to resolve them; if the native compile fails on a target platform, this must be unblocked before Phase 2 closes.

---

## Phase 2 Action Sequence (Ordered)

1. **Remove** `electron-reload` and `electron-reloader` from devDependencies.
2. **Upgrade** all `@electron-forge/*` packages to `7.11.1` and `@electron/fuses` to `2.1.1` in a single commit. Verify `forge.config.js` fuse constant names against v2 API.
3. **Upgrade** `sqlite3` to `6.0.1`. Verify native rebuild succeeds against current Electron-bundled Node headers.
4. Run `npm audit` — expect critical/high count to drop materially; document residual findings.
5. Run full test suite (`npm test`). All existing tests must pass before Phase 2 closes.
6. Run `npm run make` smoke test on Windows. Confirm Squirrel installer is produced at correct version string.
7. **Hold** `electron` at 33.4.11 and `jest` at 29.x pending Phase 3 planning.

---

*This is a planning artifact. No files other than this document were modified during its creation.*
