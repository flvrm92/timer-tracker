const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = process.env.DB_PATH;
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error connecting to SQLite:', err.message);
  } else {
    console.log('Connected to SQLite database.');
  }
});

// Database schema version for migration tracking
const CURRENT_SCHEMA_VERSION = 2;

// Create initial tables if they don't exist
db.run(`
  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    is_billable BOOLEAN DEFAULT 0,
    hourly_rate DECIMAL(10,2) DEFAULT NULL
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
    amount_earned DECIMAL(10,2) DEFAULT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id)
  )`,
  (err) => {
    if (err) {
      console.error('Error creating table:', err.message);
    }
  }
);

// Create schema_version table for migration tracking
db.run(`
  CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY
  )
`);

function getCurrentSchemaVersion(callback) {
  db.get('SELECT version FROM schema_version ORDER BY version DESC LIMIT 1', (err, row) => {
    if (err) return callback(err);
    callback(null, row ? row.version : 0);
  });
}

function setSchemaVersion(version, callback) {
  db.run('INSERT OR REPLACE INTO schema_version (version) VALUES (?)', [version], callback);
}

function runMigrations(callback) {
  getCurrentSchemaVersion((err, currentVersion) => {
    if (err) return callback(err);

    console.log(`Current schema version: ${currentVersion}`);

    if (currentVersion >= CURRENT_SCHEMA_VERSION) {
      console.log('Database schema is up to date');
      return callback(null);
    }

    // Migration from version 0 to 1 (legacy to billable projects)
    if (currentVersion < 1) {
      console.log('Running migration to version 1: Adding billable project columns...');

      // Add is_billable column if it doesn't exist
      db.run('ALTER TABLE projects ADD COLUMN is_billable BOOLEAN DEFAULT 0', (err) => {
        if (err && !err.message.includes('duplicate column name')) {
          return callback(err);
        }

        // Add hourly_rate column if it doesn't exist
        db.run('ALTER TABLE projects ADD COLUMN hourly_rate DECIMAL(10,2) DEFAULT NULL', (err) => {
          if (err && !err.message.includes('duplicate column name')) {
            return callback(err);
          }

          // Add amount_earned column to timers table if it doesn't exist
          db.run('ALTER TABLE timers ADD COLUMN amount_earned DECIMAL(10,2) DEFAULT NULL', (err) => {
            if (err && !err.message.includes('duplicate column name')) {
              return callback(err);
            }

            console.log('Migration to version 1 completed');
            setSchemaVersion(1, (err) => {
              if (err) return callback(err);

              // Continue to next migration if needed
              if (CURRENT_SCHEMA_VERSION > 1) {
                runMigrations(callback);
              } else {
                callback(null);
              }
            });
          });
        });
      });
    } else {
      // If current version is >= 1 but < CURRENT_SCHEMA_VERSION, run future migrations here
      callback(null);
    }

    // Future migrations can be added here
    // if (currentVersion < 2) { ... }
  });
}

function initializeDatabase(callback) {
  let completed = 0;
  const total = 3; // Updated to include schema_version table

  function onComplete(err) {
    if (err) return callback(err);
    completed++;
    if (completed === total) {
      // Run migrations after initial table creation
      runMigrations((err) => {
        if (err) {
          console.error('Migration error:', err);
          return callback(err);
        }
        console.log('Database initialization and migrations completed');
        callback(null);
      });
    }
  }

  db.run(`CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    is_billable BOOLEAN DEFAULT 0,
    hourly_rate DECIMAL(10,2) DEFAULT NULL
  )`, onComplete);

  db.run(`CREATE TABLE IF NOT EXISTS timers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    start_time TEXT,
    end_time TEXT,
    duration INTEGER,
    task_description TEXT NULLABLE,
    amount_earned DECIMAL(10,2) DEFAULT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id)
  )`, onComplete);

  db.run(`CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY
  )`, onComplete);
}

function insertTimer(projectId, startTime, endTime, duration, taskDesc, amountEarned = null, callback) {
  // Support both old and new function signatures for backward compatibility
  if (typeof amountEarned === 'function') {
    callback = amountEarned;
    amountEarned = null;
  }

  const query = `INSERT INTO timers (project_id, start_time, end_time, duration, task_description, amount_earned) VALUES (?, ?, ?, ?, ?, ?)`;
  db.run(query, [projectId, startTime, endTime, duration, taskDesc, amountEarned], function (err) {
    if (err) {
      console.error('Error inserting timer:', err.message);
      if (callback) callback(err);
    } else {
      console.log(`Timer record added with ID: ${this.lastID}`);
      if (callback) callback(null, { id: this.lastID });
    }
  });
}

