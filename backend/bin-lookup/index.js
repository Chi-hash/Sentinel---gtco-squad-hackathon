/**
 * BIN Lookup Module
 * Loads binlist-data.csv once at startup into a Map for O(1) lookups.
 * Columns: bin,brand,type,category,issuer,alpha_2,alpha_3,country,...
 */

const fs   = require('fs');
const path = require('path');

const CSV_PATH = path.join(__dirname, '../../binlist-data.csv');

function parseCSVLine(line) {
  const fields = [];
  let current  = '';
  let inQuote  = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuote = !inQuote;
    } else if (ch === ',' && !inQuote) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
  //
}

// Prefer the full CSV (339k records) when present; fall back to the committed
// slim JSON (Nigerian BINs + all simulate.js BINs) so the app works out of the box.
const SLIM_PATH = path.join(__dirname, 'bins_slim.json');
const binMap = new Map();

let loaded = false;

// Try full CSV first
try {
  const lines = fs.readFileSync(CSV_PATH, 'utf8').split('\n');
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const [bin, brand, type, category, issuer, alpha2] = parseCSVLine(line);
    if (!bin || !/^\d{5,8}$/.test(bin)) continue;
    binMap.set(bin.slice(0, 6), {
      brand:    (brand    || '').toUpperCase(),
      type:     (type     || '').toUpperCase(),
      category: (category || '').toUpperCase(),
      bank:     issuer    || '',
      country:  (alpha2   || '').toUpperCase(),
    });
  }
  console.log(`[BIN] Loaded ${binMap.size.toLocaleString()} records from CSV.`);
  loaded = true;
} catch (_) {}

// Fall back to slim JSON
if (!loaded) {
  try {
    const slim = JSON.parse(fs.readFileSync(SLIM_PATH, 'utf8'));
    for (const [key, val] of Object.entries(slim)) binMap.set(key, val);
    console.log(`[BIN] Loaded ${binMap.size} records from slim fallback (bins_slim.json).`);
  } catch (err) {
    console.warn('[BIN] Could not load any BIN data:', err.message);
  }
}


/**
 * Look up a card BIN (first 6 digits).
 * Returns { brand, type, category, bank, country, is_nigerian } or null if unknown.
 */
function lookupBin(bin) {
  if (!bin) return null;
  const key = String(bin).replace(/\D/g, '').slice(0, 6);
  const entry = binMap.get(key);
  if (!entry) return null;
  return {
    ...entry,
    is_nigerian: entry.country === 'NG',
  };
}

/**
 * Enrich a transaction object with BIN metadata.
 * Returns a new object with `bin_info` added.
 */
function enrichTransaction(txn) {
  const info = lookupBin(txn.card_bin);
  return {
    ...txn,
    bin_info: info || { brand: '', type: '', category: '', bank: '', country: '', is_nigerian: false },
  };
}

/**
 * Returns true if the BIN belongs to a Nigerian-issued card.
 */
function isNigerianBin(bin) {
  const info = lookupBin(bin);
  return info ? info.is_nigerian : false;
}

/**
 * Returns true if the BIN is known but issued outside Nigeria.
 */
function isForeignBin(bin) {
  const info = lookupBin(bin);
  if (!info) return false;
  return !info.is_nigerian;
}

/**
 * Returns true if the BIN belongs to a prepaid card.
 */
function isPrepaidBin(bin) {
  const info = lookupBin(bin);
  return info ? info.type === 'PREPAID' : false;
}

module.exports = { lookupBin, enrichTransaction, isNigerianBin, isForeignBin, isPrepaidBin };
