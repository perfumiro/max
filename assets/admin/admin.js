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
// Image uploads use Cloudinary (unsigned preset — no Firebase Storage needed)

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

// ─── CLOUDINARY CONFIG ────────────────────────────────────────────────────────
const CLOUDINARY_CLOUD = 'dp5eszu4p';
const CLOUDINARY_PRESET = 'IPORIDSE_PRODUCTS';

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

      // Sizes to hide: explicitly removed (× button or rename-away) + pending UI removals
      const removed = new Set([
        ...(ov.removedSizes || []).map(normSizeKey),
        ...[...pendingSet].map(normSizeKey),
      ]);

      // Union of base sizes + any extra sizes added/renamed in admin (in ov.prices)
      // This ensures zero-base products (Xerjoff/UL) keep unpriced sizes visible,
      // while renamed sizes (tracked in removedSizes) stay hidden.
      const allSizes = new Set([
        ...Object.keys(base).map(normSizeKey),
        ...Object.keys(ov.prices || {}),
      ]);

      const merged = {};
      allSizes.forEach(sz => {
        if (removed.has(sz)) return;
        const fsPrice = ov.prices?.[sz];
        // Use FS price if positive, otherwise fall back to base price (may be 0)
        merged[sz] = (fsPrice > 0) ? fsPrice : (base[normSizeKey(sz)] ?? 0);
      });
      return merged;
    };

    const productName = (slug) => slug.replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase());

    // ── Product image lookup ────────────────────────────────────────────────
    const PRODUCT_IMG = {
      // ── Armani ──────────────────────────────────────────────────────────
      'armani-stronger-with-you-absolutely-perfume':     '/assets/images/products/armani/armani-stronger-with-you-absolutely-perfume/1.webp',
      'armani-stronger-with-you-powerfully-eau-de-parfum': '/assets/images/products/armani/armani-stronger-with-you-powerfully-eau-de-parfum/1.webp',
      'emporio-armani-stronger-with-you-intensely-edp':  '/assets/images/products/armani/emporio-armani-stronger-with-you-intensely/1.webp',
      // ── Azzaro ──────────────────────────────────────────────────────────
      'azzaro-forever-wanted-elixir-eau-de-parfum':      '/assets/images/products/azzaro/azzaro-forever-wanted-elixir-eau-de-parfum/1.jpg',
      'azzaro-the-most-wanted-eau-de-parfum-intense':    '/assets/images/products/azzaro/azzaro-the-most-wanted-eau-de-parfum-intense/1.webp',
      'azzaro-the-most-wanted-parfum':                   '/assets/images/products/azzaro/azzaro-the-most-wanted-parfum/1.webp',
      // ── Carolina Herrera ────────────────────────────────────────────────
      'carolina-herrera-bad-boy-eau-de-toilette':        '/assets/images/products/carolina-herrera/carolina-herrera-bad-boy-eau-de-toilette/1.jpg',
      // ── Chanel ──────────────────────────────────────────────────────────
      'bleu-de-chanel-eau-de-parfum-spray':              '/assets/images/products/chanel/bleu-de-chanel-eau-de-parfum-spray/1.jpg',
      // ── Dior ────────────────────────────────────────────────────────────
      'dior-homme-intense-eau-de-parfum':                '/assets/images/products/dior/dior-homme-intense-eau-de-parfum/1.jpg',
      'dior-sauvage-eau-de-parfum':                      '/assets/images/products/dior/dior-sauvage-eau-de-parfum/1.jpg',
      // ── Givenchy ────────────────────────────────────────────────────────
      'gentleman-private-reserve-eau-de-parfum':         '/assets/images/products/givenchy/gentleman-private-reserve-eau-de-parfum/1.png',
      'givenchy-gentleman-society-amber-eau-de-parfum':  '/assets/images/products/givenchy/givenchy-gentleman-society-amber-eau-de-parfum/1.jpg',
      'givenchy-gentleman-society-extreme-eau-de-parfum':'/assets/images/products/givenchy/givenchy-gentleman-society-extreme-eau-de-parfum/1.webp',
      'givenchy-gentleman-society-nomade-eau-de-parfum': '/assets/images/products/givenchy/givenchy-gentleman-society-nomade-eau-de-parfum/1.webp',
      // ── Gucci ───────────────────────────────────────────────────────────
      'gucci-guilty-absolu-de-parfum-pour-homme':        '/assets/images/products/gucci/gucci-guilty-absolu-de-parfum-pour-homme/1.webp',
      'gucci-guilty-elixir-pour-homme':                  '/assets/images/products/gucci/gucci-guilty-elixir-pour-homme/1.webp',
      // ── Guerlain ────────────────────────────────────────────────────────
      'guerlain-l-homme-ideal-extreme':                  '/assets/images/products/guerlain/lhomme-ideal-extreme/1.jpg',
      'guerlain-l-homme-ideal-l-intense-eau-de-parfum':  '/assets/images/products/guerlain/lhomme-ideal-lintense-eau-de-parfum/1.webp',
      // legacy keys (keep for any existing Firestore overrides)
      'lhomme-ideal-extreme':                            '/assets/images/products/guerlain/lhomme-ideal-extreme/1.jpg',
      'lhomme-ideal-lintense-eau-de-parfum':             '/assets/images/products/guerlain/lhomme-ideal-lintense-eau-de-parfum/1.webp',
      // ── Hugo Boss ───────────────────────────────────────────────────────
      'boss-bottled-absolu-intense':                     '/assets/images/products/hugo-boss/boss-bottled-absolu-intense/1.jpeg',
      'hugo-boss-boss-bottled-elixir-intense':           '/assets/images/products/hugo-boss/hugo-boss-boss-bottled-elixir-intense/1.jpeg',
      'hugo-boss-the-scent-for-him-elixir':              '/assets/images/products/hugo-boss/hugo-boss-the-scent-for-him-elixir/1.png',
      // ── Jean Paul Gaultier ──────────────────────────────────────────────
      'jean-paul-gaultier-le-beau-eau-de-parfum':        '/assets/images/products/jean-paul-gaultier/jean-paul-gaultier-le-beau-eau-de-parfum/1.webp',
      'jean-paul-gaultier-le-male-elixir':               '/assets/images/products/jean-paul-gaultier/jean-paul-gaultier-le-male-elixir/1.webp',
      'jean-paul-gaultier-le-male-elixir-eau-de-parfum': '/assets/images/products/jean-paul-gaultier/jean-paul-gaultier-le-male-elixir/1.webp',
      'jean-paul-gaultier-le-male-in-blue-eau-de-parfum':'/assets/images/products/jean-paul-gaultier/jean-paul-gaultier-le-male-in-blue-eau-de-parfum/1.jpg',
      'jean-paul-gaultier-le-male-le-parfum-eau-de-parfum':'/assets/images/products/jean-paul-gaultier/jean-paul-gaultier-le-male-le-parfum-eau-de-parfum/1.webp',
      'jean-paul-gaultier-le-male-eau-de-toilette':      '/assets/images/products/jean-paul-gaultier/le-male-eau-de-toilette/1.png',
      'jean-paul-gaultier-scandal-elixir':               '/assets/images/products/jean-paul-gaultier/jean-paul-gaultier-scandal-elixir/1.jpg',
      'jean-paul-gaultier-scandal-intense-eau-de-parfum':'/assets/images/products/jean-paul-gaultier/jean-paul-gaultier-scandal-intense-eau-de-parfum/1.jpg',
      'le-male-eau-de-toilette':                         '/assets/images/products/jean-paul-gaultier/le-male-eau-de-toilette/1.png',
      // ── Montale ─────────────────────────────────────────────────────────
      'montale-arabians-tonka':                          '/assets/images/products/montale/montale-arabians-tonka/1.webp',
      // ── Prada ───────────────────────────────────────────────────────────
      'prada-l-homme-edt':                               '/assets/images/products/prada/prada-lhomme-edt/1.jpg',
      'prada-lhomme-edt':                                '/assets/images/products/prada/prada-lhomme-edt/1.jpg',
      'prada-luna-rossa-black-eau-de-parfum':            '/assets/images/products/prada/prada-luna-rossa-black-eau-de-parfum/1.jpg',
      'prada-luna-rossa-carbon-edt':                     '/assets/images/products/prada/prada-luna-rossa-carbon-edt/1.jpg',
      'prada-luna-rossa-men-edt':                        '/assets/images/products/prada/prada-luna-rossa-men-edt/1.jfif',
      'prada-luna-rossa-ocean-eau-de-parfum':            '/assets/images/products/prada/prada-luna-rossa-ocean-eau-de-parfum/1.jpg',
      'prada-luna-rossa-ocean-le-parfum':                '/assets/images/products/prada/prada-luna-rossa-ocean-le-parfum/1.jpg',
      'prada-paradigme-eau-de-parfum':                   '/assets/images/products/prada/prada-paradigme-eau-de-parfum/1.png',
      // ── Rabanne ─────────────────────────────────────────────────────────
      'rabanne-one-million-elixir-intense':              '/assets/images/products/rabanne/rabanne-one-million-elixir-intense/1.webp',
      'rabanne-one-million-parfum':                      '/assets/images/products/rabanne/rabanne-one-million-parfum/1.jpg',
      // ── Unique'e Luxury ─────────────────────────────────────────────────
      'akdeniz':                                         '/assets/images/products/unique-luxury/akdeniz/1.webp',
      'aphrodisiac-touch':                               '/assets/images/products/unique-luxury/aphrodisiac-touch/1.webp',
      'beril':                                           '/assets/images/products/unique-luxury/beril/1.webp',
      'beverly-hills-exclusive':                         '/assets/images/products/unique-luxury/beverly-hills-exclusive/1.webp',
      'kutay':                                           '/assets/images/products/unique-luxury/kutay/1.webp',
      // ── Valentino ───────────────────────────────────────────────────────
      'valentino-born-in-roma-donna-intense-eau-de-parfum':       '/assets/images/products/valentino/valentino-born-in-roma-donna-intense-eau-de-parfum/1.webp',
      'valentino-born-in-roma-uomo-intense-eau-de-parfum':        '/assets/images/products/valentino/valentino-born-in-roma-uomo-intense-eau-de-parfum/1.webp',
      'valentino-born-in-roma-extradose-eau-de-toilette':         '/assets/images/products/valentino/valentino-born-in-rome-extradose/1.jpg',
      'valentino-born-in-rome-extradose':                         '/assets/images/products/valentino/valentino-born-in-rome-extradose/1.jpg',
      'valentino-donna-born-in-roma-eau-de-parfum':               '/assets/images/products/valentino/valentino-donna-born-in-roma-eau-de-parfum/1.webp',
      'valentino-uomo-born-in-roma-coral-fantasy-eau-de-toilette':'/assets/images/products/valentino/valentino-uomo-born-in-roma-coral-fantasy-eau-de-toilette/1.webp',
      'valentino-uomo-born-in-roma-eau-de-toilette':              '/assets/images/products/valentino/valentino-uomo-born-in-roma-eau-de-toilette/1.jpg',
      'valentino-uomo-born-in-roma-purple-melancholia-eau-de-toilette':'/assets/images/products/valentino/valentino-uomo-born-in-roma-purple-melancholia-eau-de-toilette/1.jpg',
      // ── Versace ─────────────────────────────────────────────────────────
      'versace-dylan-blue-eau-de-toilette':              '/assets/images/products/versace/versace-dylan-blue-eau-de-toilette/1.jpg',
      'versace-eros-eau-de-parfum':                      '/assets/images/products/versace/versace-eros-eau-de-parfum/1.webp',
      'versace-eros-energy-eau-de-parfum':               '/assets/images/products/versace/versace-eros-energy-eau-de-parfum/1.jpg',
      'versace-eros-flame-eau-de-parfum':                '/assets/images/products/versace/versace-eros-flame-eau-de-parfum/1.jpg',
      // ── XERJOFF ─────────────────────────────────────────────────────────
      'alexandria-ii':                                   '/assets/images/products/xerjoff/xerjoff-alexandria-ll-eau-de-parfum/1.webp',
      'erba-pura':                                       '/assets/images/products/xerjoff/xerjoff-erba-pura/1.webp',
      'naxos':                                           '/assets/images/products/xerjoff/xerjoff-naxos/1.webp',
      'xerjoff-alexandria-ll-eau-de-parfum':             '/assets/images/products/xerjoff/xerjoff-alexandria-ll-eau-de-parfum/1.webp',
      'xerjoff-erba-pura':                               '/assets/images/products/xerjoff/xerjoff-erba-pura/1.webp',
      'xerjoff-naxos':                                   '/assets/images/products/xerjoff/xerjoff-naxos/1.webp',
      // ── YSL ─────────────────────────────────────────────────────────────
      'yves-saint-laurent-myslf-eau-de-parfum':          '/assets/images/products/ysl/yves-saint-laurent-myslf-eau-de-parfum/1.jpg',
      'yves-saint-laurent-myslf-le-parfum':              '/assets/images/products/ysl/yves-saint-laurent-myslf-le-parfum/1.webp',
      'yves-saint-laurent-y-eau-de-parfum':              '/assets/images/products/ysl/yves-saint-laurent-y-eau-de-parfum/1.webp',
    };

    // ── Render ─────────────────────────────────────────────────────────────
    const render = () => {
      const q      = (searchEl?.value || '').toLowerCase();
      const status = filterEl?.value || '';

      // ── Admin Added: scroll to Firestore section, clear grid ──────────
      if (status === 'admin-added') {
        grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:36px 24px;color:var(--muted);border:2px dashed var(--border);border-radius:12px">
          <i class="fas fa-arrow-up" style="font-size:22px;color:var(--gold);display:block;margin-bottom:10px;animation:bounce .8s ease-in-out infinite alternate"></i>
          <div style="font-size:13px;font-weight:700;color:var(--ink);margin-bottom:4px">Admin-Added Products are shown above</div>
          <div style="font-size:11px;color:var(--muted)">Products added via the <strong style="color:var(--gold)">&plus; Add New Product</strong> button appear in the section above this grid.</div>
        </div>`;
        const fsSection = document.getElementById('firestoreProductsSection');
        if (fsSection) {
          fsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
          fsSection.style.outline = '2px solid var(--gold)';
          fsSection.style.borderRadius = '10px';
          setTimeout(() => { fsSection.style.outline = ''; fsSection.style.borderRadius = ''; }, 2200);
        }
        return;
      }

      const filtered = slugs.filter(slug => {
        const ov       = overrides[slug] || {};
        const disabled = ov.disabled || false;
        const hasOv    = !!(Object.keys(ov.prices||{}).length || (ov.removedSizes||[]).length);
        if (q && !slug.replace(/-/g,' ').includes(q)) return false;
        if (status === 'active'    && disabled) return false;
        if (status === 'disabled'  && !disabled) return false;
        if (status === 'overridden'&& (!hasOv || disabled)) return false;
        if (status === 'xerjoff'   && !['alexandria-ii','erba-pura','naxos'].includes(slug)) return false;
        if (status === 'unique'    && !['akdeniz','aphrodisiac-touch','beril','beverly-hills-exclusive','kutay'].includes(slug)) return false;
        if (status === 'has-price') {
          const sizes = effectiveSizes(slug);
          if (!Object.values(sizes).some(p => p > 0)) return false;
        }
        if (status === 'no-price') {
          const sizes = effectiveSizes(slug);
          if (Object.values(sizes).some(p => p > 0)) return false;
        }
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

      const renderCard = (slug) => {
        const ov         = overrides[slug] || {};
        const disabled   = ov.disabled || false;
        const hasOverride= !!(Object.keys(ov.prices||{}).length || (ov.removedSizes||[]).length);
        const isDirty    = dirty.has(slug);
        const name       = productName(slug);
        const sizes      = effectiveSizes(slug);
        const baseKeys   = Object.keys(pricesRes[slug] || {});

        // ── Promotion helpers ───────────────────────────────────────────
        const origPricesMap = ov.promoPrices && typeof ov.promoPrices === 'object' ? ov.promoPrices : {};
        const hasPromo = Object.keys(origPricesMap).some(sz => origPricesMap[sz] > 0);
        let bestDiscount = 0;
        let hasInvalidPromoEntry = false;
        if (hasPromo) {
          Object.entries(origPricesMap).forEach(([sz, promoP]) => {
            const fullP = sizes[sz];
            if (fullP > 0 && promoP > 0 && promoP < fullP) {
              const pct = Math.round((1 - promoP / fullP) * 100);
              if (pct > bestDiscount) bestDiscount = pct;
            } else if (promoP > 0) {
              hasInvalidPromoEntry = true;
            }
          });
        }
        const hasValidPromo = bestDiscount > 0;

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
                  ${hasPromo ? `<span style="font-size:10px;font-weight:700;color:var(--emerald);background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.25);padding:2px 8px;border-radius:99px"><i class="fas fa-tag" style="font-size:9px;margin-right:3px"></i>Promo${bestDiscount > 0 ? ' ·&nbsp;-' + bestDiscount + '%' : ''}</span>` : ''}
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

            <!-- ── Add size form (hidden for fixed-size brands) ── -->
            ${(['alexandria-ii','erba-pura','naxos','akdeniz','aphrodisiac-touch','beril','beverly-hills-exclusive','kutay'].includes(slug)) ? '' : `
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
            </div>`}

            <!-- ── Promotion panel ── -->
            <div class="prod-promo-panel" data-slug="${esc(slug)}" style="margin-top:6px">
              <button class="prod-promo-toggle-btn" data-slug="${esc(slug)}" type="button"
                style="width:100%;display:flex;align-items:center;gap:8px;padding:7px 10px;background:${hasValidPromo ? 'rgba(200,169,106,.08)' : hasInvalidPromoEntry ? 'rgba(244,63,94,.06)' : 'var(--s3)'};border:1px dashed ${hasValidPromo ? 'var(--gold)' : hasInvalidPromoEntry ? 'var(--rose)' : 'var(--border)'};border-radius:${hasPromo ? '8px 8px 0 0' : '8px'};cursor:pointer;transition:all .15s;outline:none;text-align:left">
                <i class="fas fa-${hasValidPromo ? 'tag' : hasInvalidPromoEntry ? 'triangle-exclamation' : 'tag'}" style="font-size:10px;color:${hasValidPromo ? 'var(--gold)' : hasInvalidPromoEntry ? 'var(--rose)' : 'var(--gold)'};flex-shrink:0"></i>
                <span style="font-size:10px;font-weight:700;color:${hasValidPromo ? 'var(--gold)' : hasInvalidPromoEntry ? 'var(--rose)' : 'var(--gold)'};letter-spacing:.4px;text-transform:uppercase;flex:1">
                  ${hasValidPromo ? `Promotion Active · Up to -${bestDiscount}%` : hasInvalidPromoEntry ? '⚠ Promotion Invalid — Must Fix & Save' : 'Add Promotion'}
                </span>
                <i class="fas fa-chevron-${hasPromo ? 'up' : 'down'} prod-promo-chevron" style="font-size:9px;color:var(--muted)"></i>
              </button>
              <div class="prod-promo-content" style="display:${hasPromo ? 'block' : 'none'};padding:10px 10px 10px;background:${hasInvalidPromoEntry && !hasValidPromo ? 'rgba(244,63,94,.04)' : 'rgba(200,169,106,.04)'};border:1px dashed ${hasInvalidPromoEntry && !hasValidPromo ? 'var(--rose)' : 'var(--gold)'};border-top:none;border-radius:0 0 8px 8px">
                ${hasInvalidPromoEntry ? `<div style="background:rgba(244,63,94,.12);border:1px solid var(--rose);border-radius:6px;padding:7px 10px;margin-bottom:8px;display:flex;align-items:flex-start;gap:7px">
                  <i class="fas fa-triangle-exclamation" style="color:var(--rose);font-size:12px;flex-shrink:0;margin-top:1px"></i>
                  <span style="font-size:10px;font-weight:700;color:var(--rose);line-height:1.5">The stored "Was" price is <strong>lower than or equal to the current sale price</strong> — it won't show on the product page. Enter a value <strong>HIGHER</strong> than the current price (shown as "→ Sale: X") and click <strong>Save</strong>.</span>
                </div>` : ''}
                <p style="font-size:10px;color:var(--muted);margin-bottom:8px;font-weight:600;line-height:1.4">
                  <i class="fas fa-circle-info" style="margin-right:4px"></i>Enter the <strong style="color:var(--ink)">original (before-sale) price</strong> per size — it <strong style="color:var(--rose)">must be higher</strong> than the current price. The current price will appear as the discounted sale price with a strikethrough on the product page.
                </p>
                <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px">
                  ${Object.keys(sizes).sort((a,b)=>{ const n=s=>parseInt(s.replace(/\D/g,''),10)||0; return n(a)-n(b); }).map(sz => {
                    const fullP  = sizes[sz];
                    const promoP = origPricesMap[sz] || '';
                    const pct    = (promoP && fullP && promoP < fullP) ? Math.round((1 - promoP / fullP) * 100) : 0;
                    const isInvalid = promoP && promoP >= fullP;
                    const rowBorder = promoP ? (isInvalid ? 'var(--rose)' : 'var(--gold)') : 'var(--border)';
                    const badgeBg   = pct > 0 ? 'var(--emerald)' : (isInvalid ? 'var(--rose)' : 'var(--s4)');
                    const badgeTxt  = pct > 0 ? '-' + pct + '%' : (isInvalid ? '⚠' : '');
                    const suggestedPromo = Math.max(1, Math.floor(fullP * 0.85));
                    return `<div class="prod-promo-size-row" data-slug="${esc(slug)}" data-size="${esc(sz)}" data-sale="${fullP}" style="display:inline-flex;align-items:center;gap:5px;padding:5px 8px;background:var(--s2);border:1px solid ${rowBorder};border-radius:7px;transition:border-color .15s">
                      <span style="font-size:11px;font-weight:700;color:var(--ink);min-width:32px">${esc(sz)}</span>
                      <span style="font-size:9px;color:var(--dim);white-space:nowrap">Sale:</span>
                      <input type="number" min="0" class="prod-orig-price-input" data-slug="${esc(slug)}" data-size="${esc(sz)}" value="${esc(String(promoP))}" placeholder="e.g. ${suggestedPromo}"
                        style="width:64px;border:1px solid ${isInvalid ? 'var(--rose)' : 'var(--border)'};border-radius:5px;background:var(--s3);padding:3px 6px;font-size:12px;color:var(--ink);font-weight:600;outline:none;text-align:right;transition:border-color .15s"
                        onfocus="this.style.borderColor='var(--gold)'" onblur="const v=parseFloat(this.value)||0,s=parseFloat(this.closest('.prod-promo-size-row').dataset.sale||0);this.style.borderColor=v>0&&v>=s?'var(--rose)':v>0&&v<s?'var(--gold)':'var(--border)'"
                        title="Sale (promo) price for ${esc(sz)} — must be LOWER than ${fullP} MAD">
                      <span style="font-size:10px;color:var(--dim);font-weight:500">MAD</span>
                      <span style="font-size:9px;color:var(--dim);white-space:nowrap;margin-left:2px">Full: <strong style="color:var(--muted)">${fullP}</strong></span>
                      <span class="prod-promo-pct-badge" style="font-size:10px;font-weight:800;color:#fff;background:${badgeBg};border-radius:99px;padding:2px 7px;min-width:36px;text-align:center;transition:background .2s">${badgeTxt}</span>
                    </div>`;
                  }).join('')}
                </div>
                <button class="prod-promo-clear btn btn-xs" data-slug="${esc(slug)}" type="button"
                  style="font-size:10px;color:var(--rose);background:rgba(244,63,94,.08);border:1px solid rgba(244,63,94,.25);gap:4px;padding:3px 10px">
                  <i class="fas fa-trash-can" style="font-size:9px"></i> Clear Promotion
                </button>
              </div>
            </div>

          </div>
        </div>`;
      };

      // ── Group products by brand section ────────────────────────────────
      const _XERJ_SET = new Set(['alexandria-ii', 'erba-pura', 'naxos']);
      const _UNIQ_SET = new Set(['akdeniz', 'aphrodisiac-touch', 'beril', 'beverly-hills-exclusive', 'kutay']);
      const _xerjSlugs = filtered.filter(s => _XERJ_SET.has(s));
      const _uniqSlugs = filtered.filter(s => _UNIQ_SET.has(s));
      const _mainSlugs = filtered.filter(s => !_XERJ_SET.has(s) && !_UNIQ_SET.has(s));

      const _brandSection = (label, sub, icon, accent, groupSlugs) => {
        if (groupSlugs.length === 0) return '';
        return '<div class="prod-brand-section" style="margin-bottom:28px">' +
          '<div style="display:flex;align-items:center;gap:12px;padding:12px 16px;background:var(--s3);border-radius:10px 10px 0 0;border:1px solid var(--border);border-bottom:3px solid ' + accent + '">' +
          '<i class="' + icon + '" style="color:' + accent + ';font-size:18px;flex-shrink:0"></i>' +
          '<div style="flex:1;min-width:0">' +
          '<div style="font-size:13px;font-weight:800;color:var(--ink);letter-spacing:.5px;text-transform:uppercase">' + label + '</div>' +
          '<div style="font-size:10px;color:var(--muted);margin-top:2px">' + sub + '</div>' +
          '</div>' +
          '<span style="font-size:11px;font-weight:700;color:' + accent + ';padding:3px 12px;border-radius:99px;border:1.5px solid ' + accent + ';background:var(--s4);white-space:nowrap">' + groupSlugs.length + ' product' + (groupSlugs.length !== 1 ? 's' : '') + '</span>' +
          '</div>' +
          '<div style="display:grid;gap:10px;padding:10px 0 4px 0">' + groupSlugs.map(renderCard).join('') + '</div>' +
          '</div>';
      };

      const _mainSection = _mainSlugs.length > 0
        ? '<div class="prod-brand-section" style="margin-bottom:28px">' +
          '<div style="display:flex;align-items:center;gap:12px;padding:12px 16px;background:var(--s3);border-radius:10px 10px 0 0;border:1px solid var(--border);border-bottom:3px solid var(--sky)">' +
          '<i class="fas fa-bottle-droplet" style="color:var(--sky);font-size:18px;flex-shrink:0"></i>' +
          '<div style="flex:1;min-width:0">' +
          '<div style="font-size:13px;font-weight:800;color:var(--ink);letter-spacing:.5px;text-transform:uppercase">Main Collection</div>' +
          '<div style="font-size:10px;color:var(--muted);margin-top:2px">Standard products — prices.json</div>' +
          '</div>' +
          '<span style="font-size:11px;font-weight:700;color:var(--sky);padding:3px 12px;border-radius:99px;border:1.5px solid var(--sky);background:var(--s4);white-space:nowrap">' + _mainSlugs.length + ' products</span>' +
          '</div>' +
          '<div style="display:grid;gap:10px;padding:10px 0 4px 0">' + _mainSlugs.map(renderCard).join('') + '</div>' +
          '</div>'
        : '';

      grid.innerHTML =
        _brandSection('XERJOFF', 'Italian Haute Parfumerie \u00b7 Decants (5 ML & 10 ML)', 'fas fa-gem', '#7c3aed', _xerjSlugs) +
        _brandSection('Unique\u2019e Luxury', 'House of Unique\u2019e Luxury \u00b7 Extrait de Parfum', 'fas fa-crown', '#c9a227', _uniqSlugs) +
        _mainSection;

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

      // Wire original price inputs → update discount % badge + mark dirty
      grid.querySelectorAll('.prod-orig-price-input').forEach(inp => {
        inp.addEventListener('input', () => {
          const slug  = inp.dataset.slug;
          const sz    = inp.dataset.size;
          const promoP = parseFloat(inp.value) || 0;
          // Find current full price from the size chip
          const chip = grid.querySelector(`.prod-size-chip[data-slug="${slug}"][data-size="${sz}"]`);
          const fullP = parseFloat(chip?.querySelector('.prod-price-input')?.value) || 0;
          // Update the % badge in this row
          const row = inp.closest('.prod-promo-size-row');
          if (row) {
            const badge    = row.querySelector('.prod-promo-pct-badge');
            const isInvalid = promoP > 0 && promoP >= fullP;
            const pct      = (promoP > 0 && promoP < fullP && fullP > 0) ? Math.round((1 - promoP / fullP) * 100) : 0;
            if (badge) {
              badge.textContent = pct > 0 ? '-' + pct + '%' : (isInvalid ? '⚠' : '');
              badge.style.background = pct > 0 ? 'var(--emerald)' : (isInvalid ? 'var(--rose)' : 'var(--s4)');
            }
            inp.style.borderColor = isInvalid ? 'var(--rose)' : (promoP > 0 ? 'var(--gold)' : 'var(--border)');
            row.style.borderColor  = promoP > 0 ? (isInvalid ? 'var(--rose)' : 'var(--gold)') : 'var(--border)';
          }
          // Mark dirty
          if (slug) {
            dirty.add(slug);
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
          }
        });
      });

      // Wire promo toggle buttons → expand/collapse panel
      grid.querySelectorAll('.prod-promo-toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const panel   = btn.closest('.prod-promo-panel');
          const content = panel?.querySelector('.prod-promo-content');
          const chevron = btn.querySelector('.prod-promo-chevron');
          if (!content) return;
          const open = content.style.display !== 'none';
          content.style.display = open ? 'none' : 'block';
          btn.style.borderRadius = open ? '8px' : '8px 8px 0 0';
          if (chevron) {
            chevron.classList.toggle('fa-chevron-down', open);
            chevron.classList.toggle('fa-chevron-up', !open);
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

    // ── Add New Product button ────────────────────────────────────────────
    const addNewProductBtn = document.getElementById('addNewProductBtn');
    if (addNewProductBtn) {
      const fresh = addNewProductBtn.cloneNode(true);
      addNewProductBtn.replaceWith(fresh);
      fresh.addEventListener('click', () => openAddProductModal());
    }

    // ── Load Firestore products section ──────────────────────────────────
    loadFirestoreProductsSection();

    // ── Event delegation ───────────────────────────────────────────────────
    grid.addEventListener('click', async (e) => {
      const saveBtn   = e.target.closest('.prod-save');
      const toggleBtn = e.target.closest('.prod-toggle');
      const removeBtn = e.target.closest('.prod-remove-size');
      const addBtn    = e.target.closest('.prod-add-size');
      const resetBtn  = e.target.closest('.prod-reset');
      const promoClearBtn = e.target.closest('.prod-promo-clear');
      if (!saveBtn && !toggleBtn && !removeBtn && !addBtn && !resetBtn && !promoClearBtn) return;

      const slug = (saveBtn||toggleBtn||removeBtn||addBtn||resetBtn||promoClearBtn).dataset.slug;
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
        // Merge all currently visible sizes into override prices first so that
        // existing base sizes (from prices.json) are not dropped when Firestore
        // switches to "prices are authoritative" mode after this first override.
        const currentSizes = effectiveSizes(slug);
        Object.entries(currentSizes).forEach(([k, v]) => {
          if (!overrides[slug].prices[k]) overrides[slug].prices[k] = v;
        });
        // Also restore any base sizes (from prices.json) that ended up in
        // removedSizes due to the previous bug — unless the user explicitly
        // removed them in this session via pendingRemovals.
        const baseForSlug = pricesRes[slug] || {};
        Object.entries(baseForSlug).forEach(([k, v]) => {
          const nk = normSizeKey(k);
          if (!overrides[slug].prices[nk] && !(pendingRemovals[slug]?.has(nk))) {
            overrides[slug].prices[nk] = v;
          }
        });
        // Also clear those base sizes out of removedSizes (in memory only)
        if (Array.isArray(overrides[slug].removedSizes)) {
          overrides[slug].removedSizes = overrides[slug].removedSizes.filter(
            s => pendingRemovals[slug]?.has(s)
          );
        }
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
        const renamedAway = new Set(); // original size names that were renamed to something new
        let hasError = false;
        chips.forEach(chip => {
          const originalSz = normSizeKey(chip.dataset.size || '');
          const nameInp = chip.querySelector('.prod-size-name-input');
          const sz      = normSizeKey((nameInp?.value || chip.dataset.size || '').trim());
          const inp     = chip.querySelector('.prod-price-input');
          const price   = parseFloat(inp?.value ?? '');
          if (!sz) return;
          if (isNaN(price) || price < 0) { hasError = true; return; }
          // Detect duplicate size name: another chip already wrote this key
          if (sz in prices) {
            hasError = true;
            if (nameInp) nameInp.style.borderBottom = '2px solid var(--rose)';
            return;
          }
          const isRename = originalSz && sz !== originalSz;
          // Skip zero-priced chips ONLY if the name was NOT changed.
          // Renamed sizes must always be saved (even at 0) so the new name
          // persists in ov.prices and effectiveSizes() can include it in allSizes.
          if (price === 0 && !isRename) return;
          prices[sz] = price;
          if (isRename) renamedAway.add(originalSz);
        });
        if (hasError) { toast('Fix invalid prices before saving — duplicate or invalid size names', 'error'); return; }

        // ── Collect original prices from promotion panel ─────────────────
        const originalPrices = {};
        let promoError = false;
        card.querySelectorAll('.prod-orig-price-input').forEach(inp => {
          const sz    = normSizeKey((inp.dataset.size || '').trim());
          const promoP = parseFloat(inp.value);
          if (!sz || !inp.value.trim()) return; // skip empty
          if (isNaN(promoP) || promoP <= 0) return; // skip zero/invalid
          const fullP = prices[sz] || 0;
          if (promoP >= fullP) {
            promoError = true;
            inp.style.borderColor = 'var(--rose)';
            inp.closest('.prod-promo-size-row').style.borderColor = 'var(--rose)';
          } else {
            originalPrices[sz] = promoP;
          }
        });
        if (promoError) {
          // Expand the promo panel so user sees the errors
          const promoContent = card.querySelector('.prod-promo-content');
          if (promoContent) promoContent.style.display = 'block';
          toast('Promotion error: sale price must be LOWER than the current price for each size', 'error');
          return;
        }

        const pendingSet   = pendingRemovals[slug] || new Set();
        // removedSizes = previously saved removals + × clicks + renamed-away originals
        // Do NOT include base keys missing from prices — zero-base products (Xerjoff/UL)
        // leave unpriced sizes as 0 which get skipped, but those sizes must stay visible.
        const prevRemoved  = (ov.removedSizes || []).map(normSizeKey);
        const removedSizes = [
          ...prevRemoved.filter(sz => !(sz in prices)),
          ...[...pendingSet].map(normSizeKey),
          ...[...renamedAway].filter(sz => !(sz in prices)),
        ].filter((v,i,a) => a.indexOf(v)===i).filter(sz => !(prices[sz]>0));

        delete pendingRemovals[slug];

        // If no positive prices remain, treat Save as a Reset (delete the override doc)
        // This prevents writing a corrupt {prices:{}, removedSizes:[...]} state for
        // Xerjoff/Unique Luxury products whose base prices.json values are all 0.
        if (Object.keys(prices).length === 0) {
          const btn2 = card.querySelector('.prod-save');
          if (btn2) { btn2.disabled=true; btn2.innerHTML='<i class="fas fa-spinner fa-spin"></i> Saving…'; }
          try {
            await deleteDoc(doc(db,'productOverrides',slug));
            delete overrides[slug];
            dirty.delete(slug);
            toast(`✓ ${productName(slug)} saved (no prices set — override cleared)`, 'success');
            render();
          } catch(err) {
            toast('Save failed: ' + err.message, 'error');
            if (btn2) { btn2.disabled=false; btn2.innerHTML='<i class="fas fa-floppy-disk"></i> Save'; }
          }
          return;
        }

        const savePayload = { ...(ov.disabled !== undefined ? {disabled: ov.disabled} : {}), prices, removedSizes };
        if (Object.keys(originalPrices).length > 0) savePayload.promoPrices = originalPrices;
        overrides[slug] = savePayload;

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
        if (!confirm(`Reset "${productName(slug)}" to defaults?\n\nAll price, size overrides and promotions will be deleted.`)) return;
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

      // ── Clear promotion ──────────────────────────────────────────────────
      if (promoClearBtn) {
        const card = grid.querySelector(`.prod-card[data-slug="${slug}"]`);
        if (!card) return;
        // Clear all original price inputs in the panel
        card.querySelectorAll('.prod-orig-price-input').forEach(inp => { inp.value = ''; });
        // Reset the % badges
        card.querySelectorAll('.prod-promo-pct-badge').forEach(b => { b.textContent = ''; b.style.background = 'var(--s4)'; });
        // Reset row borders
        card.querySelectorAll('.prod-promo-size-row').forEach(r => { r.style.borderColor = 'var(--border)'; });
        // Clear in-memory promoPrices so save doesn't re-save them
        if (overrides[slug]) delete overrides[slug].promoPrices;
        dirty.add(slug);
        // Update the toggle button text
        const promoToggleBtn = card.querySelector('.prod-promo-toggle-btn');
        if (promoToggleBtn) {
          promoToggleBtn.style.background = 'var(--s3)';
          promoToggleBtn.style.borderColor = 'var(--border)';
          const span = promoToggleBtn.querySelector('span');
          if (span) span.textContent = 'Add Promotion';
        }
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
        toast('Promotion cleared — click Save to apply', 'success');
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

// ─── ADD NEW PRODUCT FEATURE ─────────────────────────────────────────────────

// All known accords with their display colors (mirrors script.js accordDefinitions)
const _ACCORD_PALETTE = [
  { label: 'lavender',    color: '#b8addf', textColor: '#233044' },
  { label: 'vanilla',     color: '#efe8c6', textColor: '#2b2b2b' },
  { label: 'amber',       color: '#d4a373', textColor: '#ffffff' },
  { label: 'aromatic',    color: '#61c3b1', textColor: '#163b38' },
  { label: 'woody',       color: '#9b7a5f', textColor: '#ffffff' },
  { label: 'fresh spicy', color: '#b6cf84', textColor: '#26321d' },
  { label: 'warm spicy',  color: '#c2885d', textColor: '#ffffff' },
  { label: 'fruity',      color: '#e88c8b', textColor: '#ffffff' },
  { label: 'floral',      color: '#dfa7b8', textColor: '#402633' },
  { label: 'white floral',color: '#f2e8ef', textColor: '#533a47' },
  { label: 'powdery',     color: '#f2ede5', textColor: '#5a5350' },
  { label: 'citrus',      color: '#e7d67a', textColor: '#413a12' },
  { label: 'leather',     color: '#7c5a46', textColor: '#ffffff' },
  { label: 'tobacco',     color: '#8b6847', textColor: '#ffffff' },
  { label: 'smoky',       color: '#7b7b88', textColor: '#ffffff' },
  { label: 'sweet',       color: '#e3b1b2', textColor: '#ffffff' },
  { label: 'earthy',      color: '#8c8880', textColor: '#ffffff' },
  { label: 'fresh',       color: '#bbddd2', textColor: '#21433c' },
  { label: 'boozy',       color: '#8d5a3b', textColor: '#ffffff' },
  { label: 'coffee',      color: '#6e4c39', textColor: '#ffffff' },
  { label: 'musky',       color: '#d9d5d0', textColor: '#49433f' },
  { label: 'oriental',    color: '#c9813a', textColor: '#ffffff' },
  { label: 'marine',      color: '#5b9fc2', textColor: '#ffffff' },
  { label: 'herbal',      color: '#c8d5cb', textColor: '#33423a' },
  { label: 'resinous',    color: '#b59374', textColor: '#ffffff' },
];

/**
 * Build a visual accord picker inside `containerEl`.
 * Returns two helpers on the container:
 *   containerEl._getAccords()  → string[] of selected accord labels
 *   containerEl._setAccords(arr) → replace selection
 */
const _apInitAccordPicker = (containerEl, initial = []) => {
  const _MAX = 8;

  // ── Helpers ───────────────────────────────────────────────────────────────
  // Entry is either a plain string (predefined) or {label, color, textColor} (custom)
  const _getLabel  = e => typeof e === 'string' ? e : (e?.label || '');
  const _resolveColor = e => {
    if (typeof e === 'object' && e?.color) return { color: e.color, textColor: e.textColor || '#fff' };
    return _ACCORD_PALETTE.find(a => a.label === _getLabel(e)) || { color: '#b59374', textColor: '#fff' };
  };
  const _luma = hex => {
    const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    return (r*299 + g*587 + b*114) / 1000;
  };
  const _autoText = hex => _luma(hex) > 140 ? '#111827' : '#ffffff';

  // ── Normalise initial selection ───────────────────────────────────────────
  let _selected = (initial || []).map(e => {
    if (typeof e === 'object' && e?.label) {
      const label = String(e.label).trim().toLowerCase();
      if (_ACCORD_PALETTE.some(a => a.label === label)) return label; // predefined → string
      return { label, color: e.color || '#b59374', textColor: e.textColor || '#fff' };
    }
    return String(e).trim().toLowerCase();
  }).filter(e => _getLabel(e));

  const _render = () => {
    containerEl.innerHTML = '';

    // ── Live preview bar chart ──────────────────────────────────────────────
    const previewWrap = document.createElement('div');
    previewWrap.style.cssText = 'margin-bottom:12px';
    if (_selected.length) {
      const widths = ['100%','93%','85%','72%','69%','62%','58%','54%'];
      const previewLabel = document.createElement('div');
      previewLabel.style.cssText = 'font-size:0.7rem;font-weight:600;color:var(--muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.04em';
      previewLabel.textContent = 'Preview';
      previewWrap.appendChild(previewLabel);
      _selected.slice(0,8).forEach((entry, i) => {
        const label = _getLabel(entry);
        const meta  = _resolveColor(entry);
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;margin-bottom:4px';
        row.innerHTML = `
          <div style="height:26px;width:${widths[i]};background:${meta.color};border-radius:20px;display:flex;align-items:center;padding:0 12px;transition:width 0.3s">
            <span style="font-size:11px;font-weight:700;color:${meta.textColor};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${label}</span>
          </div>`;
        previewWrap.appendChild(row);
      });
    } else {
      previewWrap.innerHTML = `<div style="font-size:0.75rem;color:var(--dim);padding:8px 0">Select accords below to see a preview</div>`;
    }
    containerEl.appendChild(previewWrap);

    // ── Selected pills strip ────────────────────────────────────────────────
    const selectedWrap = document.createElement('div');
    selectedWrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;min-height:32px;margin-bottom:10px;padding:6px;background:var(--s4);border-radius:8px;border:1px dashed var(--border)';
    if (_selected.length) {
      _selected.forEach(entry => {
        const label = _getLabel(entry);
        const meta  = _resolveColor(entry);
        const pill = document.createElement('span');
        pill.style.cssText = `display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;background:${meta.color};color:${meta.textColor};cursor:pointer;user-select:none`;
        pill.innerHTML = `${label} <span style="font-size:13px;line-height:1;opacity:0.7">×</span>`;
        pill.title = 'Click to remove';
        pill.addEventListener('click', () => {
          _selected = _selected.filter(e => _getLabel(e) !== label);
          _render();
        });
        selectedWrap.appendChild(pill);
      });
    } else {
      const hint = document.createElement('span');
      hint.style.cssText = 'font-size:0.75rem;color:var(--dim);padding:4px;align-self:center';
      hint.textContent = 'No accords selected — click below to add';
      selectedWrap.appendChild(hint);
    }
    containerEl.appendChild(selectedWrap);

    // ── Counter ─────────────────────────────────────────────────────────────
    const counter = document.createElement('div');
    counter.style.cssText = 'font-size:0.7rem;color:var(--muted);margin-bottom:8px;text-align:right';
    counter.textContent = `${_selected.length} / ${_MAX} accords selected`;
    containerEl.appendChild(counter);

    // ── Palette grid ────────────────────────────────────────────────────────
    const paletteLabel = document.createElement('div');
    paletteLabel.style.cssText = 'font-size:0.7rem;font-weight:600;color:var(--muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.04em';
    paletteLabel.textContent = 'All Accords — click to select';
    containerEl.appendChild(paletteLabel);

    const grid = document.createElement('div');
    grid.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px';
    _ACCORD_PALETTE.forEach(acc => {
      const isSelected = _selected.some(e => _getLabel(e) === acc.label);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.style.cssText = [
        'padding:5px 12px', 'border-radius:20px', 'font-size:11px', 'font-weight:700',
        'cursor:pointer', 'user-select:none', 'transition:opacity 0.15s,transform 0.1s',
        `border:2px solid ${isSelected ? acc.color : 'transparent'}`,
        `background:${isSelected ? acc.color : acc.color + '33'}`,
        `color:${isSelected ? acc.textColor : 'var(--text)'}`,
        isSelected ? 'box-shadow:0 0 0 2px rgba(0,0,0,0.1)' : 'opacity:0.7'
      ].join(';');
      btn.textContent = acc.label;
      btn.title = isSelected ? 'Click to remove' : (_selected.length >= _MAX ? `Maximum ${_MAX} accords` : 'Click to add');
      btn.addEventListener('click', () => {
        if (isSelected) { _selected = _selected.filter(e => _getLabel(e) !== acc.label); }
        else { if (_selected.length >= _MAX) return; _selected = [..._selected, acc.label]; }
        _render();
      });
      grid.appendChild(btn);
    });
    containerEl.appendChild(grid);

    // ── Custom accord input ─────────────────────────────────────────────────
    const customSep = document.createElement('div');
    customSep.style.cssText = 'height:1px;background:var(--border);margin:12px 0';
    containerEl.appendChild(customSep);

    const customLabel = document.createElement('div');
    customLabel.style.cssText = 'font-size:0.7rem;font-weight:600;color:var(--muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.04em';
    customLabel.textContent = 'Custom Accord — not in the list above?';
    containerEl.appendChild(customLabel);

    const customRow = document.createElement('div');
    customRow.style.cssText = 'display:flex;gap:8px;align-items:center';

    const customInput = document.createElement('input');
    customInput.type = 'text';
    customInput.placeholder = 'e.g. oud, iris, saffron…';
    customInput.maxLength = 32;
    customInput.style.cssText = 'flex:1;background:var(--s3);border:1px solid var(--border);border-radius:8px;padding:7px 11px;font-size:0.82rem;color:var(--text);outline:none;box-sizing:border-box;font-family:inherit';

    const customAddBtn = document.createElement('button');
    customAddBtn.type = 'button';
    customAddBtn.style.cssText = 'padding:7px 16px;border-radius:8px;background:rgba(200,169,106,0.15);color:var(--gold);border:1px solid rgba(200,169,106,0.4);font-size:0.82rem;font-weight:700;cursor:pointer;white-space:nowrap;flex-shrink:0';
    customAddBtn.innerHTML = '<i class="fas fa-plus" style="margin-right:5px"></i>Add';

    // ── Color picker preset swatches ─────────────────────────────────────────
    const PRESET_SWATCHES = [
      '#b8addf','#d4a373','#61c3b1','#9b7a5f','#e88c8b','#b6cf84',
      '#c2885d','#dfa7b8','#7c5a46','#5b9fc2','#e7d67a','#c9813a',
      '#7b7b88','#8d5a3b','#bbddd2','#e3b1b2','#6e4c39','#c8d5cb',
    ];

    const showColorPicker = (val) => {
      // Remove any existing picker panel
      const old = containerEl.querySelector('.ap-cpanel');
      if (old) old.remove();

      let pickerColor = PRESET_SWATCHES[0];

      const panel = document.createElement('div');
      panel.className = 'ap-cpanel';
      panel.style.cssText = 'margin-top:10px;padding:12px;background:var(--s4);border-radius:10px;border:1px solid var(--border)';

      // Title + live preview pill
      const titleRow = document.createElement('div');
      titleRow.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap';
      const titleText = document.createElement('span');
      titleText.style.cssText = 'font-size:12px;font-weight:700;color:var(--text)';
      titleText.textContent = 'Choose color for:';
      const previewPill = document.createElement('span');
      previewPill.style.cssText = `font-size:12px;font-weight:800;padding:3px 12px;border-radius:20px;background:${pickerColor};color:${_autoText(pickerColor)};transition:background 0.15s,color 0.15s`;
      previewPill.textContent = val;
      titleRow.appendChild(titleText);
      titleRow.appendChild(previewPill);
      panel.appendChild(titleRow);

      const updateColor = (hex) => {
        pickerColor = hex;
        previewPill.style.background = hex;
        previewPill.style.color = _autoText(hex);
        colorNative.value = hex;
        swatchGrid.querySelectorAll('[data-sw]').forEach(s => {
          const active = s.dataset.sw === hex;
          s.style.outline = active ? '2px solid var(--gold)' : 'none';
          s.style.transform = active ? 'scale(1.18)' : 'scale(1)';
        });
      };

      // Swatch grid
      const swatchGrid = document.createElement('div');
      swatchGrid.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px';
      PRESET_SWATCHES.forEach((c, i) => {
        const sw = document.createElement('button');
        sw.type = 'button';
        sw.dataset.sw = c;
        sw.style.cssText = `width:26px;height:26px;border-radius:50%;background:${c};border:none;cursor:pointer;transition:transform 0.12s,outline 0.1s;flex-shrink:0;${i===0?'outline:2px solid var(--gold);transform:scale(1.18)':''}`;
        sw.addEventListener('click', () => updateColor(c));
        swatchGrid.appendChild(sw);
      });
      panel.appendChild(swatchGrid);

      // Native color input row
      const nativeRow = document.createElement('div');
      nativeRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:12px';
      const nativeLabel = document.createElement('span');
      nativeLabel.style.cssText = 'font-size:0.72rem;color:var(--muted)';
      nativeLabel.textContent = 'Or pick any color:';
      const colorNative = document.createElement('input');
      colorNative.type = 'color';
      colorNative.value = pickerColor;
      colorNative.style.cssText = 'width:36px;height:28px;border:1px solid var(--border);border-radius:6px;cursor:pointer;padding:2px;background:var(--s3)';
      colorNative.addEventListener('input', () => updateColor(colorNative.value));
      nativeRow.appendChild(nativeLabel);
      nativeRow.appendChild(colorNative);
      panel.appendChild(nativeRow);

      // Action buttons
      const btns = document.createElement('div');
      btns.style.cssText = 'display:flex;gap:8px';

      const confirmBtn = document.createElement('button');
      confirmBtn.type = 'button';
      confirmBtn.style.cssText = 'flex:1;padding:8px;border-radius:8px;font-size:0.82rem;font-weight:700;cursor:pointer;border:none;background:var(--gold);color:#111827';
      confirmBtn.innerHTML = '<i class="fas fa-check" style="margin-right:5px"></i>Add accord';
      confirmBtn.addEventListener('click', () => {
        const textColor = _autoText(pickerColor);
        _selected = [..._selected, { label: val, color: pickerColor, textColor }];
        customInput.value = '';
        _render();
      });

      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.style.cssText = 'padding:8px 14px;border-radius:8px;font-size:0.82rem;font-weight:700;cursor:pointer;border:1px solid var(--border);background:none;color:var(--muted)';
      cancelBtn.textContent = 'Cancel';
      cancelBtn.addEventListener('click', () => panel.remove());

      btns.appendChild(confirmBtn);
      btns.appendChild(cancelBtn);
      panel.appendChild(btns);

      customRow.after(panel);
    };

    const doAddCustom = () => {
      const val = customInput.value.trim().toLowerCase();
      if (!val) return;
      if (_selected.some(e => _getLabel(e) === val)) { customInput.value = ''; return; }
      if (_selected.length >= _MAX) {
        customInput.style.borderColor = 'var(--rose)';
        setTimeout(() => { customInput.style.borderColor = ''; }, 1200);
        return;
      }
      // If it's already in the predefined palette, add directly (color known)
      if (_ACCORD_PALETTE.some(a => a.label === val)) {
        _selected = [..._selected, val];
        customInput.value = '';
        _render();
        return;
      }
      // Custom accord — ask for color
      showColorPicker(val);
    };

    customAddBtn.addEventListener('click', doAddCustom);
    customInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); doAddCustom(); } });

    customRow.appendChild(customInput);
    customRow.appendChild(customAddBtn);
    containerEl.appendChild(customRow);
  };

  // Returns mixed: string for predefined, {label,color,textColor} for custom
  containerEl._getAccords = () => _selected.map(e => {
    if (typeof e === 'object') return { label: e.label, color: e.color, textColor: e.textColor };
    return e;
  });

  containerEl._setAccords = (arr) => {
    _selected = (arr || []).map(e => {
      if (typeof e === 'object' && e?.label) {
        const label = String(e.label).trim().toLowerCase();
        if (_ACCORD_PALETTE.some(a => a.label === label)) return label;
        return { label, color: e.color || '#b59374', textColor: e.textColor || '#fff' };
      }
      return String(e).trim().toLowerCase();
    }).filter(e => _getLabel(e));
    _render();
  };
  _render();
};

const _apToSlug = (name) => String(name).trim().toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// ─── Fragrance profile label helpers ─────────────────────────────────────────
const _fpLongevityLabel = v => {
  v = +v;
  if (v <= 20) return '1-2h';
  if (v <= 35) return '2-4h';
  if (v <= 50) return '4-6h';
  if (v <= 65) return '6-8h';
  if (v <= 73) return '7-9h';
  if (v <= 83) return '8-10h';
  if (v <= 89) return '9-11h';
  if (v <= 95) return '10-12h';
  return '12h+';
};
const _fpSillageLabel = v => {
  v = +v;
  if (v <= 35) return 'Light';
  if (v <= 55) return 'Moderate';
  if (v <= 68) return 'Moderate-Strong';
  if (v <= 83) return 'Strong';
  return 'Very Strong';
};
const _fpSeasonLabel = v => {
  v = +v;
  if (v <= 30) return 'Winter';
  if (v <= 58) return 'Fall/Winter';
  if (v <= 75) return 'All Year';
  if (v <= 88) return 'Spring/Summer';
  return 'All Year';
};

// Upload a single File to Cloudinary; calls progressCb(0–100)
const _apUploadToCloudinary = (file, progressCb) => new Promise((resolve, reject) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_PRESET);
  const xhr = new XMLHttpRequest();
  xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`);
  if (progressCb) {
    xhr.upload.addEventListener('progress', (ev) => {
      if (ev.lengthComputable) progressCb(Math.round((ev.loaded / ev.total) * 100));
    });
  }
  xhr.addEventListener('load', () => {
    let parsed; try { parsed = JSON.parse(xhr.responseText); } catch(_) { parsed = {}; }
    if (xhr.status >= 200 && xhr.status < 300 && parsed.secure_url) resolve(parsed.secure_url);
    else reject(new Error(parsed.error?.message || 'Upload failed: ' + xhr.status));
  });
  xhr.addEventListener('error', () => reject(new Error('Network error during upload.')));
  xhr.send(formData);
});

// Thumbnail image gallery widget — items: { type:'url'|'file', src, file? }
// First item = MAIN (gold border). Returns controller object.
const _apCreateImageGallery = (wrapEl) => {
  let items = [];

  const render = () => {
    wrapEl.innerHTML = '';
    items.forEach((item, i) => {
      const isMain = (i === 0);
      const size = isMain ? 116 : 76;
      const radius = isMain ? 12 : 10;
      const thumb = document.createElement('div');
      thumb.style.cssText = `position:relative;width:${size}px;height:${size}px;flex-shrink:0`;
      const imgSrc = item.type === 'url' ? esc(item.src) : item.src;
      thumb.innerHTML = `
        <img src="${imgSrc}" alt="" style="width:${size}px;height:${size}px;object-fit:contain;border-radius:${radius}px;border:${isMain ? '2px solid var(--gold)' : '1px solid var(--border)'};background:var(--s3);display:block">
        ${isMain ? '<span style="position:absolute;bottom:0;left:0;right:0;text-align:center;font-size:8px;font-weight:800;color:#fff;background:var(--gold);border-radius:0 0 10px 10px;padding:3px 0;letter-spacing:0.06em">MAIN</span>' : ''}
        ${item.type === 'file' ? '<span style="position:absolute;top:4px;left:4px;font-size:7px;font-weight:800;color:#fff;background:rgba(0,0,0,0.55);padding:1px 4px;border-radius:3px;line-height:1.4">NEW</span>' : ''}
        <button type="button" title="Remove" style="position:absolute;top:-8px;right:-8px;width:20px;height:20px;border-radius:50%;background:var(--rose);color:#fff;border:none;cursor:pointer;font-size:12px;font-weight:900;display:flex;align-items:center;justify-content:center;line-height:1">×</button>`;
      thumb.querySelector('button').addEventListener('click', () => {
        if (item.type === 'file') URL.revokeObjectURL(item.src);
        items.splice(i, 1);
        render();
      });
      wrapEl.appendChild(thumb);
    });

    const addLabel = document.createElement('label');
    addLabel.style.cssText = 'width:76px;height:76px;flex-shrink:0;border:2px dashed var(--border);border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;color:var(--muted);gap:4px;background:var(--s3);box-sizing:border-box;align-self:center';
    addLabel.innerHTML = `
      <i class="fas fa-plus" style="font-size:1rem"></i>
      <span style="font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em">${items.length === 0 ? 'Add Image' : 'Add More'}</span>
      <input type="file" accept="image/jpeg,image/png,image/webp,image/jpg" multiple style="display:none">`;
    addLabel.querySelector('input').addEventListener('change', (e) => {
      Array.from(e.target.files).forEach(file => {
        if (file.size > 5 * 1024 * 1024) { toast('Image must be smaller than 5MB.', 'error'); return; }
        items.push({ type: 'file', src: URL.createObjectURL(file), file });
      });
      e.target.value = '';
      render();
    });
    wrapEl.appendChild(addLabel);
  };

  render();

  return {
    hasImages: () => items.length > 0,
    reset: () => {
      items.forEach(it => { if (it.type === 'file') URL.revokeObjectURL(it.src); });
      items = [];
      render();
    },
    setUrls: (urls) => {
      items.forEach(it => { if (it.type === 'file') URL.revokeObjectURL(it.src); });
      items = urls.filter(Boolean).map(src => ({ type: 'url', src }));
      render();
    },
    getFinalUrls: async (labelEl, barEl) => {
      const urls = [];
      const fileItems = items.filter(it => it.type === 'file');
      let done = 0;
      for (const item of items) {
        if (item.type === 'url') {
          urls.push(item.src);
        } else {
          if (labelEl) labelEl.textContent = `Uploading image ${done + 1} of ${fileItems.length}\u2026`;
          if (barEl) barEl.style.width = Math.round(10 + (done / Math.max(fileItems.length, 1)) * 75) + '%';
          const url = await _apUploadToCloudinary(item.file);
          urls.push(url);
          done++;
        }
      }
      return urls;
    },
  };
};

const _apAddSizeRow = (container, sizeVal = '', priceVal = '', origPriceVal = '') => {
  const row = document.createElement('div');
  row.className = 'prod-size-row';
  const initHasSale = origPriceVal && parseFloat(origPriceVal) > parseFloat(priceVal || 0);
  row.style.cssText = 'background:var(--s3);border:1px solid var(--border);border-radius:12px;padding:14px 14px 12px;position:relative;transition:border-color 0.2s,box-shadow 0.2s';
  row.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:10px;align-items:end">
      <div>
        <label style="font-size:0.67rem;font-weight:700;color:var(--muted);display:block;margin-bottom:5px;text-transform:uppercase;letter-spacing:0.05em">Size</label>
        <input type="text" placeholder="e.g. 50ml" class="prod-size-key" value="${esc(sizeVal)}"
          style="width:100%;background:var(--s2);border:1px solid var(--border);border-radius:8px;padding:9px 11px;font-size:0.85rem;font-weight:600;color:var(--text);outline:none;box-sizing:border-box;transition:border-color 0.15s">
      </div>
      <div>
        <label style="font-size:0.67rem;font-weight:700;color:var(--muted);display:flex;align-items:center;gap:4px;margin-bottom:5px;text-transform:uppercase;letter-spacing:0.05em">
          <i class="fas fa-tag" style="font-size:9px"></i> Price
        </label>
        <div style="position:relative">
          <input type="number" placeholder="0" class="prod-size-price" min="0" value="${esc(priceVal)}"
            style="width:100%;background:var(--s2);border:1px solid var(--border);border-radius:8px;padding:9px 38px 9px 11px;font-size:0.9rem;font-weight:700;color:var(--text);outline:none;box-sizing:border-box;transition:border-color 0.15s">
          <span style="position:absolute;right:9px;top:50%;transform:translateY(-50%);font-size:0.65rem;font-weight:800;color:var(--muted)">MAD</span>
        </div>
      </div>
      <div>
        <label style="font-size:0.67rem;font-weight:700;color:rgba(200,169,106,0.9);display:flex;align-items:center;gap:4px;margin-bottom:5px;text-transform:uppercase;letter-spacing:0.05em">
          <i class="fas fa-scissors" style="font-size:9px"></i> Before Sale
        </label>
        <div style="position:relative">
          <input type="number" placeholder="Optional" class="prod-size-orig-price" min="0" value="${esc(origPriceVal)}"
            title="Fill this if the product is on sale — enter the original (higher) price"
            style="width:100%;background:var(--s2);border:1px dashed rgba(200,169,106,0.45);border-radius:8px;padding:9px 38px 9px 11px;font-size:0.9rem;font-weight:600;color:var(--text);outline:none;box-sizing:border-box;transition:border-color 0.15s">
          <span style="position:absolute;right:9px;top:50%;transform:translateY(-50%);font-size:0.65rem;font-weight:800;color:var(--gold)">MAD</span>
        </div>
      </div>
      <button type="button" class="prod-remove-size-row"
        style="width:34px;height:34px;border-radius:8px;background:rgba(239,68,68,0.07);border:1px solid rgba(239,68,68,0.18);color:var(--rose);cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0" title="Remove this size">
        <i class="fas fa-trash-can" style="font-size:11px"></i>
      </button>
    </div>
    <div class="prod-size-sale-preview" style="display:${initHasSale ? 'flex' : 'none'};align-items:center;gap:8px;margin-top:10px;padding:7px 11px;background:rgba(21,128,61,0.09);border-radius:8px;border:1px solid rgba(21,128,61,0.2)">
      <i class="fas fa-circle-check" style="font-size:12px;color:#16a34a;flex-shrink:0"></i>
      <span class="prod-sale-preview-text" style="font-size:0.76rem;font-weight:700;color:#15803d"></span>
    </div>`;

  const priceInput    = row.querySelector('.prod-size-price');
  const origInput     = row.querySelector('.prod-size-orig-price');
  const salePreview   = row.querySelector('.prod-size-sale-preview');
  const saleText      = row.querySelector('.prod-sale-preview-text');

  const updateSalePreview = () => {
    const p = parseFloat(priceInput.value);
    const o = parseFloat(origInput.value);
    if (p > 0 && o > p) {
      const pct = Math.round((1 - p / o) * 100);
      saleText.textContent = `Sale active — ${pct}% off · Customers will see ${o} MAD crossed out, paying ${p} MAD`;
      salePreview.style.display = 'flex';
      row.style.borderColor = 'rgba(21,128,61,0.35)';
      origInput.style.borderColor = 'rgba(21,128,61,0.5)';
      origInput.style.borderStyle = 'solid';
    } else {
      salePreview.style.display = 'none';
      row.style.borderColor = '';
      origInput.style.borderColor = 'rgba(200,169,106,0.45)';
      origInput.style.borderStyle = 'dashed';
    }
  };

  priceInput.addEventListener('input', updateSalePreview);
  origInput.addEventListener('input', updateSalePreview);
  if (initHasSale) { saleText.textContent = `Sale active`; updateSalePreview(); }

  row.querySelector('.prod-remove-size-row').addEventListener('click', () => row.remove());
  container.appendChild(row);
};

const initAddProductModal = () => {
  if (document.getElementById('addProductModal')) return;
  const modal = document.createElement('div');
  modal.id = 'addProductModal';
  modal.style.cssText = 'display:none;position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.72);overflow-y:auto;padding:12px;backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px)';
  modal.innerHTML = `
    <div style="max-width:520px;width:100%;margin:20px auto 40px;background:var(--s2);border-radius:16px;border:1px solid var(--border);overflow:hidden;box-shadow:0 24px 64px rgba(0,0,0,0.5)">
      <div style="padding:20px 24px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:flex-start">
        <div>
          <div style="font-size:1rem;font-weight:700;color:var(--text)"><i class="fas fa-plus-circle" style="color:var(--gold);margin-right:8px"></i>Add New Product</div>
          <div style="font-size:0.72rem;color:var(--muted);margin-top:3px">Product will appear live in the New Arrivals section immediately after saving.</div>
        </div>
        <button id="closeAddProductModal" type="button" style="background:none;border:none;color:var(--muted);font-size:1.25rem;cursor:pointer;line-height:1;padding:2px 6px"><i class="fas fa-xmark"></i></button>
      </div>
      <form id="addProductForm" style="padding:16px;display:flex;flex-direction:column;gap:14px">
        <div>
          <label style="font-size:0.75rem;font-weight:600;color:var(--muted);display:block;margin-bottom:8px">
            Product Images <span style="color:var(--rose)">*</span>
            <span style="font-weight:400;font-size:0.7rem"> — first image is the main photo</span>
          </label>
          <div id="addProductImagesGallery" style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-start;padding:2px 0"></div>
        </div>
        <div>
          <label style="font-size:0.75rem;font-weight:600;color:var(--muted);display:block;margin-bottom:6px">Product Name <span style="color:var(--rose)">*</span></label>
          <input type="text" id="addProductName" placeholder="e.g. Dior Sauvage Elixir"
            style="width:100%;background:var(--s3);border:1px solid var(--border);border-radius:8px;padding:10px 12px;font-size:0.85rem;color:var(--text);outline:none;box-sizing:border-box">
        </div>
        <div>
          <label style="font-size:0.75rem;font-weight:600;color:var(--muted);display:block;margin-bottom:6px">Brand <span style="color:var(--rose)">*</span></label>
          <input type="text" id="addProductBrand" placeholder="e.g. DIOR"
            style="width:100%;background:var(--s3);border:1px solid var(--border);border-radius:8px;padding:10px 12px;font-size:0.85rem;color:var(--text);outline:none;box-sizing:border-box">
        </div>
        <div>
          <label style="font-size:0.75rem;font-weight:600;color:var(--muted);display:block;margin-bottom:6px">Description <span style="font-weight:400;font-size:0.7rem;color:var(--muted)">— shown on product page</span></label>
          <textarea id="addProductDescription" rows="4" placeholder="e.g. A bold and seductive fragrance that opens with bergamot and cloves..."
            style="width:100%;background:var(--s3);border:1px solid var(--border);border-radius:8px;padding:10px 12px;font-size:0.85rem;color:var(--text);outline:none;box-sizing:border-box;resize:vertical;font-family:inherit;line-height:1.6"></textarea>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div>
            <label style="font-size:0.75rem;font-weight:600;color:var(--muted);display:block;margin-bottom:6px">Gender <span style="color:var(--rose)">*</span></label>
            <select id="addProductGender" style="width:100%;background:var(--s3);border:1px solid var(--border);border-radius:8px;padding:10px 12px;font-size:0.85rem;color:var(--text);outline:none;box-sizing:border-box">
              <option value="for-men">For Men</option>
              <option value="for-women">For Women</option>
              <option value="unisex">Unisex</option>
            </select>
          </div>
          <div>
            <label style="font-size:0.75rem;font-weight:600;color:var(--muted);display:block;margin-bottom:6px">Category <span style="color:var(--rose)">*</span></label>
            <select id="addProductCategory" style="width:100%;background:var(--s3);border:1px solid var(--border);border-radius:8px;padding:10px 12px;font-size:0.85rem;color:var(--text);outline:none;box-sizing:border-box">
              <option value="designer">Designer</option>
              <option value="niche">Niche</option>
              <option value="arabian">Arabian</option>
            </select>
          </div>
        </div>
        <div>
          <div style="margin-bottom:8px">
            <div style="font-size:0.78rem;font-weight:700;color:var(--text);margin-bottom:3px">Sizes &amp; Prices <span style="color:var(--rose)">*</span></div>
            <div style="font-size:0.7rem;color:var(--muted);line-height:1.5">Set a price per size. Want to run a <strong style="color:var(--gold)">sale</strong>? Fill in the &ldquo;Before Sale&rdquo; field too — the site shows the old price crossed out automatically.</div>
          </div>
          <div id="addProductSizesContainer" style="display:flex;flex-direction:column;gap:8px"></div>
          <button type="button" id="addProductAddSizeBtn"
            style="margin-top:10px;background:none;border:1px dashed var(--border);border-radius:10px;padding:9px 14px;font-size:0.75rem;color:var(--muted);cursor:pointer;width:100%;transition:border-color 0.2s,color 0.2s;display:flex;align-items:center;justify-content:center;gap:7px">
            <i class="fas fa-plus" style="font-size:10px"></i> Add Another Size
          </button>
        </div>

        <!-- Fragrance Profile -->
        <div>
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
            <div style="width:24px;height:24px;border-radius:50%;background:var(--gold);color:#fff;display:flex;align-items:center;justify-content:center;font-size:0.72rem;font-weight:800;flex-shrink:0"><i class="fas fa-chart-simple" style="font-size:0.65rem"></i></div>
            <div style="font-size:0.88rem;font-weight:700;color:var(--text)">Fragrance Profile <span style="font-weight:400;color:var(--muted);font-size:0.78rem">— optional</span></div>
          </div>
          <div style="display:flex;flex-direction:column;gap:14px">
            <div>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                <label style="font-size:0.72rem;font-weight:600;color:var(--muted);display:flex;align-items:center;gap:5px"><i class="fas fa-clock" style="color:#c8102e"></i> Longevity</label>
                <span id="addFpLongevityLabel" style="font-size:0.72rem;font-weight:700;color:var(--text);background:var(--s4);padding:2px 8px;border-radius:20px">8-10h</span>
              </div>
              <input type="range" id="addFpLongevity" min="0" max="100" step="1" value="80" style="width:100%;accent-color:var(--gold);cursor:pointer;height:4px">
            </div>
            <div>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                <label style="font-size:0.72rem;font-weight:600;color:var(--muted);display:flex;align-items:center;gap:5px"><i class="fas fa-wind" style="color:#c8102e"></i> Sillage</label>
                <span id="addFpSillageLabel" style="font-size:0.72rem;font-weight:700;color:var(--text);background:var(--s4);padding:2px 8px;border-radius:20px">Strong</span>
              </div>
              <input type="range" id="addFpSillage" min="0" max="100" step="1" value="75" style="width:100%;accent-color:var(--gold);cursor:pointer;height:4px">
            </div>
            <div>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                <label style="font-size:0.72rem;font-weight:600;color:var(--muted);display:flex;align-items:center;gap:5px"><i class="fas fa-sun" style="color:#c8102e"></i> Season</label>
                <span id="addFpSeasonLabel" style="font-size:0.72rem;font-weight:700;color:var(--text);background:var(--s4);padding:2px 8px;border-radius:20px">All Year</span>
              </div>
              <input type="range" id="addFpSeason" min="0" max="100" step="1" value="75" style="width:100%;accent-color:var(--gold);cursor:pointer;height:4px">
            </div>
          </div>
        </div>

        <!-- Stock & Badge -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div>
            <label style="font-size:0.75rem;font-weight:600;color:var(--muted);display:block;margin-bottom:6px">
              Stock Left <span style="font-weight:400;font-size:0.7rem">— shows "Only X left!" when low</span>
            </label>
            <input type="number" id="addProductStockLeft" min="0" max="9999" placeholder="e.g. 12 (empty = unlimited)"
              style="width:100%;background:var(--s3);border:1px solid var(--border);border-radius:8px;padding:10px 12px;font-size:0.85rem;color:var(--text);outline:none;box-sizing:border-box">
          </div>
          <div>
            <label style="font-size:0.75rem;font-weight:600;color:var(--muted);display:block;margin-bottom:6px">
              Product Badge <span style="font-weight:400;font-size:0.7rem">— shown on card &amp; product page</span>
            </label>
            <div id="addBadgePresets" style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:8px">
              <button type="button" data-badge-preset="NEW" style="padding:3px 9px;border-radius:20px;font-size:10px;font-weight:800;cursor:pointer;border:1px solid #111;background:#111;color:#fff">NEW</button>
              <button type="button" data-badge-preset="LIMITED" style="padding:3px 9px;border-radius:20px;font-size:10px;font-weight:800;cursor:pointer;border:1px solid #b8860b;background:#b8860b;color:#fff">LIMITED</button>
              <button type="button" data-badge-preset="BESTSELLER" style="padding:3px 9px;border-radius:20px;font-size:10px;font-weight:800;cursor:pointer;border:1px solid #1d4ed8;background:#1d4ed8;color:#fff">BESTSELLER</button>
              <button type="button" data-badge-preset="HOT" style="padding:3px 9px;border-radius:20px;font-size:10px;font-weight:800;cursor:pointer;border:1px solid #dc2626;background:#dc2626;color:#fff">HOT</button>
              <button type="button" data-badge-preset="SALE" style="padding:3px 9px;border-radius:20px;font-size:10px;font-weight:800;cursor:pointer;border:1px solid #15803d;background:#15803d;color:#fff">SALE</button>
              <button type="button" data-badge-preset="EXCLUSIVE" style="padding:3px 9px;border-radius:20px;font-size:10px;font-weight:800;cursor:pointer;border:1px solid #7e22ce;background:#7e22ce;color:#fff">EXCLUSIVE</button>
              <button type="button" data-badge-preset="" style="padding:3px 9px;border-radius:20px;font-size:10px;font-weight:700;cursor:pointer;border:1px solid var(--border);background:var(--s4);color:var(--muted)">None</button>
            </div>
            <input type="text" id="addProductBadge" maxlength="20" placeholder="Custom or leave empty"
              style="width:100%;background:var(--s3);border:1px solid var(--border);border-radius:8px;padding:10px 12px;font-size:0.85rem;color:var(--text);outline:none;box-sizing:border-box">
          </div>
        </div>

        <!-- Optional Details -->
        <details style="border:1px solid var(--border);border-radius:8px;overflow:hidden">
          <summary style="padding:10px 14px;cursor:pointer;font-size:0.78rem;font-weight:600;color:var(--muted);list-style:none;display:flex;align-items:center;gap:8px;background:var(--s3)">
            <i class="fas fa-leaf" style="color:var(--gold)"></i> Optional Details — Accords, Notes &amp; Ingredients
          </summary>
          <div style="padding:12px 14px;display:flex;flex-direction:column;gap:10px;background:var(--s3)">
            <div>
              <label style="font-size:0.72rem;font-weight:600;color:var(--muted);display:block;margin-bottom:6px">Main Accords <span style="font-weight:400">— click to select (up to 8)</span></label>
              <div id="addProductAccordsPicker" style="background:var(--s2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;box-sizing:border-box"></div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
              <div>
                <label style="font-size:0.72rem;font-weight:600;color:var(--muted);display:block;margin-bottom:4px">Top Notes</label>
                <input type="text" id="addProductNotesTop" placeholder="e.g. Bergamot, pepper"
                  style="width:100%;background:var(--s2);border:1px solid var(--border);border-radius:8px;padding:8px 10px;font-size:0.82rem;color:var(--text);outline:none;box-sizing:border-box">
              </div>
              <div>
                <label style="font-size:0.72rem;font-weight:600;color:var(--muted);display:block;margin-bottom:4px">Heart Notes</label>
                <input type="text" id="addProductNotesHeart" placeholder="e.g. Jasmine, rose"
                  style="width:100%;background:var(--s2);border:1px solid var(--border);border-radius:8px;padding:8px 10px;font-size:0.82rem;color:var(--text);outline:none;box-sizing:border-box">
              </div>
              <div>
                <label style="font-size:0.72rem;font-weight:600;color:var(--muted);display:block;margin-bottom:4px">Base Notes</label>
                <input type="text" id="addProductNotesBase" placeholder="e.g. Sandalwood, musk"
                  style="width:100%;background:var(--s2);border:1px solid var(--border);border-radius:8px;padding:8px 10px;font-size:0.82rem;color:var(--text);outline:none;box-sizing:border-box">
              </div>
            </div>
            <div>
              <label style="font-size:0.72rem;font-weight:600;color:var(--muted);display:block;margin-bottom:4px">Ingredients (INCI) <span style="font-weight:400">— comma-separated</span></label>
              <textarea id="addProductIngredients" rows="3" placeholder="e.g. Alcohol Denat., Parfum, Aqua, Limonene, Linalool"
                style="width:100%;background:var(--s2);border:1px solid var(--border);border-radius:8px;padding:8px 10px;font-size:0.82rem;color:var(--text);outline:none;box-sizing:border-box;resize:vertical;font-family:inherit"></textarea>
            </div>
          </div>
        </details>

        <div id="addProductProgress" style="display:none">
          <div style="font-size:0.75rem;color:var(--muted);margin-bottom:6px" id="addProductProgressLabel">Uploading image...</div>
          <div style="height:6px;background:var(--border);border-radius:3px;overflow:hidden">
            <div id="addProductProgressBar" style="height:100%;width:0%;background:var(--gold);transition:width 0.25s;border-radius:3px"></div>
          </div>
        </div>
        <div id="addProductError" style="display:none;color:var(--rose);font-size:0.78rem;padding:8px 12px;background:rgba(239,68,68,0.08);border-radius:6px;border:1px solid rgba(239,68,68,0.2)"></div>
        <div style="display:flex;gap:10px;padding-top:4px">
          <button type="button" id="cancelAddProductBtn" class="btn btn-sm" style="flex:1">Cancel</button>
          <button type="submit" id="saveAddProductBtn" class="btn btn-sm btn-gold" style="flex:2"><i class="fas fa-floppy-disk"></i> Save Product</button>
        </div>
      </form>
    </div>`;
  document.body.appendChild(modal);

  const closeModal = () => { modal.style.display = 'none'; };
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  document.getElementById('closeAddProductModal').addEventListener('click', closeModal);
  document.getElementById('cancelAddProductBtn').addEventListener('click', closeModal);

  // Image gallery
  const gallery = _apCreateImageGallery(document.getElementById('addProductImagesGallery'));
  modal._gallery = gallery;

  // Accord picker
  const _addAccordPicker = document.getElementById('addProductAccordsPicker');
  _apInitAccordPicker(_addAccordPicker, []);

  // Fragrance profile sliders for Add modal
  const _addFpSliders = [
    { id: 'addFpLongevity', labelId: 'addFpLongevityLabel', fn: _fpLongevityLabel },
    { id: 'addFpSillage',   labelId: 'addFpSillageLabel',   fn: _fpSillageLabel   },
    { id: 'addFpSeason',    labelId: 'addFpSeasonLabel',    fn: _fpSeasonLabel    },
  ];
  _addFpSliders.forEach(({ id, labelId, fn }) => {
    const sl = document.getElementById(id);
    const lb = document.getElementById(labelId);
    if (!sl || !lb) return;
    sl.addEventListener('input', () => { lb.textContent = fn(sl.value); });
    lb.textContent = fn(sl.value);
  });

  // Badge preset picker for Add modal
  const _addBadgeInput   = document.getElementById('addProductBadge');
  const _addBadgePresets = document.getElementById('addBadgePresets');
  const _syncAddBadgeBtns = () => {
    const cur = _addBadgeInput.value.trim();
    _addBadgePresets.querySelectorAll('[data-badge-preset]').forEach(btn => {
      const active = btn.dataset.badgePreset === cur;
      btn.style.outline = active ? '2px solid var(--gold)' : 'none';
      btn.style.outlineOffset = active ? '2px' : '0';
    });
  };
  _addBadgePresets.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-badge-preset]');
    if (!btn) return;
    _addBadgeInput.value = btn.dataset.badgePreset;
    _syncAddBadgeBtns();
  });
  _addBadgeInput.addEventListener('input', _syncAddBadgeBtns);

  // Size rows
  const sizesContainer = document.getElementById('addProductSizesContainer');
  document.getElementById('addProductAddSizeBtn').addEventListener('click', () => {
    _apAddSizeRow(sizesContainer);
  });

  // Form submit
  document.getElementById('addProductForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl        = document.getElementById('addProductError');
    const progressEl   = document.getElementById('addProductProgress');
    const progressBar  = document.getElementById('addProductProgressBar');
    const progressLabel = document.getElementById('addProductProgressLabel');
    const saveBtn      = document.getElementById('saveAddProductBtn');
    errEl.style.display = 'none';

    const name      = (document.getElementById('addProductName').value || '').trim();
    const brand     = (document.getElementById('addProductBrand').value || '').trim();
    const gender    = (document.getElementById('addProductGender').value || 'for-men').trim();
    const category  = (document.getElementById('addProductCategory').value || 'designer').trim();
    const description = (document.getElementById('addProductDescription').value || '').trim();
    const accordsRaw  = document.getElementById('addProductAccordsPicker')._getAccords();
    const notesTop    = (document.getElementById('addProductNotesTop').value || '').trim();
    const notesHeart  = (document.getElementById('addProductNotesHeart').value || '').trim();
    const notesBase   = (document.getElementById('addProductNotesBase').value || '').trim();
    const ingredients = (document.getElementById('addProductIngredients').value || '').trim();
    const addStockRaw = parseInt(document.getElementById('addProductStockLeft').value, 10);
    const addStockLeft = Number.isFinite(addStockRaw) && addStockRaw >= 0 ? addStockRaw : null;
    const addBadge    = (document.getElementById('addProductBadge').value || '').trim() || null;
    const _aFpLon = parseInt(document.getElementById('addFpLongevity').value, 10);
    const _aFpSil = parseInt(document.getElementById('addFpSillage').value, 10);
    const _aFpSea = parseInt(document.getElementById('addFpSeason').value, 10);
    const addFragranceProfile = { longevity: _aFpLon, longevityLabel: _fpLongevityLabel(_aFpLon), sillage: _aFpSil, sillageLabel: _fpSillageLabel(_aFpSil), season: _aFpSea, seasonLabel: _fpSeasonLabel(_aFpSea) };
    if (!name)                { errEl.textContent = 'Product name is required.'; errEl.style.display = 'block'; return; }
    if (!brand)               { errEl.textContent = 'Brand name is required.'; errEl.style.display = 'block'; return; }
    if (!gallery.hasImages()) { errEl.textContent = 'Please add at least one product image.'; errEl.style.display = 'block'; return; }

    const sizes = {};
    const originalPrices = {};
    let sizeError = false;
    document.querySelectorAll('#addProductSizesContainer .prod-size-row').forEach(row => {
      const sizeKey   = (row.querySelector('.prod-size-key').value || '').trim().toLowerCase();
      const priceRaw  = (row.querySelector('.prod-size-price').value || '').trim();
      const sizePrice = priceRaw === '' ? 0 : parseFloat(priceRaw);
      const origRaw   = parseFloat(row.querySelector('.prod-size-orig-price')?.value);
      if (!sizeKey && priceRaw === '') return; // completely blank row — skip silently
      if (sizeKey && sizePrice > 0) {
        sizes[sizeKey] = sizePrice;
        if (Number.isFinite(origRaw) && origRaw > sizePrice) originalPrices[sizeKey] = origRaw;
      } else if (sizeKey && sizePrice === 0) {
        sizes[sizeKey] = 0; // price 0 — size saved but hidden on site; all-zero = product out of stock
      } else {
        sizeError = true; // price filled but no size name
      }
    });
    if (Object.keys(sizes).length === 0) {
      errEl.textContent = 'Add at least one size name.'; errEl.style.display = 'block'; return;
    }
    if (sizeError) {
      errEl.textContent = 'Some size rows are missing a size name.';
      errEl.style.display = 'block'; return;
    }

    const slug = _apToSlug(name);
    if (!slug) { errEl.textContent = 'Product name is invalid.'; errEl.style.display = 'block'; return; }

    try {
      const existing = await getDoc(doc(db, 'products', slug));
      if (existing.exists()) {
        errEl.textContent = `A product named "${name}" already exists. Use a different name.`;
        errEl.style.display = 'block'; return;
      }
    } catch (_) {}

    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Saving...';
    progressEl.style.display = 'block';
    progressBar.style.width = '5%';

    try {
      const allImages = await gallery.getFinalUrls(progressLabel, progressBar);
      if (!allImages.length) throw new Error('No image URLs returned. Check your Cloudinary preset.');
      const downloadURL = allImages[0];

      progressLabel.textContent = 'Saving product data...';
      progressBar.style.width = '92%';
      await setDoc(doc(db, 'products', slug), {
        name, brand: brand.toUpperCase(), slug,
        image: downloadURL, images: allImages, sizes, active: true,
        filters: ['new-in', gender, category],
        ...(description ? { description } : {}),
        ...(accordsRaw.length ? { accords: accordsRaw } : {}),
        ...(notesTop || notesHeart || notesBase ? { notes: { top: notesTop, heart: notesHeart, base: notesBase } } : {}),
        ...(ingredients ? { ingredients } : {}),
        ...(addStockLeft !== null ? { stockLeft: addStockLeft } : {}),
        ...(addBadge ? { badge: addBadge } : {}),
        ...(Object.keys(originalPrices).length ? { originalPrices } : {}),
        fragranceProfile: addFragranceProfile,
        addedAt: serverTimestamp(), source: 'admin',
      });
      progressBar.style.width = '100%';
      progressLabel.textContent = 'Product saved!';
      setTimeout(() => {
        closeModal();
        toast(`"${name}" is now live on the site.`, 'success', 5000);
        loadProductsView();
      }, 600);
    } catch (err) {
      progressEl.style.display = 'none';
      errEl.textContent = 'Failed: ' + err.message;
      errEl.style.display = 'block';
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<i class="fas fa-floppy-disk"></i> Save Product';
    }
  });
};

