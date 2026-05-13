// Sentinel — frontend simulator
// Randomised realistic transaction pools.

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

function _capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function _fullName() {
  return _capitalize(_pick(FIRST)) + ' ' + _capitalize(_pick(LAST));
}
function _nameFromEmail(email) {
  if (!email) return 'Unknown';
  const local = email.split('@')[0];
  return local
    .replace(/[._0-9]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace(/\s+/g, ' ')
    .trim();
}

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

const BINS_GREEN = [
  '420320', 
  '407127', 
  '407591', 
  '418742', 
  '514585', 
  '518304',
  '519899', 
  '521958', 
  '519904',
  '404905', 
  '412053', 
  '413103', 
  '419760', 
  '419762', 
  '403660',
  '420319', 
];
const BINS_AMBER = [
  '512269', 
  '512450', 
  '513469', 
  '515803',
  '521623', 
  '521982', 
  '400066', 
  '408378', 
  '408407', 
  '419225', 
  '420358', 
  '512336', 
];
const BINS_RED = [
  '411111', 
  '400000',
  '438857', 
  '462203', 
  '476148', 
  '403245', 
  '400115',
  '545501', 
  '490116',
  '492950', 
];

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
    name:             _fullName(), 
    card_bin:         _pick(BINS_GREEN),
    transaction_date: new Date().toISOString(),
  });
}

function simulateAmber() {
  const email = _amberEmail();
  _post({
    transaction_ref:  _ref(),
    amount:           _pick(AMOUNTS_AMBER),
    email:            email,     
    name:             _nameFromEmail(email), 
    card_bin:         _pick(BINS_AMBER),
    transaction_date: new Date().toISOString(),
  });
}

function simulateRed() {
  const email = _badEmail(); 
  _post({
    transaction_ref:  _ref(),
    amount:           _pick(AMOUNTS_RED),
    email:            email,     // ← use the variable
    name:             _nameFromEmail(email),  
    card_bin:         _pick(BINS_RED),
    transaction_date: new Date().toISOString(),
    is_suspicious:    Math.random() < 0.3, // 30% chance Squad flags it too
  });
}
