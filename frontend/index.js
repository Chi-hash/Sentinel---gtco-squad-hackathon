const S = {
  total: 18,
  flagged: 2,
  blocked: 1,
  saved: 85000,
  transactions: [],
  disputes: [],
  demoMode: true,
  demoTimer: null,
  sidebarOpen: true,
};

const SEED = [
  { ref:'SQT-8906', time:'14:38:12', amount:18500000,  email:'e***a74@gmail.com',   score:91, tier:'RED',   codes:['HIGH_VELOCITY','OFF_HOURS'],               status:'blocked',  model_trained:true,  features:{amount_vs_avg:4.2,velocity_1hr:4,hour_of_day:2}  },
  { ref:'SQT-8905', time:'14:37:55', amount:7500000,   email:'n***i@yahoo.com',     score:54, tier:'AMBER', codes:['AMOUNT_SPIKE'],                            status:'flagged',  model_trained:true,  features:{amount_vs_avg:2.1,velocity_1hr:1,hour_of_day:21} },
  { ref:'SQT-8904', time:'14:37:20', amount:1800000,   email:'k***e@hotmail.com',   score:11, tier:'GREEN', codes:[],                                          status:'approved', model_trained:true,  features:{amount_vs_avg:0.8,velocity_1hr:0,hour_of_day:11} },
  { ref:'SQT-8903', time:'14:36:40', amount:22000000,  email:'o***u31@gmail.com',   score:88, tier:'RED',   codes:['HIGH_VELOCITY','OFF_HOURS','AMOUNT_SPIKE'], status:'blocked',  model_trained:false, features:{amount_vs_avg:5.1,velocity_1hr:5,hour_of_day:3}  },
  { ref:'SQT-8902', time:'14:35:10', amount:1250000,   email:'t***e@gmail.com',     score:19, tier:'GREEN', codes:[],                                          status:'approved', model_trained:true,  features:{amount_vs_avg:0.9,velocity_1hr:0,hour_of_day:10} },
  { ref:'SQT-8901', time:'14:34:50', amount:8500000,   email:'a***a@live.com',      score:47, tier:'AMBER', codes:['NEW_DEVICE'],                              status:'flagged',  model_trained:true,  features:{amount_vs_avg:1.9,velocity_1hr:1,hour_of_day:22} },
  { ref:'SQT-8900', time:'14:33:20', amount:950000,    email:'f***i@gmail.com',     score:15, tier:'GREEN', codes:[],                                          status:'approved', model_trained:true,  features:{amount_vs_avg:0.7,velocity_1hr:0,hour_of_day:14} },
  { ref:'SQT-8899', time:'14:32:05', amount:19500000,  email:'c***a58@outlook.com', score:82, tier:'RED',   codes:['ANOMALY_DETECTED','OFF_HOURS'],            status:'blocked',  model_trained:true,  features:{amount_vs_avg:4.0,velocity_1hr:3,hour_of_day:2}  },
  { ref:'SQT-8898', time:'14:31:40', amount:2200000,   email:'b***n@yahoo.com',     score:24, tier:'GREEN', codes:[],                                          status:'approved', model_trained:true,  features:{amount_vs_avg:1.1,velocity_1hr:0,hour_of_day:15} },
  { ref:'SQT-8897', time:'14:30:15', amount:11000000,  email:'s***l@gmail.com',     score:61, tier:'AMBER', codes:['AMOUNT_SPIKE','NEW_DEVICE'],               status:'flagged',  model_trained:true,  features:{amount_vs_avg:2.8,velocity_1hr:2,hour_of_day:20} },
];

const SEED_DSP = [
  { id:'DSP-001', ref:'SQT-8906', amount:18500000, reason:'Unauthorized transaction', score:91, status:'open' },
  { id:'DSP-002', ref:'SQT-8903', amount:22000000, reason:'Card not present fraud',   score:88, status:'open' },
  { id:'DSP-003', ref:'SQT-8899', amount:19500000, reason:'Item not received',        score:82, status:'open' },
];

