/**
 * The About window manager takes BrowserWindow as a dependency, so the whole
 * lifecycle - construct, focus, close, reopen - is exercisable without
 * launching Electron.
 *
 * The fake window records its `once` handlers so a test can fire `closed` and
 * watch the manager forget the window, which is the half of the
 * single-instance guarantee a constructor count alone cannot see.
 */
const path = require('node:path');
const { createAboutWindowManager, ABOUT_PAGE, ABOUT_PRELOAD } = require('../src/main/aboutWindow');

function setup({ isPackaged = false, info = { version: '9.9.9' }, parent } = {}) {
  const windows = [];
  const BrowserWindow = jest.fn(() => {
    const handlers = {};
    const win = {
      handlers,
      focus: jest.fn(),
      show: jest.fn(),
      loadFile: jest.fn(),
      removeMenu: jest.fn(),
      once: jest.fn((event, handler) => { handlers[event] = handler; }),
    };
    windows.push(win);
    return win;
  });

  const mainWindow = parent === undefined
    ? { getBounds: () => ({ x: 100, y: 50, width: 1700, height: 900 }) }
    : parent;

  const about = createAboutWindowManager({
    BrowserWindow,
    parent: mainWindow,
    isPackaged,
    getAboutInfo: () => info,
  });

  return { about, BrowserWindow, windows, mainWindow };
}

const optionsOf = (BrowserWindow, call = 0) => BrowserWindow.mock.calls[call][0];

describe('aboutWindow: single instance', () => {
  test('reports nothing open before the first click', () => {
    const { about } = setup();
    expect(about.isOpen()).toBe(false);
  });

  test('the first open constructs one window', () => {
    const { about, BrowserWindow } = setup();
    about.open();
    expect(BrowserWindow).toHaveBeenCalledTimes(1);
    expect(about.isOpen()).toBe(true);
  });

  test('a second open constructs no further window', () => {
    const { about, BrowserWindow } = setup();
    about.open();
    about.open();
    expect(BrowserWindow).toHaveBeenCalledTimes(1);
  });

  test('a second open focuses the window already on screen', () => {
    const { about, windows } = setup();
    about.open();
    about.open();
    expect(windows[0].focus).toHaveBeenCalledTimes(1);
  });

  test('a second open returns the same window', () => {
    const { about } = setup();
    expect(about.open()).toBe(about.open());
  });

  test('closing the window clears the manager', () => {
    const { about, windows } = setup();
    about.open();
    windows[0].handlers.closed();
    expect(about.isOpen()).toBe(false);
  });

  test('a click after closing opens a fresh window', () => {
    const { about, BrowserWindow, windows } = setup();
    about.open();
    windows[0].handlers.closed();
    about.open();
    expect(BrowserWindow).toHaveBeenCalledTimes(2);
  });
});

describe('aboutWindow: window shape', () => {
  test('is a modal child of the main window', () => {
    const { about, BrowserWindow, mainWindow } = setup();
    about.open();
    expect(optionsOf(BrowserWindow)).toMatchObject({ parent: mainWindow, modal: true });
  });

  test('is centred on its parent', () => {
    const { about, BrowserWindow } = setup();
    about.open();
    const { x, y, width, height } = optionsOf(BrowserWindow);
    // Parent occupies 100,50 1700x900.
    expect(x).toBe(Math.round(100 + (1700 - width) / 2));
    expect(y).toBe(Math.round(50 + (900 - height) / 2));
  });

  test('leaves placement to Electron when the parent cannot be measured', () => {
    const { about, BrowserWindow } = setup({ parent: null });
    about.open();
    expect(optionsOf(BrowserWindow)).not.toHaveProperty('x');
  });

  test('is fixed-size and cannot be minimised or maximised', () => {
    const { about, BrowserWindow } = setup();
    about.open();
    expect(optionsOf(BrowserWindow)).toMatchObject({
      resizable: false,
      minimizable: false,
      maximizable: false,
    });
  });

  test('drops the inherited application menu bar', () => {
    const { about, windows } = setup();
    about.open();
    expect(windows[0].removeMenu).toHaveBeenCalled();
  });

  test('loads the About page', () => {
    const { about, windows } = setup();
    about.open();
    expect(windows[0].loadFile).toHaveBeenCalledWith(ABOUT_PAGE);
    expect(path.basename(ABOUT_PAGE)).toBe('about.html');
  });
});

