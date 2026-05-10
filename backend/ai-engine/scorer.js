const { R01, R02, R03, R04, R05, R06, R07, R08 } = require('./rules');

// Loaded once at startup — never re-read on every call.
const MODEL = require('../../ml/model.json');

// Maximum realistic value per feature (used to normalise the weighted score to 0–1).
// These match the upper bounds of the fraud range in generate_data.js.
const FEATURE_MAX = {
  amount:        50000000,  // max fraud amount in kobo
  hour:          23,
  is_first_time: 1,
  velocity:      8,
  bin_count:     10,
  amount_vs_avg: 8.0,
};

// Pre-compute the ceiling so we divide by it on every call, not recalculate it.
const MAX_WEIGHTED_SCORE = MODEL.features.reduce(
  (sum, f) => sum + (FEATURE_MAX[f] || 1) * (MODEL.feature_weights[f] || 0),
  0
);

/**
 * Score a single transaction for fraud risk.
 * Returns { score, tier, reasons }.
 */
function scoreTransaction(transaction, db) {
  try {
    // ── Stage 1: Rule-based scoring ───────────────────────────────────────────
    const rules = [R01, R02, R03, R04, R05, R06, R07, R08];
    const reasons = [];
    let stage1Score = 0;

    for (const rule of rules) {
      const { score, reason } = rule(transaction, db);
      stage1Score += score;
      if (reason !== null) reasons.push(reason);
    }

    stage1Score = Math.min(70, stage1Score);

    // ── Stage 2: Z-score anomaly detection ───────────────────────────────────
    const history = db.getUserHistory(transaction.email);
    let stage2Score = 0;

    if (!history || history.length === 0) {
      stage2Score = 15;
    } else {
      const amounts = history.map((t) => t.amount);
      const avg = amounts.reduce((sum, a) => sum + a, 0) / amounts.length;
      const variance = amounts.reduce((sum, a) => sum + Math.pow(a - avg, 2), 0) / amounts.length;
      const stdDev = Math.sqrt(variance);

      if (stdDev === 0) {
        stage2Score = 0;
      } else {
        const z = (transaction.amount - avg) / stdDev;
        stage2Score = Math.min(30, Math.max(0, z * 10));
        if (z > 2) reasons.push('STAT_ANOMALY');
      }
    }

    // ── Stage 3: ML model feature scoring ────────────────────────────────────
    // Extract the same features the Isolation Forest was trained on.
    const watHour    = (new Date(transaction.timestamp).getUTCHours() + 1) % 24;
    const isFirstTime = (!history || history.length === 0) ? 1 : 0;
    const velocity   = db.getRecentByEmail(transaction.email, 5).length;
    const binCount   = db.getRecentByBin(transaction.card_bin, 60).length;
    const merchantAvg = db.getMerchantAverage() || 1;
    const amountVsAvg = transaction.amount / merchantAvg;

    const featureValues = {
      amount:        transaction.amount,
      hour:          watHour,
      is_first_time: isFirstTime,
      velocity,
      bin_count:     binCount,
      amount_vs_avg: amountVsAvg,
    };

    // Weighted sum using normalised feature importance from model.json.
    const rawWeighted = MODEL.features.reduce(
      (sum, f) => sum + featureValues[f] * (MODEL.feature_weights[f] || 0),
      0
    );

    // Normalise to 0–1 against the pre-computed maximum possible weighted score.
    const normalised = MAX_WEIGHTED_SCORE > 0 ? rawWeighted / MAX_WEIGHTED_SCORE : 0;

    let stage3Score = 0;
    if (normalised > 0.7) {
      stage3Score = 20;
      reasons.push('ML_HIGH_RISK');
    } else if (normalised > 0.4) {
      stage3Score = 10;
      reasons.push('ML_MEDIUM_RISK');
    }

    // ── Final score & tier ────────────────────────────────────────────────────
    const totalScore = Math.min(100, Math.round(stage1Score + stage2Score + stage3Score));

    let tier;
    if (totalScore <= 30) tier = 'GREEN';
    else if (totalScore <= 70) tier = 'AMBER';
    else tier = 'RED';

    return { score: totalScore, tier, reasons };
  } catch {
    return { score: 50, tier: 'AMBER', reasons: ['SCORING_ERROR'] };
  }
}

module.exports = { scoreTransaction };
