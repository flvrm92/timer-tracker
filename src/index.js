const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('node:path')
const { insertTimer, insertProject, getProjects, deleteProject } = require('./database');
const fs = require('fs');

const env = process.env.NODE_ENV || 'development';
const configPath = path.join(app.getPath('userData'), 'config.json');

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      devTools: env === 'development',
    },
    enableRemoteModule: false,
    nodeIntegration: false,
  })

  win.loadFile('src/index.html')

  const config = getConfig();
  win.webContents.on('did-finish-load', () => {
    win.webContents.send('theme', config.theme || 'light');
  });
}

function saveConfig(config) {
  fs.writeFileSync(configPath, JSON.stringify(config));
}

function getConfig() {
  try {
    return JSON.parse(fs.readFileSync(configPath));
  }
  catch (e) {
    return {};
  }
}

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

ipcMain.on('save-theme', (event, theme) => {
  saveConfig({ theme });
});

ipcMain.on('add-project', (event, name) => {
  insertProject(name, (err, project) => {
    if (!err) {
      event.sender.send('project-added', project);
    }
  });
});

ipcMain.on('delete-project', (event, id) => {
  deleteProject(id, (err) => {
    if (!err) event.sender.send('project-deleted');
  });
});

ipcMain.on('get-projects', (event) => {
  getProjects((err, projects) => {
    if (!err) {
      event.sender.send('projects', projects);
    }
  });
});

ipcMain.on('save-timer', (event, { selectedProjectId, startTime, endTime, duration }) => {
  insertTimer(selectedProjectId, startTime, endTime, duration);
});
