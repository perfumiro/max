// ================================================================
// IPORDISE — User Data Sync (Firebase Firestore)
// ================================================================
//
//  Handles persistent cloud storage for authenticated users:
//    • Profile  → users/{uid}.profile
//    • Cart     → users/{uid}.cart   (synced from/to localStorage)
//    • Orders   → users/{uid}/orders/{orderId}  (subcollection)
//
//  Cart sync strategy:
//    On LOGIN  : load Firestore cart + local cart, merge, write to
//                localStorage so existing IIFE scripts keep working.
//    On CHANGE : localStorage.setItem is patched (once) to auto-save
//                the 'cart' key to Firestore whenever it is updated.
//    On LOGOUT : Firestore sync stops; local cart is untouched.
//
//  Exported API:
//    loadUserProfile(uid)           → Promise<{}>
//    saveUserProfile(uid, data)     → Promise<void>
//    saveUserOrder(uid, orderData)  → Promise<string|null>  (order id)
//    loadUserOrders(uid)            → Promise<order[]>
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
  collection,
  addDoc,
  query,
  orderBy,
  getDocs,
  serverTimestamp,
  runTransaction,
  increment,
  where,
} from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js';

// ── localStorage cart keys ───────────────────────────────────────
const CART_KEY        = 'cart';
const LEGACY_CART_KEY = 'ipordise-cart-items';

// ── Debounce helper ──────────────────────────────────────────────
const _debounce = (fn, delay) => {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
};

// ── localStorage cart read / write ──────────────────────────────
const _readLocalCart = () => {
  try {
    const raw    = localStorage.getItem(CART_KEY) || localStorage.getItem(LEGACY_CART_KEY) || '[]';
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
};

const _writeLocalCart = (items) => {
  try { localStorage.setItem(CART_KEY, JSON.stringify(items)); } catch {}
};

// ── Cart merge (server wins on qty conflicts) ────────────────────
const _mergeCart = (serverItems, localItems) => {
  if (!Array.isArray(serverItems)) serverItems = [];
  if (!Array.isArray(localItems))  localItems  = [];
  if (!serverItems.length && !localItems.length) return [];

  const map = new Map();
  for (const item of serverItems) {
    const key = `${item.id || ''}__${item.size || ''}`;
    if (key !== '__') map.set(key, { ...item });
  }
  for (const item of localItems) {
    const key = `${item.id || ''}__${item.size || ''}`;
    if (key === '__') continue;
    if (!map.has(key)) {
      map.set(key, item);
    } else {
      // Take higher quantity
      const existing = map.get(key);
      existing.qty = Math.max(Number(existing.qty) || 1, Number(item.qty) || 1);
    }
  }
  return Array.from(map.values());
};

// ── Firestore: profile ───────────────────────────────────────────

/**
 * Load the user's saved profile fields from Firestore.
 * @param {string} uid
 * @returns {Promise<{phone?:string, city?:string, address?:string, firstName?:string, lastName?:string}>}
 */
export const loadUserProfile = async (uid) => {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return {};
    return snap.data().profile || {};
  } catch { return {}; }
};

/**
 * Save profile fields to Firestore (merges with existing data).
 * @param {string} uid
 * @param {{phone?:string, city?:string, address?:string, firstName?:string, lastName?:string}} profile
 * @returns {Promise<void>}
 */
export const saveUserProfile = async (uid, profile) => {
  try {
    await setDoc(doc(db, 'users', uid), { profile }, { merge: true });
  } catch {}
};

// ── Firestore: cart ──────────────────────────────────────────────

const _loadUserCart = async (uid) => {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return [];
    const data = snap.data();
    return Array.isArray(data.cart) ? data.cart : [];
  } catch { return []; }
};

const _saveUserCart = async (uid, items) => {
  try {
    await setDoc(doc(db, 'users', uid), { cart: items }, { merge: true });
  } catch {}
};

// ── Firestore: orders ────────────────────────────────────────────

/**
 * Save a new order document to users/{uid}/orders.
 * @param {string} uid
 * @param {object} orderData - { items, customer, summary, channel }
 * @returns {Promise<string|null>}  Firestore document id or null on error
 */
export const saveUserOrder = async (uid, orderData) => {
  try {
    const ref = await addDoc(collection(db, 'users', uid, 'orders'), {
      ...orderData,
      createdAt: serverTimestamp(),
      status:    'pending',
    });
    return ref.id;
  } catch { return null; }
};

/**
 * Load all orders for the user, sorted newest first.
 * @param {string} uid
 * @returns {Promise<Array>}
 */
export const loadUserOrders = async (uid) => {
  try {
    const q    = query(collection(db, 'users', uid, 'orders'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      // Convert Firestore Timestamp → JS Date string
      const createdAt = data.createdAt?.toDate?.() || null;
      return { id: d.id, ...data, createdAt };
    });
  } catch { return []; }
};

// ── Firestore: global orders collection (guest + logged-in) ─────