const openAddProductModal = () => {
  initAddProductModal();
  document.getElementById('addProductForm').reset();
  document.getElementById('addProductError').style.display = 'none';
  document.getElementById('addProductProgress').style.display = 'none';
  document.getElementById('addProductProgressBar').style.width = '0%';
  document.getElementById('saveAddProductBtn').disabled = false;
  document.getElementById('saveAddProductBtn').innerHTML = '<i class="fas fa-floppy-disk"></i> Save Product';
  const modal = document.getElementById('addProductModal');
  if (modal._gallery) modal._gallery.reset();
  // Reset accord picker
  const _addPicker = document.getElementById('addProductAccordsPicker');
  if (_addPicker && _addPicker._setAccords) _addPicker._setAccords([]);
  const sizesContainer = document.getElementById('addProductSizesContainer');
  sizesContainer.innerHTML = '';
  _apAddSizeRow(sizesContainer, '50ml', '');
  _apAddSizeRow(sizesContainer, '100ml', '');
  modal.style.display = 'block';
};

const initEditProductModal = () => {
  // Always destroy and recreate so HTML/JS changes take effect without hard reload
  const old = document.getElementById('editProductModal');
  if (old) old.remove();
  const modal = document.createElement('div');
  modal.id = 'editProductModal';
  modal.style.cssText = 'display:none;position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.72);overflow-y:auto;padding:16px;backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px)';
  modal.innerHTML = `
    <div style="max-width:780px;width:100%;margin:20px auto 40px;background:var(--s2);border-radius:16px;border:1px solid var(--border);overflow:hidden;box-shadow:0 24px 64px rgba(0,0,0,0.5)">

      <!-- Header -->
      <div style="padding:18px 24px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
        <div style="display:flex;align-items:center;gap:12px">
          <div style="width:38px;height:38px;border-radius:50%;background:rgba(200,169,106,0.12);border:1px solid rgba(200,169,106,0.3);display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <i class="fas fa-pen" style="color:var(--gold);font-size:0.9rem"></i>
          </div>
          <div>
            <div style="font-size:1.02rem;font-weight:700;color:var(--text)">Edit Product</div>
            <div style="font-size:0.72rem;color:var(--muted);margin-top:1px">Update your product information and images</div>
          </div>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <button type="button" id="cancelEditProductBtn" class="btn btn-sm" style="display:flex;align-items:center;gap:6px">
            <i class="fas fa-xmark"></i> Cancel
          </button>
          <button type="button" id="saveEditProductBtn" class="btn btn-sm btn-gold" style="display:flex;align-items:center;gap:6px">
            <i class="fas fa-floppy-disk"></i> Save Changes
          </button>
        </div>
      </div>

      <!-- Form body -->
      <form id="editProductForm" style="padding:28px;display:flex;flex-direction:column;gap:32px">
        <input type="hidden" id="editProductSlug">

        <!-- Section 1: Main Image -->
        <div>
          <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:16px">
            <div style="width:28px;height:28px;border-radius:50%;background:var(--gold);color:#fff;display:flex;align-items:center;justify-content:center;font-size:0.78rem;font-weight:800;flex-shrink:0;margin-top:1px">1</div>
            <div>
              <div style="font-size:0.95rem;font-weight:700;color:var(--text)">Main Product Image</div>
              <div style="font-size:0.72rem;color:var(--muted);margin-top:2px">This image will be displayed as the main product image on your store.</div>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
            <div id="editMainImgBox" style="position:relative;border-radius:12px;border:1px solid var(--border);background:var(--s3);display:flex;align-items:center;justify-content:center;min-height:200px;overflow:hidden">
              <img id="editMainImgPreview" alt="" style="width:100%;height:200px;object-fit:contain;display:block">
              <div id="editMainImgEmpty" style="display:none;text-align:center;padding:30px 20px">
                <i class="fas fa-image" style="font-size:2.4rem;color:var(--muted)"></i>
                <div style="font-size:0.75rem;color:var(--muted);margin-top:8px">No main image selected</div>
              </div>
              <button type="button" id="editMainImgRemoveBtn" title="Remove image"
                style="position:absolute;top:8px;right:8px;width:28px;height:28px;border-radius:50%;background:var(--rose);color:#fff;border:none;cursor:pointer;font-size:15px;font-weight:900;display:flex;align-items:center;justify-content:center;line-height:1;box-shadow:0 2px 8px rgba(0,0,0,0.25)">×</button>
            </div>
            <label id="editMainImgDrop" style="border:2px dashed var(--border);border-radius:12px;padding:24px 20px;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;gap:8px;min-height:200px;background:var(--s3);text-align:center;box-sizing:border-box;transition:border-color 0.2s">
              <input type="file" id="editMainImgInput" accept="image/jpeg,image/png,image/webp,image/jpg" style="display:none">
              <i class="fas fa-cloud-arrow-up" style="font-size:2rem;color:var(--gold)"></i>
              <span style="font-size:0.9rem;font-weight:700;color:var(--gold)">Change Image</span>
              <span style="font-size:0.75rem;color:var(--muted)">Click to upload or drag and drop</span>
              <span style="font-size:0.7rem;color:var(--dim);background:var(--s4);padding:3px 12px;border-radius:20px">JPG, PNG, WebP (Max 5MB)</span>
            </label>
          </div>
        </div>

        <!-- Section 2: Gallery Images -->
        <div>
          <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:16px">
            <div style="width:28px;height:28px;border-radius:50%;background:var(--gold);color:#fff;display:flex;align-items:center;justify-content:center;font-size:0.78rem;font-weight:800;flex-shrink:0;margin-top:1px">2</div>
            <div style="flex:1;min-width:0">
              <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
                <div>
                  <span style="font-size:0.95rem;font-weight:700;color:var(--text)">Gallery Images</span>
                  <span style="font-size:0.82rem;color:var(--muted);margin-left:6px">(Optional)</span>
                </div>
                <span id="editGalleryCount" style="font-size:0.72rem;font-weight:600;color:var(--muted);background:var(--s4);padding:3px 12px;border-radius:20px">0 / 10 images</span>
              </div>
              <div style="font-size:0.72rem;color:var(--muted);margin-top:2px">Add multiple images to showcase your product from different angles.</div>
            </div>
          </div>
          <div id="editGalleryRow" style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-start"></div>
        </div>

        <!-- Section 3: Product Information -->
        <div>
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px">
            <div style="width:28px;height:28px;border-radius:50%;background:var(--gold);color:#fff;display:flex;align-items:center;justify-content:center;font-size:0.78rem;font-weight:800;flex-shrink:0">3</div>
            <div style="font-size:0.95rem;font-weight:700;color:var(--text)">Product Information</div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
            <div>
              <label style="font-size:0.75rem;font-weight:600;color:var(--muted);display:block;margin-bottom:6px">Product Name <span style="color:var(--rose)">*</span></label>
              <input type="text" id="editProductName" placeholder="e.g. Dior Sauvage Elixir"
                style="width:100%;background:var(--s3);border:1px solid var(--border);border-radius:8px;padding:10px 12px;font-size:0.85rem;color:var(--text);outline:none;box-sizing:border-box">
            </div>
            <div>
              <label style="font-size:0.75rem;font-weight:600;color:var(--muted);display:block;margin-bottom:6px">Gender</label>
              <select id="editProductGender" style="width:100%;background:var(--s3);border:1px solid var(--border);border-radius:8px;padding:10px 12px;font-size:0.85rem;color:var(--text);outline:none;box-sizing:border-box">
                <option value="for-men">For Men</option>
                <option value="for-women">For Women</option>
                <option value="unisex">Unisex</option>
              </select>
            </div>
            <div>
              <label style="font-size:0.75rem;font-weight:600;color:var(--muted);display:block;margin-bottom:6px">Brand <span style="color:var(--rose)">*</span></label>
              <input type="text" id="editProductBrand" placeholder="e.g. DIOR"
                style="width:100%;background:var(--s3);border:1px solid var(--border);border-radius:8px;padding:10px 12px;font-size:0.85rem;color:var(--text);outline:none;box-sizing:border-box">
            </div>
            <div style="grid-column:1/-1">
              <label style="font-size:0.75rem;font-weight:600;color:var(--muted);display:block;margin-bottom:6px">Description <span style="font-weight:400;font-size:0.7rem">— shown on product page</span></label>
              <textarea id="editProductDescription" rows="4" placeholder="e.g. A bold and seductive fragrance that opens with bergamot and cloves..."
                style="width:100%;background:var(--s3);border:1px solid var(--border);border-radius:8px;padding:10px 12px;font-size:0.85rem;color:var(--text);outline:none;box-sizing:border-box;resize:vertical;font-family:inherit;line-height:1.6"></textarea>
            </div>
            <div>
              <label style="font-size:0.75rem;font-weight:600;color:var(--muted);display:block;margin-bottom:6px">Category</label>
              <select id="editProductCategory" style="width:100%;background:var(--s3);border:1px solid var(--border);border-radius:8px;padding:10px 12px;font-size:0.85rem;color:var(--text);outline:none;box-sizing:border-box">
                <option value="designer">Designer</option>
                <option value="niche">Niche</option>
                <option value="arabian">Arabian</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Section 4: Sizes & Prices -->
        <div>
          <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:10px">
            <div style="width:28px;height:28px;border-radius:50%;background:var(--gold);color:#fff;display:flex;align-items:center;justify-content:center;font-size:0.78rem;font-weight:800;flex-shrink:0;margin-top:2px">4</div>
            <div style="flex:1">
              <div style="font-size:0.95rem;font-weight:700;color:var(--text)">Sizes &amp; Prices <span style="color:var(--rose)">*</span></div>
              <div style="font-size:0.72rem;color:var(--muted);margin-top:3px;line-height:1.5">Set the price for each size. To run a <strong style="color:var(--gold)">sale</strong>, also fill in the &ldquo;Before Sale&rdquo; field — the site will automatically show the old price crossed out with a discount %.</div>
            </div>
          </div>
          <div id="editProductSizesContainer" style="display:flex;flex-direction:column;gap:8px;margin-top:14px"></div>
          <button type="button" id="editProductAddSizeBtn"
            style="margin-top:10px;background:none;border:1px dashed var(--border);border-radius:10px;padding:10px 14px;font-size:0.78rem;color:var(--muted);cursor:pointer;width:100%;transition:border-color 0.2s,color 0.2s;display:flex;align-items:center;justify-content:center;gap:7px">
            <i class="fas fa-plus" style="font-size:10px"></i> Add Another Size
          </button>
        </div>

        <!-- Section 5: Fragrance Profile -->
        <div>
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px">
            <div style="width:28px;height:28px;border-radius:50%;background:var(--gold);color:#fff;display:flex;align-items:center;justify-content:center;font-size:0.78rem;font-weight:800;flex-shrink:0">5</div>
            <div style="font-size:0.95rem;font-weight:700;color:var(--text)">
              Fragrance Profile <span style="font-weight:400;color:var(--muted);font-size:0.82rem">— optional, shown on product page</span>
            </div>
          </div>
          <div style="display:flex;flex-direction:column;gap:16px">
            <div>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                <label style="font-size:0.75rem;font-weight:600;color:var(--muted);display:flex;align-items:center;gap:6px"><i class="fas fa-clock" style="color:var(--ipp-red,#c8102e)"></i> Longevity</label>
                <span id="editFpLongevityLabel" style="font-size:0.75rem;font-weight:700;color:var(--text);background:var(--s4);padding:2px 10px;border-radius:20px">8-10h</span>
              </div>
              <input type="range" id="editFpLongevity" min="0" max="100" step="1" value="80" style="width:100%;accent-color:var(--gold);cursor:pointer;height:4px">
            </div>
            <div>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                <label style="font-size:0.75rem;font-weight:600;color:var(--muted);display:flex;align-items:center;gap:6px"><i class="fas fa-wind" style="color:var(--ipp-red,#c8102e)"></i> Sillage</label>
                <span id="editFpSillageLabel" style="font-size:0.75rem;font-weight:700;color:var(--text);background:var(--s4);padding:2px 10px;border-radius:20px">Strong</span>
              </div>
              <input type="range" id="editFpSillage" min="0" max="100" step="1" value="75" style="width:100%;accent-color:var(--gold);cursor:pointer;height:4px">
            </div>
            <div>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                <label style="font-size:0.75rem;font-weight:600;color:var(--muted);display:flex;align-items:center;gap:6px"><i class="fas fa-sun" style="color:var(--ipp-red,#c8102e)"></i> Season</label>
                <span id="editFpSeasonLabel" style="font-size:0.75rem;font-weight:700;color:var(--text);background:var(--s4);padding:2px 10px;border-radius:20px">All Year</span>
              </div>
              <input type="range" id="editFpSeason" min="0" max="100" step="1" value="75" style="width:100%;accent-color:var(--gold);cursor:pointer;height:4px">
            </div>
          </div>
        </div>

        <!-- Section 6: Optional Details -->
        <div>
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px">
            <div style="width:28px;height:28px;border-radius:50%;background:var(--gold);color:#fff;display:flex;align-items:center;justify-content:center;font-size:0.78rem;font-weight:800;flex-shrink:0">6</div>
            <div style="font-size:0.95rem;font-weight:700;color:var(--text)">
              Optional Details <span style="font-weight:400;color:var(--muted);font-size:0.82rem">— Accords, Notes &amp; Ingredients</span>
            </div>
          </div>
          <div style="display:flex;flex-direction:column;gap:14px">
            <div>
              <label style="font-size:0.75rem;font-weight:600;color:var(--muted);display:block;margin-bottom:6px">Main Accords <span style="font-weight:400;font-size:0.7rem">— click to select (up to 8)</span></label>
              <div id="editProductAccordsPicker" style="background:var(--s3);border:1px solid var(--border);border-radius:8px;padding:10px 12px;box-sizing:border-box"></div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
              <div>
                <label style="font-size:0.75rem;font-weight:600;color:var(--muted);display:block;margin-bottom:6px">Top Notes</label>
                <input type="text" id="editProductNotesTop" placeholder="e.g. Bergamot, pepper"
                  style="width:100%;background:var(--s3);border:1px solid var(--border);border-radius:8px;padding:10px 12px;font-size:0.85rem;color:var(--text);outline:none;box-sizing:border-box">
              </div>
              <div>
                <label style="font-size:0.75rem;font-weight:600;color:var(--muted);display:block;margin-bottom:6px">Heart Notes</label>
                <input type="text" id="editProductNotesHeart" placeholder="e.g. Jasmine, rose"
                  style="width:100%;background:var(--s3);border:1px solid var(--border);border-radius:8px;padding:10px 12px;font-size:0.85rem;color:var(--text);outline:none;box-sizing:border-box">
              </div>
              <div>
                <label style="font-size:0.75rem;font-weight:600;color:var(--muted);display:block;margin-bottom:6px">Base Notes</label>
                <input type="text" id="editProductNotesBase" placeholder="e.g. Sandalwood, musk"
                  style="width:100%;background:var(--s3);border:1px solid var(--border);border-radius:8px;padding:10px 12px;font-size:0.85rem;color:var(--text);outline:none;box-sizing:border-box">
              </div>
            </div>
            <div>
              <label style="font-size:0.75rem;font-weight:600;color:var(--muted);display:block;margin-bottom:6px">Ingredients (INCI) <span style="font-weight:400;font-size:0.7rem">— comma-separated</span></label>
              <textarea id="editProductIngredients" rows="3" placeholder="e.g. Alcohol Denat., Parfum, Aqua, Limonene, Linalool"
                style="width:100%;background:var(--s3);border:1px solid var(--border);border-radius:8px;padding:10px 12px;font-size:0.85rem;color:var(--text);outline:none;box-sizing:border-box;resize:vertical;font-family:inherit;line-height:1.6"></textarea>
            </div>
          </div>
        </div>

        <!-- Section 7: Stock & Badge -->
        <div>
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px">
            <div style="width:28px;height:28px;border-radius:50%;background:var(--gold);color:#fff;display:flex;align-items:center;justify-content:center;font-size:0.78rem;font-weight:800;flex-shrink:0">7</div>
            <div style="font-size:0.95rem;font-weight:700;color:var(--text)">
              Stock &amp; Badge <span style="font-weight:400;color:var(--muted);font-size:0.82rem">— optional display info for site</span>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
            <div>
              <label style="font-size:0.75rem;font-weight:600;color:var(--muted);display:block;margin-bottom:6px">
                Stock Left <span style="font-weight:400;font-size:0.7rem">— shows "Only X left!" when low (leave empty = unlimited)</span>
              </label>
              <input type="number" id="editProductStockLeft" min="0" max="9999" placeholder="e.g. 12"
                style="width:100%;background:var(--s3);border:1px solid var(--border);border-radius:8px;padding:10px 12px;font-size:0.85rem;color:var(--text);outline:none;box-sizing:border-box">
            </div>
            <div>
              <label style="font-size:0.75rem;font-weight:600;color:var(--muted);display:block;margin-bottom:6px">
                Product Badge <span style="font-weight:400;font-size:0.7rem">— shown on card &amp; product page</span>
              </label>
              <div id="editBadgePresets" style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:8px">
                <button type="button" data-badge-preset="NEW" style="padding:4px 10px;border-radius:20px;font-size:10px;font-weight:800;cursor:pointer;border:1px solid #111;background:#111;color:#fff;letter-spacing:0.05em">NEW</button>
                <button type="button" data-badge-preset="LIMITED" style="padding:4px 10px;border-radius:20px;font-size:10px;font-weight:800;cursor:pointer;border:1px solid #b8860b;background:#b8860b;color:#fff;letter-spacing:0.05em">LIMITED</button>
                <button type="button" data-badge-preset="BESTSELLER" style="padding:4px 10px;border-radius:20px;font-size:10px;font-weight:800;cursor:pointer;border:1px solid #1d4ed8;background:#1d4ed8;color:#fff;letter-spacing:0.05em">BESTSELLER</button>
                <button type="button" data-badge-preset="HOT" style="padding:4px 10px;border-radius:20px;font-size:10px;font-weight:800;cursor:pointer;border:1px solid #dc2626;background:#dc2626;color:#fff;letter-spacing:0.05em">HOT</button>
                <button type="button" data-badge-preset="SALE" style="padding:4px 10px;border-radius:20px;font-size:10px;font-weight:800;cursor:pointer;border:1px solid #15803d;background:#15803d;color:#fff;letter-spacing:0.05em">SALE</button>
                <button type="button" data-badge-preset="EXCLUSIVE" style="padding:4px 10px;border-radius:20px;font-size:10px;font-weight:800;cursor:pointer;border:1px solid #7e22ce;background:#7e22ce;color:#fff;letter-spacing:0.05em">EXCLUSIVE</button>
                <button type="button" data-badge-preset="" style="padding:4px 10px;border-radius:20px;font-size:10px;font-weight:700;cursor:pointer;border:1px solid var(--border);background:var(--s4);color:var(--muted)">None</button>
              </div>
              <input type="text" id="editProductBadge" maxlength="20" placeholder="Custom text or leave empty for no badge"
                style="width:100%;background:var(--s3);border:1px solid var(--border);border-radius:8px;padding:10px 12px;font-size:0.85rem;color:var(--text);outline:none;box-sizing:border-box">
            </div>
          </div>
        </div>

        <!-- Progress & Error -->
        <div id="editProductProgress" style="display:none">
          <div style="font-size:0.75rem;color:var(--muted);margin-bottom:6px" id="editProductProgressLabel">Uploading...</div>
          <div style="height:6px;background:var(--border);border-radius:3px;overflow:hidden">
            <div id="editProductProgressBar" style="height:100%;width:0%;background:var(--gold);transition:width 0.25s;border-radius:3px"></div>
          </div>
        </div>
        <div id="editProductError" style="display:none;color:var(--rose);font-size:0.78rem;padding:8px 12px;background:rgba(239,68,68,0.08);border-radius:6px;border:1px solid rgba(239,68,68,0.2)"></div>

        <!-- Bottom action bar -->
        <div style="display:flex;justify-content:flex-end;gap:10px;padding-top:8px;border-top:1px solid var(--border);margin-top:4px">
          <button type="button" id="cancelEditProductBtnBottom" class="btn btn-sm" style="display:flex;align-items:center;gap:6px">
            <i class="fas fa-xmark"></i> Close
          </button>
          <button type="button" id="saveEditProductBtnBottom" class="btn btn-sm btn-gold" style="display:flex;align-items:center;gap:6px">
            <i class="fas fa-floppy-disk"></i> Save Changes
          </button>
        </div>
      </form>
    </div>`;
  document.body.appendChild(modal);

  const closeModal = () => { modal.style.display = 'none'; };
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  document.getElementById('cancelEditProductBtn').addEventListener('click', closeModal);
  document.getElementById('cancelEditProductBtnBottom').addEventListener('click', closeModal);

  // ── Badge preset picker ───────────────────────────────────────────────────
  const _badgeInput    = document.getElementById('editProductBadge');
  const _badgePresets  = document.getElementById('editBadgePresets');
  const _syncBadgeBtns = () => {
    const cur = _badgeInput.value.trim();
    _badgePresets.querySelectorAll('[data-badge-preset]').forEach(btn => {
      const active = btn.dataset.badgePreset === cur;
      btn.style.outline = active ? '2px solid var(--gold)' : 'none';
      btn.style.outlineOffset = active ? '2px' : '0';
    });
  };
  _badgePresets.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-badge-preset]');
    if (!btn) return;
    _badgeInput.value = btn.dataset.badgePreset;
    _syncBadgeBtns();
  });
  _badgeInput.addEventListener('input', _syncBadgeBtns);

  // ── Fragrance profile sliders ─────────────────────────────────────────────
  const _fpSliders = [
    { id: 'editFpLongevity', labelId: 'editFpLongevityLabel', fn: _fpLongevityLabel },
    { id: 'editFpSillage',   labelId: 'editFpSillageLabel',   fn: _fpSillageLabel   },
    { id: 'editFpSeason',    labelId: 'editFpSeasonLabel',    fn: _fpSeasonLabel    },
  ];
  _fpSliders.forEach(({ id, labelId, fn }) => {
    const sl = document.getElementById(id);
    const lb = document.getElementById(labelId);
    if (!sl || !lb) return;
    sl.addEventListener('input', () => { lb.textContent = fn(sl.value); });
    lb.textContent = fn(sl.value); // init
  });

  document.getElementById('saveEditProductBtnBottom').addEventListener('click', () => {
    document.getElementById('editProductForm').requestSubmit
      ? document.getElementById('editProductForm').requestSubmit()
      : document.getElementById('editProductForm').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
  });

  // ── Main image state ──────────────────────────────────────────────────────
  let _mainState = null; // { type:'url'|'file', src, file? }

  const _renderMain = () => {
    const imgEl     = document.getElementById('editMainImgPreview');
    const emptyEl   = document.getElementById('editMainImgEmpty');
    const removeBtn = document.getElementById('editMainImgRemoveBtn');
    if (_mainState) {
      imgEl.src = _mainState.type === 'url' ? esc(_mainState.src) : _mainState.src;
      imgEl.style.display   = 'block';
      emptyEl.style.display = 'none';
      removeBtn.style.display = 'flex';
    } else {
      imgEl.src = '';
      imgEl.style.display   = 'none';
      emptyEl.style.display = 'block';
      removeBtn.style.display = 'none';
    }
  };

  document.getElementById('editMainImgRemoveBtn').addEventListener('click', () => {
    if (_mainState?.type === 'file') URL.revokeObjectURL(_mainState.src);
    _mainState = null;
    _renderMain();
  });

  document.getElementById('editMainImgInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast('Image must be smaller than 5MB.', 'error'); return; }
    if (_mainState?.type === 'file') URL.revokeObjectURL(_mainState.src);
    _mainState = { type: 'file', src: URL.createObjectURL(file), file };
    _renderMain();
    e.target.value = '';
  });

  // ── Gallery state ─────────────────────────────────────────────────────────
  let _galleryItems = [];

  const _renderGallery = () => {
    const rowEl   = document.getElementById('editGalleryRow');
    const countEl = document.getElementById('editGalleryCount');
    rowEl.innerHTML = '';

    // "Add Image" button (always first)
    const addLabel = document.createElement('label');
    addLabel.style.cssText = 'width:112px;height:112px;flex-shrink:0;border:2px dashed var(--border);border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;gap:5px;background:var(--s3);box-sizing:border-box';
    addLabel.innerHTML = `
      <i class="fas fa-plus" style="font-size:1.2rem;color:var(--gold)"></i>
      <span style="font-size:0.72rem;font-weight:700;color:var(--gold)">Add Image</span>
      <span style="font-size:0.65rem;color:var(--muted)">JPG, PNG, WebP</span>
      <input type="file" accept="image/jpeg,image/png,image/webp,image/jpg" multiple style="display:none">`;
    addLabel.querySelector('input').addEventListener('change', (e) => {
      Array.from(e.target.files).forEach(file => {
        if (file.size > 5 * 1024 * 1024) { toast('Image must be smaller than 5MB.', 'error'); return; }
        if (_galleryItems.length >= 10)   { toast('Maximum 10 gallery images.', 'error'); return; }
        _galleryItems.push({ type: 'file', src: URL.createObjectURL(file), file });
      });
      e.target.value = '';
      _renderGallery();
    });
    rowEl.appendChild(addLabel);

    _galleryItems.forEach((item, i) => {
      const div = document.createElement('div');
      div.style.cssText = 'position:relative;width:112px;height:112px;flex-shrink:0';
      const src = item.type === 'url' ? esc(item.src) : item.src;
      div.innerHTML = `
        <img src="${src}" alt="" style="width:112px;height:112px;object-fit:cover;border-radius:12px;border:1px solid var(--border);background:var(--s3);display:block">
        <button type="button" title="Remove" style="position:absolute;top:-8px;right:-8px;width:24px;height:24px;border-radius:50%;background:var(--rose);color:#fff;border:none;cursor:pointer;font-size:14px;font-weight:900;display:flex;align-items:center;justify-content:center;line-height:1;box-shadow:0 2px 6px rgba(0,0,0,0.2)">×</button>`;
      div.querySelector('button').addEventListener('click', () => {
        if (item.type === 'file') URL.revokeObjectURL(item.src);
        _galleryItems.splice(i, 1);
        _renderGallery();
      });
      rowEl.appendChild(div);
    });

    if (countEl) countEl.textContent = `${_galleryItems.length} / 10 images`;
  };

  // Expose state setters for openEditProductModal
  modal._setMainState = (state) => {
    if (_mainState?.type === 'file') URL.revokeObjectURL(_mainState.src);
    _mainState = state;
    _renderMain();
  };
  modal._setGalleryItems = (items) => {
    _galleryItems.forEach(it => { if (it.type === 'file') URL.revokeObjectURL(it.src); });
    _galleryItems = [...items];
    _renderGallery();
  };

  // Accord picker for Edit modal
  const _editAccordPickerEl = document.getElementById('editProductAccordsPicker');
  _apInitAccordPicker(_editAccordPickerEl, []);
  modal._setAccords = (arr) => {
    if (_editAccordPickerEl && _editAccordPickerEl._setAccords) _editAccordPickerEl._setAccords(arr);
  };

  // Add size row button
  document.getElementById('editProductAddSizeBtn').addEventListener('click', () => {
    _apAddSizeRow(document.getElementById('editProductSizesContainer'));
  });

  // Save button triggers form submit
  document.getElementById('saveEditProductBtn').addEventListener('click', () => {
    document.getElementById('editProductForm').requestSubmit
      ? document.getElementById('editProductForm').requestSubmit()
      : document.getElementById('editProductForm').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
  });

  // Form submit handler
  document.getElementById('editProductForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl         = document.getElementById('editProductError');
    const progressEl    = document.getElementById('editProductProgress');
    const progressBar   = document.getElementById('editProductProgressBar');
    const progressLabel = document.getElementById('editProductProgressLabel');
    const saveBtn       = document.getElementById('saveEditProductBtn');
    const saveBtnBottom = document.getElementById('saveEditProductBtnBottom');
    errEl.style.display = 'none';

    const originalSlug = document.getElementById('editProductSlug').value;
    const name         = (document.getElementById('editProductName').value || '').trim();
    const brand        = (document.getElementById('editProductBrand').value || '').trim();
    const gender       = document.getElementById('editProductGender').value || 'for-men';
    const category     = document.getElementById('editProductCategory').value || 'designer';

    if (!name)         { errEl.textContent = 'Product name is required.'; errEl.style.display = 'block'; return; }
    if (!brand)        { errEl.textContent = 'Brand name is required.';   errEl.style.display = 'block'; return; }
    if (!_mainState)   { errEl.textContent = 'A main product image is required.'; errEl.style.display = 'block'; return; }

    const description  = (document.getElementById('editProductDescription').value || '').trim();
    const accordsRaw   = document.getElementById('editProductAccordsPicker')._getAccords();
    const notesTop     = (document.getElementById('editProductNotesTop').value || '').trim();
    const notesHeart   = (document.getElementById('editProductNotesHeart').value || '').trim();
    const notesBase    = (document.getElementById('editProductNotesBase').value || '').trim();
    const ingredients  = (document.getElementById('editProductIngredients').value || '').trim();
    const stockLeftRaw = parseInt(document.getElementById('editProductStockLeft').value, 10);
    const stockLeft    = Number.isFinite(stockLeftRaw) && stockLeftRaw >= 0 ? stockLeftRaw : null;
    const badge        = (document.getElementById('editProductBadge').value || '').trim() || null;
    const _fpLon = parseInt(document.getElementById('editFpLongevity').value, 10);
    const _fpSil = parseInt(document.getElementById('editFpSillage').value, 10);
    const _fpSea = parseInt(document.getElementById('editFpSeason').value, 10);
    const fragranceProfile = { longevity: _fpLon, longevityLabel: _fpLongevityLabel(_fpLon), sillage: _fpSil, sillageLabel: _fpSillageLabel(_fpSil), season: _fpSea, seasonLabel: _fpSeasonLabel(_fpSea) };

    const sizes = {};
    const originalPrices = {};
    let sizeError = false;
    document.querySelectorAll('#editProductSizesContainer .prod-size-row').forEach(row => {
      const sizeKey   = (row.querySelector('.prod-size-key').value || '').trim().toLowerCase();
      const priceRaw  = (row.querySelector('.prod-size-price').value || '').trim();
      const sizePrice = priceRaw === '' ? 0 : parseFloat(priceRaw);
      const origRaw   = parseFloat(row.querySelector('.prod-size-orig-price')?.value);
      if (!sizeKey && priceRaw === '') return; // completely blank row — skip silently
      if (sizeKey && sizePrice > 0) {
        sizes[sizeKey] = sizePrice;
        if (Number.isFinite(origRaw) && origRaw > sizePrice) originalPrices[sizeKey] = origRaw;
      } else if (sizeKey && sizePrice === 0) {
        sizes[sizeKey] = 0; // price 0 — size saved but hidden on site; all-zero = product out of stock
      } else {
        sizeError = true; // price filled but no size name
      }
    });
    if (Object.keys(sizes).length === 0) {
      errEl.textContent = 'Add at least one size name.'; errEl.style.display = 'block'; return;
    }
    if (sizeError) {
      errEl.textContent = 'Some size rows are missing a size name.';
      errEl.style.display = 'block'; return;
    }

    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Saving...';
    if (saveBtnBottom) { saveBtnBottom.disabled = true; saveBtnBottom.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Saving...'; }
    progressEl.style.display = 'block';
    progressBar.style.width = '5%';

    try {
      // Upload main image if it's a new file
      let mainUrl = _mainState.type === 'url' ? _mainState.src : '';
      if (_mainState.type === 'file') {
        progressLabel.textContent = 'Uploading main image...';
        mainUrl = await _apUploadToCloudinary(_mainState.file);
        progressBar.style.width = '35%';
      }

      // Upload gallery images
      const galleryUrls = [];
      const galleryFiles = _galleryItems.filter(it => it.type === 'file');
      let done = 0;
      for (const item of _galleryItems) {
        if (item.type === 'url') {
          galleryUrls.push(item.src);
        } else {
          progressLabel.textContent = `Uploading gallery image ${++done} of ${galleryFiles.length}…`;
          progressBar.style.width = Math.round(35 + (done / Math.max(galleryFiles.length, 1)) * 50) + '%';
          galleryUrls.push(await _apUploadToCloudinary(item.file));
        }
      }

      const allImages = [mainUrl, ...galleryUrls];
      progressLabel.textContent = 'Saving changes...';
      progressBar.style.width = '90%';

      const newSlug = _apToSlug(name);
      const payload = {
        name, brand: brand.toUpperCase(), slug: newSlug,
        image: mainUrl, images: allImages, sizes, active: true,
        filters: ['new-in', gender, category],
        ...(description ? { description } : {}),
        ...(accordsRaw.length ? { accords: accordsRaw } : {}),
        ...(notesTop || notesHeart || notesBase ? { notes: { top: notesTop, heart: notesHeart, base: notesBase } } : {}),
        ...(ingredients ? { ingredients } : {}),
        ...(stockLeft !== null ? { stockLeft } : {}),
        ...(badge ? { badge } : {}),
        originalPrices: Object.keys(originalPrices).length ? originalPrices : null,
        fragranceProfile,
      };

      if (newSlug !== originalSlug) {
        const existing = await getDoc(doc(db, 'products', newSlug));
        if (existing.exists()) throw new Error(`A product named "${name}" already exists. Use a different name.`);
        const origSnap = await getDoc(doc(db, 'products', originalSlug));
        if (origSnap.exists()) {
          payload.addedAt = origSnap.data().addedAt || serverTimestamp();
          payload.source  = origSnap.data().source  || 'admin';
        } else {
          payload.addedAt = serverTimestamp();
          payload.source  = 'admin';
        }
        await setDoc(doc(db, 'products', newSlug), payload);
        await deleteDoc(doc(db, 'products', originalSlug));
        // Remove any stale productOverrides entries — admin products are managed
        // exclusively via products.sizes, never via productOverrides.
        try { await deleteDoc(doc(db, 'productOverrides', newSlug)); } catch (_) {}
        try { await deleteDoc(doc(db, 'productOverrides', originalSlug)); } catch (_) {}
      } else {
        // Fetch preserved fields (addedAt, source) so the full overwrite retains them
        const origSnap2 = await getDoc(doc(db, 'products', originalSlug));
        if (origSnap2.exists()) {
          payload.addedAt = origSnap2.data().addedAt || serverTimestamp();
          payload.source  = origSnap2.data().source  || 'admin';
        } else {
          payload.addedAt = serverTimestamp();
          payload.source  = 'admin';
        }
        // Full overwrite (no merge) so removed sizes are actually deleted
        await setDoc(doc(db, 'products', originalSlug), payload);
        // Remove any stale productOverrides entry for the same reason.
        try { await deleteDoc(doc(db, 'productOverrides', originalSlug)); } catch (_) {}
      }

      progressBar.style.width = '100%';
      progressLabel.textContent = 'Saved!';
      setTimeout(() => {
        closeModal();
        toast(`"${name}" updated successfully.`, 'success', 4000);
        loadFirestoreProductsSection();
      }, 500);
    } catch (err) {
      progressEl.style.display = 'none';
      errEl.textContent = 'Failed: ' + err.message;
      errEl.style.display = 'block';
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<i class="fas fa-floppy-disk"></i> Save Changes';
      if (saveBtnBottom) { saveBtnBottom.disabled = false; saveBtnBottom.innerHTML = '<i class="fas fa-floppy-disk"></i> Save Changes'; }
    }
  });
};

