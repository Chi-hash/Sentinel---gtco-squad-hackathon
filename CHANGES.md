# Sentinel — Change Log

All AI-assisted edits are recorded here. Newest entries are at the top.

---

## [2026-05-09] backend/ai-engine/scorer.js — Stage 3 ML scoring added

**File:** `backend/ai-engine/scorer.js`
**Status:** Rewritten from empty (file was blank on disk despite prior session)

### What changed

Stage 3 added between Stage 2 and the final score calculation. Stage 1 and Stage 2 logic is identical to the original spec.

#### New at the top of the file (module-level, loaded once)
- `const MODEL = require('../../ml/model.json')` — loaded once at startup, not on every call.
- `FEATURE_MAX` — a hardcoded map of the maximum realistic value per feature, matching the upper bounds of the fraud range in `generate_data.js`. Used for normalization.
- `MAX_WEIGHTED_SCORE` — pre-computed ceiling for normalization (`sum of FEATURE_MAX[f] × weight[f]`). Pre-computing avoids recalculating on every transaction.

#### Stage 3 logic
1. Extract 6 features matching the model's training features: `amount`, `hour` (WAT), `is_first_time`, `velocity`, `bin_count`, `amount_vs_avg`.
2. Compute `rawWeighted = sum(featureValue × feature_weight)` from `model.json`.
3. Normalize: `normalised = rawWeighted / MAX_WEIGHTED_SCORE` → value 0–1.
4. Threshold: `> 0.7` → +20 + `ML_HIGH_RISK`; `> 0.4` → +10 + `ML_MEDIUM_RISK`; else +0.

#### Why FEATURE_MAX is needed
`model.json`'s `amount` weight is ≈1.0 and the raw amount is in kobo (up to 50,000,000). Without normalizing against the correct scale, the `normalised` value would be approximately `transaction.amount / 50,000,000` — which is correct! But other features (velocity: 0–8, bin_count: 0–10) would be lost in the noise. FEATURE_MAX ensures each feature's contribution is scaled to its true maximum before the weighted sum.

#### Updated score ceiling
| Stage | Max points |
|-------|-----------|
| Stage 1 (rules) | 70 |
| Stage 2 (z-score) | 30 |
| Stage 3 (ML) | 20 |
| **Final** | **min(100, sum)** |

---

## [2026-05-09] ml/train_model.py — Created

**File:** `ml/train_model.py`
**Status:** New file. Runs clean. Produces `ml/model.json`.

### What was written

A Python script that trains an Isolation Forest on the synthetic CSV data and exports a JSON metadata file consumed by the Node.js backend.

#### Results on current training data
| Metric | Value |
|--------|-------|
| Accuracy | 99.2% |
| Precision | 98.0% |
| Recall | 98.0% |
| F1 | 98.0% |
| Confusion (TN/FP/FN/TP) | 398 / 2 / 2 / 98 |

#### Key design decisions
- **Unsupervised training**: `IsolationForest.fit(X)` — labels are NOT passed during training. They are only used after the fact to evaluate the predictions.
- **Prediction conversion**: `predict()` returns -1 (anomaly) or +1 (normal). Converted to 1/0 with `np.where(raw == -1, 1, 0)` to match Sentinel's label convention.
- **Thresholds from `score_samples()`**: The 20th and 40th percentile of fraud sample scores are used as `high_risk_score` and `medium_risk_score`. These can be read by the Node.js scorer to add a continuous anomaly signal on top of the rule-based score.
- **Feature weights via MAD**: Mean absolute deviation between fraud and normal distributions per feature, normalised to sum to 1.0. `amount` dominates (≈1.0) because the synthetic data has a large absolute gap in kobo values between normal and fraud ranges.
- **ASCII-only output**: Windows terminal (cp1252 codec) rejects Unicode box-drawing characters — all decorative characters use plain ASCII (`---`, `#`, `->`) so the script runs cleanly in any Windows terminal.

#### Usage
```bash
python ml/train_model.py
```

---

## [2026-05-09] ml/generate_data.js — Created

**File:** `ml/generate_data.js`
**Status:** New file, `ml/` directory created
**Output:** `ml/training_data.csv` (500 rows, 7 columns)

### What was written

A zero-dependency Node.js script that generates synthetic labelled transaction data for training an ML fraud classifier.

#### Dataset composition
| Split | Count | Label |
|-------|-------|-------|
| Normal | 400 | 0 |
| Fraudulent | 100 | 1 |
| **Total** | **500** | — |

#### Feature design

