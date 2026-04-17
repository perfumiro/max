'use strict';

// ─── UTILITY ─────────────────────────────────────────────────────────────────
const normalizeApiBase = (v) => {
  const raw = String(v || '').trim();
  if (!raw) return 'http://localhost:5050';
  try { return new URL(raw).origin; } catch { return 'http://localhost:5050'; }
};
const qs  = (sel) => document.querySelector(sel);
const qsa = (sel) => Array.from(document.querySelectorAll(sel));
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtNum      = (n) => Number(n || 0).toLocaleString('en-US');
const fmtDate     = (ts) => { if (!ts) return '-'; const d = new Date(ts); return d.toLocaleDateString('en-US',{month:'short',day:'numeric'}); };
const fmtDateTime = (ts) => { if (!ts) return '-'; const d = new Date(ts); return d.toLocaleDateString('en-US',{month:'short',day:'numeric'})+' '+d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}); };
const relTime = (ts) => {
  if (!ts) return '-';
  const s = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (s < 60) return s + 's ago';
  const m = Math.floor(s/60); if (m < 60) return m + 'm ago';
  const h = Math.floor(m/60); if (h < 24) return h + 'h ago';
  return Math.floor(h/24) + 'd ago';
};
const flag = (country) => {
  if (!country || country.length !== 2) return '';
  try { return String.fromCodePoint(...[...country.toUpperCase()].map(c => 0x1F1E0 + c.charCodeAt(0) - 65)) + ' '; } catch { return ''; }
};
const deviceIcon = (t) => {
  const v = (t||'').toLowerCase();
  if (v==='mobile') return '<i class="fas fa-mobile-screen" title="Mobile"></i>';
  if (v==='tablet') return '<i class="fas fa-tablet-screen-button" title="Tablet"></i>';
  return '<i class="fas fa-desktop" title="Desktop"></i>';
};
const browserIcon = (n) => {
  const v = (n||'').toLowerCase();
  if (v.includes('chrome'))  return '<i class="fab fa-chrome"></i> ';
  if (v.includes('firefox')) return '<i class="fab fa-firefox-browser"></i> ';
  if (v.includes('safari'))  return '<i class="fab fa-safari"></i> ';
  if (v.includes('edge'))    return '<i class="fab fa-edge"></i> ';
  if (v.includes('opera'))   return '<i class="fab fa-opera"></i> ';
  return '<i class="fas fa-globe"></i> ';
};

// ─── STATE ───────────────────────────────────────────────────────────────────
const storedBase  = localStorage.getItem('ipordise-admin-api-base');
const defaultBase = window.location.protocol === 'file:' ? 'http://localhost:5050' : window.location.origin;
const state = {
  apiBase:       normalizeApiBase(storedBase || defaultBase),
  currentView:   'overview',
  trafficRange:  30,
  analyticsRange:30,
  filters:       { startDate:'', endDate:'', country:'', city:'', pageUrl:'', search:'' },
  pagination:    { page:1, pageSize:20, total:0, totalPages:1 },
  charts:        { visitsOverTime:null, deviceBreakdown:null, analyticsDaily:null },
  pollers:       []
};

