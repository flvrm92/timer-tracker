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
- **✅ Comprehensive Testing**: Full test coverage with Jest

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
- Node.js (v14 or higher)
- npm

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

3. Start the application:
   ```bash
   npm start
   ```

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

## Architecture

### Tech Stack
- **Frontend**: HTML, CSS, JavaScript
- **Backend**: Electron (Node.js)
- **Database**: SQLite3
- **Testing**: Jest
- **Hot Reload**: electron-reloader (development)

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

### Database Schema
```sql
-- Projects table
CREATE TABLE projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
);

-- Timers table
CREATE TABLE timers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    start_time TEXT,
    end_time TEXT,
    duration INTEGER,
    task_description TEXT,
    FOREIGN KEY (project_id) REFERENCES projects(id)
);
```

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
The application includes hot reload functionality when running in development mode:
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
- Customizable filtering before export
- Proper CSV formatting with field escaping
- Automatic filename generation with timestamps
- Support for all projects or project-specific exports

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

*Built with ❤️ using Electron and SQLite*