const RSN = {
  HIGH_VELOCITY:     '4 transactions in 5 min',
  OFF_HOURS:         'Placed 1AM–4AM WAT',
  AMOUNT_SPIKE:      '3× above merchant average',
  NEW_DEVICE:        'Unrecognised device',
  GEO_MISMATCH:      'Billing ≠ IP country',
  ANOMALY_DETECTED:  'ML model anomaly flag',
  ML_HIGH_RISK:      'Isolation Forest: high fraud probability',
  ML_MEDIUM_RISK:    'Isolation Forest: elevated fraud risk',
  STAT_ANOMALY:      'Amount > 2σ from customer mean',
  ROUND_AMOUNT:      'Suspiciously round amount',
  FIRST_TIME_PAYER:  'No prior transaction history',
  BIN_PATTERN:       'Card BIN linked to multiple emails',
  BEHAVIOUR_MISMATCH:'Sudden jump from habitual amounts',
  HIGH_VALUE_NEW:    'First-timer with very high payment',
  SCORING_ERROR:     'Fallback score — engine error',
};


//BOOT
document.addEventListener('DOMContentLoaded', () => {
  S.transactions = [...SEED];
  S.disputes = [...SEED_DSP];
  renderFeed();
  renderDisputes();
  syncKPIs();
  S.transactions.forEach(t => { if (t.tier === 'RED') t._notifRead = false; });
  updateNotifBadge();
  buildChart();
  initSocket();
  startDemo();
  hydrateFromDB();
});

function hydrateFromDB() {
  fetch('/api/transactions')
    .then(r => r.json())
    .then(rows => {
      if (!Array.isArray(rows)) return;
      let added = 0;
      rows.forEach(r => {
        if (S.transactions.some(x => x.ref === r.ref)) return;
        const t = {
          ref:           r.ref,
          email:         r.email,
          amount:        r.amount,
          score:         r.score,
          tier:          r.tier,
          codes:         r.reasons || [],
          reasons:       r.reasons || [],
          features:      r.features || {},
          status:        r.action_taken || (r.tier === 'GREEN' ? 'approved' : r.tier === 'AMBER' ? 'flagged' : 'blocked'),
          time:          fmtTime(r.timestamp),
          timestamp:     r.timestamp,
          model_trained: true,
          _notifRead:    r.tier !== 'RED',
        };
        S.transactions.push(t);
        S.total++;
        if (t.tier === 'AMBER') S.flagged++;
        if (t.tier === 'RED')   { S.blocked++; S.saved += Math.round(t.amount / 100); _autoAddDispute(t); }
        added++;
      });
      if (added > 0) { renderFeed(); syncKPIs(); updateNotifBadge(); }
    })
    .catch(() => {});
}

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

//NOTIFICATIONS
function toggleNotifications() {
  const panel = document.getElementById('notif-panel');
  const isOpen = panel.classList.toggle('open');
  if (isOpen) renderNotifications();
}

function updateNotifBadge() {
  const badge = document.getElementById('notif-badge');
  const wrap = document.querySelector('.notif-wrap');
  const reds = S.transactions.filter(t => t.tier === 'RED' && !t._notifRead);
  
  document.getElementById('notif-count').textContent = reds.length;
  
  if (reds.length > 0) {
    badge.textContent = reds.length > 99 ? '99+' : reds.length;
    badge.style.display = 'flex';
    wrap?.classList.add('has-alert');
  } else {
    badge.style.display = 'none';
    wrap?.classList.remove('has-alert');
  }
}

function triggerNotifAlert() {
  const wrap = document.querySelector('.notif-wrap');
  wrap?.classList.add('notif-bump');
  setTimeout(() => wrap?.classList.remove('notif-bump'), 600);
}