// ─── API ─────────────────────────────────────────────────────────────────────
const candidateBases = () => {
  const s = new Set([normalizeApiBase(state.apiBase)]);
  if (window.location.protocol !== 'file:') {
    s.add(normalizeApiBase(window.location.origin));
    s.add(normalizeApiBase(window.location.protocol+'//'+window.location.hostname+':5050'));
  }
  s.add('http://127.0.0.1:5050'); s.add('http://localhost:5050');
  return [...s];
};
const resolveUrl = (path, base) => /^https?:\/\//i.test(path) ? path : base + path;
const fetchJson = async (url, opts = {}) => {
  let lastErr;
  for (const base of candidateBases()) {
    try {
      const res = await fetch(resolveUrl(url, base), {
        credentials: 'include',
        headers: { 'Content-Type':'application/json', ...(opts.headers||{}) },
        ...opts
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        if (res.status === 404) { lastErr = new Error('Endpoint not found'); continue; }
        throw new Error(b.error || 'Request failed ('+res.status+')');
      }
      state.apiBase = base;
      localStorage.setItem('ipordise-admin-api-base', base);
      return res.json();
    } catch (e) { lastErr = e; }
  }
  throw new Error(lastErr?.message || 'Cannot connect to analytics API. Start backend on http://localhost:5050.');
};
const openDownload = (path) => window.open(resolveUrl(path, state.apiBase), '_blank', 'noopener');

// ─── TOAST ────────────────────────────────────────────────────────────────────
const toast = (message, type = 'info', duration = 3500) => {
  const el = document.createElement('div');
  el.className = 'toast toast-' + type;
  const icons = { success:'fa-circle-check', error:'fa-circle-exclamation', info:'fa-circle-info' };
  el.innerHTML = '<i class="fas '+(icons[type]||icons.info)+' toast-icon"></i><span>'+esc(message)+'</span>';
  const c = qs('#toastContainer');
  if (c) c.appendChild(el);
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
  setTheme(s==='dark'||s==='light' ? s : (window.matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light'));
};

// ─── SIDEBAR + VIEW NAV ───────────────────────────────────────────────────────
const openMobileSidebar  = () => { qs('#sidebar')?.classList.add('open'); qs('#sidebarOverlay')?.classList.add('open'); };
const closeMobileSidebar = () => { qs('#sidebar')?.classList.remove('open'); qs('#sidebarOverlay')?.classList.remove('open'); };
const switchView = (name) => {
  state.currentView = name;
  qsa('.view').forEach(el => el.classList.remove('active'));
  qs('#view-'+name)?.classList.add('active');
  qsa('.sidebar-item[data-view]').forEach(it => it.classList.toggle('active', it.dataset.view === name));
  if (name === 'visitors') loadVisitors().catch(e => toast(e.message,'error'));
  if (name === 'analytics') loadAnalyticsView().catch(e => toast(e.message,'error'));
  if (name === 'activity') loadActivity().catch(e => toast(e.message,'error'));
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
  const start = parseInt(el.textContent.replace(/,/g,''), 10) || 0;
  const diff = target - start;
  if (!diff) { el.textContent = fmtNum(target); return; }
  const t0 = performance.now();
  const step = (now) => {
    const p = Math.min((now-t0)/dur, 1);
    el.textContent = fmtNum(Math.round(start + diff * (1 - Math.pow(1-p, 3))));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
};

// ─── STATS GRID ───────────────────────────────────────────────────────────────
const setLoadingSkeleton = () => {
  qs('#statsGrid').innerHTML = Array.from({length:5}, () =>
    '<div class="stat-card"><div class="skeleton" style="height:80px;border-radius:var(--radius-md)"></div></div>'
  ).join('');
};
const STAT_DEFS = [
  { key:'totalVisits',       label:'Total Visits',    icon:'fas fa-chart-bar',    accent:'var(--gold)' },
  { key:'todayVisits',       label:"Today's Visits",  icon:'fas fa-calendar-day', accent:'var(--sky)' },
  { key:'uniqueVisitors',    label:'Unique Visitors', icon:'fas fa-users',        accent:'var(--emerald)' },
  { key:'returningVisitors', label:'Returning',       icon:'fas fa-rotate-right', accent:'var(--amber)' },
  { key:'onlineNow',         label:'Online Now',      icon:'fas fa-wifi',         accent:'var(--rose)' },
];
const updateStats = (stats) => {
  const grid = qs('#statsGrid');
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
      const el = grid.querySelector('[data-stat="'+d.key+'"]');
      if (el) animateCount(el, Number(stats[d.key] || 0));
    });
  }
  animateCount(qs('#onlineCount'), Number(stats.onlineNow || 0));
  const badge = qs('#navTodayBadge');
  if (badge) badge.textContent = fmtNum(stats.todayVisits || 0);
};

// ─── LATEST VISITORS ─────────────────────────────────────────────────────────
const renderLatestVisitors = (rows) => {
  const tbody = qs('#latestVisitorsBody');
  const mobile = qs('#latestVisitorsMobile');
  if (!tbody) return;
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:24px">No visitor data yet.</td></tr>';
    if (mobile) mobile.innerHTML = ''; return;
  }
  tbody.innerHTML = rows.map(r => `<tr>
    <td class="td-mono td-muted">${relTime(r.timestamp)}</td>
    <td class="td-mono td-short">${esc(r.visitor_id)}</td>
    <td class="td-mono">${esc(r.ip_masked)}</td>
    <td>${flag(r.country)}${esc(r.city||r.country||'-')}</td>
    <td class="td-page" title="${esc(r.page_url)}">${esc(r.page_url)}</td>
    <td>${deviceIcon(r.device_type)}</td>
    <td><span class="badge ${r.is_returning?'badge-gold':'badge-green'}">${r.is_returning?'Returning':'New'}</span></td>
  </tr>`).join('');
  if (mobile) mobile.innerHTML = rows.map(r => `<div class="mobile-card">
    <div class="mobile-card-row"><span class="mobile-card-key">Time</span><span class="mobile-card-val">${relTime(r.timestamp)}</span></div>
    <div class="mobile-card-row"><span class="mobile-card-key">IP</span><span class="mobile-card-val td-mono">${esc(r.ip_masked)}</span></div>
    <div class="mobile-card-row"><span class="mobile-card-key">Location</span><span class="mobile-card-val">${flag(r.country)}${esc(r.city||r.country||'-')}</span></div>
    <div class="mobile-card-row"><span class="mobile-card-key">Page</span><span class="mobile-card-val">${esc(r.page_url)}</span></div>
    <div class="mobile-card-row"><span class="mobile-card-key">Type</span><span class="mobile-card-val"><span class="badge ${r.is_returning?'badge-gold':'badge-green'}">${r.is_returning?'Returning':'New'}</span></span></div>
  </div>`).join('');
};

