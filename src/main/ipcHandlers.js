const { ipcMain, nativeTheme } = require('electron');
const { insertTimer, insertProject, getProjects, deleteProject } = require('../infra/database');

function setupIpcHandlers() {
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

  ipcMain.on('save-timer', (event, { selectedProjectId, startTime, endTime, duration, taskDesc }) => {
    insertTimer(selectedProjectId, startTime, endTime, duration, taskDesc);
  });


  // theme
  ipcMain.handle('dark-mode:toggle', () => {
    if (nativeTheme.shouldUseDarkColors) nativeTheme.themeSource = 'light';
    else nativeTheme.themeSource = 'dark';
    return nativeTheme.shouldUseDarkColors;
  });

  ipcMain.handle('dark-mode:system', () => {
    nativeTheme.themeSource = 'system';
  });
}

module.exports = setupIpcHandlers;

