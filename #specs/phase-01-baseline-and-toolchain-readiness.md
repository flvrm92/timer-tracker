# Phase 01 - Baseline and Toolchain Readiness

## Objective and Scope

Establish a reproducible baseline for the current application before any dependency upgrade begins. This phase creates the factual reference point for runtime behavior, packaging behavior, data behavior, and validation behavior.

This phase includes:

- Confirming the Node.js and npm versions that will be used for the upgrade effort.
- Verifying that clean installs and existing scripts work from the current branch.
- Capturing current dependency, packaging, and runtime behavior on Windows.
- Defining the regression checklist that all later phases must pass.
- Identifying current Windows packaging assumptions that may affect future Microsoft Store distribution.

This phase does not include modifying Electron, Forge, or application logic.

## Deliverables

- A confirmed toolchain baseline with the required Node.js version for the target Electron release.
- A validated clean-install path using the repo lockfile.
- A dependency inventory that records current versions, native modules, and packaging-related packages.
- A baseline Windows smoke-test report covering startup, navigation, storage, CSV export, theme changes, and shutdown.
- A baseline packaging smoke-test report for the current app version.
- A phase-specific regression checklist that becomes the minimum gate for all later phases.
- A current-state Store compatibility note listing known future concerns such as installer strategy, package identity, signing, and update model.

## Required Tasks

1. Confirm the upgrade work will use a Node.js version supported by the target Electron major.
2. Run a clean install from the lockfile and verify dependency restoration on Windows.
3. Run the current automated tests and record results.
4. Launch the current app in development mode and walk through core user workflows.
5. Produce a packaged Windows build with the current stack and confirm it starts.
6. Record any current warnings, deprecations, native rebuild messages, or packaging anomalies.
7. Confirm that application data is stored in a per-user location compatible with Windows desktop distribution expectations.

## Validation Criteria Before Phase 02

All items below must be true before Phase 02 begins:

- Clean install succeeds with the selected Node.js toolchain.
- The existing automated test suite passes.
- Development startup succeeds without unexpected runtime crashes.
- The current packaged Windows build launches.
- The baseline regression checklist is written and accepted as the shared gate for later phases.
- Current Windows distribution concerns are documented, including any assumptions tied to Squirrel, installer events, package naming, or update behavior.

## Tests and Quality Checks

### Unit Tests

- Run the existing unit tests without changing dependency versions.
- Confirm database, IPC, and utility tests are green.
- Record gaps where current unit coverage does not protect upgrade-sensitive behavior.

### Integration Tests

- Verify the main process loads the preload script successfully in development.
- Verify the SQLite-backed data layer initializes without native module errors.
- Verify IPC-driven data retrieval works for projects and timers during startup.

### Functional Validations

- Launch the timer page and confirm project selection and timer start-stop behavior.
- Launch the projects page and confirm project creation and deletion flow.
- Launch the timers page and confirm filtering, editing, deletion, and CSV export flow.
- Verify theme switching behavior from the application menu.

### Manual QA Steps

1. Start the app in development mode.
2. Create a standard project.
3. Create a billable project.
4. Start and stop a timer for each project type.
5. Open the timers view and edit an entry.
6. Filter timers by project and date.
7. Export timers to CSV.
8. Restart the app and confirm persisted data is still present.
9. Package the app and repeat a shortened smoke test in the packaged build.

### Regression Validations

- Save the observed outputs and pass-fail results from every core workflow.
- Record the exact commands used for install, test, start, package, and make.
- Record any current behavior that is fragile but still accepted, so later phases do not accidentally normalize a bug as expected behavior.

## Microsoft Store Readiness Considerations

- Confirm no baseline flow depends on administrator rights.
- Confirm data is written only to user-scoped locations.
- Identify any installer-coupled behavior that would need abstraction before moving to MSIX or Store packaging.
- Record current package identity fields that may later need to align with a Store publisher and package family name.