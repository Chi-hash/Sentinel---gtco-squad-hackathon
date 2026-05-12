const crypto    = require('crypto');
const scorer    = require('../ai-engine/scorer');
const squadApi  = require('../squad-client/api');
const binLookup = require('../bin-lookup');
const { sendFraudAlert, trackAmberAndAlert } = require('../notifications/email');

/**
 * Handles every inbound Squad payment webhook.
 * Steps: validate → parse → deduplicate → score → save → act → emit → respond.
 */
async function receiveWebhook(req, res, db, io) {
  try {
    const isDemo = req.headers['x-demo-mode'] === 'true';
    console.log(`[Webhook] Incoming — demo=${isDemo}`);
    // ── Step 1: HMAC-SHA512 signature validation ──────────────────────────────
    // Skip in demo mode so simulate.js can trigger the pipeline without real credentials.
    if (!isDemo) {
      const incomingSignature = req.headers['x-squad-encrypted-body'];
      const computedSignature = crypto
        .createHmac('sha512', process.env.SQUAD_WEBHOOK_SECRET)
        .update(req.body)           // req.body is a raw Buffer (Express.raw middleware)
        .digest('hex').toUpperCase();

      if (incomingSignature !== computedSignature) {
        console.error('[Webhook] Signature MISMATCH');
        console.error('  incoming :', incomingSignature.slice(0, 32) + '...');
        console.error('  computed :', computedSignature.slice(0, 32) + '...');
        console.error('  secret starts with:', process.env.SQUAD_WEBHOOK_SECRET?.slice(0, 12));
        return res.status(401).json({ error: 'Invalid signature' });
      }
      console.log('[Webhook] Signature OK');
    }

    // ── Step 2: Parse body ────────────────────────────────────────────────────
    const payload = JSON.parse(req.body.toString());

    // Squad real webhook:  { Event, TransactionRef, Body: {...} }
    // Demo/simulate:       { event, data: { transaction_ref, amount, ... } }
    let transaction_ref, amount, email, card_bin, transaction_date;

    if (payload.Body) {
      // Real Squad webhook format: { Event, TransactionRef, Body }
      const b = payload.Body;
      transaction_ref  = b.transaction_ref  || payload.TransactionRef;
      amount           = b.amount;
      email            = b.email;
      card_bin         = b.payment_information?.card_bin
                      || b.payment_information?.first_6digits
                      || b.payment_information?.cardBin
                      || '';
      transaction_date = b.created_at || new Date().toISOString();
      console.log(`[Webhook] Squad txn: ref=${transaction_ref} amount=${amount} email=${email} card_bin=${card_bin}`);
    } else if (payload.data) {
      // Demo / simulate format
      const d = payload.data;
      transaction_ref   = d.transaction_ref;
      amount            = d.amount;
      email             = d.email;
      card_bin          = d.card_bin;
      transaction_date  = d.transaction_date;
    } else {
      console.error('[Webhook] Unknown payload structure:', JSON.stringify(payload).slice(0, 200));
      return res.status(400).json({ error: 'Unknown payload structure' });
    }

    // ── Step 3: Deduplicate ───────────────────────────────────────────────────
    const alreadyProcessed = await db.transactionExists(transaction_ref);
    if (alreadyProcessed) {
      return res.status(200).json({ message: 'Already processed' });
    }

    // ── Step 4: BIN enrichment + Score ───────────────────────────────────────
    const bin_info = binLookup.lookupBin(card_bin);
    if (bin_info) {
      const origin = bin_info.is_nigerian ? 'Nigerian' : `Foreign (${bin_info.country})`;
      console.log(`[BIN] ${card_bin} → ${bin_info.bank || bin_info.brand} · ${bin_info.type} · ${origin}`);
    } else {
      console.log(`[BIN] ${card_bin} → Unknown BIN`);
    }

    const { score, tier, reasons, features } = scorer.scoreTransaction(
      { amount, email, card_bin, timestamp: transaction_date, bin_info },
      db
    );

    // ── Step 5: Persist ───────────────────────────────────────────────────────
    const action_taken =
      tier === 'GREEN' ? 'approved' : tier === 'AMBER' ? 'flagged' : 'refunded';

    await db.saveTransaction({
      ref:         transaction_ref,
      email,
      amount,
      card_bin,
      bin_info,
      score,
      tier,
      reasons,
      features,
      timestamp:   transaction_date,
      action_taken,
      source:      isDemo ? 'demo' : 'real',
    });

    // ── Step 6: Act (fire and forget) ─────────────────────────────────────────
    if (tier === 'AMBER') {
      squadApi.verifyTransaction(transaction_ref).catch(console.error);
      trackAmberAndAlert({ ref: transaction_ref, email, amount, score, reasons, bin_info, timestamp: transaction_date }).catch(console.error);
    }
    if (tier === 'RED') {
      squadApi.refundTransaction(transaction_ref, amount).catch(console.error);
      sendFraudAlert({ ref: transaction_ref, email, amount, score, tier, reasons, bin_info, card_bin, timestamp: transaction_date }).catch(console.error);
    }

    // ── Step 7: Push to dashboard ─────────────────────────────────────────────
    console.log(`[Webhook] Scored: ref=${transaction_ref} score=${score} tier=${tier}`);
    io.emit('new_transaction', {
      ref:      transaction_ref,
      email,
      amount,
      card_bin,
      bin_info,
      score,
      tier,
      reasons,
      features,
      timestamp: transaction_date,
      source:   isDemo ? 'demo' : 'real',
    });

    // ── Step 8: Acknowledge ───────────────────────────────────────────────────
    return res.status(200).json({ message: 'Received' });
  } catch (err) {
    console.error('[Webhook] receiveWebhook error:', err.message);
    return res.status(500).json({ error: 'Internal error' });
  }
}

module.exports = { receiveWebhook };
