// ─── IPORDISE Admin — Firebase Analytics Dashboard ────────────────────────────
// Auth: Firebase Email/Password   Data: Firestore   No server required.

import { initializeApp }
  from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged }
  from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js';
import {
  getFirestore, collection, doc,
  getDoc, getDocs, setDoc,
  query, orderBy, limit, where,
} from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js';

// ─── FIREBASE ─────────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            'AIzaSyAt-fnGB3Y69qEmg4pjOWneKrutbnQLMM4',
  authDomain:        'ipordise-aef54.firebaseapp.com',
  projectId:         'ipordise-aef54',
  storageBucket:     'ipordise-aef54.firebasestorage.app',
  messagingSenderId: '870679323928',
  appId:             '1:870679323928:web:d3f03a8dddff119951ea6d',
};
const fbApp = initializeApp(firebaseConfig);
const auth  = getAuth(fbApp);
const db    = getFirestore(fbApp);

// Change this to match the admin account email in your Firebase Auth console
const ADMIN_EMAIL = 'admin@ipordise.com';

// ─── UTILITIES ────────────────────────────────────────────────────────────────
const qs  = (sel, ctx = document) => ctx.querySelector(sel);
const qsa = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
const esc = (s) => { const d = document.createElement('div'); d.textContent = String(s || ''); return d.innerHTML; };
const fmtNum = (n) => Number(n).toLocaleString();
const fmtDate = (str) => new Date(str).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
const toDate  = (ts) => ts?.toDate ? ts.toDate() : (ts ? new Date(ts) : new Date(0));
const fmtDateTime = (ts) => toDate(ts).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
const relTime = (ts) => {
  const diff = Math.max(0, Date.now() - toDate(ts).getTime());
  if (diff < 60_000)     return 'just now';
  if (diff < 3_600_000)  return `${Math.round(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h ago`;
  return `${Math.round(diff / 86_400_000)}d ago`;
};
const deviceIcon = (t) => ({ mobile: '<i class="fas fa-mobile-screen"></i>', tablet: '<i class="fas fa-tablet-screen-button"></i>', desktop: '<i class="fas fa-desktop"></i>' }[t] || '<i class="fas fa-desktop"></i>');
const today = () => new Date().toISOString().slice(0, 10);

// ─── STATE ────────────────────────────────────────────────────────────────────
const state = {
  currentView:    'overview',
  trafficRange:   30,
  analyticsRange: 30,
  filters: { device: '', search: '', page: '' },
  pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
  charts:  { visitsOverTime: null, deviceBreakdown: null, analyticsDaily: null },
  pollers: [],
};

// ─── TOAST ────────────────────────────────────────────────────────────────────
const toast = (msg, type = 'info', duration = 3500) => {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  qs('#toastContainer').appendChild(el);
  setTimeout(() => {
    el.style.animation = 'toastOut .2s ease forwards';
    el.addEventListener('animationend', () => el.remove());
  }, duration);
};

// ─── THEME ────────────────────────────────────────────────────────────────────
const setTheme = (theme) => {
  document.body.setAttribute('data-theme', theme);
  localStorage.setItem('ipordise-admin-theme', theme);
  const ic = qs('#themeIcon');
  if (ic) ic.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
};
const initTheme = () => {
  const s = localStorage.getItem('ipordise-admin-theme');
  setTheme(s === 'dark' || s === 'light' ? s : (window.matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light'));
};

// ─── SIDEBAR + VIEW NAV ───────────────────────────────────────────────────────
const openMobileSidebar  = () => { qs('#sidebar')?.classList.add('open'); qs('#sidebarOverlay')?.classList.add('open'); };
const closeMobileSidebar = () => { qs('#sidebar')?.classList.remove('open'); qs('#sidebarOverlay')?.classList.remove('open'); };
const switchView = (name) => {
  state.currentView = name;
  qsa('.view').forEach(el => el.classList.remove('active'));
  qs('#view-' + name)?.classList.add('active');
  qsa('.sidebar-item[data-view]').forEach(it => it.classList.toggle('active', it.dataset.view === name));
  if (name === 'visitors')  loadVisitors().catch(e => toast(e.message, 'error'));
  if (name === 'analytics') loadAnalyticsView().catch(e => toast(e.message, 'error'));
  if (name === 'activity')  loadActivity().catch(e => toast(e.message, 'error'));
  if (name === 'orders')    loadOrdersView().catch(e => toast(e.message, 'error'));
  if (name === 'customers') loadCustomersView().catch(e => toast(e.message, 'error'));
  if (window.innerWidth < 768) closeMobileSidebar();
};
const initSidebar = () => {
  qs('#menuBtn')?.addEventListener('click', openMobileSidebar);
  qs('#sidebarOverlay')?.addEventListener('click', closeMobileSidebar);
  qsa('.sidebar-item[data-view]').forEach(it => it.addEventListener('click', () => switchView(it.dataset.view)));
  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-view]');
    if (btn && !btn.classList.contains('sidebar-item')) switchView(btn.dataset.view);
  });
};

// ─── SCREENS ─────────────────────────────────────────────────────────────────
const showAuth      = () => { qs('#authScreen').classList.remove('hidden'); qs('#dashboardScreen').classList.add('hidden'); };
const showDashboard = () => { qs('#authScreen').classList.add('hidden'); qs('#dashboardScreen').classList.remove('hidden'); };

