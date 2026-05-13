# Sentinel

### AI-Powered Real-Time Fraud Intelligence System for Squad Payments

**Hackathon:** Squad Hackathon 3.0 — Smart Systems: The Intelligent Economy  
**Team:** NovaCore — Nkenchor Chioma & Femi-Olagundoye Oluwaferanmi  
**Track:** Proof of Life Submission  
**Date:** May 2026

---

## Overview

Sentinel is a real-time AI fraud detection and response system built on top of Squad's payment infrastructure. It intercepts every transaction via Squad's webhook, runs it through a 3-stage hybrid AI engine (rule-based scoring + Z-score anomaly detection + Isolation Forest ML), and automatically acts on the result — approving, flagging, or blocking and refunding — in under 500ms.

It acts as an intelligent security layer between Squad webhooks and merchant fulfillment systems, with a live dashboard that gives merchants full visibility into every risk decision.

---

## Problem Statement

Digital payments in Nigeria are growing rapidly, but fraud is growing just as fast. Merchants using Squad currently face:

- No real-time fraud scoring at the transaction level
- No automated pre-fulfillment fraud blocking
- Chargebacks detected too late — after money is already lost
- SMEs cannot afford enterprise fraud systems
- No explainability — merchants don't know *why* a transaction was suspicious

Sentinel solves this by introducing **real-time AI-driven fraud prevention directly into Squad merchant workflows**.

---

## Solution

Sentinel introduces a **3-stage hybrid AI engine** that:

1. Receives Squad `charge_successful` webhooks in real time
2. Validates HMAC-SHA512 signature and deduplicates
3. Enriches the transaction with card BIN metadata (bank, type, country)
4. Runs 10 fraud rules (R01–R10) covering velocity, amount anomalies, off-hours activity, foreign cards, and more
5. Applies Z-score statistical anomaly detection against per-customer history
6. Scores using an Isolation Forest ML model trained on behavioral features
7. Produces a 0–100 trust score with explainable reason codes
8. Automatically triggers actions based on tier:

| Score | Tier  | Action |
|-------|-------|--------|
| 0–30  | GREEN | Approve transaction |
| 31–70 | AMBER | Flag for manual review |
| 71–100 | RED  | Block + auto-refund via Squad API |

---

## Key Features

### Real-Time Fraud Scoring
- Sub-500ms inference pipeline
- Event-driven webhook processing
- 3-stage AI engine: Rules → Z-Score → Isolation Forest
- 10 explainable fraud rules (R01–R10)

### BIN Intelligence
- Card BIN lookup across 339,000+ records
- Identifies Nigerian vs. foreign cards
- Detects prepaid cards (elevated chargeback risk)
- Bank name and card type shown on every transaction

### Squad Dual-Confirmation
- Cross-references Squad's own `is_suspicious` flag
- Surfaces `🚨 DUAL` when both Sentinel and Squad flag a transaction
- Surfaces `SENTINEL ONLY` when Sentinel catches what Squad missed
- Gives merchants layered confidence in fraud decisions

### Historical Transaction Import
- On first login, Sentinel automatically pulls the merchant's last 30 days from Squad
- Scores every transaction retroactively through the full AI engine
- Shows an instant summary: *"X analysed · Y blocked · Z flagged"*
- Merchants see value immediately, before any new webhook arrives

### Merchant Dashboard
- Live transaction feed with real-time Socket.io updates
- Trust Score Trend chart (Chart.js)
- KPI cards: Transactions, Flagged, Blocked, Fraud Losses Prevented
- Search by email, amount, card, or signal code
- Quick-filter tags: approved / flagged / blocked
- Notification center for unread RED alerts

### Transaction Modal & Fraudster Profile
- Full breakdown: amount, customer, card origin, AI score, risk signals
- ML feature deviations (velocity, amount vs. average, hour of day)
- Fraudster Profile card for RED transactions (operating pattern, identity, method)
- PDF report generator — printable, professional, suitable for chargeback disputes