function renderNotifications() {
  const list = document.getElementById('notif-list');
  const markall = document.getElementById('notif-markall');
  const reds = S.transactions.filter(t => t.tier === 'RED' && !t._notifRead);
  
  if (!reds.length) {
    list.innerHTML = '<div class="notif-empty">No critical alerts</div>';
    markall?.classList.add('hidden');
    return;
  }
  
  markall?.classList.remove('hidden');
  list.innerHTML = reds.map(t => `
    <div class="notif-item" onclick="event.stopPropagation(); toggleNotifications(); openModal('${t.ref}');">
      <div class="notif-top">
        <div class="notif-title">${t.status === 'blocked' ? 'High Risk Transaction Blocked' : 'Critical Risk Detected'}</div>
        <div class="notif-time">${t.time || fmtTime(t.timestamp)}</div>
      </div>
      <div class="notif-meta">
        ${money(t.amount)} &nbsp;•&nbsp; Score: <strong style="color:#ef4444">${t.score}</strong>
      </div>
      <div class="notif-tags">
        ${(t.codes || []).map(c => `<span class="notif-tag">${c}</span>`).join('')}
      </div>
    </div>
  `).join('');
}

function markAllNotifsRead() {
  S.transactions.forEach(t => { if (t.tier === 'RED') t._notifRead = true; });
  updateNotifBadge();
  renderNotifications();
}

document.addEventListener('click', (e) => {
  const wrap = document.querySelector('.notif-wrap');
  if (wrap && !wrap.contains(e.target)) {
    document.getElementById('notif-panel')?.classList.remove('open');
  }
});

//UTILS
const money = n => '₦' + (Number(n) / 100).toLocaleString();
const scCol = s => s < 31 ? 'var(--jade)' : s < 71 ? 'var(--amber)' : 'var(--crimson)';
const pillCls = t => t === 'GREEN' ? 'pill-g' : t === 'AMBER' ? 'pill-a' : 'pill-r';
const rowCls = t => t === 'GREEN' ? 'row-g' : t === 'AMBER' ? 'row-a' : 'row-r';
function nowTime() { return new Date().toTimeString().slice(0,8); }
function fmtTime(iso) { return iso ? new Date(iso).toLocaleTimeString('en-GB').slice(0,8) : '—'; }

 function sigClass(code) {
const critical = ['HIGH_VELOCITY','ANOMALY_DETECTED','GEO_MISMATCH','ML_HIGH_RISK','ROUND_AMOUNT'];
  const warning = ['AMOUNT_SPIKE','OFF_HOURS','ML_MEDIUM_RISK', 'FIRST_TIME_PAYER', 'BIN_PATTERN', 'NEW_DEVICE'];
  if (critical.includes(code)) return 'sig-c';
  if (warning.includes(code)) return 'sig-w';
  return 'sig-i';
}
//FEED
function renderFeed() {
  document.getElementById('txn-body').innerHTML = S.transactions.slice(0,50).map(t => buildRow(t,false)).join('');
  document.getElementById('feed-meta').textContent = `${Math.min(S.transactions.length,50)} transactions`;
}
// place this right after the renderFeed() function (around line 100)

function filterByEmail(query) {
  const q = query.trim().toLowerCase();
  const clearBtn = document.getElementById('search-clear');
  if (clearBtn) clearBtn.style.display = q ? 'block' : 'none';

  const rows = document.querySelectorAll('#txn-body tr');
  let visible = 0;
  rows.forEach(row => {
    const emailCell = row.querySelector('.tc-email');
    if (!emailCell) return;
    const match = !q || emailCell.textContent.toLowerCase().includes(q);
    row.style.display = match ? '' : 'none';
    if (match) visible++;
  });

  const meta = document.getElementById('feed-meta');
  if (meta) meta.textContent = `${visible} transaction${visible !== 1 ? 's' : ''}`;
}

