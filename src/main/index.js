const { app, BrowserWindow, Menu, Tray } = require('electron');
const path = require('node:path')
const setupIpcHandlers = require('./ipcHandlers');
const fs = require('fs');

const env = process.env.NODE_ENV || 'development';

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1000,
    height: 800,
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
      label: 'Toggle DevTools',
      accelerator: 'Ctrl+Shift+I',
      click: () => {
        win.webContents.toggleDevTools()
      }
    },
    {
      label: 'Exit',
      click: () => { app.quit() },
    },
  ]);

  Menu.setApplicationMenu(menu);

}

setupIpcHandlers();

app.whenReady().then(() => {
  createWindow()

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