const openEditProductModal = (slug, data) => {
  initEditProductModal();
  const modal = document.getElementById('editProductModal');

  // Reset UI
  document.getElementById('editProductError').style.display    = 'none';
  document.getElementById('editProductProgress').style.display = 'none';
  document.getElementById('editProductProgressBar').style.width = '0%';
  document.getElementById('saveEditProductBtn').disabled = false;
  document.getElementById('saveEditProductBtn').innerHTML = '<i class="fas fa-floppy-disk"></i> Save Changes';
  const _bsb = document.getElementById('saveEditProductBtnBottom');
  if (_bsb) { _bsb.disabled = false; _bsb.innerHTML = '<i class="fas fa-floppy-disk"></i> Save Changes'; }

  // Main image
  const mainUrl = (Array.isArray(data.images) && data.images[0]) ? data.images[0] : (data.image || '');
  modal._setMainState(mainUrl ? { type: 'url', src: mainUrl } : null);

  // Gallery (images[1+])
  const galleryUrls = Array.isArray(data.images) ? data.images.slice(1).filter(Boolean) : [];
  modal._setGalleryItems(galleryUrls.map(src => ({ type: 'url', src })));

  // Form fields
  document.getElementById('editProductSlug').value = slug;
  document.getElementById('editProductName').value  = data.name  || '';
  document.getElementById('editProductBrand').value = (data.brand || '').replace(/^(.+)$/, m => m.toUpperCase() === m ? m.slice(0,1).toUpperCase() + m.slice(1).toLowerCase() : m);

  const filters  = Array.isArray(data.filters) ? data.filters : [];
  const gender   = filters.find(f => ['for-men','for-women','unisex'].includes(f)) || 'for-men';
  const category = filters.find(f => ['designer','niche','arabian'].includes(f))  || 'designer';
  document.getElementById('editProductGender').value   = gender;
  document.getElementById('editProductCategory').value = category;

  // Description
  document.getElementById('editProductDescription').value = data.description || '';

  // Optional details: accords, notes, ingredients
  const _accordsArr = Array.isArray(data.accords) ? data.accords : (data.accords ? String(data.accords).split(',').map(s=>s.trim()).filter(Boolean) : []);
  modal._setAccords(_accordsArr);
  const _notes = data.notes && typeof data.notes === 'object' ? data.notes : {};
  document.getElementById('editProductNotesTop').value   = _notes.top   || '';
  document.getElementById('editProductNotesHeart').value = _notes.heart || '';
  document.getElementById('editProductNotesBase').value  = _notes.base  || '';
  document.getElementById('editProductIngredients').value = data.ingredients || '';

  // Stock & Badge
  const _stockEl = document.getElementById('editProductStockLeft');
  const _badgeEl = document.getElementById('editProductBadge');
  if (_stockEl) _stockEl.value = data.stockLeft != null ? String(data.stockLeft) : '';
  if (_badgeEl) {
    _badgeEl.value = data.badge || '';
    // Sync preset button highlights
    const _presets = document.getElementById('editBadgePresets');
    if (_presets) {
      _presets.querySelectorAll('[data-badge-preset]').forEach(btn => {
        const active = btn.dataset.badgePreset === (data.badge || '');
        btn.style.outline = active ? '2px solid var(--gold)' : 'none';
        btn.style.outlineOffset = active ? '2px' : '0';
      });
    }
  }

  // Sizes
  const sizesContainer = document.getElementById('editProductSizesContainer');
  sizesContainer.innerHTML = '';
  const sizesObj    = data.sizes && typeof data.sizes === 'object' ? data.sizes : {};
  const origPricesObj = data.originalPrices && typeof data.originalPrices === 'object' ? data.originalPrices : {};
  const sizeEntries = Object.entries(sizesObj);
  if (sizeEntries.length) {
    sizeEntries.forEach(([sz, price]) => _apAddSizeRow(sizesContainer, sz, price, origPricesObj[sz] || ''));
  } else {
    _apAddSizeRow(sizesContainer, '50ml', '');
  }

  // Fragrance profile sliders
  const _fp = data.fragranceProfile && typeof data.fragranceProfile === 'object' ? data.fragranceProfile : {};
  const _fpDefaults = { longevity: 80, sillage: 75, season: 75 };
  [['editFpLongevity','editFpLongevityLabel',_fpLongevityLabel,'longevity'],
   ['editFpSillage',  'editFpSillageLabel',  _fpSillageLabel,  'sillage'],
   ['editFpSeason',   'editFpSeasonLabel',   _fpSeasonLabel,   'season']].forEach(([sid, lid, fn, key]) => {
    const sl = document.getElementById(sid);
    const lb = document.getElementById(lid);
    if (!sl || !lb) return;
    const val = _fp[key] != null ? +_fp[key] : _fpDefaults[key];
    sl.value = val;
    lb.textContent = fn(val);
  });

  modal.style.display = 'block';
};

