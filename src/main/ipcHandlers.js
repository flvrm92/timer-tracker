const { ipcMain, nativeTheme, dialog } = require('electron');
const { insertTimer, insertProject, getProjects, deleteProject, getTimers, countTimers, updateTimer, deleteTimer, getTimersForExport } = require('../infra/database');
const { generateCSV, generateFileName } = require('../shared/utils/csvUtils');
const fs = require('fs');
const path = require('path');

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

  ipcMain.on('get-timers', (event, { page, projectId } = { page: 1 }) => {
    const pageSize = 15;
    const currentPage = page && page > 0 ? page : 1;
    const filterProjectId = projectId && projectId !== '' ? projectId : null;

    countTimers(filterProjectId, (err, total) => {
      if (err) return event.sender.send('timers-error', err.message);
      getTimers(currentPage, pageSize, filterProjectId, (err2, rows) => {
        if (err2) return event.sender.send('timers-error', err2.message);
        const totalPages = Math.ceil(total / pageSize) || 1;
        event.sender.send('timers', { rows, page: currentPage, pageSize, total, totalPages });
      });
    });
  });

  ipcMain.on('update-timer', (event, { id, start_time, end_time }) => {
    updateTimer(id, start_time, end_time, (err, updatedRow) => {
      if (err) {
        return event.sender.send('timer-update-error', { id, message: err.message });
      }
      event.sender.send('timer-updated', updatedRow);
    });
  });

  ipcMain.on('delete-timer', (event, { id }) => {
    deleteTimer(id, (err) => {
      if (err) {
        return event.sender.send('timer-delete-error', { id, message: err.message });
      }
      event.sender.send('timer-deleted', { id });
    });
  });

  ipcMain.on('export-csv', async (event, { projectId } = {}) => {
    try {
      const filterProjectId = projectId && projectId !== '' ? projectId : null;

      // Get project name for filename if filtering by project
      let projectName = null;
      if (filterProjectId) {
        const projects = await new Promise((resolve, reject) => {
          getProjects((err, projects) => {
            if (err) reject(err);
            else resolve(projects);
          });
        });
        const project = projects.find(p => p.id == filterProjectId);
        projectName = project ? project.name : null;
      }

      // Get timers data
      const timers = await new Promise((resolve, reject) => {
        getTimersForExport(filterProjectId, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      // Generate CSV content
      const csvContent = generateCSV(timers);
      const fileName = generateFileName(projectName);

      // Show save dialog
      const result = await dialog.showSaveDialog({
        title: 'Export Timers to CSV',
        defaultPath: fileName,
        filters: [
          { name: 'CSV Files', extensions: ['csv'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      if (!result.canceled && result.filePath) {
        fs.writeFileSync(result.filePath, csvContent, 'utf8');
        event.sender.send('csv-exported', { filePath: result.filePath, recordCount: timers.length });
      } else {
        event.sender.send('csv-export-cancelled');
      }
    } catch (error) {
      event.sender.send('csv-export-error', error.message);
    }
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

