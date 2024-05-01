const express = require('express');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = 'your-secret-key'; // Change this with your secret key

// Initialize SQLite database
const db = new sqlite3.Database(':memory:');

// Create Users table
db.serialize(() => {
  db.run(`CREATE TABLE Users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT,
    password_hash TEXT
  )`);

  // Insert a dummy user for testing
  const stmt = db.prepare('INSERT INTO Users (username, password_hash) VALUES (?, ?)');
  stmt.run('user1', 'password123');
  stmt.finalize();
});

// Create Tasks table
db.serialize(() => {
  db.run(`CREATE TABLE Tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    description TEXT,
    status TEXT,
    assignee_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(assignee_id) REFERENCES Users(id)
  )`);
});

// Middleware for JSON parsing
app.use(bodyParser.json());

// Middleware for authentication
function authenticateUser(req, res, next) {
  const token = req.headers['authorization'];

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }

    req.user = decoded;
    next();
  });
}

// Routes
app.post('/login', (req, res) => {
  // For simplicity, assume username and password are sent in request body
  const { username, password } = req.body;

  // Dummy check for username and password
  if (username === 'user1' && password === 'password123') {
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

app.get('/tasks/:id', authenticateUser, (req, res) => {
    const taskId = req.params.id;
  
    db.get('SELECT * FROM Tasks WHERE id = ?', [taskId], (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Internal Server Error' });
      }
      if (!row) {
        return res.status(404).json({ error: 'Task not found' });
      }
      res.json(row);
    });
  });



app.put('/tasks/:id', authenticateUser, (req, res) => {
  const taskId = req.params.id;
  const { title, description, status, assignee_id } = req.body;

  db.run(
    `UPDATE Tasks 
     SET title = ?, description = ?, status = ?, assignee_id = ?, updated_at = CURRENT_TIMESTAMP 
     WHERE id = ?`,
    [title, description, status, assignee_id, taskId],
    function (err) {
      if (err) {
        return res.status(500).json({ error: 'Internal Server Error' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Task not found' });
      }

      res.json({
        id: taskId,
        title,
        description,
        status,
        assignee_id,
        updated_at: new Date().toISOString()
      });
    }
  );
});



app.delete('/tasks/:id', authenticateUser, (req, res) => {
  const taskId = req.params.id;

  db.run('DELETE FROM Tasks WHERE id = ?', [taskId], function (err) {
    if (err) {
      return res.status(500).json({ error: 'Internal Server Error' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json({ message: 'Task deleted successfully' });
  });
});

  

app.get('/tasks', authenticateUser, (req, res) => {
  db.all('SELECT * FROM Tasks', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Internal Server Error' });
    }
    res.json(rows);
  });
});

app.post('/tasks', authenticateUser, (req, res) => {
  const { title, description, assignee_id } = req.body;

  db.run(`INSERT INTO Tasks (title, description, status, assignee_id) VALUES (?, ?, ?, ?)`,
    [title, description, 'pending', assignee_id],
    function (err) {
      if (err) {
        return res.status(500).json({ error: 'Internal Server Error' });
      }
      res.json({
        id: this.lastID,
        title,
        description,
        status: 'pending',
        assignee_id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