// ─── VISITORS TABLE ───────────────────────────────────────────────────────────
const renderVisitorsTable = (rows) => {
  const tbody = qs('#visitorsBody');
  const mobile = qs('#visitorsMobile');
  if (!rows.length) {
    if (tbody) tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--muted);padding:24px">No records for selected filters.</td></tr>';
    if (mobile) mobile.innerHTML = '<div style="color:var(--muted);text-align:center;padding:20px">No records found.</div>';
    return;
  }
  if (tbody) tbody.innerHTML = rows.map(r => `<tr>
    <td class="td-mono td-muted">${fmtDateTime(r.timestamp)}</td>
    <td class="td-mono td-short">${esc(r.visitor_id)}</td>
    <td class="td-mono">${esc(r.ip_masked)}</td>
    <td>${flag(r.country)}${esc(r.city?r.city+', '+r.country:r.country||'-')}</td>
    <td class="td-page" title="${esc(r.page_url)}">${esc(r.page_url)}</td>
    <td>${deviceIcon(r.device_type)} <span class="td-muted" style="font-size:11px">${esc(r.device_type||'-')}</span></td>
    <td>${browserIcon(r.browser)}${esc(r.browser||'-')}</td>
    <td class="td-muted td-short">${r.referrer?esc(r.referrer):'<span class="badge badge-muted">direct</span>'}</td>
    <td><span class="badge ${r.is_returning?'badge-gold':'badge-green'}">${r.is_returning?'Returning':'New'}</span></td>
  </tr>`).join('');
  if (mobile) mobile.innerHTML = rows.map(r => `<div class="mobile-card">
    <div class="mobile-card-row"><span class="mobile-card-key">Time</span><span class="mobile-card-val">${fmtDateTime(r.timestamp)}</span></div>
    <div class="mobile-card-row"><span class="mobile-card-key">IP</span><span class="mobile-card-val td-mono">${esc(r.ip_masked)}</span></div>
    <div class="mobile-card-row"><span class="mobile-card-key">Location</span><span class="mobile-card-val">${flag(r.country)}${esc(r.city?r.city+', '+r.country:r.country||'-')}</span></div>
    <div class="mobile-card-row"><span class="mobile-card-key">Page</span><span class="mobile-card-val">${esc(r.page_url)}</span></div>
    <div class="mobile-card-row"><span class="mobile-card-key">Browser</span><span class="mobile-card-val">${browserIcon(r.browser)}${esc(r.browser||'-')}</span></div>
    <div class="mobile-card-row"><span class="mobile-card-key">Type</span><span class="mobile-card-val"><span class="badge ${r.is_returning?'badge-gold':'badge-green'}">${r.is_returning?'Returning':'New'}</span></span></div>
  </div>`).join('');
};

