# Phase 06 - Release Candidate, Rollout, and Rollback

---

## T06-1 Kickoff Status — Release-Anchor Preflight

**Executed:** 2026-05-08  
**Task result:** PASS

### Release-Anchor Facts

| Fact | Value |
|------|-------|
| HEAD commit | `5982a1cc8a5819cdd1b9308e8e529f4ce46adbe7` |
| Worktree state | **DIRTY** |
| Release tags | **NONE** |

**Dirty worktree detail (git status --short):**

```
 M README.md
 M forge.config.js
 M jest.config.js
 M package.json
 M src/main/index.js
 M tests/database.test.js
 M tests/ipcHandlers.test.js
?? #specs/
?? tests/main.index.test.js
?? tests/preload.test.js
```

> **Note:** The worktree must be committed and cleaned before producing the final release candidate build in T06-2. No release-anchoring tag has been set yet.

### Earlier Phase Artifact Check

| Artifact | Present |
|----------|---------|
| `#specs/phase-03-windows-validation-report.md` | YES |
| `#specs/phase-04-windows-validation-report.md` | YES |
| `#specs/phase-05-packaging-readiness-checklist.md` | YES |
| `#specs/phase-05-storage-security-privacy-review.md` | YES |
| `#specs/phase-05-store-oriented-hardening-and-packaging-readiness.md` | YES |

All required earlier-phase artifacts are present.

### Carried Gate — Phase 05 Packaged GUI Smoke

**Final RC approval is blocked until the Phase 05 packaged GUI smoke gate is satisfied.**  
That gate requires a manual end-to-end workflow verification (project creation → timer → CSV export → restart → persistence check) against the packaged `.exe` artifact. It was carried forward from Phase 05 as an open item. T06-4 is the designated closure point for this gate.

### Phase 06 Gate Matrix

| Task | Description | Gate dependency | Status |
|------|-------------|-----------------|--------|
| T06-1 | Kickoff, release-anchor preflight | None | **DONE** |
| T06-2 | Commit/clean worktree, produce RC build | Dirty worktree must be resolved | PENDING |
| T06-3 | Full automated regression suite on RC | T06-2 complete | PENDING |
| T06-4 | Packaged startup + full workflow smoke | T06-2 complete; **Phase 05 GUI smoke gate** | PENDING |
| T06-5 | Rollback plan documented and verified | T06-3, T06-4 | PENDING |
| T06-6 | Accepted limitations and deferred items recorded | T06-4 | PENDING |
| T06-7 | Post-release monitoring window defined | T06-5, T06-6 | PENDING |

RC sign-off requires T06-3 through T06-7 green and the Phase 05 GUI smoke gate closed.

---

## Provisional Consolidation — 2026-05-08

> **Status: PROVISIONAL — not final Phase 06 closure. Two hard blockers remain (see §7 below).**

### 1. Current Phase 06 Status

Phase 06 has been partially executed. T06-1 is complete. T06-2 through T06-7 remain pending. Sufficient evidence has been gathered during this session to produce a provisional go/no-go assessment for an internal pilot scope only. Final RC sign-off is explicitly not claimed here.

### 2. Release-Anchor Facts — Why the RC Is Still Provisional

| Fact | Value |
|------|-------|
| HEAD commit | `5982a1cc8a5819cdd1b9308e8e529f4ce46adbe7` |
| Worktree state | **DIRTY** — modified tracked files and untracked `#specs/`, `tests/main.index.test.js`, `tests/preload.test.js` |
| Release tags | **NONE** |

The release candidate build was produced from a dirty worktree. The HEAD hash above is the rollback anchor candidate recorded for this session, but it cannot serve as a source-reproducible release anchor until the worktree is committed and a release tag is applied. Any build from a dirty worktree is not strictly reproducible.

### 3. Automated Validation Evidence

| Check | Result |
|-------|--------|
| Automated test suite | **82/82 tests pass** |
| Packaged startup | **PASS** (manual observation, provisional session only) |
| Installer signing | **UNSIGNED** — no code-signing certificate applied |
| `npm audit --production` | `tar-fs` **HIGH advisory present** |
| SSH `@electron/node-gyp` in lockfile | **PRESENT** — sourced from `@electron/rebuild@3.7.2` inside Forge/core-utils, not from sqlite3 or production deps |

All evidence is provisional because it was gathered against a dirty, untagged worktree. A clean commit + release tag + fresh `npm ci` + rebuild is required to produce a properly anchored RC build for final validation.

### 4. Rollback Anchor and Artifact-Hash Evidence

- **Rollback anchor candidate:** HEAD `5982a1cc8a5819cdd1b9308e8e529f4ce46adbe7`
- **Caveat:** This is a pre-commit snapshot from a dirty worktree. The authoritative rollback anchor must be the tag applied after the clean commit in T06-2.
- **User-data location:** `%APPDATA%\time-tracker` (resolved by `app.getPath('userData')`). The SQLite database is local to the user profile and is not touched by a binary rollback. Restoring a prior `.exe` does not require any data migration or rollback step.
- **Artifact hashes:** Not yet recorded. Artifact-hash capture is a T06-2 deliverable and cannot be finalized from a dirty-worktree build.

### 5. Accepted Limitations vs. Unresolved Blockers

#### Accepted for Internal Pilot — Owner Must Explicitly Accept Risk Before Distribution

