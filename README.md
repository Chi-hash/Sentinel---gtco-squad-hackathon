# Sentinel

### AI-Powered Real-Time Fraud Intelligence System for Squad Payments

**Hackathon:** Squad Hackathon 3.0 - Smart Systems: The Intelligent Economy  
**Team:** NovaCore - Nkenchor Chioma & Femi-Olagundoye Oluwaferanmi  
**Track:** Proof of Life Submission  
**Date:** May 2026

---

## Overview

Sentinel is a real-time AI fraud detection and response system built on top of Squad's payment infrastructure. It intercepts every transaction via Squad's webhook, runs it through a 3-stage hybrid AI engine (rule-based scoring + Z-score anomaly detection + Isolation Forest ML), and automatically acts on the result - approving, flagging, or blocking and refunding - in under 500ms.

It acts as an intelligent security layer between Squad webhooks and merchant fulfillment systems, with a live dashboard that gives merchants full visibility into every risk decision.

---

## Problem Statement

Digital payments in Nigeria are growing rapidly, but fraud is growing just as fast. Merchants using Squad currently face:

- No real-time fraud scoring at the transaction level
- No automated pre-fulfillment fraud blocking
- Chargebacks detected too late, after money is already lost
- SMEs cannot afford enterprise fraud systems
- No explainability - merchants do not know *why* a transaction was suspicious

Sentinel solves this by introducing **real-time AI-driven fraud prevention directly into Squad merchant workflows**.

---

## Solution

Sentinel introduces a **3-stage hybrid AI engine** that:

1. Receives Squad `charge_successful` webhooks in real time
2. Validates HMAC-SHA512 signature and deduplicates
3. Enriches the transaction with card BIN metadata (bank, type, country)
4. Runs 10 fraud rules (R01-R10) covering velocity, amount anomalies, off-hours activity, foreign cards, and more
5. Applies Z-score statistical anomaly detection against per-customer history
6. Scores using an Isolation Forest ML model trained on 6 behavioral features
7. Produces a 0-100 trust score with explainable reason codes
8. Automatically triggers actions based on tier:

| Score  | Tier  | Action                            |
|--------|-------|-----------------------------------|
| 0-30   | GREEN | Approve transaction               |
| 31-70  | AMBER | Flag for manual review            |
| 71-100 | RED   | Block and auto-refund via Squad API |

---

## Key Features

### Real-Time Fraud Scoring
- Sub-500ms inference pipeline
- Event-driven webhook processing
- 3-stage AI engine: Rules, Z-Score, Isolation Forest
- 10 explainable fraud rules (R01-R10)

### BIN Intelligence
- Card BIN lookup across 339,000+ records
- Identifies Nigerian vs. foreign cards
- Detects prepaid cards (elevated chargeback risk)
- Bank name and card type displayed on every transaction

### Squad Dual-Confirmation
- Cross-references Squad's own `is_suspicious` flag on every transaction
- DUAL badge when both Sentinel and Squad flag the same transaction
- SENTINEL ONLY tag when Sentinel catches what Squad's system missed
- Squad flagged indicator when Squad caught it but Sentinel scored it GREEN
- Gives merchants layered, high-confidence fraud decisions

### Historical Transaction Import
- On first verified login, Sentinel automatically pulls the merchant's last 30 days from Squad's Transaction API
- Every transaction is scored retroactively through the full AI engine
- Dashboard shows an instant summary banner on login: X analysed, Y blocked, Z flagged
- Merchants see value immediately, before any new webhook arrives

### Merchant Dashboard
- Live transaction feed with real-time Socket.io updates
- Trust Score Trend chart (Chart.js)
- KPI cards: Transactions, Flagged, Blocked, Fraud Losses Prevented (NGN)
- Search by email, amount, card or bank name, or signal code
- Quick-filter chips: approved / flagged / blocked
- Notification center with unread RED alert badge

### Transaction Modal and Fraudster Profile
- Full breakdown: amount, customer, card origin (Nigerian / Foreign), AI score, risk signals
- Squad suspicion status (SUSPICIOUS / CLEAR)
- ML feature deviations panel (velocity, amount vs. avg, hour of day)
- Fraudster Profile card for RED transactions (operating hours, identity pattern, card pattern)
- PDF report generator: light-themed, printable, suitable as chargeback dispute evidence

