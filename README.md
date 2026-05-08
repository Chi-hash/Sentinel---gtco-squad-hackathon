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

Sentinel does not rely on labelled fraud data. Instead, it learns normal transaction behavior and detects anomalies.

### Features Used:

- Transaction amount normalization  
- Hour of day patterns  
- Transaction velocity (1hr / 24hr)  
- Device fingerprint changes  
- Payment channel behavior  
- Customer historical averages  

### Output:

- Trust Score (0–100)  
- Fraud Tier (GREEN / AMBER / RED)  
- Explainable Reason Codes  

---

## Squad API Integration

Sentinel integrates deeply with Squad APIs:

- Webhooks → Real-time transaction ingestion  
- Transaction Verify API → Cross-validation  
- Refund API → Automated fraud reversal  
- Disputes API → Chargeback intelligence layer  

---

## Project Structure

```bash
sentinel-fraud-detector/
├── backend/
│   ├── server.js
│   ├── webhook/
│   ├── ai-engine/
│   ├── squad-client/
│   ├── db/
│   └── routes/
├── ml-service/
│   └── model_service.py
├── frontend/
│   ├── index.html
│   ├── style.css
│   └── script.js
├── demo/
│   └── simulate.js
└── README.md
