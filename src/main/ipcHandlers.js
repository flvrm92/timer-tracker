const { ipcMain, nativeTheme, dialog } = require('electron');
const {
  insertProject,
  getProjects,
  deleteProject,
  getTimers,
  countTimers,
  updateTimer,
  deleteTimer,
  getTimersForExport,
  getProjectTotals,
  getMonthlyTotals,
  initializeDatabase } = require('../infra/database');
const { generateCSV, generateFileName } = require('../shared/utils/csvUtils');
const { roundTo2 } = require('../shared/utils/numberHelper');
const { formatMonthLabel, lastTwelveMonths, monthWindowStart } = require('../shared/utils/dateHelper');
const activeTimer = require('./activeTimer');
const { persistTimer } = require('./timerPersistence');
const fs = require('fs');

function setupIpcHandlers() {
  // Initialize database and run migrations when the app starts
  initializeDatabase((err) => {
    if (err) {
      console.error('Failed to initialize database:',
        err);
    } else {
      console.log('Database initialization completed successfully');
    }
  });

  ipcMain.on('add-project', (event, projectData) => {
    // Handle both old (string) and new (object) format for backward compatibility
    if (typeof projectData === 'string') {
      // Legacy format: just the project name
      insertProject(projectData, (err, project) => {
        if (!err) {
          event.sender.send('project-added', project);
        }
      });
    } else {
      // New format: object with name, isBillable, hourlyRate
      const { name, isBillable, hourlyRate } = projectData;
      insertProject(name, isBillable, hourlyRate, (err, project) => {
        if (!err) {
          event.sender.send('project-added', project);
        }
      });
    }
  });

  /**
   * Deleting a project is refused while that project's timer is running.
   *
   * The running timer holds only a project id, and the row it will insert on
   * stop is written with no foreign-key enforcement - so deleting underneath it
   * produces a timer pointing at a project that no longer exists, which the
   * listing renders as a blank name. Stopping first makes the choice explicit.
   *
   * Ids are compared as strings: the renderer's dropdown yields text while the
   * projects list passes the raw database number.
   */
  ipcMain.on('delete-project', (event, id) => {
    const running = activeTimer.getState();

    if (running && String(running.projectId) === String(id)) {
      return event.sender.send('project-delete-error', {
        reason: 'timer-running',
        message: 'This project has a timer running. Stop the timer before deleting it.'
      });
    }

    deleteProject(id, (err) => {
      if (err) return event.sender.send('project-delete-error', { message: err.message });
      event.sender.send('project-deleted');
    });
  });

  ipcMain.on('get-projects', (event) => {
    getProjects((err, projects) => {
      if (!err) {
        event.sender.send('projects', projects);
      }
    });
  });

  /**
   * Dashboard: all-time totals per project, plus the headline figures.
   *
   * Everything crosses IPC already rounded to 2 decimals so the renderer only
   * ever formats. The overall earnings total is the sum of the rounded
   * per-project figures, not a second sum of the raw ones - otherwise the
   * table footer and the KPI tile could disagree by a cent.
   */
  ipcMain.on('get-dashboard-summary', (event) => {
    getProjectTotals((err, rows) => {
      if (err) return event.sender.send('dashboard-summary-error', { message: err.message });

      const projects = (rows || []).map((row) => {
        const seconds = row.total_seconds || 0;
        const rate = row.hourly_rate;
        return {
          id: row.id,
          name: row.name,
          isBillable: !!row.is_billable,
          hourlyRate: rate === null || rate === undefined ? null : roundTo2(rate),
          totalSeconds: seconds,
          totalHours: roundTo2(seconds / 3600),
          totalEarned: roundTo2(row.total_earned),
          entryCount: row.entry_count || 0,
          firstEntry: row.first_entry || null,
          lastEntry: row.last_entry || null
        };
      });

      const totalSeconds = projects.reduce((sum, p) => sum + p.totalSeconds, 0);
      const billableSeconds = projects.reduce((sum, p) => sum + (p.isBillable ? p.totalSeconds : 0), 0);
      const latest = projects.reduce((acc, p) => {
        if (!p.lastEntry) return acc;
        return !acc || p.lastEntry > acc.lastEntry ? { lastEntry: p.lastEntry, name: p.name } : acc;
      }, null);

      event.sender.send('dashboard-summary', {
        projects,
        totals: {
          totalSeconds,
          billableSeconds,
          totalHours: roundTo2(totalSeconds / 3600),
          billableHours: roundTo2(billableSeconds / 3600),
          totalEarned: roundTo2(projects.reduce((sum, p) => sum + p.totalEarned, 0)),
          entryCount: projects.reduce((sum, p) => sum + p.entryCount, 0),
          projectCount: projects.length,
          billableCount: projects.filter((p) => p.isBillable).length,
          lastEntry: latest ? latest.lastEntry : null,
          lastEntryProject: latest ? latest.name : null
        }
      });
    });
  });

  /**
   * Dashboard chart: always exactly 12 months, oldest first, whether or not
   * the project has timers in each of them. A quiet month has to render as a
   * visible zero rather than shrinking the chart.
   *
   * projectId null totals every project together. Nothing in the UI sends that
   * yet, but the query and the padding both handle it.
   */
  ipcMain.on('get-project-monthly', (event, { projectId } = {}) => {
    const filterProjectId = projectId === null || projectId === undefined || projectId === '' ? null : projectId;
    // One reference instant for both the window and its lower bound, so a
    // request that lands on a month boundary cannot straddle two windows.
    const now = new Date();
    const months = lastTwelveMonths(now);

    getMonthlyTotals(filterProjectId, monthWindowStart(now), (err, rows) => {
      if (err) return event.sender.send('project-monthly-error', { message: err.message });

      const byMonth = new Map((rows || []).map((row) => [row.month, row]));

      event.sender.send('project-monthly', {
        projectId: filterProjectId,
        months: months.map((month) => {
          const row = byMonth.get(month);
          const seconds = row ? row.total_seconds || 0 : 0;
          return {
            month,
            label: formatMonthLabel(month),
            totalSeconds: seconds,
            totalHours: roundTo2(seconds / 3600),
            totalEarned: roundTo2(row ? row.total_earned : 0)
          };
        })
      });
    });
  });

  /**
   * Running-timer control. The renderer never owns the clock: it asks main to
   * start or stop, and renders whatever comes back on 'active-timer'. That is
   * what lets a page be destroyed by navigation and rebuilt without the timer
   * being affected.
   *
   * Every handler answers on 'active-timer' so each page has exactly one
   * rendering path, whether it just started a timer or merely asked what is
   * running.
   */
  ipcMain.on('get-active-timer', (event) => {
    event.sender.send('active-timer', activeTimer.getState());
  });

  ipcMain.on('start-timer', (event, { projectId, taskDesc, projectName } = {}) => {
    const result = activeTimer.start({ projectId, taskDesc, projectName });

    if (!result.ok) {
      const message = result.reason === 'already-running'
        ? 'A timer is already running.'
        : 'Select a project before starting the timer.';
      return event.sender.send('timer-start-error', { reason: result.reason, message });
    }

    event.sender.send('active-timer', result.state);
  });

  ipcMain.on('stop-timer', (event) => {
    const finished = activeTimer.stop();

    // Idle stop - a double click, or a page that rendered a stale state. Reply
    // anyway so the caller converges on "nothing is running".
    if (!finished) return event.sender.send('active-timer', null);

    event.sender.send('active-timer', null);

    // The slot is already empty and the page has already repainted as idle, so
    // a failed insert means the session exists nowhere. Say so instead of
    // reporting success: the duration goes back with the error, which is the
    // only remaining copy the user can act on.
    persistTimer(finished, (insertErr) => {
      if (insertErr) {
        return event.sender.send('timer-save-error', {
          duration: finished.duration,
          message: insertErr.message
        });
      }

      event.sender.send('timer-saved', { duration: finished.duration });
    });
  });

  ipcMain.on('get-timers', (event, { page, projectId, startDate, endDate } = { page: 1 }) => {
    const pageSize = 15;
    const currentPage = page && page > 0 ? page : 1;
    const filterProjectId = projectId && projectId !== '' ? projectId : null;
    const filterStartDate = startDate && startDate !== '' ? startDate : null;
    const filterEndDate = endDate && endDate !== '' ? endDate : null;

    // Validate date range
    if (filterStartDate && filterEndDate && filterStartDate > filterEndDate) {
      return event.sender.send('timers-error', 'Start date must be before or equal to end date');
    }

    countTimers(filterProjectId, filterStartDate, filterEndDate, (err, total) => {
      if (err) return event.sender.send('timers-error', err.message);
      getTimers(currentPage, pageSize, filterProjectId, filterStartDate, filterEndDate, (err2, rows) => {
        if (err2) return event.sender.send('timers-error', err2.message);
        const totalPages = Math.ceil(total / pageSize) || 1;
        event.sender.send('timers', { rows, page: currentPage, pageSize, total, totalPages });
      });
    });
  });

  ipcMain.on('update-timer', (event, { id, start_time, end_time, amount_earned }) => {
    updateTimer(id, start_time, end_time, amount_earned, (err, updatedRow) => {
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

  ipcMain.on('export-csv', async (event, { projectId, startDate, endDate } = {}) => {
    try {
      const filterProjectId = projectId && projectId !== '' ? projectId : null;
      const filterStartDate = startDate && startDate !== '' ? startDate : null;
      const filterEndDate = endDate && endDate !== '' ? endDate : null;

      // Validate date range
      if (filterStartDate && filterEndDate && filterStartDate > filterEndDate) {
        return event.sender.send('csv-export-error', 'Start date must be before or equal to end date');
      }

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
        getTimersForExport(filterProjectId, filterStartDate, filterEndDate, (err, rows) => {
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

  ipcMain.handle('dark-mode:toggle', () => {
    if (nativeTheme.shouldUseDarkColors) nativeTheme.themeSource = 'light';
    else nativeTheme.themeSource = 'dark';
    return nativeTheme.shouldUseDarkColors;
  });

  ipcMain.handle('dark-mode:system', () => {
    nativeTheme.themeSource = 'system';
    return nativeTheme.themeSource;
  });

  ipcMain.handle('dark-mode:set', (event, theme) => {
    if (['light', 'dark', 'system'].includes(theme)) {
      nativeTheme.themeSource = theme;
      return {
        themeSource: nativeTheme.themeSource,
        shouldUseDarkColors: nativeTheme.shouldUseDarkColors
      };
    }
    throw new Error(`Invalid theme: ${theme}`);
  });

  ipcMain.handle('dark-mode:get', () => {
    return {
      themeSource: nativeTheme.themeSource,
      shouldUseDarkColors: nativeTheme.shouldUseDarkColors
    };
  });
}

module.exports = setupIpcHandlers;