describe('aboutWindow: no blank-window flash', () => {
  test('is created hidden', () => {
    const { about, BrowserWindow } = setup();
    about.open();
    expect(optionsOf(BrowserWindow).show).toBe(false);
  });

  test('shows itself once the page has painted', () => {
    const { about, windows } = setup();
    about.open();
    expect(windows[0].show).not.toHaveBeenCalled();

    windows[0].handlers['ready-to-show']();
    expect(windows[0].show).toHaveBeenCalledTimes(1);
  });
});

describe('aboutWindow: web preferences stay hardened', () => {
  test('keeps context isolation on and node integration off', () => {
    const { about, BrowserWindow } = setup();
    about.open();
    expect(optionsOf(BrowserWindow).webPreferences).toMatchObject({
      contextIsolation: true,
      nodeIntegration: false,
    });
  });

  test('uses the About page\'s own preload, not the main one', () => {
    const { about, BrowserWindow } = setup();
    about.open();
    expect(optionsOf(BrowserWindow).webPreferences.preload).toBe(ABOUT_PRELOAD);
    expect(path.basename(ABOUT_PRELOAD)).toBe('aboutPreload.js');
  });

  test('enables DevTools only when the app is not packaged', () => {
    const unpackaged = setup({ isPackaged: false });
    unpackaged.about.open();
    expect(optionsOf(unpackaged.BrowserWindow).webPreferences.devTools).toBe(true);

    const packaged = setup({ isPackaged: true });
    packaged.about.open();
    expect(optionsOf(packaged.BrowserWindow).webPreferences.devTools).toBe(false);
  });
});

describe('aboutWindow: the About payload', () => {
  const argOf = (BrowserWindow) => {
    const [arg] = optionsOf(BrowserWindow).webPreferences.additionalArguments;
    return JSON.parse(decodeURIComponent(arg.replace('--about-info=', '')));
  };

  test('travels on the window rather than over a new IPC channel', () => {
    const info = { appName: 'Timer Tracker', version: '9.9.9', summary: 'a summary' };
    const { about, BrowserWindow } = setup({ info });
    about.open();
    expect(argOf(BrowserWindow)).toEqual(info);
  });

  test('survives a summary containing spaces and quotes', () => {
    const info = { summary: 'Timer Tracker v9.9.9 "release"' };
    const { about, BrowserWindow } = setup({ info });
    about.open();
    expect(argOf(BrowserWindow).summary).toBe(info.summary);
  });

  test('is re-read on each open, so a reopened popup is never stale', () => {
    let version = '1.0.0';
    const BrowserWindowMock = jest.fn(() => ({
      focus: jest.fn(), show: jest.fn(), loadFile: jest.fn(), removeMenu: jest.fn(),
      once: jest.fn((event, handler) => { if (event === 'closed') handler(); }),
    }));
    const about = createAboutWindowManager({
      BrowserWindow: BrowserWindowMock,
      parent: null,
      isPackaged: false,
      getAboutInfo: () => ({ version }),
    });

    about.open();
    version = '2.0.0';
    about.open();

    const read = (call) => JSON.parse(decodeURIComponent(
      BrowserWindowMock.mock.calls[call][0].webPreferences.additionalArguments[0]
        .replace('--about-info=', '')
    ));
    expect(read(0).version).toBe('1.0.0');
    expect(read(1).version).toBe('2.0.0');
  });
});
