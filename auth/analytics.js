// ================================================================
// IPORDISE — Behavior Tracking & Analytics System v1.0
//
// Tracks user behavior automatically and stores aggregated data
// in Firestore under the analytics_* collections.
//
// Loaded as a side-effect module via account-header.js on ALL pages.
//
// Firestore collections used:
//   analytics_sessions/{sessionId}   — per-visit session data
//   analytics_products/{productId}   — product-level counters
//   analytics_daily/{YYYY-MM-DD}     — daily aggregated stats
//   analytics_live/state             — real-time active visitors
// ================================================================

import { db, auth } from './firebase.js';
import {
  doc, setDoc, updateDoc, increment, deleteField,
  serverTimestamp, writeBatch,
} from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js';
import { onAuthStateChanged, signInAnonymously }
  from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js';

// ── Config ────────────────────────────────────────────────────
const FLUSH_MS        = 60_000;  // flush event buffer every 60 s
const HEARTBEAT_MS    = 30_000;  // live-visitor ping every 30 s
const PRODUCT_VIEW_MS = 3_000;   // min time before counting a product view
const MAX_EVENTS      = 100;     // cap buffered events per session

// ── Stable session ID (resets across tabs/windows) ────────────
const _sid = (() => {
  let s = sessionStorage.getItem('ipo-sid');
  if (!s) {
    s = 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    sessionStorage.setItem('ipo-sid', s);
  }
  return s;
})();

// ── Session state ──────────────────────────────────────────────
let _uid          = null;       // Firebase uid (set once auth resolves)
let _ready        = false;      // true once session doc written
let _sessionStart = Date.now();
let _pageEnter    = Date.now();
let _scrollMax    = 0;
let _currentPage  = '';
let _eventBuf     = [];         // local event queue
let _pvTimer      = null;       // product-view debounce timer

// ── Helpers ───────────────────────────────────────────────────
const _device = () => {
  const ua = navigator.userAgent;
  if (/tablet|ipad/i.test(ua)) return 'tablet';
  if (/mobile|android|iphone/i.test(ua)) return 'mobile';
  return 'desktop';
};

// Normalize current page to a short readable identifier
const _page = () => {
  const p     = window.location.pathname.replace(/\\/g, '/');
  const base  = p.split('/').pop().replace(/\.html$/, '') || 'home';
  const pid   = new URLSearchParams(window.location.search).get('id');
  return pid ? `${base}:${pid.slice(0, 28)}` : base;
};

const _today  = () => new Date().toISOString().slice(0, 10);
const _isNew  = () => !localStorage.getItem('ipo-v');
const _markV  = () => localStorage.setItem('ipo-v', '1');

// ── Firestore refs ────────────────────────────────────────────
const _sRef = ()   => doc(db, 'analytics_sessions', _sid);
const _lRef = ()   => doc(db, 'analytics_live', 'state');
const _dRef = ()   => doc(db, 'analytics_daily', _today());
const _pRef = (id) => doc(db, 'analytics_products', String(id));

// Silent fire-and-forget wrappers
const _set = (ref, data, opts) => setDoc(ref, data, opts).catch(() => {});
const _upd = (ref, data)       => updateDoc(ref, data).catch(() => {});

// ── Local event buffer ────────────────────────────────────────
const _push = (type, data = {}) => {
  if (_eventBuf.length >= MAX_EVENTS) return;
  _eventBuf.push({ type, ...data, _t: Date.now() });
};

// ── Session initialisation ────────────────────────────────────
const _initSession = async () => {
  _currentPage  = _page();
  _pageEnter    = Date.now();
  const isNew   = _isNew();
  _markV();

  const batch = writeBatch(db);

  // Session document
  batch.set(_sRef(), {
    startTime:      serverTimestamp(),
    lastSeen:       serverTimestamp(),
    uid:            _uid,
    device:         _device(),
    screen:         `${screen.width}x${screen.height}`,
    referrer:       document.referrer
      ? (() => { try { return new URL(document.referrer).hostname; } catch { return 'direct'; } })()
      : 'direct',
    entryPage:      _currentPage,
    currentPage:    _currentPage,
    isNew,
    converted:      false,
    checkoutStarted: false,
    duration:       0,
    pages:          [{ path: _currentPage, t: Date.now() }],
  });

  // Daily aggregates — merge so we don't overwrite existing fields
  batch.set(_dRef(), {
    date:         _today(),
    sessions:     increment(1),
    newSessions:  increment(isNew ? 1 : 0),
    pageViews:    increment(1),
    productViews: increment(0),
    cartAdds:     increment(0),
    conversions:  increment(0),
    cartAbandons: increment(0),
    revenue:      increment(0),
  }, { merge: true });

  await batch.commit().catch(() => {});
  _ready = true;
};

