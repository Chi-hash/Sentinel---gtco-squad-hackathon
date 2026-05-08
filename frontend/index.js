const S = {
  total: 142,
  flagged: 8,
  blocked: 3,
  saved: 285000,
  transactions: [],
  disputes: [],
  demoMode: true,
  demoTimer: null,
};

const SEED = [
  {
    ref: "SQT-8821",
    time: "14:38:12",
    amount: 420000,
    email: "f***@gmail.com",
    score: 91,
    tier: "RED",
    codes: ["HIGH_VELOCITY", "OFF_HOURS"],
    status: "blocked",
    model_trained: true,
    features: { amount_vs_avg: 4.2, velocity_1hr: 4, hour_of_day: 2 },
  },
  {
    ref: "SQT-8820",
    time: "14:37:55",
    amount: 15500,
    email: "n***@yahoo.com",
    score: 58,
    tier: "AMBER",
    codes: ["AMOUNT_SPIKE"],
    status: "flagged",
    model_trained: true,
    features: { amount_vs_avg: 2.1, velocity_1hr: 1, hour_of_day: 14 },
  },
  {
    ref: "SQT-8819",
    time: "14:37:20",
    amount: 8200,
    email: "k***@hotmail.com",
    score: 12,
    tier: "GREEN",
    codes: [],
    status: "approved",
    model_trained: true,
    features: { amount_vs_avg: 0.8, velocity_1hr: 0, hour_of_day: 14 },
  },
  {
    ref: "SQT-8818",
    time: "14:36:40",
    amount: 210000,
    email: "x***@gmail.com",
    score: 87,
    tier: "RED",
    codes: ["HIGH_VELOCITY", "OFF_HOURS", "AMOUNT_SPIKE"],
    status: "blocked",
    model_trained: false,
    features: { amount_vs_avg: 5.1, velocity_1hr: 5, hour_of_day: 3 },
  },
  {
    ref: "SQT-8817",
    time: "14:35:10",
    amount: 5000,
    email: "j***@gmail.com",
    score: 22,
    tier: "GREEN",
    codes: [],
    status: "approved",
    model_trained: true,
    features: { amount_vs_avg: 0.5, velocity_1hr: 0, hour_of_day: 11 },
  },
  {
    ref: "SQT-8816",
    time: "14:34:50",
    amount: 75000,
    email: "m***@live.com",
    score: 45,
    tier: "AMBER",
    codes: ["NEW_DEVICE"],
    status: "flagged",
    model_trained: true,
    features: { amount_vs_avg: 1.8, velocity_1hr: 1, hour_of_day: 13 },
  },
  {
    ref: "SQT-8815",
    time: "14:33:20",
    amount: 12000,
    email: "a***@gmail.com",
    score: 18,
    tier: "GREEN",
    codes: [],
    status: "approved",
    model_trained: true,
    features: { amount_vs_avg: 1.0, velocity_1hr: 0, hour_of_day: 13 },
  },
  {
    ref: "SQT-8814",
    time: "14:32:05",
    amount: 340000,
    email: "q***@yahoo.com",
    score: 79,
    tier: "RED",
    codes: ["ANOMALY_DETECTED"],
    status: "blocked",
    model_trained: true,
    features: { amount_vs_avg: 3.8, velocity_1hr: 2, hour_of_day: 1 },
  },
];

const SEED_DISPUTES = [
  {
    id: "DSP-001",
    ref: "SQT-8821",
    amount: 420000,
    reason: "Unauthorized transaction",
    score: 91,
    status: "open",
  },
  {
    id: "DSP-002",
    ref: "SQT-8818",
    amount: 210000,
    reason: "Item not received",
    score: 87,
    status: "open",
  },
];

const REASON_DESC = {
  HIGH_VELOCITY: "4 transactions in 5 min",
  OFF_HOURS: "Placed 1AM–5AM",
  AMOUNT_SPIKE: "4× above customer avg",
  NEW_DEVICE: "Unrecognised device",
  GEO_MISMATCH: "Billing ≠ IP country",
  ANOMALY_DETECTED: "ML model anomaly flag",
};

// ── BOOT ──────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  S.transactions = [...SEED];
  S.disputes = [...SEED_DISPUTES];
  renderFeed();
  renderDisputes();
  syncKPIs();
  buildChart();
  initSocket();
  startDemo();
});

// ── UTILS ─────────────────────────────────────────
const money = (n) => "₦" + Number(n).toLocaleString();
const scoreCol = (s) =>
  s < 31 ? "var(--jade)" : s < 71 ? "var(--amber)" : "var(--crimson)";
