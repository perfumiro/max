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
//    On LOGIN  : an existing local `cart` key is authoritative (including an
//                intentionally empty cart); otherwise load the Firestore cart.
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
  const supabaseUrl = 'https://gdgrskgegrcgmzswefmn.supabase.co';
  const publishableKey = 'sb_publishable_XbhrBW9Na65u8EkpgtEz4g_PuYkxs_H';
  const items = Array.isArray(orderData?.items) ? orderData.items : [];
  const customer = orderData?.customer || {};
  const normalizeSize = (value) => String(value || '').toLowerCase().replace(/\s+/g, '').trim();

  try {
    if (!items.length) throw new Error('Your shopping bag is empty.');

    // Resolve the legacy website cart lines to the canonical commerce variants.
    // The server then reloads prices and stock, so browser-provided totals are
    // never trusted and website/mobile orders enter the same database table.
    const variantResponse = await fetch(`${supabaseUrl}/rest/v1/product_variants?select=id,product_id,size_key,size_label,price_minor,stock_quantity,enabled&enabled=eq.true`, {
      headers: { apikey: publishableKey, Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!variantResponse.ok) throw new Error(`Product availability could not be verified (${variantResponse.status}).`);
    const variants = await variantResponse.json();
    const requestedItems = items.map((item) => {
      const productId = String(item.id || '').trim();
      const requestedSize = normalizeSize(item.size);
      const matches = variants.filter((variant) => String(variant.product_id) === productId);
      const variant = matches.find((candidate) => normalizeSize(candidate.size_key) === requestedSize)
        || matches.find((candidate) => normalizeSize(candidate.size_label) === requestedSize)
        || (matches.length === 1 ? matches[0] : null);
      if (!variant) throw new Error(`${item.name || 'A product'} is no longer available in the selected size.`);
      return {
        variantId: variant.id,
        quantity: Math.max(1, Math.min(20, Math.floor(Number(item.qty) || 1))),
        expectedUnitPriceMinor: Math.round(Number(item.price || 0) * 100),
      };
    });

    const idempotencyStorageKey = 'ipordise-checkout-idempotency-v1';
    const fingerprint = JSON.stringify({
      customer: [customer.firstName, customer.lastName, customer.phone, customer.email, customer.address, customer.city],
      items: requestedItems,
      notes: customer.notes || '',
    });
    let pending = null;
    try { pending = JSON.parse(localStorage.getItem(idempotencyStorageKey) || 'null'); } catch {}
    const idempotencyKey = pending?.fingerprint === fingerprint && pending?.key
      ? pending.key
      : (globalThis.crypto?.randomUUID?.() || `website-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    localStorage.setItem(idempotencyStorageKey, JSON.stringify({ fingerprint, key: idempotencyKey }));

    const response = await fetch(`${supabaseUrl}/functions/v1/create-order`, {
      method: 'POST',
      headers: { apikey: publishableKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idempotencyKey,
        customer: {
          name: `${customer.firstName || ''} ${customer.lastName || ''}`.trim(),
          phone: String(customer.phone || '').trim(),
          email: String(customer.email || '').trim().toLowerCase() || null,
          city: String(customer.city || '').trim(),
          address: String(customer.address || '').trim(),
        },
        items: requestedItems,
        notes: String(customer.notes || '').trim() || null,
        source: 'website',
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `Order could not be saved (${response.status}).`);
    const orderNumber = String(result.orderNumber || result.order_number || '').trim();
    if (!orderNumber) throw new Error('The order server did not return an order number.');
    localStorage.removeItem(idempotencyStorageKey);
    return orderNumber;
  } catch (err) {
    console.error('[IPORDISE] saveGlobalOrder failed:', err);
    throw err;
  }
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
  // Ignore anonymous users created by analytics — they are not real accounts
  if (user && !user.isAnonymous) {
    // Never merge deleted local lines back from an older cloud copy. The
    // presence of the canonical key distinguishes an intentional empty cart
    // from a browser that has never loaded a cart.
    const hasLocalCart = localStorage.getItem(CART_KEY) !== null;
    const [serverCart, localCart] = await Promise.all([
      _loadUserCart(user.uid),
      Promise.resolve(_readLocalCart()),
    ]);
    const resolvedCart = hasLocalCart ? localCart : serverCart;
    _writeLocalCart(resolvedCart);
    await _saveUserCart(user.uid, resolvedCart);

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
