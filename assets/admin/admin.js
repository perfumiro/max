// ─── IPORDISE Admin — Firebase Analytics Dashboard ────────────────────────────
// Auth: Firebase Email/Password   Data: Firestore   No server required.

import { initializeApp }
  from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged }
  from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js';
import {
  getFirestore, collection, doc,
  getDoc, getDocs, setDoc, addDoc, deleteDoc,
  query, orderBy, limit, where, onSnapshot,
  serverTimestamp, updateDoc,
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
  if (name === 'reviews')   loadReviewsView().catch(e => toast(e.message, 'error'));
  if (name === 'discounts') loadDiscountsView().catch(e => toast(e.message, 'error'));
  if (name === 'revenue')   loadRevenueView().catch(e => toast(e.message, 'error'));
  if (name === 'messages')  loadMessagesView().catch(e => toast(e.message, 'error'));
  if (name === 'newsletter') loadNewsletterView().catch(e => toast(e.message, 'error'));
  if (name === 'products')  loadProductsView().catch(e => toast(e.message, 'error'));
  if (name === 'settings')  loadSettingsView().catch(e => toast(e.message, 'error'));
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
    <span class="rank-label" title="${esc(r.name)}">${esc(r.name)}</span>
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
  if (_ordersUnsubscribe) { _ordersUnsubscribe(); _ordersUnsubscribe = null; }
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

  // Start real-time orders listener immediately so badge + data are always fresh
  loadOrdersView().catch(() => {});

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
let _ordersUnsubscribe = null;  // holds the onSnapshot unsubscribe fn

const ORDER_STATUS = {
  pending:    { color: '#f59e0b', label: 'Pending' },
  processing: { color: '#3b82f6', label: 'Processing' },
  shipped:    { color: '#8b5cf6', label: 'Shipped' },
  delivered:  { color: '#16a34a', label: 'Delivered' },
  cancelled:  { color: '#e73c3c', label: 'Cancelled' },
};

const fmtMAD = (v) => `${Number(v || 0).toFixed(0)} DH`;

const _renderOrdersError = (msg) => {
  const tbody = qs('#ordersTableBody');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="6" style="padding:32px;text-align:center">
    <div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:12px;padding:20px;max-width:520px;margin:0 auto">
      <div style="font-size:1.5rem;margin-bottom:8px">⚠️</div>
      <div style="font-weight:700;color:#dc2626;margin-bottom:6px">Could not load orders</div>
      <div style="font-size:12px;color:#7f1d1d;background:#fff;border-radius:8px;padding:8px 12px;font-family:monospace;margin-bottom:12px;text-align:left;word-break:break-all">${esc(msg)}</div>
      <div style="font-size:12px;color:#6b7280;margin-bottom:12px">This usually means Firestore rules have not been deployed yet.<br>Run: <code style="background:#f3f4f6;padding:2px 6px;border-radius:4px">firebase deploy --only firestore:rules</code></div>
      <button class="btn btn-xs btn-gold" id="ordersRetryBtn"><i class="fas fa-rotate-right"></i> Retry</button>
    </div>
  </td></tr>`;
  qs('#ordersRetryBtn')?.addEventListener('click', () => loadOrdersView().catch(() => {}));
};

const _renderOrdersEmpty = () => {
  const tbody = qs('#ordersTableBody');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="7" style="padding:32px;text-align:center">
    <div style="background:var(--surface-2,#f9fafb);border:1.5px dashed var(--border);border-radius:12px;padding:28px;max-width:440px;margin:0 auto">
      <div style="font-size:2rem;margin-bottom:8px">📦</div>
      <div style="font-weight:700;color:var(--text);margin-bottom:6px">No orders yet</div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:14px">When customers complete checkout, their orders will appear here automatically in real time.</div>
      <button class="btn btn-xs btn-gold" id="ordersTestBtn"><i class="fas fa-flask"></i> Test Firestore Connection</button>
    </div>
  </td></tr>`;
  qs('#ordersTestBtn')?.addEventListener('click', _testOrdersConnection);
};

const _testOrdersConnection = async () => {
  const btn = qs('#ordersTestBtn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Testing...'; }
  try {
    // Try writing a test doc to verify write permission
    const testId = 'TEST-' + Date.now();
    await setDoc(doc(db, 'orders', testId), {
      orderId: testId,
      channel: 'admin-test',
      items: [{ name: 'Test Product', qty: 1, price: 0 }],
      customer: { firstName: 'Test', lastName: 'Order', phone: '0600000000', email: '', address: 'Test', city: 'Casablanca', notes: '' },
      summary: { subtotal: 0, shipping: 0, total: 0, hasPendingPricing: false },
      status: 'pending',
      createdAt: new Date(),
      _isTest: true,
    });
    // Now read it back
    const snap = await getDocs(collection(db, 'orders'));
    const count = snap.size;
    // Clean up test doc
    await deleteDoc(doc(db, 'orders', testId)).catch(() => {});
    toast(`✅ Firestore works! Found ${count - 1} real orders in database.`, 'success', 5000);
    await loadOrdersView();
  } catch (e) {
    toast('❌ Firestore error: ' + e.message, 'error', 8000);
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-flask"></i> Test Firestore Connection'; }
  }
};

const renderOrdersTable = (orders) => {
  const tbody = qs('#ordersTableBody');
  if (!tbody) return;
  if (!orders.length) {
    _renderOrdersEmpty();
    return;
  }
  tbody.innerHTML = orders.map((o) => {
    const cfg = ORDER_STATUS[o.status] || ORDER_STATUS.pending;
    const customer = o.customer || {};
    const name = esc(`${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'Guest');
    const phone = esc(customer.phone || '-');
    const city  = esc(customer.city || '');
    const itemCount = (o.items || []).reduce((s, i) => s + (Number(i.qty) || 1), 0);
    const itemNames = (o.items || []).slice(0, 2).map(i => esc(i.name || '')).join(', ');
    const moreItems = (o.items || []).length > 2 ? ` +${(o.items||[]).length - 2} more` : '';
    const total = o.summary?.hasPendingPricing
      ? `<span style="color:var(--amber);font-size:11px">⏳ Pending</span>`
      : `<span style="font-weight:700;color:var(--ink)">${fmtMAD(o.summary?.total)}</span>`;
    const date = o.createdAt
      ? new Intl.DateTimeFormat('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }).format(o.createdAt)
      : '-';
    const channelDot = o.channel === 'whatsapp'
      ? `<span title="WhatsApp order" style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#25d366;margin-right:5px;vertical-align:middle"></span>`
      : `<span title="Email order" style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#6366f1;margin-right:5px;vertical-align:middle"></span>`;
    const phoneClean = (customer.phone || '').replace(/\D/g, '');
    const waPhone = phoneClean.startsWith('212') ? phoneClean : (phoneClean.startsWith('0') ? '212' + phoneClean.slice(1) : phoneClean);
    return `<tr class="orders-row" onclick="window._adminViewOrder('${esc(o.id)}')" data-order-id="${esc(o.id)}"
      style="border-bottom:1px solid var(--border);cursor:pointer;transition:background .12s"
      onmouseover="this.style.background='var(--s3)'" onmouseout="this.style.background=''">
      <td style="padding:12px 14px;white-space:nowrap">
        <div style="font-family:monospace;font-size:12px;font-weight:700;color:var(--gold)">${esc(o.orderId || o.id)}</div>
        <div style="font-size:10px;color:var(--muted);margin-top:2px">${date}</div>
      </td>
      <td style="padding:12px 14px">
        <div style="font-weight:600;color:var(--ink);font-size:13px">${channelDot}${name}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:1px">${phone}${city ? ' · ' + city : ''}</div>
      </td>
      <td style="padding:12px 14px">
        <div style="font-size:12px;color:var(--ink);max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${itemNames}${moreItems}">${itemNames}${moreItems ? `<span style="color:var(--muted)">${esc(moreItems)}</span>` : ''}</div>
        <div style="font-size:10px;color:var(--muted);margin-top:1px">${itemCount} item${itemCount !== 1 ? 's' : ''}</div>
      </td>
      <td style="padding:12px 14px;white-space:nowrap">${total}</td>
      <td style="padding:12px 14px">
        <span style="background:${cfg.color}18;color:${cfg.color};padding:4px 12px;border-radius:99px;font-size:11px;font-weight:700;white-space:nowrap;border:1px solid ${cfg.color}30">${cfg.label}</span>
      </td>
      <td style="padding:12px 14px" onclick="event.stopPropagation()">
        <div style="display:flex;align-items:center;gap:6px">
          <button class="btn btn-xs btn-gold" onclick="window._adminViewOrder('${esc(o.id)}')" title="View order details"
            style="padding:5px 10px"><i class="fas fa-eye"></i> View</button>
          ${waPhone ? `<a href="https://wa.me/${esc(waPhone)}" target="_blank" rel="noopener noreferrer"
            class="btn btn-xs" title="Open WhatsApp"
            style="padding:5px 10px;background:#25d366;color:#fff;border-color:#25d366"><i class="fab fa-whatsapp"></i></a>` : ''}
        </div>
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
  if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:48px;color:var(--muted)"><i class="fas fa-spinner fa-spin"></i> Loading orders...</td></tr>`;

  // Tear down any previous real-time listener
  if (_ordersUnsubscribe) { _ordersUnsubscribe(); _ordersUnsubscribe = null; }

  // ── Step 1: initial load via getDocs (no index required, works immediately) ──
  try {
    const snap = await getDocs(collection(db, 'orders'));
    const rows = snap.docs.map((d) => {
      const data = d.data();
      return { ...data, id: d.id, createdAt: data.createdAt?.toDate?.() || null };
    });
    rows.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    _allOrders = rows;
    const badge = qs('#navOrdersBadge');
    if (badge) { badge.textContent = _allOrders.length; badge.style.display = _allOrders.length ? '' : 'none'; }
    applyOrderFilters();
  } catch (e) {
    _renderOrdersError(e.message);
    return;
  }

  // ── Step 2: upgrade to real-time listener (best effort, non-blocking) ──
  try {
    _ordersUnsubscribe = onSnapshot(
      query(collection(db, 'orders'), orderBy('createdAt', 'desc')),
      (snap) => {
        _allOrders = snap.docs.map((d) => {
          const data = d.data();
          return { ...data, id: d.id, createdAt: data.createdAt?.toDate?.() || null };
        });
        const badge = qs('#navOrdersBadge');
        if (badge) { badge.textContent = _allOrders.length; badge.style.display = _allOrders.length ? '' : 'none'; }
        applyOrderFilters();
      },
      () => { /* real-time failed — stay on getDocs snapshot, no error shown */ }
    );
  } catch (_) { /* index not ready — initial getDocs data is already showing */ }
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
  const c   = order.customer || {};
  const s   = order.summary  || {};
  const displayName = `${c.firstName || ''} ${c.lastName || ''}`.trim() || 'Guest';
  const phone = c.phone || '';
  const phoneClean = phone.replace(/\D/g, '');
  const waPhone = phoneClean.startsWith('212') ? phoneClean : (phoneClean.startsWith('0') ? '212' + phoneClean.slice(1) : phoneClean);

  const channelBadge = order.channel === 'whatsapp'
    ? `<span style="display:inline-flex;align-items:center;gap:5px;font-size:11px;color:#15803d;background:#dcfce7;padding:3px 10px;border-radius:99px;font-weight:600;border:1px solid #bbf7d0"><i class="fab fa-whatsapp" style="font-size:12px"></i> WhatsApp</span>`
    : `<span style="display:inline-flex;align-items:center;gap:5px;font-size:11px;color:#4f46e5;background:#ede9fe;padding:3px 10px;border-radius:99px;font-weight:600;border:1px solid #c4b5fd"><i class="fas fa-envelope" style="font-size:11px"></i> Email</span>`;

  const dateStr = order.createdAt
    ? new Intl.DateTimeFormat('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }).format(order.createdAt)
    : '';

  // Items list
  const itemsHtml = (order.items || []).length === 0
    ? `<div style="padding:16px 0;text-align:center;color:var(--muted);font-size:13px">No items</div>`
    : (order.items || []).map((item, idx, arr) =>
        `<div style="display:flex;align-items:flex-start;gap:12px;padding:11px 0;${idx < arr.length - 1 ? 'border-bottom:1px solid var(--border)' : ''}">
          <div style="width:34px;height:34px;border-radius:8px;background:var(--s4);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--muted)">
            <i class="fas fa-bottle-droplet" style="font-size:13px"></i>
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:600;color:var(--ink);font-size:13px;line-height:1.35;margin-bottom:2px">${esc(item.name)}</div>
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
              ${item.size ? `<span style="font-size:11px;color:var(--muted);background:var(--s4);padding:1px 7px;border-radius:5px">${esc(item.size)}</span>` : ''}
              <span style="font-size:11px;color:var(--muted)">Qty: <strong style="color:var(--ink)">${item.qty}</strong></span>
            </div>
          </div>
          <div style="font-weight:700;color:var(--ink);white-space:nowrap;font-size:13px;padding-top:2px">
            ${item.pricePending ? `<span style="color:var(--amber);font-size:12px">Price TBD</span>` : fmtMAD(item.price * item.qty)}
          </div>
        </div>`
      ).join('');

  // Financial summary
  const subtotal = Number(s.subtotal || 0);
  const shipping = Number(s.shipping || 0);
  const total    = Number(s.total    || 0);
  const summaryHtml = s.hasPendingPricing
    ? `<div style="padding:12px 0 0;color:var(--amber);font-weight:600;font-size:13px;display:flex;align-items:center;gap:6px">
        <i class="fas fa-clock"></i> Awaiting price confirmation
       </div>`
    : `<div style="border-top:1px solid var(--border);padding-top:12px;display:flex;flex-direction:column;gap:6px">
        <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--muted)">
          <span>Subtotal</span><span>${fmtMAD(subtotal)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--muted)">
          <span>Shipping</span>
          <span>${shipping === 0 ? '<span style="color:#16a34a;font-weight:600">Free</span>' : fmtMAD(shipping)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:15px;font-weight:700;margin-top:2px">
          <span style="color:var(--ink)">Total</span>
          <span style="color:var(--gold)">${fmtMAD(total)}</span>
        </div>
      </div>`;

  const waMsg = `Bonjour ${displayName},\n\nVotre commande IPORDISE *${order.orderId || order.id}* est maintenant : *${cfg.label}*.\n${order.trackingNumber ? `\n🚚 Numéro de suivi : ${order.trackingNumber}` : ''}\n\nMerci de votre confiance ! 🙏`;

  if (title) title.textContent = order.orderId || order.id;

  body.innerHTML = `

    <!-- ── SECTION 1: Status + channel + date ── -->
    <div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:14px 16px;background:var(--s3);border-radius:12px;border:1px solid var(--border);margin-bottom:14px">
      <span style="display:inline-flex;align-items:center;gap:6px;background:${cfg.color}18;color:${cfg.color};padding:5px 14px;border-radius:99px;font-size:12px;font-weight:700;letter-spacing:.03em;border:1px solid ${cfg.color}30">
        <span style="width:6px;height:6px;border-radius:50%;background:${cfg.color};display:inline-block"></span>
        ${cfg.label}
      </span>
      ${channelBadge}
      ${dateStr ? `<span style="margin-left:auto;display:flex;align-items:center;gap:5px;font-size:12px;color:var(--muted)"><i class="far fa-calendar" style="color:var(--dim)"></i> ${dateStr}</span>` : ''}
    </div>

    <!-- ── SECTION 2: Customer & Delivery info ── -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
      <!-- Customer -->
      <div style="background:var(--s2);border:1px solid var(--border);border-radius:12px;padding:14px">
        <div style="display:flex;align-items:center;gap:7px;margin-bottom:10px">
          <span style="width:26px;height:26px;border-radius:7px;background:var(--s4);display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <i class="fas fa-user" style="font-size:11px;color:var(--muted)"></i>
          </span>
          <span style="font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);font-weight:700">Customer</span>
        </div>
        <div style="font-weight:700;color:var(--ink);font-size:14px;margin-bottom:6px;line-height:1.2">${esc(displayName)}</div>
        ${phone ? `<a href="tel:${esc(phone)}" style="display:flex;align-items:center;gap:6px;color:var(--gold);font-size:12px;font-weight:600;text-decoration:none;margin-bottom:4px"><i class="fas fa-phone" style="width:12px;font-size:11px"></i>${esc(phone)}</a>` : ''}
        ${c.email ? `<div style="display:flex;align-items:center;gap:6px;color:var(--muted);font-size:11px;min-width:0" title="${esc(c.email)}"><i class="fas fa-envelope" style="width:12px;font-size:10px;flex-shrink:0"></i><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.email)}</span></div>` : ''}
      </div>
      <!-- Delivery -->
      <div style="background:var(--s2);border:1px solid var(--border);border-radius:12px;padding:14px">
        <div style="display:flex;align-items:center;gap:7px;margin-bottom:10px">
          <span style="width:26px;height:26px;border-radius:7px;background:var(--s4);display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <i class="fas fa-truck" style="font-size:10px;color:var(--muted)"></i>
          </span>
          <span style="font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);font-weight:700">Delivery</span>
        </div>
        <div style="font-weight:600;color:var(--ink);font-size:13px;margin-bottom:6px;line-height:1.3">${esc(c.address || '—')}</div>
        <div style="display:flex;align-items:center;gap:5px;color:var(--muted);font-size:12px">
          <i class="fas fa-location-dot" style="font-size:10px;color:var(--dim)"></i>
          ${esc(c.city || '')}${c.city ? ', Morocco' : 'Morocco'}
        </div>
        ${order.trackingNumber ? `<div style="display:flex;align-items:center;gap:5px;color:var(--sky);font-size:11px;margin-top:6px;font-weight:600"><i class="fas fa-barcode" style="font-size:10px"></i> ${esc(order.trackingNumber)}</div>` : ''}
      </div>
    </div>

    ${c.notes ? `
    <!-- Customer note -->
    <div style="display:flex;align-items:flex-start;gap:10px;background:#fefce8;border:1px solid #fde047;border-radius:10px;padding:11px 14px;margin-bottom:14px">
      <i class="fas fa-note-sticky" style="color:#ca8a04;margin-top:1px;flex-shrink:0"></i>
      <div style="font-size:12px;color:#78350f;line-height:1.5"><span style="font-weight:700">Customer note: </span>${esc(c.notes)}</div>
    </div>` : ''}

    <!-- ── SECTION 3: Order items ── -->
    <div style="margin-bottom:14px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <span style="font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);font-weight:700">
          <i class="fas fa-bag-shopping" style="margin-right:5px;color:var(--dim)"></i>Order Items
        </span>
        <span style="font-size:11px;color:var(--muted)">${(order.items || []).length} item${(order.items || []).length !== 1 ? 's' : ''}</span>
      </div>
      <div style="background:var(--s2);border:1px solid var(--border);border-radius:12px;padding:0 14px">
        ${itemsHtml}
      </div>
    </div>

    <!-- ── SECTION 4: Financial summary ── -->
    <div style="background:var(--s2);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:14px">
      ${summaryHtml}
    </div>

    <!-- ── SECTION 5: Update order status ── -->
    <div style="background:var(--s3);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:14px">
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);font-weight:700;margin-bottom:10px">
        <i class="fas fa-sliders" style="margin-right:5px;color:var(--dim)"></i>Update Order
      </div>
      <div style="display:flex;gap:8px;margin-bottom:8px">
        <select class="select-sm" id="modalStatusSelect" style="flex:1;min-width:0">
          ${Object.entries(ORDER_STATUS).map(([k,v]) => `<option value="${k}"${order.status===k?' selected':''}>${v.label}</option>`).join('')}
        </select>
        <button id="modalSaveStatus" class="btn btn-xs btn-gold" style="padding:8px 20px;white-space:nowrap;flex-shrink:0">
          <i class="fas fa-check"></i> Save
        </button>
      </div>
      <input type="text" class="select-sm" id="modalTrackingInput"
             placeholder="Tracking number (optional)"
             value="${esc(order.trackingNumber || '')}"
             style="width:100%">
      <div id="modalSaveMsg" style="display:none;font-size:12px;margin-top:8px;padding:7px 11px;border-radius:8px"></div>
    </div>

    <!-- ── SECTION 6: Actions ── -->
    <a href="https://wa.me/${esc(waPhone)}?text=${encodeURIComponent(waMsg)}"
       target="_blank" rel="noopener noreferrer"
       style="display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:12px;background:#25d366;color:#fff;border-radius:12px;font-size:13px;font-weight:700;text-decoration:none;letter-spacing:.02em;box-shadow:0 2px 12px rgba(37,211,102,.3)">
      <i class="fab fa-whatsapp" style="font-size:16px"></i> Notify Customer on WhatsApp
    </a>`;

  modal.style.display = 'flex';

  // Close handlers — remove old listeners by cloning
  const closeBtn = qs('#closeOrderModal');
  if (closeBtn) {
    const newClose = closeBtn.cloneNode(true);
    closeBtn.replaceWith(newClose);
    newClose.addEventListener('click', () => { modal.style.display = 'none'; });
  }
  modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };

  qs('#modalSaveStatus')?.addEventListener('click', async () => {
    const newStatus = qs('#modalStatusSelect')?.value;
    const tracking  = qs('#modalTrackingInput')?.value.trim();
    const msgEl = qs('#modalSaveMsg');
    const btn   = qs('#modalSaveStatus');
    if (!newStatus) return;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    try {
      const update = { status: newStatus };
      if (tracking) update.trackingNumber = tracking;
      await setDoc(doc(db, 'orders', orderId), update, { merge: true });
      const ord = _allOrders.find((o) => o.id === orderId);
      if (ord) { ord.status = newStatus; if (tracking) ord.trackingNumber = tracking; }
      if (msgEl) {
        msgEl.textContent = '✓ Status updated!';
        msgEl.style.cssText = 'display:block;background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0;font-size:12px;margin-top:8px;padding:6px 10px;border-radius:8px';
      }
      applyOrderFilters();
      setTimeout(() => { modal.style.display = 'none'; }, 900);
    } catch (e) {
      if (msgEl) {
        msgEl.textContent = '✗ Error: ' + e.message;
        msgEl.style.cssText = 'display:block;background:#fef2f2;color:#dc2626;border:1px solid #fca5a5;font-size:12px;margin-top:8px;padding:6px 10px;border-radius:8px';
      }
    }
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-check"></i> Save';
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

// ─── REVIEWS VIEW ──────────────────────────────────────────────────────────────
let _allReviews = [];
let _pendingReplyId = null;

const starsHtmlAdmin = (n) => {
  let s = '';
  for (let i = 1; i <= 5; i++) s += `<i class="${i <= n ? 'fas' : 'far'} fa-star" style="color:#f59e0b;font-size:0.75rem;"></i>`;
  return s;
};

const renderReviewsAdmin = (reviews) => {
  const wrap = qs('#reviewsList');
  if (!wrap) return;
  if (!reviews.length) {
    wrap.innerHTML = `<div style="text-align:center;padding:32px;color:var(--muted)">No reviews found.</div>`;
    return;
  }
  wrap.innerHTML = reviews.map(r => {
    const date = r.createdAt?.toDate ? r.createdAt.toDate().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : (r.dateStr || '');
    const hasReply = !!r.adminReply;
    return `<div class="card" style="padding:0;overflow:hidden;" data-rid="${esc(r.id)}">
      <div class="card-body" style="display:flex;gap:1rem;align-items:flex-start;flex-wrap:wrap;">
        <div style="width:40px;height:40px;border-radius:50%;background:#6366f1;display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;font-size:1rem;flex-shrink:0;">${esc((r.displayName||'?').charAt(0).toUpperCase())}</div>
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;margin-bottom:2px;">
            <span style="font-weight:700;font-size:0.88rem;color:var(--text);">${esc(r.displayName||'Customer')}</span>
            ${r.city ? `<span style="font-size:0.72rem;color:var(--muted);">${esc(r.city)}</span>` : ''}
            <span style="font-size:0.72rem;color:var(--muted);margin-left:auto;">${date}</span>
          </div>
          <div style="margin-bottom:4px;">${starsHtmlAdmin(r.rating||5)}</div>
          <p style="font-size:0.85rem;color:var(--text);margin:0 0 4px;">${esc(r.body||'')}</p>
          <p style="font-size:0.75rem;color:var(--muted);margin:0;">Product: <strong>${esc(r.productName||r.productId||'')}</strong></p>
          ${hasReply ? `<div style="margin-top:8px;padding:8px 12px;background:#fef9ec;border-left:3px solid #c8a96a;border-radius:0 6px 6px 0;font-size:0.82rem;color:#374151;">
            <strong style="font-size:0.68rem;text-transform:uppercase;letter-spacing:0.06em;color:#92752a;">IPORDISE Reply:</strong><br>${esc(r.adminReply)}</div>` : ''}
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0;">
          <button class="btn btn-xs btn-gold review-reply-btn"
            data-rid="${esc(r.id)}"
            data-snippet="${esc((r.body||'').substring(0,80))}"
            data-existing="${esc(r.adminReply||'')}">
            <i class="fas fa-reply"></i> ${hasReply ? 'Edit Reply' : 'Reply'}
          </button>
          ${hasReply ? `<button class="btn btn-xs review-del-reply-btn" style="color:#e73c3c;border-color:#e73c3c;" data-rid="${esc(r.id)}"><i class="fas fa-trash"></i> Delete Reply</button>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');
};

const applyReviewFilters = () => {
  const search = (qs('#reviewsSearch')?.value || '').toLowerCase();
  const rating = qs('#reviewsRatingFilter')?.value;
  let filtered = _allReviews;
  if (search) filtered = filtered.filter(r => (r.displayName||'').toLowerCase().includes(search) || (r.productName||r.productId||'').toLowerCase().includes(search) || (r.body||'').toLowerCase().includes(search));
  if (rating) filtered = filtered.filter(r => String(Math.round(r.rating||5)) === rating);
  const badge = qs('#navReviewsBadge');
  if (badge) { badge.textContent = filtered.length; badge.style.display = filtered.length ? '' : 'none'; }
  renderReviewsAdmin(filtered);
};

const loadReviewsView = async () => {
  const wrap = qs('#reviewsList');
  if (wrap) wrap.innerHTML = `<div style="text-align:center;padding:32px;color:var(--muted)"><i class="fas fa-spinner fa-spin"></i> Loading reviews...</div>`;
  try {
    const [revSnap, replySnap] = await Promise.all([
      getDocs(query(collection(db, 'reviews'), orderBy('createdAt', 'desc')))
        .catch(() => getDocs(collection(db, 'reviews'))),
      getDocs(collection(db, 'adminReplies'))
        .catch(() => ({ docs: [] }))
    ]);
    const repliesMap = {};
    (replySnap.docs || []).forEach(d => {
      const r = d.data();
      if (r.reviewId) repliesMap[r.reviewId] = r.text;
    });
    _allReviews = revSnap.docs.map(d => ({ id: d.id, ...d.data(), adminReply: repliesMap[d.id] || null }));
    applyReviewFilters();
  } catch (e) {
    if (wrap) wrap.innerHTML = `<div style="text-align:center;padding:32px;color:#e73c3c">
      <i class="fas fa-exclamation-triangle"></i> Failed to load reviews<br>
      <small style="font-size:11px;opacity:.75">${esc(e.message)}</small>
    </div>`;
  }
};

window.openReplyModal = (reviewId, snippet, existing) => {
  if (!reviewId) return;
  _pendingReplyId = reviewId;
  const modal = qs('#replyModal');
  const snip  = qs('#replyModalReviewText');
  const input = qs('#replyModalInput');
  const errEl = qs('#replyModalError');
  if (snip)  snip.textContent  = `"${snippet}${snippet && snippet.length >= 80 ? '...' : ''}"`;
  if (input) input.value       = existing || '';
  if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }
  if (modal) modal.style.display = 'flex';
  input?.focus();
};

window.deleteAdminReply = async (reviewId) => {
  if (!reviewId || !confirm('Delete this reply?')) return;
  try {
    await deleteDoc(doc(db, 'adminReplies', 'reply_' + reviewId));
    toast('Reply deleted', 'success');
    await loadReviewsView();
  } catch (e) {
    toast('Delete failed: ' + e.message, 'error');
  }
};

qs('#replyModalSubmit')?.addEventListener('click', async () => {
  const text  = qs('#replyModalInput')?.value.trim();
  const errEl = qs('#replyModalError');
  const btn   = qs('#replyModalSubmit');

  // Clear previous error
  if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }

  if (!text) {
    if (errEl) { errEl.textContent = 'Please write a reply first.'; errEl.style.display = 'block'; }
    return;
  }
  if (!_pendingReplyId) {
    if (errEl) { errEl.textContent = 'No review selected. Close and try again.'; errEl.style.display = 'block'; }
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

  try {
    const rev = _allReviews.find(r => r.id === _pendingReplyId);
    await setDoc(doc(db, 'adminReplies', 'reply_' + _pendingReplyId), {
      reviewId:  _pendingReplyId,
      productId: rev?.productId || '',
      text,
      updatedAt: new Date().toISOString(),
    });
    const modal = qs('#replyModal');
    if (modal) modal.style.display = 'none';
    toast('Reply saved!', 'success');
    await loadReviewsView();
  } catch (e) {
    if (errEl) {
      errEl.textContent = 'Save failed: ' + e.message;
      errEl.style.display = 'block';
    }
    toast('Reply failed: ' + e.message, 'error');
  }

  btn.disabled = false;
  btn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Reply';
});

qs('#refreshReviewsBtn')?.addEventListener('click', () => loadReviewsView().catch(e => toast(e.message, 'error')));
qs('#reviewsSearch')?.addEventListener('input', applyReviewFilters);
qs('#reviewsRatingFilter')?.addEventListener('change', applyReviewFilters);

// Event delegation for dynamically-rendered review action buttons
// (avoids inline onclick which breaks when review text contains quotes)
document.addEventListener('click', (e) => {
  const replyBtn = e.target.closest('.review-reply-btn');
  if (replyBtn) {
    window.openReplyModal(replyBtn.dataset.rid, replyBtn.dataset.snippet, replyBtn.dataset.existing);
    return;
  }
  const delBtn = e.target.closest('.review-del-reply-btn');
  if (delBtn) {
    window.deleteAdminReply(delBtn.dataset.rid);
  }
});


// ─── REVENUE VIEW ────────────────────────────────────────────────────────────
const loadRevenueView = async () => {
  const setEl = (id, v) => { const el = qs('#' + id); if (el) el.textContent = v; };
  setEl('revTotalRevenue', '…'); setEl('revDeliveredCount', '…');
  setEl('revAvgOrder', '…'); setEl('revThisMonth', '…'); setEl('revPendingCount', '…');
  const monthlyBody = qs('#revenueMonthlyBody');
  const topProducts = qs('#revenueTopProducts');
  if (monthlyBody) monthlyBody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:32px;color:var(--muted)"><i class="fas fa-spinner fa-spin"></i> Loading...</td></tr>`;

  try {
    const snap = await getDocs(collection(db, 'orders'));
    const orders = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    const now = new Date();
    const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    let totalRevenue = 0, deliveredCount = 0, thisMonthRevenue = 0;
    let pendingCount = 0;
    const monthMap = {}; // { 'YYYY-MM': { count, revenue } }
    const productMap = {}; // { productName: revenue }

    orders.forEach(o => {
      const status = (o.status || '').toLowerCase();
      const total = Number(o.summary?.total || 0);
      const ts = o.createdAt?.toDate?.() || (o.createdAt ? new Date(o.createdAt) : null);
      const monthKey = ts ? `${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(2, '0')}` : null;

      if (status === 'delivered') {
        totalRevenue += total;
        deliveredCount++;
        if (monthKey) {
          if (!monthMap[monthKey]) monthMap[monthKey] = { count: 0, revenue: 0 };
          monthMap[monthKey].count++;
          monthMap[monthKey].revenue += total;
          if (monthKey === thisMonthKey) thisMonthRevenue += total;
        }
        // Count products
        (o.items || []).forEach(item => {
          const name = item.name || 'Unknown';
          const itemRevenue = item.pricePending ? 0 : Number(item.price || 0) * Number(item.qty || 1);
          if (!productMap[name]) productMap[name] = 0;
          productMap[name] += itemRevenue;
        });
      }

      if (status === 'pending' || status === 'processing') pendingCount++;
    });

    const avgOrder = deliveredCount > 0 ? Math.round(totalRevenue / deliveredCount) : 0;

    setEl('revTotalRevenue', totalRevenue.toLocaleString('fr-MA') + ' MAD');
    setEl('revDeliveredCount', deliveredCount.toString());
    setEl('revAvgOrder', avgOrder.toLocaleString('fr-MA') + ' MAD');
    setEl('revThisMonth', thisMonthRevenue.toLocaleString('fr-MA') + ' MAD');
    setEl('revPendingCount', pendingCount.toString());

    // Monthly breakdown table
    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const sortedMonths = Object.keys(monthMap).sort((a, b) => b.localeCompare(a));
    if (monthlyBody) {
      if (!sortedMonths.length) {
        monthlyBody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:32px;color:var(--muted)">No delivered orders yet.</td></tr>`;
      } else {
        monthlyBody.innerHTML = sortedMonths.map(key => {
          const [y, m] = key.split('-');
          const label = `${MONTHS[Number(m) - 1]} ${y}`;
          const { count, revenue } = monthMap[key];
          const avg = count > 0 ? Math.round(revenue / count) : 0;
          const isCurrentMonth = key === thisMonthKey;
          return `<tr style="border-bottom:1px solid var(--border);${isCurrentMonth ? 'background:rgba(200,169,106,.06)' : ''}">
            <td style="padding:11px 14px;font-weight:${isCurrentMonth ? '700' : '500'};color:var(--ink)">
              ${isCurrentMonth ? '<span style="color:var(--gold)">★ </span>' : ''}${label}
            </td>
            <td style="padding:11px 14px;color:var(--muted)">${count}</td>
            <td style="padding:11px 14px;font-weight:700;color:var(--gold)">${revenue.toLocaleString('fr-MA')} MAD</td>
            <td style="padding:11px 14px;color:var(--muted)">${avg.toLocaleString('fr-MA')} MAD</td>
          </tr>`;
        }).join('');
      }
    }

    // Top products
    if (topProducts) {
      const sorted = Object.entries(productMap).sort((a, b) => b[1] - a[1]).slice(0, 10);
      const maxRev = sorted[0]?.[1] || 1;
      if (!sorted.length) {
        topProducts.innerHTML = `<div style="text-align:center;padding:32px;color:var(--muted)">No data yet.</div>`;
      } else {
        topProducts.innerHTML = sorted.map(([name, rev], i) => `
          <div class="rank-item">
            <span class="rank-num">${i + 1}</span>
            <span class="rank-label" title="${esc(name)}" style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(name)}</span>
            <div class="rank-bar-wrap"><div class="rank-bar-fill" style="width:${Math.round(rev / maxRev * 100)}%"></div></div>
            <span class="rank-count" style="font-weight:700;color:var(--gold);white-space:nowrap">${rev.toLocaleString('fr-MA')} MAD</span>
          </div>`).join('');
      }
    }

    // Refresh button
    const refreshBtn = qs('#refreshRevenueBtn');
    if (refreshBtn) {
      const fresh = refreshBtn.cloneNode(true);
      refreshBtn.replaceWith(fresh);
      fresh.addEventListener('click', () => loadRevenueView().catch(e => toast(e.message, 'error')));
    }

  } catch (e) {
    if (monthlyBody) monthlyBody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:32px;color:var(--rose)"><i class="fas fa-exclamation-triangle"></i> ${esc(e.message)}</td></tr>`;
  }
};

// ─── DISCOUNTS VIEW ─────────────────────────────────────────────────────────────────
const loadDiscountsView = async () => {
  const tbody = qs('#discountsTableBody');
  const countEl = qs('#discountsCount');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--muted)"><i class="fas fa-spinner fa-spin"></i> Loading...</td></tr>`;
  try {
    const snap = await getDocs(collection(db, 'discountCodes'));
    const codes = snap.docs.map(d => ({ docId: d.id, ...d.data() }));
    codes.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
    if (countEl) countEl.textContent = codes.length + ' code' + (codes.length !== 1 ? 's' : '');
    const badge = qs('#navDiscountsBadge');
    if (badge) { badge.textContent = codes.length; badge.style.display = codes.length ? '' : 'none'; }
    renderDiscountsTable(codes);
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--rose)"><i class="fas fa-exclamation-triangle"></i> ${esc(e.message)}</td></tr>`;
  }

  // Wire create button (clone to clear old listeners)
  const createBtn = qs('#dcCreateBtn');
  if (createBtn) {
    const fresh = createBtn.cloneNode(true);
    createBtn.replaceWith(fresh);
    fresh.addEventListener('click', handleCreateDiscount);
  }
  // Auto-uppercase code input
  qs('#dcCode')?.addEventListener('input', function() { this.value = this.value.toUpperCase().replace(/[^A-Z0-9]/g,''); });
};

const renderDiscountsTable = (codes) => {
  const tbody = qs('#discountsTableBody');
  if (!tbody) return;
  if (!codes.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:48px;color:var(--muted)">
      <i class="fas fa-tag" style="font-size:24px;display:block;margin-bottom:8px;opacity:.3"></i>
      No discount codes yet. Create one above.
    </td></tr>`;
    return;
  }
  tbody.innerHTML = codes.map(c => {
    const discountStr = c.type === 'percentage' ? `${c.value}%` : `${c.value} MAD`;
    const minStr = c.minOrder > 0 ? `${c.minOrder} MAD` : `<span style="color:var(--muted)">None</span>`;
    const usageStr = c.usageLimit > 0
      ? `${c.usedCount || 0} / ${c.usageLimit}`
      : `${c.usedCount || 0} / <span style="color:var(--muted)">∞</span>`;
    const now = Date.now();
    const expiresMs = c.expiresAt?.toMillis?.() || null;
    const isExpired = expiresMs && expiresMs < now;
    const expiresStr = expiresMs
      ? `<span style="color:${isExpired ? 'var(--rose)' : 'var(--muted)'}">${new Date(expiresMs).toLocaleDateString('en-GB')}</span>`
      : `<span style="color:var(--muted)">Never</span>`;
    const isActive = c.active !== false && !isExpired && !(c.usageLimit > 0 && (c.usedCount || 0) >= c.usageLimit);
    const statusBadge = isActive
      ? `<span style="background:#dcfce7;color:#16a34a;padding:3px 10px;border-radius:99px;font-size:11px;font-weight:700;border:1px solid #bbf7d0">Active</span>`
      : `<span style="background:#fef2f2;color:#dc2626;padding:3px 10px;border-radius:99px;font-size:11px;font-weight:700;border:1px solid #fca5a5">${isExpired ? 'Expired' : 'Disabled'}</span>`;
    return `<tr style="border-bottom:1px solid var(--border);transition:background .12s"
        onmouseover="this.style.background='var(--s3)'" onmouseout="this.style.background=''">
      <td style="padding:12px 14px">
        <span style="font-family:monospace;font-weight:700;font-size:13px;color:var(--gold);background:var(--s3);padding:3px 10px;border-radius:6px;border:1px solid var(--border)">${esc(c.code)}</span>
      </td>
      <td style="padding:12px 14px;font-weight:700;color:var(--ink)">${discountStr}</td>
      <td style="padding:12px 14px">${minStr}</td>
      <td style="padding:12px 14px;color:var(--ink)">${usageStr}</td>
      <td style="padding:12px 14px">${expiresStr}</td>
      <td style="padding:12px 14px">${statusBadge}</td>
      <td style="padding:12px 14px">
        <div style="display:flex;gap:6px;align-items:center">
          <button class="btn btn-xs" title="Edit code"
            data-dc-edit="${esc(c.docId)}"
            style="padding:5px 10px">
            <i class="fas fa-pen"></i>
          </button>
          <button class="btn btn-xs" title="${c.active === false ? 'Enable' : 'Disable'} code"
            data-dc-toggle="${esc(c.docId)}" data-dc-active="${c.active !== false}"
            style="padding:5px 10px;${c.active !== false ? '' : 'color:var(--gold);border-color:var(--gold);'}">
            <i class="fas fa-${c.active !== false ? 'pause' : 'play'}"></i>
          </button>
          <button class="btn btn-xs" title="Delete code"
            data-dc-delete="${esc(c.docId)}"
            style="padding:5px 10px;color:var(--rose);border-color:var(--rose)">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </td>
    </tr>`;
  }).join('');
};

const handleCreateDiscount = async () => {
  const msgEl = qs('#dcCreateMsg');
  const codeVal = (qs('#dcCode')?.value || '').trim().toUpperCase();
  const typeVal = qs('#dcType')?.value;
  const valNum  = Number(qs('#dcValue')?.value || 0);
  const minNum  = Number(qs('#dcMinOrder')?.value || 0);
  const limitNum = Number(qs('#dcUsageLimit')?.value || 0);
  const expiryVal = qs('#dcExpiry')?.value;
  const btn = qs('#dcCreateBtn');

  const showMsg = (txt, ok) => {
    if (!msgEl) return;
    msgEl.textContent = txt;
    msgEl.style.cssText = `display:block;${ok
      ? 'background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0;'
      : 'background:#fef2f2;color:#dc2626;border:1px solid #fca5a5;'}font-size:12px;margin-top:10px;padding:8px 12px;border-radius:8px`;
  };

  if (!codeVal) return showMsg('Code is required.', false);
  if (!/^[A-Z0-9]{2,20}$/.test(codeVal)) return showMsg('Code must be 2–20 letters/numbers only.', false);
  if (!valNum || valNum <= 0) return showMsg('Value must be greater than 0.', false);
  if (typeVal === 'percentage' && valNum > 100) return showMsg('Percentage cannot exceed 100%.', false);

  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';

  try {
    const existing = await getDoc(doc(db, 'discountCodes', codeVal));
    if (existing.exists()) {
      showMsg('Code "' + codeVal + '" already exists. Use a different code.', false);
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-plus"></i> Create';
      return;
    }
    const data = {
      code: codeVal,
      type: typeVal,
      value: valNum,
      minOrder: minNum,
      usageLimit: limitNum,
      usedCount: 0,
      active: true,
      expiresAt: expiryVal ? new Date(expiryVal + 'T23:59:59Z') : null,
      createdAt: new Date(),
    };
    await setDoc(doc(db, 'discountCodes', codeVal), data);
    showMsg('\u2713 Code "' + codeVal + '" created!', true);
    // Reset fields
    ['dcCode','dcValue','dcExpiry'].forEach(id => { const el = qs('#' + id); if (el) el.value = ''; });
    qs('#dcMinOrder') && (qs('#dcMinOrder').value = '0');
    qs('#dcUsageLimit') && (qs('#dcUsageLimit').value = '0');
    await loadDiscountsView();
  } catch (e) {
    showMsg('Error: ' + e.message, false);
  }
  btn.disabled = false;
  btn.innerHTML = '<i class="fas fa-plus"></i> Create';
};

// Discount toggle + delete via event delegation
document.addEventListener('click', async (e) => {
  // ── Edit ─────────────────────────────────────────────────────────────
  const editBtn = e.target.closest('[data-dc-edit]');
  if (editBtn) {
    const id = editBtn.dataset.dcEdit;
    try {
      const snap = await getDoc(doc(db, 'discountCodes', id));
      if (!snap.exists()) return toast('Code not found', 'error');
      const c = snap.data();
      // Build expiry value for date input (YYYY-MM-DD)
      const expiryMs = c.expiresAt?.toMillis?.() || null;
      const expiryStr = expiryMs ? new Date(expiryMs).toISOString().slice(0, 10) : '';
      // Create modal
      let modal = document.getElementById('dcEditModal');
      if (modal) modal.remove();
      modal = document.createElement('div');
      modal.id = 'dcEditModal';
      modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(2px)';
      modal.innerHTML = `
        <div style="background:var(--s2);border-radius:20px;width:min(520px,96vw);box-shadow:0 24px 80px rgba(0,0,0,.4);overflow:hidden">
          <div style="display:flex;align-items:center;justify-content:space-between;padding:18px 22px;border-bottom:1px solid var(--border)">
            <div style="display:flex;align-items:center;gap:10px">
              <span style="width:34px;height:34px;border-radius:10px;background:var(--gold);display:flex;align-items:center;justify-content:center">
                <i class="fas fa-pen" style="color:#fff;font-size:13px"></i>
              </span>
              <div>
                <div style="font-size:11px;color:var(--muted);font-weight:500">Discount Codes</div>
                <div style="font-size:15px;font-weight:700;color:var(--ink)">Edit <span style="font-family:monospace;color:var(--gold)">${esc(id)}</span></div>
              </div>
            </div>
            <button id="dcEditClose" style="width:32px;height:32px;border-radius:8px;background:var(--s4);border:none;color:var(--muted);font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div style="padding:20px 22px 24px;display:flex;flex-direction:column;gap:14px">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
              <div>
                <label style="font-size:11px;color:var(--muted);display:block;margin-bottom:4px;font-weight:600">Type *</label>
                <select id="dcEditType" class="select-sm" style="width:100%">
                  <option value="percentage" ${c.type==='percentage'?'selected':''}>Percentage (%)</option>
                  <option value="fixed" ${c.type==='fixed'?'selected':''}>Fixed (MAD)</option>
                </select>
              </div>
              <div>
                <label style="font-size:11px;color:var(--muted);display:block;margin-bottom:4px;font-weight:600">Value *</label>
                <input type="number" id="dcEditValue" class="select-sm" value="${c.value}" min="1" style="width:100%">
              </div>
              <div>
                <label style="font-size:11px;color:var(--muted);display:block;margin-bottom:4px;font-weight:600">Min Order (MAD)</label>
                <input type="number" id="dcEditMinOrder" class="select-sm" value="${c.minOrder || 0}" min="0" style="width:100%">
              </div>
              <div>
                <label style="font-size:11px;color:var(--muted);display:block;margin-bottom:4px;font-weight:600">Usage Limit</label>
                <input type="number" id="dcEditUsageLimit" class="select-sm" value="${c.usageLimit || 0}" min="0" style="width:100%">
              </div>
              <div>
                <label style="font-size:11px;color:var(--muted);display:block;margin-bottom:4px;font-weight:600">Expires (optional)</label>
                <input type="date" id="dcEditExpiry" class="select-sm" value="${expiryStr}" style="width:100%">
              </div>
              <div style="display:flex;align-items:flex-end">
                <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;font-weight:600;color:var(--ink)">
                  <input type="checkbox" id="dcEditActive" ${c.active !== false ? 'checked' : ''} style="accent-color:var(--gold);width:16px;height:16px">
                  Active
                </label>
              </div>
            </div>
            <div id="dcEditMsg" style="display:none"></div>
            <div style="display:flex;gap:10px;justify-content:flex-end">
              <button id="dcEditClose2" class="btn btn-xs" style="padding:9px 18px">Cancel</button>
              <button id="dcEditSave" class="btn btn-xs btn-gold" style="padding:9px 20px">
                <i class="fas fa-check"></i> Save Changes
              </button>
            </div>
          </div>
        </div>`;
      document.body.appendChild(modal);
      const closeModal = () => modal.remove();
      document.getElementById('dcEditClose').onclick = closeModal;
      document.getElementById('dcEditClose2').onclick = closeModal;
      modal.addEventListener('click', ev => { if (ev.target === modal) closeModal(); });
      document.getElementById('dcEditSave').onclick = async () => {
        const saveBtn = document.getElementById('dcEditSave');
        const msgEl = document.getElementById('dcEditMsg');
        const showMsg = (txt, ok) => {
          msgEl.textContent = txt;
          msgEl.style.cssText = `display:block;${ok ? 'background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0;' : 'background:#fef2f2;color:#dc2626;border:1px solid #fca5a5;'}font-size:12px;padding:8px 12px;border-radius:8px`;
        };
        const typeVal = document.getElementById('dcEditType').value;
        const valNum  = Number(document.getElementById('dcEditValue').value || 0);
        const minNum  = Number(document.getElementById('dcEditMinOrder').value || 0);
        const limitNum = Number(document.getElementById('dcEditUsageLimit').value || 0);
        const expiryVal = document.getElementById('dcEditExpiry').value;
        const activeVal = document.getElementById('dcEditActive').checked;
        if (!valNum || valNum <= 0) return showMsg('Value must be greater than 0.', false);
        if (typeVal === 'percentage' && valNum > 100) return showMsg('Percentage cannot exceed 100%.', false);
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        try {
          await setDoc(doc(db, 'discountCodes', id), {
            type: typeVal, value: valNum, minOrder: minNum,
            usageLimit: limitNum, active: activeVal,
            expiresAt: expiryVal ? new Date(expiryVal + 'T23:59:59Z') : null,
          }, { merge: true });
          toast('Code updated ✓', 'success');
          closeModal();
          loadDiscountsView();
        } catch (err) {
          showMsg('Error: ' + err.message, false);
          saveBtn.disabled = false;
          saveBtn.innerHTML = '<i class="fas fa-check"></i> Save Changes';
        }
      };
    } catch (err) { toast(err.message, 'error'); }
    return;
  }

  const toggleBtn = e.target.closest('[data-dc-toggle]');
  if (toggleBtn) {
    const id = toggleBtn.dataset.dcToggle;
    const nowActive = toggleBtn.dataset.dcActive === 'true';
    try {
      await setDoc(doc(db, 'discountCodes', id), { active: !nowActive }, { merge: true });
      toast((nowActive ? 'Disabled' : 'Enabled') + ' code', 'success');
      loadDiscountsView();
    } catch (e) { toast(e.message, 'error'); }
    return;
  }
  const deleteBtn = e.target.closest('[data-dc-delete]');
  if (deleteBtn) {
    if (!confirm('Delete this discount code? This cannot be undone.')) return;
    try {
      await deleteDoc(doc(db, 'discountCodes', deleteBtn.dataset.dcDelete));
      toast('Code deleted', 'success');
      loadDiscountsView();
    } catch (e) { toast(e.message, 'error'); }
  }
});

// ─── NOTIFICATIONS BELL ─────────────────────────────────────────────────────
let _notifUnsubscribe = null;

const initNotifications = () => {
  const bellBtn    = document.getElementById('notifBellBtn');
  const dropdown   = document.getElementById('notifDropdown');
  const badge      = document.getElementById('notifBadge');
  const list       = document.getElementById('notifList');
  const clearBtn   = document.getElementById('notifClearBtn');
  if (!bellBtn || !dropdown) return;

  // Toggle dropdown
  bellBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = dropdown.style.display === 'block';
    dropdown.style.display = open ? 'none' : 'block';
    if (!open) badge.style.display = 'none';
  });
  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target) && e.target !== bellBtn)
      dropdown.style.display = 'none';
  });

  // Clear all
  if (clearBtn) clearBtn.addEventListener('click', () => {
    if (list) list.innerHTML = '<div style="text-align:center;padding:24px;color:var(--muted);font-size:12px">No new notifications</div>';
    badge.style.display = 'none';
    dropdown.style.display = 'none';
  });

  // Live listener: pending orders
  if (_notifUnsubscribe) _notifUnsubscribe();
  const pendingQ = query(collection(db, 'orders'), where('status', '==', 'pending'), orderBy('createdAt', 'desc'), limit(20));
  _notifUnsubscribe = onSnapshot(pendingQ, (snap) => {
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (items.length === 0) {
      if (list) list.innerHTML = '<div style="text-align:center;padding:24px;color:var(--muted);font-size:12px">No pending orders</div>';
      badge.style.display = 'none';
      return;
    }
    badge.style.display = 'flex';
    badge.textContent = items.length;
    if (list) list.innerHTML = items.map(o => {
      const name = esc(o.customerName || o.name || '—');
      const total = fmtMAD(o.total || 0);
      const when = o.createdAt?.toDate ? new Date(o.createdAt.toDate()).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}) : '—';
      return `<div style="padding:10px 16px;border-bottom:1px solid var(--border);cursor:pointer;transition:background .15s"
                  onmouseover="this.style.background='var(--s3)'" onmouseout="this.style.background=''"
                  onclick="document.querySelector('[data-view=orders]').click()">
        <div style="font-size:12px;font-weight:600;color:var(--ink)">${name} · ${total}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px">${when} · <span style="color:var(--amber);font-weight:600">Pending</span></div>
      </div>`;
    }).join('');
  }, () => {});
};

// ─── MESSAGES VIEW ─────────────────────────────────────────────────────────
const loadMessagesView = async () => {
  const container = document.getElementById('messagesList');
  const countEl   = document.getElementById('messagesCount');
  const unreadBadge = document.getElementById('navMessagesBadge');
  if (!container) return;
  container.innerHTML = '<div style="text-align:center;padding:48px;color:var(--muted)"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';
  try {
    const snap = await getDocs(query(collection(db, 'contactMessages'), orderBy('createdAt','desc')));
    let msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    const renderMessages = (filter = '', status = '') => {
      let filtered = msgs;
      if (filter) {
        const f = filter.toLowerCase();
        filtered = filtered.filter(m =>
          (m.name||'').toLowerCase().includes(f) ||
          (m.email||'').toLowerCase().includes(f) ||
          (m.subject||'').toLowerCase().includes(f) ||
          (m.message||'').toLowerCase().includes(f)
        );
      }
      if (status === 'unread') filtered = filtered.filter(m => !m.read);
      if (status === 'read')   filtered = filtered.filter(m => m.read);
      if (filtered.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:48px;color:var(--muted)">No messages found</div>';
        return;
      }
      container.innerHTML = filtered.map(m => {
        const name    = esc(m.name || '—');
        const email   = esc(m.email || '');
        const subject = esc(m.subject || 'No subject');
        const body    = esc(m.message || '');
        const phone   = esc(m.phone || '');
        const orderNo = esc(m.orderNumber || '');
        const when    = m.createdAt?.toDate ? new Date(m.createdAt.toDate()).toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—';
        const unread  = !m.read;
        return `<div class="card" style="${unread ? 'border-left:3px solid var(--gold)' : ''}">
          <div class="card-body">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px;margin-bottom:10px">
              <div>
                <span style="font-weight:700;font-size:13px;color:var(--ink)">${name}</span>
                ${unread ? '<span style="background:var(--gold);color:#fff;font-size:10px;font-weight:700;padding:2px 7px;border-radius:99px;margin-left:8px">NEW</span>' : ''}
                <div style="font-size:12px;color:var(--muted);margin-top:2px">
                  ${email ? `<a href="mailto:${email}" style="color:var(--sky)">${email}</a>` : ''}
                  ${phone ? ` · ${phone}` : ''}
                  ${orderNo ? ` · Order #${orderNo}` : ''}
                </div>
              </div>
              <div style="text-align:right">
                <div style="font-size:12px;color:var(--muted)">${when}</div>
                <div style="font-weight:600;font-size:12px;color:var(--ink);margin-top:2px">${subject}</div>
              </div>
            </div>
            <div style="font-size:13px;color:var(--ink);background:var(--s3);padding:10px 14px;border-radius:8px;white-space:pre-wrap;word-break:break-word">${body}</div>
            <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
              ${email ? `<a href="mailto:${email}?subject=Re: ${encodeURIComponent(m.subject||'Your enquiry')}" class="btn btn-xs btn-gold"><i class="fas fa-reply"></i> Reply</a>` : ''}
              ${unread ? `<button class="btn btn-xs btn-outline msg-mark-read" data-id="${esc(m.id)}"><i class="fas fa-check"></i> Mark Read</button>` : '<span style="font-size:11px;color:var(--dim)"><i class="fas fa-check-double"></i> Read</span>'}
              <button class="btn btn-xs btn-outline msg-delete" data-id="${esc(m.id)}" style="color:var(--rose);border-color:var(--rose)"><i class="fas fa-trash"></i> Delete</button>
            </div>
          </div>
        </div>`;
      }).join('');
    };

    const unreadCount = msgs.filter(m => !m.read).length;
    if (countEl) countEl.textContent = msgs.length + ' message' + (msgs.length!==1?'s':'');
    if (unreadBadge) { unreadBadge.textContent = unreadCount; unreadBadge.style.display = unreadCount ? '' : 'none'; }
    renderMessages();

    // Search + filter
    const searchEl = document.getElementById('messagesSearch');
    const statusEl = document.getElementById('messagesStatusFilter');
    const rerender = () => renderMessages(searchEl?.value || '', statusEl?.value || '');
    if (searchEl) { searchEl.value=''; searchEl.addEventListener('input', rerender); }
    if (statusEl) { statusEl.value=''; statusEl.addEventListener('change', rerender); }

    // Refresh
    const refreshBtn = document.getElementById('refreshMessagesBtn');
    if (refreshBtn) { const b=refreshBtn.cloneNode(true); refreshBtn.replaceWith(b); b.addEventListener('click',()=>loadMessagesView()); }

    // Mark read / delete via delegation
    container.addEventListener('click', async (e) => {
      const markBtn = e.target.closest('.msg-mark-read');
      const delBtn  = e.target.closest('.msg-delete');
      if (markBtn) {
        const id = markBtn.dataset.id;
        await updateDoc(doc(db,'contactMessages',id),{read:true});
        const idx = msgs.findIndex(m=>m.id===id);
        if(idx>=0) msgs[idx].read = true;
        rerender();
      }
      if (delBtn) {
        if (!confirm('Delete this message?')) return;
        const id = delBtn.dataset.id;
        await deleteDoc(doc(db,'contactMessages',id));
        msgs = msgs.filter(m=>m.id!==id);
        rerender();
        toast('Message deleted','success');
      }
    });
  } catch(e) {
    container.innerHTML = `<div style="text-align:center;padding:48px;color:var(--rose)">${esc(e.message)}</div>`;
    throw e;
  }
};

// ─── NEWSLETTER VIEW ────────────────────────────────────────────────────────
const loadNewsletterView = async () => {
  const tbody   = document.getElementById('newsletterTableBody');
  const countEl = document.getElementById('newsletterCount');
  const badge   = document.getElementById('navNewsletterBadge');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--muted)"><i class="fas fa-spinner fa-spin"></i> Loading...</td></tr>`;
  try {
    const snap = await getDocs(collection(db,'newsletterSubscribers'));
    let subs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    // Sort newest-first client-side (avoids requiring a Firestore composite index)
    subs.sort((a,b) => {
      const ta = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
      const tb = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
      return tb - ta;
    });

    const render = (filter='') => {
      const list = filter ? subs.filter(s =>
        (s.email||'').toLowerCase().includes(filter.toLowerCase()) ||
        (s.name||'').toLowerCase().includes(filter.toLowerCase())
      ) : subs;
      if(list.length===0){ tbody.innerHTML=`<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--muted)">No subscribers found</td></tr>`; return; }
      tbody.innerHTML = list.map(s => {
        const email = esc(s.email||'—');
        const name  = esc(s.name ||'—');
        const gender= esc(s.gender||'—');
        const when  = s.createdAt?.toDate ? new Date(s.createdAt.toDate()).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : '—';
        return `<tr style="border-bottom:1px solid var(--border)">
          <td style="padding:10px 14px;font-size:13px;color:var(--ink)">${email}</td>
          <td style="padding:10px 14px;font-size:13px;color:var(--ink)">${name}</td>
          <td style="padding:10px 14px;font-size:13px;color:var(--muted)">${gender}</td>
          <td style="padding:10px 14px;font-size:12px;color:var(--muted)">${when}</td>
          <td style="padding:10px 14px">
            <button class="btn btn-xs btn-outline nl-delete" data-id="${esc(s.id)}" style="color:var(--rose);border-color:var(--rose)"><i class="fas fa-trash"></i> Remove</button>
          </td>
        </tr>`;
      }).join('');
    };

    if(countEl) countEl.textContent = subs.length + ' subscriber' + (subs.length!==1?'s':'');
    if(badge){ badge.textContent = subs.length; badge.style.display = subs.length ? '' : 'none'; }
    render();

    const searchEl = document.getElementById('newsletterSearch');
    if(searchEl){ searchEl.value=''; searchEl.addEventListener('input',()=>render(searchEl.value)); }

    // Export CSV
    const exportBtn = document.getElementById('exportNewsletterCsvBtn');
    if(exportBtn){ const b=exportBtn.cloneNode(true); exportBtn.replaceWith(b);
      b.addEventListener('click',()=>{
        const rows = [['Email','Name','Gender','Subscribed'],...subs.map(s=>[s.email||'',s.name||'',s.gender||'',s.createdAt?.toDate?new Date(s.createdAt.toDate()).toISOString():''])];
        const csv = rows.map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\n');
        const a = Object.assign(document.createElement('a'),{href:'data:text/csv;charset=utf-8,'+encodeURIComponent(csv),download:'newsletter-subscribers.csv'});
        document.body.appendChild(a); a.click(); a.remove();
      });
    }

    // Refresh
    const refreshBtn = document.getElementById('refreshNewsletterBtn');
    if(refreshBtn){ const b=refreshBtn.cloneNode(true); refreshBtn.replaceWith(b); b.addEventListener('click',()=>loadNewsletterView()); }

    // ── Compose panel ──────────────────────────────────────────────────────
    const composeToggle = document.getElementById('nlComposeToggle');
    const composeBody   = document.getElementById('nlComposeBody');
    const composeChevron= document.getElementById('nlComposeChevron');
    if(composeToggle && composeBody){
      // start collapsed
      composeBody.style.display = 'none';
      composeToggle.addEventListener('click', () => {
        const open = composeBody.style.display !== 'none';
        composeBody.style.display = open ? 'none' : 'flex';
        if(composeChevron) composeChevron.innerHTML = open ? '<i class="fas fa-chevron-down"></i>' : '<i class="fas fa-chevron-up"></i>';
        updateAudienceCount();
      });
    }

    const audienceEl  = document.getElementById('nlAudience');
    const countLabel  = document.getElementById('nlAudienceCount');

    const getAudience = () => {
      const v = audienceEl?.value || 'all';
      if(v === 'male')   return subs.filter(s => (s.gender||'').toLowerCase() === 'male');
      if(v === 'female') return subs.filter(s => (s.gender||'').toLowerCase() === 'female');
      return subs;
    };

    const updateAudienceCount = () => {
      if(!countLabel) return;
      const n = getAudience().length;
      countLabel.textContent = n + ' recipient' + (n!==1?'s':'');
    };

    if(audienceEl){ audienceEl.addEventListener('change', updateAudienceCount); updateAudienceCount(); }

    // Open in mail client
    const openMailBtn = document.getElementById('nlOpenMailBtn');
    if(openMailBtn){ const b=openMailBtn.cloneNode(true); openMailBtn.replaceWith(b);
      b.addEventListener('click', () => {
        const audience = getAudience();
        if(!audience.length){ toast('No recipients in this audience','error'); return; }
        const subject = document.getElementById('nlSubject')?.value.trim() || '';
        const body    = document.getElementById('nlBody')?.value.trim() || '';
        const bcc     = audience.map(s=>s.email).filter(Boolean).join(',');
        const mailto  = `mailto:?bcc=${encodeURIComponent(bcc)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        window.location.href = mailto;
      });
    }

    // Copy emails to clipboard
    const copyEmailsBtn = document.getElementById('nlCopyEmailsBtn');
    if(copyEmailsBtn){ const b=copyEmailsBtn.cloneNode(true); copyEmailsBtn.replaceWith(b);
      b.addEventListener('click', async () => {
        const audience = getAudience();
        const emails = audience.map(s=>s.email).filter(Boolean).join(', ');
        try {
          await navigator.clipboard.writeText(emails);
          toast(`${audience.length} email${audience.length!==1?'s':''} copied to clipboard — paste into BCC`, 'success');
        } catch(_) {
          toast('Copy failed — your browser blocked clipboard access','error');
        }
      });
    }

    // Delete via delegation
    const tableBody = document.getElementById('newsletterTableBody');
    if(tableBody){ tableBody.addEventListener('click', async(e)=>{
      const delBtn = e.target.closest('.nl-delete');
      if(!delBtn) return;
      if(!confirm('Remove subscriber?')) return;
      const id = delBtn.dataset.id;
      await deleteDoc(doc(db,'newsletterSubscribers',id));
      subs = subs.filter(s=>s.id!==id);
      render(searchEl?.value||'');
      toast('Subscriber removed','success');
    }); }
  } catch(e) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--rose)">${esc(e.message)}</td></tr>`;
    throw e;
  }
};

// ─── PRODUCTS MANAGER VIEW ──────────────────────────────────────────────────
const loadProductsView = async () => {
  const grid     = document.getElementById('productsGrid');
  const countEl  = document.getElementById('productsCount');
  const searchEl = document.getElementById('productsSearch');
  const filterEl = document.getElementById('productsStatusFilter');
  if (!grid) return;
  grid.innerHTML = `<div style="text-align:center;padding:48px;color:var(--muted)"><i class="fas fa-spinner fa-spin"></i> Loading products...</div>`;
  try {
    const [pricesRes, overridesSnap] = await Promise.all([
      fetch('/prices.json').then(r=>r.json()),
      getDocs(collection(db,'productOverrides'))
    ]);

    // ── Helpers ────────────────────────────────────────────────────────────
    const normSizeKey = (sz) => {
      const s = (sz || '').trim().toLowerCase().replace(/\s+/g, '');
      return /^\d+$/.test(s) ? s + 'ml' : s;
    };
    const normalizeOv = (ov) => {
      if (!ov) return {};
      const prices = {};
      if (ov.prices) Object.entries(ov.prices).forEach(([k, v]) => { prices[normSizeKey(k)] = v; });
      const removedSizes = (ov.removedSizes || []).map(normSizeKey);
      return { ...ov, prices, removedSizes };
    };

    const overrides = {};
    overridesSnap.docs.forEach(d => { overrides[d.id] = normalizeOv(d.data()); });
    const slugs = Object.keys(pricesRes);
    // Track unsaved changes per slug
    const dirty = new Set();
    const pendingRemovals = {};

    const effectiveSizes = (slug) => {
      const base       = pricesRes[slug] || {};
      const ov         = overrides[slug] || {};
      const pendingSet = pendingRemovals[slug] || new Set();
      const hasFsPrices = ov.prices && Object.keys(ov.prices).length > 0;

      if (hasFsPrices) {
        // Firestore prices are AUTHORITATIVE — use them as the complete size list.
        // This ensures renames (old key gone, new key added) are reflected correctly
        // and the base prices.json whitelist cannot re-inject stale old sizes.
        const merged = {};
        Object.entries(ov.prices).forEach(([sz, price]) => {
          if (price > 0 && !pendingSet.has(sz)) merged[sz] = price;
        });
        return merged;
      }

      // No Firestore prices yet — derive from base (prices.json) minus removals.
      // Already-saved removals respect "prices WIN" rule.
      // pendingRemovals (UI click ×) ALWAYS win.
      const removed = new Set([
        ...(ov.removedSizes || []).map(normSizeKey).filter(sz => !(ov.prices?.[sz] > 0)),
        ...[...pendingSet].map(normSizeKey),
      ]);
      const merged = {};
      Object.keys(base).forEach(sz => {
        if (!removed.has(sz)) merged[sz] = base[sz];
      });
      return merged;
    };

    const productName = (slug) => slug.replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase());

    // ── Product image lookup ────────────────────────────────────────────────
    const PRODUCT_IMG = {
      'armani-stronger-with-you-absolutely-perfume': '/assets/images/products/armani/armani-stronger-with-you-absolutely-perfume/1.webp',
      'armani-stronger-with-you-powerfully-eau-de-parfum': '/assets/images/products/armani/armani-stronger-with-you-powerfully-eau-de-parfum/1.webp',
      'emporio-armani-stronger-with-you-intensely-edp': '/assets/images/products/armani/emporio-armani-stronger-with-you-intensely/1.webp',
      'azzaro-forever-wanted-elixir-eau-de-parfum': '/assets/images/products/azzaro/azzaro-forever-wanted-elixir-eau-de-parfum/1.jpg',
      'azzaro-the-most-wanted-eau-de-parfum-intense': '/assets/images/products/azzaro/azzaro-the-most-wanted-eau-de-parfum-intense/1.webp',
      'azzaro-the-most-wanted-parfum': '/assets/images/products/azzaro/azzaro-the-most-wanted-parfum/1.webp',
      'carolina-herrera-bad-boy-eau-de-toilette': '/assets/images/products/carolina-herrera/carolina-herrera-bad-boy-eau-de-toilette/1.jpg',
      'bleu-de-chanel-eau-de-parfum-spray': '/assets/images/products/chanel/bleu-de-chanel-eau-de-parfum-spray/1.jpg',
      'dior-homme-intense-eau-de-parfum': '/assets/images/products/dior/dior-homme-intense-eau-de-parfum/1.jpg',
      'dior-sauvage-eau-de-parfum': '/assets/images/products/dior/dior-sauvage-eau-de-parfum/1.jpg',
      'gentleman-private-reserve-eau-de-parfum': '/assets/images/products/givenchy/gentleman-private-reserve-eau-de-parfum/1.png',
      'givenchy-gentleman-society-amber-eau-de-parfum': '/assets/images/products/givenchy/givenchy-gentleman-society-amber-eau-de-parfum/1.jpg',
      'givenchy-gentleman-society-extreme-eau-de-parfum': '/assets/images/products/givenchy/givenchy-gentleman-society-extreme-eau-de-parfum/1.webp',
      'givenchy-gentleman-society-nomade-eau-de-parfum': '/assets/images/products/givenchy/givenchy-gentleman-society-nomade-eau-de-parfum/1.webp',
      'gucci-guilty-absolu-de-parfum-pour-homme': '/assets/images/products/gucci/gucci-guilty-absolu-de-parfum-pour-homme/1.webp',
      'gucci-guilty-elixir-pour-homme': '/assets/images/products/gucci/gucci-guilty-elixir-pour-homme/1.webp',
      'lhomme-ideal-extreme': '/assets/images/products/guerlain/lhomme-ideal-extreme/1.jpg',
      'lhomme-ideal-lintense-eau-de-parfum': '/assets/images/products/guerlain/lhomme-ideal-lintense-eau-de-parfum/1.webp',
      'boss-bottled-absolu-intense': '/assets/images/products/hugo-boss/boss-bottled-absolu-intense/1.jpeg',
      'hugo-boss-boss-bottled-elixir-intense': '/assets/images/products/hugo-boss/hugo-boss-boss-bottled-elixir-intense/1.jpeg',
      'hugo-boss-the-scent-for-him-elixir': '/assets/images/products/hugo-boss/hugo-boss-the-scent-for-him-elixir/1.png',
      'jean-paul-gaultier-le-beau-eau-de-parfum': '/assets/images/products/jean-paul-gaultier/jean-paul-gaultier-le-beau-eau-de-parfum/1.webp',
      'jean-paul-gaultier-le-male-elixir': '/assets/images/products/jean-paul-gaultier/jean-paul-gaultier-le-male-elixir/1.webp',
      'jean-paul-gaultier-le-male-in-blue-eau-de-parfum': '/assets/images/products/jean-paul-gaultier/jean-paul-gaultier-le-male-in-blue-eau-de-parfum/1.jpg',
      'jean-paul-gaultier-le-male-le-parfum-eau-de-parfum': '/assets/images/products/jean-paul-gaultier/jean-paul-gaultier-le-male-le-parfum-eau-de-parfum/1.webp',
      'jean-paul-gaultier-scandal-elixir': '/assets/images/products/jean-paul-gaultier/jean-paul-gaultier-scandal-elixir/1.jpg',
      'jean-paul-gaultier-scandal-intense-eau-de-parfum': '/assets/images/products/jean-paul-gaultier/jean-paul-gaultier-scandal-intense-eau-de-parfum/1.jpg',
      'le-male-eau-de-toilette': '/assets/images/products/jean-paul-gaultier/le-male-eau-de-toilette/1.png',
      'montale-arabians-tonka': '/assets/images/products/montale/montale-arabians-tonka/1.webp',
      'prada-lhomme-edt': '/assets/images/products/prada/prada-lhomme-edt/1.jpg',
      'prada-luna-rossa-black-eau-de-parfum': '/assets/images/products/prada/prada-luna-rossa-black-eau-de-parfum/1.jpg',
      'prada-luna-rossa-carbon-edt': '/assets/images/products/prada/prada-luna-rossa-carbon-edt/1.jpg',
      'prada-luna-rossa-men-edt': '/assets/images/products/prada/prada-luna-rossa-men-edt/1.jfif',
      'prada-luna-rossa-ocean-eau-de-parfum': '/assets/images/products/prada/prada-luna-rossa-ocean-eau-de-parfum/1.jpg',
      'prada-luna-rossa-ocean-le-parfum': '/assets/images/products/prada/prada-luna-rossa-ocean-le-parfum/1.jpg',
      'prada-paradigme-eau-de-parfum': '/assets/images/products/prada/prada-paradigme-eau-de-parfum/1.png',
      'rabanne-one-million-elixir-intense': '/assets/images/products/rabanne/rabanne-one-million-elixir-intense/1.webp',
      'rabanne-one-million-parfum': '/assets/images/products/rabanne/rabanne-one-million-parfum/1.jpg',
      'akdeniz': '/assets/images/products/unique-luxury/akdeniz/1.webp',
      'aphrodisiac-touch': '/assets/images/products/unique-luxury/aphrodisiac-touch/1.webp',
      'beril': '/assets/images/products/unique-luxury/beril/1.webp',
      'beverly-hills-exclusive': '/assets/images/products/unique-luxury/beverly-hills-exclusive/1.webp',
      'kutay': '/assets/images/products/unique-luxury/kutay/1.webp',
      'valentino-born-in-roma-donna-intense-eau-de-parfum': '/assets/images/products/valentino/valentino-born-in-roma-donna-intense-eau-de-parfum/1.webp',
      'valentino-born-in-roma-uomo-intense-eau-de-parfum': '/assets/images/products/valentino/valentino-born-in-roma-uomo-intense-eau-de-parfum/1.webp',
      'valentino-born-in-rome-extradose': '/assets/images/products/valentino/valentino-born-in-rome-extradose/1.jpg',
      'valentino-donna-born-in-roma-eau-de-parfum': '/assets/images/products/valentino/valentino-donna-born-in-roma-eau-de-parfum/1.webp',
      'valentino-uomo-born-in-roma-coral-fantasy-eau-de-toilette': '/assets/images/products/valentino/valentino-uomo-born-in-roma-coral-fantasy-eau-de-toilette/1.webp',
      'valentino-uomo-born-in-roma-eau-de-toilette': '/assets/images/products/valentino/valentino-uomo-born-in-roma-eau-de-toilette/1.jpg',
      'valentino-uomo-born-in-roma-purple-melancholia-eau-de-toilette': '/assets/images/products/valentino/valentino-uomo-born-in-roma-purple-melancholia-eau-de-toilette/1.jpg',
      'versace-dylan-blue-eau-de-toilette': '/assets/images/products/versace/versace-dylan-blue-eau-de-toilette/1.jpg',
      'versace-eros-eau-de-parfum': '/assets/images/products/versace/versace-eros-eau-de-parfum/1.webp',
      'versace-eros-energy-eau-de-parfum': '/assets/images/products/versace/versace-eros-energy-eau-de-parfum/1.jpg',
      'versace-eros-flame-eau-de-parfum': '/assets/images/products/versace/versace-eros-flame-eau-de-parfum/1.jpg',
      'xerjoff-alexandria-ll-eau-de-parfum': '/assets/images/products/xerjoff/xerjoff-alexandria-ll-eau-de-parfum/1.webp',
      'xerjoff-erba-pura': '/assets/images/products/xerjoff/xerjoff-erba-pura/1.webp',
      'xerjoff-naxos': '/assets/images/products/xerjoff/xerjoff-naxos/1.webp',
      'yves-saint-laurent-myslf-eau-de-parfum': '/assets/images/products/ysl/yves-saint-laurent-myslf-eau-de-parfum/1.jpg',
      'yves-saint-laurent-myslf-le-parfum': '/assets/images/products/ysl/yves-saint-laurent-myslf-le-parfum/1.webp',
      'yves-saint-laurent-y-eau-de-parfum': '/assets/images/products/ysl/yves-saint-laurent-y-eau-de-parfum/1.webp',
    };

    // ── Render ─────────────────────────────────────────────────────────────
    const render = () => {
      const q      = (searchEl?.value || '').toLowerCase();
      const status = filterEl?.value || '';
      const filtered = slugs.filter(slug => {
        const ov       = overrides[slug] || {};
        const disabled = ov.disabled || false;
        const hasOv    = !!(Object.keys(ov.prices||{}).length || (ov.removedSizes||[]).length);
        if (q && !slug.replace(/-/g,' ').includes(q)) return false;
        if (status === 'active'    && disabled) return false;
        if (status === 'disabled'  && !disabled) return false;
        if (status === 'overridden'&& (!hasOv || disabled)) return false;
        return true;
      });

      const total   = slugs.length;
      const nActive = slugs.filter(s => !(overrides[s]||{}).disabled).length;
      const nOv     = slugs.filter(s => {
        const ov = overrides[s]||{};
        return !ov.disabled && (Object.keys(ov.prices||{}).length || (ov.removedSizes||[]).length);
      }).length;
      if (countEl) countEl.textContent = `${total} products · ${nActive} active · ${nOv} overridden`;

      if (filtered.length === 0) {
        grid.innerHTML = `<div style="text-align:center;padding:48px;color:var(--muted)">No products match this filter</div>`;
        return;
      }

      grid.innerHTML = filtered.map(slug => {
        const ov         = overrides[slug] || {};
        const disabled   = ov.disabled || false;
        const hasOverride= !!(Object.keys(ov.prices||{}).length || (ov.removedSizes||[]).length);
        const isDirty    = dirty.has(slug);
        const name       = productName(slug);
        const sizes      = effectiveSizes(slug);
        const baseKeys   = Object.keys(pricesRes[slug] || {});

        const sizeChips = Object.keys(sizes).sort((a,b)=>{
          const n = s => parseInt(s.replace(/\D/g,''),10) || 0;
          return n(a) - n(b);
        }).map(sz => {
          const price     = sizes[sz];
          const isNew     = !baseKeys.includes(sz);
          const isChanged = !isNew && ov.prices?.[sz] !== undefined && ov.prices[sz] !== (pricesRes[slug]||{})[sz];
          const accentClr = isNew ? 'var(--gold)' : isChanged ? 'var(--amber)' : 'var(--border)';
          const bgClr     = isNew ? 'rgba(200,169,106,.07)' : isChanged ? 'rgba(245,158,11,.06)' : 'var(--s2)';
          const tip       = isNew ? 'New size (admin added)' : isChanged ? `Original: ${(pricesRes[slug]||{})[sz]} MAD` : sz;
          return `<div class="prod-size-chip" data-slug="${esc(slug)}" data-size="${esc(sz)}"
            style="display:inline-flex;align-items:center;border-radius:7px;border:1.5px solid ${accentClr};background:${bgClr};margin:3px 3px 3px 0;transition:border-color .15s,box-shadow .15s;box-shadow:0 1px 3px rgba(0,0,0,.05)"
            title="${esc(tip)}">
            <input type="text" class="prod-size-name-input" value="${esc(sz)}" maxlength="12"
              style="width:44px;border:none;background:transparent;font-size:12px;font-weight:700;color:var(--ink);outline:none;text-align:center;padding:5px 6px;cursor:text"
              title="Click to rename">
            <span style="width:1px;align-self:stretch;background:${accentClr};opacity:.4;flex-shrink:0"></span>
            <input type="number" min="0" value="${price}" data-slug="${esc(slug)}" data-size="${esc(sz)}" class="prod-price-input"
              style="width:50px;border:none;background:transparent;font-size:12px;color:var(--ink);text-align:center;font-weight:600;outline:none;padding:5px 4px"
              title="Edit price">
            <span style="font-size:10px;color:var(--dim);font-weight:500;padding-right:5px;flex-shrink:0">MAD</span>
            <button class="prod-remove-size" data-slug="${esc(slug)}" data-size="${esc(sz)}"
              style="width:24px;align-self:stretch;background:none;border:none;border-left:1px solid ${accentClr === 'var(--border)' ? 'var(--border)' : accentClr};opacity:${accentClr === 'var(--border)' ? '1' : '.5'};cursor:pointer;color:var(--dim);font-size:14px;display:flex;align-items:center;justify-content:center;border-radius:0 5px 5px 0;transition:all .15s;flex-shrink:0"
              onmouseover="this.style.background='rgba(244,63,94,.12)';this.style.color='var(--rose)';this.style.borderColor='var(--rose)';this.style.opacity='1'"
              onmouseout="this.style.background='none';this.style.color='var(--dim)';this.style.borderColor='${accentClr === 'var(--border)' ? 'var(--border)' : accentClr}';this.style.opacity='${accentClr === 'var(--border)' ? '1' : '.5'}'"
              title="Remove ${esc(sz)}">×</button>
          </div>`;
        }).join('');

        const accentColor = disabled ? 'var(--rose)' : isDirty ? 'var(--sky)' : hasOverride ? 'var(--gold)' : 'var(--border)';

        const statusBadge = disabled
          ? `<span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:700;color:var(--rose);background:rgba(244,63,94,.1);border:1px solid rgba(244,63,94,.25);padding:2px 8px;border-radius:99px"><span style="width:5px;height:5px;border-radius:99px;background:var(--rose);display:inline-block"></span>Disabled</span>`
          : `<span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:700;color:var(--emerald);background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.25);padding:2px 8px;border-radius:99px"><span style="width:5px;height:5px;border-radius:99px;background:var(--emerald);display:inline-block"></span>Active</span>`;

        const imgSrc = PRODUCT_IMG[slug] || '';
        const imgHtml = imgSrc
          ? `<img src="${imgSrc}" alt="" loading="lazy"
              style="width:60px;height:76px;object-fit:contain;border-radius:8px;background:var(--s3);flex-shrink:0;border:1px solid var(--border);box-shadow:0 2px 8px rgba(0,0,0,.08)"
              onerror="this.style.display='none'">`
          : `<div style="width:60px;height:76px;border-radius:8px;background:var(--s4);flex-shrink:0;display:flex;align-items:center;justify-content:center;border:1px solid var(--border)"><i class="fas fa-spray-can" style="color:var(--dim);font-size:22px"></i></div>`;

        return `<div class="card prod-card" data-slug="${esc(slug)}"
          style="transition:box-shadow .2s,border-color .2s;border-left:3px solid ${accentColor};${disabled?'opacity:.7':''}">
          <div style="padding:14px 16px 12px 14px">

            <!-- ── Top row: image + meta + actions ── -->
            <div style="display:flex;gap:12px;align-items:flex-start;margin-bottom:12px">
              ${imgHtml}
              <div style="flex:1;min-width:0">
                <div style="font-size:13px;font-weight:800;color:var(--ink);line-height:1.3;margin-bottom:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${esc(name)}">${esc(name)}</div>
                <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                  ${statusBadge}
                  ${hasOverride && !disabled ? `<span style="font-size:10px;font-weight:700;color:var(--amber);background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.3);padding:2px 8px;border-radius:99px"><i class="fas fa-pen-to-square" style="font-size:9px;margin-right:3px"></i>Overridden</span>` : ''}
                  ${isDirty ? `<span class="prod-dirty-badge" style="font-size:10px;font-weight:700;color:var(--sky);background:rgba(56,189,248,.1);border:1px solid rgba(56,189,248,.3);padding:2px 8px;border-radius:99px"><i class="fas fa-circle-dot" style="font-size:9px;margin-right:3px"></i>Unsaved</span>` : ''}
                </div>
              </div>

              <!-- Action buttons -->
              <div style="display:flex;flex-direction:column;gap:5px;flex-shrink:0;align-items:flex-end">
                <div style="display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end">
                  <button class="btn btn-xs btn-gold prod-save" data-slug="${esc(slug)}" style="gap:4px;font-size:11px;padding:4px 10px">
                    <i class="fas fa-floppy-disk"></i> Save
                  </button>
                  <button class="btn btn-xs prod-toggle" data-slug="${esc(slug)}"
                    style="gap:4px;font-size:11px;padding:4px 10px;${disabled ? 'background:rgba(34,197,94,.12);color:var(--emerald);border:1px solid rgba(34,197,94,.3)' : 'background:rgba(244,63,94,.08);color:var(--rose);border:1px solid rgba(244,63,94,.25)'}">
                    <i class="fas fa-${disabled?'circle-check':'circle-xmark'}"></i> ${disabled?'Enable':'Disable'}
                  </button>
                </div>
                <div style="display:flex;gap:5px;justify-content:flex-end">
                  ${hasOverride ? `<button class="btn btn-xs btn-outline prod-reset" data-slug="${esc(slug)}"
                    title="Restore original prices from prices.json"
                    style="gap:4px;font-size:11px;padding:3px 9px;color:var(--muted);border-color:var(--border)">
                    <i class="fas fa-arrow-rotate-left"></i> Reset
                  </button>` : ''}
                  <a href="/pages/product.html?id=${esc(slug)}" target="_blank"
                    style="display:inline-flex;align-items:center;gap:4px;font-size:11px;color:var(--muted);text-decoration:none;padding:3px 9px;border:1px solid var(--border);border-radius:6px;background:var(--s3);transition:all .15s"
                    onmouseover="this.style.color='var(--sky)';this.style.borderColor='var(--sky)';this.style.background='rgba(56,189,248,.08)'"
                    onmouseout="this.style.color='var(--muted)';this.style.borderColor='var(--border)';this.style.background='var(--s3)'">
                    <i class="fas fa-arrow-up-right-from-square" style="font-size:9px"></i> Preview
                  </a>
                </div>
              </div>
            </div>

            <!-- ── Divider ── -->
            <div style="height:1px;background:var(--border);margin:0 -2px 10px -2px"></div>

            <!-- ── Sizes row ── -->
            <div style="display:flex;flex-wrap:wrap;align-items:center;gap:0;min-height:32px">
              ${sizeChips || `<span style="font-size:11px;color:var(--dim);font-style:italic;padding:4px 2px">No sizes — add one below</span>`}
            </div>

            <!-- ── Add size form ── -->
            <div class="prod-add-size-form" data-slug="${esc(slug)}"
              style="display:flex;align-items:center;gap:8px;margin-top:10px;padding:8px 10px;background:var(--s3);border-radius:8px;border:1px dashed var(--border)">
              <span style="font-size:10px;font-weight:700;color:var(--gold);letter-spacing:.4px;text-transform:uppercase;white-space:nowrap;flex-shrink:0">
                <i class="fas fa-plus" style="font-size:9px;margin-right:3px"></i>New size
              </span>
              <input type="text" class="prod-new-size-name" placeholder="e.g. 75ml" maxlength="10"
                style="flex:1;min-width:60px;max-width:90px;border:1px solid var(--border);border-radius:6px;background:var(--s2);padding:5px 8px;font-size:12px;color:var(--ink);font-weight:600;outline:none;transition:border-color .15s"
                onfocus="this.style.borderColor='var(--gold)'" onblur="this.style.borderColor='var(--border)'"
                title="Size label, e.g. 75ml">
              <div style="height:20px;width:1px;background:var(--border);flex-shrink:0"></div>
              <input type="number" min="1" class="prod-new-size-price" placeholder="Price"
                style="flex:1;min-width:64px;max-width:96px;border:1px solid var(--border);border-radius:6px;background:var(--s2);padding:5px 8px;font-size:12px;color:var(--ink);font-weight:600;outline:none;text-align:right;transition:border-color .15s"
                onfocus="this.style.borderColor='var(--gold)'" onblur="this.style.borderColor='var(--border)'"
                title="Price in MAD">
              <span style="font-size:11px;color:var(--muted);font-weight:600;flex-shrink:0">MAD</span>
              <button class="prod-add-size btn btn-xs btn-gold" data-slug="${esc(slug)}"
                style="padding:5px 14px;font-size:11px;flex-shrink:0;gap:4px">
                <i class="fas fa-plus" style="font-size:9px"></i> Add
              </button>
            </div>

          </div>
        </div>`;
      }).join('');

      // Wire price + name input changes → mark dirty and show badge instantly
      grid.querySelectorAll('.prod-price-input, .prod-size-name-input').forEach(inp => {
        inp.addEventListener('input', () => {
          const chip = inp.closest('.prod-size-chip');
          const slug = chip?.dataset.slug || inp.dataset.slug;
          if (!slug) return;
          dirty.add(slug);
          // Show UNSAVED badge on the card without full re-render
          const card = grid.querySelector(`.prod-card[data-slug="${slug}"]`);
          if (card) {
            card.style.borderLeftColor = 'var(--sky)';
            if (!card.querySelector('.prod-dirty-badge')) {
              const subRow = card.querySelector('[style*="gap:6px"]');
              if (subRow) {
                const badge = document.createElement('span');
                badge.className = 'prod-dirty-badge';
                badge.style.cssText = 'font-size:10px;font-weight:700;color:var(--sky);background:rgba(56,189,248,.1);border:1px solid rgba(56,189,248,.3);padding:2px 8px;border-radius:99px';
                badge.innerHTML = '<i class="fas fa-circle-dot" style="font-size:9px;margin-right:3px"></i>Unsaved';
                subRow.appendChild(badge);
              }
            }
          }
        });
      });

      // Wire Enter key on add-size inputs
      grid.querySelectorAll('.prod-add-size-form').forEach(form => {
        form.querySelectorAll('input').forEach(inp => {
          inp.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              form.querySelector('.prod-add-size')?.click();
            }
          });
        });
      });
    };

    // Clear search/filter BEFORE render so stale values don't hide products
    if (searchEl) { searchEl.value = ''; }
    if (filterEl) { filterEl.value = ''; }
    render();

    // Abort any event listeners from a previous loadProductsView call
    if (grid._prodAC) grid._prodAC.abort();
    const prodAC = new AbortController();
    grid._prodAC = prodAC;
    const prodSig = prodAC.signal;

    // Search + filter
    if (searchEl) { searchEl.addEventListener('input', render, { signal: prodSig }); }
    if (filterEl) { filterEl.addEventListener('change', render, { signal: prodSig }); }
    const refreshBtn = document.getElementById('refreshProductsBtn');
    if (refreshBtn) { const b=refreshBtn.cloneNode(true); refreshBtn.replaceWith(b); b.addEventListener('click',()=>loadProductsView()); }

    // ── Event delegation ───────────────────────────────────────────────────
    grid.addEventListener('click', async (e) => {
      const saveBtn   = e.target.closest('.prod-save');
      const toggleBtn = e.target.closest('.prod-toggle');
      const removeBtn = e.target.closest('.prod-remove-size');

      const addBtn    = e.target.closest('.prod-add-size');
      const resetBtn  = e.target.closest('.prod-reset');
      if (!saveBtn && !toggleBtn && !removeBtn && !addBtn && !resetBtn) return;

      const slug = (saveBtn||toggleBtn||removeBtn||addBtn||resetBtn).dataset.slug;
      const ov   = overrides[slug] || {};
      const base = pricesRes[slug] || {};

      // ── Remove size ─────────────────────────────────────────────────────
      if (removeBtn) {
        const sz = removeBtn.dataset.size;
        if (!pendingRemovals[slug]) pendingRemovals[slug] = new Set();
        pendingRemovals[slug].add(sz);
        dirty.add(slug);
        removeBtn.closest('.prod-size-chip')?.remove();
        // mark unsaved banner
        render();
      }

      // ── Add size ────────────────────────────────────────────────────────
      if (addBtn) {
        const form       = addBtn.closest('.prod-add-size-form');
        const nameInput  = form?.querySelector('.prod-new-size-name');
        const priceInput = form?.querySelector('.prod-new-size-price');
        const sz    = normSizeKey((nameInput?.value||'').trim());
        const price = parseFloat(priceInput?.value)||0;
        if (!sz) { toast('Enter a size label first (e.g. 75ml)', 'error'); nameInput?.focus(); return; }
        if (price <= 0) { toast('Enter a valid price > 0 MAD', 'error'); priceInput?.focus(); return; }
        pendingRemovals[slug]?.delete(sz);
        if (!overrides[slug]) overrides[slug] = {};
        if (!overrides[slug].prices) overrides[slug].prices = {};
        overrides[slug].prices[sz] = price;
        dirty.add(slug);
        if (nameInput)  nameInput.value  = '';
        if (priceInput) priceInput.value = '';
        render();
      }

      // ── Save ────────────────────────────────────────────────────────────
      if (saveBtn) {
        const card = grid.querySelector(`.prod-card[data-slug="${slug}"]`);
        if (!card) { toast('Could not find product card', 'error'); return; }
        const chips = card.querySelectorAll('.prod-size-chip');
        const prices = {};
        let hasError = false;
        chips.forEach(chip => {
          const nameInp = chip.querySelector('.prod-size-name-input');
          const sz      = normSizeKey((nameInp?.value || chip.dataset.size || '').trim());
          const inp     = chip.querySelector('.prod-price-input');
          const price   = parseFloat(inp?.value ?? '');
          if (!sz) return;
          if (isNaN(price) || price < 0) { hasError = true; return; }
          prices[sz] = price;
        });
        if (hasError) { toast('Fix invalid prices before saving', 'error'); return; }

        const pendingSet   = pendingRemovals[slug] || new Set();
        const removedSizes = [
          ...Object.keys(base).map(normSizeKey).filter(sz => !(sz in prices)),
          ...[...pendingSet].map(normSizeKey),
        ].filter((v,i,a) => a.indexOf(v)===i).filter(sz => !(prices[sz]>0));

        delete pendingRemovals[slug];
        overrides[slug] = { ...(ov.disabled !== undefined ? {disabled: ov.disabled} : {}), prices, removedSizes };

        // Optimistic UI — show saving state
        const btn = card.querySelector('.prod-save');
        if (btn) { btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Saving…'; }
        try {
          await setDoc(doc(db,'productOverrides',slug), overrides[slug]);
          dirty.delete(slug);
          toast(`✓ ${productName(slug)} saved`, 'success');
          render();
        } catch(err) {
          toast('Save failed: ' + err.message, 'error');
          if (btn) { btn.disabled=false; btn.innerHTML='<i class="fas fa-floppy-disk"></i> Save'; }
        }
      }

      // ── Toggle enable/disable ───────────────────────────────────────────
      if (toggleBtn) {
        const newDisabled = !ov.disabled;
        overrides[slug] = { ...ov, disabled: newDisabled };
        const btn = grid.querySelector(`.prod-card[data-slug="${slug}"] .prod-toggle`);
        if (btn) { btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin"></i>'; }
        try {
          await setDoc(doc(db,'productOverrides',slug), overrides[slug], {merge:true});
          toast(`${productName(slug)} ${newDisabled?'disabled':'enabled'}`, 'success');
          render();
        } catch(err) {
          toast(err.message, 'error');
          overrides[slug].disabled = !newDisabled; // rollback
          render();
        }
      }

      // ── Reset ───────────────────────────────────────────────────────────
      if (resetBtn) {
        if (!confirm(`Reset "${productName(slug)}" to defaults?\n\nAll price and size overrides will be deleted.`)) return;
        const btn = grid.querySelector(`.prod-card[data-slug="${slug}"] .prod-reset`);
        if (btn) { btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin"></i>'; }
        try {
          await deleteDoc(doc(db,'productOverrides',slug));
          delete overrides[slug];
          delete pendingRemovals[slug];
          dirty.delete(slug);
          toast(`"${productName(slug)}" reset to defaults`, 'success');
          render();
        } catch(err) { toast('Reset failed: '+err.message,'error'); if(btn){btn.disabled=false;btn.innerHTML='<i class="fas fa-arrow-rotate-left"></i> Reset';} }
      }
    }, { signal: prodSig });
  } catch(e) {
    grid.innerHTML = `<div class="card"><div class="card-body" style="color:var(--rose);text-align:center;padding:32px"><i class="fas fa-triangle-exclamation"></i> ${esc(e.message)}</div></div>`;
    throw e;
  }
};

// ─── SETTINGS VIEW ──────────────────────────────────────────────────────────
const loadSettingsView = async () => {
  const docRef = doc(db,'admin_config','settings');
  const setMsg = document.getElementById('settingsSavedMsg');
  try {
    const snap = await getDoc(docRef);
    const cfg  = snap.exists() ? snap.data() : {};
    const set  = (id,v) => { const el=document.getElementById(id); if(el){ if(el.type==='checkbox') el.checked=!!v; else el.value=v??''; } };
    set('settingStoreOpen',    cfg.storeOpen !== false); // default true
    set('settingBanner',       cfg.banner || '');
    set('settingBannerActive', cfg.bannerActive || false);
    set('settingWhatsappOrder',   cfg.whatsappOrder || '');
    set('settingWhatsappSupport', cfg.whatsappSupport || '');
    set('settingShipping',     cfg.shippingCost ?? 35);
    set('settingFreeShipping', cfg.freeShippingAbove ?? '');
    // Update label
    const openEl = document.getElementById('settingStoreOpen');
    const label  = document.getElementById('settingStoreOpenLabel');
    if(openEl && label){
      label.textContent = openEl.checked ? 'Open' : 'Closed';
      label.style.color = openEl.checked ? 'var(--emerald)' : 'var(--rose)';
      openEl.addEventListener('change',()=>{
        label.textContent = openEl.checked ? 'Open' : 'Closed';
        label.style.color = openEl.checked ? 'var(--emerald)' : 'var(--rose)';
      });
    }
  } catch(e) { toast(e.message,'error'); }

  const saveBtn = document.getElementById('saveSettingsBtn');
  if(!saveBtn) return;
  const fresh = saveBtn.cloneNode(true);
  saveBtn.replaceWith(fresh);
  fresh.addEventListener('click', async () => {
    const get  = (id) => { const el=document.getElementById(id); return el? (el.type==='checkbox'?el.checked:el.value) : null; };
    const payload = {
      storeOpen:         !!get('settingStoreOpen'),
      banner:            (get('settingBanner')||'').trim(),
      bannerActive:      !!get('settingBannerActive'),
      whatsappOrder:     (get('settingWhatsappOrder')||'').trim(),
      whatsappSupport:   (get('settingWhatsappSupport')||'').trim(),
      shippingCost:      parseFloat(get('settingShipping'))||35,
      freeShippingAbove: parseFloat(get('settingFreeShipping'))||0,
      updatedAt:         serverTimestamp(),
    };
    try {
      await setDoc(docRef, payload, {merge:true});
      if(setMsg){ setMsg.style.display='inline'; setTimeout(()=>setMsg.style.display='none',3000); }
      toast('Settings saved','success');
    } catch(e){ toast(e.message,'error'); }
  });
};

// ─── WIRE NOTIFICATIONS ON LOAD ──────────────────────────────────────────────
// initNotifications is called once auth is confirmed (already wired into onAuthStateChanged below)
// Patch: hook into existing auth listener
const _origOnAuth = window.__adminOnAuthHook;
if (typeof initNotifications === 'function') {
  // Wait for DOM ready then init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNotifications);
  } else {
    initNotifications();
  }
}
