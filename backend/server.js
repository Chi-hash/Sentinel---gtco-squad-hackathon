require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const db        = require('./db/database');
const { receiveWebhook } = require('./webhook/receiver');
const squadApi  = require('./squad-client/api');
const binLookup = require('./bin-lookup');

// ── Global safety net — prevents any single unhandled error from killing the process ──
process.on('uncaughtException',  (err) => console.error('[Sentinel] uncaughtException:', err.message));
process.on('unhandledRejection', (err) => console.error('[Sentinel] unhandledRejection:', err?.message ?? err));

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
  express.raw({ type: () => true }),   // capture raw body regardless of Content-Type
  (req, res) => receiveWebhook(req, res, db, io).catch((err) => {
    console.error('[Webhook] unhandled error:', err.message);
    res.status(500).json({ error: 'Internal error' });
  })
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

// BIN lookup — used by frontend to enrich card display
app.get('/api/bin/:bin', (req, res) => {
  const info = binLookup.lookupBin(req.params.bin);
  if (!info) return res.status(404).json({ error: 'BIN not found', bin: req.params.bin });
  res.json(info);
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

app.patch('/api/transactions/:ref', (req, res) => {
  try {
    const { status, tier } = req.body;
    db.updateTransactionStatus(req.params.ref, status, tier);
    res.json({ message: 'Updated' });
  } catch (err) {
    console.error('[API] PATCH /api/transactions error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/disputes/:ref/submit', async (req, res) => {
  try {
    const result = await squadApi.challengeDispute(req.params.ref);
    res.json(result || { message: 'Submitted' });
  } catch (err) {
    console.error('[API] POST /api/disputes submit error:', err.message);
    res.status(500).json({ error: err.message });
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

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[Server] Port ${PORT} is busy — retrying in 2 s...`);
    setTimeout(() => {
      server.close();
      server.listen(PORT);
    }, 2000);
  } else {
    throw err;
  }
});
