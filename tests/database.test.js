const fs = require('fs');
const path = require('path');

process.env.DB_PATH = path.join(__dirname, 'test-timers.db');

// Fresh DB per test run
if (fs.existsSync(process.env.DB_PATH)) fs.unlinkSync(process.env.DB_PATH);

const { insertTimer, insertProject, getProjects, getTimers, countTimers, updateTimer, getTimersForExport, initializeDatabase } = require('../src/infra/database');

function promisifyInitializeDatabase() {
  return new Promise((resolve, reject) => {
    initializeDatabase((err) => {
      if (err) reject(err); else resolve();
    });
  });
}

function promisifyInsertProject(name) {
  return new Promise((resolve, reject) => {
    insertProject(name, (err, project) => {
      if (err) reject(err); else resolve(project);
    });
  });
}

function promisifyGetTimers(page, pageSize = 15, projectId = null) {
  return new Promise((resolve, reject) => {
    getTimers(page, pageSize, projectId, (err, rows) => {
      if (err) reject(err); else resolve(rows);
    });
  });
}

function promisifyCountTimers(projectId = null) {
  return new Promise((resolve, reject) => {
    countTimers(projectId, (err, total) => err ? reject(err) : resolve(total));
  });
}

function promisifyUpdateTimer(id, start, end) {
  return new Promise((resolve, reject) => {
    updateTimer(id, start, end, (err, row) => {
      if (err) reject(err); else resolve(row);
    });
  });
}

// Helper sleep for async ordering
const wait = ms => new Promise(r => setTimeout(r, ms));

describe('Database timer operations', () => {
  let project;

  beforeAll(async () => {
    await promisifyInitializeDatabase();
    project = await promisifyInsertProject('Test Project');
  });

  test('insertTimer stores record & countTimers reflects', async () => {
    const start = new Date().toISOString();
    const end = new Date(Date.now() + 5000).toISOString();
    await new Promise((resolve, reject) => {
      insertTimer(project.id, start, end, 5, 'Task A', (err) => err ? reject(err) : resolve());
    });
    const total = await promisifyCountTimers();
    expect(total).toBe(1);
  });

  test('getTimers returns joined project_name', async () => {
    const rows = await promisifyGetTimers(1);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    const row = rows[0];
    expect(row.project_name).toBe('Test Project');
  });

  test('updateTimer recalculates duration & validates order', async () => {
    const rows = await promisifyGetTimers(1);
    const row = rows[0];
    const newStart = new Date().toISOString();
    const newEnd = new Date(Date.now() + 8000).toISOString();
    const updated = await promisifyUpdateTimer(row.id, newStart, newEnd);
    expect(updated.duration).toBe(8);
  });

  test('updateTimer rejects invalid date order', async () => {
    const rows = await promisifyGetTimers(1);
    const row = rows[0];
    const laterStart = new Date(Date.now() + 10000).toISOString();
    const earlierEnd = new Date().toISOString();
    await expect(promisifyUpdateTimer(row.id, laterStart, earlierEnd)).rejects.toThrow('End time must be after start time');
  });

  test('getTimers filters by project correctly', async () => {
    // Create a second project
    const project2 = await promisifyInsertProject('Test Project 2');

    // Add timer to second project
    const start2 = new Date().toISOString();
    const end2 = new Date(Date.now() + 3000).toISOString();
    await new Promise((resolve, reject) => {
      insertTimer(project2.id, start2, end2, 3, 'Task B', (err) => err ? reject(err) : resolve());
    });

    // Test filtering
    const allTimers = await promisifyGetTimers(1);
    expect(allTimers.length).toBe(2);

    const project1Timers = await promisifyGetTimers(1, 15, project.id);
    expect(project1Timers.length).toBe(1);
    expect(project1Timers[0].project_name).toBe('Test Project');

    const project2Timers = await promisifyGetTimers(1, 15, project2.id);
    expect(project2Timers.length).toBe(1);
    expect(project2Timers[0].project_name).toBe('Test Project 2');
  });

  test('countTimers filters by project correctly', async () => {
    const totalCount = await promisifyCountTimers();
    expect(totalCount).toBe(2);

    const project1Count = await promisifyCountTimers(project.id);
    expect(project1Count).toBe(1);
  });

  test('getTimersForExport returns all timers for export', async () => {
    const allTimers = await new Promise((resolve, reject) => {
      getTimersForExport(null, (err, rows) => {
        if (err) reject(err); else resolve(rows);
      });
    });
    expect(allTimers.length).toBe(2);

    const filteredTimers = await new Promise((resolve, reject) => {
      getTimersForExport(project.id, (err, rows) => {
        if (err) reject(err); else resolve(rows);
      });
    });
    expect(filteredTimers.length).toBe(1);
    expect(filteredTimers[0].project_name).toBe('Test Project');
  });
});
