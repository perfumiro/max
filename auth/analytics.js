// ================================================================
// IPORDISE — Analytics & Behavior Tracking v2.0
//
// Tracks every visitor automatically. Data saved to Firestore:
//   analytics_sessions/{sid}    — per-visit session
//   analytics_products/{id}     — product counters
//   analytics_daily/{YYYY-MM-DD}— daily totals
//   analytics_live/state        — real-time presence map
// ================================================================

import { db, auth } from './firebase.js';
import {
  doc, setDoc, updateDoc, increment, deleteField, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js';
import { onAuthStateChanged, signInAnonymously }
  from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js';

// ── Config ────────────────────────────────────────────────────
const HEARTBEAT_MS    = 25_000;   // live ping every 25 s
const PRODUCT_VIEW_MS = 3_000;    // min dwell before counting view
const LIVE_DOC        = doc(db, 'analytics_live', 'state');

// ── Session ID (one per browser tab) ─────────────────────────
const _sid = (() => {
  let s = sessionStorage.getItem('ipo-sid');
  if (!s) { s = 's' + Date.now().toString(36) + Math.random().toString(36).slice(2,7); sessionStorage.setItem('ipo-sid', s); }
  return s;
})();

// ── Page helpers ──────────────────────────────────────────────
const _device = () => {
  const ua = navigator.userAgent;
  if (/tablet|ipad/i.test(ua)) return 'tablet';
  if (/mobile|android|iphone/i.test(ua)) return 'mobile';
  return 'desktop';
};
const _page  = () => { const b = window.location.pathname.split('/').pop().replace(/\.html$/,'') || 'home'; const id = new URLSearchParams(location.search).get('id'); return id ? `${b}:${id.slice(0,24)}` : b; };
const _today = () => new Date().toISOString().slice(0,10);
const _isNew = () => !localStorage.getItem('ipo-v');
const _markV = () => localStorage.setItem('ipo-v','1');

// ── Firestore helpers ─────────────────────────────────────────
const _w  = (ref, data) => setDoc(ref, data, { merge: true }).catch(() => {});
const _sRef  = ()   => doc(db, 'analytics_sessions', _sid);
const _dRef  = ()   => doc(db, 'analytics_daily',   _today());
const _pRef  = (id) => doc(db, 'analytics_products', String(id));

// ── State ─────────────────────────────────────────────────────
let _uid         = null;
let _sessInit    = false;
let _currentPage = _page();
let _sessionStart = Date.now();
let _scrollMax    = 0;
let _pvTimer      = null;

// ── Step 1: Ensure Firebase Auth ─────────────────────────────
const _ensureAuth = () => new Promise(resolve => {
  const unsub = onAuthStateChanged(auth, async user => {
    unsub();
    if (user) {
      _uid = user.uid;
    } else {
      try { const c = await signInAnonymously(auth); _uid = c.user.uid; }
      catch { _uid = null; }
    }
    resolve();
  });
});

// ── Geo: fetch IP + country + city once per session ───────────
let _geo = null;
const GEO_KEY = 'ipo-geo';
const _fetchGeo = async () => {
  try {
    const cached = sessionStorage.getItem(GEO_KEY);
    if (cached) { _geo = JSON.parse(cached); return; }
    const r = await fetch('https://ipapi.co/json/', { cache: 'force-cache' });
    if (!r.ok) return;
    const d = await r.json();
    _geo = {
      ip:      d.ip      || '',
      country: d.country_name || d.country || '',
      city:    d.city    || '',
      region:  d.region  || '',
    };
    sessionStorage.setItem(GEO_KEY, JSON.stringify(_geo));
  } catch { /* geo is optional — never block tracking */ }
};

// ── Step 2: Write session init ────────────────────────────────
const _initSession = async () => {
  if (_sessInit) return;
  _sessInit = true;
  const isNew = _isNew(); _markV();
  _w(_sRef(), {
    startTime: serverTimestamp(), lastSeen: serverTimestamp(),
    uid: _uid, device: _device(), screen: `${screen.width}x${screen.height}`,
    referrer: document.referrer ? (() => { try { return new URL(document.referrer).hostname; } catch { return 'direct'; } })() : 'direct',
    entryPage: _currentPage, currentPage: _currentPage,
    isNew, converted: false, checkoutStarted: false, duration: 0,
    ip:      _geo?.ip      || '',
    country: _geo?.country || '',
    city:    _geo?.city    || '',
    region:  _geo?.region  || '',
  });
  _w(_dRef(), {
    date: _today(), sessions: increment(1), newSessions: increment(isNew ? 1 : 0),
    pageViews: increment(1), productViews: increment(0), cartAdds: increment(0),
    conversions: increment(0), revenue: increment(0),
  });
};

// ── Step 3: Live heartbeat ────────────────────────────────────
// Uses setDoc+merge so the document is created if it doesn't exist yet.
const _heartbeat = () => {
  const val = { t: Date.now(), page: _currentPage, device: _device(), uid: _uid };
  setDoc(LIVE_DOC, { v: { [_sid]: val } }, { merge: true }).catch(() => {});
};

const _removeFromLive = () => {
  const data = {};
  data[`v.${_sid}`] = deleteField();
  updateDoc(LIVE_DOC, data).catch(() => {});
};

// ── Teardown on page leave ────────────────────────────────────
const _teardown = () => {
  _removeFromLive();
  const dur = Math.round((Date.now() - _sessionStart) / 1000);
  _w(_sRef(), { exitPage: _currentPage, duration: dur, lastSeen: serverTimestamp() });
};

// ================================================================
// PUBLIC TRACKING API
// ================================================================

export const trackProductView = (id, name, brand, image = '') => {
  if (!id) return;
  clearTimeout(_pvTimer);
  _pvTimer = setTimeout(() => {
    _w(_pRef(id), { name, brand, image, views: increment(1) });
    _w(_dRef(), { productViews: increment(1) });
  }, PRODUCT_VIEW_MS);
};

export const trackCartAdd = (id, name, brand, size, price) => {
  if (!id) return;
  _w(_pRef(id), { name, brand, cartAdds: increment(1) });
  _w(_dRef(), { cartAdds: increment(1) });
};

export const trackFavorite = (id, name, brand, added) => {
  if (!id) return;
  _w(_pRef(id), { name, brand, favorites: increment(added ? 1 : -1) });
};

export const trackCheckout = () => {
  _w(_sRef(), { checkoutStarted: true });
};

export const trackPurchase = (items = [], total = 0) => {
  _w(_sRef(), { converted: true, purchaseValue: total });
  _w(_dRef(), { conversions: increment(1), revenue: increment(total || 0) });
  items.forEach(item => {
    if (item && item.id) _w(_pRef(item.id), { purchases: increment(1) });
  });
};

export const trackSearch = (query, resultCount = 0) => {};

// ================================================================
// AUTO DOM TRACKING
// ================================================================

const _initClicks = () => {
  document.addEventListener('click', e => {
    const t = e.target;
    const addBtn = t.closest('.js-card-add-btn, .js-add-to-cart-btn');
    if (addBtn) {
      const card = addBtn.closest('[data-id]');
      if (card) {
        const badge = card.querySelector('.card-size-badge.active, .size-btn.active');
        trackCartAdd(card.dataset.id||'', card.dataset.productName||'', card.dataset.productBrand||'', badge ? badge.textContent.trim() : '', card.dataset.productPrice||'');
      }
      return;
    }
    const favBtn = t.closest('.product-favorite-btn');
    if (favBtn) {
      const card = favBtn.closest('[data-id]');
      if (card) trackFavorite(card.dataset.id||'', card.dataset.productName||'', card.dataset.productBrand||'', !favBtn.classList.contains('is-active'));
    }
  });
};

const _initScroll = () => {
  window.addEventListener('scroll', () => {
    const h = document.body.scrollHeight - innerHeight;
    if (h > 0) _scrollMax = Math.max(_scrollMax, Math.round((scrollY / h) * 100));
  }, { passive: true });
};

const _detectPage = () => {
  const path = window.location.pathname;
  if (path.includes('product')) {
    const p = new URLSearchParams(location.search);
    if (p.get('id')) trackProductView(p.get('id'), p.get('name')||'', p.get('brand')||'');
  }
  if (path.includes('checkout')) trackCheckout();
};

// ── If real account signs in later, update session uid ────────
const _watchRealAuth = () => {
  onAuthStateChanged(auth, user => {
    if (user && !user.isAnonymous && user.uid !== _uid) {
      _uid = user.uid;
      _w(_sRef(), { uid: _uid });
    }
  });
};

// ================================================================
// BOOT
// ================================================================
const _boot = async () => {
  await Promise.all([_ensureAuth(), _fetchGeo()]);
  _initSession();  // fire-and-forget — don't await
  _detectPage();
  _initClicks();
  _initScroll();
  _watchRealAuth();

  // First heartbeat immediately, then every 25 s
  _heartbeat();
  const _hb = setInterval(_heartbeat, HEARTBEAT_MS);

  const _bye = () => { clearInterval(_hb); _teardown(); };
  window.addEventListener('beforeunload', _bye);
  window.addEventListener('pagehide', _bye);

  window.__ipo_analytics = {
    trackProductView, trackCartAdd, trackFavorite,
    trackCheckout, trackPurchase, trackSearch, sid: _sid,
  };
};

_boot().catch(() => {});
