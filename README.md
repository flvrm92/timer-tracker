# Timer Tracker

A simple and efficient desktop time tracking application built with Electron and SQLite. Track your work hours across different projects with an intuitive interface.

## Features

- **⏱️ Time Tracking**: Start and stop timers with real-time display
- **📋 Project Management**: Create, list, and delete projects
- **📝 Task Descriptions**: Add detailed descriptions for each tracked session
- **📊 Timer History**: View and edit all recorded timers with pagination
- **🔍 Advanced Filtering**: Filter timers by project and date range
- **📤 CSV Export**: Export filtered timer data to CSV files
- **🌙 Theme Support**: Light, dark, and system theme options
- **✅ Automated Tests**: Jest test suite — 86 tests across 5 suites; ~82% statement coverage (preload and IPC handlers near full; dateHelper and main index partially covered)
- **💲 Billable Projects**: Mark projects as billable with an hourly rate; timers automatically calculate amount earned
- **🗃️ Database Migrations**: Automatic schema migration & version tracking (schema_version table)

## Screenshots

### Main Timer Interface
- Clean, intuitive timer display with start/stop controls
- Project selection dropdown
- Task description input

### Project Management
- Create new projects
- View all projects in a table format
- Delete projects when no longer needed

### Timer History & Management
- Paginated view of all recorded timers
- Edit start/end times with validation
- Filter by project and date range
- Export filtered data to CSV

## Installation

### Prerequisites
- Node.js (v20 or higher recommended; Electron 41 bundles Node 22 internally; sqlite3 6.x requires native compilation via node-gyp which works reliably on Node 20+)
- npm (comes with Node)

### Setup
1. Clone the repository:
   ```bash
   git clone https://github.com/flvrm92/timer-tracker.git
   cd timer-tracker
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the application in development mode:
   ```bash
   npm start
   ```

4. Run the test suite:
   ```bash
   npm test
   ```

5. Build the distributable MSIX package:
   ```bash
   npm run make:msix
   ```

   > **Packaging lane:** Windows only, MSIX for the Microsoft Store. Produces `timer-tracker-<version>.msix` under `out/make/msix/x64/`. Requires the Windows SDK — see [Releasing](#releasing).

## Usage

### Getting Started
1. **Create a Project**: Use the menu (Projects → Create and List) to add your first project
2. **Start Tracking**: Select a project, add a task description, and click "Start Timer"
3. **Stop & Save**: Click "Stop Timer" when finished - your time entry is automatically saved

### Managing Timers
- Access timer history via menu (Timers → List & Edit)
- Edit start/end times by clicking on the time fields
- Filter by project or date range
- Export filtered data using the "Export CSV" button

### Themes
Change themes via the View menu:
- Light mode
- Dark mode  
- System (follows OS preference)

## Running / Development Session

Follow this typical development session flow:

1. Install deps (first time only): `npm install`
2. Launch in dev mode: `npm start`
3. Open DevTools if needed via menu: View → Toggle DevTools (or Ctrl+Shift+I)
4. Run tests while coding: `npm test` (one-off) or `npm run test:watch`
5. Inspect code coverage in `coverage/` after tests
6. Package the app for distribution: `npm run make:msix`

### Database Location
The SQLite database file is created automatically at runtime. Its path is set internally via:
```
process.env.DB_PATH = path.join(app.getPath('userData'), 'timers.db');
```
On Windows this typically resolves to:
`C:\Users\\<USER>\\AppData\\Roaming\\time-tracker\\timers.db`

To use a different database during development or tests you can set `DB_PATH` before launching (tests already do this).

When installed from the Microsoft Store, MSIX redirects `userData` into the package container:
`C:\Users\<USER>\AppData\Local\Packages\<PackageFamilyName>\LocalCache\Roaming\time-tracker\timers.db`

On first launch the app imports an existing `%APPDATA%\time-tracker\timers.db` into that location if it has no database of its own, so data created by an unpackaged build carries over. The import runs once and never overwrites an existing database.

### Environment Variables
| Variable | Purpose | Default / How Set |
|----------|---------|-------------------|
| DB_PATH  | SQLite database file path | Auto-set in `src/main/index.js` to userData/timers.db |
| NODE_ENV | Not used for dev-tools gating | DevTools and the reloader key off `app.isPackaged` instead |

## Architecture

### Tech Stack
- **Frontend**: HTML, CSS, JavaScript
- **Backend**: Electron (Node.js)
- **Database**: SQLite3
- **Testing**: Jest

### Project Structure
```
src/
├── main/                 # Main Electron process
│   ├── index.js         # Application entry point
│   └── ipcHandlers.js   # IPC communication handlers
├── renderer/            # Renderer processes (UI)
│   ├── timer/          # Main timer interface
│   ├── projects/       # Project management
│   └── timers/         # Timer history and editing
├── infra/              # Infrastructure
│   └── database.js     # SQLite database operations
├── shared/             # Shared utilities and styles
│   ├── components/     # Reusable UI components
│   ├── styles/        # CSS stylesheets
│   └── utils/         # Utility functions
└── settings/          # Electron preload scripts
```

### Database Schema & Migrations
The application auto-initializes and migrates the database on startup. Current schema version: 2 (tracked in `schema_version`).

```sql
-- Projects table (billable support)
CREATE TABLE projects (
   id INTEGER PRIMARY KEY AUTOINCREMENT,
   name TEXT NOT NULL,
   is_billable BOOLEAN DEFAULT 0,
   hourly_rate DECIMAL(10,2) DEFAULT NULL
);

