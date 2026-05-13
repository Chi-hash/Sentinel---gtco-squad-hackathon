const fs   = require('fs');
const path = require('path');

function rand(min, max)    { return Math.random() * (max - min) + min; }
function randInt(min, max) { return Math.floor(rand(min, max + 1)); }
function r2(n)             { return Math.round(n * 100) / 100; }

// Typical Nigerian e-commerce customer: regular hours, moderate amounts,
// low velocity, almost never reuses a BIN across multiple emails.
function normalTransaction() {
  return {
    amount:        randInt(100_000, 5_000_000),   // ₦1,000 – ₦50,000
    hour:          randInt(7, 22),                // 7am–10pm
    is_first_time: Math.random() < 0.20 ? 1 : 0, // 20% first-timers
    velocity:      Math.random() < 0.10 ? 1 : 0, // rare repeat in 5min
    bin_count:     Math.random() < 0.08 ? 2 : 1, // almost always 1 email per BIN
    amount_vs_avg: r2(rand(0.4, 2.2)),            // within normal range
    label: 0,
  };
}

function fraudTransaction() {
  const pattern = Math.random();

  // Pattern A (30%): Classic high-value card testing
  // Stolen card used for large purchases in the middle of the night.
  if (pattern < 0.30) {
    return {
      amount:        randInt(20_000_000, 50_000_000), // ₦200k–₦500k
      hour:          randInt(1, 4),                   // 1am–4am
      is_first_time: 1,
      velocity:      randInt(3, 8),
      bin_count:     randInt(4, 10),
      amount_vs_avg: r2(rand(5.0, 10.0)),
      label: 1,
    };
  }

  // Pattern B (25%): BIN stuffing — many different emails, same card prefix
  // Fraudster has a list of stolen BINs and tries each against different email accounts.
  if (pattern < 0.55) {
    return {
      amount:        randInt(500_000, 8_000_000),
      hour:          randInt(0, 23),
      is_first_time: Math.random() < 0.80 ? 1 : 0,
      velocity:      randInt(1, 3),
      bin_count:     randInt(6, 10),               // key signal: many emails per BIN
      amount_vs_avg: r2(rand(1.5, 4.0)),
      label: 1,
    };
  }

  // Pattern C (20%): Velocity attack — same email, rapid repeated attempts
  // Card testing: checking if a card works by making small fast transactions.
  if (pattern < 0.75) {
    return {
      amount:        randInt(100_000, 3_000_000),
      hour:          randInt(10, 23),
      is_first_time: 1,
      velocity:      randInt(5, 8),                // key signal: very high velocity
      bin_count:     randInt(1, 3),
      amount_vs_avg: r2(rand(0.3, 1.5)),
      label: 1,
    };
  }

  // Pattern D (15%): Behaviour mismatch — known customer, sudden spike
  // Account takeover: fraudster logs into a real customer account and makes a huge purchase.
  if (pattern < 0.90) {
    return {
      amount:        randInt(15_000_000, 40_000_000),
      hour:          randInt(8, 22),               // normal hours
      is_first_time: 0,                            // existing customer — sneaky
      velocity:      randInt(0, 2),
      bin_count:     randInt(1, 3),
      amount_vs_avg: r2(rand(6.0, 12.0)),          // key signal: amount spike
      label: 1,
    };
  }

  // Pattern E (10%): Noise — fraud that looks almost normal (hard cases)
  // Makes the model learn robust boundaries, not just easy separations.
  return {
    amount:        randInt(3_000_000, 10_000_000),
    hour:          randInt(5, 22),
    is_first_time: Math.random() < 0.50 ? 1 : 0,
    velocity:      randInt(2, 4),
    bin_count:     randInt(3, 6),
    amount_vs_avg: r2(rand(2.5, 5.0)),
    label: 1,
  };
}

// Larger dataset = better decision boundaries.
// 80/20 normal/fraud ratio is realistic for Nigerian e-commerce.
const NORMAL_COUNT = 800;
const FRAUD_COUNT  = 200;

const rows = [];
for (let i = 0; i < NORMAL_COUNT; i++) rows.push(normalTransaction());
for (let i = 0; i < FRAUD_COUNT;  i++) rows.push(fraudTransaction());

// Shuffle
for (let i = rows.length - 1; i > 0; i--) {
  const j = randInt(0, i);
  [rows[i], rows[j]] = [rows[j], rows[i]];
}

const HEADER = 'amount,hour,is_first_time,velocity,bin_count,amount_vs_avg,label';
const lines  = [
  HEADER,
  ...rows.map(r =>
    `${r.amount},${r.hour},${r.is_first_time},${r.velocity},${r.bin_count},${r.amount_vs_avg},${r.label}`
  ),
];

const outPath = path.join(__dirname, 'training_data.csv');
fs.writeFileSync(outPath, lines.join('\n'), 'utf8');

const fraudByPattern = {
  A_highvalue: rows.filter(r => r.label === 1 && r.velocity >= 3 && r.hour <= 4).length,
  B_binstuff:  rows.filter(r => r.label === 1 && r.bin_count >= 6).length,
  C_velocity:  rows.filter(r => r.label === 1 && r.velocity >= 5 && r.hour > 4).length,
  D_takeover:  rows.filter(r => r.label === 1 && r.is_first_time === 0 && r.amount_vs_avg >= 6).length,
};
console.log(`Generated ${NORMAL_COUNT} normal + ${FRAUD_COUNT} fraud = ${rows.length} total`);
console.log('Fraud patterns (approx):', fraudByPattern);
console.log(`Saved → ${outPath}`);
