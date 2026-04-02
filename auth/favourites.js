// ================================================================
// IPORDISE — Favourites Store  (Firebase v10 Modular CDN SDK)
// ================================================================
//
//  Single source of truth for favourites / wishlist across all pages.
//
//  Guest (not logged in)
//    → favourites stored in localStorage under GUEST_KEY
//
//  Authenticated user
//    → favourites stored in Firestore at  users/{uid}.favourites
//
//  On LOGIN
//    1. Fetch previously-saved server favourites from Firestore
//    2. Read any guest items the visitor added before logging in
//    3. Merge both arrays, de-duplicate by item.id
//    4. Persist merged list back to Firestore
//    5. Wipe guest localStorage (data is now safe in Firestore)
//
//  On LOGOUT
//    → In-memory list is replaced by whatever is in localStorage
//    → Authenticated state is fully discarded
//
//  Reactive updates
//    → All subscribers receive the new list via subscribe(fn)
//    → document dispatches CustomEvent('ipordise:favs-changed')
//      so non-module scripts (script.js) can also react
//
//  Exported helpers
//    loadGuestFavourites()
//    saveGuestFavourites(items)
//    clearGuestFavourites()
//    loadUserFavourites(userId)   → Promise<item[]>
//    saveUserFavourites(userId, items) → Promise<void>
//    mergeFavourites(localFavs, userFavs) → item[]
//    getFavourites()              → item[]  (sync, in-memory snapshot)
//    isReady()                    → bool  (true after first auth resolution)
//    subscribe(fn)                → unsubscribe fn
//    toggleFavourite(item)        → Promise<item[]>
//    removeFavourite(id)          → Promise<item[]>
//    clearFavourites()            → Promise<void>
//
// ================================================================

import { auth, db } from './firebase.js';
import {
  onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js';
import {
  doc,
  getDoc,
  setDoc,
} from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js';

// ── Constants ────────────────────────────────────────────────
const GUEST_KEY       = 'ipordise-wishlist-items';
const FIRESTORE_FIELD = 'favourites';

// ── In-memory state ──────────────────────────────────────────
let _favourites  = [];       // current active list
let _subscribers = [];       // module-level callbacks
let _ready       = false;    // true after the first auth state resolution

// ── Guest localStorage helpers ───────────────────────────────

export const loadGuestFavourites = () => {
  try {
    const raw    = localStorage.getItem(GUEST_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
};

export const saveGuestFavourites = (items) => {
  try { localStorage.setItem(GUEST_KEY, JSON.stringify(items)); } catch {}
};

export const clearGuestFavourites = () => {
  try { localStorage.removeItem(GUEST_KEY); } catch {}
};

// ── Firestore helpers ────────────────────────────────────────

export const loadUserFavourites = async (userId) => {
  try {
    const snap = await getDoc(doc(db, 'users', userId));
    if (!snap.exists()) return [];
    const data = snap.data();
    return Array.isArray(data[FIRESTORE_FIELD]) ? data[FIRESTORE_FIELD] : [];
  } catch { return []; }
};

export const saveUserFavourites = async (userId, favourites) => {
  try {
    await setDoc(
      doc(db, 'users', userId),
      { [FIRESTORE_FIELD]: favourites },
      { merge: true },
    );
  } catch {}
};

// ── Merge helper ─────────────────────────────────────────────
// Server favourites come first (preserve the user's existing order);
// guest items that are not already present are appended after.

export const mergeFavourites = (localFavs, userFavs) => {
  const seen   = new Set();
  const merged = [];
  for (const item of [...userFavs, ...localFavs]) {
    if (!item?.id || seen.has(item.id)) continue;
    seen.add(item.id);
    merged.push(item);
  }
  return merged;
};

// ── Notify all consumers ─────────────────────────────────────

const _notify = () => {
  const snapshot = Object.freeze([..._favourites]);
  for (const fn of _subscribers) {
    try { fn(snapshot); } catch {}
  }
  document.dispatchEvent(
    new CustomEvent('ipordise:favs-changed', { detail: { favourites: snapshot } }),
  );
};

// ── Public read API ──────────────────────────────────────────

/** Returns a snapshot of the current active favourites list. */
export const getFavourites = () => [..._favourites];

/** True after the first Firebase auth state resolution. */
export const isReady = () => _ready;

/**
 * Subscribe to favourites changes.
 * fn is called immediately with the current list, then on every subsequent change.
 * @param {(items: object[]) => void} fn
 * @returns {() => void} unsubscribe function
 */
export const subscribe = (fn) => {
  _subscribers.push(fn);
  fn([..._favourites]);
  return () => { _subscribers = _subscribers.filter((s) => s !== fn); };
};

// ── Mutating API ─────────────────────────────────────────────

/**
 * Toggle a product in/out of the favourites list.
 * Persists to Firestore (logged-in) or localStorage (guest).
 * @param {{ id: string, name: string, brand?: string, price?: string, image?: string }} item
 * @returns {Promise<object[]>} the updated list
 */
export const toggleFavourite = async (item) => {
  if (!item?.id) return getFavourites();
  const exists = _favourites.some((f) => f.id === item.id);
  _favourites = exists
    ? _favourites.filter((f) => f.id !== item.id)
    : [item, ..._favourites];
  await _persist();
  _notify();
  return getFavourites();
};

/**
 * Remove a single favourite by its product id.
 * @param {string} itemId
 * @returns {Promise<object[]>} the updated list
 */
export const removeFavourite = async (itemId) => {
  if (!itemId) return getFavourites();
  _favourites = _favourites.filter((f) => f.id !== itemId);
  await _persist();
  _notify();
  return getFavourites();
};

/**
 * Clear all favourites for the current session (guest or authenticated).
 * @returns {Promise<void>}
 */
export const clearFavourites = async () => {
  _favourites = [];
  await _persist();
  _notify();
};

// ── Internal persistence helper ──────────────────────────────

const _persist = async () => {
  const user = auth.currentUser;
  if (user) {
    await saveUserFavourites(user.uid, _favourites);
    clearGuestFavourites(); // guest list not needed once authenticated
  } else {
    saveGuestFavourites(_favourites);
  }
};

// ── Auth state listener — core synchronisation logic ─────────

onAuthStateChanged(auth, async (user) => {
  if (user) {
    // Logged in: fetch Firestore + local guest items then merge
    const [guestFavs, userFavs] = await Promise.all([
      Promise.resolve(loadGuestFavourites()),
      loadUserFavourites(user.uid),
    ]);
    _favourites = mergeFavourites(guestFavs, userFavs);
    // Persist merged result and clear guest storage
    await saveUserFavourites(user.uid, _favourites);
    clearGuestFavourites();
  } else {
    // Logged out: discard authenticated state, restore guest items only
    _favourites = loadGuestFavourites();
  }
  _ready = true;
  _notify();
});
