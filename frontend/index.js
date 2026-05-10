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
  { ref:'SQT-8906', time:'14:38:12', amount:420000, email:'e***a74@gmail.com', score:91, tier:'RED', codes:['HIGH_VELOCITY','OFF_HOURS'], status:'blocked', model_trained:true, features:{amount_vs_avg:4.2,velocity_1hr:4,hour_of_day:2} },
  { ref:'SQT-8905', time:'14:37:55', amount:68000, email:'n***i@yahoo.com', score:54, tier:'AMBER', codes:['AMOUNT_SPIKE'], status:'flagged', model_trained:true, features:{amount_vs_avg:2.1,velocity_1hr:1,hour_of_day:21} },
  { ref:'SQT-8904', time:'14:37:20', amount:3500, email:'k***e@hotmail.com', score:11, tier:'GREEN', codes:[], status:'approved', model_trained:true, features:{amount_vs_avg:0.8,velocity_1hr:0,hour_of_day:11} },
  { ref:'SQT-8903', time:'14:36:40', amount:280000, email:'o***u31@gmail.com', score:88, tier:'RED', codes:['HIGH_VELOCITY','OFF_HOURS','AMOUNT_SPIKE'], status:'blocked', model_trained:false, features:{amount_vs_avg:5.1,velocity_1hr:5,hour_of_day:3} },
  { ref:'SQT-8902', time:'14:35:10', amount:12500, email:'t***e@gmail.com', score:19, tier:'GREEN', codes:[], status:'approved', model_trained:true, features:{amount_vs_avg:0.9,velocity_1hr:0,hour_of_day:10} },
  { ref:'SQT-8901', time:'14:34:50', amount:95000, email:'a***a@live.com', score:47, tier:'AMBER', codes:['NEW_DEVICE'], status:'flagged', model_trained:true, features:{amount_vs_avg:1.9,velocity_1hr:1,hour_of_day:22} },
  { ref:'SQT-8900', time:'14:33:20', amount:7500, email:'f***i@gmail.com', score:15, tier:'GREEN', codes:[], status:'approved', model_trained:true, features:{amount_vs_avg:0.7,velocity_1hr:0,hour_of_day:14} },
  { ref:'SQT-8899', time:'14:32:05', amount:350000, email:'c***a58@outlook.com', score:82, tier:'RED', codes:['ANOMALY_DETECTED','OFF_HOURS'], status:'blocked', model_trained:true, features:{amount_vs_avg:4.0,velocity_1hr:3,hour_of_day:2} },
  { ref:'SQT-8898', time:'14:31:40', amount:20000, email:'b***n@yahoo.com', score:24, tier:'GREEN', codes:[], status:'approved', model_trained:true, features:{amount_vs_avg:1.1,velocity_1hr:0,hour_of_day:15} },
  { ref:'SQT-8897', time:'14:30:15', amount:120000, email:'s***l@gmail.com', score:61, tier:'AMBER', codes:['AMOUNT_SPIKE','NEW_DEVICE'], status:'flagged', model_trained:true, features:{amount_vs_avg:2.8,velocity_1hr:2,hour_of_day:20} },
];

const SEED_DSP = [
  { id:'DSP-001', ref:'SQT-8906', amount:420000, reason:'Unauthorized transaction', score:91, status:'open' },
  { id:'DSP-002', ref:'SQT-8903', amount:280000, reason:'Card not present fraud', score:88, status:'open' },
  { id:'DSP-003', ref:'SQT-8899', amount:350000, reason:'Item not received', score:82, status:'open' },
];

const RSN = {
  HIGH_VELOCITY:'4 transactions in 5 min',
  OFF_HOURS:'Placed 1AM–5AM',
  AMOUNT_SPIKE:'4× above customer avg',
  NEW_DEVICE:'Unrecognised device',
  GEO_MISMATCH:'Billing ≠ IP country',
  ANOMALY_DETECTED:'ML model anomaly flag',
};