// ─── ANIMATED COUNTER ─────────────────────────────────────────────────────────
const animateCount = (el, target, dur = 700) => {
  if (!el) return;
  const start = parseInt(el.textContent.replace(/,/g, ''), 10) || 0;
  const diff  = target - start;
  if (!diff) { el.textContent = fmtNum(target); return; }
  const t0 = performance.now();
  const step = (now) => {
    const p = Math.min((now - t0) / dur, 1);
    el.textContent = fmtNum(Math.round(start + diff * (1 - Math.pow(1 - p, 3))));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
};

// ─── STATS GRID ───────────────────────────────────────────────────────────────
const setLoadingSkeleton = () => {
  qs('#statsGrid').innerHTML = Array.from({ length: 5 }, () =>
    '<div class="stat-card"><div class="skeleton" style="height:80px;border-radius:var(--radius-md)"></div></div>'
  ).join('');
};
const STAT_DEFS = [
  { key: 'totalVisits',       label: 'Total Page Views', icon: 'fas fa-chart-bar',    accent: 'var(--gold)' },
  { key: 'todayVisits',       label: "Today's Views",    icon: 'fas fa-calendar-day', accent: 'var(--sky)' },
  { key: 'uniqueVisitors',    label: 'Total Sessions',   icon: 'fas fa-users',        accent: 'var(--emerald)' },
  { key: 'returningVisitors', label: 'Returning',        icon: 'fas fa-rotate-right', accent: 'var(--amber)' },
  { key: 'onlineNow',         label: 'Online Now',       icon: 'fas fa-wifi',         accent: 'var(--rose)' },
];
const updateStats = (stats) => {
  const grid    = qs('#statsGrid');
  const isFirst = !grid.querySelector('[data-stat]');
  if (isFirst) {
    grid.innerHTML = STAT_DEFS.map(d => `
      <div class="stat-card" style="--stat-accent:${d.accent}">
        <div class="stat-card-icon"><i class="${d.icon}"></i></div>
        <div class="stat-card-val" data-stat="${d.key}">${fmtNum(stats[d.key] || 0)}</div>
        <div class="stat-card-label">${d.label}</div>
      </div>`).join('');
  } else {
    STAT_DEFS.forEach(d => {
      const el = grid.querySelector('[data-stat="' + d.key + '"]');
      if (el) animateCount(el, Number(stats[d.key] || 0));
    });
  }
  animateCount(qs('#onlineCount'), Number(stats.onlineNow || 0));
  const badge = qs('#navTodayBadge');
  if (badge) badge.textContent = fmtNum(stats.todayVisits || 0);
};

// ─── LATEST VISITORS ─────────────────────────────────────────────────────────
const renderLatestVisitors = (rows) => {
  const tbody  = qs('#latestVisitorsBody');
  const mobile = qs('#latestVisitorsMobile');
  if (!tbody) return;
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--muted);padding:24px">No visitor data yet.</td></tr>';
    if (mobile) mobile.innerHTML = '';
    return;
  }
  tbody.innerHTML = rows.map(r => `<tr>
    <td class="td-mono td-muted">${relTime(r.startTime)}</td>
    <td class="td-mono td-short">${esc(r.id?.slice(0, 10) || '-')}</td>
    <td class="td-page">${esc(r.entryPage || '/')}</td>
    <td>${deviceIcon(r.device)} <span class="td-muted" style="font-size:11px">${esc(r.device || '-')}</span></td>
    <td class="td-mono td-muted" style="font-size:11px">${esc(r.ip || '-')}</td>
    <td class="td-muted" style="font-size:11px">${r.city ? esc(r.city) + (r.country ? ', ' + esc(r.country) : '') : (r.country ? esc(r.country) : '-')}</td>
    <td class="td-muted">${esc(r.referrer || 'direct')}</td>
    <td class="td-muted">${r.duration ? r.duration + 's' : '-'}</td>
    <td><span class="badge ${r.isNew === false ? 'badge-gold' : 'badge-green'}">${r.isNew === false ? 'Returning' : 'New'}</span></td>
  </tr>`).join('');
  if (mobile) mobile.innerHTML = rows.map(r => `<div class="mobile-card">
    <div class="mobile-card-row"><span class="mobile-card-key">Time</span><span class="mobile-card-val">${relTime(r.startTime)}</span></div>
    <div class="mobile-card-row"><span class="mobile-card-key">Page</span><span class="mobile-card-val">${esc(r.entryPage || '/')}</span></div>
    <div class="mobile-card-row"><span class="mobile-card-key">Device</span><span class="mobile-card-val">${deviceIcon(r.device)} ${esc(r.device || '-')}</span></div>
    <div class="mobile-card-row"><span class="mobile-card-key">IP</span><span class="mobile-card-val td-mono" style="font-size:11px">${esc(r.ip || '-')}</span></div>
    <div class="mobile-card-row"><span class="mobile-card-key">Location</span><span class="mobile-card-val">${r.city ? esc(r.city) + (r.country ? ', ' + esc(r.country) : '') : (r.country ? esc(r.country) : '-')}</span></div>
    <div class="mobile-card-row"><span class="mobile-card-key">Referrer</span><span class="mobile-card-val">${esc(r.referrer || 'direct')}</span></div>
    <div class="mobile-card-row"><span class="mobile-card-key">Type</span><span class="mobile-card-val"><span class="badge ${r.isNew === false ? 'badge-gold' : 'badge-green'}">${r.isNew === false ? 'Returning' : 'New'}</span></span></div>
  </div>`).join('');
};

// ─── VISITORS TABLE ───────────────────────────────────────────────────────────
const renderVisitorsTable = (rows) => {
  const tbody  = qs('#visitorsBody');
  const mobile = qs('#visitorsMobile');
  if (!rows.length) {
    if (tbody)  tbody.innerHTML  = '<tr><td colspan="9" style="text-align:center;color:var(--muted);padding:24px">No records found.</td></tr>';
    if (mobile) mobile.innerHTML = '<div style="color:var(--muted);text-align:center;padding:20px">No records found.</div>';
    return;
  }
  if (tbody) tbody.innerHTML = rows.map(r => `<tr>
    <td class="td-mono td-muted">${fmtDateTime(r.startTime)}</td>
    <td class="td-mono td-short">${esc(r.id?.slice(0, 10) || '-')}</td>
    <td class="td-page" title="${esc(r.entryPage)}">${esc(r.entryPage || '/')}</td>
    <td>${deviceIcon(r.device)} <span class="td-muted" style="font-size:11px">${esc(r.device || '-')}</span></td>
    <td class="td-mono td-muted" style="font-size:11px">${esc(r.ip || '-')}</td>
    <td class="td-muted" style="font-size:11px">${r.city ? esc(r.city) + (r.country ? ', ' + esc(r.country) : '') : (r.country ? esc(r.country) : '-')}</td>
    <td class="td-muted">${esc(r.referrer || 'direct')}</td>
    <td class="td-muted">${r.duration ? r.duration + 's' : '-'}</td>
    <td><span class="badge ${r.isNew === false ? 'badge-gold' : 'badge-green'}">${r.isNew === false ? 'Returning' : 'New'}</span></td>
  </tr>`).join('');
  if (mobile) mobile.innerHTML = rows.map(r => `<div class="mobile-card">
    <div class="mobile-card-row"><span class="mobile-card-key">Time</span><span class="mobile-card-val">${fmtDateTime(r.startTime)}</span></div>
    <div class="mobile-card-row"><span class="mobile-card-key">Session</span><span class="mobile-card-val td-mono">${esc(r.id?.slice(0, 10) || '-')}</span></div>
    <div class="mobile-card-row"><span class="mobile-card-key">Page</span><span class="mobile-card-val">${esc(r.entryPage || '/')}</span></div>
    <div class="mobile-card-row"><span class="mobile-card-key">Device</span><span class="mobile-card-val">${deviceIcon(r.device)} ${esc(r.device || '-')}</span></div>
    <div class="mobile-card-row"><span class="mobile-card-key">IP</span><span class="mobile-card-val td-mono" style="font-size:11px">${esc(r.ip || '-')}</span></div>
    <div class="mobile-card-row"><span class="mobile-card-key">Location</span><span class="mobile-card-val">${r.city ? esc(r.city) + (r.country ? ', ' + esc(r.country) : '') : (r.country ? esc(r.country) : '-')}</span></div>
    <div class="mobile-card-row"><span class="mobile-card-key">Referrer</span><span class="mobile-card-val">${esc(r.referrer || 'direct')}</span></div>
    <div class="mobile-card-row"><span class="mobile-card-key">Type</span><span class="mobile-card-val"><span class="badge ${r.isNew === false ? 'badge-gold' : 'badge-green'}">${r.isNew === false ? 'Returning' : 'New'}</span></span></div>
  </div>`).join('');
};

