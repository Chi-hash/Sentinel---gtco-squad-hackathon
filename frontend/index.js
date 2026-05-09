/* ══════════════════════════════════════════════════
   SENTINEL — app.js  v2
══════════════════════════════════════════════════ */

const S = {
  total: 142,
  flagged: 8,
  blocked: 3,
  saved: 285000,
  transactions: [],
  disputes: [],
  demoMode: true,
  demoTimer: null,
  sidebarOpen: true,
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

const SEED_DSP = [
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

const RSN = {
  HIGH_VELOCITY: "4 transactions in 5 min",
  OFF_HOURS: "Placed 1AM–5AM",
  AMOUNT_SPIKE: "4× above customer avg",
  NEW_DEVICE: "Unrecognised device",
  GEO_MISMATCH: "Billing ≠ IP country",
  ANOMALY_DETECTED: "ML model anomaly flag",
};

// ── BOOT ─────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  S.transactions = [...SEED];
  S.disputes = [...SEED_DSP];
  renderFeed();
  renderDisputes();
  syncKPIs();
  buildChart();
  initSocket();
  startDemo();
});

// ── SIDEBAR TOGGLE ────────────────────────────────
function toggleSidebar() {
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("mob-overlay");
  const isMobile = window.innerWidth <= 768;

  if (isMobile) {
    const isOpen = sidebar.classList.contains("mobile-open");
    sidebar.classList.toggle("mobile-open", !isOpen);
    sidebar.classList.toggle("collapsed", isOpen);
    overlay.classList.toggle("on", !isOpen);
  } else {
    S.sidebarOpen = !S.sidebarOpen;
    sidebar.classList.toggle("collapsed", !S.sidebarOpen);
  }
  // Resize chart after transition
  setTimeout(() => {
    if (chart) chart.resize();
  }, 320);
}

// ── UTILS ─────────────────────────────────────────
const money = (n) => "₦" + (Number(n) / 100).toLocaleString();
const scCol = (s) =>
  s < 31 ? "var(--jade)" : s < 71 ? "var(--amber)" : "var(--crimson)";
const pillCls = (t) =>
  t === "GREEN" ? "pill-g" : t === "AMBER" ? "pill-a" : "pill-r";
const rowCls = (t) =>
  t === "GREEN" ? "row-g" : t === "AMBER" ? "row-a" : "row-r";
function nowTime() {
  return new Date().toTimeString().slice(0, 8);
}
function fmtTime(iso) {
  return iso ? new Date(iso).toLocaleTimeString("en-GB").slice(0, 8) : "—";
}

// ── FEED ──────────────────────────────────────────
function renderFeed() {
  document.getElementById("txn-body").innerHTML = S.transactions
    .slice(0, 50)
    .map((t) => buildRow(t, false))
    .join("");
  document.getElementById("feed-meta").textContent =
    `${Math.min(S.transactions.length, 50)} transactions`;
}

function buildRow(t, anim) {
  const _reasons = t.reasons || t.codes || [];
  const codes = _reasons.length
    ? _reasons.map((c) => `<span class="sig">${c}</span>`).join("")
    : `<span style="color:var(--t3);font-family:var(--ff-mono);font-size:10px">—</span>`;

  const _status = t.status || (t.tier === "GREEN" ? "approved" : t.tier === "AMBER" ? "flagged" : "blocked");
  const status =
    _status === "approved"
      ? `<span class="st-ok">● APPROVED</span>`
      : _status === "flagged"
        ? `<span class="st-fl">◆ FLAGGED</span>`
        : `<span class="st-blk">■ BLOCKED</span>`;

  const action =
    t.tier === "AMBER" && _status === "flagged"
      ? `<button class="tbl-btn tb-rv" onclick="event.stopPropagation();openModal('${t.ref}')">REVIEW</button>`
      : "";

  return `<tr class="${rowCls(t.tier)} ${anim ? "slide-in" : ""}" onclick="openModal('${t.ref}')">
    <td class="tc-time">${t.time || fmtTime(t.timestamp)}</td>
    <td class="tc-amt">${money(t.amount)}</td>
    <td class="tc-email">${t.email}</td>
    <td>
      <div class="sc-block">
        <span class="sc-val" style="color:${scCol(t.score)}">${t.score}</span>
        <div class="sc-track"><div class="sc-fill" style="width:${t.score}%;background:${scCol(t.score)}"></div></div>
      </div>
    </td>
    <td><span class="pill ${pillCls(t.tier)}">${t.tier}</span></td>
    <td>${codes}</td>
    <td>${status}</td>
    <td>${action}</td>
  </tr>`;
}

