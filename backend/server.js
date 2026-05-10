require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const db = require('./db/database');
const { receiveWebhook } = require('./webhook/receiver');
const squadApi = require('./squad-client/api');

// ── App + server setup ────────────────────────────────────────────────────────
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// ── Database ──────────────────────────────────────────────────────────────────
db.initDB();

// ── Static frontend ───────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../frontend')));

// ── Webhook route (raw body — MUST come before express.json) ──────────────────
// express.raw keeps req.body as a Buffer so HMAC-SHA512 validation works correctly.
app.post(
  '/webhook/squad',
  express.raw({ type: 'application/json' }),
  (req, res) => receiveWebhook(req, res, db, io)
);

// ── JSON middleware + REST API (after webhook route) ──────────────────────────
app.use(express.json());

app.get('/api/transactions', async (req, res) => {
  try {
    const transactions = await db.getAllTransactions();
    res.json(transactions);
  } catch (err) {
    console.error('[API] /api/transactions error:', err.message);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

app.get('/api/disputes', async (req, res) => {
  try {
    const disputes = await squadApi.getDisputes();
    res.json(disputes);
  } catch (err) {
    console.error('[API] /api/disputes error:', err.message);
    res.status(500).json({ error: 'Failed to fetch disputes' });
  }
});

// ── Socket.io connection logging ──────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log('[Socket.io] client connected');
  socket.on('disconnect', () => console.log('[Socket.io] client disconnected'));
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Sentinel running on http://localhost:${PORT}`);
});
