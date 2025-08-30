const { app, BrowserWindow, Menu, Tray } = require('electron');
const path = require('node:path')

const env = process.env.NODE_ENV || 'development';

process.env.DB_PATH = path.join(app.getPath('userData'), 'timers.db');

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1700,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, '../settings/preload.js'),
      devTools: env === 'development',
    },
    enableRemoteModule: false,
    nodeIntegration: false,
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
        label: 'List & Edit',
        click: () => win.loadFile('src/renderer/timers/timers.html')
      }]
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
        { type: 'separator' },
        {
          label: 'Toggle DevTools',
          accelerator: 'Ctrl+Shift+I',
          click: () => {
            win.webContents.toggleDevTools()
          }
        }
      ]
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

// hot reload
// If development environment 
if (env === 'development') {
  try {
    require('electron-reloader')(module, {
      debug: true,
      watchRenderer: true
    });
  } catch (_) { console.log('Error'); }
} else {
  Menu.setApplicationMenu(null);
}

