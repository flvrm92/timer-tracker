# Phase 04 - Electron and Native Runtime Upgrade

## Objective and Scope

Upgrade Electron and the runtime-sensitive dependencies, resolve code changes required by the new runtime, and prove that native storage dependencies work in both development and packaged Windows builds.

This is the highest-risk phase and must not start until the earlier safety gates are complete.

This phase includes:

- Upgrading Electron to the approved target stable version.
- Upgrading runtime-sensitive dependencies affected by the new Electron version.
- Validating or replacing the native SQLite dependency behind the existing database abstraction.
- Updating any Electron-specific code paths affected by breaking changes, default changes, or deprecations.
- Reconfirming secure window, preload, IPC, and renderer behavior after the runtime move.

## Deliverables

- Updated Electron dependency and aligned runtime-sensitive packages.
- Code changes required by the target Electron release.
- A validated native database path for development and packaged builds.
- A migration note describing any Electron breaking changes that affected the repo.
- Updated tests or validation harnesses covering the changed runtime behavior.

## Required Tasks

1. Upgrade Electron to the approved target version.
2. Upgrade runtime-adjacent packages that must move with Electron.
3. Rebuild and validate the native database dependency.
4. If native validation fails, execute the documented fallback strategy behind the current database abstraction instead of rewriting the app surface.
5. Review window creation, preload loading, IPC bridging, theme handling, and renderer interactions for compatibility issues.
6. Remove deprecated or unnecessary Electron configuration where explicit secure defaults are preferred.
7. Validate packaged Windows startup and a representative set of database-backed user flows.

## Validation Criteria Before Phase 05

- The full automated test suite passes on the upgraded runtime.
- Development startup succeeds on the upgraded runtime.
- The packaged Windows build launches on the upgraded runtime.
- Database initialization, migration, project creation, timer save, timer update, filtering, and CSV export all work.
- No unresolved native module load error remains.
- Any runtime warnings or deprecations introduced by the new Electron version are either resolved or explicitly accepted with documented rationale.

## Tests and Quality Checks

### Unit Tests

- Run the full unit suite against the upgraded runtime.
- Add or update tests for any preload, IPC, or utility behavior changed during the runtime migration.
- Add or update tests around configuration that was made explicit for security or compatibility reasons.

### Integration Tests

- Verify the main process, preload script, and renderer pages still initialize correctly.
- Verify database initialization succeeds with the upgraded runtime and the chosen native dependency path.
- Verify IPC request and response behavior is still correct under the target Electron version.
- Verify packaged build startup on Windows.

### Functional Validations

- Re-run the full regression checklist from Phase 01.
- Confirm project creation, timer start-stop, timer editing, filtering, theme switching, and CSV export all behave correctly.
- Confirm database persistence survives app restart on the upgraded runtime.

### Manual QA Steps

1. Launch the upgraded app in development mode.
2. Create both billable and non-billable projects.
3. Save timers for both project types.
4. Edit a timer and confirm duration and amount behavior are still correct.
5. Filter timers by date and project.
6. Export CSV and inspect the file contents.
7. Restart the app and confirm persisted data remains intact.
8. Launch the packaged Windows build and repeat a shortened but representative smoke test.

### Regression Validations

- Compare all workflow outcomes to the Phase 01 baseline.
- Confirm no baseline feature was lost or degraded during the runtime jump.
- Confirm any unavoidable behavior changes are documented and approved.

## Microsoft Store Readiness Considerations

- Ensure runtime changes do not require insecure Electron flags or elevated privileges.
- Keep preload isolation and IPC exposure narrow enough for long-term maintainability and Store-friendly security posture.
- Confirm database and file operations remain inside per-user boundaries appropriate for Store-distributed desktop software.
- Avoid runtime dependencies that are unusually fragile in packaged Windows environments or difficult to support in a signed Store build.