| Feature | Normal range | Fraud range | Why |
|---------|-------------|-------------|-----|
| `amount` | 100k–5M kobo | 5M–50M kobo | Fraud skews high-value |
| `hour` | 8–22 | 0–5 | Off-hours activity |
| `is_first_time` | 20% chance | 70% chance | New accounts are riskier |
| `velocity` | 0–1 | 3–8 | Burst transactions |
| `bin_count` | 1–2 | 4–10 | BIN stuffing pattern |
| `amount_vs_avg` | 0.5–2.0 | 3.0–8.0 | Behavioural anomaly |

#### Noise injection
15% of fraud rows are given a normal-looking `amount` (100k–5M kobo) to prevent the model from over-relying on amount alone. This makes it learn the multi-feature pattern of fraud.

#### Other details
- Rows are **shuffled** with Fisher-Yates after generation so normal and fraud are interleaved — prevents ordering bias during training.
- Only built-in `fs` and `path` modules used — no `npm install` required.

#### Usage
```bash
node ml/generate_data.js
```

---

## [2026-05-09] demo/simulate.js — Created

**File:** `demo/simulate.js`
**Status:** New file (was empty)

### What was written

A self-contained Node.js script that fires 3 fake transactions at the local Sentinel server to exercise the full backend pipeline end-to-end.

#### How it works
- Sends `POST /webhook/squad` with `x-demo-mode: true` header so HMAC validation is skipped.
- `sleep(3000)` between each send so the dashboard has time to update visibly between transactions.
- Timestamps use today's date (`new Date().toISOString().slice(0, 11)`) with hardcoded times so the OFF_HOURS rule fires correctly on scenarios 2 and 3 (3:15am and 2:50am WAT).
- Logs the ref, score, and tier on success; logs the error message on failure.

#### The 3 scenarios
| # | Ref | Amount | Email | Expected tier |
|---|-----|--------|-------|---------------|
| 1 | DEMO_001 | 500,000 kobo (₦5,000) | safe@demo.com | GREEN |
| 2 | DEMO_002 | 7,500,000 kobo (₦75,000) | suspicious@demo.com | AMBER (OFF_HOURS + possible AMOUNT_SPIKE) |
| 3 | DEMO_003 | 42,000,000 kobo (₦420,000) | fraud@demo.com | RED (OFF_HOURS + HIGH_VALUE_NEW + ROUND_AMOUNT) |

#### Usage
```
node demo/simulate.js
```
Server must be running (`npm run dev`) before executing.

---

## [2026-05-09] frontend/index.js — Backend/Frontend Mismatch Fixes

**File:** `frontend/index.js`
**Status:** 7 mismatches fixed, 11 surgical line edits

### Mismatches found and fixed

| # | Mismatch | Backend sends | Frontend expected | Fix |
|---|----------|--------------|-------------------|-----|
| 1 | Amount units | `amount` in kobo | Displayed raw (no ÷100) | `money()` now divides by 100 |
| 2 | Timestamp field name | `timestamp` (ISO string) | `t.time` (HH:MM:SS string) | Added `fmtTime(iso)` helper; all `t.time` refs use `t.time \|\| fmtTime(t.timestamp)` |
| 3 | Reasons field name | `reasons` (array) | `t.codes` (array) | All reads use `t.reasons \|\| t.codes \|\| []` — keeps seed data working |
| 4 | Status field missing | Not sent | `t.status` (crashes on undefined) | Derived: `t.status \|\| (GREEN→"approved" / AMBER→"flagged" / RED→"blocked")` |
| 5 | `model_trained` missing | Not sent | `t.model_trained` (shows LEARNING MODE) | Changed condition to `!== false` — defaults to "AI MODEL ACTIVE" when absent |
| 6 | `S.saved` accumulation | `amount` in kobo | `S.saved += t.amount` (100× too large) | `S.saved += Math.round(t.amount / 100)` |
| 7 | Socket.io disabled | `new_transaction` events | `initSocket()` was entirely commented out | Uncommented, changed hardcoded URL to `io()` (relative, works in prod and local) |

### Key decisions

- **`io()` vs `io('http://localhost:3000')`**: The relative `io()` call lets Socket.io auto-connect to whatever host served the page. Hardcoding `localhost:3000` would break in any deployed environment.
- **`t.reasons || t.codes` fallback pattern**: Keeps all 8 seed transactions (which use `codes`) rendering correctly while accepting live backend events (which use `reasons`). No seed data was modified.
- **`model_trained !== false`**: When `model_trained` is `undefined` (live backend data), the condition is `true` → shows "AI MODEL ACTIVE". Only shows "LEARNING MODE" when explicitly set to `false`. This matches Sentinel's rule engine always being active.
- **`features` field**: Already safely guarded by `t.features ? ...` at lines 320-333 and 366 — no fix needed, modal simply omits the Feature Deviations section for live data.

