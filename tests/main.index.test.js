jest.mock('../src/main/ipcHandlers', () => jest.fn());

jest.mock('electron', () => {
  const mockWin = {
    loadFile: jest.fn(),
    webContents: {
      toggleDevTools: jest.fn(),
      executeJavaScript: jest.fn().mockResolvedValue(undefined),
    },
  };
  const BrowserWindow = jest.fn(() => mockWin);
  BrowserWindow.getAllWindows = jest.fn(() => []);

  const appHandlers = {};
  const app = {
    getPath: jest.fn(() => '/mock/userData'),
    isPackaged: false,
    quit: jest.fn(),
    whenReady: jest.fn(() => Promise.resolve()),
    on: jest.fn((event, handler) => { appHandlers[event] = handler; }),
    _handlers: appHandlers,
  };

  const Menu = {
    buildFromTemplate: jest.fn(() => ({})),
    setApplicationMenu: jest.fn(),
  };

  return { app, BrowserWindow, Menu, Tray: jest.fn() };
});

const electron = require('electron');
const setupIpcHandlers = require('../src/main/ipcHandlers');

beforeAll(async () => {
  require('../src/main/index');
  // flush whenReady().then() microtask
  await Promise.resolve();
});

describe('main/index: DB_PATH setup', () => {
  test('calls app.getPath with userData', () => {
    expect(electron.app.getPath).toHaveBeenCalledWith('userData');
  });

  test('DB_PATH is set before app.whenReady and ends with timers.db', () => {
    expect(process.env.DB_PATH).toMatch(/timers\.db$/);
  });

  test('app.getPath is called before app.whenReady', () => {
    const getPathOrder = electron.app.getPath.mock.invocationCallOrder[0];
    const whenReadyOrder = electron.app.whenReady.mock.invocationCallOrder[0];
    expect(getPathOrder).toBeLessThan(whenReadyOrder);
  });
});

describe('main/index: startup wiring', () => {
  test('calls setupIpcHandlers on load', () => {
    expect(setupIpcHandlers).toHaveBeenCalled();
  });

  test('calls app.whenReady', () => {
    expect(electron.app.whenReady).toHaveBeenCalled();
  });

  test('registers window-all-closed handler', () => {
    const registered = electron.app.on.mock.calls.some(([e]) => e === 'window-all-closed');
    expect(registered).toBe(true);
  });

  test('registers activate handler', () => {
    const registered = electron.app.on.mock.calls.some(([e]) => e === 'activate');
    expect(registered).toBe(true);
  });
});

describe('main/index: BrowserWindow creation', () => {
  test('creates BrowserWindow with width 1700 and height 900', () => {
    expect(electron.BrowserWindow).toHaveBeenCalledWith(
      expect.objectContaining({ width: 1700, height: 900 })
    );
  });

  test('disables nodeIntegration in webPreferences', () => {
    const [opts] = electron.BrowserWindow.mock.calls[0];
    expect(opts.webPreferences.nodeIntegration).toBe(false);
  });

  test('sets contextIsolation to true in webPreferences', () => {
    const [opts] = electron.BrowserWindow.mock.calls[0];
    expect(opts.webPreferences.contextIsolation).toBe(true);
  });

  test('sets preload path to preload.js', () => {
    const [opts] = electron.BrowserWindow.mock.calls[0];
    expect(opts.webPreferences.preload).toMatch(/preload\.js$/);
  });

  test('loads timer.html as initial page', () => {
    const win = electron.BrowserWindow.mock.results[0].value;
    expect(win.loadFile).toHaveBeenCalledWith('src/renderer/timer/timer.html');
  });
});

describe('main/index: menu wiring', () => {
  test('builds menu with Projects, Timers, Window, View, Exit labels', () => {
    expect(electron.Menu.buildFromTemplate).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Projects' }),
        expect.objectContaining({ label: 'Timers' }),
        expect.objectContaining({ label: 'Window' }),
        expect.objectContaining({ label: 'View' }),
        expect.objectContaining({ label: 'Exit' }),
      ])
    );
  });

  test('calls Menu.setApplicationMenu', () => {
    expect(electron.Menu.setApplicationMenu).toHaveBeenCalled();
  });
});

describe('main/index: window-all-closed handler', () => {
  test('quits app on non-darwin platform', () => {
    const [, handler] = electron.app.on.mock.calls.find(([e]) => e === 'window-all-closed');
    const orig = Object.getOwnPropertyDescriptor(process, 'platform');
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
    electron.app.quit.mockClear();
    handler();
    expect(electron.app.quit).toHaveBeenCalled();
    if (orig) Object.defineProperty(process, 'platform', orig);
  });

  test('does not quit app on darwin platform', () => {
    const [, handler] = electron.app.on.mock.calls.find(([e]) => e === 'window-all-closed');
    const orig = Object.getOwnPropertyDescriptor(process, 'platform');
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
    electron.app.quit.mockClear();
    handler();
    expect(electron.app.quit).not.toHaveBeenCalled();
    if (orig) Object.defineProperty(process, 'platform', orig);
  });
});

describe('main/index: legacy database import', () => {
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const { importLegacyDatabase } = require('../src/main/index');

  const legacyPath = path.join('/mock/home', 'AppData', 'Roaming', 'time-tracker', 'timers.db');
  const target = path.join('/mock/userData', 'timers.db');

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(os, 'homedir').mockReturnValue('/mock/home');
  });

  afterAll(() => jest.restoreAllMocks());

  test('copies the legacy database when the target does not exist', () => {
    jest.spyOn(fs, 'existsSync').mockImplementation((p) => p === legacyPath);
    jest.spyOn(fs, 'mkdirSync').mockImplementation(() => {});
    const copy = jest.spyOn(fs, 'copyFileSync').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});

    expect(importLegacyDatabase(target)).toBe(true);
    expect(copy).toHaveBeenCalledWith(legacyPath, target);
  });

  test('creates the target directory before copying', () => {
    jest.spyOn(fs, 'existsSync').mockImplementation((p) => p === legacyPath);
    const mkdir = jest.spyOn(fs, 'mkdirSync').mockImplementation(() => {});
    jest.spyOn(fs, 'copyFileSync').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});

    importLegacyDatabase(target);
    expect(mkdir).toHaveBeenCalledWith(path.dirname(target), { recursive: true });
  });

  test('is a no-op when the target already exists', () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    const copy = jest.spyOn(fs, 'copyFileSync').mockImplementation(() => {});

    expect(importLegacyDatabase(target)).toBe(false);
    expect(copy).not.toHaveBeenCalled();
  });

  test('is a no-op when there is no legacy database', () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(false);
    const copy = jest.spyOn(fs, 'copyFileSync').mockImplementation(() => {});

    expect(importLegacyDatabase(target)).toBe(false);
    expect(copy).not.toHaveBeenCalled();
  });

  test('does not copy a file onto itself when the target is the legacy path', () => {
    jest.spyOn(fs, 'existsSync').mockImplementation((p) => p === legacyPath);
    const copy = jest.spyOn(fs, 'copyFileSync').mockImplementation(() => {});

    expect(importLegacyDatabase(legacyPath)).toBe(false);
    expect(copy).not.toHaveBeenCalled();
  });

  test('swallows copy failures so startup is never blocked', () => {
    jest.spyOn(fs, 'existsSync').mockImplementation((p) => p === legacyPath);
    jest.spyOn(fs, 'mkdirSync').mockImplementation(() => {});
    jest.spyOn(fs, 'copyFileSync').mockImplementation(() => { throw new Error('EACCES'); });
    jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(importLegacyDatabase(target)).toBe(false);
  });
});
