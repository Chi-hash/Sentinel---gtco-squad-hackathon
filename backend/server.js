require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const db        = require('./db/database');
const { receiveWebhook } = require('./webhook/receiver');
const squadApi  = require('./squad-client/api');
const binLookup = require('./bin-lookup');
const scorer    = require('./ai-engine/scorer');

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
    // ?source=real  → verified merchants: real webhook + historical imports
    // ?source=demo  → demo transactions only
    // (no param)    → all transactions
    const { source } = req.query;

    // 'real' should include 'historical' — both are actual merchant data,
    // historical is just pre-imported rather than received via webhook.
    const transactions = source === 'real'
      ? await db.getRealAndHistoricalTransactions()
      : await db.getAllTransactions(source || null);

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

// Squad merchant verification — validates an API key against Squad's live API
app.post('/api/verify-merchant', async (req, res) => {
  const { api_key } = req.body;
  if (!api_key || typeof api_key !== 'string' || api_key.trim().length < 10)
    return res.status(400).json({ valid: false, error: 'Please enter a valid API key.' });

  try {
    const result = await squadApi.verifyMerchantKey(api_key);
    console.log(`[Merchant] Verification attempt — valid=${result.valid} env=${result.environment || '?'}`);
    res.status(result.valid ? 200 : 401).json(result);
  } catch (err) {
    console.error('[Merchant] verify error:', err.message);
    res.status(500).json({ valid: false, error: 'Verification failed — try again.' });
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

// Historical import — pulls last N days from Squad, scores each, saves to DB.
// Returns a summary: { imported, skipped, flagged, blocked }.
app.post('/api/history/import', async (req, res) => {
  try {
    const days = Number(req.query.days) || 30;
    console.log(`[History] Fetching last ${days} days from Squad...`);
    const rawList = await squadApi.getTransactionHistory(days);
    console.log(`[History] Squad returned ${rawList.length} transactions`);

    let imported = 0, skipped = 0, flagged = 0, blocked = 0;

    for (const raw of rawList) {
      // Normalise field names — Squad uses snake_case but names vary
      const transaction_ref = raw.transaction_ref || raw.transactionRef || raw.id;
      if (!transaction_ref) { skipped++; continue; }

      // Deduplicate — skip if already in our DB
      if (await db.transactionExists(transaction_ref)) { skipped++; continue; }

      const amount          = raw.amount || 0;
      const email           = raw.email || raw.customer_email || '';
      const card_bin        = raw.card_bin || raw.payment_information?.card_bin
                           || raw.payment_information?.first_6digits || '';
      const transaction_date = raw.created_at || raw.transaction_date || new Date().toISOString();
      const is_suspicious   = raw.is_suspicious === true;

      // BIN enrichment
      const bin_info = binLookup.lookupBin(card_bin);

      // Score through Sentinel's AI engine
      const { score, tier, reasons, features } = scorer.scoreTransaction(
        { amount, email, card_bin, timestamp: transaction_date, bin_info },
        db
      );

      const action_taken = tier === 'GREEN' ? 'approved' : tier === 'AMBER' ? 'flagged' : 'refunded';

      await db.saveTransaction({
        ref: transaction_ref,
        email,
        amount,
        card_bin,
        bin_info,
        score,
        tier,
        reasons,
        features,
        timestamp:    transaction_date,
        action_taken,
        source:       'historical',
        is_suspicious,
      });

      imported++;
      if (tier === 'AMBER') flagged++;
      if (tier === 'RED')   blocked++;
    }

    console.log(`[History] Done — imported=${imported} skipped=${skipped} flagged=${flagged} blocked=${blocked}`);
    res.json({ imported, skipped, flagged, blocked, days });
  } catch (err) {
    console.error('[History] import error:', err.message);
    res.status(500).json({ error: 'Historical import failed', detail: err.message });
  }
});

// Partial refund — AMBER smart response, refund only part of the transaction.
app.post('/api/transactions/:ref/partial-refund', async (req, res) => {
  try {
    const { ref } = req.params;
    const { amount } = req.body; // amount in kobo
    if (!amount || isNaN(Number(amount)))
      return res.status(400).json({ error: 'amount (kobo) is required' });

    const result = await squadApi.partialRefundTransaction(ref, Number(amount));
    // Update status in DB
    db.updateTransactionStatus(ref, 'partial-refunded', 'AMBER');
    console.log(`[API] Partial refund for ${ref} — amount=${amount}`);
    res.json(result || { message: 'Partial refund submitted' });
  } catch (err) {
    console.error('[API] partial-refund error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Cancel recurring card token — RED proactive block, gated by frontend confirmation.
app.patch('/api/transactions/:ref/cancel-token', async (req, res) => {
  try {
    const { ref } = req.params;
    const { token_ref } = req.body; // the token identifier from Squad
    const result = await squadApi.cancelRecurringToken(token_ref || ref);
    console.log(`[API] Token cancelled for txn=${ref}`);
    res.json(result || { message: 'Token cancelled' });
  } catch (err) {
    console.error('[API] cancel-token error:', err.message);
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
