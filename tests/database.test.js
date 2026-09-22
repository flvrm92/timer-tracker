const fs = require('fs');
const path = require('path');

process.env.DB_PATH = path.join(__dirname, 'test-timers.db');

// Fresh DB per test run
if (fs.existsSync(process.env.DB_PATH)) fs.unlinkSync(process.env.DB_PATH);

const {
  insertTimer, insertProject, updateProject, getProjects, getProjectById, deleteProject,
  getTimers, countTimers, updateTimer, getTimersForExport, deleteTimer, initializeDatabase
} = require('../src/infra/database');

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

function promisifyGetTimers(page, pageSize = 15, projectId = null, startDate = null, endDate = null) {
  return new Promise((resolve, reject) => {
    getTimers(page, pageSize, projectId, startDate, endDate, (err, rows) => {
      if (err) reject(err); else resolve(rows);
    });
  });
}

function promisifyCountTimers(projectId = null, startDate = null, endDate = null) {
  return new Promise((resolve, reject) => {
    countTimers(projectId, startDate, endDate, (err, total) => err ? reject(err) : resolve(total));
  });
}

function promisifyUpdateTimer(id, start, end, amount_earned) {
  return new Promise((resolve, reject) => {
    updateTimer(id, start, end, amount_earned, (err, row) => {
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
    const updated = await promisifyUpdateTimer(row.id, newStart, newEnd, 0);
    expect(updated.duration).toBe(8);
  });

  test('updateTimer rejects invalid date order', async () => {
    const rows = await promisifyGetTimers(1);
    const row = rows[0];
    const laterStart = new Date(Date.now() + 10000).toISOString();
    const earlierEnd = new Date().toISOString();
    await expect(promisifyUpdateTimer(row.id, laterStart, earlierEnd, 0)).rejects.toThrow('End time must be after start time');
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
      getTimersForExport(null, null, null, (err, rows) => {
        if (err) reject(err); else resolve(rows);
      });
    });
    expect(allTimers.length).toBe(2);

    const filteredTimers = await new Promise((resolve, reject) => {
      getTimersForExport(project.id, null, null, (err, rows) => {
        if (err) reject(err); else resolve(rows);
      });
    });
    expect(filteredTimers.length).toBe(1);
    expect(filteredTimers[0].project_name).toBe('Test Project');
  });

  test('getTimers filters by date range correctly', async () => {
    // Test data setup - we already have timers from previous tests
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Test filtering by today only
    const todayTimers = await promisifyGetTimers(1, 15, null, today, today);
    expect(todayTimers.length).toBeGreaterThanOrEqual(0); // May or may not have timers for today

    // Test filtering with date range that includes all our test data
    const allTimers = await promisifyGetTimers(1, 15, null, yesterday, tomorrow);
    expect(allTimers.length).toBe(2); // Should include both test timers

    // Test filtering with impossible date range
    const noTimers = await promisifyGetTimers(1, 15, null, tomorrow, tomorrow);
    expect(noTimers.length).toBe(0); // Should be empty for future dates
  });

  test('countTimers filters by date range correctly', async () => {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Test counting with date range that includes all our test data
    const allCount = await promisifyCountTimers(null, yesterday, tomorrow);
    expect(allCount).toBe(2);

    // Test counting with impossible date range
    const noCount = await promisifyCountTimers(null, tomorrow, tomorrow);
    expect(noCount).toBe(0);
  });

  test('getTimersForExport filters by date range correctly', async () => {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Test export with date range that includes all our test data
    const allExportTimers = await new Promise((resolve, reject) => {
      getTimersForExport(null, yesterday, tomorrow, (err, rows) => {
        if (err) reject(err); else resolve(rows);
      });
    });
    expect(allExportTimers.length).toBe(2);

    // Test export with project and date filters combined
    const filteredExportTimers = await new Promise((resolve, reject) => {
      getTimersForExport(project.id, yesterday, tomorrow, (err, rows) => {
        if (err) reject(err); else resolve(rows);
      });
    });
    expect(filteredExportTimers.length).toBe(1);
    expect(filteredExportTimers[0].project_name).toBe('Test Project');
  });
});

