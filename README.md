# Sentinel

### AI-Powered Real-Time Fraud Intelligence System for Squad Payments

**Hackathon:** Squad Hackathon 3.0 — Smart Systems: The Intelligent Economy  
**Team:** NovaCore (Nkenchor Chioma & Femi-Olagundoye Oluwaferanmi)  
**Track:** Proof of Life Submission  
**Date:** May 2026  

---

## Overview

Sentinel is an AI-powered fraud detection and response system built on top of Squad’s payment infrastructure. It analyzes every transaction in real time, assigns a dynamic fraud risk score using machine learning, and automatically triggers protective actions such as approval, flagging, or refunding. 

It acts as an intelligent security layer between Squad webhooks and merchant fulfillment systems.

---

## Problem Statement

Digital payments in Nigeria are growing rapidly, but fraud is growing just as fast. Merchants using payment platforms like Squad currently face key challenges:

- No real-time fraud scoring at transaction level  
- No automated pre-fulfillment fraud blocking  
- Chargebacks are detected too late (after funds are lost)  
- SMEs cannot afford enterprise fraud systems  
- Lack of explainable fraud intelligence  

Sentinel solves this by introducing **real-time AI-driven fraud prevention directly into Squad merchant workflows**.

---

## Impact

Sentinel brings real-time fraud protection to SMEs and fintech merchants who cannot afford enterprise fraud systems.

It shifts fraud detection from:
After-money-lost detection  
to  
Before-money-leaves prevention  

This reduces financial loss, improves trust in digital payments, and strengthens the security layer of Nigeria’s growing fintech ecosystem.

## Solution

Sentinel introduces a **hybrid AI fraud engine** that:

1. Listens to Squad payment webhooks in real time  
2. Extracts behavioral + transactional features  
3. Runs an Isolation Forest anomaly detection model per merchant  
4. Produces a trust score (0–100) with explainable reason codes  
5. Automatically triggers actions:
   - Approve (GREEN)
   - Flag for review (AMBER)
   - Block & refund (RED)

---

##  Key Features

###  Real-Time Fraud Scoring

- Sub-500ms inference pipeline  
- Event-driven webhook processing  
- Instant risk scoring per transaction  

### Machine Learning Engine

- Isolation Forest anomaly detection  
- Per-merchant behavioral learning  
- 8-dimensional feature vector analysis  
- Hybrid rule + ML scoring system  

###  Explainable AI

Each decision includes reason codes such as:

- HIGH_VELOCITY  
- AMOUNT_SPIKE  
- OFF_HOURS  
- NEW_DEVICE  
- ANOMALY_DETECTED  

###  Automated Response System

| Risk Score | Tier  | Action                 |
|------------|-------|------------------------|
| 0–30       | GREEN | Approve transaction    |
| 31–70      | AMBER | Flag for review        |
| 71–100     | RED   | Block + trigger refund |

###  Merchant Dashboard

- Live transaction feed (Socket.io)  
- Risk score visualization (Chart.js)  
- Fraud alerts in real time  
- Manual override controls  
- Dispute tracking panel  

###  Dispute Intelligence Layer

- Enriches Squad disputes with AI-generated fraud evidence  
- Auto-submission of risk reports  
- Supports chargeback defense workflows  

---

##  System Architecture

Sentinel follows a **hybrid microservice architecture**:

### Core Components

**Node.js (Express)**  
- Webhook ingestion  
- API orchestration  
- Real-time event broadcasting  

**Python (FastAPI) ML Service**  
- Isolation Forest inference engine  
- Feature engineering pipeline  
- Model training & retraining  

**Socket.io**  
- Real-time dashboard updates  

**Database**  
- Transaction storage  
- Merchant behavior history  

---

## Data Flow

1. Squad sends `charge_successful` webhook  
2. Node.js validates HMAC signature  
3. Feature extraction pipeline processes transaction  
4. ML service returns fraud risk score  
5. Response engine determines action tier  
6. Transaction stored + broadcast to dashboard  
7. High-risk transactions trigger refund or blocking logic  
8. Dispute system attaches AI evidence when needed  

---

##  Machine Learning Approach

### Model: Isolation Forest (Unsupervised)

Sentinel uses Isolation Forest to detect anomalies in transaction behavior without requiring labeled fraud data.

Why this works:

- Fraud patterns evolve constantly  
- Labeled fraud data is limited  
- Works well with behavioral outliers  
- Efficient for real-time inference  

This makes Sentinel adaptive, lightweight, and scalable for live payment environments.

---

## Why Sentinel Matters

Sentinel transforms fraud detection from a post-incident process into a real-time defense system.

It enables:

- Prevention instead of reaction  
- Instant merchant protection  
- Reduced financial loss  
- Smarter dispute handling  
- Accessible fraud intelligence for SMEs  

---

## Demo Flow

1. A customer initiates a payment on Squad
2. Sentinel instantly intercepts the webhook
3. AI engine evaluates behavioral risk in milliseconds
4. Fraud detected → dashboard flashes RED live
5. Transaction is automatically blocked or refunded
6. Merchant sees explanation of *why* it was flagged
7. System logs fraud evidence for dispute handling

---

## Summary

Sentinel is a real-time fraud intelligence layer that protects digital payments by combining machine learning, behavioral analytics, and automated decision systems.

It turns fraud detection into a proactive, explainable, and real-time experience.

## Squad API Integration

Sentinel integrates deeply with Squad APIs:

- Webhooks → Real-time transaction ingestion  
- Transaction Verify API → Cross-validation  
- Refund API → Automated fraud reversal  
- Disputes API → Chargeback intelligence layer  

---

## Project Structure

```bash
sentinel/
├── backend/
│   ├── server.js
│   ├── webhook/
│   │   └── receiver.js
│   ├── ai-engine/
│   │   ├── scorer.js
│   │   └── rules.js
│   ├── squad-client/
│   │   └── api.js
│   └── db/
│       └── database.js
├── frontend/
│   ├── index.html
│   ├── style.css
│   └── script.js
├── demo/
│   └── simulate.js
├── .env
└── README.md