// ── Live-visitor heartbeat ────────────────────────────────────
const _heartbeat = async () => {
  if (!_ready) return;
  const val = { t: Date.now(), page: _currentPage, device: _device(), uid: _uid };
  try {
    // updateDoc interprets dotted keys as nested paths → writes into v map correctly
    await updateDoc(_lRef(), { [`v.${_sid}`]: val });
  } catch {
    // Document doesn't exist yet — create it with the full structure
    setDoc(_lRef(), { v: { [_sid]: val } }, { merge: true }).catch(() => {});
  }
};

const _removeFromLive = () => {
  updateDoc(_lRef(), { [`v.${_sid}`]: deleteField() }).catch(() => {});
};

// ── Periodic event-buffer flush ───────────────────────────────
const _flush = () => {
  if (!_ready || !_eventBuf.length) return;
  const events = _eventBuf.splice(0);
  _upd(_sRef(), {
    lastSeen:    serverTimestamp(),
    currentPage: _currentPage,
    duration:    Math.round((Date.now() - _sessionStart) / 1000),
    // Store last 50 events on the session doc for the admin dashboard preview
    recentEvents: events.slice(-50).map(e => ({ type: e.type, _t: e._t })),
  });
};

// ── Page exit snapshot ────────────────────────────────────────
const _pageExit = () => {
  _push('page_exit', {
    path:      _currentPage,
    duration:  Math.round((Date.now() - _pageEnter) / 1000),
    scrollPct: _scrollMax,
  });
};

// ── Session teardown (beforeunload) ──────────────────────────
const _teardown = () => {
  _pageExit();
  _flush();
  _removeFromLive();
  const duration = Math.round((Date.now() - _sessionStart) / 1000);
  _set(_sRef(), {
    lastSeen: serverTimestamp(),
    exitPage: _currentPage,
    duration,
  }, { merge: true });
};

// ================================================================
// PUBLIC TRACKING API
// Called automatically by DOM event delegation below, but also
// exposed on window.__ipo_analytics for explicit calls.
// ================================================================

/** Count a product view (fires after user spends ≥3 s on it) */
export const trackProductView = (id, name, brand, image = '') => {
  if (!id) return;
  clearTimeout(_pvTimer);
  _pvTimer = setTimeout(() => {
    _push('product_view', { id, name, brand });
    const batch = writeBatch(db);
    batch.set(_pRef(id), { name, brand, image, views: increment(1) }, { merge: true });
    batch.set(_dRef(), { productViews: increment(1) }, { merge: true });
    batch.commit().catch(() => {});
  }, PRODUCT_VIEW_MS);
};

/** Count "Add to Cart" click */
export const trackCartAdd = (id, name, brand, size, price) => {
  if (!id) return;
  _push('cart_add', { id, name, brand, size, price });
  const batch = writeBatch(db);
  batch.set(_pRef(id), { name, brand, cartAdds: increment(1) }, { merge: true });
  batch.set(_dRef(), { cartAdds: increment(1) }, { merge: true });
  batch.commit().catch(() => {});
};

/** Count favorite toggle */
export const trackFavorite = (id, name, brand, added) => {
  if (!id) return;
  _push(added ? 'fav_add' : 'fav_remove', { id, name, brand });
  _set(_pRef(id), { name, brand, favorites: increment(added ? 1 : -1) }, { merge: true });
};

/** Mark checkout page reached (abandonment detection) */
export const trackCheckout = () => {
  _push('checkout_start', {});
  if (_ready) _upd(_sRef(), { checkoutStarted: true });
};

/** Call from thank-you page after confirmed order */
export const trackPurchase = (items = [], total = 0) => {
  _push('purchase', { total, count: items.length });
  const batch = writeBatch(db);
  batch.set(_sRef(), { converted: true, purchaseValue: total }, { merge: true });
  batch.set(_dRef(), { conversions: increment(1), revenue: increment(total || 0) }, { merge: true });
  items.forEach(item => {
    if (item?.id) batch.set(_pRef(item.id), { purchases: increment(1) }, { merge: true });
  });
  batch.commit().catch(() => {});
};