/**
 * Generate the next sequential human-readable order ID.
 * Format: IPD-YYYY-NNNNN  e.g. IPD-2026-00042
 * Uses a Firestore counter document to guarantee uniqueness.
 * @returns {Promise<string>}
 */
const _generateOrderId = async () => {
  const year = new Date().getFullYear();
  const counterRef = doc(db, 'order_counter', String(year));
  let seq = 1;
  try {
    seq = await runTransaction(db, async (tx) => {
      const snap = await tx.get(counterRef);
      const next = snap.exists() ? (snap.data().seq || 0) + 1 : 1;
      tx.set(counterRef, { seq: next }, { merge: true });
      return next;
    });
  } catch { seq = Math.floor(Math.random() * 90000) + 10000; }
  return `IPD-${year}-${String(seq).padStart(5, '0')}`;
};

/**
 * Save an order to the global `orders` collection.
 * Works for both guests and authenticated users.
 * @param {object} orderData - { items, customer, summary, channel, uid? }
 * @returns {Promise<string|null>} Human-readable order ID (e.g. IPD-2026-00042)
 */
export const saveGlobalOrder = async (orderData) => {
  try {
    const orderId = await _generateOrderId();
    await setDoc(doc(db, 'orders', orderId), {
      ...orderData,
      orderId,
      createdAt: serverTimestamp(),
      status: 'pending',
    });
    return orderId;
  } catch { return null; }
};

/**
 * Load a single order from the global orders collection by its human-readable ID.
 * Verifies ownership by matching the customer phone or email.
 * @param {string} orderId
 * @param {string} contact - phone or email provided by the customer
 * @returns {Promise<object|null>}
 */
export const lookupOrder = async (orderId, contact) => {
  try {
    const snap = await getDoc(doc(db, 'orders', orderId.toUpperCase().trim()));
    if (!snap.exists()) return null;
    const data = snap.data();
    const c = data.customer || {};
    const normalContact = contact.trim().toLowerCase().replace(/\s/g, '');
    const matchPhone = (c.phone || '').replace(/\D/g, '').endsWith(normalContact.replace(/\D/g, ''));
    const matchEmail = (c.email || '').toLowerCase() === normalContact;
    if (!matchPhone && !matchEmail) return null;
    return {
      ...data,
      id: snap.id,
      createdAt: data.createdAt?.toDate?.() || null,
    };
  } catch { return null; }
};

/**
 * Load all orders from the global orders collection (admin use).
 * Sorted newest first.
 * @returns {Promise<Array>}
 */
export const loadAllOrders = async () => {
  try {
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      return { ...data, id: d.id, createdAt: data.createdAt?.toDate?.() || null };
    });
  } catch { return []; }
};

/**
 * Update the status of an order (admin only).
 * @param {string} orderId
 * @param {string} status - 'pending'|'processing'|'shipped'|'delivered'|'cancelled'
 * @param {string=} trackingNumber
 * @returns {Promise<boolean>}
 */
export const updateOrderStatus = async (orderId, status, trackingNumber) => {
  try {
    const update = { status };
    if (trackingNumber) update.trackingNumber = trackingNumber;
    await setDoc(doc(db, 'orders', orderId), update, { merge: true });
    return true;
  } catch { return false; }
};

// ── localStorage.setItem patch (cart auto-sync) ──────────────────
let _patchedLocalStorage = false;
const _debouncedCartSync = _debounce((uid) => {
  _saveUserCart(uid, _readLocalCart());
}, 1200);

const _activateCartSync = () => {
  if (_patchedLocalStorage) return;
  _patchedLocalStorage = true;
  const _origSetItem = localStorage.setItem.bind(localStorage);
  localStorage.setItem = (key, value) => {
    _origSetItem(key, value);
    // Sync to Firestore whenever the cart key is updated
    const user = auth.currentUser;
    if (user && (key === CART_KEY || key === LEGACY_CART_KEY)) {
      _debouncedCartSync(user.uid);
    }
  };
};

// ── Auth state observer ──────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  if (user) {
    // Merge Firestore cart with any local cart
    const [serverCart, localCart] = await Promise.all([
      _loadUserCart(user.uid),
      Promise.resolve(_readLocalCart()),
    ]);
    const merged = _mergeCart(serverCart, localCart);
    _writeLocalCart(merged);
    if (merged.length) await _saveUserCart(user.uid, merged);

    // Activate cart auto-sync (patches localStorage.setItem once)
    _activateCartSync();

    // Expose cart/order helpers globally for non-module scripts
    window.__ipordise_ud = {
      uid:       user.uid,
      saveCart:  ()     => _saveUserCart(user.uid, _readLocalCart()),
      saveOrder: (data) => saveUserOrder(user.uid, data),
    };

    // Dispatch event so other module scripts can react
    document.dispatchEvent(new CustomEvent('ipordise:user-ready', { detail: { uid: user.uid } }));
  } else {
    window.__ipordise_user = null;
  }
});