// ─── PAGINATION ───────────────────────────────────────────────────────────────
const renderPagination = (pagination) => {
  state.pagination = pagination;
  const info = qs('#paginationInfo');
  if (info) info.textContent = 'Page '+pagination.page+' of '+pagination.totalPages+' - '+fmtNum(pagination.total)+' records';
  const lbl = qs('#visitorCountLabel');
  if (lbl) lbl.textContent = fmtNum(pagination.total) + ' records';
  const controls = qs('#paginationControls');
  if (!controls) return;
  const { page, totalPages } = pagination;
  const pages = [];
  if (page > 1) pages.push({ label:'Prev', n:page-1 });
  const s = Math.max(1, page-2), e = Math.min(totalPages, page+2);
  for (let i=s; i<=e; i++) pages.push({ label:String(i), n:i, active:i===page });
  if (page < totalPages) pages.push({ label:'Next', n:page+1 });
  controls.innerHTML = pages.map(p => '<button class="page-btn'+(p.active?' active':'')+'" data-page="'+p.n+'">'+p.label+'</button>').join('');
  controls.querySelectorAll('.page-btn').forEach(btn => btn.addEventListener('click', () => {
    state.pagination.page = parseInt(btn.dataset.page, 10);
    loadVisitors().catch(e => toast(e.message,'error'));
  }));
};

// ─── RANK LIST ────────────────────────────────────────────────────────────────
const renderRankList = (selector, rows) => {
  const el = qs(selector);
  if (!el) return;
  if (!rows.length) { el.innerHTML = '<div class="rank-item"><span class="rank-label td-muted">No data yet</span></div>'; return; }
  const max = rows[0]?.value || 1;
  el.innerHTML = rows.map((r,i) => `<div class="rank-item">
    <span class="rank-num">${i+1}</span>
    <span class="rank-label">${flag(r.name)}${esc(r.name)}</span>
    <div class="rank-bar-wrap"><div class="rank-bar-fill" style="width:${Math.round(r.value/max*100)}%"></div></div>
    <span class="rank-count">${fmtNum(r.value)}</span>
  </div>`).join('');
};

// ─── ACTIVITY FEED ────────────────────────────────────────────────────────────
const actCls = (page) => {
  const p = (page||'').toLowerCase();
  if (p.includes('product')||p.includes('perfume')) return 'activity-icon-product';
  if (p.includes('cart')||p.includes('checkout'))   return 'activity-icon-cart';
  return 'activity-icon-page';
};
const actFa = (page) => {
  const p = (page||'').toLowerCase();
  if (p.includes('product')||p.includes('perfume')) return 'fa-bottle-droplet';
  if (p.includes('cart')||p.includes('checkout'))   return 'fa-cart-shopping';
  return 'fa-eye';
};
const renderActivity = (rows) => {
  const feed = qs('#activityFeed');
  if (!feed) return;
  if (!rows.length) { feed.innerHTML = '<div style="color:var(--muted);text-align:center;padding:24px">No activity yet.</div>'; return; }
  feed.innerHTML = rows.map(r => `<div class="activity-item">
    <div class="activity-icon ${actCls(r.page_url)}"><i class="fas ${actFa(r.page_url)}"></i></div>
    <div class="activity-body">
      <div class="activity-page" title="${esc(r.page_url)}">${esc(r.page_url||'/')}</div>
      <div class="activity-meta">
        <span>${flag(r.country)}${esc(r.city?r.city+', '+r.country:r.country||'Unknown')}</span>
        <span class="activity-meta-sep">·</span><span class="td-mono">${esc(r.ip_masked)}</span>
        <span class="activity-meta-sep">·</span><span>${deviceIcon(r.device_type)}</span>
        <span class="activity-meta-sep">·</span><span>${esc(r.event_type||'pageview')}</span>
      </div>
    </div>
    <div class="activity-time">${relTime(r.timestamp)}</div>
  </div>`).join('');
};

// ─── CHARTS ───────────────────────────────────────────────────────────────────
const chartCfg = () => document.body.getAttribute('data-theme')==='dark'
  ? { gold:'#c8a96a', goldFill:'rgba(200,169,106,.12)', sky:'#38bdf8', emerald:'#22c55e', rose:'#f43f5e', amber:'#f59e0b', grid:'rgba(255,255,255,.06)', ticks:'rgba(255,255,255,.35)', tooltip:'#1c1c2a' }
  : { gold:'#b8922a', goldFill:'rgba(184,146,42,.1)',   sky:'#0369a1', emerald:'#16a34a', rose:'#dc2626', amber:'#d97706', grid:'rgba(0,0,0,.06)', ticks:'rgba(0,0,0,.4)', tooltip:'#ffffff' };

