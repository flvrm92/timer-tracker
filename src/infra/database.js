const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Initialize the database (allow override for tests via DB_PATH)
const dbPath = process.env.DB_PATH ? process.env.DB_PATH : path.join(__dirname, 'timers.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error connecting to SQLite:', err.message);
  } else {
    console.log('Connected to SQLite database.');
  }
});

db.run(`
  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
  )
`);

db.run(
  `CREATE TABLE IF NOT EXISTS timers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    start_time TEXT,
    end_time TEXT,
    duration INTEGER,
    task_description TEXT NULLABLE,
    FOREIGN KEY (project_id) REFERENCES projects(id)
  )`,
  (err) => {
    if (err) {
      console.error('Error creating table:', err.message);
    }
  }
);

function initializeDatabase(callback) {
  let completed = 0;
  const total = 2;

  function onComplete(err) {
    if (err) return callback(err);
    completed++;
    if (completed === total) {
      callback(null);
    }
  }

  db.run(`CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
  )`, onComplete);

  db.run(`CREATE TABLE IF NOT EXISTS timers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    start_time TEXT,
    end_time TEXT,
    duration INTEGER,
    task_description TEXT NULLABLE,
    FOREIGN KEY (project_id) REFERENCES projects(id)
  )`, onComplete);
}

function insertTimer(projectId, startTime, endTime, duration, taskDesc, callback) {
  const query = `INSERT INTO timers (project_id, start_time, end_time, duration, task_description) VALUES (?, ?, ?, ?, ?)`;
  db.run(query, [projectId, startTime, endTime, duration, taskDesc], function (err) {
    if (err) {
      console.error('Error inserting timer:', err.message);
      if (callback) callback(err);
    } else {
      console.log(`Timer record added with ID: ${this.lastID}`);
      if (callback) callback(null, { id: this.lastID });
    }
  });
}

function getTimers(page, pageSize, projectId = null, callback) {
  const offset = (page - 1) * pageSize;
  let query = `SELECT t.id, t.project_id, p.name AS project_name, t.task_description, t.start_time, t.end_time, t.duration
               FROM timers t
               LEFT JOIN projects p ON p.id = t.project_id`;
  let params = [];

  if (projectId) {
    query += ` WHERE t.project_id = ?`;
    params.push(projectId);
  }

  query += ` ORDER BY t.start_time DESC LIMIT ? OFFSET ?`;
  params.push(pageSize, offset);

  db.all(query, params, (err, rows) => {
    if (err) return callback(err);
    callback(null, rows);
  });
}

function countTimers(projectId = null, callback) {
  let query = 'SELECT COUNT(*) AS count FROM timers';
  let params = [];

  if (projectId) {
    query += ' WHERE project_id = ?';
    params.push(projectId);
  }

  db.get(query, params, (err, row) => {
    if (err) return callback(err);
    callback(null, row.count);
  });
}

function getTimersForExport(projectId = null, callback) {
  let query = `SELECT t.id, t.project_id, p.name AS project_name, t.task_description, t.start_time, t.end_time, t.duration
               FROM timers t
               LEFT JOIN projects p ON p.id = t.project_id`;
  let params = [];

  if (projectId) {
    query += ` WHERE t.project_id = ?`;
    params.push(projectId);
  }

  query += ` ORDER BY t.start_time DESC`;

  db.all(query, params, (err, rows) => {
    if (err) return callback(err);
    callback(null, rows);
  });
}

function getTimerById(id, callback) {
  const query = `SELECT t.id, t.project_id, p.name AS project_name, t.task_description, t.start_time, t.end_time, t.duration
                 FROM timers t
                 LEFT JOIN projects p ON p.id = t.project_id
                 WHERE t.id = ?`;
  db.get(query, [id], (err, row) => {
    if (err) return callback(err);
    callback(null, row);
  });
}

function updateTimer(id, startTime, endTime, callback) {
  try {
    const start = new Date(startTime);
    const end = new Date(endTime);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return callback(new Error('Invalid date format'));
    }
    const duration = Math.floor((end - start) / 1000);
    if (duration < 0) {
      return callback(new Error('End time must be after start time'));
    }
    const query = `UPDATE timers SET start_time = ?, end_time = ?, duration = ? WHERE id = ?`;
    db.run(query, [start.toISOString(), end.toISOString(), duration, id], function (err) {
      if (err) return callback(err);
      getTimerById(id, callback);
    });
  } catch (e) {
    callback(e);
  }
}

function deleteTimer(id, callback) {
  const query = `DELETE FROM timers WHERE id = ?`;
  db.run(query, [id], function (err) {
    if (err) {
      console.error('Error deleting timer:', err.message);
      return callback(err);
    }
    console.log(`Timer ${id} deleted`);
    callback(null);
  });
}

function insertProject(name, callback) {
  const query = `INSERT INTO projects (name) VALUES (?)`;
  db.run(query, [name], function (err) {
    if (err) {
      console.error('Error inserting project:', err.message);
      callback(err);
    } else {
      console.log(`Project added with ID: ${this.lastID}`);
      callback(null, { id: this.lastID, name });
    }
  });
}

function deleteProject(id, callback) {
  console.log('id', id);
  const query = `DELETE FROM projects where id = (?)`;
  db.run(query, [id], function (err) {
    if (err) {
      console.error('Error deleting project:', err.message);
      callback(err);
    } else {
      console.log(`Project ${id} deleted`);
      callback(null);
    }
  })
}

function getProjects(callback) {
  const query = `SELECT * FROM projects`;
  db.all(query, [], (err, rows) => {
    if (err) {
      console.error('Error retrieving projects:', err.message);
      callback(err);
    } else {
      callback(null, rows);
    }
  });
}

module.exports = {
  insertTimer,
  insertProject,
  getProjects,
  deleteProject,
  getTimers,
  countTimers,
  getTimersForExport,
  updateTimer,
  getTimerById,
  deleteTimer,
  initializeDatabase
};
