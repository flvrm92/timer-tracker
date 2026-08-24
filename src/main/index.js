const { app, BrowserWindow, Menu, Tray } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path')

/**
 * Copies a pre-MSIX database into the app's userData directory on first run.
 *
 * Under MSIX, app.getPath('userData') resolves inside the package container
 * (%LOCALAPPDATA%\Packages\<PackageFamilyName>\LocalCache\Roaming\time-tracker)
 * rather than %APPDATA%\time-tracker, so a database written by an earlier
 * unpackaged build is not reliably visible to the packaged app.
 *
 * The legacy path is resolved from os.homedir() rather than %APPDATA%, because
 * that environment variable is itself subject to MSIX redirection.
 *
 * Only ever copies when the destination is absent, so it is idempotent and a
 * no-op once the app has its own database - including the case where MSIX
 * redirection already exposed the old file. Never throws: a failed import must
 * degrade to an empty database, not block startup.
 *
 * @param {string} target Absolute path the app will open its database at.
 * @returns {boolean} true if a legacy database was imported on this call.
 */
function importLegacyDatabase(target) {
  try {
    if (fs.existsSync(target)) return false;

    const legacy = path.join(os.homedir(), 'AppData', 'Roaming', 'time-tracker', 'timers.db');
    if (legacy === target || !fs.existsSync(legacy)) return false;

    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(legacy, target);
    console.log(`Imported legacy database from ${legacy}`);
    return true;
  } catch (err) {
    console.error('Could not import legacy database:', err.message);
    return false;
  }
}

const dbPath = path.join(app.getPath('userData'), 'timers.db');
importLegacyDatabase(dbPath);
process.env.DB_PATH = dbPath;

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1700,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, '../settings/preload.js'),
      devTools: !app.isPackaged,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  win.loadFile('src/renderer/timer/timer.html')

  const menu = Menu.buildFromTemplate([
    {
      label: 'Projects',
      submenu: [{
        label: 'Create and List',
        click: () => win.loadFile('src/renderer/projects/projects.html')
      }]
    },
    {
      label: 'Timers',
      submenu: [{
        label: 'List and Edit',
        click: () => win.loadFile('src/renderer/timers/timers.html')
      }]
    },
    {
      label: 'Window',
      submenu: [
        {
          label: 'Timer',
          click: () => win.loadFile('src/renderer/timer/timer.html')
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Theme',
          submenu: [
            {
              label: 'Light',
              type: 'radio',
              click: async () => {
                await win.webContents.executeJavaScript(`
                  if (window.darkMode) {
                    window.darkMode.setTheme('light');
                  }
                  if (window.ThemeUtils) {
                    window.ThemeUtils.setTheme('light');
                  }
                `);
              }
            },
            {
              label: 'Dark',
              type: 'radio',
              click: async () => {
                await win.webContents.executeJavaScript(`
                  if (window.darkMode) {
                    window.darkMode.setTheme('dark');
                  }
                  if (window.ThemeUtils) {
                    window.ThemeUtils.setTheme('dark');
                  }
                `);
              }
            },
            {
              label: 'System',
              type: 'radio',
              checked: true,
              click: async () => {
                await win.webContents.executeJavaScript(`
                  if (window.darkMode) {
                    window.darkMode.system();
                  }
                  if (window.ThemeUtils) {
                    window.ThemeUtils.setTheme('system');
                  }
                `);
              }
            }
          ]
        },
        // DevTools is a development affordance only. Spreading keeps the rest
        // of the View menu - and the Projects/Timers navigation - intact in
        // packaged builds, which is the only way to move between pages.
        ...(app.isPackaged ? [] : [
          { type: 'separator' },
          {
            label: 'Toggle DevTools',
            accelerator: 'Ctrl+Shift+I',
            click: () => {
              win.webContents.toggleDevTools()
            }
          }
        ])
      ]
    },
    {
      label: 'Exit',
      click: () => { app.quit() },
    },
  ]);

  Menu.setApplicationMenu(menu);
}

const setupIpcHandlers = require('./ipcHandlers');
setupIpcHandlers();

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

module.exports = { importLegacyDatabase };

