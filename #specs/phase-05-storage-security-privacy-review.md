# Phase 05 — Storage, Security, and Privacy Review

**Task:** Phase 05 Task T2 (T6 re-validation 2026-05-08)  
**Review date:** 2026-05-08 (refreshed: T2 initial; T6 re-validation 2026-05-08 ~16:10 — no source changes since T2; all findings and statuses confirmed unchanged)  
**Scope:** `src/main/index.js`, `src/main/ipcHandlers.js`, `src/infra/database.js`, `src/settings/preload.js`  
**Status:** PASS — no blocking issues; one low-severity hardening note recorded. T6 re-validation confirmed no regressions and no new surface.

---

## 1. Storage Behavior

### Database location

```
index.js:4  process.env.DB_PATH = path.join(app.getPath('userData'), 'timers.db');
database.js:3  const dbPath = process.env.DB_PATH;
```

- The SQLite database (`timers.db`) is written exclusively to `app.getPath('userData')`.
- On Windows this resolves to `%APPDATA%\<app-name>\timers.db` — a per-user, non-elevated location.
- No write path deviates from this root under any observed code path.
- The database module reads `DB_PATH` from the environment; it does not construct any fallback path independently.

### Schema

| Table            | Purpose                              | Schema version     |
|------------------|--------------------------------------|--------------------|
| `projects`       | Project name, billable flag, rate    | v0 → v1 (applied)  |
| `timers`         | Timer records, amounts, FK to project| v0 → v1 (applied)  |
| `schema_version` | Migration watermark                  | v1 (effective)     |

- `CURRENT_SCHEMA_VERSION = 2` is declared in `database.js` but the v1→v2 migration block exists only as a stub (`callback(null)` with no schema change and no call to `setSchemaVersion`). The effective applied version in any database will be 1.
- The v0→v1 migration is additive (`ALTER TABLE … ADD COLUMN`) and idempotent (`duplicate column name` errors are swallowed safely).
- All DB queries use parameterised statements throughout — no string interpolation into SQL. SQL injection risk is **not present**.

### Decision recorded — storage root must not change this phase

Changing `app.getPath('userData')` would silently orphan all existing user data. The `app.name` / `productName` that governs the subdirectory name within `%APPDATA%` must remain stable unless a deliberate, user-visible migration path is implemented. This phase explicitly defers any app-identity renaming to a future, dedicated task.

---

## 2. Export Behavior

```
ipcHandlers.js:164  const result = await dialog.showSaveDialog({ … });
ipcHandlers.js:174  fs.writeFileSync(result.filePath, csvContent, 'utf8');
```

- CSV export is entirely user-initiated and user-directed.
- `dialog.showSaveDialog` is called before any write; `result.canceled` is checked before proceeding.
- `fs.writeFileSync` is called only when `!result.canceled && result.filePath` — no background or silent writes.
- No default export path is assumed; no write occurs to a system directory or to `userData` on behalf of the user.
- This behavior is fully compatible with per-user Windows distribution and Store packaging expectations.

---

## 3. Elevation Requirements

**None.** Every storage and export path operates within per-user scope:

| Operation        | Location                   | Elevation required? |
|------------------|----------------------------|---------------------|
| DB open/create   | `%APPDATA%\<app>\timers.db`| No                  |
| DB read/write    | Same per-user file         | No                  |
| CSV export write | User-selected via dialog   | No                  |
| App launch       | Normal user session        | No                  |

No installer hooks, no registry writes outside HKCU, and no auto-updater are present in the current codebase. No feature triggers a UAC prompt.

---

## 4. Preload Surface and IPC Exposure Posture

### Window security options

```
index.js:12  devTools: !app.isPackaged,
index.js:13  contextIsolation: true,
index.js:14  nodeIntegration: false,
```

- `contextIsolation: true` and `nodeIntegration: false` are correctly set. The renderer has no direct access to Node APIs.
- DevTools are disabled in packaged builds via `!app.isPackaged`.
- The application menu is also suppressed for packaged builds (`Menu.setApplicationMenu(null)`), removing the "Toggle DevTools" menu item from production.

### Preload surface — `contextBridge.exposeInMainWorld`

| Namespace     | Methods exposed                          | Pattern       |
|---------------|------------------------------------------|---------------|
| `ipcRenderer` | `send(channel, data)`, `on(channel, cb)` | Generic pass-through |
| `darkMode`    | `toggle()`, `system()`, `setTheme(theme)`, `getTheme()` | Specific, validated |