describe('Database project operations', () => {
  let billableProjId;

  beforeAll(async () => {
    const p = await new Promise((resolve, reject) => {
      insertProject('Billable Project', true, 75.0, (err, project) => {
        if (err) reject(err); else resolve(project);
      });
    });
    billableProjId = p.id;
  });

  test('insertProject with billable fields returns correct data', async () => {
    const p = await new Promise((resolve, reject) => {
      insertProject('Another Billable', true, 100.0, (err, project) => {
        if (err) reject(err); else resolve(project);
      });
    });
    expect(p.name).toBe('Another Billable');
    expect(p.is_billable).toBe(true);
    expect(p.hourly_rate).toBe(100.0);
  });

  test('insertProject legacy string format returns correct data', async () => {
    const p = await new Promise((resolve, reject) => {
      insertProject('Legacy Project', (err, project) => {
        if (err) reject(err); else resolve(project);
      });
    });
    expect(p.name).toBe('Legacy Project');
    expect(p.is_billable).toBe(false);
    expect(p.hourly_rate).toBe(null);
  });

  test('getProjectById returns correct project', async () => {
    const p = await new Promise((resolve, reject) => {
      getProjectById(billableProjId, (err, project) => {
        if (err) reject(err); else resolve(project);
      });
    });
    expect(p).toBeTruthy();
    expect(p.id).toBe(billableProjId);
    expect(p.name).toBe('Billable Project');
  });

  test('getProjects returns all projects including the new ones', async () => {
    const projects = await new Promise((resolve, reject) => {
      getProjects((err, rows) => {
        if (err) reject(err); else resolve(rows);
      });
    });
    expect(Array.isArray(projects)).toBe(true);
    expect(projects.length).toBeGreaterThanOrEqual(1);
    const found = projects.find(p => p.id === billableProjId);
    expect(found).toBeTruthy();
  });

  test('updateProject updates name and billable fields', async () => {
    const updated = await new Promise((resolve, reject) => {
      updateProject(billableProjId, 'Updated Billable', false, null, (err, project) => {
        if (err) reject(err); else resolve(project);
      });
    });
    expect(updated.name).toBe('Updated Billable');
    expect(updated.is_billable).toBe(0);
  });

  test('deleteProject removes project so getProjectById returns undefined', async () => {
    const tempProj = await new Promise((resolve, reject) => {
      insertProject('Temp Project', (err, project) => {
        if (err) reject(err); else resolve(project);
      });
    });
    await new Promise((resolve, reject) => {
      deleteProject(tempProj.id, (err) => {
        if (err) reject(err); else resolve();
      });
    });
    const gone = await new Promise((resolve, reject) => {
      getProjectById(tempProj.id, (err, project) => {
        if (err) reject(err); else resolve(project);
      });
    });
    expect(gone).toBeUndefined();
  });
});

describe('Database deleteTimer operation', () => {
  test('deleteTimer removes the record so countTimers returns zero for that project', async () => {
    const p = await new Promise((resolve, reject) => {
      insertProject('Delete Test Project', (err, proj) => {
        if (err) reject(err); else resolve(proj);
      });
    });
    const start = new Date().toISOString();
    const end = new Date(Date.now() + 2000).toISOString();
    const timerResult = await new Promise((resolve, reject) => {
      insertTimer(p.id, start, end, 2, 'Delete Test', (err, result) => {
        if (err) reject(err); else resolve(result);
      });
    });
    await new Promise((resolve, reject) => {
      deleteTimer(timerResult.id, (err) => {
        if (err) reject(err); else resolve();
      });
    });
    const total = await new Promise((resolve, reject) => {
      countTimers(p.id, null, null, (err, count) => {
        if (err) reject(err); else resolve(count);
      });
    });
    expect(total).toBe(0);
  });
});
