/**
 * Sentinel Email Notifications
 * Sends fraud alerts to the merchant via Gmail SMTP (Nodemailer).
 *
 * Required .env variables:
 *   GMAIL_USER          — the Gmail address Sentinel sends FROM
 *   GMAIL_APP_PASSWORD  — 16-char Google App Password (not your Gmail password)
 *   MERCHANT_EMAIL      — the merchant's email address to send alerts TO
 */

const nodemailer = require('nodemailer');

// ── Transporter — created once at module load ─────────────────────────────────
let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.warn('[Email] GMAIL_USER or GMAIL_APP_PASSWORD not set — email alerts disabled.');
    return null;
  }

  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  return transporter;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function money(kobo) {
  return '₦' + (Number(kobo) / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 });
}

function fmtTime(iso) {
  try { return new Date(iso).toLocaleString('en-NG', { timeZone: 'Africa/Lagos' }); }
  catch { return iso || '—'; }
}

function tierColour(tier) {
  return tier === 'GREEN' ? '#16a34a' : tier === 'AMBER' ? '#d97706' : '#dc2626';
}

// ── Email templates ───────────────────────────────────────────────────────────

function buildRedAlertHTML(txn) {
  const signals = (txn.reasons || []).map(r =>
    `<li style="margin:4px 0;font-family:monospace;font-size:13px;color:#dc2626">${r}</li>`
  ).join('');

  const binLine = txn.bin_info?.bank
    ? `${txn.bin_info.bank} · ${txn.bin_info.brand} ${txn.bin_info.type} · ${txn.bin_info.is_nigerian ? '🇳🇬 Nigerian' : `🌍 Foreign (${txn.bin_info.country})`}`
    : (txn.card_bin || '—');

  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'DM Sans',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);">

        <!-- Header -->
        <tr>
          <td style="background:#0d2137;padding:24px 32px;">
            <span style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:.04em">SENTINEL</span>
            <span style="font-size:11px;color:#94a3b8;margin-left:10px;font-family:monospace">AI Fraud Detection</span>
          </td>
        </tr>

        <!-- Alert banner -->
        <tr>
          <td style="background:#dc2626;padding:16px 32px;">
            <span style="font-size:16px;font-weight:700;color:#ffffff">🚨 FRAUD TRANSACTION BLOCKED</span>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:28px 32px;">
            <p style="margin:0 0 20px;color:#1e293b;font-size:15px;">
              Sentinel has automatically blocked a high-risk transaction on your Squad account.
              The payment has been refunded. No action is required from you.
            </p>

            <!-- Transaction details grid -->
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:24px;">
              <tr style="background:#f8fafc;">
                <td style="padding:10px 16px;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.06em;width:140px">Reference</td>
                <td style="padding:10px 16px;font-family:monospace;font-size:13px;color:#0d2137;font-weight:600">${txn.ref}</td>
              </tr>
              <tr style="border-top:1px solid #e2e8f0;">
                <td style="padding:10px 16px;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.06em">Amount</td>
                <td style="padding:10px 16px;font-size:15px;font-weight:700;color:#dc2626">${money(txn.amount)}</td>
              </tr>
              <tr style="border-top:1px solid #e2e8f0;background:#f8fafc;">
                <td style="padding:10px 16px;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.06em">Customer</td>
                <td style="padding:10px 16px;font-size:13px;color:#1e293b">${txn.email}</td>
              </tr>
              <tr style="border-top:1px solid #e2e8f0;">
                <td style="padding:10px 16px;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.06em">Card</td>
                <td style="padding:10px 16px;font-size:13px;color:#1e293b">${binLine}</td>
              </tr>
              <tr style="border-top:1px solid #e2e8f0;background:#f8fafc;">
                <td style="padding:10px 16px;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.06em">Time</td>
                <td style="padding:10px 16px;font-size:13px;color:#1e293b">${fmtTime(txn.timestamp)}</td>
              </tr>
              <tr style="border-top:1px solid #e2e8f0;">
                <td style="padding:10px 16px;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.06em">AI Score</td>
                <td style="padding:10px 16px;font-size:15px;font-weight:700;color:#dc2626">${txn.score}/100</td>
              </tr>
            </table>

            <!-- Fraud signals -->
            <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
              <div style="font-size:12px;font-weight:700;color:#dc2626;text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">■ Fraud Signals Detected</div>
              <ul style="margin:0;padding-left:18px;">${signals || '<li style="color:#64748b;font-size:13px">No specific signals recorded</li>'}</ul>
            </div>

            <p style="margin:0;color:#64748b;font-size:13px;line-height:1.6;">
              View the full transaction analysis and dispute evidence on your
              <a href="http://localhost:3000" style="color:#0d2137;font-weight:600">Sentinel dashboard</a>.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0;">
            <span style="font-size:11px;color:#94a3b8;">SENTINEL · Powered by Squad · ${fmtTime(new Date().toISOString())} WAT · This is an automated alert.</span>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildAmberBurstHTML(transactions) {
  const rows = transactions.map(t => `
    <tr style="border-top:1px solid #e2e8f0;">
      <td style="padding:8px 12px;font-family:monospace;font-size:12px;color:#0d2137">${t.ref}</td>
      <td style="padding:8px 12px;font-size:13px;font-weight:600;color:#d97706">${money(t.amount)}</td>
      <td style="padding:8px 12px;font-size:12px;color:#64748b">${t.email}</td>
      <td style="padding:8px 12px;font-size:12px;font-weight:700;color:#d97706">${t.score}/100</td>
    </tr>`).join('');

  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'DM Sans',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);">
        <tr>
          <td style="background:#0d2137;padding:24px 32px;">
            <span style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:.04em">SENTINEL</span>
            <span style="font-size:11px;color:#94a3b8;margin-left:10px;font-family:monospace">AI Fraud Detection</span>
          </td>
        </tr>
        <tr>
          <td style="background:#d97706;padding:16px 32px;">
            <span style="font-size:16px;font-weight:700;color:#ffffff">⚠️ SUSPICIOUS ACTIVITY BURST — REVIEW REQUIRED</span>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px;">
            <p style="margin:0 0 20px;color:#1e293b;font-size:15px;">
              Sentinel has detected <strong>${transactions.length} suspicious transactions</strong> within 10 minutes.
              These have been flagged for your review. Please log in to your dashboard to approve or reject them.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:24px;">
              <tr style="background:#f8fafc;">
                <th style="padding:10px 12px;font-size:11px;font-weight:600;color:#64748b;text-align:left;text-transform:uppercase">Ref</th>
                <th style="padding:10px 12px;font-size:11px;font-weight:600;color:#64748b;text-align:left;text-transform:uppercase">Amount</th>
                <th style="padding:10px 12px;font-size:11px;font-weight:600;color:#64748b;text-align:left;text-transform:uppercase">Customer</th>
                <th style="padding:10px 12px;font-size:11px;font-weight:600;color:#64748b;text-align:left;text-transform:uppercase">Score</th>
              </tr>
              ${rows}
            </table>
            <p style="margin:0;color:#64748b;font-size:13px;">
              <a href="http://localhost:3000" style="color:#0d2137;font-weight:600">Open Sentinel Dashboard →</a>
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0;">
            <span style="font-size:11px;color:#94a3b8;">SENTINEL · Powered by Squad · ${fmtTime(new Date().toISOString())} WAT · Automated alert.</span>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Public send functions ─────────────────────────────────────────────────────

