/**
 * Sentinel fraud rules (R01–R08). Each returns { score, reason } or { score: 0, reason: null }.
 */

// Flags payments far above what this merchant usually sees (possible stolen card or scam).
function R01(transaction, db) {
  try {
    const avg = db.getMerchantAverage();
    if (transaction.amount > 3 * avg)
      return { score: 30, reason: "AMOUNT_SPIKE" };
    return { score: 0, reason: null };
  } catch {
    return { score: 0, reason: null };
  }
}

// Catches very large first-time payments from an email with no history (classic fraud pattern).
function R02(transaction, db) {
  try {
    const hist = db.getUserHistory(transaction.email);
    if (transaction.amount > 50000000 && (!hist || hist.length === 0))
      return { score: 25, reason: "HIGH_VALUE_NEW" };
    return { score: 0, reason: null };
  } catch {
    return { score: 0, reason: null };
  }
}

// Night-time activity (1–4am West Africa Time) often correlates with automated or stolen-card use.
function R03(transaction, db) {
  try {
    const watHour = (new Date(transaction.timestamp).getUTCHours() + 1) % 24;
    if (watHour >= 1 && watHour <= 4) return { score: 20, reason: "OFF_HOURS" };
    return { score: 0, reason: null };
  } catch {
    return { score: 0, reason: null };
  }
}

// Many hits from the same email in a few minutes suggests card testing or scripted abuse.
function R04(transaction, db) {
  try {
    const recent = db.getRecentByEmail(transaction.email, 5);
    if (recent.length >= 3) return { score: 35, reason: "HIGH_VELOCITY" };
    return { score: 0, reason: null };
  } catch {
    return { score: 0, reason: null };
  }
}

// One card prefix tied to many different emails quickly suggests BIN stuffing or stolen BIN lists.
function R05(transaction, db) {
  try {
    const emails = db.getRecentByBin(transaction.card_bin, 60);
    if (emails.length >= 5) return { score: 40, reason: "BIN_PATTERN" };
    return { score: 0, reason: null };
  } catch {
    return { score: 0, reason: null };
  }
}

// Sudden jump from small habitual amounts to a much larger one breaks normal customer behaviour.
function R06(transaction, db) {
  try {
    const hist = db.getUserHistory(transaction.email);
    if (!hist || hist.length === 0 || transaction.amount <= 30000000)
      return { score: 0, reason: null };
    if (hist.every((t) => t.amount < 10000000))
      return { score: 15, reason: "BEHAVIOUR_MISMATCH" };
    return { score: 0, reason: null };
  } catch {
    return { score: 0, reason: null };
  }
}

// First-time emails are slightly riskier because there is no reputation baseline yet.
function R07(transaction, db) {
  try {
    const hist = db.getUserHistory(transaction.email);
    if (!hist || hist.length === 0)
      return { score: 10, reason: "FIRST_TIME_PAYER" };
    return { score: 0, reason: null };
  } catch {
    return { score: 0, reason: null };
  }
}

// Round millions in kobo are a common fraud/testing fingerprint vs realistic retail totals.
function R08(transaction, db) {
  try {
    if (transaction.amount % 1000000 === 0)
      return { score: 15, reason: "ROUND_AMOUNT" };
    return { score: 0, reason: null };
  } catch {
    return { score: 0, reason: null };
  }
}

// Card issued outside Nigeria. Nigerian customers can legitimately hold foreign cards
// (PayPal, international Visa/MC) — so this adds moderate risk rather than blocking.
// Only fires when BIN is positively identified as non-Nigerian; unknown BINs use R10.
function R09(transaction) {
  try {
    const info = transaction.bin_info;
    if (!info) return { score: 0, reason: null };
    if (info.country && info.country !== 'NG' && info.country !== '')
      return { score: 20, reason: 'FOREIGN_CARD' };
    return { score: 0, reason: null };
  } catch {
    return { score: 0, reason: null };
  }
}

// Prepaid cards have a significantly higher chargeback rate in Nigerian e-commerce.
// Also catches cards with no BIN match at all (truly unknown BINs are suspicious).
function R10(transaction) {
  try {
    const info = transaction.bin_info;
    // Unknown BIN — not in dataset at all
    if (!info || (!info.brand && !info.country)) return { score: 10, reason: 'UNKNOWN_BIN' };
    // Known prepaid card
    if (info.type === 'PREPAID') return { score: 15, reason: 'PREPAID_CARD' };
    return { score: 0, reason: null };
  } catch {
    return { score: 0, reason: null };
  }
}

module.exports = {
  R01, R02, R03, R04, R05, R06, R07, R08, R09, R10,
};