// ─── PAGINATION ───────────────────────────────────────────────────────────────
const renderPagination = () => {
  const { page, totalPages, total } = state.pagination;
  const info = qs('#paginationInfo');
  if (info) info.textContent = `Page ${page} of ${totalPages} — ${fmtNum(total)} records`;
  const lbl = qs('#visitorCountLabel');
  if (lbl) lbl.textContent = `${fmtNum(total)} records`;
  const controls = qs('#paginationControls');
  if (!controls) return;
  controls.innerHTML = `
    <button class="page-btn" id="pagePrev" ${page <= 1 ? 'disabled' : ''}>Prev</button>
    <button class="page-btn active">${page} / ${totalPages}</button>
    <button class="page-btn" id="pageNext" ${page >= totalPages ? 'disabled' : ''}>Next</button>
  `;
  qs('#pagePrev')?.addEventListener('click', () => { if (state.pagination.page > 1) { state.pagination.page--; loadVisitors().catch(e => toast(e.message, 'error')); } });
  qs('#pageNext')?.addEventListener('click', () => { if (state.pagination.page < state.pagination.totalPages) { state.pagination.page++; loadVisitors().catch(e => toast(e.message, 'error')); } });
};

// ─── RANK LIST ────────────────────────────────────────────────────────────────
const renderRankList = (selector, rows) => {
  const el = qs(selector);
  if (!el) return;
  if (!rows.length) { el.innerHTML = '<div class="rank-item"><span class="rank-label td-muted">No data yet</span></div>'; return; }
  const max = rows[0]?.value || 1;
  el.innerHTML = rows.map((r, i) => `<div class="rank-item">
    <span class="rank-num">${i + 1}</span>
    <span class="rank-label">${esc(r.name)}</span>
    <div class="rank-bar-wrap"><div class="rank-bar-fill" style="width:${Math.round(r.value / max * 100)}%"></div></div>
    <span class="rank-count">${fmtNum(r.value)}</span>
  </div>`).join('');
};

// ─── ACTIVITY FEED ────────────────────────────────────────────────────────────
const actCls = (page) => {
  const p = (page || '').toLowerCase();
  if (p.includes('product') || p.includes('perfume')) return 'activity-icon-product';
  if (p.includes('cart')    || p.includes('checkout')) return 'activity-icon-cart';
  return 'activity-icon-page';
};
const actFa = (page) => {
  const p = (page || '').toLowerCase();
  if (p.includes('product') || p.includes('perfume')) return 'fa-bottle-droplet';
  if (p.includes('cart')    || p.includes('checkout')) return 'fa-cart-shopping';
  return 'fa-eye';
};
const renderActivity = (rows) => {
  const feed = qs('#activityFeed');
  if (!feed) return;
  if (!rows.length) { feed.innerHTML = '<div style="color:var(--muted);text-align:center;padding:24px">No activity yet.</div>'; return; }
  feed.innerHTML = rows.map(r => `<div class="activity-item">
    <div class="activity-icon ${actCls(r.currentPage || r.entryPage)}"><i class="fas ${actFa(r.currentPage || r.entryPage)}"></i></div>
    <div class="activity-body">
      <div class="activity-page">${esc(r.currentPage || r.entryPage || '/')}</div>
      <div class="activity-meta">
        <span>${deviceIcon(r.device)}</span>
        <span class="activity-meta-sep">·</span><span>${esc(r.referrer || 'direct')}</span>
        ${r.converted ? '<span class="activity-meta-sep">·</span><span class="badge badge-green">converted</span>' : ''}
        ${r.checkoutStarted ? '<span class="activity-meta-sep">·</span><span class="badge badge-gold">checkout</span>' : ''}
      </div>
    </div>
    <div class="activity-time">${relTime(r.lastSeen)}</div>
  </div>`).join('');
};

// ─── CHARTS ───────────────────────────────────────────────────────────────────
const chartCfg = () => document.body.getAttribute('data-theme') === 'dark'
  ? { gold: '#c8a96a', goldFill: 'rgba(200,169,106,.12)', sky: '#38bdf8', emerald: '#22c55e', rose: '#f43f5e', amber: '#f59e0b', grid: 'rgba(255,255,255,.06)', ticks: 'rgba(255,255,255,.35)', tooltip: '#1c1c2a' }
  : { gold: '#b8922a', goldFill: 'rgba(184,146,42,.1)',   sky: '#0369a1', emerald: '#16a34a', rose: '#dc2626', amber: '#d97706', grid: 'rgba(0,0,0,.06)', ticks: 'rgba(0,0,0,.4)', tooltip: '#ffffff' };

const upsertChart = (key, canvas, config) => {
  if (!canvas || typeof window.Chart !== 'function') return;
  if (state.charts[key]) { try { state.charts[key].destroy(); } catch {} state.charts[key] = null; }
  state.charts[key] = new window.Chart(canvas, config);
};