### Automated Actions
- RED: auto-refund via Squad Refund API + fraud email alert
- AMBER: verify via Squad Transaction Verify API + burst email alert (3+ in 10 min)
- Partial refund option for AMBER transactions
- Cancel recurring card token for confirmed fraud

### Dispute Intelligence
- RED transactions auto-appear in the disputes panel
- AI-generated evidence package (score, signals, model output)
- One-click submission to Squad Disputes API
- Supports chargeback defense workflows

### Email Alerts (Nodemailer + Gmail SMTP)
- RED alert: fired per blocked transaction with full transaction details
- AMBER burst alert: fires when 3+ suspicious transactions occur in 10 minutes
- Professional HTML email templates

### Merchant Onboarding
- Squad API key verification on first load
- Validates against Squad's live `/account/balance` endpoint
- Supports both sandbox and live keys
- Demo mode available (no Squad account needed)
- Verified merchants see their business name in the dashboard header

---

## System Architecture

```
Squad Payment Gateway
        │
        │  POST /webhook/squad  (HMAC-SHA512 signed)
        ▼
┌─────────────────────────────────────────────┐
│                Express Server               │
│                                             │
│  webhook/receiver.js                        │
│    ├─ validate HMAC signature               │
│    ├─ parse Squad or demo payload           │
│    ├─ deduplicate (DB check)                │
│    ├─ BIN lookup (bank, type, country)      │
│    ├─ 3-stage AI scoring engine             │
│    │     ├─ R01–R10 rule-based scoring      │
│    │     ├─ Z-score anomaly detection       │
│    │     └─ Isolation Forest ML model       │
│    ├─ save to SQLite (source tagged)        │
│    ├─ act: refund / verify / email alert    │
│    └─ emit via Socket.io → dashboard        │
│                                             │
│  REST API (server.js)                       │
│  Squad Client (squad-client/api.js)         │
│  BIN Lookup (bin-lookup/)                   │
│  Email Alerts (notifications/email.js)      │
│  Database (db/database.js → SQLite)         │
└─────────────────────────────────────────────┘
        │
        │  Socket.io + HTTP static files
        ▼
┌─────────────────────────────────────────────┐
│             Browser Dashboard               │
│  frontend/index.html  index.js  index.css   │
│  frontend/simulate.js (demo mode)           │
└─────────────────────────────────────────────┘
```

---

## Fraud Rules (R01–R10)

| Rule | Code | Signal |
|------|------|--------|
| R01 | `AMOUNT_SPIKE` | Amount is 3× above merchant average |
| R02 | `HIGH_VALUE_NEW` | First-time payer with very high amount |
| R03 | `OFF_HOURS` | Transaction placed between 1–4 AM WAT |
| R04 | `HIGH_VELOCITY` | Same email used 3+ times in 5 minutes |
| R05 | `BIN_PATTERN` | Same card BIN linked to 5+ emails in 60 min |
| R06 | `BEHAVIOUR_MISMATCH` | Sudden jump from habitual spend amounts |
| R07 | `FIRST_TIME_PAYER` | No prior transaction history for this email |
| R08 | `ROUND_AMOUNT` | Exact round million in kobo — common fraud fingerprint |
| R09 | `FOREIGN_CARD` | Card BIN identified as non-Nigerian |
| R10 | `UNKNOWN_BIN` / `PREPAID_CARD` | BIN not in database or card is prepaid |

---

## Squad API Integration

| API | Endpoint | Used For |
|-----|----------|----------|
| Webhook | `POST /webhook/squad` | Real-time transaction ingestion |
| Verify Transaction | `GET /transaction/verify/:ref` | Cross-validate AMBER transactions |
| Refund | `POST /transaction/refund` | Auto-refund RED (full) + AMBER (partial) |
| Transaction History | `GET /transaction` | Import last 30 days on first login |
| Disputes | `GET /dispute` | Populate disputes panel |
| Challenge Dispute | `POST /dispute/merchant/challenge` | Submit AI evidence |
| Account Balance | `GET /account/balance` | Verify merchant API key on setup |
| Cancel Token | `PATCH /transaction/cancel/recurring` | Block future charges on fraud cards |

