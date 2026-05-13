import json
import os
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest, RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LinearRegression
from sklearn.metrics import (accuracy_score, precision_score,
                             recall_score, f1_score, confusion_matrix)

BASE       = os.path.dirname(os.path.abspath(__file__))
CSV_PATH   = os.path.join(BASE, "training_data.csv")
MODEL_PATH = os.path.join(BASE, "model.json")

FEATURES = ["amount", "hour", "is_first_time", "velocity", "bin_count", "amount_vs_avg"]

# ── 1. Load data ───────────────────────────────────────────────────────────────
print("Loading data...")
df = pd.read_csv(CSV_PATH)
X  = df[FEATURES].values
y  = df["label"].values
print(f"  Rows: {len(df)}  |  Normal: {(y==0).sum()}  |  Fraud: {(y==1).sum()}")

# ── 2. StandardScaler ─────────────────────────────────────────────────────────
print("\nFitting StandardScaler...")
scaler   = StandardScaler()
X_scaled = scaler.fit_transform(X)

scaler_mean = scaler.mean_.tolist()
scaler_std  = scaler.scale_.tolist()

# ── 3. Isolation Forest ───────────────────────────────────────────────────────
print("Training Isolation Forest...")
iso = IsolationForest(contamination=0.2, random_state=42, n_estimators=200)
iso.fit(X_scaled)

raw_preds  = iso.predict(X_scaled)
y_pred_iso = np.where(raw_preds == -1, 1, 0)

acc_iso  = round(float(accuracy_score(y, y_pred_iso)),  4)
prec_iso = round(float(precision_score(y, y_pred_iso, zero_division=0)), 4)
rec_iso  = round(float(recall_score(y, y_pred_iso,    zero_division=0)), 4)
f1_iso   = round(float(f1_score(y, y_pred_iso,        zero_division=0)), 4)
cm_iso   = confusion_matrix(y, y_pred_iso)

print(f"  IF  — Accuracy:{acc_iso}  Precision:{prec_iso}  Recall:{rec_iso}  F1:{f1_iso}")
print(f"  Confusion Matrix: {cm_iso.tolist()}")

# ── 4. Random Forest ──────────────────────────────────────────────────────────
print("Training Random Forest...")
rf = RandomForestClassifier(n_estimators=200, random_state=42, class_weight='balanced')
rf.fit(X_scaled, y)

y_pred_rf = rf.predict(X_scaled)
acc_rf  = round(float(accuracy_score(y, y_pred_rf)),  4)
prec_rf = round(float(precision_score(y, y_pred_rf, zero_division=0)), 4)
rec_rf  = round(float(recall_score(y, y_pred_rf,    zero_division=0)), 4)
f1_rf   = round(float(f1_score(y, y_pred_rf,        zero_division=0)), 4)
cm_rf   = confusion_matrix(y, y_pred_rf)

rf_importances = {f: round(float(rf.feature_importances_[i]), 6) for i, f in enumerate(FEATURES)}

print(f"  RF  — Accuracy:{acc_rf}  Precision:{prec_rf}  Recall:{rec_rf}  F1:{f1_rf}")
print(f"  Confusion Matrix: {cm_rf.tolist()}")
print("\n  RF Feature Importances:")
for feat, imp in sorted(rf_importances.items(), key=lambda x: -x[1]):
    print(f"    {feat:<16} {imp:.4f}  {'#' * int(imp * 50)}")

# ── 5. Probability Calibration ────────────────────────────────────────────────
# This is the key upgrade: instead of coarse 0/10/20 point buckets,
# we calibrate a continuous fraud probability for use at runtime in Node.js.
#
# Method:
#   a) Compute the same normalised weighted-sum score Node.js would compute
#      (scaled features × RF importances, normalised to 0–1)
#   b) Compute RF predict_proba (actual fraud probability, 0–1) for each sample
#   c) Fit a polynomial regression: prob = f(normalised_score)
#   d) Export the polynomial coefficients → Node.js evaluates them instantly
#
# This means Stage 3 now produces a REAL fraud probability derived from the
# trained RF, not a heuristic threshold. No Python needed at runtime.

print("\nFitting probability calibration (poly regression)...")

# Replicate Node.js normalised score computation on training data
max_weighted = sum(3.0 * rf_importances.get(f, 0) for f in FEATURES) or 1.0

normalised_scores = []
for row in X_scaled:
    raw = sum(row[i] * rf_importances.get(f, 0) for i, f in enumerate(FEATURES))
    normalised_scores.append(max(0.0, raw / max_weighted))