const upsertChart = (key, canvas, config) => {
  if (!canvas || typeof window.Chart !== 'function') return;
  if (state.charts[key]) { state.charts[key].destroy(); state.charts[key]=null; }
  state.charts[key] = new window.Chart(canvas, config);
};

const renderCharts = (analytics) => {
  const cc = chartCfg();
  const tooltipBase = { backgroundColor:cc.tooltip, titleColor:cc.gold, bodyColor: document.body.getAttribute('data-theme')==='dark'?'#f0f0f8':'#111128', borderColor:'rgba(200,169,106,.3)', borderWidth:1, padding:10 };
  const labels = analytics.visitsByDay.map(d => fmtDate(d.day));
  const data   = analytics.visitsByDay.map(d => d.visits);
  upsertChart('visitsOverTime', qs('#visitsOverTimeChart'), {
    type:'line',
    data:{ labels, datasets:[{ label:'Visits', data, borderColor:cc.gold, backgroundColor:cc.goldFill, fill:true, borderWidth:2.5, tension:.4, pointRadius:data.length>30?0:3, pointHoverRadius:5, pointBackgroundColor:cc.gold }] },
    options:{ responsive:true, maintainAspectRatio:false, interaction:{mode:'index',intersect:false},
      plugins:{ legend:{display:false}, tooltip:tooltipBase },
      scales:{ x:{grid:{color:cc.grid},ticks:{color:cc.ticks,font:{size:11},maxTicksLimit:8}}, y:{beginAtZero:true,grid:{color:cc.grid},ticks:{color:cc.ticks,font:{size:11},precision:0}} } }
  });
  const devColors = [cc.gold, cc.sky, cc.emerald, cc.rose, cc.amber];
  const devData = analytics.deviceBreakdown || [];
  upsertChart('deviceBreakdown', qs('#deviceBreakdownChart'), {
    type:'doughnut',
    data:{ labels:devData.map(d=>d.name), datasets:[{ data:devData.map(d=>d.value), backgroundColor:devColors, borderWidth:0, hoverOffset:6 }] },
    options:{ responsive:true, maintainAspectRatio:false, cutout:'72%', plugins:{ legend:{display:false}, tooltip:tooltipBase } }
  });
  const total = devData.reduce((s,d) => s+d.value, 0);
  animateCount(qs('#donutTotalVal'), total);
  const legend = qs('#deviceLegend');
  if (legend) legend.innerHTML = devData.map((d,i) => `<li><span class="donut-legend-dot" style="background:${devColors[i]}"></span><span>${esc(d.name)}</span><span class="donut-legend-val">${fmtNum(d.value)}</span></li>`).join('');
};

const renderAnalyticsChart = (analytics) => {
  const cc = chartCfg();
  const tooltipBase = { backgroundColor:cc.tooltip, titleColor:cc.gold, bodyColor: document.body.getAttribute('data-theme')==='dark'?'#f0f0f8':'#111128', borderColor:'rgba(200,169,106,.3)', borderWidth:1 };
  upsertChart('analyticsDaily', qs('#analyticsDailyChart'), {
    type:'bar',
    data:{ labels:analytics.visitsByDay.map(d=>fmtDate(d.day)), datasets:[{ label:'Visits', data:analytics.visitsByDay.map(d=>d.visits), backgroundColor:cc.goldFill, borderColor:cc.gold, borderWidth:1, borderRadius:4, borderSkipped:false }] },
    options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{display:false}, tooltip:tooltipBase },
      scales:{ x:{grid:{color:cc.grid},ticks:{color:cc.ticks,font:{size:11},maxTicksLimit:12}}, y:{beginAtZero:true,grid:{color:cc.grid},ticks:{color:cc.ticks,font:{size:11},precision:0}} } }
  });
};