const tierPill = (t) =>
  t === "GREEN" ? "pill-green" : t === "AMBER" ? "pill-amber" : "pill-red";
const rowCls = (t) =>
  t === "GREEN" ? "row-green" : t === "AMBER" ? "row-amber" : "row-red";
function nowTime() {
  return new Date().toTimeString().slice(0, 8);
}

// ── FEED ──────────────────────────────────────────
function renderFeed() {
  document.getElementById("txn-body").innerHTML = S.transactions
    .slice(0, 50)
    .map((t) => row(t, false))
    .join("");
  document.getElementById("feed-meta").textContent =
    `Showing ${Math.min(S.transactions.length, 50)} transactions`;
}

function row(t, anim) {
  const codes = t.codes.length
    ? t.codes.map((c) => `<span class="sig-tag">${c}</span>`).join("")
    : `<span style="color:var(--text-3);font-family:var(--font-mono);font-size:10px">—</span>`;

  const status =
    t.status === "approved"
      ? `<span class="st-approved">● APPROVED</span>`
      : t.status === "flagged"
        ? `<span class="st-flagged">◆ FLAGGED</span>`
        : `<span class="st-blocked">■ BLOCKED</span>`;

  const action =
    t.tier === "AMBER" && t.status === "flagged"
      ? `<button class="tbl-btn tbl-review" onclick="event.stopPropagation();openModal('${t.ref}')">REVIEW</button>`
      : "";

  return `<tr class="${rowCls(t.tier)} ${anim ? "slide-in" : ""}" onclick="openModal('${t.ref}')">
    <td class="tc-time">${t.time}</td>
    <td class="tc-amount">${money(t.amount)}</td>
    <td class="tc-email">${t.email}</td>
    <td>
      <div class="score-block">
        <span class="score-val" style="color:${scoreCol(t.score)}">${t.score}</span>
        <div class="score-track"><div class="score-thumb" style="width:${t.score}%;background:${scoreCol(t.score)}"></div></div>
      </div>
    </td>
    <td><span class="tier-pill ${tierPill(t.tier)}">${t.tier}</span></td>
    <td>${codes}</td>
    <td class="tc-status">${status}</td>
    <td>${action}</td>
  </tr>`;
}

function pushTransaction(t) {
  S.transactions.unshift(t);
  S.total++;
  if (t.tier === "AMBER") {
    S.flagged++;
    bump("kpi-flagged-card", "kpi-flagged");
  }
  if (t.tier === "RED") {
    S.blocked++;
    bump("kpi-blocked-card", "kpi-blocked");
    S.saved += t.amount;
    bump("kpi-saved-card", "kpi-saved");
  }
  bump("kpi-total-card", "kpi-total");
  syncKPIs();
  nudgeChart(t.score);
  document.getElementById("last-time").textContent = t.time;

  const tbody = document.getElementById("txn-body");
  const tmp = document.createElement("tbody");
  tmp.innerHTML = row(t, true);
  tbody.insertBefore(tmp.firstChild, tbody.firstChild);
  if (tbody.rows.length > 50) tbody.deleteRow(tbody.rows.length - 1);

  toast(t);
}

// ── KPIs ──────────────────────────────────────────
function syncKPIs() {
  document.getElementById("kpi-total").textContent = S.total;
  document.getElementById("kpi-flagged").textContent = S.flagged;
  document.getElementById("kpi-blocked").textContent = S.blocked;
  document.getElementById("kpi-saved").textContent =
    "₦" + Math.round(S.saved / 1000) + "k";
  // Update bar widths
  const pct = (v) => Math.min(100, (v / 200) * 100);
  document.querySelector(".teal-fill").style.width = pct(S.total) + "%";
  document.querySelector(".amber-fill").style.width =
    Math.min(100, (S.flagged / 20) * 100) + "%";
  document.querySelector(".crimson-fill").style.width =
    Math.min(100, (S.blocked / 10) * 100) + "%";
  document.querySelector(".jade-fill").style.width =
    Math.min(100, (S.saved / 500000) * 100) + "%";
}
function bump(cardId, numId) {
  const card = document.getElementById(cardId);
  const num = document.getElementById(numId);
  card.classList.remove("kpi-bump");
  void card.offsetWidth;
  card.classList.add("kpi-bump");
}