/** Track search query */
export const trackSearch = (query, resultCount = 0) => {
  _push('search', { q: String(query).slice(0, 80), results: resultCount });
};

// ================================================================
// AUTO DOM TRACKING
// ================================================================

const _initScroll = () => {
  const milestones = new Set();
  window.addEventListener('scroll', () => {
    const h = document.body.scrollHeight - innerHeight;
    if (h <= 0) return;
    const pct = Math.round((scrollY / h) * 100);
    _scrollMax = Math.max(_scrollMax, pct);
    [25, 50, 75, 90].forEach(m => {
      if (pct >= m && !milestones.has(m)) {
        milestones.add(m);
        _push('scroll', { pct: m, page: _currentPage });
      }
    });
  }, { passive: true });
};

const _initClicks = () => {
  document.addEventListener('click', e => {
    const t = e.target;

    // ── Add to Cart ──────────────────────────────────────────
    const addBtn = t.closest('.js-card-add-btn, .js-add-to-cart-btn');
    if (addBtn) {
      const card = addBtn.closest('[data-id]');
      if (card) {
        const activeBadge = card.querySelector('.card-size-badge.active, .size-btn.active');
        trackCartAdd(
          card.dataset.id || '',
          card.dataset.productName || '',
          card.dataset.productBrand || '',
          activeBadge?.textContent.trim() || '',
          card.dataset.productPrice || '',
        );
      }
      return;
    }

    // ── Favorite button ──────────────────────────────────────
    const favBtn = t.closest('.product-favorite-btn');
    if (favBtn) {
      const card = favBtn.closest('[data-id]');
      if (card) {
        // Check is-active BEFORE click handlers toggle it
        const adding = !favBtn.classList.contains('is-active');
        trackFavorite(
          card.dataset.id || '',
          card.dataset.productName || '',
          card.dataset.productBrand || '',
          adding,
        );
      }
      return;
    }

    // ── Product card navigation ──────────────────────────────
    const card = t.closest('.js-product-link[data-id]');
    if (card && !t.closest('button')) {
      _push('product_click', {
        id:    card.dataset.id || '',
        name:  card.dataset.productName || '',
        brand: card.dataset.productBrand || '',
      });
    }
  });
};

// Auto-detect current page type and fire relevant tracking
const _detectPage = () => {
  const path = window.location.pathname;

  // Product detail page
  if (path.includes('product')) {
    const p = new URLSearchParams(location.search);
    if (p.get('id')) {
      trackProductView(p.get('id'), p.get('name') || '', p.get('brand') || '');
    }
  }

  // Checkout page
  if (path.includes('checkout')) {
    trackCheckout();
  }
};

// ── Bootstrap ─────────────────────────────────────────────────
const _boot = async () => {
  // Ensure every visitor has a Firebase auth token.
  // Logged-in users keep their real account; anonymous visitors get
  // a silent anonymous token so Firestore writes are authenticated.
  await new Promise(resolve => {
    const unsub = onAuthStateChanged(auth, async user => {
      unsub();
      if (user) {
        _uid = user.uid;
      } else {
        try {
          const cred = await signInAnonymously(auth);
          _uid = cred.user.uid;
        } catch {
          _uid = null; // offline — writes will queue and retry
        }
      }
      resolve();
    });
  });

  await _initSession();

  // If user signs in with real account later in the same session, link uid
  onAuthStateChanged(auth, user => {
    if (user && user.uid !== _uid) {
      _uid = user.uid;
      if (_ready) _upd(_sRef(), { uid: _uid }).catch(() => {});
    }
  });

  _detectPage();
  _initScroll();
  _initClicks();

  // Initial heartbeat + periodic refresh
  _heartbeat();
  const _hb = setInterval(_heartbeat, HEARTBEAT_MS);

  // Periodic flush
  const _ff = setInterval(_flush, FLUSH_MS);

  // Teardown on leave
  const _bye = () => {
    clearInterval(_hb);
    clearInterval(_ff);
    _teardown();
  };
  window.addEventListener('beforeunload', _bye);
  window.addEventListener('pagehide',     _bye);

  // Expose global for manual calls from other scripts
  window.__ipo_analytics = {
    trackProductView,
    trackCartAdd,
    trackFavorite,
    trackCheckout,
    trackPurchase,
    trackSearch,
    sid: _sid,
  };
};

_boot().catch(() => {});