normalised_scores = np.array(normalised_scores)
rf_fraud_probs    = rf.predict_proba(X_scaled)[:, 1]  # actual fraud probability

# Fit degree-2 polynomial: prob ≈ a*x^2 + b*x + c
poly_features = np.column_stack([normalised_scores**2, normalised_scores, np.ones(len(normalised_scores))])
calibrator = LinearRegression(fit_intercept=False)
calibrator.fit(poly_features, rf_fraud_probs)

a, b, c = calibrator.coef_
print(f"  Calibration polynomial: {a:.6f}*x^2 + {b:.6f}*x + {c:.6f}")

# Validate: check correlation between calibrated prob and actual RF prob
calibrated_probs = np.clip(a * normalised_scores**2 + b * normalised_scores + c, 0, 1)
correlation = np.corrcoef(calibrated_probs, rf_fraud_probs)[0, 1]
print(f"  Calibration-RF correlation: {correlation:.4f} (higher is better, 1.0 = perfect)")

# ── 6. Isolation Forest anomaly thresholds ────────────────────────────────────
all_scores   = iso.score_samples(X_scaled)
fraud_scores = all_scores[y == 1]

high_risk_threshold   = round(float(np.percentile(fraud_scores, 20)), 6)
medium_risk_threshold = round(float(np.percentile(fraud_scores, 40)), 6)

# ── 7. MAD-based feature weights (on scaled data, as fallback) ────────────────
fraud_df  = pd.DataFrame(X_scaled[y == 1], columns=FEATURES)
normal_df = pd.DataFrame(X_scaled[y == 0], columns=FEATURES)

raw_weights = {f: abs(fraud_df[f].mean() - normal_df[f].mean()) for f in FEATURES}
total = sum(raw_weights.values()) or 1
feature_weights = {k: round(v / total, 6) for k, v in raw_weights.items()}

# ── 8. Save model.json ────────────────────────────────────────────────────────
model_meta = {
    "features":     FEATURES,
    "contamination": 0.2,
    "trained_on":   int(len(df)),
    "fraud_cases":  int((y == 1).sum()),
    "normal_cases": int((y == 0).sum()),

    # StandardScaler params — Node.js applies (value - mean) / std
    "scaler": {
        "mean": {f: round(scaler_mean[i], 4) for i, f in enumerate(FEATURES)},
        "std":  {f: round(scaler_std[i],  4) for i, f in enumerate(FEATURES)},
    },

    # ── Probability calibration — the key upgrade ──────────────────────────
    # Node.js computes: normalised = weighted_sum(scaled_features) / max_weighted
    # Then: fraud_prob = clip(a*normalised^2 + b*normalised + c, 0, 1)
    # Then: stage3Score = round(fraud_prob * 20)   ← continuous 0–20
    # This replaces the old 0/10/20 bucket logic.
    "probability_calibration": {
        "poly_a": round(float(a), 6),
        "poly_b": round(float(b), 6),
        "poly_c": round(float(c), 6),
        "max_weighted_score": round(max_weighted, 6),
        "calibration_correlation": round(float(correlation), 4),
    },

    # Isolation Forest
    "isolation_forest": {
        "accuracy":  acc_iso,
        "precision": prec_iso,
        "recall":    rec_iso,
        "f1":        f1_iso,
        "confusion_matrix": cm_iso.tolist(),
        "thresholds": {
            "high_risk_score":   high_risk_threshold,
            "medium_risk_score": medium_risk_threshold,
        },
        "feature_weights": feature_weights,
    },

    # Random Forest
    "random_forest": {
        "accuracy":            acc_rf,
        "precision":           prec_rf,
        "recall":              rec_rf,
        "f1":                  f1_rf,
        "confusion_matrix":    cm_rf.tolist(),
        "feature_importances": rf_importances,
    },

    # Top-level convenience (backward compat with existing Node.js code)
    "accuracy":        acc_iso,
    "precision":       prec_iso,
    "recall":          rec_iso,
    "f1":              f1_iso,
    "thresholds": {
        "high_risk_score":   high_risk_threshold,
        "medium_risk_score": medium_risk_threshold,
    },
    "feature_weights": feature_weights,
}

with open(MODEL_PATH, "w") as f:
    json.dump(model_meta, f, indent=2)

print(f"\nDone. model.json saved -> {MODEL_PATH}")
print(f"\nKey numbers to present:")
print(f"  Isolation Forest F1   : {f1_iso}  (cite this to judges)")
print(f"  Random Forest F1      : {f1_rf}  (on training data)")
print(f"  Calibration correlation: {correlation:.4f}")
print(f"  Stage 3 is now continuous 0–20 (was 0/10/20 buckets)")
