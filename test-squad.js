require('dotenv').config();
const squadApi = require('./backend/squad-client/api.js');

async function runTests() {
  console.log('--- Squad API Test Script (ALL APIs) ---');
  console.log(`Using API Key: ${process.env.SQUAD_API_KEY?.substring(0, 15)}...\n`);
  
  // 1. Verify Merchant Key
  console.log('1. [GET /account/balance] Testing verifyMerchantKey...');
  const keyInfo = await squadApi.verifyMerchantKey(process.env.SQUAD_API_KEY);
  console.log('Result:', keyInfo);

  // 2. Transaction History
  console.log('\n2. [GET /transaction] Testing getTransactionHistory...');
  const history = await squadApi.getTransactionHistory(30);
  console.log('Result length:', history.length);

  // 3. Get Disputes
  console.log('\n3. [GET /dispute] Testing getDisputes...');
  const disputes = await squadApi.getDisputes();
  console.log('Result status:', disputes?.status || disputes);

  // 4. Verify Transaction (Dummy ref)
  console.log('\n4. [GET /transaction/verify/:ref] Testing verifyTransaction...');
  const verify = await squadApi.verifyTransaction('dummy_ref_12345');
  console.log('Result:', verify || 'Failed/Null');

  // 5. Full Refund (Dummy ref)
  console.log('\n5. [POST /transaction/refund] Testing refundTransaction (Full)...');
  const fullRefund = await squadApi.refundTransaction('dummy_ref_12345', 1000);
  console.log('Result:', fullRefund || 'Failed/Null');

  // 6. Partial Refund (Dummy ref)
  console.log('\n6. [POST /transaction/refund] Testing partialRefundTransaction...');
  const partialRefund = await squadApi.partialRefundTransaction('dummy_ref_12345', 500);
  console.log('Result:', partialRefund || 'Failed/Null');

  // 7. Cancel Recurring Token (Dummy token)
  console.log('\n7. [PATCH /transaction/cancel/recurring] Testing cancelRecurringToken...');
  const cancelRec = await squadApi.cancelRecurringToken('dummy_token_123');
  console.log('Result:', cancelRec || 'Failed/Null');

  // 8. Challenge Dispute (Dummy ref)
  console.log('\n8. [POST /dispute/merchant/challenge] Testing challengeDispute...');
  const challenge = await squadApi.challengeDispute('dummy_ref_12345');
  console.log('Result:', challenge || 'Failed/Null');

  console.log('\n--- Tests Completed ---');
}

runTests();