| Limitation | Disposition |
|------------|-------------|
| Unsigned installer | Acceptable for internal pilot only. Windows SmartScreen warning is expected on first run. **Not acceptable for public or Microsoft Store distribution.** |
| `tar-fs` HIGH advisory | Transitive dev-path dependency (Forge packaging pipeline); not present in the production runtime. Owner must explicitly acknowledge before pilot distribution. |
| SSH `@electron/node-gyp` in lockfile | Sourced from `@electron/rebuild@3.7.2` inside Forge; not a production runtime dependency. Accepted as-is; tracked as a future cleanup item when a Forge or rebuild upgrade removes it. |

#### Unresolved Blockers — RC Is Not Final

| Blocker | Required Action |
|---------|----------------|
| Dirty/untagged worktree | Commit all changes, apply a release tag (e.g., `v1.0.0-rc.1`), run `npm ci`, produce a fresh build from the clean tagged commit (T06-2). |
| Human packaged GUI smoke sign-off | A human must execute the full end-to-end workflow (project creation → timer start/stop → CSV export → app restart → persistence check) against the packaged `.exe` and explicitly confirm PASS (T06-4). This gate is carried forward from Phase 05 as a hard RC approval requirement. |

### 6. Post-Release Observation Window Recommendation

After a clean RC build is approved and distributed to the internal pilot audience:

- Observe for **7 calendar days** before treating the release as stable.
- **Rollback trigger symptoms:** startup crash or hang on any target machine; database corruption or missing records after the update; CSV export producing malformed or empty output; any unhandled exception surfaced at startup.
- **Rollback procedure:** Replace the installed `.exe` with the prior Squirrel artifact. No database migration is required for a binary-only rollback because user data remains in `%APPDATA%\time-tracker`.
- **Log collection:** Capture `%APPDATA%\time-tracker\logs\` from any machine reporting an issue and attach to the incident record.

### 7. Current Go/No-Go Statement

**PROVISIONAL NO-GO for final RC release.**

The application is technically functional: 82/82 automated tests pass and a packaged startup has been observed to succeed. However, final RC sign-off is blocked by two hard gates that have not been satisfied:

1. **Dirty/untagged worktree** — a source-reproducible release anchor does not yet exist.
2. **Human packaged GUI smoke sign-off not obtained** — T06-4 is PENDING.

Additionally, the unsigned installer and the `tar-fs` HIGH advisory make this build **unsuitable for public or Microsoft Store distribution** without further remediation. Internal pilot distribution is within scope only if the owner explicitly accepts those two risks before distributing.

**Final RC sign-off requires:** clean commit + release tag + fresh `npm ci` build + 82/82 automated tests on the tagged build + human GUI smoke PASS confirmed.

---

## Objective and Scope

Convert the upgraded and hardened application into a releasable artifact with clear rollout gates, rollback criteria, and post-release validation. This phase ensures the upgrade is not only technically complete, but operationally safe.

This phase includes:

- Producing a release candidate build from the upgraded stack.
- Finalizing validation evidence from all earlier phases.
- Preparing rollback steps in case the release candidate fails in real usage.
- Preparing support and monitoring expectations for the post-upgrade window.

## Deliverables

- A release candidate build for Windows.
- A final validation report that references completion of all phase gates.
- A rollback plan covering dependency rollback, build rollback, and packaged artifact rollback.
- A short release note describing toolchain changes, runtime changes, and any user-visible behavior changes.
- A post-release monitoring checklist for startup, storage, export, and crash-risk areas.

## Required Tasks

1. Produce a clean release candidate from the final upgraded branch.
2. Re-run the full regression checklist against the release candidate.
3. Confirm packaged startup and critical workflows again using the final artifact.
4. Prepare exact rollback steps to return to the last known-good stack.
5. Document any accepted limitations, deferred items, or future Store-related follow-up work.
6. Define the short post-release observation window and the symptoms that should trigger rollback.

## Validation Criteria for Plan Completion

- All earlier phase gates are satisfied and recorded.
- The release candidate passes the complete automated suite.
- The release candidate passes the complete manual regression checklist on Windows.
- The rollback plan is specific, tested, and executable.
- The final artifact is acceptable for ongoing Windows distribution and does not block the future Microsoft Store path.

## Tests and Quality Checks

### Unit Tests

- Run the full unit suite on the release candidate branch.
- Confirm no flaky or newly skipped tests remain unresolved.

### Integration Tests

- Run the complete integration suite or equivalent startup and IPC validation checks.
- Confirm packaged build startup and database initialization in the release candidate artifact.

### Functional Validations

- Re-run the full user-flow checklist using the release candidate build.
- Confirm all critical features remain intact after final packaging and release preparation.

### Manual QA Steps

1. Install or launch the release candidate build.
2. Execute the full workflow checklist from project creation through CSV export.
3. Restart the app and confirm persistence.
4. Confirm no unexpected prompts, crashes, or missing assets appear.
5. Confirm release metadata, versioning, and packaging presentation are correct.

### Regression Validations

- Compare the release candidate to the Phase 01 baseline and the Phase 04 upgraded baseline.
- Confirm no unresolved blocker remains in startup, data, export, theming, or packaging.
- Confirm the upgrade can be reversed without data-loss surprises if rollback becomes necessary.

## Microsoft Store Readiness Considerations

- Confirm the release candidate does not harden any choice that would block a future MSIX or Store packaging lane.
- Carry forward the documented Store preparation items as post-upgrade backlog rather than leaving them implicit.
- Ensure release notes and support notes capture any Windows packaging or signing assumptions that matter for future Store publication.