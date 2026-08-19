# Phase 05 - Store-Oriented Hardening and Packaging Readiness

## Objective and Scope

Harden the upgraded application for Windows distribution and make packaging, storage, and integration decisions that preserve a clean path to future Microsoft Store publication.

This phase focuses on distribution readiness, not just runtime correctness.

This phase includes:

- Reviewing packaging behavior, identity, signing expectations, and installer assumptions.
- Verifying storage, export, and user data behavior against Windows desktop distribution expectations.
- Confirming that future Store packaging can be introduced without redesigning the application.
- Documenting platform integrations, permissions, and user-facing behaviors that matter for Windows compliance and supportability.

## Deliverables

- A Windows packaging readiness checklist.
- A future Microsoft Store packaging strategy note describing the preferred distribution path, likely MSIX lane, signing requirements, and app identity implications.
- A packaging configuration review covering icons, naming, versioning, startup behavior, and installer hooks.
- A storage and file-access review covering database location, export location, and per-user permissions.
- A security and privacy note covering logging, crash diagnostics, local data, and update behavior.

## Required Tasks

1. Review current packaging outputs and identify which parts are installer-specific.
2. Define the future Windows Store packaging approach and the work needed to introduce it.
3. Verify all persistent application data stays within Windows-friendly per-user storage locations.
4. Verify CSV export uses explicit user-selected paths and does not assume unrestricted background access.
5. Review app naming, publisher naming, icons, and versioning for future Store consistency.
6. Review update strategy so the non-Store lane and future Store lane can coexist without conflicting behavior.
7. Review security-sensitive choices including preload exposure, file dialogs, local file writes, and any future telemetry plan.

## Validation Criteria Before Phase 06

- The packaging readiness checklist is complete.
- There is a documented path for introducing a Store-compatible packaging lane.
- No core workflow requires administrator elevation.
- Data storage and export behavior are compatible with per-user Windows distribution expectations.
- App identity and signing assumptions are documented.
- The upgraded packaged build still passes the functional smoke tests after packaging hardening decisions.

## Tests and Quality Checks

### Unit Tests

- Re-run the unit suite after any packaging-related code or configuration changes.
- Add tests only if packaging hardening introduces new code paths or guards.

### Integration Tests

- Verify packaged Windows startup after packaging-related adjustments.
- Verify the data layer can initialize and persist under packaged execution.
- Verify file export works through the user-selected save flow.

### Functional Validations

- Validate packaged startup, project management, timer flows, filtering, theme switching, and CSV export under the hardened packaging configuration.
- Validate app restart and data persistence under packaged execution.
- Validate that window behavior, menus, and dialogs remain usable in the packaged Windows app.

### Manual QA Steps

1. Install or launch the packaged Windows build.
2. Verify the app starts without elevation prompts.
3. Create and save timer data.
4. Export CSV to a user-chosen location.
5. Restart the app and verify data persistence.
6. Confirm menus, dialogs, and theme changes still function.
7. Review app assets, naming, and version presentation for distribution quality.

### Regression Validations

- Confirm packaging hardening did not regress any runtime workflow proven in Phase 04.
- Confirm all file writes and storage operations remain expected and traceable.
- Confirm the packaging strategy remains compatible with a later Store submission effort.

## Microsoft Store Readiness Considerations

- Prefer a future MSIX-compatible distribution lane over deep coupling to a traditional installer path.
- Plan for code signing and stable publisher identity even if Store submission is not immediate.
- Ensure auto-update strategy can be disabled, swapped, or segmented for a Store-distributed channel.
- Ensure no feature assumes unrestricted machine-level installation or global writable locations.
- Ensure privacy-sensitive behavior such as diagnostics, local storage, and exported data is easy to document for Store listing and support purposes.

---

## Phase 05 Execution Outcome and Close-Out Note

**Recorded:** 2026-05-08 (T5–T7 final pass)

### What was completed this phase

| Task | Outcome |
|------|---------|
| T1 — Initial packaging re-run and checklist bootstrap | DONE — `npm run package`, `npm run make`, artifact inventory, signing check, node-gyp SSH check, audit run; checklist populated |
| T2 — Storage, security, and privacy review | DONE — database location, export flow, elevation posture, fuses, preload surface, telemetry all reviewed; PASS with low-severity deferred items |
| T3 — Future Store packaging strategy | DONE — MSIX lane documented as deferred; Squirrel lane confirmed as sole current distribution path |
| T4 — Squirrel startup guard | DONE — `electron-squirrel-startup` wired in `src/main/index.js`; two new tests covering short-circuit and normal paths (82/82 tests pass) |
| T5 — Packaging polish check | DONE (no changes made) — confirmed no `.ico` asset and no signing certificate exist in the project tree; no `icon` or signing config present in `forge.config.js`; items 2.3 (icon) and 2.5 (signing) remain OPEN/DEFERRED without config changes; no packaging or config files modified |
| T6 — Final automated validation pass | DONE — `npm test` (82/82 PASS), `npm run package` (PASS), `npm run make` (PASS, DEP0187 warning unchanged), artifact inventory (RELEASES 83B / Setup.exe ~138.3 MB / .nupkg ~137.6 MB), packaged EXE starts (4-process tree confirmed), `Get-AuthenticodeSignature` (NotSigned, expected), `npm audit --production` (1 high: tar-fs GHSA-vj76-c3g6-qr5v via sqlite3, unchanged), SSH node-gyp lockfile (still present at lines 1396/1398/1579, unchanged) |
| T7 — Documentation close-out | DONE — manual smoke gate documented in checklist Section 5; this close-out note added to spec; storage/security review T6 re-validation note appended; README updated to remove stale MSIX/Phase 05 reference and correct test count |

### What was intentionally deferred

| Item | Reason | Target |
|------|--------|--------|
| Application icon (`.ico`) | No asset exists; creation requires a design step | Pre-public Squirrel release / pre-Store |
| Code signing certificate | No cert or signing config exists; requires external cert acquisition | Pre-public Squirrel release / pre-Store |
| `productName` in `forge.config.js` | No breaking impact but no asset to pair with yet; deferred with icon | Pre-Store |
| `npm audit fix` for tar-fs | Not applied; risk of native build breakage not assessed | Phase 06+ |
| IPC channel hardening (S-01/S-02) | Low severity; no attack surface given local-only renderer content | Phase 06+ |
| MSIX/Store packaging lane | Explicitly out of scope for Phase 05 | Future phase |
| Human packaged GUI smoke | Cannot be completed in an automated agent environment | **Required before Phase 06** |

### Human packaged GUI smoke — required before Phase 06

**This is the sole remaining gate to close Phase 05.**

A human tester must run the interactive smoke tests documented in the packaging readiness checklist (Section 5, items 1–10) against the current packaged build (`out\time-tracker-win32-x64\time-tracker.exe`) and optionally against the Squirrel installer (`out\make\squirrel.windows\x64\time-tracker-1.0.0 Setup.exe`).

Until that sign-off is recorded, Phase 05 status is **CONDITIONAL PASS** — all automated gates are green but the interactive GUI has not been verified against the hardened packaged build.