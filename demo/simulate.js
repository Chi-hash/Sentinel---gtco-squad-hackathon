const axios = require('axios');

const URL = 'http://localhost:3000/webhook/squad';
const HEADERS = { 'Content-Type': 'application/json', 'x-demo-mode': 'true' };

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const SCENARIOS = [
  {
    label: 'scenario 1: GREEN (₦5,000)',
    data: {
      transaction_ref: 'DEMO_001',
      amount: 500000,
      email: 'safe@demo.com',
      card_bin: '411111',
      transaction_date: new Date().toISOString().slice(0, 11) + '14:30:00.000Z',
    },
  },
  {
    label: 'scenario 2: AMBER (₦75,000)',
    data: {
      transaction_ref: 'DEMO_002',
      amount: 7500000,
      email: 'suspicious@demo.com',
      card_bin: '539983',
      transaction_date: new Date().toISOString().slice(0, 11) + '03:15:00.000Z',
    },
  },
  {
    label: 'scenario 3: RED (₦420,000)',
    data: {
      transaction_ref: 'DEMO_003',
      amount: 42000000,
      email: 'fraud@demo.com',
      card_bin: '400000',
      transaction_date: new Date().toISOString().slice(0, 11) + '02:50:00.000Z',
    },
  },
];

async function run() {
  for (let i = 0; i < SCENARIOS.length; i++) {
    const { label, data } = SCENARIOS[i];

    console.log(`\nSending ${label}...`);

    try {
      const { data: res } = await axios.post(
        URL,
        { event: 'charge_successful', data },
        { headers: HEADERS }
      );

      if (res.score !== undefined) {
        console.log(`  ✓ ref=${data.transaction_ref}  score=${res.score}  tier=${res.tier}`);
      } else {
        console.log(`  ✓ Received (ref=${data.transaction_ref})`);
      }
    } catch (err) {
      console.error(`  ✗ Failed: ${err.message}`);
    }

    if (i < SCENARIOS.length - 1) await sleep(3000);
  }

  console.log('\nDemo complete. Check your dashboard.');
}

run();