// ── TOAST ─────────────────────────────────────────
function toast(t) {
  const wrap = document.getElementById("toasts");
  const el = document.createElement("div");
  const cls =
    t.tier === "RED"
      ? "toast-red"
      : t.tier === "AMBER"
        ? "toast-amber"
        : "toast-green";
  const icon = t.tier === "RED" ? "🚫" : t.tier === "AMBER" ? "⚠️" : "✅";
  const lbl =
    t.tier === "RED" ? "BLOCKED" : t.tier === "AMBER" ? "FLAGGED" : "APPROVED";
  el.className = `toast ${cls}`;
  el.innerHTML = `
    <span class="toast-icon">${icon}</span>
    <div class="toast-msg">
      <strong>${lbl} — ${money(t.amount)}</strong>
      ${t.email}
    </div>`;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), t.tier === "RED" ? 5500 : 3000);
}

// ── MODAL ─────────────────────────────────────────
function openModal(ref) {
  const t = S.transactions.find((x) => x.ref === ref);
  if (!t) return;

  const col = scoreCol(t.score);
  const modelTag = t.model_trained
    ? `<span class="model-tag on">● AI MODEL ACTIVE</span>`
    : `<span class="model-tag off">◌ LEARNING MODE</span>`;

  const reasons = t.codes.length
    ? t.codes
        .map(
          (c) => `
        <div class="reason-row">
          <span class="reason-code" style="color:${col}">${c}</span>
          <span class="reason-desc">${REASON_DESC[c] || "Triggered risk signal"}</span>
        </div>`,
        )
        .join("")
    : `<div style="color:var(--jade);font-family:var(--font-mono);font-size:11px;padding:6px 0">No risk signals triggered</div>`;

  const feats = t.features
    ? Object.entries(t.features)
        .map(([k, v]) => {
          const fv = parseFloat(v);
          const fc =
            fv > 2 ? "var(--crimson)" : fv > 1 ? "var(--amber)" : "var(--jade)";
          return `<div class="feat-row"><span class="feat-key">${k}</span><span class="feat-val" style="color:${fc}">${v}</span></div>`;
        })
        .join("")
    : "";

  const actions =
    t.tier === "GREEN"
      ? `<button class="modal-btn mb-close" onclick="closeModal()">CLOSE</button>`
      : t.tier === "AMBER"
        ? `<button class="modal-btn mb-approve" onclick="approveIt('${t.ref}')">✓ APPROVE</button>
       <button class="modal-btn mb-flag"    onclick="closeModal()">⚑ FLAG</button>
       <button class="modal-btn mb-close"   onclick="closeModal()">CLOSE</button>`
        : `<button class="modal-btn mb-refund"  onclick="closeModal()">↩ REFUND</button>
       <button class="modal-btn mb-dispute" onclick="disputeModal('${t.ref}')">⚖ FIGHT DISPUTE</button>
       <button class="modal-btn mb-close"   onclick="closeModal()">CLOSE</button>`;

  document.getElementById("modal-mount").innerHTML = `
    <div class="modal-overlay" onclick="closeModal()">
      <div class="modal" onclick="event.stopPropagation()">

        <div class="modal-top">
          <div>
            <div class="modal-ref-label">Transaction Reference</div>
            <div class="modal-ref-val">${t.ref}</div>
          </div>
          <button class="modal-x" onclick="closeModal()">✕</button>
        </div>

        <div class="modal-body">

          <div>
            <div class="modal-section-label">Basic Info</div>
            <div class="info-2col">
              <div class="info-box"><div class="info-box-label">Amount</div><div class="info-box-val">${money(t.amount)}</div></div>
              <div class="info-box"><div class="info-box-label">Time</div><div class="info-box-val">${t.time}</div></div>
              <div class="info-box"><div class="info-box-label">Customer</div><div class="info-box-val">${t.email}</div></div>
              <div class="info-box"><div class="info-box-label">Status</div><div class="info-box-val">${t.status.toUpperCase()}</div></div>
            </div>
          </div>

          <div>
            <div class="modal-section-label">AI Trust Score</div>
            <div class="gauge-row">
              <div class="gauge" style="border-color:${col}">
                <span class="gauge-score" style="color:${col}">${t.score}</span>
              </div>
              <div class="gauge-right">
                <div class="gauge-tier-row">
                  <span class="tier-pill ${tierPill(t.tier)}">${t.tier}</span>
                  ${modelTag}
                </div>
                <div class="gauge-desc">
                  ${
                    t.tier === "GREEN"
                      ? "Low risk — safe to process immediately."
                      : t.tier === "AMBER"
                        ? "Medium risk — manual review recommended before fulfillment."
                        : "High risk — transaction blocked automatically by Sentinel."
                  }
                </div>
              </div>
            </div>
          </div>

          <div>
            <div class="modal-section-label">Risk Signals</div>
            ${reasons}
          </div>

          ${feats ? `<div><div class="modal-section-label">Feature Deviations</div>${feats}</div>` : ""}

          <div>
            <div class="modal-section-label">Raw Payload</div>
            <div class="raw-block">${JSON.stringify(t, null, 2)}</div>
          </div>

        </div>
        <div class="modal-actions">${actions}</div>
      </div>
    </div>`;
}