// DEMO SIMULATION FUNCTIONS - ADDED THESE
function simulateRed() {
  const newTxn = {
    ref: 'SQT-' + Math.floor(Math.random() * 9000 + 9000),
    time: nowTime(),
    amount: Math.floor(Math.random() * 500000 + 100000),
    email: 'risk***@suspicious.com',
    score: Math.floor(Math.random() * 30 + 70),
    tier: 'RED',
    codes: ['HIGH_VELOCITY', 'OFF_HOURS'].slice(0, Math.floor(Math.random() * 2) + 1),
    status: 'blocked',
    model_trained: true,
    features: { amount_vs_avg: Math.random() * 6 + 3, velocity_1hr: Math.floor(Math.random() * 5 + 2), hour_of_day: Math.random() * 24 }
  };
  pushTransaction(newTxn);
}

function simulateAmber() {
  const newTxn = {
    ref: 'SQT-' + Math.floor(Math.random() * 9000 + 9000),
    time: nowTime(),
    amount: Math.floor(Math.random() * 100000 + 10000),
    email: 'review***@customer.com',
    score: Math.floor(Math.random() * 40 + 30),
    tier: 'AMBER',
    codes: ['AMOUNT_SPIKE', 'NEW_DEVICE'].slice(0, Math.floor(Math.random() * 2) + 1),
    status: 'flagged',
    model_trained: true,
    features: { amount_vs_avg: Math.random() * 3 + 1, velocity_1hr: Math.floor(Math.random() * 3), hour_of_day: Math.random() * 24 }
  };
  pushTransaction(newTxn);
}

function simulateGreen() {
  const newTxn = {
    ref: 'SQT-' + Math.floor(Math.random() * 9000 + 9000),
    time: nowTime(),
    amount: Math.floor(Math.random() * 50000 + 1000),
    email: 'legit***@verified.com',
    score: Math.floor(Math.random() * 30),
    tier: 'GREEN',
    codes: [],
    status: 'approved',
    model_trained: true,
    features: { amount_vs_avg: Math.random() * 0.8, velocity_1hr: 0, hour_of_day: Math.random() * 24 }
  };
  pushTransaction(newTxn);
}

//BOOT
document.addEventListener('DOMContentLoaded', () => {
  S.transactions = [...SEED];
  S.disputes = [...SEED_DSP];
  renderFeed();
  renderDisputes();
  syncKPIs();
  buildChart();
  initSocket();
  startDemo();
});

//SIDEBAR TOGGLE
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('mob-overlay');
  const isMobile = window.innerWidth <= 768;

  if (isMobile) {
    const isOpen = sidebar.classList.contains('mobile-open');
    sidebar.classList.toggle('mobile-open', !isOpen);
    sidebar.classList.toggle('collapsed', isOpen);
    overlay.classList.toggle('on', !isOpen);
  } else {
    S.sidebarOpen = !S.sidebarOpen;
    sidebar.classList.toggle('collapsed', !S.sidebarOpen);
  }
  setTimeout(() => { if (chart) chart.resize(); }, 320);
}

//UTILS - FIXED money() function
const money = n => '₦' + Number(n).toLocaleString();
const scCol = s => s < 31 ? 'var(--jade)' : s < 71 ? 'var(--amber)' : 'var(--crimson)';
const pillCls = t => t === 'GREEN' ? 'pill-g' : t === 'AMBER' ? 'pill-a' : 'pill-r';
const rowCls = t => t === 'GREEN' ? 'row-g' : t === 'AMBER' ? 'row-a' : 'row-r';
function nowTime() { return new Date().toTimeString().slice(0,8); }
function fmtTime(iso) { return iso ? new Date(iso).toLocaleTimeString('en-GB').slice(0,8) : '—'; }

 function sigClass(code) {
  const critical = ['HIGH_VELOCITY','ANOMALY_DETECTED','GEO_MISMATCH','ML_HIGH_RISK'];
  const warning = ['AMOUNT_SPIKE','OFF_HOURS'];
  if (critical.includes(code)) return 'sig-c';
  if (warning.includes(code)) return 'sig-w';
  return 'sig-i';
}
//FEED
function renderFeed() {
  document.getElementById('txn-body').innerHTML = S.transactions.slice(0,50).map(t => buildRow(t,false)).join('');
  document.getElementById('feed-meta').textContent = `${Math.min(S.transactions.length,50)} transactions`;
}