**Finding (low severity):** The `ipcRenderer` namespace exposes a generic `send` and `on` with no channel whitelist. Any renderer-side code can invoke `ipcRenderer.send` with an arbitrary channel string and reach any `ipcMain.on` handler. In the current application, all renderer HTML/JS files are local, bundled assets with no remote content and no `webSecurity: false` override. The practical attack surface is minimal. However, a future hardening pass should replace the generic `ipcRenderer` bridge with per-feature, explicitly named methods (e.g., `window.timerApi.saveTimer(…)`) to enforce least-privilege IPC.

**`darkMode` namespace:** The `dark-mode:set` handler on the main side validates the theme value against an allowlist (`['light', 'dark', 'system']`) before acting, throwing on invalid input. This is the correct pattern.

### Registered IPC channels

| Channel           | Type      | Handler location        |
|-------------------|-----------|-------------------------|
| `add-project`     | `ipcMain.on`    | ipcHandlers.js       |
| `delete-project`  | `ipcMain.on`    | ipcHandlers.js       |
| `get-projects`    | `ipcMain.on`    | ipcHandlers.js       |
| `save-timer`      | `ipcMain.on`    | ipcHandlers.js       |
| `get-timers`      | `ipcMain.on`    | ipcHandlers.js       |
| `update-timer`    | `ipcMain.on`    | ipcHandlers.js       |
| `delete-timer`    | `ipcMain.on`    | ipcHandlers.js       |
| `export-csv`      | `ipcMain.on`    | ipcHandlers.js       |
| `dark-mode:toggle`| `ipcMain.handle`| ipcHandlers.js       |
| `dark-mode:system`| `ipcMain.handle`| ipcHandlers.js       |
| `dark-mode:set`   | `ipcMain.handle`| ipcHandlers.js       |
| `dark-mode:get`   | `ipcMain.handle`| ipcHandlers.js       |

- All handlers are registered in `setupIpcHandlers()`, called once from `index.js` at startup.
- Date range inputs to `get-timers` and `export-csv` are validated (`startDate > endDate` guard) before database queries.
- `update-timer` parses and validates both timestamps with `Date` constructor and checks `duration >= 0` before writing.

---

## 5. Telemetry and Crash Reporting

**None present.**

Validation command result:
```
Select-String -Path .\src\main\index.js, .\src\main\ipcHandlers.js, .\src\settings\preload.js, .\src\infra\database.js `
  -Pattern 'userData|showSaveDialog|writeFileSync|contextBridge|ipcMain.handle|crashReporter|autoUpdater|http://|https://'
→ Matches: userData (index.js:4), showSaveDialog (ipcHandlers.js:164), writeFileSync (ipcHandlers.js:174),
   contextBridge (preload.js:1,3,8), ipcMain.handle (ipcHandlers.js:184,190,195,206)
→ No matches for: crashReporter, autoUpdater, http://, https://
```

- No `crashReporter` is initialised or referenced in any source file.
- No `autoUpdater` module is imported or configured.
- `electron-squirrel-startup` is listed as a runtime dependency in `package.json` but is **not imported or invoked** in `src/main/index.js`. It produces no hooks at runtime in the current entry point. Its presence as a dependency has no active effect and carries no privacy implication.
- No outbound HTTP/HTTPS calls exist in any source file.
- No analytics, metrics, or session tracking of any kind is present.

This is the correct posture for a local-first personal productivity tool. No privacy declaration for telemetry will be required for a Store listing at this time.

---

## 6. Store-Relevant Privacy and Security Implications

| Concern                          | Current state                        | Store compatibility |
|----------------------------------|--------------------------------------|---------------------|
| Data storage location            | Per-user `%APPDATA%`                 | Compatible          |
| Elevation requirement            | None                                 | Compatible          |
| Background file writes           | None                                 | Compatible          |
| Outbound network calls           | None                                 | Compatible          |
| Crash/diagnostic telemetry       | None                                 | Compatible (no disclosure needed) |
| Auto-update mechanism            | None                                 | Compatible (Store manages updates) |
| DevTools in packaged build       | Disabled (`devTools: !app.isPackaged`)| Compatible         |
| Node integration in renderer     | Disabled                             | Compatible          |
| Context isolation                | Enabled                              | Compatible          |
| Export to user-chosen location   | Via `showSaveDialog`                 | Compatible          |
| Broad IPC channel surface (preload) | Generic pass-through (see §4)     | Low risk today; harden before Store |

The application contains no machine-level writes, no background network activity, no telemetry, and no persistent credentials. It reads and writes only user-owned files. The privacy surface is minimal and straightforward to describe in any Store listing or support documentation.

---

## 7. Validation Command Summary

```powershell
Select-String -Path .\src\main\index.js, .\src\main\ipcHandlers.js, .\src\settings\preload.js, .\src\infra\database.js `
  -Pattern 'userData|showSaveDialog|writeFileSync|contextBridge|ipcMain.handle|crashReporter|autoUpdater|http://|https://'
```