function closeModal() {
  document.getElementById("modal-mount").innerHTML = "";
}

function approveIt(ref) {
  const t = S.transactions.find((x) => x.ref === ref);
  if (t) {
    t.status = "approved";
    t.tier = "GREEN";
    S.flagged = Math.max(0, S.flagged - 1);
  }
  closeModal();
  renderFeed();
  const el = document.createElement("div");
  el.className = "toast toast-green";
  el.innerHTML = `<span class="toast-icon">✅</span><div class="toast-msg"><strong>APPROVED</strong>Transaction approved manually</div>`;
  document.getElementById("toasts").appendChild(el);
  setTimeout(() => el.remove(), 2500);
}

// ── DISPUTE MODAL ─────────────────────────────────
function disputeModal(ref) {
  const t = S.transactions.find((x) => x.ref === ref);
  if (!t) return;
  closeModal();
  document.getElementById("modal-mount").innerHTML = `
    <div class="modal-overlay" onclick="closeModal()">
      <div class="modal" onclick="event.stopPropagation()">
        <div class="modal-top">
          <div>
            <div class="modal-ref-label">Fight Dispute</div>
            <div class="modal-ref-val">${ref}</div>
          </div>
          <button class="modal-x" onclick="closeModal()">✕</button>
        </div>
        <div class="modal-body">
          <div class="evidence-box">
            <div class="evidence-box-title">■ Sentinel AI Evidence Package</div>
            <div class="evidence-box-body">
              Trust Score: <strong style="color:var(--crimson)">${t.score}/100 — HIGH RISK</strong><br/>
              Signals: <strong>${t.codes.join(" + ") || "ANOMALY_DETECTED"}</strong><br/>
              Model: <strong>${t.model_trained ? "Isolation Forest (trained)" : "Heuristic fallback"}</strong><br/>
              Amount Deviation: <strong>${t.features?.amount_vs_avg ?? "—"}× above customer avg</strong>
            </div>
          </div>
          <div style="font-size:11px;color:var(--text-3);line-height:1.6">
            This evidence bundle will be submitted to Squad's Disputes API. Sentinel's ML analysis serves as technical proof that this transaction was flagged as high-risk before any fulfillment occurred.
          </div>
        </div>
        <div class="modal-actions">
          <button class="modal-btn mb-dispute" onclick="submitEvidence('${ref}')">⚖ SUBMIT TO SQUAD API</button>
          <button class="modal-btn mb-close"   onclick="closeModal()">CANCEL</button>
        </div>
      </div>
    </div>`;
}

