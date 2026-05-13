require('dotenv').config();
const axios = require('axios');

// Dynamically select sandbox vs live base URL based on the configured API key.
function getBaseUrl() {
  const key = String(process.env.SQUAD_API_KEY || '');
  return key.startsWith('sandbox_')
    ? 'https://sandbox-api-d.squadco.com'
    : 'https://api-d.squadco.com';
}

function authHeaders() {
  return { Authorization: `Bearer ${process.env.SQUAD_API_KEY}` };
}

// Called when a transaction scores AMBER — confirms its status before deciding next action.
async function verifyTransaction(transactionRef) {
  try {
    const { data } = await axios.get(
      `${getBaseUrl()}/transaction/verify/${transactionRef}`,
      { headers: authHeaders() }
    );
    return data;
  } catch (err) {
    console.error('[Squad] verifyTransaction error:', err.message);
    return null;
  }
}

// Called when a transaction scores RED — issues a full refund on a confirmed fraudulent payment.
async function refundTransaction(transactionRef, amount) {
  try {
    const { data } = await axios.post(
      `${getBaseUrl()}/transaction/refund`,
      { transaction_ref: transactionRef, refund_type: 'full', amount },
      { headers: authHeaders() }
    );
    return data;
  } catch (err) {
    console.error('[Squad] refundTransaction error:', err.message);
    return null;
  }
}

// Pull up to `days` days of transaction history from Squad.
// Returns an array of raw Squad transaction objects (each includes is_suspicious).
async function getTransactionHistory(days = 30) {
  try {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10); // YYYY-MM-DD
    const { data } = await axios.get(
      `${getBaseUrl()}/transaction`,
      {
        headers: authHeaders(),
        params: { start_date: startDate, limit: 200, page: 1 },
        timeout: 15000,
      }
    );
    // Squad returns { status: 200, data: { transactions: [...] } } or similar
    const list =
      data?.data?.transactions ||
      data?.data            ||
      data?.transactions    ||
      [];
    return Array.isArray(list) ? list : [];
  } catch (err) {
    console.error('[Squad] getTransactionHistory error:', err.message);
    return [];
  }
}

// Partial refund — amount should be in kobo, same unit as original transaction.
async function partialRefundTransaction(transactionRef, amount) {
  try {
    const { data } = await axios.post(
      `${getBaseUrl()}/transaction/refund`,
      { transaction_ref: transactionRef, refund_type: 'Partial', amount },
      { headers: authHeaders() }
    );
    return data;
  } catch (err) {
    console.error('[Squad] partialRefundTransaction error:', err.message);
    return null;
  }
}

// Cancel a stored recurring card token to block future charges.
async function cancelRecurringToken(tokenRef) {
  try {
    const { data } = await axios.patch(
      `${getBaseUrl()}/transaction/cancel/recurring`,
      { token_ref: tokenRef },
      { headers: authHeaders() }
    );
    return data;
  } catch (err) {
    console.error('[Squad] cancelRecurringToken error:', err.message);
    return null;
  }
}

// Called by the dashboard to pull the current chargeback / dispute history.
async function getDisputes() {
  try {
    const { data } = await axios.get(
      `${getBaseUrl()}/dispute`,
      { headers: authHeaders() }
    );
    return data;
  } catch (err) {
    console.error('[Squad] getDisputes error:', err.message);
    return null;
  }
}

// Submit evidence to challenge a dispute via Squad's API.
async function challengeDispute(transactionRef) {
  try {
    const { data } = await axios.post(
      `${getBaseUrl()}/dispute/merchant/challenge`,
      { transaction_ref: transactionRef },
      { headers: authHeaders() }
    );
    return data;
  } catch (err) {
    console.error('[Squad] challengeDispute error:', err.message);
    return null;
  }
}

// Verify an API key belongs to a real Squad merchant.
// Returns { valid, business_name, environment } or { valid: false, error }.
async function verifyMerchantKey(apiKey) {
  const key      = String(apiKey || '').trim();
  const isSandbox = key.startsWith('sandbox_');
  const base     = isSandbox ? 'https://sandbox-api-d.squadco.com' : 'https://api-d.squadco.com';

  try {
    const { data } = await axios.get(`${base}/account/balance`, {
      headers: { Authorization: `Bearer ${key}` },
      timeout: 8000,
    });
    const name =
      data?.data?.merchant_account_details?.account_name ||
      data?.data?.account_name ||
      data?.data?.merchant_id  ||
      'Squad Merchant';
    return { valid: true, business_name: name, environment: isSandbox ? 'sandbox' : 'live' };
  } catch (err) {
    const status = err.response?.status;
    // 401/403 = bad key
    if (status === 401 || status === 403)
      return { valid: false, error: 'Invalid API key — check your Squad dashboard.' };
    // Any other HTTP error (404, 400, 500) means auth passed but endpoint quirk
    if (status)
      return { valid: true, business_name: 'Squad Merchant', environment: isSandbox ? 'sandbox' : 'live' };
    // Network error
    return { valid: false, error: 'Could not reach Squad — check your connection.' };
  }
}

module.exports = {
  verifyTransaction,
  refundTransaction,
  getDisputes,
  challengeDispute,
  verifyMerchantKey,
  getTransactionHistory,
  partialRefundTransaction,
  cancelRecurringToken,
};
