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
      features     TEXT,
      timestamp    TEXT,
      action_taken TEXT
    )
  `);
  // Migrations for columns added after initial schema
  try { db.exec('ALTER TABLE transactions ADD COLUMN features TEXT'); } catch (_) {}
  try { db.exec('ALTER TABLE transactions ADD COLUMN bin_info TEXT'); } catch (_) {}
  try { db.exec('ALTER TABLE transactions ADD COLUMN source TEXT DEFAULT "real"'); } catch (_) {}
  console.log('Database ready.');
}

// ── Write ─────────────────────────────────────────────────────────────────────
function saveTransaction(txn) {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO transactions
      (ref, email, amount, card_bin, bin_info, score, tier, reasons, features, timestamp, action_taken, source)
    VALUES
      (@ref, @email, @amount, @card_bin, @bin_info, @score, @tier, @reasons, @features, @timestamp, @action_taken, @source)
  `);
  stmt.run({
    ...txn,
    bin_info: JSON.stringify(txn.bin_info || null),
    reasons:  JSON.stringify(txn.reasons  || []),
    features: JSON.stringify(txn.features || {}),
    source:   txn.source || 'real',
  });
}

function updateTransactionStatus(ref, status, tier) {
  db.prepare('UPDATE transactions SET action_taken = ?, tier = ? WHERE ref = ?')
    .run(status, tier, ref);
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

function getAllTransactions(source) {
  const query = source
    ? 'SELECT * FROM transactions WHERE source = ? ORDER BY id DESC LIMIT 100'
    : 'SELECT * FROM transactions ORDER BY id DESC LIMIT 100';
  const params = source ? [source] : [];
  return db.prepare(query)
    .all(...params)
    .map(r => ({
      ...r,
      bin_info: JSON.parse(r.bin_info || 'null'),
      reasons:  JSON.parse(r.reasons  || '[]'),
      features: JSON.parse(r.features || '{}'),
    }));
}

function getMerchantAverage() {
  const row = db.prepare('SELECT AVG(amount) as avg FROM transactions').get();
  return row.avg || 50000; // default 500 NGN in kobo if no history
}

module.exports = {
  initDB,
  saveTransaction,
  updateTransactionStatus,
  transactionExists,
  getRecentByEmail,
  getRecentByBin,
  getUserHistory,
  getAllTransactions,
  getMerchantAverage,
};