function buildRow(t, anim) {
  const codes = (t.codes || []).length
    ? (t.codes || []).map(c => `<span class="sig ${sigClass(c)}">${c}</span>`)
    : `<span style="color:var(--t3);font-family:var(--ff-mono);font-size:10px">—</span>`;

  const status = t.status === 'approved'
    ? `<span class="st-ok">● APPROVED</span>`
    : t.status === 'flagged'
    ? `<span class="st-fl">◆ FLAGGED</span>`
    : `<span class="st-blk">■ BLOCKED</span>`;

  const action = (t.tier === 'AMBER' && t.status === 'flagged')
    ? `<button class="tbl-btn tb-rv" onclick="event.stopPropagation();openModal('${t.ref}')">REVIEW</button>`
    : '';

  return `<tr class="${rowCls(t.tier)} ${anim?'slide-in':''}" onclick="openModal('${t.ref}')">
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
  if (S.transactions.some(x => x.ref === t.ref)) return;
  
  if (!t.time) t.time = fmtTime(t.timestamp);
  if (!t.status) t.status = t.tier === 'GREEN' ? 'approved' : t.tier === 'AMBER' ? 'flagged' : 'blocked';
  if (!t.codes) t.codes = t.reasons || [];
  
  S.transactions.unshift(t);
  S.total++;
  
  if (t.tier === 'AMBER') { 
    S.flagged++;  
    bumpKPI('kpi-flagged-card','kpi-flagged'); 
  }
  if (t.tier === 'RED') { 
    S.blocked++;  
    bumpKPI('kpi-blocked-card','kpi-blocked'); 
    S.saved += t.amount; 
    bumpKPI('kpi-saved-card','kpi-saved'); 
  }
  
  bumpKPI('kpi-total-card','kpi-total');
  syncKPIs();
  nudgeChart(t.score);
  document.getElementById('last-time').textContent = t.time || fmtTime(t.timestamp);

  const tbody = document.getElementById('txn-body');
  const tmp = document.createElement('tbody');
  tmp.innerHTML = buildRow(t,true);
  tbody.insertBefore(tmp.firstChild, tbody.firstChild);
  if (tbody.rows.length > 50) tbody.deleteRow(tbody.rows.length-1);
  document.getElementById('feed-meta').textContent = `${Math.min(S.transactions.length,50)} transactions`;

  showToast(t);
}

function formatNumber(n) {
  if (n >= 1_000_000_000) {
    return '₦' + (n / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B';
  }
  if (n >= 1_000_000) {
    return '₦' + (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (n >= 1_000) {
    return '₦' + (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return '₦' + n.toLocaleString();
}
//KPIs
function syncKPIs() {
  document.getElementById('kpi-total').textContent = S.total;
  document.getElementById('kpi-flagged').textContent = S.flagged;
  document.getElementById('kpi-blocked').textContent = S.blocked;
  document.getElementById('kpi-saved').textContent = formatNumber(S.saved);
  document.getElementById('bar-total').style.width = Math.min(100, (S.total / 200) * 100) + '%';
  document.getElementById('bar-flagged').style.width = Math.min(100, (S.flagged / 20) * 100) + '%';
  document.getElementById('bar-blocked').style.width = Math.min(100, (S.blocked / 10) * 100) + '%';
  document.getElementById('bar-saved').style.width = Math.min(100, (S.saved / 500000) * 100) + '%';
}

function bumpKPI(cardId, numId) {
  const card = document.getElementById(cardId);
  card.classList.remove('kpi-bump'); 
  void card.offsetWidth; 
  card.classList.add('kpi-bump');
}

//TOAST
function showToast(t) {
  const rack = document.getElementById('toasts');
  const el = document.createElement('div');
  const cls = t.tier === 'RED' ? 'toast-r' : t.tier === 'AMBER' ? 'toast-a' : 'toast-g';
  const icon = t.tier === 'RED' ? '🚫' : t.tier === 'AMBER' ? '⚠️' : '✅';
  const lbl = t.tier === 'RED' ? 'BLOCKED' : t.tier === 'AMBER' ? 'FLAGGED' : 'APPROVED';
  el.className = `toast ${cls}`;
  el.innerHTML = `<span class="t-icon">${icon}</span><div class="t-body"><strong>${lbl} — ${money(t.amount)}</strong><br/>${t.email}</div>`;
  rack.appendChild(el);
  setTimeout(() => el.remove(), t.tier === 'RED' ? 5500 : 3000);
}

//MODAL
function openModal(ref) {
  const t = S.transactions.find(x => x.ref === ref);
  if (!t) return;
  const col = scCol(t.score);
  const mtag = t.model_trained !== false
    ? `<span class="m-tag on">● AI MODEL ACTIVE</span>`
    : `<span class="m-tag off">◌ LEARNING MODE</span>`;

  const reasons = (t.codes || []).length
    ? (t.codes || []).map(c => `<div class="rsn-row"><span class="rsn-code" style="color:${col}">${c}</span><span class="rsn-desc">${RSN[c] || 'Risk signal triggered'}</span></div>`).join('')
    : `<div style="color:var(--jade);font-family:var(--ff-mono);font-size:11px;padding:6px 0">No risk signals</div>`;

  const feats = t.features ? Object.entries(t.features).map(([k,v]) => {
    const fv = parseFloat(v), fc = fv > 2 ? 'var(--crimson)' : fv > 1 ? 'var(--amber)' : 'var(--jade)';
    return `<div class="ft-row"><span class="ft-k">${k}</span><span class="ft-v" style="color:${fc}">${v}</span></div>`;
  }).join('') : '';

  const acts = t.tier === 'GREEN'
    ? `<button class="mb mb-cl" onclick="closeModal()">CLOSE</button>`
    : t.tier === 'AMBER'
    ? `<button class="mb mb-ok" onclick="approveIt('${t.ref}')">✓ APPROVE</button><button class="mb mb-fl" onclick="closeModal()">⚑ FLAG</button><button class="mb mb-cl" onclick="closeModal()">CLOSE</button>`
    : `<button class="mb mb-rf" onclick="closeModal()">↩ REFUND</button><button class="mb mb-dp" onclick="disputeModal('${t.ref}')">⚖ FIGHT DISPUTE</button><button class="mb mb-cl" onclick="closeModal()">CLOSE</button>`;

  document.getElementById('modal-mount').innerHTML = `
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
              <div class="ibox"><div class="ibox-lbl">Status</div><div class="ibox-val">${(t.status || (t.tier === 'GREEN' ? 'approved' : t.tier === 'AMBER' ? 'flagged' : 'blocked')).toUpperCase()}</div></div>
            </div></div>
          <div><div class="m-sec-lbl">AI Trust Score</div>
            <div class="gauge-row">
              <div class="gauge" style="border-color:${col}"><span class="gauge-sc" style="color:${col}">${t.score}</span></div>
              <div class="g-right">
                <div class="g-tier-row"><span class="pill ${pillCls(t.tier)}">${t.tier}</span>${mtag}</div>
                <div class="g-desc">${t.tier === 'GREEN' ? 'Low risk — safe to process.' : t.tier === 'AMBER' ? 'Medium risk — review before fulfillment.' : 'High risk — automatically blocked.'}</div>
              </div>
            </div></div>
          <div><div class="m-sec-lbl">Risk Signals</div>${reasons}</div>
          ${feats ? `<div><div class="m-sec-lbl">Feature Deviations</div>${feats}</div>` : ''}
          <div><div class="m-sec-lbl">Raw Payload</div><div class="raw">${JSON.stringify(t, null, 2)}</div></div>
        </div>
        <div class="modal-acts">${acts}</div>
      </div>
    </div>`;
}

function closeModal() { document.getElementById('modal-mount').innerHTML = ''; }

function approveIt(ref) {
  const t = S.transactions.find(x => x.ref === ref);
  if (t) { 
    t.status = 'approved'; 
    t.tier = 'GREEN'; 
    S.flagged = Math.max(0, S.flagged - 1); 
  }
  closeModal(); 
  renderFeed();
  syncKPIs();
  const el = document.createElement('div');
  el.className = 'toast toast-g';
  el.innerHTML = `<span class="t-icon">✅</span><div class="t-body"><strong>APPROVED</strong><br/>Transaction approved manually</div>`;
  document.getElementById('toasts').appendChild(el);
  setTimeout(() => el.remove(), 2500);
}

function disputeModal(ref) {
  const t = S.transactions.find(x => x.ref === ref);
  if (!t) return;
  closeModal();
  document.getElementById('modal-mount').innerHTML = `
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
              Signals: <strong>${(t.codes || []).join(' + ') || 'ANOMALY_DETECTED'}</strong><br/>
              Model: <strong>${t.model_trained !== false ? 'Rule Engine + Z-Score + Isolation Forest' : 'Heuristic fallback'}</strong><br/>
              Deviation: <strong>${t.features?.amount_vs_avg ?? '—'}× above customer avg</strong>
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
  const d = S.disputes.find(x => x.ref === ref);
  if (d) d.status = 'submitted';
  closeModal(); 
  renderDisputes();
  const el = document.createElement('div');
  el.className = 'toast toast-g';
  el.innerHTML = `<span class="t-icon">✅</span><div class="t-body"><strong>SUBMITTED</strong><br/>Evidence sent to Squad Disputes API</div>`;
  document.getElementById('toasts').appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

//DISPUTES
function renderDisputes() {
  document.getElementById('disputes-tbody').innerHTML = S.disputes.map(d => `
    <tr style="border-bottom:1px solid var(--line);cursor:default">
      <td class="tc-time">${d.id}</td>
      <td class="tc-time">${d.ref}</td>
      <td class="tc-amt">${money(d.amount)}</td>
      <td style="color:var(--t2);font-size:11px">${d.reason}</td>
      <td><span class="sc-val" style="color:var(--crimson);font-family:var(--ff-mono)">${d.score}</span></td>
      <td><span class="pill ${d.status === 'open' ? 'pill-r' : 'pill-g'}">${d.status === 'open' ? 'OPEN' : 'SUBMITTED'}</span></td>
      <td>${d.status === 'open'
        ? `<button class="tbl-btn tb-ft" onclick="disputeModal('${d.ref}')">FIGHT</button>`
        : `<span style="color:var(--jade);font-family:var(--ff-mono);font-size:10px">● SENT</span>`}</td>
     </tr>`).join('');
  document.getElementById('open-badge').textContent = S.disputes.filter(d => d.status === 'open').length + ' open';
}

function toggleDisputes() {
  const body = document.getElementById('disputes-body');
  const chev = document.getElementById('disp-chev');
  const hidden = body.style.display === 'none';
  body.style.display = hidden ? '' : 'none';
  chev.classList.toggle('up', hidden);
}

//CHART 
let chart;
const CD = [18,22,15,20,35,42,28,19,30,45,38,52,48,55,40,35,62,78,55,45,38,30,25,20];
const CL = Array.from({length:24}, (_,i) => `${i}h`);

function buildChart() {
  const ctx = document.getElementById('trendChart').getContext('2d');
  chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: CL,
      datasets: [{
        data: [...CD],
        borderColor: 'rgba(0,212,180,0.5)',
        backgroundColor: (c) => {
          const g = c.chart.ctx.createLinearGradient(0, 0, 0, 180);
          g.addColorStop(0, 'rgba(0,212,180,0.1)');
          g.addColorStop(1, 'rgba(0,212,180,0)');
          return g;
        },
        pointBackgroundColor: CD.map(s => s < 31 ? '#2ed573' : s < 71 ? '#f0a500' : '#ff4757'),
        pointRadius: 3,
        pointHoverRadius: 5,
        tension: 0.4,
        fill: true,
        borderWidth: 1.5,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#17171a',
          borderColor: '#2e2e33',
          borderWidth: 1,
          titleColor: '#4a4a55',
          bodyColor: '#ededf0',
          titleFont: { family: "'DM Mono',monospace", size: 9 },
          bodyFont: { family: "'DM Mono',monospace", size: 11 },
          callbacks: { title: () => '', label: c => `score: ${c.parsed.y}` }
        }
      },
      scales: {
        x: { ticks: { color: '#4a4a55', font: { size: 9, family: "'DM Mono',monospace" } }, grid: { color: 'rgba(37,37,40,.8)' }, border: { display: false } },
        y: { min: 0, max: 100, ticks: { color: '#4a4a55', font: { size: 9, family: "'DM Mono',monospace" }, stepSize: 25 }, grid: { color: 'rgba(37,37,40,.8)' }, border: { display: false } }
      }
    }
  });
}

