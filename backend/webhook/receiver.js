const crypto = require('crypto');
const scorer = require('../ai-engine/scorer');
const squadApi = require('../squad-client/api');

/**
 * Handles every inbound Squad payment webhook.
 * Steps: validate → parse → deduplicate → score → save → act → emit → respond.
 */
async function receiveWebhook(req, res, db, io) {
  try {
    // ── Step 1: HMAC-SHA512 signature validation ──────────────────────────────
    // Skip in demo mode so simulate.js can trigger the pipeline without real credentials.
    if (req.headers['x-demo-mode'] !== 'true') {
      const incomingSignature = req.headers['x-squad-encrypted-body'];
      const computedSignature = crypto
        .createHmac('sha512', process.env.SQUAD_WEBHOOK_SECRET)
        .update(req.body)           // req.body is a raw Buffer (Express.raw middleware)
        .digest('hex');

      if (incomingSignature !== computedSignature) {
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    // ── Step 2: Parse body ────────────────────────────────────────────────────
    const payload = JSON.parse(req.body.toString());
    const { transaction_ref, amount, email, card_bin, transaction_date } = payload.data;

    // ── Step 3: Deduplicate ───────────────────────────────────────────────────
    const alreadyProcessed = await db.transactionExists(transaction_ref);
    if (alreadyProcessed) {
      return res.status(200).json({ message: 'Already processed' });
    }

    // ── Step 4: Score ─────────────────────────────────────────────────────────
    const { score, tier, reasons } = scorer.scoreTransaction(
      { amount, email, card_bin, timestamp: transaction_date },
      db
    );

    // ── Step 5: Persist ───────────────────────────────────────────────────────
    const action_taken =
      tier === 'GREEN' ? 'approved' : tier === 'AMBER' ? 'flagged' : 'refunded';

    await db.saveTransaction({
      ref: transaction_ref,
      email,
      amount,
      card_bin,
      score,
      tier,
      reasons,
      timestamp: transaction_date,
      action_taken,
    });

    // ── Step 6: Act (fire and forget) ─────────────────────────────────────────
    if (tier === 'AMBER') squadApi.verifyTransaction(transaction_ref).catch(console.error);
    if (tier === 'RED')   squadApi.refundTransaction(transaction_ref, amount).catch(console.error);

    // ── Step 7: Push to dashboard ─────────────────────────────────────────────
    io.emit('new_transaction', {
      ref: transaction_ref,
      email,
      amount,
      score,
      tier,
      reasons,
      timestamp: transaction_date,
    });

    // ── Step 8: Acknowledge ───────────────────────────────────────────────────
    return res.status(200).json({ message: 'Received' });
  } catch (err) {
    console.error('[Webhook] receiveWebhook error:', err.message);
    return res.status(500).json({ error: 'Internal error' });
  }
}

module.exports = { receiveWebhook };
