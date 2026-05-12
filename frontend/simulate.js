// Sentinel — frontend simulator
// Randomised realistic transaction pools. Each call picks from pools so
// every simulated event looks different in the dashboard.

// Timestamp + counter so refs are always unique across page reloads and sessions.
const _epoch = Date.now();
let _simCount = 0;
function _ref() { return 'SIM-' + _epoch + '-' + (++_simCount); }

function _post(payload) {
  fetch('/webhook/squad', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'x-demo-mode': 'true' },
    body:    JSON.stringify({ event: 'charge_successful', data: payload }),
  }).catch(() => {});
}

function _pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function _rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

//Identity pools

const FIRST = [
  'chidi','ngozi','emeka','amara','bola','tunde','kemi','seun',
  'ife','uche','nkem','femi','sola','yemi','ada','obinna','chisom',
  'damilola','olumide','fatima','aisha','hauwa','musa','ibrahim',
];
const LAST = [
  'okonkwo','adeyemi','obi','nwosu','adesanya','fashola','olawale',
  'abiodun','oladipo','eze','okeke','adebayo','akinwunmi','balogun',
  'igwe','dike','aliyu','garba','usman','musa',
];
const DOMAINS = ['gmail.com','yahoo.com','outlook.com','hotmail.com','live.com'];

function _email() {
  return _pick(FIRST) + '.' + _pick(LAST) + '@' + _pick(DOMAINS);
}

// Small fixed pools for RED/AMBER so the same emails repeat across simulations.
// This builds up transaction history so velocity and spike rules fire after a few hits.
const BAD_EMAILS = [
  'emeka.obi74@gmail.com',   'chisom.eze91@yahoo.com',
  'damilola.aliyu38@live.com', 'obinna.usman55@outlook.com',
];
const AMBER_EMAILS = [
  'sola.adeyemi@gmail.com', 'yemi.dike@yahoo.com',
  'ife.garba@hotmail.com',  'ada.nwosu@live.com',
];

let _badIdx   = 0;
let _amberIdx = 0;
function _badEmail()   { return BAD_EMAILS[_badIdx++   % BAD_EMAILS.length];   }
function _amberEmail() { return AMBER_EMAILS[_amberIdx++ % AMBER_EMAILS.length]; }

// Card BINs — real Nigerian-issued BINs from the BIN database
// GREEN  → legitimate Nigerian debit/credit cards from major banks
//          small mix of foreign (Nigerians abroad, PayPal/foreign cards are legit)
// AMBER  → Nigerian credit or lesser-known BINs worth reviewing
// RED    → foreign BINs used in card-fraud patterns on Nigerian merchants
const BINS_GREEN = [
  '420320', // GTBank Visa Debit
  '407127', // Zenith Visa Debit
  '407591', // UBA Visa Debit
  '418742', // Access Visa Debit
  '514585', // Zenith Mastercard Debit
  '518304', // Zenith Mastercard Debit
  '519899', // Zenith Mastercard Debit
  '521958', // Zenith Mastercard Debit
  '519904', // Zenith Mastercard Debit
  '404905', // UBA Visa Credit
  '412053', // Zenith Visa Debit
  '413103', // Zenith Visa Debit
  '419760', // Zenith Visa Debit
  '419762', // Zenith Visa Debit
  '403660', // Access Bank Visa
  '420319', // GTBank Visa Credit
];
const BINS_AMBER = [
  '512269', // Ecobank Mastercard Credit
  '512450', // Ecobank Mastercard Credit
  '513469', // Zenith Mastercard Credit
  '515803', // Zenith Mastercard Credit
  '521623', // Intercontinental Mastercard Credit
  '521982', // Zenith Mastercard Credit
  '400066', // Intercontinental Visa Credit
  '408378', // Zenith Visa Credit
  '408407', // Zenith Visa Credit
  '419225', // Skye Bank Visa Credit
  '420358', // UBA Visa Credit
  '512336', // Zenith Mastercard Credit
];
const BINS_RED = [
  '411111', // JPMorgan Chase (US) — common in card testing
  '400000', // Generic Visa (US) — used in BIN attacks
  '438857', // Chase Bank USA
  '462203', // Generic US Visa
  '476148', // Yamagin Credit Japan
  '403245', // Banco Citicard Brazil
  '400115', // Barclays UK
  '545501', // NatWest UK Mastercard
  '490116', // Generic Visa
  '492950', // Generic Visa
];

// Amounts (in kobo — 1 NGN = 100 kobo)
// GREEN:  ₦1,200 – ₦45,000  (everyday POS / e-commerce)
// AMBER:  ₦55,000 – ₦150,000 (above-average, warrants review)
// RED:    ₦200,000 – ₦500,000 (very high, typical card fraud amount)
const AMOUNTS_GREEN = [
  120000, 250000, 350000, 500000, 750000, 1000000,
  1250000, 1500000, 2000000, 2500000, 3000000, 3500000, 4000000, 4500000,
];
const AMOUNTS_AMBER = [
  5500000, 6000000, 7000000, 7500000, 8500000,
  9000000, 10000000, 12000000, 13500000, 15000000,
];
const AMOUNTS_RED = [
  20000000, 25000000, 28000000, 30000000, 35000000,
  38000000, 42000000, 45000000, 48000000, 50000000,
];

//Exported simulate functions 

function simulateGreen() {
  _post({
    transaction_ref:  _ref(),
    amount:           _pick(AMOUNTS_GREEN),
    email:            _email(),
    card_bin:         _pick(BINS_GREEN),
    transaction_date: new Date().toISOString(),
  });
}

function simulateAmber() {
  _post({
    transaction_ref:  _ref(),
    amount:           _pick(AMOUNTS_AMBER),
    email:            _amberEmail(),
    card_bin:         _pick(BINS_AMBER),
    transaction_date: new Date().toISOString(),
  });
}

function simulateRed() {
  _post({
    transaction_ref:  _ref(),
    amount:           _pick(AMOUNTS_RED),
    email:            _badEmail(),
    card_bin:         _pick(BINS_RED),
    transaction_date: new Date().toISOString(),
  });
}