function nudgeChart(score) {
  if (!chart) return;
  chart.data.datasets[0].data.push(score);
  chart.data.datasets[0].data.shift();
  chart.data.datasets[0].pointBackgroundColor = chart.data.datasets[0].data.map(s => s < 31 ? '#2ed573' : s < 71 ? '#f0a500' : '#ff4757');
  chart.update('none');
}

//SOCKET - FIXED to be optional (won't break if socket.io not loaded)
function initSocket() {
  if (typeof io !== 'undefined') {
    const socket = io('http://localhost:3000');
    socket.on('connect', () => {
      document.getElementById('conn-dot').className = 'conn-dot live';
      document.getElementById('conn-label').textContent = 'Live';
    });
    socket.on('disconnect', () => {
      document.getElementById('conn-dot').className = 'conn-dot error';
      document.getElementById('conn-label').textContent = 'Disconnected';
    });
    socket.on('new_transaction', pushTransaction);
  } else {
    console.log('Socket.io not loaded - running in standalone mode');
    document.getElementById('conn-dot').className = 'conn-dot error';
    document.getElementById('conn-label').textContent = 'Standalone';
  }
}

//DEMO - FIXED timing
function startDemo() {
  if (S.demoTimer) clearInterval(S.demoTimer);
  S.demoTimer = setInterval(() => {
    const r = Math.random();
    if (r < 0.18) simulateRed();
    else if (r < 0.45) simulateAmber();
    else simulateGreen();
  }, 4000); // Changed back to 4 seconds like original
}

