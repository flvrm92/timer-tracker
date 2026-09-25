/**
 * Owns the About popup's whole lifecycle.
 *
 * The popup is a real modal child window rather than the shared in-page dialog
 * component, because the dialog component is scoped to one renderer page and
 * would have to be rebuilt on Timer, Projects, Timers and Dashboard alike. A
 * child window is reachable from the menu wherever the user has navigated to.
 *
 * Single-instance is a property of this module, not of the caller: it holds
 * the live window and a second open() focuses it instead of building another,
 * so clicking About twice can never stack two identical windows.
 *
 * BrowserWindow is injected rather than required, so the manager can be
 * exercised without launching Electron.
 */
const path = require('node:path');

const ABOUT_PAGE = path.join(__dirname, '..', 'renderer', 'about', 'about.html');
const ABOUT_PRELOAD = path.join(__dirname, '..', 'settings', 'aboutPreload.js');

// Sized to the content: icon, name, version, one runtime line, two buttons.
const WIDTH = 420;
const HEIGHT = 420;

/**
 * Position that puts a WIDTH x HEIGHT window in the middle of the parent, so
 * the popup appears where the user is already looking rather than in the
 * middle of whichever monitor Electron would have picked.
 *
 * @returns {{x: number, y: number}|{}} empty when the parent cannot be
 *   measured, leaving Electron to place the window.
 */
function centredOn(parent) {
  if (!parent || typeof parent.getBounds !== 'function') return {};
  const bounds = parent.getBounds();
  return {
    x: Math.round(bounds.x + (bounds.width - WIDTH) / 2),
    y: Math.round(bounds.y + (bounds.height - HEIGHT) / 2),
  };
}

/**
 * @param {object} deps
 * @param {Function} deps.BrowserWindow Electron's BrowserWindow constructor.
 * @param {object} deps.parent the main window the popup is modal over.
 * @param {boolean} deps.isPackaged true in a packaged build; gates DevTools.
 * @param {function(): object} deps.getAboutInfo the payload the page renders.
 * @returns {{open: function(): object, isOpen: function(): boolean}}
 */
function createAboutWindowManager({ BrowserWindow, parent, isPackaged, getAboutInfo }) {
  let win = null;

  function open() {
    if (win) {
      win.focus();
      return win;
    }

    // Everything below works off a local reference, not the module's `win`:
    // an event firing against this window must never be able to act on a
    // later one that has since taken its place.
    const created = new BrowserWindow({
      ...centredOn(parent),
      width: WIDTH,
      height: HEIGHT,
      parent,
      modal: true,
      // A themed page painting after the window appears would flash white at
      // dark-theme users; ready-to-show below is the first paint.
      show: false,
      resizable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      autoHideMenuBar: true,
      title: 'About Timer Tracker',
      webPreferences: {
        preload: ABOUT_PRELOAD,
        devTools: !isPackaged,
        contextIsolation: true,
        nodeIntegration: false,
        // How the page gets its data. additionalArguments lands in the
        // preload's process.argv, which means no new IPC channel and no new
        // ipcMain handler: the main preload's allowlists stay exactly as
        // narrow as they are, and the About page cannot reach delete-project,
        // delete-timer or export-csv.
        additionalArguments: [
          `--about-info=${encodeURIComponent(JSON.stringify(getAboutInfo()))}`,
        ],
      },
    });

    win = created;

    // The application menu is global on Windows, so a child window inherits
    // it. Dropping it is what makes this read as a dialog and not a second
    // main window.
    created.removeMenu();
    created.once('ready-to-show', () => created.show());
    // Clearing the reference is what lets a later click open a fresh popup.
    created.once('closed', () => { if (win === created) win = null; });

    created.loadFile(ABOUT_PAGE);
    return created;
  }

  return {
    open,
    isOpen: () => win !== null,
  };
}

module.exports = { createAboutWindowManager, ABOUT_PAGE, ABOUT_PRELOAD };