// ─── DATA LOADERS ─────────────────────────────────────────────────────────────
const loadOverview = async () => {
  const data = await fetchJson('/api/admin/overview');
  updateStats(data.stats);
  renderLatestVisitors(data.latestVisitors || []);
  const el = qs('#lastUpdated');
  if (el) el.textContent = 'Updated ' + new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
};
const collectFilters = () => {
  state.filters.startDate = qs('#filterStartDate')?.value||'';
  state.filters.endDate   = qs('#filterEndDate')?.value||'';
  state.filters.country   = (qs('#filterCountry')?.value||'').trim();
  state.filters.city      = (qs('#filterCity')?.value||'').trim();
  state.filters.pageUrl   = (qs('#filterPage')?.value||'').trim();
  state.filters.search    = (qs('#filterSearch')?.value||'').trim();
};
const loadVisitors = async () => {
  const p = new URLSearchParams({ page:state.pagination.page, pageSize:state.pagination.pageSize });
  Object.entries(state.filters).forEach(([k,v]) => { if (v) p.set(k,v); });
  const data = await fetchJson('/api/admin/visitors?'+p);
  renderVisitorsTable(data.rows||[]);
  renderPagination(data.pagination);
};
const loadAnalytics = async () => {
  const data = await fetchJson('/api/admin/analytics?days='+state.trafficRange);
  renderCharts(data);
  renderRankList('#topCountriesList',    data.topCountries    ||[]);
  renderRankList('#topPagesList',        data.topPages        ||[]);
  renderRankList('#browserBreakdownList',data.browserBreakdown||[]);
};
const loadAnalyticsView = async () => {
  const data = await fetchJson('/api/admin/analytics?days='+state.analyticsRange);
  renderAnalyticsChart(data);
  renderRankList('#analyticsCountriesList', data.topCountries   ||[]);
  renderRankList('#analyticsCitiesList',    data.topCities      ||[]);
  renderRankList('#analyticsDevicesList',   data.deviceBreakdown||[]);
};
const loadActivity = async () => {
  const data = await fetchJson('/api/admin/activity');
  renderActivity(data.rows||[]);
};
const refreshAll = async () => {
  try { await Promise.all([loadOverview(), loadAnalytics()]); }
  catch (e) { toast(e.message,'error'); throw e; }
};

// ─── FILTERS UI ───────────────────────────────────────────────────────────────
const initFilters = () => {
  qs('#applyFiltersBtn')?.addEventListener('click', () => {
    state.pagination.page = 1; collectFilters();
    loadVisitors().catch(e => toast(e.message,'error'));
  });
  qs('#clearFiltersBtn')?.addEventListener('click', () => {
    ['filterStartDate','filterEndDate','filterCountry','filterCity','filterPage','filterSearch'].forEach(id => { const el = qs('#'+id); if(el) el.value=''; });
    state.pagination.page = 1; collectFilters();
    loadVisitors().catch(e => toast(e.message,'error'));
  });
  qsa('#filterSearch,#filterCountry,#filterCity,#filterPage').forEach(inp => inp.addEventListener('keydown', e => {
    if (e.key==='Enter') { state.pagination.page=1; collectFilters(); loadVisitors().catch(er=>toast(er.message,'error')); }
  }));
};

// ─── TOOLBAR ─────────────────────────────────────────────────────────────────
const initToolbar = () => {
  qs('#refreshBtn')?.addEventListener('click', () => refreshAll().then(()=>toast('Dashboard refreshed','success')).catch(()=>{}));
  qs('#themeToggle')?.addEventListener('click', () => {
    const cur = document.body.getAttribute('data-theme');
    setTheme(cur==='dark'?'light':'dark');
    if (state.currentView==='overview')   loadAnalytics().catch(()=>{});
    if (state.currentView==='analytics')  loadAnalyticsView().catch(()=>{});
  });
  qs('#refreshActivityBtn')?.addEventListener('click', () => loadActivity().then(()=>toast('Feed refreshed','success')).catch(e=>toast(e.message,'error')));
  qs('#trafficRange')?.addEventListener('change', e => { state.trafficRange=parseInt(e.target.value,10); loadAnalytics().catch(e2=>toast(e2.message,'error')); });
  qs('#analyticsRange')?.addEventListener('change', e => { state.analyticsRange=parseInt(e.target.value,10); loadAnalyticsView().catch(e2=>toast(e2.message,'error')); });
  const dateEl = qs('#todayDateLabel');
  if (dateEl) dateEl.textContent = new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
};