async function sendFraudAlert(txn) {
  const t = getTransporter();
  if (!t || !process.env.MERCHANT_EMAIL) return;

  try {
    await t.sendMail({
      from:    `"Sentinel Fraud Alert" <${process.env.GMAIL_USER}>`,
      to:      process.env.MERCHANT_EMAIL,
      subject: `🚨 Fraud Blocked — ${money(txn.amount)} · ${txn.ref}`,
      html:    buildRedAlertHTML(txn),
    });
    console.log(`[Email] Fraud alert sent for ${txn.ref}`);
  } catch (err) {
    console.error('[Email] sendFraudAlert failed:', err.message);
  }
}

// Tracks recent AMBER transactions for burst detection
const _amberWindow = [];
const AMBER_BURST_THRESHOLD = 3;
const AMBER_BURST_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
let _lastBurstAlert = 0;

async function trackAmberAndAlert(txn) {
  const t = getTransporter();
  if (!t || !process.env.MERCHANT_EMAIL) return;

  const now = Date.now();

  // Add to window, prune old entries
  _amberWindow.push({ ...txn, _ts: now });
  const cutoff = now - AMBER_BURST_WINDOW_MS;
  while (_amberWindow.length && _amberWindow[0]._ts < cutoff) _amberWindow.shift();

  // Fire alert once per burst (cooldown 10 min to avoid spam)
  if (_amberWindow.length >= AMBER_BURST_THRESHOLD && (now - _lastBurstAlert) > AMBER_BURST_WINDOW_MS) {
    _lastBurstAlert = now;
    const burst = [..._amberWindow];
    try {
      await t.sendMail({
        from:    `"Sentinel Fraud Alert" <${process.env.GMAIL_USER}>`,
        to:      process.env.MERCHANT_EMAIL,
        subject: `⚠️ ${burst.length} Suspicious Transactions in 10 min — Review Now`,
        html:    buildAmberBurstHTML(burst),
      });
      console.log(`[Email] Amber burst alert sent (${burst.length} transactions)`);
    } catch (err) {
      console.error('[Email] trackAmberAndAlert failed:', err.message);
    }
  }
}

module.exports = { sendFraudAlert, trackAmberAndAlert };
