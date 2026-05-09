require('dotenv').config();
const axios = require('axios');

const BASE_URL = 'https://sandbox-api-d.squadco.com';

function authHeaders() {
  return { Authorization: `Bearer ${process.env.SQUAD_API_KEY}` };
}

// Called when a transaction scores AMBER — confirms its status before deciding next action.
async function verifyTransaction(transactionRef) {
  try {
    const { data } = await axios.get(
      `${BASE_URL}/transaction/verify/${transactionRef}`,
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
      `${BASE_URL}/transaction/refund`,
      { transaction_ref: transactionRef, refund_type: 'full', amount },
      { headers: authHeaders() }
    );
    return data;
  } catch (err) {
    console.error('[Squad] refundTransaction error:', err.message);
    return null;
  }
}

// Called by the dashboard to pull the current chargeback / dispute history.
async function getDisputes() {
  try {
    const { data } = await axios.get(
      `${BASE_URL}/dispute`,
      { headers: authHeaders() }
    );
    return data;
  } catch (err) {
    console.error('[Squad] getDisputes error:', err.message);
    return null;
  }
}

module.exports = { verifyTransaction, refundTransaction, getDisputes };