function submitEvidence(ref) {
  const d = S.disputes.find((x) => x.ref === ref);
  if (d) d.status = "submitted";
  closeModal();
  renderDisputes();
  const el = document.createElement("div");
  el.className = "toast toast-green";
  el.innerHTML = `<span class="toast-icon">✅</span><div class="toast-msg"><strong>SUBMITTED</strong>Evidence sent to Squad Disputes API</div>`;
  document.getElementById("toasts").appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ── DISPUTES ──────────────────────────────────────
function renderDisputes() {
  document.getElementById("disputes-tbody").innerHTML = S.disputes
    .map(
      (d) => `
    <tr style="border-bottom:1px solid var(--line);cursor:default">
      <td class="tc-time">${d.id}</td>
      <td class="tc-time">${d.ref}</td>
      <td class="tc-amount">${money(d.amount)}</td>
      <td style="color:var(--text-2);font-size:11px">${d.reason}</td>
      <td><span class="score-val" style="color:var(--crimson);font-family:var(--font-mono)">${d.score}</span></td>
      <td><span class="tier-pill ${d.status === "open" ? "pill-red" : "pill-green"}">${d.status === "open" ? "OPEN" : "SUBMITTED"}</span></td>
      <td>${
        d.status === "open"
          ? `<button class="tbl-btn tbl-fight" onclick="disputeModal('${d.ref}')">FIGHT</button>`
          : `<span style="color:var(--jade);font-family:var(--font-mono);font-size:10px">● SENT</span>`
      }</td>
    </tr>`,
    )
    .join("");
  document.getElementById("open-badge").textContent =
    S.disputes.filter((d) => d.status === "open").length + " open";
}

function toggleDisputes() {
  const body = document.getElementById("disputes-body");
  const chev = document.getElementById("disputes-chevron");
  const hidden = body.style.display === "none";
  body.style.display = hidden ? "" : "none";
  chev.classList.toggle("up", hidden);
}

// ── CHART ─────────────────────────────────────────
let chart;
const chartData = [
  18, 22, 15, 20, 35, 42, 28, 19, 30, 45, 38, 52, 48, 55, 40, 35, 62, 78, 55,
  45, 38, 30, 25, 20,
];
const chartLabels = Array.from({ length: 24 }, (_, i) => `${i}h`);

function buildChart() {
  const ctx = document.getElementById("trendChart").getContext("2d");
  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: chartLabels,
      datasets: [
        {
          data: chartData,
          borderColor: "rgba(0,212,180,0.6)",
          backgroundColor: (ctx) => {
            const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, 100);
            g.addColorStop(0, "rgba(0,212,180,0.12)");
            g.addColorStop(1, "rgba(0,212,180,0)");
            return g;
          },
          pointBackgroundColor: chartData.map((s) =>
            s < 31 ? "#2ed573" : s < 71 ? "#f0a500" : "#ff4757",
          ),
          pointRadius: 3,
          pointHoverRadius: 5,
          tension: 0.45,
          fill: true,
          borderWidth: 1.5,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#1a1a1d",
          borderColor: "#2a2a2f",
          borderWidth: 1,
          titleColor: "#52525e",
          bodyColor: "#f0f0f2",
          titleFont: { family: "'DM Mono', monospace", size: 9 },
          bodyFont: { family: "'DM Mono', monospace", size: 11 },
          callbacks: { title: () => "", label: (c) => `score: ${c.parsed.y}` },
        },
      },
      scales: {
        x: {
          ticks: {
            color: "#52525e",
            font: { size: 9, family: "'DM Mono', monospace" },
          },
          grid: { color: "rgba(42,42,47,0.6)" },
          border: { display: false },
        },
        y: {
          min: 0,
          max: 100,
          ticks: {
            color: "#52525e",
            font: { size: 9, family: "'DM Mono', monospace" },
            stepSize: 25,
          },
          grid: { color: "rgba(42,42,47,0.6)" },
          border: { display: false },
        },
      },
    },
  });
}

function nudgeChart(score) {
  chart.data.datasets[0].data.push(score);
  chart.data.datasets[0].data.shift();
  chart.data.datasets[0].pointBackgroundColor = chart.data.datasets[0].data.map(
    (s) => (s < 31 ? "#2ed573" : s < 71 ? "#f0a500" : "#ff4757"),
  );
  chart.update("none");
}

// ── SOCKET ─────────────────────────────────────────
function initSocket() {
  // When backend is ready, uncomment:
  /*
  const socket = io('http://localhost:3000');
  socket.on('connect',    () => { document.getElementById('conn-dot').className='conn-dot live'; document.getElementById('conn-label').textContent='Live'; });
  socket.on('disconnect', () => { document.getElementById('conn-dot').className='conn-dot error'; document.getElementById('conn-label').textContent='Disconnected'; });
  socket.on('new_transaction', pushTransaction);
  */
}

// ── DEMO ──────────────────────────────────────────
function startDemo() {
  S.demoTimer = setInterval(() => {
    const r = Math.random();
    if (r < 0.18) simulateRed();
    else if (r < 0.45) simulateAmber();
    else simulateGreen();
  }, 4000);
}
function toggleDemo() {
  S.demoMode = !S.demoMode;
  const ribbon = document.getElementById("demo-ribbon");
  const btn = document.getElementById("demo-btn");
  if (S.demoMode) {
    startDemo();
    ribbon.style.display = "flex";
    btn.textContent = "Disable";
  } else {
    clearInterval(S.demoTimer);
    ribbon.style.display = "none";
  }
}
// ── SETTINGS ──────────────────────────────────────
function toggleSettings() {
  document.getElementById("drawer").classList.toggle("open");
  document.getElementById("drawer-overlay").classList.toggle("on");
}