const renderCharts = (visitsByDay, deviceBreakdown) => {
  const cc = chartCfg();
  const tooltipBase = { backgroundColor: cc.tooltip, titleColor: cc.gold, bodyColor: document.body.getAttribute('data-theme') === 'dark' ? '#f0f0f8' : '#111128', borderColor: 'rgba(200,169,106,.3)', borderWidth: 1, padding: 10 };
  const labels = visitsByDay.map(d => fmtDate(d.day));
  const data   = visitsByDay.map(d => d.visits);
  upsertChart('visitsOverTime', qs('#visitsOverTimeChart'), {
    type: 'line',
    data: { labels, datasets: [{ label: 'Page Views', data, borderColor: cc.gold, backgroundColor: cc.goldFill, fill: true, borderWidth: 2.5, tension: .4, pointRadius: data.length > 30 ? 0 : 3, pointHoverRadius: 5, pointBackgroundColor: cc.gold }] },
    options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { display: false }, tooltip: tooltipBase }, scales: { x: { grid: { color: cc.grid }, ticks: { color: cc.ticks, font: { size: 11 }, maxTicksLimit: 8 } }, y: { beginAtZero: true, grid: { color: cc.grid }, ticks: { color: cc.ticks, font: { size: 11 }, precision: 0 } } } },
  });
  const devColors = [cc.gold, cc.sky, cc.emerald, cc.rose, cc.amber];
  upsertChart('deviceBreakdown', qs('#deviceBreakdownChart'), {
    type: 'doughnut',
    data: { labels: deviceBreakdown.map(d => d.name), datasets: [{ data: deviceBreakdown.map(d => d.value), backgroundColor: devColors, borderWidth: 0, hoverOffset: 6 }] },
    options: { responsive: true, maintainAspectRatio: false, cutout: '72%', plugins: { legend: { display: false }, tooltip: tooltipBase } },
  });
  const total = deviceBreakdown.reduce((s, d) => s + d.value, 0);
  animateCount(qs('#donutTotalVal'), total);
  const legend = qs('#deviceLegend');
  if (legend) legend.innerHTML = deviceBreakdown.map((d, i) => `<li><span class="donut-legend-dot" style="background:${devColors[i]}"></span><span>${esc(d.name)}</span><span class="donut-legend-val">${fmtNum(d.value)}</span></li>`).join('');
};

const renderAnalyticsChart = (visitsByDay) => {
  const cc = chartCfg();
  const tooltipBase = { backgroundColor: cc.tooltip, titleColor: cc.gold, bodyColor: document.body.getAttribute('data-theme') === 'dark' ? '#f0f0f8' : '#111128', borderColor: 'rgba(200,169,106,.3)', borderWidth: 1 };
  upsertChart('analyticsDaily', qs('#analyticsDailyChart'), {
    type: 'bar',
    data: { labels: visitsByDay.map(d => fmtDate(d.day)), datasets: [{ label: 'Page Views', data: visitsByDay.map(d => d.visits), backgroundColor: cc.goldFill, borderColor: cc.gold, borderWidth: 1, borderRadius: 4, borderSkipped: false }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: tooltipBase }, scales: { x: { grid: { color: cc.grid }, ticks: { color: cc.ticks, font: { size: 11 }, maxTicksLimit: 12 } }, y: { beginAtZero: true, grid: { color: cc.grid }, ticks: { color: cc.ticks, font: { size: 11 }, precision: 0 } } } },
  });
};

// ─── FIRESTORE DATA ───────────────────────────────────────────────────────────
const getVisitsByDay = async (days) => {
  // days=0 means today only (since midnight)
  const sinceKey = days === 0
    ? new Date().toISOString().slice(0, 10)
    : new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  try {
    const snap = await getDocs(
      query(collection(db, 'analytics_daily'), where('date', '>=', sinceKey), orderBy('date', 'asc'))
    );
    return snap.docs.map(d => ({ day: d.id, visits: d.data().pageViews || 0 }));
  } catch { return []; }
};

const getOverviewStats = async () => {
  const todaySnap  = await getDoc(doc(db, 'analytics_daily', today())).catch(() => null);
  const todayData  = todaySnap?.exists() ? todaySnap.data() : {};
  const todayVisits = todayData.pageViews || 0;

  let totalVisits = 0, totalSessions = 0, totalNew = 0;
  try {
    const allSnap = await getDocs(collection(db, 'analytics_daily'));
    allSnap.forEach(d => {
      const x = d.data();
      totalVisits   += x.pageViews   || 0;
      totalSessions += x.sessions    || 0;
      totalNew      += x.newSessions || 0;
    });
  } catch {}

  let onlineNow = 0;
  try {
    const liveSnap = await getDoc(doc(db, 'analytics_live', 'state'));
    if (liveSnap.exists()) {
      const v = liveSnap.data()?.v || {};
      onlineNow = Object.values(v).filter(s => (Date.now() - (s.t || 0)) < 5 * 60_000).length;
    }
  } catch {}

  return { totalVisits, todayVisits, uniqueVisitors: totalSessions, returningVisitors: Math.max(0, totalSessions - totalNew), onlineNow };
};

const getLatestVisitors = async () => {
  try {
    const snap = await getDocs(
      query(collection(db, 'analytics_sessions'), orderBy('startTime', 'desc'), limit(12))
    );
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch { return []; }
};

const aggregateSessions = async (days) => {
  // days=0 means today only (since midnight local time)
  let since;
  if (days === 0) {
    since = new Date();
    since.setHours(0, 0, 0, 0);
  } else {
    since = new Date(Date.now() - days * 86_400_000);
  }
  const pageMap = new Map(), deviceMap = new Map(), referrerMap = new Map();
  const countryMap = new Map(), cityMap = new Map();
  try {
    const snap = await getDocs(
      query(collection(db, 'analytics_sessions'),
        where('startTime', '>=', since),
        orderBy('startTime', 'desc'),
        limit(1000))
    );
    snap.forEach(d => {
      const r = d.data();
      const pg  = r.entryPage || '/';
      const dev = r.device    || 'desktop';
      const ref = r.referrer  || 'direct';
      pageMap.set(pg,  (pageMap.get(pg)   || 0) + 1);
      deviceMap.set(dev, (deviceMap.get(dev) || 0) + 1);
      referrerMap.set(ref, (referrerMap.get(ref) || 0) + 1);
      if (r.country) countryMap.set(r.country, (countryMap.get(r.country) || 0) + 1);
      if (r.city)    cityMap.set(r.city,    (cityMap.get(r.city)    || 0) + 1);
    });
  } catch {}
  const sorted = (map, n = 10) =>
    Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, n).map(([name, value]) => ({ name, value }));
  return {
    topPages:        sorted(pageMap, 12),
    deviceBreakdown: sorted(deviceMap, 5),
    topReferrers:    sorted(referrerMap, 8),
    topCountries:    sorted(countryMap, 10),
    topCities:       sorted(cityMap, 10),
  };
};