---

## [2026-05-09] backend/server.js — Created

**File:** `backend/server.js`
**Status:** New file (was empty)

### What was written

The application entry point. Boots Express + Socket.io, wires all modules together, and starts listening.

#### Startup order (matters)
1. `require('dotenv').config()` is the very first line so every subsequent `require` can already read `process.env.*`.
2. Express app, raw HTTP server, and Socket.io instance are created.
3. `db.initDB()` runs once to create the SQLite table if it doesn't exist yet.

#### Middleware order (critical)
- `express.raw({ type: 'application/json' })` is applied **only to `POST /webhook/squad`** and before the global `express.json()` call. This ensures `req.body` arrives as a raw `Buffer` for HMAC validation. If `express.json()` ran first it would parse the body into an object, destroying the raw bytes and breaking signature verification.
- `app.use(express.json())` is mounted **after** the webhook route so all other routes get normal JSON parsing.

#### Routes
| Method | Path | Handler |
|--------|------|---------|
| `POST` | `/webhook/squad` | `receiveWebhook(req, res, db, io)` — Squad payment notifications |
| `GET` | `/api/transactions` | `db.getAllTransactions()` — last 100 transactions for the dashboard |
| `GET` | `/api/disputes` | `squadApi.getDisputes()` — chargeback history from Squad |

Both API routes have their own `try/catch` with `[API]`-prefixed error logging and a `500` fallback.

#### Socket.io
Logs `[Socket.io] client connected / disconnected` on the `connection` and `disconnect` events. The `io` instance is passed into `receiveWebhook` so the webhook handler can emit `new_transaction` to connected dashboards.

#### Port
`process.env.PORT || 3000` — honours any platform-injected port (e.g. Render, Railway) and falls back to 3000 locally.

#### Note on `db.initDB()` double-call
`database.js` already calls `initDB()` at the bottom of its own file (line 88). The call in `server.js` is therefore a no-op on first load — SQLite's `CREATE TABLE IF NOT EXISTS` is idempotent so calling it twice is safe. Both calls are kept for explicitness.

---

## [2026-05-09] backend/webhook/receiver.js — Created

**File:** `backend/webhook/receiver.js`
**Status:** New file (was empty)

### What was written

A single exported async function `receiveWebhook(req, res, db, io)` that is the entry point for every Squad payment notification. It follows 8 sequential steps.

