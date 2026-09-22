// Storage-side guard for the CSV export encoding fix.
//
// SQLite stores TEXT as UTF-8 and node-sqlite3 binds JS strings as UTF-8, so
// project names and task descriptions must come back byte-identical. This
// suite owns its own database file (the tests/dashboardQueries.test.js
// pattern) so the rows it inserts cannot perturb the exact-count assertions
// in tests/database.test.js.
const fs = require('fs');
const path = require('path');

process.env.DB_PATH = path.join(__dirname, 'test-encoding.db');

// Fresh DB per test run
if (fs.existsSync(process.env.DB_PATH)) fs.unlinkSync(process.env.DB_PATH);

const {
  insertTimer,
  insertProject,
  getProjects,
  getTimers,
  initializeDatabase
} = require('../src/infra/database');

// The emoji is deliberate: an astral-plane codepoint is a surrogate pair in
// UTF-16, so it catches surrogate mishandling that accented Latin-1 would not.
const PROJECT_NAME = 'Próprio — Conciliação 🎯';
const TASK_DESCRIPTION = 'Avançado: revisão de ações';

function init() {
  return new Promise((resolve, reject) => {
    initializeDatabase((err) => (err ? reject(err) : resolve()));
  });
}

function addProject(name) {
  return new Promise((resolve, reject) => {
    insertProject(name, (err, project) => (err ? reject(err) : resolve(project)));
  });
}

describe('Database non-ASCII round-trip', () => {
  beforeAll(async () => {
    await init();
  });

  test('project names survive insert and select unchanged', async () => {
    const created = await addProject(PROJECT_NAME);
    expect(created.name).toBe(PROJECT_NAME);

    const projects = await new Promise((resolve, reject) => {
      getProjects((err, rows) => (err ? reject(err) : resolve(rows)));
    });
    const stored = projects.find(p => p.id === created.id);
    expect(stored.name).toBe(PROJECT_NAME);
  });

  test('task descriptions survive insert and select unchanged', async () => {
    const project = await addProject('Encoding Task Project');
    const start = new Date().toISOString();
    const end = new Date(Date.now() + 1000).toISOString();

    await new Promise((resolve, reject) => {
      insertTimer(project.id, start, end, 1, TASK_DESCRIPTION, (err) => (err ? reject(err) : resolve()));
    });

    const rows = await new Promise((resolve, reject) => {
      getTimers(1, 15, project.id, null, null, (err, r) => (err ? reject(err) : resolve(r)));
    });

    expect(rows[0].task_description).toBe(TASK_DESCRIPTION);
    expect(rows[0].project_name).toBe('Encoding Task Project');
  });
});