### Automated Actions
- **RED:** auto-refund via Squad Refund API + instant fraud email alert to merchant
- **AMBER:** verify via Squad Transaction Verify API + burst email alert (3+ in 10 min)
- **Partial refund** modal for AMBER transactions (adjustable amount, defaults to 50%)
- **Cancel recurring card token** to block future charges from a confirmed fraud card

### Dispute Intelligence
- RED transactions automatically appear in the disputes panel
- AI-generated evidence package (score, signals, model output, feature deviations)
- One-click submission to Squad Disputes API
- Supports chargeback defense workflows

### Email Alerts (Nodemailer + Gmail SMTP)
- RED alert: fired per blocked transaction, includes amount, card info, AI score, fraud signals
- AMBER burst alert: fires when 3+ suspicious transactions arrive within 10 minutes (10-min cooldown)
- Professional HTML email templates

### Merchant Onboarding and Mode Separation
- Setup screen on first load: paste Squad API key to verify
- Key validated against Squad's live `/account/balance` endpoint
- Supports both sandbox and live keys
- Demo mode available with no Squad account needed
- Strict separation: verified accounts only see real transactions; demo accounts see simulated ones
- All transactions tagged `source: real | demo | historical` at write time

---

## System Architecture

```
Squad Payment Gateway
        |
        |  POST /webhook/squad  (HMAC-SHA512 signed)
        v
+---------------------------------------------+
|                Express Server               |
|                                             |
|  webhook/receiver.js                        |
|    +- validate HMAC signature               |
|    +- parse Squad or demo payload           |
|    +- deduplicate (DB check)                |
|    +- BIN lookup (bank, type, country)      |
|    +- 3-stage AI scoring engine             |
|    |     +- R01-R10 rule-based scoring      |
|    |     +- Z-score anomaly detection       |
|    |     +- Isolation Forest ML model       |
|    +- save to SQLite (source + is_suspicious tagged) |
|    +- act: refund / verify / email alert    |
|    +- emit via Socket.io to dashboard       |
|                                             |
|  REST API (server.js)                       |
|  Squad Client (squad-client/api.js)         |
|  BIN Lookup (bin-lookup/)                   |
|  Email Alerts (notifications/email.js)      |
|  Database (db/database.js -> SQLite)        |
+---------------------------------------------+
        |
        |  Socket.io + HTTP static files
        v
+---------------------------------------------+
|             Browser Dashboard               |
|  frontend/index.html  index.js  index.css   |
|  frontend/simulate.js (demo mode only)      |
+---------------------------------------------+
```

---

## Fraud Rules (R01-R10)

| Rule | Signal Code | What It Detects |
|------|-------------|-----------------|
| R01 | `AMOUNT_SPIKE` | Amount is 3x above merchant average |
| R02 | `HIGH_VALUE_NEW` | First-time payer with very high amount |
| R03 | `OFF_HOURS` | Transaction placed between 1-4 AM WAT |
| R04 | `HIGH_VELOCITY` | Same email used 3+ times in 5 minutes |
| R05 | `BIN_PATTERN` | Same card BIN linked to 5+ emails in 60 min |
| R06 | `BEHAVIOUR_MISMATCH` | Sudden jump from habitual spend amounts |
| R07 | `FIRST_TIME_PAYER` | No prior transaction history for this email |
| R08 | `ROUND_AMOUNT` | Exact round million in kobo, common fraud fingerprint |
| R09 | `FOREIGN_CARD` | Card BIN identified as non-Nigerian |
| R10 | `UNKNOWN_BIN` / `PREPAID_CARD` | BIN not in database, or card is prepaid |

---

## Squad API Integration

| API | Method | Endpoint | Used For |
|-----|--------|----------|----------|
| Webhook | POST | `/webhook/squad` | Real-time transaction ingestion |
| Verify Transaction | GET | `/transaction/verify/:ref` | Cross-validate AMBER transactions |
| Full Refund | POST | `/transaction/refund` | Auto-refund RED transactions |
| Partial Refund | POST | `/transaction/refund` | Smart AMBER response |
| Transaction History | GET | `/transaction` | Import last 30 days on first login |
| Disputes | GET | `/dispute` | Populate disputes panel |
| Challenge Dispute | POST | `/dispute/merchant/challenge` | Submit AI evidence for chargebacks |
| Account Balance | GET | `/account/balance` | Verify merchant API key on setup |
| Cancel Token | PATCH | `/transaction/cancel/recurring` | Block future charges from fraud card |

---

## Machine Learning Approach

