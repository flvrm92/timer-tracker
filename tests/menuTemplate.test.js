/**
 * The menu template is plain data, so these tests assert on the array itself -
 * no Electron Menu, no live window.
 *
 * Items are found by label rather than by index. A test pinning the About item
 * to position 5 would go red the day an unrelated submenu is added, which is
 * exactly the kind of breakage that teaches people to delete tests.
 */
const { buildMenuTemplate } = require('../src/main/menuTemplate');

const VERSION_LABEL = 'About Timer Tracker (v9.9.9)';

function setup(overrides = {}) {
  const win = {
    loadFile: jest.fn(),
    webContents: {
      toggleDevTools: jest.fn(),
      executeJavaScript: jest.fn().mockResolvedValue(undefined),
    },
  };
  const openAbout = jest.fn();
  const quit = jest.fn();
  const template = buildMenuTemplate({
    win,
    isPackaged: false,
    openAbout,
    quit,
    appVersion: { getMenuLabel: () => VERSION_LABEL },
    ...overrides,
  });
  return { win, openAbout, quit, template };
}

const find = (items, label) => items.find((item) => item.label === label);

describe('menuTemplate: the Help submenu', () => {
  test('the template has a Help submenu', () => {
    const { template } = setup();
    expect(find(template, 'Help')).toBeDefined();
  });

  test('Help sits between View and Exit', () => {
    const { template } = setup();
    const labels = template.map((item) => item.label);
    expect(labels.indexOf('Help')).toBeGreaterThan(labels.indexOf('View'));
    expect(labels.indexOf('Help')).toBeLessThan(labels.indexOf('Exit'));
  });

  test('Help holds exactly one item', () => {
    const { template } = setup();
    expect(find(template, 'Help').submenu).toHaveLength(1);
  });

  test("the item's label carries the resolver's version label", () => {
    const { template } = setup();
    expect(find(template, 'Help').submenu[0].label).toBe(VERSION_LABEL);
  });

  test('the label tracks the resolver, so a release bump shows through', () => {
    const { template } = setup({ appVersion: { getMenuLabel: () => 'About Timer Tracker (v10.4.2)' } });
    expect(find(template, 'Help').submenu[0].label).toContain('10.4.2');
  });

  test('clicking the item opens the About window exactly once', () => {
    const { template, openAbout } = setup();
    find(template, 'Help').submenu[0].click();
    expect(openAbout).toHaveBeenCalledTimes(1);
  });

  test('the item does not navigate the main window', () => {
    const { template, win } = setup();
    find(template, 'Help').submenu[0].click();
    expect(win.loadFile).not.toHaveBeenCalled();
  });
});

describe('menuTemplate: the pre-existing menu is unchanged', () => {
  test('keeps its top-level items, in order', () => {
    const { template } = setup();
    expect(template.map((item) => item.label)).toEqual([
      'Projects', 'Timers', 'Dashboard', 'Window', 'View', 'Help', 'Exit',
    ]);
  });

  test.each([
    ['Projects', 'Create and List', 'src/renderer/projects/projects.html'],
    ['Timers', 'List and Edit', 'src/renderer/timers/timers.html'],
    ['Dashboard', 'Overview', 'src/renderer/dashboard/dashboard.html'],
    ['Window', 'Timer', 'src/renderer/timer/timer.html'],
  ])('%s > %s navigates to %s', (menu, item, page) => {
    const { template, win } = setup();
    find(find(template, menu).submenu, item).click();
    expect(win.loadFile).toHaveBeenCalledWith(page);
  });

  test('Exit quits the app', () => {
    const { template, quit } = setup();
    find(template, 'Exit').click();
    expect(quit).toHaveBeenCalledTimes(1);
  });

  test('View > Theme offers Light, Dark and System', () => {
    const { template } = setup();
    const theme = find(find(template, 'View').submenu, 'Theme');
    expect(theme.submenu.map((item) => item.label)).toEqual(['Light', 'Dark', 'System']);
  });

  test('System is the checked theme by default', () => {
    const { template } = setup();
    const theme = find(find(template, 'View').submenu, 'Theme');
    expect(find(theme.submenu, 'System').checked).toBe(true);
  });

  test.each(['light', 'dark'])('choosing %s pushes it to both theme owners', async (theme) => {
    const { template, win } = setup();
    const themes = find(find(template, 'View').submenu, 'Theme').submenu;
    await find(themes, theme === 'light' ? 'Light' : 'Dark').click();

    const [script] = win.webContents.executeJavaScript.mock.calls[0];
    expect(script).toContain(`window.darkMode.setTheme('${theme}')`);
    expect(script).toContain(`window.ThemeUtils.setTheme('${theme}')`);
  });

  test('choosing System hands the choice back to the OS', async () => {
    const { template, win } = setup();
    const themes = find(find(template, 'View').submenu, 'Theme').submenu;
    await find(themes, 'System').click();

    const [script] = win.webContents.executeJavaScript.mock.calls[0];
    expect(script).toContain('window.darkMode.system()');
    expect(script).toContain("window.ThemeUtils.setTheme('system')");
  });
});

describe('menuTemplate: DevTools stays a development affordance', () => {
  test('appears under View when the app is not packaged', () => {
    const { template } = setup({ isPackaged: false });
    expect(find(find(template, 'View').submenu, 'Toggle DevTools')).toBeDefined();
  });

  test('is absent from a packaged build', () => {
    const { template } = setup({ isPackaged: true });
    expect(find(find(template, 'View').submenu, 'Toggle DevTools')).toBeUndefined();
  });

  test('a packaged build keeps the rest of the View menu and the Help item', () => {
    const { template } = setup({ isPackaged: true });
    expect(find(find(template, 'View').submenu, 'Theme')).toBeDefined();
    expect(find(template, 'Help').submenu[0].label).toBe(VERSION_LABEL);
  });

  test('toggles DevTools on the window when clicked', () => {
    const { template, win } = setup({ isPackaged: false });
    find(find(template, 'View').submenu, 'Toggle DevTools').click();
    expect(win.webContents.toggleDevTools).toHaveBeenCalled();
  });
});