const loadFirestoreProductsSection = async () => {
  const section = document.getElementById('firestoreProductsSection');
  if (!section) return;
  try {
    const snap = await getDocs(query(collection(db, 'products'), orderBy('addedAt', 'desc')));
    if (snap.empty) { section.innerHTML = ''; return; }

    const cards = snap.docs.map(d => {
      const p = d.data();
      const _visibleSizes = Object.entries(p.sizes || {}).filter(([, price]) => Number(price) > 0);
      const sizesHtml = _visibleSizes.map(([sz, price], i) =>
        `<span style="font-size:11px;font-weight:700;padding:4px 10px;border-radius:6px;border:1px solid ${i===0?'#1f2937':'#d1d5db'};color:${i===0?'#111':'#6b7280'};background:transparent">${sz.toUpperCase()} — ${price} MAD</span>`
      ).join('');
      const statusBadge = p.active === false
        ? '<span style="font-size:10px;font-weight:700;background:rgba(239,68,68,0.12);color:var(--rose);padding:3px 8px;border-radius:20px;border:1px solid rgba(239,68,68,0.25)">Disabled</span>'
        : '<span style="font-size:10px;font-weight:700;background:rgba(34,197,94,0.12);color:var(--emerald);padding:3px 8px;border-radius:20px;border:1px solid rgba(34,197,94,0.25)">Live</span>';
      return `
        <div style="background:var(--s2);border:1px solid var(--border);border-radius:12px;padding:14px;display:flex;gap:14px;align-items:flex-start" data-fsprod-slug="${esc(p.slug||d.id)}">
          <img src="${esc(p.image||'')}" alt="${esc(p.name||'')}" style="width:64px;height:64px;object-fit:contain;border-radius:8px;background:var(--s3);flex-shrink:0" onerror="this.style.display='none'">
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px">
              <span style="font-size:0.85rem;font-weight:700;color:var(--text)">${esc(p.name||'')}</span>
              ${statusBadge}
            </div>
            <div style="font-size:0.72rem;color:var(--muted);margin-bottom:8px">${esc(p.brand||'')} · Added via Admin</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap">${sizesHtml}</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0">
            <button class="btn btn-xs fsprod-edit" data-slug="${esc(p.slug||d.id)}"
              style="font-size:11px;background:rgba(200,169,106,0.12);color:var(--gold);border-color:rgba(200,169,106,0.35)">
              <i class="fas fa-pen"></i> Edit
            </button>
            <button class="btn btn-xs fsprod-toggle" data-slug="${esc(p.slug||d.id)}" data-active="${p.active!==false}"
              style="font-size:11px">${p.active===false?'Enable':'Disable'}</button>
            <button class="btn btn-xs fsprod-delete" data-slug="${esc(p.slug||d.id)}"
              style="font-size:11px;background:rgba(239,68,68,0.1);color:var(--rose);border-color:rgba(239,68,68,0.25)">
              <i class="fas fa-trash-can"></i> Delete
            </button>
          </div>
        </div>`;
    }).join('');

    section.innerHTML = `
      <div style="margin-bottom:10px">
        <div style="font-size:0.78rem;font-weight:700;color:var(--text);margin-bottom:10px;display:flex;align-items:center;gap:8px">
          <i class="fas fa-database" style="color:var(--gold)"></i> Products Added via Admin Panel
          <span style="font-size:0.7rem;font-weight:400;color:var(--muted)">(${snap.size} product${snap.size!==1?'s':''})</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px">${cards}</div>
      </div>
      <div style="height:1px;background:var(--border);margin:16px 0"></div>`;

    // Wire toggle + delete + edit
    section.addEventListener('click', async (e) => {
      const editBtn   = e.target.closest('.fsprod-edit');
      const toggleBtn = e.target.closest('.fsprod-toggle');
      const deleteBtn = e.target.closest('.fsprod-delete');

      if (editBtn) {
        const slug = editBtn.dataset.slug;
        try {
          const snap = await getDoc(doc(db, 'products', slug));
          if (!snap.exists()) { toast('Product not found.', 'error'); return; }
          openEditProductModal(slug, snap.data());
        } catch (err) { toast(err.message, 'error'); }
        return;
      }

      if (toggleBtn) {
        const slug = toggleBtn.dataset.slug;
        const isActive = toggleBtn.dataset.active === 'true';
        try {
          await setDoc(doc(db, 'products', slug), { active: !isActive }, { merge: true });
          toast(isActive ? 'Product disabled (hidden from site)' : 'Product enabled (live on site)', 'success');
          loadFirestoreProductsSection();
        } catch (err) { toast(err.message, 'error'); }
      }

      if (deleteBtn) {
        const slug = deleteBtn.dataset.slug;
        const card = deleteBtn.closest('[data-fsprod-slug]');
        const name = card?.querySelector('span[style*="font-weight:700"]')?.textContent || slug;
        if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
        try {
          await deleteDoc(doc(db, 'products', slug));
          toast(`"${name}" deleted.`, 'success');
          loadFirestoreProductsSection();
        } catch (err) { toast(err.message, 'error'); }
      }
    });
  } catch (err) {
    section.innerHTML = `<div style="font-size:0.78rem;color:var(--muted);padding:8px">Could not load admin products: ${esc(err.message)}</div>`;
  }
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