function pushTransaction(t) {
  S.transactions.unshift(t);
  S.total++;
  if (t.tier === "AMBER") {
    S.flagged++;
    bumpKPI("kpi-flagged-card", "kpi-flagged");
  }
  if (t.tier === "RED") {
    S.blocked++;
    bumpKPI("kpi-blocked-card", "kpi-blocked");
    S.saved += Math.round(t.amount / 100);
    bumpKPI("kpi-saved-card", "kpi-saved");
  }
  bumpKPI("kpi-total-card", "kpi-total");
  syncKPIs();
  nudgeChart(t.score);
  document.getElementById("last-time").textContent = t.time || fmtTime(t.timestamp);

  const tbody = document.getElementById("txn-body");
  const tmp = document.createElement("tbody");
  tmp.innerHTML = buildRow(t, true);
  tbody.insertBefore(tmp.firstChild, tbody.firstChild);
  if (tbody.rows.length > 50) tbody.deleteRow(tbody.rows.length - 1);
  document.getElementById("feed-meta").textContent =
    `${Math.min(S.transactions.length, 50)} transactions`;

  showToast(t);
}

// ── KPIs ──────────────────────────────────────────
function syncKPIs() {
  document.getElementById("kpi-total").textContent = S.total;
  document.getElementById("kpi-flagged").textContent = S.flagged;
  document.getElementById("kpi-blocked").textContent = S.blocked;
  document.getElementById("kpi-saved").textContent =
    "₦" + Math.round(S.saved / 1000) + "k";
  document.getElementById("bar-total").style.width =
    Math.min(100, (S.total / 200) * 100) + "%";
  document.getElementById("bar-flagged").style.width =
    Math.min(100, (S.flagged / 20) * 100) + "%";
  document.getElementById("bar-blocked").style.width =
    Math.min(100, (S.blocked / 10) * 100) + "%";
  document.getElementById("bar-saved").style.width =
    Math.min(100, (S.saved / 500000) * 100) + "%";
}

function bumpKPI(cardId, numId) {
  const card = document.getElementById(cardId);
  const num = document.getElementById(numId);
  card.classList.remove("kpi-bump");
  void card.offsetWidth;
  card.classList.add("kpi-bump");
}

// ── TOAST ─────────────────────────────────────────
function showToast(t) {
  const rack = document.getElementById("toasts");
  const el = document.createElement("div");
  const cls =
    t.tier === "RED" ? "toast-r" : t.tier === "AMBER" ? "toast-a" : "toast-g";
  const icon = t.tier === "RED" ? "🚫" : t.tier === "AMBER" ? "⚠️" : "✅";
  const lbl =
    t.tier === "RED" ? "BLOCKED" : t.tier === "AMBER" ? "FLAGGED" : "APPROVED";
  el.className = `toast ${cls}`;
  el.innerHTML = `<span class="t-icon">${icon}</span><div class="t-body"><strong>${lbl} — ${money(t.amount)}</strong>${t.email}</div>`;
  rack.appendChild(el);
  setTimeout(() => el.remove(), t.tier === "RED" ? 5500 : 3000);
}