### Model: Isolation Forest (Unsupervised)

Sentinel uses Isolation Forest to detect anomalies in transaction behavior without requiring labeled fraud data.

**Feature vector (6 dimensions):**

| Feature | Description |
|---------|-------------|
| `amount` | Transaction amount in kobo |
| `hour` | Hour of day in WAT (West Africa Time) |
| `is_first_time` | Whether the email has prior history (0 or 1) |
| `velocity` | Number of recent transactions from same email |
| `bin_count` | Number of distinct emails from same card BIN |
| `amount_vs_avg` | Ratio of amount to merchant average |

**Why Isolation Forest:**
- Fraud patterns evolve constantly - unsupervised learning adapts without retraining
- No labeled fraud dataset required
- Naturally handles behavioral outliers
- Lightweight and efficient for real-time inference

---

## Demo Mode

Sentinel includes a full demo mode for presentations without a Squad account:

- Realistic simulated transactions using real Nigerian BINs (GTBank, Zenith, UBA, Access, Ecobank)
- Fixed email pools for AMBER/RED so history-dependent rules (velocity, spike) fire naturally
- Foreign BINs for RED scenarios (JPMorgan Chase, Barclays, NatWest)
- Auto-timer fires one transaction every 45 seconds (15% RED, 15% AMBER, 70% GREEN)
- Manual RED / AMBER / GREEN trigger buttons in the sidebar
- All demo transactions tagged `source: demo`, completely isolated from real transaction data

---

## Project Structure

```
sentinel/
+-- backend/
|   +-- server.js                  # Express app, all API routes
|   +-- webhook/
|   |   +-- receiver.js            # Webhook ingestion and full scoring pipeline
|   +-- ai-engine/
|   |   +-- rules.js               # R01-R10 fraud rules
|   |   +-- scorer.js              # 3-stage scoring engine (rules + z-score + ML)
|   +-- squad-client/
|   |   +-- api.js                 # All Squad API integrations
|   +-- bin-lookup/
|   |   +-- index.js               # BIN lookup module (CSV + fallback JSON)
|   |   +-- bins_slim.json         # Committed fallback (Nigerian + simulate BINs)
|   |   +-- bins_ng.json           # Nigerian BINs only
|   +-- notifications/
|   |   +-- email.js               # Email alerts (Nodemailer + Gmail SMTP)
|   +-- db/
|       +-- database.js            # SQLite via better-sqlite3
+-- frontend/
|   +-- index.html                 # Dashboard UI
|   +-- index.js                   # All dashboard logic, Socket.io, modals, charts
|   +-- index.css                  # Styles (dark theme, responsive)
|   +-- simulate.js                # Demo transaction simulator
|   +-- assets/
|       +-- favicon.png
+-- ml/
|   +-- generate_data.js           # Synthetic training data generator
|   +-- train_model.py             # Isolation Forest training script (Python)
|   +-- training_data.csv          # Generated training dataset
|   +-- model.json                 # Trained model feature weights
+-- .env                           # Environment variables (not committed)
+-- nodemon.json                   # Dev server config
+-- package.json
+-- README.md
```

---

## Environment Variables

```env
SQUAD_API_KEY=sandbox_sk_...         # Your Squad secret key
SQUAD_WEBHOOK_SECRET=sandbox_sk_...  # Your Squad webhook secret (usually same as API key)
PORT=3000

# Email alerts - leave blank to disable
GMAIL_USER=your@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
MERCHANT_EMAIL=alerts@yourbusiness.com
```

---

## Running Locally

```bash
# 1. Install dependencies
npm install

# 2. Fill in your .env file with Squad credentials

# 3. Start the server with auto-reload
npm run dev

# 4. Expose locally for Squad webhooks
ngrok http 3000
# Set https://<your-ngrok-url>/webhook/squad as your Webhook URL in the Squad dashboard
```

Open `http://localhost:3000` in your browser.

---

## Impact

Sentinel shifts fraud detection from after-money-lost detection to before-money-leaves prevention.

Instead of discovering chargebacks days later and manually disputing them, Sentinel intercepts fraud in real time, auto-refunds confirmed fraud, and generates AI evidence instantly.

This reduces financial loss, improves merchant trust in digital payments, and brings enterprise-grade fraud intelligence to Nigerian SMEs who cannot afford traditional fraud systems.

---

*Built for Squad Hackathon 3.0 - May 2026 - Team NovaCore*