---

## Machine Learning Approach

### Model: Isolation Forest (Unsupervised)

Sentinel uses Isolation Forest to detect anomalies in transaction behavior without requiring labeled fraud data.

**Feature vector (6 dimensions):**
- `amount` — transaction amount in kobo
- `hour` — hour of day in WAT (West Africa Time)
- `is_first_time` — whether the email has prior history
- `velocity` — number of recent transactions from same email
- `bin_count` — number of distinct emails from same card BIN
- `amount_vs_avg` — ratio of amount to merchant average

**Why Isolation Forest:**
- Fraud patterns evolve constantly — unsupervised learning adapts
- No labeled fraud dataset required
- Works well with behavioral outliers
- Efficient for real-time inference

---

## Demo Mode

Sentinel includes a full demo mode for presentations without a Squad account:

- Realistic simulated transactions using real Nigerian BINs (GTBank, Zenith, UBA, Access, Ecobank)
- Fixed email pools for AMBER/RED so history-dependent rules fire after a few transactions
- Foreign BINs for RED scenarios (JPMorgan Chase, Barclays, NatWest)
- Auto-timer fires a new transaction every 45 seconds (15% RED, 15% AMBER, 70% GREEN)
- Manual RED / AMBER / GREEN trigger buttons in the sidebar

---

## Project Structure

```
sentinel/
├── backend/
│   ├── server.js                  # Express app, all API routes
│   ├── webhook/
│   │   └── receiver.js            # Webhook ingestion & scoring pipeline
│   ├── ai-engine/
│   │   ├── rules.js               # R01–R10 fraud rules
│   │   └── scorer.js              # 3-stage scoring engine
│   ├── squad-client/
│   │   └── api.js                 # Squad API integration
│   ├── bin-lookup/
│   │   ├── index.js               # BIN lookup module
│   │   ├── bins_slim.json         # Committed fallback (Nigerian + sim BINs)
│   │   └── bins_ng.json           # Nigerian BINs only
│   ├── notifications/
│   │   └── email.js               # Email alerts (Nodemailer + Gmail SMTP)
│   └── db/
│       └── database.js            # SQLite via better-sqlite3
├── frontend/
│   ├── index.html                 # Dashboard UI
│   ├── index.js                   # Dashboard logic, Socket.io, modals
│   ├── index.css                  # Styles
│   ├── simulate.js                # Demo transaction simulator
│   └── assets/
│       └── favicon.png
├── ml/
│   ├── generate_data.js           # Training data generator
│   ├── train_model.py             # Isolation Forest training script
│   ├── training_data.csv          # Generated training dataset
│   └── model.json                 # Trained model weights
├── .env                           # Environment variables (not committed)
├── nodemon.json
├── package.json
└── README.md
```

---

## Environment Variables

```env
SQUAD_API_KEY=sandbox_sk_...        # Your Squad secret key
SQUAD_WEBHOOK_SECRET=sandbox_sk_... # Your Squad webhook secret
PORT=3000

# Email alerts (optional — alerts disabled if blank)
GMAIL_USER=your@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
MERCHANT_EMAIL=merchant@example.com
```

---

## Running Locally

```bash
# Install dependencies
npm install

# Start the server (with auto-reload)
npm run dev

# Expose via ngrok for Squad webhooks
ngrok http 3000
# Set https://<your-ngrok-url>/webhook/squad as your Squad webhook URL
```

Then open `http://localhost:3000` in your browser.

---

## Impact

Sentinel shifts fraud detection from:

> ❌ After-money-lost detection

to:

> ✅ Before-money-leaves prevention

This reduces financial loss, improves merchant trust in digital payments, and brings enterprise-grade fraud intelligence to SMEs who cannot afford traditional fraud systems.