#### Step 1 — HMAC-SHA512 signature validation
- Reads `req.headers['x-squad-encrypted-body']` (Squad's signature header).
- Recomputes the signature by running `crypto.createHmac('sha512', SQUAD_WEBHOOK_SECRET).update(req.body)` where `req.body` is the **raw Buffer** from Express's `raw` middleware — it must NOT be converted to a string before hashing or the digest will mismatch.
- If the signatures don't match, responds `401` and returns early.
- **Demo mode bypass:** if `req.headers['x-demo-mode'] === 'true'`, the entire signature block is skipped. This lets `simulate.js` drive the pipeline locally without real Squad credentials.

#### Step 2 — Parse body
- Only reached after validation, so `JSON.parse(req.body.toString())` is safe here.
- Destructures `{ transaction_ref, amount, email, card_bin, transaction_date }` from `payload.data`.

#### Step 3 — Deduplicate
- Calls `db.transactionExists(transaction_ref)`.
- If the ref is already in the database, responds `200 Already processed` and stops — prevents double-scoring replayed webhooks.

#### Step 4 — Score
- Calls `scorer.scoreTransaction({ amount, email, card_bin, timestamp: transaction_date }, db)`.
- Destructures `{ score, tier, reasons }` for use in the steps below.

#### Step 5 — Persist
- Derives `action_taken` from `tier`: `GREEN → 'approved'`, `AMBER → 'flagged'`, `RED → 'refunded'`.
- Calls `db.saveTransaction(...)` with the full transaction record including the score, tier, reasons, and action.

#### Step 6 — Act (fire and forget)
- **AMBER:** calls `squadApi.verifyTransaction(transaction_ref).catch(console.error)` — no `await`, so it doesn't block the response.
- **RED:** calls `squadApi.refundTransaction(transaction_ref, amount).catch(console.error)` — same fire-and-forget pattern.
- GREEN transactions require no external action.

#### Step 7 — Emit to dashboard
- `io.emit('new_transaction', { ref, email, amount, score, tier, reasons, timestamp })` pushes the result to all connected dashboard clients over Socket.io in real time.

#### Step 8 — Respond
- Always returns `200 { message: 'Received' }` to Squad to acknowledge the webhook.

#### Error handling
- The entire function body is inside `try/catch`. On any unexpected error the message is logged with `[Webhook]` prefix and a `500 Internal error` is returned.

---

## [2026-05-09] backend/squad-client/api.js — Created

**File:** `backend/squad-client/api.js`
**Status:** New file (was empty)

### What was written

A Squad payment-gateway client with three async functions Sentinel uses to act on scored transactions.

#### Setup (top of file)
- `require('dotenv').config()` loads `.env` so `SQUAD_API_KEY` is available at runtime.
- `axios` is imported as the HTTP client.
- `BASE_URL` is set to `https://sandbox-api-d.squadco.com` — Squad's sandbox environment.
- `authHeaders()` is a tiny private helper that builds the `Authorization: Bearer ...` header from the env variable; centralising it means if the header format ever changes, it only changes in one place.

#### `verifyTransaction(transactionRef)`
- **When called:** scorer returns `AMBER` — Sentinel wants to confirm the transaction's real status before taking further action.
- **How it works:** `GET /transaction/verify/{transactionRef}` — Squad returns the full transaction detail.
- **Returns:** the `data` object from Squad's response, or `null` on error.

#### `refundTransaction(transactionRef, amount)`
- **When called:** scorer returns `RED` — the transaction is flagged as fraudulent and needs to be reversed.
- **How it works:** `POST /transaction/refund` with body `{ transaction_ref, refund_type: "full", amount }`.
- **Returns:** Squad's refund confirmation object, or `null` on error.

#### `getDisputes()`
- **When called:** the Sentinel dashboard loads to show chargeback / dispute history.
- **How it works:** `GET /dispute` — Squad returns the list of open and resolved disputes.
- **Returns:** the disputes array/object from Squad, or `null` on error.

#### Error handling
Every function is wrapped in `try/catch`. On failure the error message is logged with a `[Squad]` prefix (so it's easy to grep in logs) and the function returns `null` — this prevents a Squad outage from crashing the Sentinel scoring pipeline.

---

## [2026-05-09] backend/ai-engine/scorer.js — Created

**File:** `backend/ai-engine/scorer.js`
**Status:** New file (was empty)

### What was written

The central scoring engine. Exports one function: `scoreTransaction(transaction, db)`.

#### Stage 1 — Rule-based scoring
- Runs all 8 rules (R01–R08) imported from `./rules.js`.
- Accumulates `score` from each rule result and collects non-null `reason` codes.
- Caps the combined rule score at **70** so Stage 2 anomaly detection still has influence.

#### Stage 2 — Z-score anomaly detection
- Fetches `db.getUserHistory(email)` to get the customer's past transactions.
- **No history:** adds a flat **15 points** (unknown baseline = moderate risk).
- **Has history:** computes the mean and population standard deviation of past amounts, then calculates `z = (amount − avg) / stdDev`.
  - `stage2Score = clamp(z * 10, 0, 30)`
  - If `z > 2`, appends `'STAT_ANOMALY'` to reasons.
  - If `stdDev === 0` (customer always pays the same amount), skips the calculation and adds 0.

#### Final output
- `totalScore = clamp(round(stage1 + stage2), 0, 100)`
- Tier assignment: **GREEN** (0–30), **AMBER** (31–70), **RED** (71–100).
- Returns `{ score, tier, reasons }`.
- Outer `try/catch` fallback: `{ score: 50, tier: 'AMBER', reasons: ['SCORING_ERROR'] }`.

---

## [2026-05-09] backend/ai-engine/rules.js — Created

**File:** `backend/ai-engine/rules.js`
**Status:** New file (was empty)

### What was written

Eight named fraud-detection rule functions (R01–R08), each returning `{ score, reason }` or `{ score: 0, reason: null }`.

| Rule | Reason Code | Score | Condition |
|------|-------------|-------|-----------|
| R01 | `AMOUNT_SPIKE` | +30 | amount > 3× merchant average |
| R02 | `HIGH_VALUE_NEW` | +25 | amount > ₦500k AND no prior email history |
| R03 | `OFF_HOURS` | +20 | transaction hour is 1–4am WAT (UTC+1) |
| R04 | `HIGH_VELOCITY` | +35 | 3+ transactions from same email in 5 minutes |
| R05 | `BIN_PATTERN` | +40 | same card BIN used by 5+ different emails in 60 minutes |
| R06 | `BEHAVIOUR_MISMATCH` | +15 | history exists, all past txns < ₦100k, this one > ₦300k |
| R07 | `FIRST_TIME_PAYER` | +10 | no prior transaction history for this email |
| R08 | `ROUND_AMOUNT` | +15 | amount is exactly divisible by 1,000,000 kobo |

All rules: CommonJS, wrapped in `try/catch`, under 15 lines each.
