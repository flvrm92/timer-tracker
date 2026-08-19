# Phase 02 - Coverage Expansion and Dependency Strategy

## Objective and Scope

Expand the validation safety net before high-risk upgrades and define the dependency strategy that will govern the implementation. This phase exists to reduce guesswork: upgrade-sensitive areas must be covered by tests or by an explicit manual gate before versions change.

This phase includes:

- Adding or planning targeted coverage for preload, main-process startup, IPC contracts, and renderer-sensitive flows.
- Defining the target versions for Electron, Forge, Jest, native dependencies, and development-only tooling.
- Deciding how to handle the native SQLite dependency if it blocks the Electron upgrade.
- Recording Windows Store-oriented architecture constraints that affect packaging, update strategy, storage, and security.

This phase may include low-risk test additions and planning docs, but it does not yet upgrade the main runtime stack.

## Deliverables

- A target dependency matrix with current version, target version, upgrade rationale, and risk level.
- A native dependency decision note covering the preferred `sqlite3` path and the fallback replacement path.
- Added or planned tests for the preload bridge, startup, IPC event flow, and renderer-facing behaviors that are most exposed to Electron changes.
- A validation matrix that maps each critical user workflow to automated or manual verification.
- A Store compatibility checklist covering packaging model, code signing expectations, storage behavior, update behavior, permissions, and privacy.

## Required Tasks

1. Define the exact Electron target version and the Node.js floor it requires.
2. Define the exact Forge package targets and whether all Forge packages will move together.
3. Audit all runtime and development dependencies for age, maintenance status, and compatibility risk.
4. Decide whether unused or duplicated development tooling should be removed before the runtime upgrade.
5. Expand coverage around preload APIs and application startup paths.
6. Expand coverage around IPC flows that drive projects, timers, themes, and export behavior.
7. Formalize the fallback path if the native SQLite dependency fails rebuild or packaging validation.

## Validation Criteria Before Phase 03

- The target version matrix is complete and approved.
- Coverage gaps that could hide upgrade regressions are either closed or converted into explicit manual QA gates.
- The fallback strategy for the native database dependency is documented.
- Store-oriented architectural constraints are documented and accepted.
- The current test suite plus any new targeted tests pass on the baseline stack.

## Tests and Quality Checks

### Unit Tests

- Add or define tests for the preload contract so exposed browser globals remain explicit and stable.
- Add or define tests for helper logic that may be affected by runtime serialization or IPC behavior.
- Add or define tests for configuration handling and guard-rail utilities introduced during the upgrade.

### Integration Tests

- Add or define a startup smoke test for the main process and preload loading path.
- Add or define IPC contract tests for project retrieval, timer retrieval, timer update, timer delete, theme change, and CSV export messaging.
- Verify database initialization and schema migration behavior remain deterministic.

### Functional Validations

- Re-run the Phase 01 functional baseline with the additional validation checklist in place.
- Confirm no new tests or instrumentation change runtime behavior.
- Confirm the app still behaves identically on the current dependency stack after test harness additions.

### Manual QA Steps

1. Launch the app after adding coverage-related changes.
2. Confirm the preload-powered renderer features still function.
3. Confirm timer workflows, project workflows, and CSV export still behave exactly as in Phase 01.
4. Confirm no new console errors or warnings were introduced by the added validation scaffolding.

### Regression Validations

- Compare the updated test and workflow coverage map to the Phase 01 checklist.
- Ensure each critical workflow has either automated coverage, an integration check, or a documented manual gate.
- Confirm no baseline behavior changed during test expansion.

## Microsoft Store Readiness Considerations

- Ensure preload APIs expose only the minimum surface needed for UI features.
- Avoid designing new renderer contracts that would force insecure Electron settings later.
- Document how the app will behave if future Store packaging removes assumptions tied to installer-specific update hooks.
- Decide early whether any package metadata, app naming, icons, or file locations need to be stabilized for eventual Store identity.