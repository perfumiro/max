// ================================================================
// IPORDISE — Account Header Auth Bridge
// Makes the header account menu auth-aware on ALL pages.
// Loaded dynamically by applyOfficialHeaderFooter() in script.js.
// ================================================================

import { onAuthChange, logOut } from './auth.js';

const WISHLIST_KEY = 'ipordise-wishlist-items';

const getWishlistCount = () => {
    try {
        const raw    = localStorage.getItem(WISHLIST_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed.length : 0;
    } catch { return 0; }
};

// Determine root-relative path prefix based on current page location
const getRootPrefix = () => {
    const p = window.location.pathname.replace(/\\/g, '/');
    return (p.includes('/pages/') || p.includes('/auth/')) ? '../' : '';
};

const getLoginPath  = () => `${getRootPrefix()}pages/login.html`;
const getDashPath   = () => `${getRootPrefix()}pages/dashboard.html`;

// ── HTML builders ────────────────────────────────────────────
const buildLoggedInHTML = (user) => {
    const name    = (user.displayName || user.email.split('@')[0]).trim();
    const initial = name.charAt(0).toUpperCase();
    const dash    = getDashPath();
    const wl      = getWishlistCount();
    return `
        <div class="acm-user-row">
            <div class="acm-avatar">${initial}</div>
            <div class="acm-user-info">
                <div class="acm-user-name">${name}</div>
                <div class="acm-user-email">${user.email}</div>
            </div>
        </div>
        <div class="acm-links">
            <a href="${dash}" class="acm-link">
                <i class="fas fa-grid-2"></i><span>My Dashboard</span>
            </a>
            <a href="${dash}#section-orders" class="acm-link">
                <i class="fas fa-bag-shopping"></i><span>My Orders</span>
            </a>
            <a href="${dash}#section-profile" class="acm-link">
                <i class="fas fa-user"></i><span>My Profile</span>
            </a>
        </div>
        ${wl > 0 ? `
        <div class="acm-wishlist-row">
            <i class="fas fa-heart"></i>
            <span>Wishlist &mdash; <strong>${wl} saved item${wl !== 1 ? 's' : ''}</strong></span>
        </div>` : ''}
        <button class="acm-signout-btn" type="button">
            <i class="fas fa-arrow-right-from-bracket"></i> Sign out
        </button>
    `;
};

const buildLoggedOutHTML = () => {
    const login = getLoginPath();
    return `
        <div class="account-menu-head">
            <i class="far fa-user"></i>
            <span>Welcome to <strong>IPORDISE</strong></span>
        </div>
        <p class="account-menu-subtitle">Sign in to track orders, save favourites &amp; more.</p>
        <div class="account-menu-actions">
            <a href="${login}" class="account-menu-btn account-menu-btn-login">Sign in</a>
            <a href="${login}?tab=signup" class="account-menu-btn account-menu-btn-signup">Register</a>
        </div>
        <div class="account-menu-row">
            <i class="fas fa-bolt"></i>
            <span>Exclusive member offers await</span>
        </div>
        <div class="account-menu-row">
            <i class="fas fa-truck"></i>
            <span>Free delivery from 500 DH</span>
        </div>
    `;
};

// ── Attach sign-out handler ──────────────────────────────────
const attachSignOut = (inner) => {
    inner.querySelector('.acm-signout-btn')?.addEventListener('click', async (e) => {
        e.currentTarget.disabled = true;
        try { await logOut(); } catch { /* ignore */ }
        window.location.reload();
    });
};

// ── Update every .account-menu-inner on the page ─────────────
const updateMenus = (user) => {
    document.querySelectorAll('.account-menu-inner').forEach((inner) => {
        if (user) {
            inner.innerHTML = buildLoggedInHTML(user);
            attachSignOut(inner);
        } else {
            inner.innerHTML = buildLoggedOutHTML();
        }

        // Reflect logged-in state on the trigger icon (turn red when signed in)
        const wrap    = inner.closest('.header-account-wrap');
        const trigger = wrap?.querySelector('[aria-label="Account"]');
        if (trigger) {
            trigger.classList.toggle('text-brand-red', !!user);
        }
    });
};

// ── Subscribe to Firebase auth state ─────────────────────────
onAuthChange((user) => {
    // Expose globally so non-module scripts (script.js) can read auth state
    window.__ipordise_user = user;
    updateMenus(user);
});
