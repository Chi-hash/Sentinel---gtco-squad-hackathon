const fs = require('fs');
const path = require('path');

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Random float in [min, max] */
function rand(min, max) {
  return Math.random() * (max - min) + min;
}

/** Random integer in [min, max] inclusive */
function randInt(min, max) {
  return Math.floor(rand(min, max + 1));
}

/** Round to 2 decimal places */
function r2(n) {
  return Math.round(n * 100) / 100;
}

// ── Transaction generators ────────────────────────────────────────────────────

function normalTransaction() {
  return {
    amount:        randInt(100000, 5000000),
    hour:          randInt(8, 22),
    is_first_time: Math.random() < 0.20 ? 1 : 0,
    velocity:      Math.random() < 0.15 ? 1 : 0,
    bin_count:     Math.random() < 0.10 ? 2 : 1,
    amount_vs_avg: r2(rand(0.5, 2.0)),
    label:         0,
  };
}

function fraudTransaction() {
  // 15% of fraud rows get normal-looking amounts to add noise and improve model robustness.
  const noisyAmount = Math.random() < 0.15;

  return {
    amount:        noisyAmount ? randInt(100000, 5000000) : randInt(5000000, 50000000),
    hour:          randInt(0, 5),
    is_first_time: Math.random() < 0.70 ? 1 : 0,
    velocity:      randInt(3, 8),
    bin_count:     randInt(4, 10),
    amount_vs_avg: r2(rand(3.0, 8.0)),
    label:         1,
  };
}

// ── Build dataset ─────────────────────────────────────────────────────────────

const NORMAL_COUNT = 400;
const FRAUD_COUNT  = 100;

const rows = [];

for (let i = 0; i < NORMAL_COUNT; i++) rows.push(normalTransaction());
for (let i = 0; i < FRAUD_COUNT;  i++) rows.push(fraudTransaction());

// Shuffle so normal and fraud rows are interleaved (better for training)
for (let i = rows.length - 1; i > 0; i--) {
  const j = randInt(0, i);
  [rows[i], rows[j]] = [rows[j], rows[i]];
}

// ── Write CSV ─────────────────────────────────────────────────────────────────

const HEADER = 'amount,hour,is_first_time,velocity,bin_count,amount_vs_avg,label';

const lines = [
  HEADER,
  ...rows.map((r) =>
    `${r.amount},${r.hour},${r.is_first_time},${r.velocity},${r.bin_count},${r.amount_vs_avg},${r.label}`
  ),
];

const outPath = path.join(__dirname, 'training_data.csv');
fs.writeFileSync(outPath, lines.join('\n'), 'utf8');

// ── Summary ───────────────────────────────────────────────────────────────────

const fraudNoisy = rows.filter((r) => r.label === 1 && r.amount < 5000000).length;

console.log(`Generated ${NORMAL_COUNT} normal transactions  (label: 0)`);
console.log(`Generated ${FRAUD_COUNT}  fraudulent transactions (label: 1)`);
console.log(`  └─ ${fraudNoisy} fraud rows have normal-looking amounts (noise)`);
console.log(`Total: ${rows.length} rows`);
console.log(`Saved → ${outPath}`);