// ─── DATA LOADERS ─────────────────────────────────────────────────────────────
const loadOverview = async () => {
  const [stats, latestVisitors, visitsByDay, agg] = await Promise.all([
    getOverviewStats(),
    getLatestVisitors(),
    getVisitsByDay(state.trafficRange),
    aggregateSessions(state.trafficRange),
  ]);
  updateStats(stats);
  renderLatestVisitors(latestVisitors);
  renderCharts(visitsByDay, agg.deviceBreakdown);
  renderRankList('#topPagesList',         agg.topPages);
  renderRankList('#topCountriesList',     agg.topCountries.length ? agg.topCountries : [{ name: '🌍 Collecting — visit site to generate data', value: 0 }]);
  renderRankList('#browserBreakdownList', agg.topReferrers);
  const el = qs('#lastUpdated');
  if (el) el.textContent = 'Updated ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const loadVisitors = async () => {
  const { page, pageSize } = state.pagination;
  let allRows = [];
  try {
    const snap = await getDocs(
      query(collection(db, 'analytics_sessions'), orderBy('startTime', 'desc'), limit(2000))
    );
    allRows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) { toast('Could not load visitors: ' + e.message, 'error'); return; }

  const search = state.filters.search.toLowerCase();
  const device = state.filters.device;
  const pageF  = state.filters.page.toLowerCase();
  const filtered = allRows.filter(r => {
    if (search && !r.id.toLowerCase().includes(search) && !(r.entryPage || '').toLowerCase().includes(search)) return false;
    if (device && r.device !== device) return false;
    if (pageF  && !(r.entryPage || '').toLowerCase().includes(pageF))  return false;
    return true;
  });

  state.pagination.total      = filtered.length;
  state.pagination.totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const offset = (page - 1) * pageSize;
  renderVisitorsTable(filtered.slice(offset, offset + pageSize));
  renderPagination();
};

const loadAnalyticsView = async () => {
  const [visitsByDay, agg] = await Promise.all([
    getVisitsByDay(state.analyticsRange),
    aggregateSessions(state.analyticsRange),
  ]);
  renderAnalyticsChart(visitsByDay);
  renderRankList('#analyticsCountriesList', agg.topCountries.length ? agg.topCountries : [{ name: '🌍 Collecting — visit site to generate data', value: 0 }]);
  renderRankList('#analyticsCitiesList',    agg.topCities.length    ? agg.topCities    : [{ name: '🏙️ Collecting — visit site to generate data', value: 0 }]);
  renderRankList('#analyticsDevicesList',   agg.deviceBreakdown);
};