function getTimers(page, pageSize, projectId = null, startDate = null, endDate = null, callback) {
  const offset = (page - 1) * pageSize;
  let query = `SELECT t.id, t.project_id, p.name AS project_name, p.is_billable, p.hourly_rate, 
               t.task_description, t.start_time, t.end_time, t.duration, t.amount_earned
               FROM timers t
               LEFT JOIN projects p ON p.id = t.project_id
               WHERE 1=1`;
  let params = [];

  if (projectId) {
    query += ` AND t.project_id = ?`;
    params.push(projectId);
  }

  if (startDate) {
    query += ` AND DATE(t.start_time) >= ?`;
    params.push(startDate);
  }

  if (endDate) {
    query += ` AND DATE(t.start_time) <= ?`;
    params.push(endDate);
  }

  query += ` ORDER BY t.start_time DESC LIMIT ? OFFSET ?`;
  params.push(pageSize, offset);

  db.all(query, params, (err, rows) => {
    if (err) return callback(err);
    callback(null, rows);
  });
}

function countTimers(projectId = null, startDate = null, endDate = null, callback) {
  let query = 'SELECT COUNT(*) AS count FROM timers WHERE 1=1';
  let params = [];

  if (projectId) {
    query += ' AND project_id = ?';
    params.push(projectId);
  }

  if (startDate) {
    query += ' AND DATE(start_time) >= ?';
    params.push(startDate);
  }

  if (endDate) {
    query += ' AND DATE(start_time) <= ?';
    params.push(endDate);
  }

  db.get(query, params, (err, row) => {
    if (err) return callback(err);
    callback(null, row.count);
  });
}

function getTimersForExport(projectId = null, startDate = null, endDate = null, callback) {
  let query = `SELECT t.id, t.project_id, p.name AS project_name, p.is_billable, p.hourly_rate,
               t.task_description, t.start_time, t.end_time, t.duration, t.amount_earned
               FROM timers t
               LEFT JOIN projects p ON p.id = t.project_id
               WHERE 1=1`;
  let params = [];

  if (projectId) {
    query += ` AND t.project_id = ?`;
    params.push(projectId);
  }

  if (startDate) {
    query += ` AND DATE(t.start_time) >= ?`;
    params.push(startDate);
  }

  if (endDate) {
    query += ` AND DATE(t.start_time) <= ?`;
    params.push(endDate);
  }

  query += ` ORDER BY t.start_time DESC`;

  db.all(query, params, (err, rows) => {
    if (err) return callback(err);
    callback(null, rows);
  });
}

function getTimerById(id, callback) {
  const query = `SELECT t.id, t.project_id, p.name AS project_name, p.is_billable, p.hourly_rate,
                 t.task_description, t.start_time, t.end_time, t.duration, t.amount_earned
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

function insertProject(name, isBillable = false, hourlyRate = null, callback) {
  // Support both old and new function signatures for backward compatibility
  if (typeof isBillable === 'function') {
    callback = isBillable;
    isBillable = false;
    hourlyRate = null;
  } else if (typeof hourlyRate === 'function') {
    callback = hourlyRate;
    hourlyRate = null;
  }

  const query = `INSERT INTO projects (name, is_billable, hourly_rate) VALUES (?, ?, ?)`;
  db.run(query, [name, isBillable ? 1 : 0, hourlyRate], function (err) {
    if (err) {
      console.error('Error inserting project:', err.message);
      callback(err);
    } else {
      console.log(`Project added with ID: ${this.lastID}`);
      callback(null, { id: this.lastID, name, is_billable: isBillable, hourly_rate: hourlyRate });
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

function updateProject(id, name, isBillable = false, hourlyRate = null, callback) {
  const query = `UPDATE projects SET name = ?, is_billable = ?, hourly_rate = ? WHERE id = ?`;
  db.run(query, [name, isBillable ? 1 : 0, hourlyRate, id], function (err) {
    if (err) {
      console.error('Error updating project:', err.message);
      callback(err);
    } else {
      console.log(`Project ${id} updated`);
      // Return the updated project data
      getProjectById(id, callback);
    }
  });
}

function getProjectById(id, callback) {
  const query = `SELECT * FROM projects WHERE id = ?`;
  db.get(query, [id], (err, row) => {
    if (err) {
      console.error('Error retrieving project:', err.message);
      callback(err);
    } else {
      callback(null, row);
    }
  });
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
  updateProject,
  getProjects,
  getProjectById,
  deleteProject,
  getTimers,
  countTimers,
  getTimersForExport,
  updateTimer,
  getTimerById,
  deleteTimer,
  initializeDatabase
};
