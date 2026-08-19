# Phase 03 - Tooling and Packaging Foundation

## Objective and Scope

Upgrade and simplify the build and development tooling in a controlled checkpoint before changing the Electron runtime itself. The purpose of this phase is to separate tooling failures from runtime failures.

This phase includes:

- Upgrading Electron Forge packages as a coherent set.
- Reviewing packaging configuration for current Windows behavior and future Store compatibility.
- Simplifying or removing duplicated development reload tooling that can obscure runtime issues.
- Verifying scripts and packaging commands remain stable after tooling changes.

This phase should not introduce the final Electron major upgrade yet unless the tooling package requires a coordinated change that is already validated and isolated.

## Deliverables

- Updated Forge dependencies and packaging scripts.
- A reviewed Forge configuration with documented Windows packaging expectations.
- A simplified development reload strategy with unused packages removed or disabled.
- A packaging note describing how the current installer path will coexist with a future Microsoft Store path.
- An updated developer workflow note for install, test, start, package, and make.

## Required Tasks

1. Upgrade all Forge packages together to the approved target series.
2. Verify the Forge plugins used by the repo remain compatible with the target runtime plan.
3. Review packaging settings such as app name, versioning, makers, native module unpacking, and installer metadata.
4. Remove duplicated reload tooling or temporarily disable reload behavior that is not upgrade-safe.
5. Validate that packaging still works on Windows with the current runtime.
6. Document the separation between internal installer behavior and future Store packaging behavior.

## Validation Criteria Before Phase 04

- All Forge package updates install cleanly.
- Development startup still works on Windows.
- The automated test suite still passes.
- Packaging commands succeed with the updated tooling.
- No dev reload package or packaging helper introduces blocking warnings or runtime instability.
- The current packaging configuration is documented with a future Store transition note.

## Tests and Quality Checks

### Unit Tests

- Run the full unit suite after tooling updates.
- Add or update tests only if a tooling-related code change alters application initialization or environment handling.

### Integration Tests

- Verify the application can still launch through the standard development script.
- Verify packaging commands complete with the updated Forge stack.
- Verify native module unpack behavior remains configured for packaged Windows builds.

### Functional Validations

- Launch the application with the updated tooling and re-run the core baseline workflows.
- Confirm menus, preload-driven features, database operations, and export behavior still work.
- Confirm packaged output starts and exercises at least one database-backed workflow.

### Manual QA Steps

1. Perform a clean install with the updated tooling.
2. Start the app and confirm the first window loads correctly.
3. Navigate across all pages and confirm no reload helper interferes with normal interaction.
4. Package the app and launch the packaged build.
5. Confirm the packaged build can create a project and save a timer.

### Regression Validations

- Compare the toolchain outputs to the Phase 01 baseline.
- Confirm there are no new failures that are purely tooling-induced.
- Confirm packaging and startup logs are cleaner or unchanged after simplification.

## Microsoft Store Readiness Considerations

- Avoid new hard dependencies on Squirrel-specific install behavior that would be difficult to reproduce in MSIX.
- Keep app identity fields stable and document which values will later need to align with Store publisher metadata.
- Keep packaging configuration modular so a Store-specific packaging lane can be added without rewriting the application.
- Ensure future Store packaging can coexist with the current non-Store packaging lane.

---

## Phase 03 Execution Outcome

**Validation date:** 2026-05-07  
**Gate result:** PASS — all automated gates satisfied. Human smoke test (hands-on GUI workflow) remains pending before Phase 04 start.  
**Validation evidence:** [phase-03-windows-validation-report.md](phase-03-windows-validation-report.md)

### What Was Completed

| Item | Outcome |
|---|---|
| Forge packages upgraded to 7.11.1 (`@electron-forge/cli`, makers, plugins) | Done |
| `@electron/fuses` kept on compatible 1.x — downgraded `^2.1.1` → `^1.8.0` to satisfy `plugin-fuses` peer range | Done — no API change required |
| Non-Windows makers removed from `forge.config.js` | Done |
| Packaging identity aligned: `package.json` name `time-tracker` / version `1.0.0`; Squirrel maker name `time-tracker` | Done — `my_app/0.0.1` fully eliminated |
| Runtime reload package reliance removed from `src/main/index.js` | Done — `electron-reloader` / `electron-reload` are no longer invoked at startup |

### Key Decisions

- **`@electron/fuses` 1.x vs 2.x:** `@electron-forge/plugin-fuses@7.11.1` declares peer `@electron/fuses@^1.0.0`. Keeping `^2.1.1` caused a strict-mode `ERESOLVE` on `npm ci`. Downgrading to `^1.8.0` resolved the conflict; all packaging commands succeeded identically. Fuses are applied at package time only; no runtime impact.
- **Squirrel as sole current packaging lane:** Only `maker-squirrel` is configured. Non-Windows makers were removed to keep the configuration unambiguous. The MSIX/Store lane is explicitly deferred.
- **Reload tooling removed:** `electron-reloader` and `electron-reload` remain in `package.json` devDependencies (they are not invoked) but their call site in `src/main/index.js` was removed. Restart `npm start` to pick up main-process changes during development.

### Carry-Forwards to Later Phases

| Item | Target Phase |
|---|---|
| SSH `git+ssh://` URL for `@electron/node-gyp` in `package-lock.json` — CI environments without SSH git credentials will fail `npm ci` | Phase 04 (or when `@electron/rebuild` releases a registry-based pin) |
| MSIX / Microsoft Store identity, signing, manifest, and packaging lane setup | Phase 05 |
| sqlite3 major upgrade | Phase 04 |
| Human smoke test (launch packaged EXE, create project, start/stop timer, export CSV) | Before Phase 04 gate |