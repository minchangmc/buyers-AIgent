import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { Anthropic } from '@anthropic-ai/sdk';
import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import jwt from 'jsonwebtoken';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const anthropic = new Anthropic();
const db = new sqlite3.Database('homebuyer.db');

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(cookieParser());
app.use(express.static('public'));

// Database initialization
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    orientation_data TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY,
    user_id INTEGER,
    property_address TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY,
    session_id INTEGER,
    content TEXT,
    is_ai BOOLEAN,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(session_id) REFERENCES sessions(id)
  )`);
});

// Routes
app.post('/api/orientation', async (req, res) => {
  const { answers } = req.body;
  db.run('INSERT INTO users (orientation_data) VALUES (?)', 
    [JSON.stringify(answers)],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ userId: this.lastID });
    }
  );
});

app.post('/api/session', async (req, res) => {
  const { userId, propertyAddress } = req.body;
  db.run('INSERT INTO sessions (user_id, property_address) VALUES (?, ?)',
    [userId, propertyAddress],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ sessionId: this.lastID });
    }
  );
});

app.get('/api/sessions', (req, res) => {
  const { userId } = req.query;
  db.all('SELECT * FROM sessions WHERE user_id = ? ORDER BY timestamp DESC',
    [userId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

app.get('/api/chat/:sessionId/history', (req, res) => {
  const { sessionId } = req.params;
  db.all('SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp ASC',
    [sessionId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

app.post('/api/chat/:sessionId', async (req, res) => {
  const { message } = req.body;
  const { sessionId } = req.params;

  try {
    db.run('INSERT INTO messages (session_id, content, is_ai) VALUES (?, ?, ?)',
      [sessionId, message, false]);

    // Get user's orientation data
    const userDataQuery = await new Promise((resolve, reject) => {
      db.get('SELECT orientation_data FROM users WHERE id = (SELECT user_id FROM sessions WHERE id = ?)', 
        [sessionId], 
        (err, row) => err ? reject(err) : resolve(row)
      );
    });

    // Get property address
    const sessionQuery = await new Promise((resolve, reject) => {
      db.get('SELECT property_address FROM sessions WHERE id = ?',
        [sessionId],
        (err, row) => err ? reject(err) : resolve(row)
      );
    });

    // Get conversation history
    const historyQuery = await new Promise((resolve, reject) => {
      db.all('SELECT content, is_ai FROM messages WHERE session_id = ? ORDER BY timestamp ASC',
        [sessionId],
        (err, rows) => err ? reject(err) : resolve(rows)
      );
    });

    const systemPrompt = `You are a first-time home buyer assistant analyzing the property at: ${sessionQuery.property_address}.
User orientation data: ${userDataQuery.orientation_data}`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...historyQuery.map(msg => ({
        role: msg.is_ai ? "assistant" : "user",
        content: msg.content
      })),
      { role: "user", content: message }
    ];

    const response = await anthropic.messages.create({
      model: "claude-3-sonnet-20240229",
      max_tokens: 1000,
      messages: messages,
    });

    const aiResponse = response.content[0].text;

    db.run('INSERT INTO messages (session_id, content, is_ai) VALUES (?, ?, ?)',
      [sessionId, aiResponse, true]);

    res.json({ response: aiResponse });
  } catch (error) {
    console.error('Claude API Error:', error);
    res.status(500).json({ error: "Failed to get AI response" });
  }
});

app.listen(3000, '0.0.0.0', () => {
  console.log('Server running on port 3000');
});