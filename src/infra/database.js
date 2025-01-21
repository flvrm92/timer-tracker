const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Initialize the database
const dbPath = path.join(__dirname, 'timers.db');
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

function insertTimer(projectId, startTime, endTime, duration, taskDesc) {
  const query = `INSERT INTO timers (project_id, start_time, end_time, duration, task_description) VALUES (?, ?, ?, ?, ?)`;
  db.run(query, [projectId, startTime, endTime, duration, taskDesc], function (err) {
    if (err) {
      console.error('Error inserting timer:', err.message);
    } else {
      console.log(`Timer record added with ID: ${this.lastID}`);
    }
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
  db.run(query, [id], function(err) {
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
  deleteProject
};
