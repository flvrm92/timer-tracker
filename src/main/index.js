const { app, BrowserWindow, Menu, Tray } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path')

const appVersion = require('./appVersion');
const { buildMenuTemplate } = require('./menuTemplate');
const { createAboutWindowManager } = require('./aboutWindow');

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

  const about = createAboutWindowManager({
    BrowserWindow,
    parent: win,
    isPackaged: app.isPackaged,
    getAboutInfo: () => appVersion.buildAboutInfo(),
  });

  // The template is data; building and installing it is this module's job.
  const menu = Menu.buildFromTemplate(buildMenuTemplate({
    win,
    isPackaged: app.isPackaged,
    openAbout: () => about.open(),
    quit: () => app.quit(),
  }));

  Menu.setApplicationMenu(menu);
}

const setupIpcHandlers = require('./ipcHandlers');
const activeTimer = require('./activeTimer');
const { persistTimer } = require('./timerPersistence');
setupIpcHandlers();

/**
 * A timer running when the app closes is saved rather than lost.
 *
 * Quitting has to be deferred until the SQLite insert has actually run, so the
 * first pass through here cancels the quit and re-issues it from the insert
 * callback. Two guards keep that second pass from saving again: the `quitting`
 * flag, and activeTimer.stop() having already emptied the slot.
 *
 * The timeout is a backstop - a hung insert must not leave the user with a
 * window they cannot close. It is generous on purpose: a local SQLite insert
 * that takes seconds means something is already wrong, and quitting early
 * discards the session for good, so the bias is towards waiting. When it does
 * win it says so, because otherwise the loss leaves no trace anywhere.
 */
const SAVE_ON_QUIT_TIMEOUT_MS = 5000;
let quitting = false;

app.on('before-quit', (event) => {
  if (quitting || !activeTimer.isRunning()) return;

  quitting = true;
  event.preventDefault();

  const finished = activeTimer.stop();
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    app.quit();
  };

  const backstop = setTimeout(() => {
    console.error(
      `Timed out saving the running timer on quit; ${finished.duration}s for project ` +
      `${finished.selectedProjectId} started at ${finished.startTime} was not written.`
    );
    finish();
  }, SAVE_ON_QUIT_TIMEOUT_MS);
  if (backstop.unref) backstop.unref();

  persistTimer(finished, (err) => {
    if (err) console.error('Could not save the running timer on quit:', err.message);
    clearTimeout(backstop);
    finish();
  });
});

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

