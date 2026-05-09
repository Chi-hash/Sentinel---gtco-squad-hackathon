const Database = require('better-sqlite3');
const path = require('path');

// Create (or open) the database file
const db = new Database(path.join(__dirname, '../../sentinel.sqlite'));

// ── Create table on first run ─────────────────────────────────────────────────
function initDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      ref          TEXT UNIQUE,
      email        TEXT,
      amount       REAL,
      card_bin     TEXT,
      score        INTEGER,
      tier         TEXT,
      reasons      TEXT,
      timestamp    TEXT,
      action_taken TEXT
    )
  `);
  console.log('Database ready.');
}

// ── Write ─────────────────────────────────────────────────────────────────────
function saveTransaction(txn) {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO transactions
      (ref, email, amount, card_bin, score, tier, reasons, timestamp, action_taken)
    VALUES
      (@ref, @email, @amount, @card_bin, @score, @tier, @reasons, @timestamp, @action_taken)
  `);
  stmt.run({
    ...txn,
    reasons: JSON.stringify(txn.reasons)
  });
}

// ── Read ──────────────────────────────────────────────────────────────────────
function transactionExists(ref) {
  const row = db.prepare('SELECT id FROM transactions WHERE ref = ?').get(ref);
  return !!row;
}

function getRecentByEmail(email, minutes) {
  const since = new Date(Date.now() - minutes * 60 * 1000).toISOString();
  return db.prepare(
    'SELECT * FROM transactions WHERE email = ? AND timestamp >= ?'
  ).all(email, since);
}

function getRecentByBin(bin, minutes) {
  const since = new Date(Date.now() - minutes * 60 * 1000).toISOString();
  return db.prepare(
    'SELECT DISTINCT email FROM transactions WHERE card_bin = ? AND timestamp >= ?'
  ).all(bin, since);
}

function getUserHistory(email) {
  return db.prepare(
    'SELECT amount FROM transactions WHERE email = ?'
  ).all(email);
}

function getAllTransactions() {
  return db.prepare(
    'SELECT * FROM transactions ORDER BY id DESC LIMIT 100'
  ).all();
}

function getMerchantAverage() {
  const row = db.prepare('SELECT AVG(amount) as avg FROM transactions').get();
  return row.avg || 50000; // default 500 NGN in kobo if no history
}

module.exports = {
  initDB,
  saveTransaction,
  transactionExists,
  getRecentByEmail,
  getRecentByBin,
  getUserHistory,
  getAllTransactions,
  getMerchantAverage
};

initDB();