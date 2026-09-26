/**
 * Builds the application menu as data.
 *
 * This used to be an array literal inline in createWindow(), which meant
 * nothing about the menu could be asserted - "is the About item still there?"
 * was a question only a human clicking around could answer. Producing a plain
 * template here, and leaving Menu.buildFromTemplate/setApplicationMenu to the
 * entry point, is what makes the menu testable without Electron.
 *
 * The module stays pure: every collaborator it needs is passed in.
 */

const defaultAppVersion = require('./appVersion');

/**
 * @param {object} deps
 * @param {object} deps.win the BrowserWindow the navigation items act on.
 * @param {boolean} deps.isPackaged true in a packaged build; gates DevTools.
 * @param {function(): void} deps.openAbout opens (or focuses) the About popup.
 * @param {function(): void} deps.quit ends the app; the Exit item's action.
 * @param {object} [deps.appVersion] version resolver; defaults to the real one.
 * @returns {Array<object>} a Menu.buildFromTemplate template.
 */
function buildMenuTemplate({ win, isPackaged, openAbout, quit, appVersion = defaultAppVersion }) {
  /**
   * The Theme radio items each push the choice into both theme owners: the
   * main process's nativeTheme, via the darkMode bridge, and the page's own
   * ThemeUtils, which is what writes the data-theme attribute and persists the
   * preference. `system` is the odd one out only because the darkMode bridge
   * spells it as its own method rather than a setTheme argument.
   */
  const applyTheme = (theme) => async () => {
    const nativeCall = theme === 'system'
      ? 'window.darkMode.system();'
      : `window.darkMode.setTheme('${theme}');`;

    await win.webContents.executeJavaScript(`
      if (window.darkMode) {
        ${nativeCall}
      }
      if (window.ThemeUtils) {
        window.ThemeUtils.setTheme('${theme}');
      }
    `);
  };

  return [
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
      label: 'Dashboard',
      submenu: [{
        label: 'Overview',
        click: () => win.loadFile('src/renderer/dashboard/dashboard.html')
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
            { label: 'Light', type: 'radio', click: applyTheme('light') },
            { label: 'Dark', type: 'radio', click: applyTheme('dark') },
            { label: 'System', type: 'radio', checked: true, click: applyTheme('system') }
          ]
        },
        // DevTools is a development affordance only. Spreading keeps the rest
        // of the View menu - and the Projects/Timers navigation - intact in
        // packaged builds, which is the only way to move between pages.
        ...(isPackaged ? [] : [
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
      label: 'Help',
      // The version is in the label, so the current build is readable from the
      // menu bar without opening the popup at all.
      submenu: [
        {
          label: appVersion.getMenuLabel(),
          click: () => openAbout()
        }
      ]
    },
    {
      label: 'Exit',
      click: () => { quit() },
    },
  ];
}

module.exports = { buildMenuTemplate };