-- Timers table (stores computed amount when billable)
CREATE TABLE timers (
   id INTEGER PRIMARY KEY AUTOINCREMENT,
   project_id INTEGER,
   start_time TEXT,
   end_time TEXT,
   duration INTEGER,
   task_description TEXT NULLABLE,
   amount_earned DECIMAL(10,2) DEFAULT NULL,
   FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- Schema version tracking
CREATE TABLE schema_version (
   version INTEGER PRIMARY KEY
);
```

When you start the app, migrations run automatically to add any missing billable-related columns (idempotent). No manual intervention required.

## Development

### Running Tests
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch
```

### Code Coverage
Test coverage is automatically generated and includes:
- Database operations
- IPC handlers
- CSV export functionality

View coverage reports in the `coverage/` directory after running tests.

### Development Mode
Run the application in development mode. DevTools are available via View → Toggle DevTools (or Ctrl+Shift+I). No hot-reload package is active; restart `npm start` to pick up main-process changes:
```bash
npm start
```

## Features in Detail

### Timer Functionality
- Real-time timer display (HH:MM:SS format)
- Automatic duration calculation
- Form validation (project selection required)
- Success feedback on timer save

### Project Management
- CRUD operations for projects
- Project validation
- Integration with timer selection

### Data Management
- Pagination for large datasets (15 items per page)
- Date range filtering with validation
- Inline editing of timer entries
- Data export to CSV format

### CSV Export
- Customizable filtering before export (project & date range)
- Proper CSV formatting with field escaping
- Automatic filename generation with timestamps (includes project name if filtered)
- Includes billable metadata (Hourly Rate, Amount Earned) when applicable
- Supports all projects or a single project
- Files are saved as **UTF-8 with BOM** for correct display in Excel and Windows tools
- Date columns (Start Time, End Time) use the local UI-aligned format: **dd/mm/yyyy HH:MM:SS**
- Billable numeric fields (Hourly Rate, Amount Earned) export as plain decimal values (e.g. `50.00`), not currency text

## Releasing

Timer Tracker is distributed through the **Microsoft Store** as an MSIX package.
The Store handles both signing and updates: it re-signs every submitted package
with a Microsoft certificate, so **no code-signing certificate is required**, and
it pushes new versions to installed users automatically. The app contains no
self-update code.

### One-time setup

1. **Install the Windows SDK** — provides `makeappx`, `makepri`, `signtool` and
   the Windows App Certification Kit. MSIX can only be built on Windows.
   ```powershell
   winget install --id Microsoft.WindowsSDK.10.0.26100
   ```

2. **Create a Microsoft Partner Center account** at
   <https://partner.microsoft.com/dashboard>. An Individual account is a
   one-time $19 fee.

3. **Reserve the app name**, then open *Product management → Product identity*
   and copy the three values into a new `packaging/identity.local.json`:

   ```json
   {
     "identityName": "<Package/Identity/Name>",
     "publisher": "<Package/Identity/Publisher>",
     "publisherDisplayName": "<Package/Properties/PublisherDisplayName>"
   }
   ```

   | Partner Center field | `packaging/identity.local.json` key |
   |---|---|
   | Package/Identity/Name | `identityName` |
   | Package/Identity/Publisher | `publisher` |
   | Package/Properties/PublisherDisplayName | `publisherDisplayName` |

   These are case- and punctuation-sensitive. A mismatch is the most common
   cause of package upload rejection.

   `identity.local.json` is gitignored and overrides the tracked
   `packaging/identity.json`, which holds sideload-only placeholders — so your
   real publisher identity never gets committed. Both `forge.config.js` and
   `scripts/sign-local.ps1` read the override, and every build prints the
   identity it used:

   ```
   [msix] identity: packaging/identity.local.json overrides applied
   [msix] manifest: <identityName> / <publisher> / 1.0.0.0
   ```

   Check that line before uploading — if it shows the placeholder values, the
   override was not picked up.

4. **Publish the privacy policy.** Partner Center requires a reachable URL.
   [`PRIVACY.md`](PRIVACY.md) is ready to use — once the repo is public, its
   GitHub URL works:
   `https://github.com/flvrm92/timer-tracker/blob/main/PRIVACY.md`

### Cutting a release

1. Bump `version` in `package.json` (e.g. `1.0.0` → `1.0.1`).
2. Build and test:
   ```bash
   npm test
   npm run make:msix
   ```
   The package lands at `out/make/msix/x64/timer-tracker-<version>.msix`.
3. Upload it to Partner Center → *Packages*, then submit.

`forge.config.js` derives the MSIX version from `package.json` automatically,
widening `1.0.1` to the four-part `1.0.1.0` the Store requires. The fourth
section is reserved by the Store and must stay `0`, and the first section
cannot be `0`. **Never reuse or lower a version number** — the Store rejects
duplicates, and a user on a higher version will never receive a lower one.

### Testing the package locally

The submitted artifact is intentionally unsigned, but Windows will not install
an unsigned MSIX. `scripts/sign-local.ps1` signs a *separate copy* with a
self-signed certificate, leaving the Store artifact untouched. The certificate
lives in `Cert:CurrentUserMy` and is reused across runs; its private key is
exported to a temp file only for the duration of the run and deleted afterwards,
so no key material is ever left in the repo:

```powershell
npm run make:msix
# then from an elevated PowerShell:
pwsh -File scripts/sign-local.ps1 -Install
```

Before submitting, also run the Windows App Certification Kit (`appcert.exe`,
included with the SDK) against the package — it catches most certification
failures before they cost a submission cycle.

### Visual assets

Every Windows and MSIX image is generated from the single source at
`packaging/icon.svg`:

```bash
npm run generate-icons
```

This writes the twelve tile and logo PNGs into `packaging/assets/` and a
multi-resolution `packaging/icon.ico` for the executable. It also runs
automatically before packaging, so the committed art cannot drift from the
source. To change the icon, edit `packaging/icon.svg` and re-run it.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Write tests for new features
- Follow existing code style
- Update documentation as needed
- Ensure all tests pass before submitting

## Author

**flvrm92** - [GitHub Profile](https://github.com/flvrm92)

---

*Built with ❤️ using Electron, SQLite & Electron Forge*