function clearEmailSearch() {
  const input = document.getElementById('email-search');
  if (!input) return;
  input.value = '';
  input.focus();
  filterByEmail('');
}

function buildRow(t, anim) {
  const codes = (t.codes || []).length
    ? (t.codes || []).map(c => `<span class="sig ${sigClass(c)}">${c}</span>`)
    : `<span style="color:var(--t3);font-family:var(--ff-mono);font-size:10px">—</span>`;

  const status = t.status === 'approved'
    ? `<span class="st-ok"><span>●</span><span>APPROVED</span></span>`
    : t.status === 'flagged'
    ? `<span class="st-fl"><span>◆</span><span>FLAGGED</span></span>`
    : `<span class="st-blk"><span>■</span><span>BLOCKED</span></span>`;

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

let _dspCount = 100;
function _autoAddDispute(t) {
  if (S.disputes.some(d => d.ref === t.ref)) return;
  const codes  = t.codes || t.reasons || [];
  const reason = codes.includes('HIGH_VELOCITY')    ? 'High velocity fraud detected'
               : codes.includes('AMOUNT_SPIKE')     ? 'Abnormal transaction amount'
               : codes.includes('OFF_HOURS')        ? 'Suspicious off-hours activity'
               : codes.includes('ML_HIGH_RISK')     ? 'ML model flagged high fraud risk'
               : codes.includes('ANOMALY_DETECTED') ? 'Statistical anomaly detected'
               : 'Unauthorized transaction';
  S.disputes.unshift({
    id:     'DSP-' + String(++_dspCount).padStart(3, '0'),
    ref:    t.ref,
    amount: t.amount,
    reason,
    score:  t.score,
    status: 'open',
  });
  renderDisputes();
  // Expand disputes panel if it's collapsed
  const body = document.getElementById('disputes-body');
  if (body && body.style.display === 'none') {
    body.style.display = '';
    const chev = document.getElementById('disp-chev');
    if (chev) chev.classList.remove('up');
  }
}

function pushTransaction(t) {
  if (S.transactions.some(x => x.ref === t.ref)) return;
  
  if (!t.time) t.time = fmtTime(t.timestamp);
  if (!t.status) t.status = t.tier === 'GREEN' ? 'approved' : t.tier === 'AMBER' ? 'flagged' : 'blocked';
  if (!t.codes) t.codes = t.reasons || [];
  if (t.tier === 'RED') t._notifRead = false;
  S.transactions.unshift(t);
  S.total++;
  
  if (t.tier === 'AMBER') { 
    S.flagged++;  
    bumpKPI('kpi-flagged-card','kpi-flagged'); 
  }
  if (t.tier === 'RED') { 
    S.blocked++;  
    bumpKPI('kpi-blocked-card','kpi-blocked'); 
    S.saved += Math.round(t.amount / 100); // convert kobo → naira for display
    bumpKPI('kpi-saved-card','kpi-saved');
    _autoAddDispute(t);
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

  if (t.tier === 'RED') {
    updateNotifBadge();
    triggerNotifAlert();
  }
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
  document.getElementById('bar-saved').style.width = Math.min(100, (S.saved / 1000000) * 100) + '%';
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
  if (t.tier === 'RED' && !t._notifRead) {
    t._notifRead = true;
    updateNotifBadge();
  }
  // window._currentTxn = t; 
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
          <div style="display:flex;gap:8px;align-items:center;">
          <button class="m-report" onclick="event.stopPropagation(); generateReport('${t.ref}')"> Report</button>
          <button class="m-x" onclick="closeModal()">✕</button>
          </div>
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
function generateReport(ref) {
  const t = S.transactions.find(x => x.ref === ref);
  if (!t) return;

  const col     = t.tier === 'GREEN' ? '#16a34a' : t.tier === 'AMBER' ? '#d97706' : '#dc2626';
  const colBg   = t.tier === 'GREEN' ? '#f0fdf4' : t.tier === 'AMBER' ? '#fffbeb' : '#fef2f2';
  const fmtMoney = n => '₦' + (Number(n) / 100).toLocaleString();
  const now      = new Date();
  const nowStr   = now.toLocaleString('en-GB');
  const timeStr  = t.time || fmtTime(t.timestamp);

  const SIGNAL_DESC = {
    HIGH_VELOCITY:    'Multiple rapid transactions from the same email address',
    OFF_HOURS:        'Transaction placed during 1–4 AM high-risk window',
    AMOUNT_SPIKE:     'Amount is 3× or more above the merchant average',
    NEW_DEVICE:       'Unrecognised device fingerprint',
    GEO_MISMATCH:     'Billing country does not match IP geolocation',
    ANOMALY_DETECTED: 'ML Isolation Forest model flagged a statistical anomaly',
    ROUND_AMOUNT:     'Suspiciously round kobo amount — common fraud fingerprint',
    FIRST_TIME_PAYER: 'No prior transaction history for this email',
    BIN_PATTERN:      'Card prefix (BIN) linked to multiple different emails',
    BEHAVIOUR_MISMATCH: 'Sudden jump from small habitual amounts to a large payment',
    HIGH_VALUE_NEW:   'First-time customer with an unusually high payment amount',
  };

  const reasonsHtml = (t.codes || []).length
    ? (t.codes || []).map(c => `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;vertical-align:top">
            <span style="font-family:monospace;font-size:11px;font-weight:700;color:${col};background:${colBg};padding:2px 8px;border-radius:4px;border:1px solid ${col}">${c}</span>
          </td>
          <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#475569;font-size:13px;vertical-align:top">${SIGNAL_DESC[c] || 'Risk signal triggered'}</td>
        </tr>`).join('')
    : `<tr><td colspan="2" style="padding:10px 12px;color:#94a3b8;font-style:italic">No risk signals detected</td></tr>`;

  const featuresHtml = t.features
    ? Object.entries(t.features).map(([k, v]) => {
        const fv = parseFloat(v);
        const fc = fv > 2 ? '#dc2626' : fv > 1 ? '#d97706' : '#16a34a';
        const bar = Math.min(100, fv * 20);
        return `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:12px;font-family:monospace">${k}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0">
            <div style="display:flex;align-items:center;gap:10px">
              <div style="flex:1;height:6px;background:#e2e8f0;border-radius:3px">
                <div style="width:${bar}%;height:6px;background:${fc};border-radius:3px"></div>
              </div>
              <span style="font-weight:700;color:${fc};font-size:12px;font-family:monospace;min-width:32px;text-align:right">${v}</span>
            </div>
          </td>
        </tr>`;
      }).join('')
    : '';

  const plain = t.tier === 'GREEN'
    ? `This transaction from <strong>${t.email}</strong> is <strong style="color:#16a34a">low risk</strong>. The payment of ${fmtMoney(t.amount)} is consistent with normal customer behaviour. Sentinel's AI engine assigned a score of ${t.score}/100 — safe to process and fulfil.`
    : t.tier === 'AMBER'
    ? `This transaction from <strong>${t.email}</strong> requires <strong style="color:#d97706">manual review</strong>. ${(t.codes||[]).length} risk signal(s) were detected. The payment of ${fmtMoney(t.amount)} scored ${t.score}/100 — verify customer identity before fulfilling the order.`
    : `This transaction from <strong>${t.email}</strong> is <strong style="color:#dc2626">high risk and was automatically blocked</strong>. ${(t.codes||[]).length} critical fraud signal(s) triggered. The payment of ${fmtMoney(t.amount)} scored ${t.score}/100. Sentinel's rule engine, Z-score model, and Isolation Forest all flagged this as likely fraudulent activity.`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Sentinel Report — ${t.ref}</title>
<style>
@media print {
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  body { margin: 0; }
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #ffffff; color: #1e293b; padding: 32px 24px; font-size: 14px; line-height: 1.5; }
.page { max-width: 720px; margin: 0 auto; }

/* Header */
.header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 20px; border-bottom: 2px solid #0d2137; margin-bottom: 24px; }
.brand { display: flex; flex-direction: column; }
.brand-name { font-size: 22px; font-weight: 800; color: #0d2137; letter-spacing: 2px; }
.brand-sub  { font-size: 11px; color: #64748b; letter-spacing: 1px; margin-top: 2px; }
.header-right { text-align: right; }
.report-title { font-size: 13px; font-weight: 600; color: #0d2137; }
.report-date  { font-size: 11px; color: #94a3b8; margin-top: 3px; }

/* Ref + badge row */
.ref-row  { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
.ref-val  { font-family: monospace; font-size: 15px; font-weight: 700; color: #0d2137; }
.tier-badge { padding: 4px 14px; border-radius: 20px; font-size: 11px; font-weight: 700; border: 1.5px solid ${col}; color: ${col}; background: ${colBg}; letter-spacing: 1px; }

/* Section */
.sec { margin-bottom: 24px; }
.sec-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: #94a3b8; margin-bottom: 10px; padding-left: 10px; border-left: 3px solid ${col}; }

/* Grid cards */
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; }
.card-lbl { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; margin-bottom: 5px; }
.card-val { font-size: 15px; font-weight: 700; color: #1e293b; }

/* Score */
.score-row { display: flex; align-items: center; gap: 20px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; }
.score-ring { width: 68px; height: 68px; border-radius: 50%; border: 4px solid ${col}; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.score-num  { font-size: 24px; font-weight: 800; color: ${col}; }
.score-tier { font-size: 15px; font-weight: 700; color: ${col}; }
.score-desc { font-size: 12px; color: #64748b; margin-top: 4px; }

/* Timeline */
.timeline { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; }
.tl-row { display: flex; gap: 12px; padding: 6px 0; border-bottom: 1px solid #e2e8f0; font-size: 12px; }
.tl-row:last-child { border-bottom: none; }
.tl-time { color: #94a3b8; font-family: monospace; min-width: 70px; }
.tl-text { color: #475569; }

/* Tables */
table { width: 100%; border-collapse: collapse; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
th { background: #f1f5f9; padding: 8px 12px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; font-weight: 600; }

/* Plain English */
.plain { background: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid ${col}; border-radius: 8px; padding: 16px; font-size: 13px; color: #334155; line-height: 1.7; }

/* Raw payload */
.raw { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; font-family: monospace; font-size: 10px; color: #64748b; white-space: pre-wrap; word-break: break-all; }

/* Footer */
.footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 11px; color: #94a3b8; }
</style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div class="header">
    <div class="brand">
      <div class="brand-name">SENTINEL</div>
      <div class="brand-sub">AI Fraud Detection · Trust Monitor</div>
    </div>
    <div class="header-right">
      <div class="report-title">Transaction Risk Report</div>
      <div class="report-date">${nowStr}</div>
    </div>
  </div>

  <!-- Ref + badge -->
  <div class="ref-row">
    <span class="ref-val">${t.ref}</span>
    <span class="tier-badge">${t.tier} RISK</span>
  </div>

  <!-- Summary -->
  <div class="sec">
    <div class="sec-title">Summary</div>
    <div class="grid">
      <div class="card"><div class="card-lbl">Amount</div><div class="card-val">${fmtMoney(t.amount)}</div></div>
      <div class="card"><div class="card-lbl">Customer</div><div class="card-val" style="font-size:13px">${t.email}</div></div>
      <div class="card"><div class="card-lbl">Time</div><div class="card-val" style="font-size:13px">${timeStr}</div></div>
      <div class="card"><div class="card-lbl">Decision</div><div class="card-val" style="color:${col}">${(t.status || t.tier).toUpperCase()}</div></div>
    </div>
  </div>

  <!-- AI Trust Score -->
  <div class="sec">
    <div class="sec-title">AI Trust Score</div>
    <div class="score-row">
      <div class="score-ring"><span class="score-num">${t.score}</span></div>
      <div>
        <div class="score-tier">${t.tier} — ${t.score}/100</div>
        <div class="score-desc">${t.tier === 'GREEN' ? 'Low risk — safe to process and fulfil.' : t.tier === 'AMBER' ? 'Medium risk — manual review recommended before fulfilment.' : 'High risk — automatically blocked by Sentinel.'}</div>
        <div style="margin-top:8px;font-size:11px;color:#94a3b8">Engine: ${t.model_trained !== false ? 'Rule Engine (R01–R08) + Z-Score + Isolation Forest ML' : 'Rule Engine (R01–R08) + Z-Score'}</div>
      </div>
    </div>
  </div>

  <!-- Timeline -->
  <div class="sec">
    <div class="sec-title">Timeline</div>
    <div class="timeline">
      <div class="tl-row"><span class="tl-time">${timeStr}</span><span class="tl-text">Transaction received — ${fmtMoney(t.amount)} from ${t.email}</span></div>
      <div class="tl-row"><span class="tl-time">${timeStr}</span><span class="tl-text">Sentinel risk analysis initiated (Rules R01–R08, Z-Score, ML)</span></div>
      <div class="tl-row"><span class="tl-time">${timeStr}</span><span class="tl-text">${(t.codes||[]).length} risk signal(s) detected — score ${t.score}/100</span></div>
      <div class="tl-row"><span class="tl-time">${timeStr}</span><span class="tl-text">Decision: <strong style="color:${col}">${(t.status || t.tier).toUpperCase()}</strong></span></div>
      <div class="tl-row"><span class="tl-time">${now.toLocaleTimeString('en-GB')}</span><span class="tl-text">Report generated</span></div>
    </div>
  </div>

  <!-- Rules Triggered -->
  <div class="sec">
    <div class="sec-title">Risk Signals — ${(t.codes||[]).length} triggered</div>
    <table>
      <thead><tr><th>Signal Code</th><th>Description</th></tr></thead>
      <tbody>${reasonsHtml}</tbody>
    </table>
  </div>

  <!-- ML Output -->
  <div class="sec">
    <div class="sec-title">ML Output</div>
    <div class="grid">
      <div class="card"><div class="card-lbl">Trust Score</div><div class="card-val" style="color:${col}">${t.score} / 100</div></div>
      <div class="card"><div class="card-lbl">Confidence</div><div class="card-val" style="font-size:13px">${t.tier === 'GREEN' ? 'High — Legitimate' : t.tier === 'AMBER' ? 'Moderate — Review' : 'High — Fraudulent'}</div></div>
    </div>
  </div>

  ${featuresHtml ? `
  <div class="sec">
    <div class="sec-title">Feature Deviations</div>
    <table>
      <thead><tr><th>Feature</th><th>Value vs. Baseline</th></tr></thead>
      <tbody>${featuresHtml}</tbody>
    </table>
  </div>` : ''}

  <!-- Plain English -->
  <div class="sec">
    <div class="sec-title">Plain English Summary</div>
    <div class="plain">${plain}</div>
  </div>

  <!-- Raw Payload -->
  <div class="sec">
    <div class="sec-title">Raw Payload</div>
    <div class="raw">${JSON.stringify(t, null, 2)}</div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <span>SENTINEL · AI Fraud Detection</span>
    <span>Generated ${nowStr}</span>
    <span>CONFIDENTIAL</span>
  </div>

</div>
</body>
</html>`;

  // Inject into hidden iframe and trigger print dialog
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:800px;height:600px;border:none;';
  document.body.appendChild(iframe);
  iframe.contentDocument.open();
  iframe.contentDocument.write(html);
  iframe.contentDocument.close();
  iframe.contentDocument.title = `report-${t.ref}`;
  setTimeout(() => {
    iframe.contentWindow.print();
    setTimeout(() => iframe.remove(), 10000);
  }, 800);
}

function closeModal() { document.getElementById('modal-mount').innerHTML = ''; }

function approveIt(ref) {
  const t = S.transactions.find(x => x.ref === ref);
  if (t) {
    t.status = 'approved';
    t.tier   = 'GREEN';
    S.flagged = Math.max(0, S.flagged - 1);
  }
  closeModal();
  renderFeed();
  syncKPIs();
  fetch(`/api/transactions/${encodeURIComponent(ref)}`, {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ status: 'approved', tier: 'GREEN' }),
  }).catch(() => {});
  const el = document.createElement('div');
  el.className = 'toast toast-g';
  el.innerHTML = `<span class="t-icon">✅</span><div class="t-body"><strong>APPROVED</strong><br/>Transaction approved and saved</div>`;
  document.getElementById('toasts').appendChild(el);
  setTimeout(() => el.remove(), 2500);
}

function disputeModal(ref) {
  const t = S.transactions.find(x => x.ref === ref);
  const d = S.disputes.find(x => x.ref === ref);
  if (!t && !d) return;

  // Use transaction data if available; fall back to dispute record for missing fields
  const score    = t?.score    ?? d?.score    ?? '—';
  const amount   = t?.amount   ?? d?.amount   ?? 0;
  const email    = t?.email    ?? '—';
  const codes    = t?.codes    || t?.reasons  || [];
  const amtAvg   = t?.features?.amount_vs_avg ?? '—';
  const trained  = t?.model_trained !== false;

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
              Trust Score: <strong style="color:var(--crimson)">${score}/100 — HIGH RISK</strong><br/>
              Customer: <strong>${email}</strong><br/>
              Amount: <strong>${money(amount)}</strong><br/>
              Signals: <strong>${codes.join(' + ') || 'ANOMALY_DETECTED'}</strong><br/>
              Model: <strong>${trained ? 'Rule Engine + Z-Score + Isolation Forest' : 'Heuristic fallback'}</strong><br/>
              Deviation: <strong>${amtAvg}× above customer avg</strong>
            </div>
          </div>
          <div style="font-size:11px;color:var(--t3);line-height:1.6">
            This evidence will be submitted to Squad's Disputes API. Sentinel's ML analysis
            proves this transaction was high-risk before fulfillment.
          </div>
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
  fetch(`/api/disputes/${encodeURIComponent(ref)}/submit`, { method: 'POST' })
    .catch(() => {});
  const el = document.createElement('div');
  el.className = 'toast toast-g';
  el.innerHTML = `<span class="t-icon">✅</span><div class="t-body"><strong>SUBMITTED</strong><br/>Evidence sent to Squad Disputes API</div>`;
  document.getElementById('toasts').appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

//DISPUTES
function renderDisputes() {
  document.getElementById('disputes-tbody').innerHTML = S.disputes.map(d => `
    <tr style="border-bottom:1px solid var(--line);cursor:pointer" onclick="disputeModal('${d.ref}')" title="Click to fight this dispute">
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

//SOCKET
function initSocket() {
  if (typeof io !== 'undefined') {
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
  } else {
    console.log('Socket.io not loaded - running in standalone mode');
    document.getElementById('conn-dot').className = 'conn-dot error';
    document.getElementById('conn-label').textContent = 'Standalone';
  }
}

//DEMO
function startDemo() {
  if (S.demoTimer) clearInterval(S.demoTimer);
  S.demoTimer = setInterval(() => {
    const r = Math.random();
    if (r < 0.05) simulateRed();
    else if (r < 0.15) simulateAmber();
    else simulateGreen();
  }, 45000);
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