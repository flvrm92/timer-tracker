const { getProjectById, insertTimer } = require('../infra/database');

/**
 * Writes one finished timer to the database, deriving amount_earned for
 * billable projects.
 *
 * Shared by the stop-timer IPC handler and the auto-save-on-quit hook in
 * main/index.js, so both compute earnings identically - a timer saved because
 * the app is closing must be indistinguishable from one the user stopped by
 * hand.
 *
 * Lives in its own module rather than on ipcHandlers' export because
 * main/index.js needs it, and index.js's test suite mocks ipcHandlers as a
 * bare function.
 *
 * The callback always runs, error or not: the quit path uses it to decide when
 * it is safe to exit, so swallowing it would wedge the app open.
 */
function persistTimer({ selectedProjectId, startTime, endTime, duration, taskDesc }, callback = () => {}) {
  getProjectById(selectedProjectId, (err, project) => {
    if (err) {
      console.error('Error getting project for timer calculation:', err);
      // Fall back to inserting the timer without an amount calculation.
      return insertTimer(selectedProjectId, startTime, endTime, duration, taskDesc, null,
        (insertErr, row) => callback(insertErr, row, null));
    }

    let amountEarned = null;

    if (project && project.is_billable && project.hourly_rate) {
      const durationInHours = duration / 3600;
      amountEarned = Math.round(durationInHours * parseFloat(project.hourly_rate) * 100) / 100;
    }

    insertTimer(selectedProjectId, startTime, endTime, duration, taskDesc, amountEarned,
      (insertErr, row) => callback(insertErr, row, amountEarned));
  });
}

module.exports = { persistTimer };
