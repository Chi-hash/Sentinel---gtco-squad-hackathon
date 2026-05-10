import json
import os
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.metrics import (accuracy_score, precision_score,
                             recall_score, f1_score, confusion_matrix)

# ── Paths ─────────────────────────────────────────────────────────────────────
BASE = os.path.dirname(os.path.abspath(__file__))
CSV_PATH   = os.path.join(BASE, "training_data.csv")
MODEL_PATH = os.path.join(BASE, "model.json")

FEATURES = ["amount", "hour", "is_first_time", "velocity", "bin_count", "amount_vs_avg"]

# ── 1. Load data ──────────────────────────────────────────────────────────────
print("Loading data...")
df = pd.read_csv(CSV_PATH)

X = df[FEATURES].values
y = df["label"].values          # 0 = normal, 1 = fraud (ground truth for evaluation)

print(f"  Rows: {len(df)}  |  Normal: {(y == 0).sum()}  |  Fraud: {(y == 1).sum()}")

# ── 2. Train Isolation Forest ─────────────────────────────────────────────────
# Isolation Forest is unsupervised — it learns what "normal" looks like and
# flags outliers, so we train on X only (no labels used during fitting).
print("\nTraining Isolation Forest...")
model = IsolationForest(contamination=0.2, random_state=42, n_estimators=100)
model.fit(X)

# ── 3. Evaluate ───────────────────────────────────────────────────────────────
# predict() returns -1 (anomaly) or +1 (normal).
# Convert to our convention: -1 → 1 (fraud), +1 → 0 (normal).
raw_preds = model.predict(X)
y_pred = np.where(raw_preds == -1, 1, 0)

acc  = round(accuracy_score(y, y_pred),  4)
prec = round(precision_score(y, y_pred, zero_division=0), 4)
rec  = round(recall_score(y, y_pred,    zero_division=0), 4)
f1   = round(f1_score(y, y_pred,        zero_division=0), 4)
cm   = confusion_matrix(y, y_pred)

print("\n--- Evaluation Results ---")
print(f"  Accuracy : {acc:.4f}")
print(f"  Precision: {prec:.4f}")
print(f"  Recall   : {rec:.4f}")
print(f"  F1 Score : {f1:.4f}")
print("\n  Confusion Matrix:")
print(f"               Predicted 0   Predicted 1")
print(f"  Actual 0     {cm[0][0]:<13} {cm[0][1]}")
print(f"  Actual 1     {cm[1][0]:<13} {cm[1][1]}")

# ── 4. Derive thresholds from anomaly scores ──────────────────────────────────
# score_samples() returns negative anomaly scores — more negative = more anomalous.
# We find the 20th and 40th percentile of fraud-sample scores to set risk thresholds
# (lower percentile = more extreme anomaly = high risk).
all_scores   = model.score_samples(X)
fraud_scores = all_scores[y == 1]

high_risk_threshold   = round(float(np.percentile(fraud_scores, 20)), 6)
medium_risk_threshold = round(float(np.percentile(fraud_scores, 40)), 6)

print(f"\n--- Anomaly Score Thresholds (from fraud samples) ---")
print(f"  High risk   (p20 of fraud): {high_risk_threshold}")
print(f"  Medium risk (p40 of fraud): {medium_risk_threshold}")

# ── 5. Compute feature weights (mean absolute deviation: fraud vs normal) ─────
# Higher deviation between fraud and normal distributions = more discriminating feature.
fraud_df  = df[df["label"] == 1][FEATURES]
normal_df = df[df["label"] == 0][FEATURES]

raw_weights = {}
for feat in FEATURES:
    deviation = abs(fraud_df[feat].mean() - normal_df[feat].mean())
    raw_weights[feat] = deviation

# Normalise to sum to 1.0 for readability
total = sum(raw_weights.values())
feature_weights = {k: round(v / total, 6) for k, v in raw_weights.items()}

print("\n--- Feature Weights (normalised MAD: fraud vs normal) ---")
for feat, weight in sorted(feature_weights.items(), key=lambda x: -x[1]):
    bar = "#" * int(weight * 40)
    print(f"  {feat:<16} {weight:.4f}  {bar}")

# ── 6. Build and save model.json ──────────────────────────────────────────────
model_meta = {
    "features":      FEATURES,
    "contamination": 0.2,
    "accuracy":      acc,
    "precision":     prec,
    "recall":        rec,
    "f1":            f1,
    "thresholds": {
        "high_risk_score":   high_risk_threshold,
        "medium_risk_score": medium_risk_threshold,
    },
    "feature_weights": feature_weights,
    "trained_on":   int(len(df)),
    "fraud_cases":  int((y == 1).sum()),
    "normal_cases": int((y == 0).sum()),
}

with open(MODEL_PATH, "w") as f:
    json.dump(model_meta, f, indent=2)

print(f"\nDone. model.json saved -> {MODEL_PATH}")
