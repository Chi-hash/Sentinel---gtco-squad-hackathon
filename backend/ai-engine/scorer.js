const { R01, R02, R03, R04, R05, R06, R07, R08, R09, R10 } = require('./rules');

// Loaded once at startup — never re-read on every call.
const MODEL = require('../../ml/model.json');

// Applies the same StandardScaler transformation used during training.
// Without this, 'amount' (range 0–50M) would dominate every other feature.
// model.json now exports scaler.mean and scaler.std for each feature.
const SCALER_MEAN = MODEL.scaler?.mean || {};
const SCALER_STD  = MODEL.scaler?.std  || {};

function scaleFeature(name, value) {
  const mean = SCALER_MEAN[name] ?? 0;
  const std  = SCALER_STD[name]  ?? 1;
  return std === 0 ? 0 : (value - mean) / std;
}

// Prefer Random Forest feature importances (supervised, more reliable).
// Fall back to Isolation Forest MAD weights.
const FEATURE_WEIGHTS =
  MODEL.random_forest?.feature_importances ||
  MODEL.isolation_forest?.feature_weights  ||
  MODEL.feature_weights ||
  {};

// Polynomial coefficients exported from train_model.py.
// At runtime: fraud_prob = clip(a*x^2 + b*x + c, 0, 1)  where x = normalised score
// This gives a CONTINUOUS 0–1 fraud probability grounded in real RF predict_proba,
// not a coarse 0/10/20 bucket.
const CAL = MODEL.probability_calibration || {};
const CAL_A        = CAL.poly_a            ?? 0;
const CAL_B        = CAL.poly_b            ?? 1;
const CAL_C        = CAL.poly_c            ?? 0;
const MAX_WEIGHTED = CAL.max_weighted_score ?? 1;
const FEATURES     = MODEL.features        || [];

/**
 * Score a single transaction for fraud risk.
 * Returns { score (0–100), tier ('GREEN'|'AMBER'|'RED'), reasons, features }.
 *
 * Three stages:
 *   Stage 1 — Rule engine (R01–R10):  max 70 pts
 *   Stage 2 — Z-score anomaly:        max 30 pts
 *   Stage 3 — ML weighted scoring:    max 20 pts
 *   Total capped at 100.
 */
function scoreTransaction(transaction, db) {
  try {
    const rules = [R01, R02, R03, R04, R05, R06, R07, R08, R09, R10];
    const reasons = [];
    let stage1Score = 0;

    for (const rule of rules) {
      const { score, reason } = rule(transaction, db);
      stage1Score += score;
      if (reason !== null) reasons.push(reason);
    }
    stage1Score = Math.min(70, stage1Score);

    const history = db.getUserHistory(transaction.email);
    let stage2Score = 0;

    if (!history || history.length === 0) {
      stage2Score = 15; // unknown baseline = moderate risk
    } else {
      const amounts  = history.map(t => t.amount);
      const avg      = amounts.reduce((s, a) => s + a, 0) / amounts.length;
      const variance = amounts.reduce((s, a) => s + Math.pow(a - avg, 2), 0) / amounts.length;
      const stdDev   = Math.sqrt(variance);

      if (stdDev > 0) {
        const z = (transaction.amount - avg) / stdDev;
        stage2Score = Math.min(30, Math.max(0, z * 10));
        if (z > 2) reasons.push('STAT_ANOMALY');
      }
    }

    const watHour     = (new Date(transaction.timestamp).getUTCHours() + 1) % 24;
    const isFirstTime = (!history || history.length === 0) ? 1 : 0;
    const velocity    = db.getRecentByEmail(transaction.email, 5).length;
    const binCount    = db.getRecentByBin(transaction.card_bin, 60).length;
    const merchantAvg = db.getMerchantAverage() || 1;
    const amountVsAvg = transaction.amount / merchantAvg;

    const rawFeatures = {
      amount:        transaction.amount,
      hour:          watHour,
      is_first_time: isFirstTime,
      velocity,
      bin_count:     binCount,
      amount_vs_avg: amountVsAvg,
    };

    // Apply StandardScaler — each feature is now (value - mean) / std
    // This ensures all features contribute proportionally to the final score.
    const scaledFeatures = {};
    for (const [name, value] of Object.entries(rawFeatures)) {
      scaledFeatures[name] = scaleFeature(name, value);
    }

    // Weighted sum using normalised feature importances.
    // With scaling, weights now reflect each feature's true discriminative power.
    const rawWeighted = FEATURES.reduce(
      (sum, f) => sum + (scaledFeatures[f] || 0) * (FEATURE_WEIGHTS[f] || 0),
      0
    );

    const normalised = Math.max(0, rawWeighted / MAX_WEIGHTED);

    // Continuous fraud probability via polynomial calibration from RF predict_proba.
    // fraudProb = clip(a*x^2 + b*x + c, 0, 1)  — grounded in real RF output.
    // Stage 3 now contributes any value 0–20, not just 0/10/20 buckets.
    const fraudProb   = Math.max(0, Math.min(1, CAL_A * normalised ** 2 + CAL_B * normalised + CAL_C));
    const stage3Score = Math.round(fraudProb * 20);

    if   (fraudProb > 0.7) reasons.push('ML_HIGH_RISK');
    else if (fraudProb > 0.4) reasons.push('ML_MEDIUM_RISK');

    const totalScore = Math.min(100, Math.round(stage1Score + stage2Score + stage3Score));

    let tier;
    if      (totalScore <= 30) tier = 'GREEN';
    else if (totalScore <= 70) tier = 'AMBER';
    else                       tier = 'RED';

    const features = {
      amount_vs_avg:     Math.round(amountVsAvg * 100) / 100,
      velocity_1hr:      velocity,
      hour_of_day:       watHour,
      bin_count:         binCount,
      fraud_probability: Math.round(fraudProb * 100) + '%',  // 0–100%, continuous from RF calibration
    };

    return { score: totalScore, tier, reasons, features };

  } catch (err) {
    console.error('[Scorer] error:', err.message);
    return { score: 50, tier: 'AMBER', reasons: ['SCORING_ERROR'], features: {} };
  }
}

module.exports = { scoreTransaction };