// ─── EXPORTS ─────────────────────────────────────────────────────────────────
const initExports = () => {
  const doExp = (fmt) => { openDownload('/api/admin/export?format='+fmt); toast('Downloading '+fmt.toUpperCase()+'...','info'); };
  qs('#exportCsvBtn')?.addEventListener('click',  () => doExp('csv'));
  qs('#exportJsonBtn')?.addEventListener('click', () => doExp('json'));
  qs('#exportCsvBtn2')?.addEventListener('click', () => doExp('csv'));
  qs('#exportJsonBtn2')?.addEventListener('click',() => doExp('json'));
};

// ─── AUTH ─────────────────────────────────────────────────────────────────────
const REMEMBER_KEY = 'ipordise-admin-remember-email';
const initAuth = () => {
  const pwdInput  = qs('#loginPassword');
  const pwdIcon   = qs('#togglePasswordIcon');
  const remember  = qs('#rememberLogin');
  const emailInput= qs('#loginUsername');
  const saved = localStorage.getItem(REMEMBER_KEY);
  if (saved && emailInput && remember) { emailInput.value=saved; remember.checked=true; }

  qs('#togglePasswordBtn')?.addEventListener('click', () => {
    const shown = pwdInput.type==='text';
    pwdInput.type = shown?'password':'text';
    if (pwdIcon) pwdIcon.className = shown?'fas fa-eye':'fas fa-eye-slash';
  });

  qs('#loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const lbl=qs('#loginBtnLabel'), spn=qs('#loginBtnSpinner');
    lbl?.classList.add('hidden'); spn?.classList.remove('hidden');
    qs('#authError')?.classList.add('hidden');
    try {
      await fetchJson('/api/admin/login',{ method:'POST', body:JSON.stringify({ username:emailInput.value.trim(), password:pwdInput.value }) });
      if (remember?.checked) localStorage.setItem(REMEMBER_KEY, emailInput.value.trim());
      else localStorage.removeItem(REMEMBER_KEY);
      await bootstrapDashboard();
    } catch (err) {
      const msg = /Cannot connect|endpoint not found|Failed to fetch/i.test(err.message) ? err.message+' - Make sure backend is running.' : err.message;
      const authErr = qs('#authError');
      if (authErr) { authErr.textContent=msg; authErr.classList.remove('hidden'); }
    } finally { lbl?.classList.remove('hidden'); spn?.classList.add('hidden'); }
  });

  const doLogout = () => {
    state.pollers.forEach(clearInterval); state.pollers=[];
    Object.values(state.charts).forEach(c => { if(c){ try{c.destroy();}catch{} }});
    state.charts.visitsOverTime=null; state.charts.deviceBreakdown=null; state.charts.analyticsDaily=null;
    showAuth();
  };

  qs('#logoutBtn')?.addEventListener('click', async () => {
    try { await fetchJson('/api/admin/logout',{method:'POST'}); } catch {}
    doLogout(); toast('Signed out','info');
  });

  qs('#forceLogoutAllBtn')?.addEventListener('click', async () => {
    if (!confirm('This will immediately sign out ALL admin sessions on every device. Continue?')) return;
    try {
      await fetchJson('/api/admin/force-logout-all',{method:'POST'});
      toast('All sessions revoked — everyone must sign in again','success');
    } catch(err) {
      toast('Error: '+err.message,'error');
    }
    doLogout();
  });

  const apiHint = qs('#apiHint');
  if (apiHint) apiHint.textContent = 'API: '+state.apiBase;
};

// ─── BOOTSTRAP ───────────────────────────────────────────────────────────────
const bootstrapDashboard = async () => {
  const session = await fetchJson('/api/admin/session');
  const userEl = qs('#sidebarUserEmail');
  if (userEl && session?.user) userEl.textContent = session.user;
  showDashboard();
  switchView('overview');
  setLoadingSkeleton();
  collectFilters();
  await refreshAll();
  state.pollers.forEach(clearInterval); state.pollers=[];
  state.pollers = [
    setInterval(() => loadOverview().catch(()=>{}), 10000),
    setInterval(() => loadActivity().catch(()=>{}), 12000),
  ];
};

// ─── INIT ─────────────────────────────────────────────────────────────────────
const init = async () => {
  initTheme();
  initAuth();
  initSidebar();
  initFilters();
  initExports();
  initToolbar();
  try { await bootstrapDashboard(); } catch { showAuth(); }
};

init().catch(() => showAuth());