// ── MODAL ─────────────────────────────────────────
function openModal(ref) {
  const t = S.transactions.find((x) => x.ref === ref);
  if (!t) return;
  const col = scCol(t.score);
  const mtag = t.model_trained !== false
    ? `<span class="m-tag on">● AI MODEL ACTIVE</span>`
    : `<span class="m-tag off">◌ LEARNING MODE</span>`;

  const _reasons = t.reasons || t.codes || [];
  const reasons = _reasons.length
    ? _reasons
        .map(
          (c) =>
            `<div class="rsn-row"><span class="rsn-code" style="color:${col}">${c}</span><span class="rsn-desc">${RSN[c] || "Risk signal triggered"}</span></div>`,
        )
        .join("")
    : `<div style="color:var(--jade);font-family:var(--ff-mono);font-size:11px;padding:6px 0">No risk signals</div>`;

  const feats = t.features
    ? Object.entries(t.features)
        .map(([k, v]) => {
          const fv = parseFloat(v),
            fc =
              fv > 2
                ? "var(--crimson)"
                : fv > 1
                  ? "var(--amber)"
                  : "var(--jade)";
          return `<div class="ft-row"><span class="ft-k">${k}</span><span class="ft-v" style="color:${fc}">${v}</span></div>`;
        })
        .join("")
    : "";

  const acts =
    t.tier === "GREEN"
      ? `<button class="mb mb-cl" onclick="closeModal()">CLOSE</button>`
      : t.tier === "AMBER"
        ? `<button class="mb mb-ok" onclick="approveIt('${t.ref}')">✓ APPROVE</button><button class="mb mb-fl" onclick="closeModal()">⚑ FLAG</button><button class="mb mb-cl" onclick="closeModal()">CLOSE</button>`
        : `<button class="mb mb-rf" onclick="closeModal()">↩ REFUND</button><button class="mb mb-dp" onclick="disputeModal('${t.ref}')">⚖ FIGHT DISPUTE</button><button class="mb mb-cl" onclick="closeModal()">CLOSE</button>`;

  document.getElementById("modal-mount").innerHTML = `
    <div class="modal-overlay" onclick="closeModal()">
      <div class="modal" onclick="event.stopPropagation()">
        <div class="modal-top">
          <div><div class="m-ref-lbl">Transaction Reference</div><div class="m-ref-val">${t.ref}</div></div>
          <button class="m-x" onclick="closeModal()">✕</button>
        </div>
        <div class="modal-body">
          <div><div class="m-sec-lbl">Basic Info</div>
            <div class="i2col">
              <div class="ibox"><div class="ibox-lbl">Amount</div><div class="ibox-val">${money(t.amount)}</div></div>
              <div class="ibox"><div class="ibox-lbl">Time</div><div class="ibox-val">${t.time || fmtTime(t.timestamp)}</div></div>
              <div class="ibox"><div class="ibox-lbl">Customer</div><div class="ibox-val">${t.email}</div></div>
              <div class="ibox"><div class="ibox-lbl">Status</div><div class="ibox-val">${(t.status || (t.tier === "GREEN" ? "approved" : t.tier === "AMBER" ? "flagged" : "blocked")).toUpperCase()}</div></div>
            </div></div>
          <div><div class="m-sec-lbl">AI Trust Score</div>
            <div class="gauge-row">
              <div class="gauge" style="border-color:${col}"><span class="gauge-sc" style="color:${col}">${t.score}</span></div>
              <div class="g-right">
                <div class="g-tier-row"><span class="pill ${pillCls(t.tier)}">${t.tier}</span>${mtag}</div>
                <div class="g-desc">${t.tier === "GREEN" ? "Low risk — safe to process." : t.tier === "AMBER" ? "Medium risk — review before fulfillment." : "High risk — automatically blocked."}</div>
              </div>
            </div></div>
          <div><div class="m-sec-lbl">Risk Signals</div>${reasons}</div>
          ${feats ? `<div><div class="m-sec-lbl">Feature Deviations</div>${feats}</div>` : ""}
          <div><div class="m-sec-lbl">Raw Payload</div><div class="raw">${JSON.stringify(t, null, 2)}</div></div>
        </div>
        <div class="modal-acts">${acts}</div>
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
  el.className = "toast toast-g";
  el.innerHTML = `<span class="t-icon">✅</span><div class="t-body"><strong>APPROVED</strong>Transaction approved manually</div>`;
  document.getElementById("toasts").appendChild(el);
  setTimeout(() => el.remove(), 2500);
}

function disputeModal(ref) {
  const t = S.transactions.find((x) => x.ref === ref);
  if (!t) return;
  closeModal();
  document.getElementById("modal-mount").innerHTML = `
    <div class="modal-overlay" onclick="closeModal()">
      <div class="modal" onclick="event.stopPropagation()">
        <div class="modal-top">
          <div><div class="m-ref-lbl">Fight Dispute</div><div class="m-ref-val">${ref}</div></div>
          <button class="m-x" onclick="closeModal()">✕</button>
        </div>
        <div class="modal-body">
          <div class="evid-box">
            <div class="evid-ttl">■ Sentinel AI Evidence Package</div>
            <div class="evid-body">
              Trust Score: <strong style="color:var(--crimson)">${t.score}/100 — HIGH RISK</strong><br/>
              Signals: <strong>${(t.reasons || t.codes || []).join(" + ") || "ANOMALY_DETECTED"}</strong><br/>
              Model: <strong>${t.model_trained !== false ? "Rule Engine + Z-Score" : "Heuristic fallback"}</strong><br/>
              Deviation: <strong>${t.features?.amount_vs_avg ?? "—"}× above customer avg</strong>
            </div>
          </div>
          <div style="font-size:11px;color:var(--t3);line-height:1.6">This evidence will be submitted to Squad's Disputes API. Sentinel's ML analysis proves this transaction was high-risk before fulfillment.</div>
        </div>
        <div class="modal-acts">
          <button class="mb mb-dp" onclick="submitEvidence('${ref}')">⚖ SUBMIT TO SQUAD API</button>
          <button class="mb mb-cl" onclick="closeModal()">CANCEL</button>
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
  el.className = "toast toast-g";
  el.innerHTML = `<span class="t-icon">✅</span><div class="t-body"><strong>SUBMITTED</strong>Evidence sent to Squad Disputes API</div>`;
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
      <td class="tc-amt">${money(d.amount)}</td>
      <td style="color:var(--t2);font-size:11px">${d.reason}</td>
      <td><span class="sc-val" style="color:var(--crimson);font-family:var(--ff-mono)">${d.score}</span></td>
      <td><span class="pill ${d.status === "open" ? "pill-r" : "pill-g"}">${d.status === "open" ? "OPEN" : "SUBMITTED"}</span></td>
      <td>${
        d.status === "open"
          ? `<button class="tbl-btn tb-ft" onclick="disputeModal('${d.ref}')">FIGHT</button>`
          : `<span style="color:var(--jade);font-family:var(--ff-mono);font-size:10px">● SENT</span>`
      }</td>
    </tr>`,
    )
    .join("");
  document.getElementById("open-badge").textContent =
    S.disputes.filter((d) => d.status === "open").length + " open";
}

function toggleDisputes() {
  const body = document.getElementById("disputes-body");
  const chev = document.getElementById("disp-chev");
  const hidden = body.style.display === "none";
  body.style.display = hidden ? "" : "none";
  chev.classList.toggle("up", hidden);
}

// ── CHART ─────────────────────────────────────────
let chart;
const CD = [
  18, 22, 15, 20, 35, 42, 28, 19, 30, 45, 38, 52, 48, 55, 40, 35, 62, 78, 55,
  45, 38, 30, 25, 20,
];
const CL = Array.from({ length: 24 }, (_, i) => `${i}h`);

function buildChart() {
  const ctx = document.getElementById("trendChart").getContext("2d");
  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: CL,
      datasets: [
        {
          data: [...CD],
          borderColor: "rgba(0,212,180,0.5)",
          backgroundColor: (c) => {
            const g = c.chart.ctx.createLinearGradient(0, 0, 0, 180);
            g.addColorStop(0, "rgba(0,212,180,0.1)");
            g.addColorStop(1, "rgba(0,212,180,0)");
            return g;
          },
          pointBackgroundColor: CD.map((s) =>
            s < 31 ? "#2ed573" : s < 71 ? "#f0a500" : "#ff4757",
          ),
          pointRadius: 3,
          pointHoverRadius: 5,
          tension: 0.4,
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
          backgroundColor: "#17171a",
          borderColor: "#2e2e33",
          borderWidth: 1,
          titleColor: "#4a4a55",
          bodyColor: "#ededf0",
          titleFont: { family: "'DM Mono',monospace", size: 9 },
          bodyFont: { family: "'DM Mono',monospace", size: 11 },
          callbacks: { title: () => "", label: (c) => `score: ${c.parsed.y}` },
        },
      },
      scales: {
        x: {
          ticks: {
            color: "#4a4a55",
            font: { size: 9, family: "'DM Mono',monospace" },
          },
          grid: { color: "rgba(37,37,40,.8)" },
          border: { display: false },
        },
        y: {
          min: 0,
          max: 100,
          ticks: {
            color: "#4a4a55",
            font: { size: 9, family: "'DM Mono',monospace" },
            stepSize: 25,
          },
          grid: { color: "rgba(37,37,40,.8)" },
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
  const socket = io();
  socket.on('connect', () => {
    document.getElementById('conn-dot').className = 'conn-dot live';
    document.getElementById('conn-label').textContent = 'Live';
  });
  socket.on('disconnect', () => {
    document.getElementById('conn-dot').className = 'conn-dot error';
    document.getElementById('conn-label').textContent = 'Disconnected';
  });
  socket.on('new_transaction', pushTransaction);
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
  document.getElementById("drw").classList.toggle("open");
  document.getElementById("drw-overlay").classList.toggle("on");
}