function toggleDemo() {
  S.demoMode = !S.demoMode;
  const ribbon = document.getElementById('demo-ribbon');
  const btn = document.getElementById('demo-btn');
  if (S.demoMode) { 
    startDemo(); 
    ribbon.style.display = 'flex'; 
    btn.textContent = 'Disable'; 
  } else { 
    clearInterval(S.demoTimer); 
    ribbon.style.display = 'none'; 
    btn.textContent = 'Enable'; 
  }
}

//SETTINGS MODAL
function toggleSettings() {
  const mount = document.getElementById('settings-mount');
  if (mount.innerHTML) { 
    mount.innerHTML = ''; 
    return; 
  }

  mount.innerHTML = `
    <div class="sm-overlay" onclick="closeSettings(event)">
      <div class="sm" onclick="event.stopPropagation()">
        <div class="sm-hd">
          <div class="sm-hd-left">
            <div class="sm-hd-icon">
              <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
              <path d="M11 1L20 6V16L11 21L2 16V6L11 1Z" stroke="currentColor" stroke-width="1.5" fill="none"/>
              <circle cx="11" cy="11" r="2.5" fill="currentColor"/>
              </svg>
            </div>
            <div>
              <div class="sm-hd-title">Settings</div>
              <div class="sm-hd-sub">Override Configuration</div>
            </div>
          </div>
          <button class="sm-x" onclick="toggleSettings()">✕</button>
        </div>
        <div class="sm-sec-lbl">Risk Engine</div>
        <div class="sm-row">
          <div class="sm-row-info">
            <div class="sm-row-name">Block Threshold</div>
            <div class="sm-row-desc">Transactions scoring above this are blocked</div>
          </div>
          <div class="sldr-row">
            <input type="range" min="0" max="100" value="70"
              oninput="document.getElementById('sm-tval').textContent=this.value"/>
            <span id="sm-tval">70</span>
          </div>
        </div>
        <div class="sm-sec-lbl">Alerts</div>
        <div class="sm-row">
          <div class="sm-row-info">
            <div class="sm-row-name">AMBER Alerts</div>
            <div class="sm-row-desc">Notify when medium-risk transactions arrive</div>
          </div>
          <label class="tog"><input type="checkbox" checked/><span class="tog-t"></span></label>
        </div>
        <div class="sm-row">
          <div class="sm-row-info">
            <div class="sm-row-name">SMS Alerts</div>
            <div class="sm-row-desc">Send SMS on RED transaction block</div>
          </div>
          <label class="tog"><input type="checkbox"/><span class="tog-t"></span></label>
        </div>
        <div class="sm-sec-lbl">Automation</div>
        <div class="sm-row">
          <div class="sm-row-info">
            <div class="sm-row-name">Auto-Refund RED</div>
            <div class="sm-row-desc">Automatically initiate refund on blocked transactions</div>
          </div>
          <label class="tog"><input type="checkbox" checked/><span class="tog-t"></span></label>
        </div>
        <div class="sm-row">
          <div class="sm-row-info">
            <div class="sm-row-name">Demo Mode</div>
            <div class="sm-row-desc">Simulate live transactions for demonstration</div>
          </div>
          <label class="tog">
            <input type="checkbox" ${S.demoMode ? 'checked' : ''} onchange="toggleDemoFromSettings(this)"/>
            <span class="tog-t"></span>
          </label>
        </div>
        <div class="sm-foot">
          <button class="sm-cancel" onclick="toggleSettings()">CANCEL</button>
          <button class="sm-save" onclick="saveSettings()">SAVE CHANGES</button>
        </div>
      </div>
    </div>`;
}

function closeSettings(e) {
  if (e.target === e.currentTarget) toggleSettings();
}

function saveSettings() {
  toggleSettings();
  const el = document.createElement('div');
  el.className = 'toast toast-g';
  el.innerHTML = `<span class="t-icon">✅</span><div class="t-body"><strong>SAVED</strong><br/>Settings updated successfully</div>`;
  document.getElementById('toasts').appendChild(el);
  setTimeout(() => el.remove(), 2500);
}

function toggleDemoFromSettings(checkbox) {
  S.demoMode = checkbox.checked;
  const ribbon = document.getElementById('demo-ribbon');
  const btn = document.getElementById('demo-btn');
  if (S.demoMode) {
    startDemo(); 
    ribbon.style.display = 'flex'; 
    btn.textContent = 'Disable';
  } else {
    clearInterval(S.demoTimer); 
    ribbon.style.display = 'none';
    btn.textContent = 'Enable';
  }
}