Matches confirmed:

| File              | Line | Pattern matched    | Assessment                     |
|-------------------|------|--------------------|--------------------------------|
| index.js          | 4    | `userData`         | Correct per-user DB path       |
| ipcHandlers.js    | 164  | `showSaveDialog`   | User-directed export dialog    |
| ipcHandlers.js    | 174  | `writeFileSync`    | Write to user-chosen path only |
| ipcHandlers.js    | 184  | `ipcMain.handle`   | dark-mode:toggle               |
| ipcHandlers.js    | 190  | `ipcMain.handle`   | dark-mode:system               |
| ipcHandlers.js    | 195  | `ipcMain.handle`   | dark-mode:set (validated)      |
| ipcHandlers.js    | 206  | `ipcMain.handle`   | dark-mode:get                  |
| preload.js        | 1    | `contextBridge`    | Correct isolation usage        |
| preload.js        | 3    | `contextBridge`    | ipcRenderer namespace          |
| preload.js        | 8    | `contextBridge`    | darkMode namespace             |

No matches for `crashReporter`, `https://`, `http://`. No outbound network surface.

---

## 8. Open Items and Future Hardening

| ID   | Severity | Item                                                                                                        | Phase target |
|------|----------|-------------------------------------------------------------------------------------------------------------|--------------|
| S-01 | Low      | Replace generic `ipcRenderer.send/on` bridge with explicit per-channel named methods                        | Phase 06+    |
| S-02 | Low      | Add channel whitelist or per-handler input validation on data-mutation IPC handlers                         | Phase 06+    |
| S-03 | Info     | Implement or remove v1→v2 migration stub in `database.js`; align `CURRENT_SCHEMA_VERSION` with applied state | Phase 06+    |
| S-04 | Info     | Remove or explicitly import `electron-squirrel-startup` in main entry if Squirrel lifecycle hooks are needed | Pre-Store   |
| S-05 | Info     | Confirm `app.getName()` / `productName` in `forge.config.js` is finalised before packaging                 | Pre-Store    |
| S-06 | Info     | Document per-user storage path and export behavior in Store listing privacy section                         | Pre-Store    |

No blocking issues for Phase 06 progression.

---

## 9. T6 Re-Validation Summary (2026-05-08)

All source files reviewed in this document are unchanged since the T2 initial review. No new storage paths, IPC channels, network calls, or credential handling have been introduced. The T6 re-validation (`npm test` 82/82 PASS; packaged EXE starts; `npm audit --production` result unchanged) confirms no regressions in the security and privacy posture reviewed here.

| Section | T6 re-validation result |
|---------|------------------------|
| 1 — Storage behavior | PASS — unchanged |
| 2 — Export behavior | PASS — unchanged |
| 3 — Elevation requirements | PASS — unchanged |
| 4 — Preload surface / IPC | PASS — unchanged; low-severity finding S-01/S-02 still deferred |
| 5 — Telemetry / crash reporting | PASS — none present |
| 6 — Store-relevant implications | PASS — unchanged |

Open items S-01 through S-06 remain deferred; none are Phase 05 blockers.

---

## Summary

| Area                        | Result  |
|-----------------------------|---------|
| Storage location            | PASS    |
| Export behavior             | PASS    |
| Elevation requirements      | PASS    |
| Context isolation / nodeIntegration | PASS |
| IPC channel coverage        | PASS    |
| Preload surface (channel whitelist) | NOTE (low, future hardening) |
| Telemetry / crash reporting | PASS (absent) |
| Network calls               | PASS (absent) |
| SQL injection posture        | PASS (parameterised) |
| Store privacy compatibility | PASS    |

**Overall: PASS.** The repository is ready to proceed to Phase 06. The one noted hardening item (generic IPC bridge) carries no blocking risk in the current local-file-only deployment but should be resolved before Store submission.