const loadActivity = async () => {
  try {
    const snap = await getDocs(
      query(collection(db, 'analytics_sessions'), orderBy('lastSeen', 'desc'), limit(25))
    );
    renderActivity(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (e) { toast('Could not load activity: ' + e.message, 'error'); }
};

const refreshAll = async () => {
  setLoadingSkeleton();
  await loadOverview();
};

// ─── FILTERS ─────────────────────────────────────────────────────────────────
const initFilters = () => {
  const applyFilters = () => {
    state.filters.search = qs('#filterSearch')?.value?.trim()  || '';
    state.filters.device = qs('#filterCountry')?.value?.trim() || '';
    state.filters.page   = qs('#filterPage')?.value?.trim()    || '';
    state.pagination.page = 1;
    loadVisitors().catch(e => toast(e.message, 'error'));
  };
  qs('#applyFiltersBtn')?.addEventListener('click', applyFilters);
  qs('#clearFiltersBtn')?.addEventListener('click', () => {
    ['filterSearch', 'filterCountry', 'filterCity', 'filterPage', 'filterStartDate', 'filterEndDate']
      .forEach(id => { const el = qs('#' + id); if (el) el.value = ''; });
    state.filters = { device: '', search: '', page: '' };
    state.pagination.page = 1;
    loadVisitors().catch(e => toast(e.message, 'error'));
  });
  qsa('#filterSearch,#filterCountry,#filterPage').forEach(inp =>
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') applyFilters(); })
  );
};

// ─── TOOLBAR ─────────────────────────────────────────────────────────────────
const initToolbar = () => {
  qs('#refreshBtn')?.addEventListener('click', () =>
    refreshAll().then(() => toast('Dashboard refreshed', 'success')).catch(() => {})
  );
  qs('#themeToggle')?.addEventListener('click', () => {
    const cur = document.body.getAttribute('data-theme');
    setTheme(cur === 'dark' ? 'light' : 'dark');
    if (state.currentView === 'overview')  loadOverview().catch(() => {});
    if (state.currentView === 'analytics') loadAnalyticsView().catch(() => {});
  });
  qs('#refreshActivityBtn')?.addEventListener('click', () =>
    loadActivity().then(() => toast('Feed refreshed', 'success')).catch(e => toast(e.message, 'error'))
  );
  qs('#trafficRange')?.addEventListener('change', e => {
    state.trafficRange = parseInt(e.target.value, 10); // 0 = Today, valid
    loadOverview().catch(e2 => toast(e2.message, 'error'));
  });
  qs('#analyticsRange')?.addEventListener('change', e => {
    state.analyticsRange = parseInt(e.target.value, 10);
    loadAnalyticsView().catch(e2 => toast(e2.message, 'error'));
  });
  const dateEl = qs('#todayDateLabel');
  if (dateEl) dateEl.textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
};

// ─── EXPORTS ─────────────────────────────────────────────────────────────────
const initExports = () => {
  const doExport = async (fmt) => {
    toast('Preparing export…', 'info');
    try {
      const snap = await getDocs(
        query(collection(db, 'analytics_sessions'), orderBy('startTime', 'desc'), limit(5000))
      );
      const rows = snap.docs.map(d => {
        const x = d.data();
        return { id: d.id, startTime: toDate(x.startTime).toISOString(), lastSeen: toDate(x.lastSeen).toISOString(), device: x.device, screen: x.screen, entryPage: x.entryPage, exitPage: x.exitPage, referrer: x.referrer, duration: x.duration, isNew: x.isNew, converted: x.converted };
      });
      let content, mimeType, ext;
      if (fmt === 'csv') {
        const cols = ['id', 'startTime', 'lastSeen', 'device', 'screen', 'entryPage', 'exitPage', 'referrer', 'duration', 'isNew', 'converted'];
        const e2 = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
        content = [cols.join(','), ...rows.map(r => cols.map(c => e2(r[c])).join(','))].join('\n');
        mimeType = 'text/csv'; ext = 'csv';
      } else {
        content = JSON.stringify(rows, null, 2);
        mimeType = 'application/json'; ext = 'json';
      }
      const blob = new Blob([content], { type: mimeType });
      const url  = URL.createObjectURL(blob);
      Object.assign(document.createElement('a'), { href: url, download: `ipordise-visitors-${Date.now()}.${ext}` }).click();
      URL.revokeObjectURL(url);
      toast('Downloaded!', 'success');
    } catch (e) { toast('Export failed: ' + e.message, 'error'); }
  };
  qs('#exportCsvBtn')?.addEventListener('click',  () => doExport('csv'));
  qs('#exportJsonBtn')?.addEventListener('click', () => doExport('json'));
  qs('#exportCsvBtn2')?.addEventListener('click', () => doExport('csv'));
  qs('#exportJsonBtn2')?.addEventListener('click',() => doExport('json'));
};

// ─── AUTH ─────────────────────────────────────────────────────────────────────
const REMEMBER_KEY = 'ipordise-admin-remember-email';

const doLogout = async () => {
  state.pollers.forEach(clearInterval); state.pollers = [];
  Object.values(state.charts).forEach(c => { if (c) { try { c.destroy(); } catch {} } });
  state.charts.visitsOverTime = null; state.charts.deviceBreakdown = null; state.charts.analyticsDaily = null;
  await signOut(auth).catch(() => {});
  showAuth();
};

const FIREBASE_ERR = {
  'auth/invalid-credential':     'Incorrect email or password.',
  'auth/wrong-password':         'Incorrect password.',
  'auth/user-not-found':         'No account found with that email.',
  'auth/too-many-requests':      'Too many attempts. Please wait a moment.',
  'auth/network-request-failed': 'Network error. Check your connection.',
  'auth/invalid-email':          'Invalid email address.',
};

const initAuth = () => {
  const pwdInput   = qs('#loginPassword');
  const pwdIcon    = qs('#togglePasswordIcon');
  const remember   = qs('#rememberLogin');
  const emailInput = qs('#loginUsername');
  const saved = localStorage.getItem(REMEMBER_KEY);
  if (saved && emailInput && remember) { emailInput.value = saved; remember.checked = true; }

  qs('#togglePasswordBtn')?.addEventListener('click', () => {
    const shown = pwdInput.type === 'text';
    pwdInput.type = shown ? 'password' : 'text';
    if (pwdIcon) pwdIcon.className = shown ? 'fas fa-eye' : 'fas fa-eye-slash';
  });

  qs('#loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const lbl = qs('#loginBtnLabel'), spn = qs('#loginBtnSpinner');
    lbl?.classList.add('hidden'); spn?.classList.remove('hidden');
    qs('#authError')?.classList.add('hidden');
    try {
      const email = emailInput.value.trim();
      const cred  = await signInWithEmailAndPassword(auth, email, pwdInput.value);
      if (cred.user.email?.toLowerCase() !== ADMIN_EMAIL) {
        await signOut(auth);
        throw new Error('Access denied — this account is not authorised as admin.');
      }
      if (remember?.checked) localStorage.setItem(REMEMBER_KEY, email);
      else localStorage.removeItem(REMEMBER_KEY);
      await bootstrapDashboard(cred.user);
    } catch (err) {
      const authErr = qs('#authError');
      if (authErr) { authErr.textContent = FIREBASE_ERR[err.code] || err.message; authErr.classList.remove('hidden'); }
    } finally { lbl?.classList.remove('hidden'); spn?.classList.add('hidden'); }
  });

  qs('#logoutBtn')?.addEventListener('click', () => doLogout().then(() => toast('Signed out', 'info')));

  qs('#forceLogoutAllBtn')?.addEventListener('click', async () => {
    if (!confirm('This will revoke ALL admin sessions on every device. Continue?')) return;
    try {
      await setDoc(doc(db, 'admin_config', 'security'), { revokedBefore: Date.now() }, { merge: true });
      toast('All sessions revoked — everyone must sign in again.', 'success');
    } catch (err) { toast('Error: ' + err.message, 'error'); }
    await doLogout();
  });

  const apiHint = qs('#apiHint');
  if (apiHint) apiHint.textContent = 'Firebase · ' + firebaseConfig.projectId;
};

// ─── BOOTSTRAP ───────────────────────────────────────────────────────────────
const bootstrapDashboard = async (user) => {
  try {
    const tokenResult   = await user.getIdTokenResult(true);
    const iat           = new Date(tokenResult.issuedAtTime).getTime();
    const configSnap    = await getDoc(doc(db, 'admin_config', 'security'));
    const revokedBefore = configSnap.exists() ? (configSnap.data()?.revokedBefore || 0) : 0;
    if (iat < revokedBefore) {
      await signOut(auth);
      showAuth();
      toast('Your session was revoked. Please sign in again.', 'error');
      return;
    }
  } catch {}

  const userEl = qs('#sidebarUserEmail');
  if (userEl) userEl.textContent = user.email || ADMIN_EMAIL;
  showDashboard();
  switchView('overview');
  setLoadingSkeleton();
  await refreshAll().catch(e => toast(e.message, 'error'));
  state.pollers.forEach(clearInterval); state.pollers = [];
  state.pollers = [
    setInterval(() => loadOverview().catch(() => {}),  30_000),
    setInterval(() => { if (state.currentView === 'activity') loadActivity().catch(() => {}); }, 15_000),
  ];
};

// ─── INIT ─────────────────────────────────────────────────────────────────────
const init = () => {
  initTheme();
  initAuth();
  initSidebar();
  initFilters();
  initExports();
  initToolbar();
  onAuthStateChanged(auth, async (user) => {
    if (user && !user.isAnonymous && user.email?.toLowerCase() === ADMIN_EMAIL) {
      try { await bootstrapDashboard(user); }
      catch { showAuth(); }
    } else {
      showAuth();
    }
  });
};

// ─── ORDERS VIEW ──────────────────────────────────────────────────────────────
let _allOrders = [];

const ORDER_STATUS = {
  pending:    { color: '#f59e0b', label: 'Pending' },
  processing: { color: '#3b82f6', label: 'Processing' },
  shipped:    { color: '#8b5cf6', label: 'Shipped' },
  delivered:  { color: '#16a34a', label: 'Delivered' },
  cancelled:  { color: '#e73c3c', label: 'Cancelled' },
};

const fmtMAD = (v) => `${Number(v || 0).toFixed(0)} DH`;

const renderOrdersTable = (orders) => {
  const tbody = qs('#ordersTableBody');
  if (!tbody) return;
  if (!orders.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--muted)">No orders found.</td></tr>`;
    return;
  }
  tbody.innerHTML = orders.map((o) => {
    const cfg = ORDER_STATUS[o.status] || ORDER_STATUS.pending;
    const customer = o.customer || {};
    const name = esc(`${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'Guest');
    const phone = esc(customer.phone || '-');
    const itemCount = (o.items || []).reduce((s, i) => s + (Number(i.qty) || 1), 0);
    const total = o.summary?.hasPendingPricing ? 'Pending' : fmtMAD(o.summary?.total);
    const date = o.createdAt ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(o.createdAt) : '-';
    return `<tr style="border-bottom:1px solid var(--border)" data-order-id="${esc(o.id)}">
      <td style="padding:10px 12px;font-family:monospace;font-weight:700;color:var(--text)">${esc(o.orderId || o.id)}</td>
      <td style="padding:10px 12px;color:var(--text)">
        <div style="font-weight:600">${name}</div>
        <div style="font-size:11px;color:var(--muted)">${phone}</div>
      </td>
      <td style="padding:10px 12px;color:var(--muted)">${itemCount} item${itemCount !== 1 ? 's' : ''}</td>
      <td style="padding:10px 12px;text-align:right;font-weight:700;color:var(--text)">${esc(total)}</td>
      <td style="padding:10px 12px">
        <span style="background:${cfg.color}22;color:${cfg.color};padding:3px 10px;border-radius:99px;font-size:11px;font-weight:700">${cfg.label}</span>
      </td>
      <td style="padding:10px 12px;color:var(--muted);font-size:12px">${date}</td>
      <td style="padding:10px 12px">
        <button class="btn btn-xs" onclick="window._adminViewOrder('${esc(o.id)}')" style="margin-right:4px"><i class="fas fa-eye"></i></button>
        <select class="select-sm order-status-select" data-id="${esc(o.id)}" style="font-size:11px;padding:3px 6px">
          ${Object.entries(ORDER_STATUS).map(([k, v]) => `<option value="${k}"${o.status === k ? ' selected' : ''}>${v.label}</option>`).join('')}
        </select>
      </td>
    </tr>`;
  }).join('');
};

const applyOrderFilters = () => {
  const statusFilter = qs('#ordersStatusFilter')?.value || '';
  const search = (qs('#ordersSearch')?.value || '').toLowerCase().trim();
  const filtered = _allOrders.filter((o) => {
    if (statusFilter && o.status !== statusFilter) return false;
    if (search) {
      const c = o.customer || {};
      const haystack = [o.orderId || o.id, c.firstName, c.lastName, c.phone, c.email, c.city].join(' ').toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
  renderOrdersTable(filtered);
  const countEl = qs('#ordersCount');
  if (countEl) countEl.textContent = `${filtered.length} order${filtered.length !== 1 ? 's' : ''}`;
};

const loadOrdersView = async () => {
  const tbody = qs('#ordersTableBody');
  if (tbody) tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--muted)"><i class="fas fa-spinner fa-spin"></i> Loading...</td></tr>`;
  try {
    const snap = await getDocs(query(collection(db, 'orders'), orderBy('createdAt', 'desc')));
    _allOrders = snap.docs.map((d) => {
      const data = d.data();
      return { ...data, id: d.id, createdAt: data.createdAt?.toDate?.() || null };
    });
    const badge = qs('#navOrdersBadge');
    if (badge) { badge.textContent = _allOrders.length; badge.style.display = ''; }
    applyOrderFilters();
  } catch (e) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:32px;color:#e73c3c">Error loading orders: ${esc(e.message)}</td></tr>`;
  }
};

// View order detail modal
window._adminViewOrder = (orderId) => {
  const order = _allOrders.find((o) => o.id === orderId);
  if (!order) return;
  const modal = qs('#orderDetailModal');
  const body  = qs('#orderDetailBody');
  const title = qs('#modalOrderTitle');
  if (!modal || !body) return;
  const cfg = ORDER_STATUS[order.status] || ORDER_STATUS.pending;
  const c = order.customer || {};
  const itemsHtml = (order.items || []).map((item) =>
    `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)">
      <div>
        <span style="font-weight:600;color:var(--text)">${esc(item.name)}</span>
        <span style="color:var(--muted);font-size:11px;margin-left:8px">${esc(item.size || '-')} × ${item.qty}</span>
      </div>
      <span style="font-weight:600;color:var(--text)">${item.pricePending ? 'Pending' : fmtMAD(item.price * item.qty)}</span>
    </div>`).join('');
  if (title) title.textContent = `Order ${order.orderId || order.id}`;
  body.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
      <span style="background:${cfg.color}22;color:${cfg.color};padding:4px 12px;border-radius:99px;font-size:12px;font-weight:700">${cfg.label}</span>
      ${order.createdAt ? `<span style="color:var(--muted);font-size:12px">${new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(order.createdAt)}</span>` : ''}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
      <div style="background:var(--bg);padding:12px;border-radius:10px">
        <p style="font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-bottom:4px">Customer</p>
        <p style="font-weight:700;color:var(--text)">${esc(`${c.firstName || ''} ${c.lastName || ''}`.trim() || 'Guest')}</p>
        <p style="color:var(--muted);font-size:12px">${esc(c.phone || '-')}</p>
        <p style="color:var(--muted);font-size:12px">${esc(c.email || '-')}</p>
      </div>
      <div style="background:var(--bg);padding:12px;border-radius:10px">
        <p style="font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-bottom:4px">Delivery</p>
        <p style="color:var(--text);font-size:13px">${esc(c.address || '-')}</p>
        <p style="color:var(--muted);font-size:12px">${esc(c.city || '')}, Morocco</p>
      </div>
    </div>
    <div style="margin-bottom:16px">
      <p style="font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-bottom:8px">Items</p>
      ${itemsHtml}
      <div style="display:flex;justify-content:space-between;padding-top:8px;font-weight:700;color:var(--text)">
        <span>Total</span>
        <span>${order.summary?.hasPendingPricing ? 'Pending confirmation' : fmtMAD(order.summary?.total)}</span>
      </div>
    </div>
    ${c.notes ? `<div style="background:var(--bg);padding:10px 12px;border-radius:8px;font-size:12px;color:var(--muted);margin-bottom:16px"><strong>Note:</strong> ${esc(c.notes)}</div>` : ''}
    <div style="display:grid;grid-template-columns:1fr auto;gap:8px;align-items:end">
      <div>
        <label style="font-size:11px;color:var(--muted);display:block;margin-bottom:4px">Update Status</label>
        <select class="select-sm" id="modalStatusSelect" style="width:100%">
          ${Object.entries(ORDER_STATUS).map(([k, v]) => `<option value="${k}"${order.status === k ? ' selected' : ''}>${v.label}</option>`).join('')}
        </select>
        <input type="text" class="select-sm" id="modalTrackingInput" placeholder="Tracking number (optional)" value="${esc(order.trackingNumber || '')}" style="width:100%;margin-top:6px">
      </div>
      <button id="modalSaveStatus" class="btn btn-xs btn-gold" style="height:fit-content;padding:8px 16px">Save</button>
    </div>
    <div id="modalSaveMsg" style="font-size:12px;margin-top:8px;display:none"></div>
    <div style="display:flex;gap:8px;margin-top:14px">
      <a href="https://wa.me/${esc(c.phone?.replace(/\D/g,'') || '212663750210')}?text=${encodeURIComponent(`Hi ${(c.firstName || 'Customer').trim()}, your IPORDISE order ${order.orderId || order.id} is now: ${cfg.label}. Thank you!`)}"
         target="_blank" rel="noopener noreferrer" class="btn btn-xs" style="background:#25d366;color:#fff;flex:1;justify-content:center">
        <i class="fab fa-whatsapp"></i> Notify on WhatsApp
      </a>
    </div>`;
  modal.style.display = 'flex';

  qs('#closeOrderModal')?.addEventListener('click', () => { modal.style.display = 'none'; });
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });

  qs('#modalSaveStatus')?.addEventListener('click', async () => {
    const newStatus = qs('#modalStatusSelect')?.value;
    const tracking  = qs('#modalTrackingInput')?.value.trim();
    const msgEl = qs('#modalSaveMsg');
    const btn   = qs('#modalSaveStatus');
    if (!newStatus) return;
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    try {
      const update = { status: newStatus };
      if (tracking) update.trackingNumber = tracking;
      await setDoc(doc(db, 'orders', orderId), update, { merge: true });
      const ord = _allOrders.find((o) => o.id === orderId);
      if (ord) { ord.status = newStatus; if (tracking) ord.trackingNumber = tracking; }
      if (msgEl) { msgEl.textContent = 'Status updated!'; msgEl.style.color = '#16a34a'; msgEl.style.display = 'block'; }
      applyOrderFilters();
      setTimeout(() => { modal.style.display = 'none'; }, 800);
    } catch(e) {
      if (msgEl) { msgEl.textContent = 'Error: ' + e.message; msgEl.style.color = '#e73c3c'; msgEl.style.display = 'block'; }
    }
    btn.disabled = false; btn.innerHTML = 'Save';
  });
};

// Wire up order status change from table inline select
document.addEventListener('change', async (e) => {
  const sel = e.target.closest('.order-status-select');
  if (!sel) return;
  const id = sel.dataset.id;
  const newStatus = sel.value;
  try {
    await setDoc(doc(db, 'orders', id), { status: newStatus }, { merge: true });
    const ord = _allOrders.find((o) => o.id === id);
    if (ord) ord.status = newStatus;
    toast('Order status updated', 'success');
    applyOrderFilters();
  } catch(e) { toast('Error: ' + e.message, 'error'); }
});

// Wire up orders filters — runs directly (module is already deferred, DOM is ready)
const _initOrdersFilters = () => {
  qs('#ordersStatusFilter')?.addEventListener('change', applyOrderFilters);
  qs('#ordersSearch')?.addEventListener('input', applyOrderFilters);
  qs('#refreshOrdersBtn')?.addEventListener('click', () => loadOrdersView().catch(e => toast(e.message, 'error')));
  qs('#refreshCustomersBtn')?.addEventListener('click', () => loadCustomersView().catch(e => toast(e.message, 'error')));
  qs('#customersSearch')?.addEventListener('input', applyCustomerFilters);
};

// ─── CUSTOMERS VIEW ───────────────────────────────────────────────────────────
let _allCustomers = [];

const renderCustomersTable = (customers) => {
  const tbody = qs('#customersTableBody');
  if (!tbody) return;
  if (!customers.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--muted)">No customers found.</td></tr>`;
    return;
  }
  tbody.innerHTML = customers.map((c) => {
    const p = c.profile || {};
    const name = esc(`${p.firstName || ''} ${p.lastName || ''}`.trim() || 'No name');
    const phone = esc(p.phone || '-');
    const city  = esc(p.city  || '-');
    const orders = c.orderCount || 0;
    const joined = c.createdAt ? new Intl.DateTimeFormat('en-GB', { day:'2-digit', month:'short', year:'numeric' }).format(c.createdAt) : '-';
    return `<tr style="border-bottom:1px solid var(--border)">
      <td style="padding:10px 12px;color:var(--text)">
        <div style="font-weight:600">${name}</div>
        <div style="font-size:11px;color:var(--muted);font-family:monospace">${esc(c.uid.slice(0,12))}…</div>
      </td>
      <td style="padding:10px 12px;color:var(--muted)">${phone}</td>
      <td style="padding:10px 12px;color:var(--muted)">${city}, Morocco</td>
      <td style="padding:10px 12px;text-align:center">
        <span style="background:#fef3c7;color:#d97706;padding:2px 10px;border-radius:99px;font-size:11px;font-weight:700">${orders}</span>
      </td>
      <td style="padding:10px 12px;color:var(--muted);font-size:12px">${joined}</td>
      <td style="padding:10px 12px">
        ${p.phone ? `<a href="https://wa.me/${esc(p.phone.replace(/\D/g,''))}" target="_blank" rel="noopener noreferrer"
           class="btn btn-xs" style="background:#25d366;color:#fff"><i class="fab fa-whatsapp"></i></a>` : ''}
      </td>
    </tr>`;
  }).join('');
};

const applyCustomerFilters = () => {
  const search = (qs('#customersSearch')?.value || '').toLowerCase().trim();
  const filtered = search
    ? _allCustomers.filter((c) => {
        const p = c.profile || {};
        const hay = [p.firstName, p.lastName, p.phone, p.city, p.email].join(' ').toLowerCase();
        return hay.includes(search);
      })
    : _allCustomers;
  renderCustomersTable(filtered);
  const countEl = qs('#customersCount');
  if (countEl) countEl.textContent = `${filtered.length} customer${filtered.length !== 1 ? 's' : ''}`;
};

const loadCustomersView = async () => {
  const tbody = qs('#customersTableBody');
  if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--muted)"><i class="fas fa-spinner fa-spin"></i> Loading...</td></tr>`;
  try {
    // Load all user profile docs from Firestore
    const snap = await getDocs(collection(db, 'users'));
    // For each user, also count their orders
    const ordersSnap = await getDocs(collection(db, 'orders'));
    const orderCountByUid = {};
    ordersSnap.docs.forEach((d) => {
      const uid = d.data().uid;
      if (uid) orderCountByUid[uid] = (orderCountByUid[uid] || 0) + 1;
    });

    _allCustomers = snap.docs
      .map((d) => {
        const data = d.data();
        const createdAt = data.createdAt?.toDate?.() || null;
        return { uid: d.id, ...data, createdAt, orderCount: orderCountByUid[d.id] || 0 };
      })
      .filter((c) => c.profile) // only users who completed their profile
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    const badge = qs('#navCustomersBadge');
    if (badge) { badge.textContent = _allCustomers.length; badge.style.display = ''; }
    applyCustomerFilters();
  } catch (e) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:32px;color:#e73c3c">Error: ${esc(e.message)}</td></tr>`;
  }
};

init();
_initOrdersFilters();
