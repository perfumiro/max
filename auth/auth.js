// ================================================================
// IPORDISE — Authentication Module (Firebase v10 Modular SDK)
// ================================================================
//
//  Exports:
//    signUp(email, password, displayName?)  → creates new account
//    signIn(email, password)                → email/password login
//    googleSignIn()                         → Google OAuth popup
//    logOut()                               → signs out current user
//    onAuthChange(callback)                 → auth state observer
//    requireAuth(loginUrl?)                 → guard: redirect if NOT logged in
//    redirectIfAuth(dashboardUrl?)          → guard: redirect if ALREADY logged in
//    getErrorMessage(error)                 → friendly error string
//
// ================================================================

import { auth } from './firebase.js';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
} from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js';

// ── Human-readable error messages ────────────────────────────
const FIREBASE_ERRORS = {
  'auth/email-already-in-use':     'An account already exists with this email. Please sign in instead.',
  'auth/invalid-email':            'The email address is not valid. Please check it and try again.',
  'auth/user-not-found':           'No account found with that email. Please create an account first.',
  'auth/wrong-password':           'Incorrect password. Please try again or reset your password.',
  'auth/invalid-credential':       'Incorrect email or password. Please try again.',
  'auth/weak-password':            'Password is too weak. Please use at least 6 characters.',
  'auth/too-many-requests':        'Too many failed attempts. Please wait a moment, then try again.',
  'auth/network-request-failed':   'Network error. Please check your connection and try again.',
  'auth/popup-closed-by-user':     'Sign-in popup was closed before completing. Please try again.',
  'auth/cancelled-popup-request':  'Only one sign-in popup can be open at a time.',
  'auth/popup-blocked':            'Popup blocked by your browser. Please allow popups for this site.',
  'auth/account-exists-with-different-credential':
    'An account already exists with this email using a different sign-in method.',
};

/**
 * Returns a user-friendly message for a Firebase auth error.
 * @param {Error} error
 * @returns {string}
 */
export const getErrorMessage = (error) =>
  FIREBASE_ERRORS[error?.code] || error?.message || 'Something went wrong. Please try again.';

// ── Email / Password — Create account ────────────────────────
/**
 * Creates a new Firebase user with email & password.
 * Optionally sets a display name on the profile.
 * @param {string} email
 * @param {string} password
 * @param {string} [displayName]
 * @returns {Promise<import('firebase/auth').User>}
 */
export async function signUp(email, password, displayName = '') {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName.trim()) {
    await updateProfile(credential.user, { displayName: displayName.trim() });
  }
  return credential.user;
}

// ── Email / Password — Sign in ───────────────────────────────
/**
 * Signs in an existing user with email & password.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<import('firebase/auth').User>}
 */
export async function signIn(email, password) {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

// ── Google OAuth — Sign in ───────────────────────────────────
/**
 * Opens a Google sign-in popup.
 * Always prompts the account picker so users can switch accounts.
 * @returns {Promise<import('firebase/auth').User>}
 */
export async function googleSignIn() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const credential = await signInWithPopup(auth, provider);
  return credential.user;
}

// ── Sign out ─────────────────────────────────────────────────
/**
 * Signs out the currently authenticated user.
 * @returns {Promise<void>}
 */
export async function logOut() {
  await signOut(auth);
}

// ── Auth state observer ───────────────────────────────────────
/**
 * Subscribes to Firebase auth state changes.
 * @param {(user: import('firebase/auth').User | null) => void} callback
 * @returns {() => void} unsubscribe function
 */
export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

// ── Route guard: require authentication ──────────────────────
/**
 * Redirects to `loginUrl` if no user is authenticated.
 * Call once at the top of every protected page.
 * @param {string} [loginUrl='../pages/login.html']
 * @returns {() => void} unsubscribe function
 */
export function requireAuth(loginUrl = '../pages/login.html') {
  return onAuthStateChanged(auth, (user) => {
    if (!user) window.location.replace(loginUrl);
  });
}

// ── Route guard: redirect if already authenticated ────────────
/**
 * Redirects to `dashboardUrl` if a user is already signed in.
 * Use on login / register pages to skip them for logged-in users.
 * @param {string} [dashboardUrl='../pages/dashboard.html']
 * @returns {() => void} unsubscribe function
 */
export function redirectIfAuth(dashboardUrl = '../pages/dashboard.html') {
  return onAuthStateChanged(auth, (user) => {
    if (user) window.location.replace(dashboardUrl);
  });
}
