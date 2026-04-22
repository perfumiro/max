(function () {
    const CART_STORAGE_KEY = 'cart';
    const LEGACY_CART_STORAGE_KEY = 'ipordise-cart-items';
    const CHECKOUT_ACCESS_KEY = 'ipordise-checkout-access';
    const SHIPPING_MAD = 35;

    /* Promo codes: legacy hardcoded list (fallback only — Firestore is primary) */
    const PROMO_CODES = {};

    const parsePrice = (rawPrice) => {
        if (typeof rawPrice === 'number') return Number.isFinite(rawPrice) ? rawPrice : 0;
        if (typeof rawPrice !== 'string') return 0;

        const value = rawPrice.replace(/[^\d.,]/g, '').trim();
        if (!value) return 0;

        if (value.includes(',') && value.includes('.')) {
            if (value.lastIndexOf(',') > value.lastIndexOf('.')) {
                const normalized = value.replace(/\./g, '').replace(',', '.');
                const parsed = Number(normalized);
                return Number.isFinite(parsed) ? parsed : 0;
            }

            const normalized = value.replace(/,/g, '');
            const parsed = Number(normalized);
            return Number.isFinite(parsed) ? parsed : 0;
        }

        if (value.includes(',')) {
            const parts = value.split(',');
            const normalized = parts[parts.length - 1].length === 3
                ? value.replace(/,/g, '')
                : value.replace(',', '.');
            const parsed = Number(normalized);
            return Number.isFinite(parsed) ? parsed : 0;
        }

        if (value.includes('.')) {
            const parts = value.split('.');
            const normalized = parts.length > 2
                ? `${parts.slice(0, -1).join('')}.${parts[parts.length - 1]}`
                : parts[parts.length - 1].length === 3
                    ? value.replace('.', '')
                    : value;
            const parsed = Number(normalized);
            return Number.isFinite(parsed) ? parsed : 0;
        }

        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    };

    const escapeHtml = (value) => {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    };

    const normalizeItem = (item) => {
        const qty = Math.max(1, Number(item?.qty ?? item?.quantity ?? 1));
        const resolvedPrice = parsePrice(item?.price ?? item?.unitPrice ?? item?.priceText ?? 0);
        const pricePending = Boolean(item?.pricePending ?? item?.onRequest) || resolvedPrice <= 0;
        const normalized = {
            id: String(item?.id ?? item?.sku ?? ''),
            name: String(item?.name ?? item?.title ?? 'Product'),
            price: resolvedPrice,
            image: String(item?.image ?? item?.imageUrl ?? ''),
            size: item?.size ? String(item.size) : '',
            qty: Number.isFinite(qty) ? qty : 1,
            pricePending
        };
        return normalized.id ? normalized : null;
    };

    const readStorageArray = (keyName) => {
        try {
            const raw = localStorage.getItem(keyName);
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            return [];
        }
    };

    const readCart = () => {
        return readStorageArray(CART_STORAGE_KEY)
            .map(normalizeItem)
            .filter(Boolean);
    };

    const writeCart = (items) => {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
        // Update header badge & bottom-nav badge instantly (defined in script.js)
        if (typeof window.setHeaderCartCount === 'function') {
            window.setHeaderCartCount();
        }
    };

    // One-time bridge so previously saved products keep working with the new required "cart" key.
    const migrateLegacyCartIfNeeded = () => {
        const currentCart = readCart();
        const legacyItems = readStorageArray(LEGACY_CART_STORAGE_KEY)
            .map(normalizeItem)
            .filter(Boolean);

        if (!legacyItems.length) return;

        if (!currentCart.length) {
            writeCart(legacyItems);
            return;
        }

        const legacyById = new Map(legacyItems.map((item) => [item.id, item]));
        const legacyByNameSize = new Map(legacyItems.map((item) => [`${item.name}__${item.size}`, item]));
        let hasChanges = false;

        const repairedItems = currentCart.map((item) => {
            if (item.price > 0) return item;

            const sameId = legacyById.get(item.id);
            const sameNameSize = legacyByNameSize.get(`${item.name}__${item.size}`);
            const legacyMatch = sameId || sameNameSize;

            if (legacyMatch && legacyMatch.price > 0) {
                hasChanges = true;
                return { ...item, price: legacyMatch.price };
            }

            return item;
        });

        if (hasChanges) {
            writeCart(repairedItems);
        }
    };

    const formatMAD = (value) => {
        const numericValue = Number(value);
        const safeValue = Number.isFinite(numericValue) ? numericValue : 0;
        const formatter = new Intl.NumberFormat('en-US', {
            minimumFractionDigits: Number.isInteger(safeValue) ? 0 : 2,
            maximumFractionDigits: 2
        });
        return `${formatter.format(safeValue)} MAD`;
    };

    const summarize = (items, appliedDiscount = null) => {
        const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
        let discount = 0;
        if (appliedDiscount) {
            if (appliedDiscount.type === 'percentage') {
                discount = Math.min(Math.round(subtotal * appliedDiscount.value / 100), subtotal);
            } else {
                discount = Math.min(appliedDiscount.value, subtotal);
            }
        }
        const shipping = items.length ? SHIPPING_MAD : 0;
        const hasPendingPricing = items.some((item) => item.pricePending);
        return {
            subtotal,
            discount,
            shipping,
            total: Math.max(0, subtotal - discount) + shipping,
            hasPendingPricing
        };
    };

    const buildCartItemHtml = (item) => {
        const safeId = escapeHtml(item.id);
        const safeName = escapeHtml(item.name);
        const safeImage = escapeHtml(item.image);
        const safeSize = escapeHtml(item.size || '');

        return `
            <article class="cart-card bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 shadow-sm" data-cart-id="${safeId}">
                <div class="flex flex-col sm:flex-row gap-4 sm:gap-5">
                    <img src="${safeImage}" alt="${safeName}" class="cart-item-image w-full sm:w-28 h-28 object-contain bg-brand-light rounded-xl">
                    <div class="flex-1 min-w-0">
                        <div class="flex justify-between gap-3">
                            <div>
                                <h2 class="font-semibold text-brand-dark text-base leading-tight mt-1">${safeName}</h2>
                                ${safeSize ? `<p class="text-xs text-gray-500 mt-1">Size: ${safeSize}</p>` : ''}
                            </div>
                            <button type="button" data-action="remove" data-id="${safeId}" class="cart-remove-btn" aria-label="Remove item">
                                <i class="fas fa-xmark"></i>
                            </button>
                        </div>

                        <div class="mt-4 flex flex-wrap items-center justify-between gap-3">
                            <div class="inline-flex items-center rounded-full border border-gray-200 overflow-hidden">
                                <button type="button" data-action="decrease" data-id="${safeId}" class="cart-qty-btn bg-white text-gray-600 hover:bg-gray-100 hover:text-gray-900" aria-label="Decrease quantity">-</button>
                                <span class="cart-qty-value text-gray-900">${item.qty}</span>
                                <button type="button" data-action="increase" data-id="${safeId}" class="cart-qty-btn bg-white text-gray-600 hover:bg-gray-100 hover:text-gray-900" aria-label="Increase quantity">+</button>
                            </div>

                            <div class="text-right">
                                ${item.pricePending
                                    ? '<p class="text-xs font-semibold text-brand-red">Price confirmed after review</p>'
                                    : `<p class="text-xs text-gray-500">Unit: ${formatMAD(item.price)}</p><p class="text-lg font-bold text-brand-dark">${formatMAD(item.price * item.qty)}</p>`}
                            </div>
                        </div>
                    </div>
                </div>
            </article>
        `;
    };

    const buildEmptyStateHtml = () => {
        return `
            <article class="cart-card bg-white">
                <div class="cart-empty-state">
                    <div class="cart-empty-icon-wrap">
                        <div class="cart-empty-icon"><i class="fas fa-shopping-bag"></i></div>
                    </div>
                    <h2 class="cart-empty-title">Your cart is empty</h2>
                    <p class="cart-empty-subtitle">Discover our exclusive fragrance collection and find your signature scent.</p>
                    <a href="../discover.html" class="cart-empty-cta">
                        <i class="fas fa-arrow-right"></i> Explore Collection
                    </a>
                    <a href="../discover.html" class="cart-empty-back">
                        <i class="fas fa-arrow-left text-xs"></i> Continue Shopping
                    </a>
                </div>
            </article>
        `;
    };

    const initCartPage = () => {
        const cartItemsContainer = document.getElementById('cartItemsContainer');
        if (!cartItemsContainer) return;

        const cartCountText = document.getElementById('cartCountText');
        const subtotalEl = document.getElementById('cartSubtotal');
        const shippingEl = document.getElementById('cartShipping');
        const taxEl = document.getElementById('cartTax');
        const promoEl = document.getElementById('cartPromo');
        const totalEl = document.getElementById('cartTotal');
        const checkoutBtn = document.getElementById('proceedToCheckoutBtn');
        const promoInput = document.getElementById('promoCodeInput');
        const promoApplyBtn = document.getElementById('promoApplyBtn');
        const promoFeedback = document.getElementById('promoFeedback');
        migrateLegacyCartIfNeeded();

        let activePromo = null; // { code, type, value }

        const setCheckoutState = (isEmpty) => {
            if (!checkoutBtn) return;
            checkoutBtn.setAttribute('aria-disabled', String(isEmpty));
            checkoutBtn.classList.toggle('opacity-50', isEmpty);
            checkoutBtn.classList.toggle('cursor-not-allowed', isEmpty);
            if (isEmpty) {
                checkoutBtn.setAttribute('tabindex', '-1');
            } else {
                checkoutBtn.removeAttribute('tabindex');
            }
        };

        const render = () => {
            const items = readCart();
            const totalQty = items.reduce((sum, item) => sum + item.qty, 0);

            if (cartCountText) {
                cartCountText.textContent = items.length
                    ? `${totalQty} product${totalQty > 1 ? 's' : ''} selected for your signature routine.`
                    : '0 products selected. Your cart is empty.';
            }

            cartItemsContainer.innerHTML = items.length
                ? items.map((item) => buildCartItemHtml(item)).join('')
                : buildEmptyStateHtml();

            const summary = summarize(items, activePromo);

            if (subtotalEl) subtotalEl.textContent = summary.hasPendingPricing ? 'Pending confirmation' : formatMAD(summary.subtotal);
            if (shippingEl) shippingEl.textContent = items.length ? `${formatMAD(summary.shipping)} (VAT incl.)` : formatMAD(0);
            if (taxEl) taxEl.textContent = 'Included in shipping';
            if (promoEl) promoEl.textContent = summary.discount > 0 ? `-${formatMAD(summary.discount)}` : '0 MAD';
            if (totalEl) totalEl.textContent = summary.hasPendingPricing ? 'Pending confirmation' : formatMAD(summary.total);

            const isEmpty = items.length === 0;
            setCheckoutState(isEmpty);
        };

        cartItemsContainer.addEventListener('click', (event) => {
            const button = event.target.closest('[data-action]');
            if (!button) return;

            const id = button.getAttribute('data-id');
            const action = button.getAttribute('data-action');
            if (!id || !action) return;

            const items = readCart();
            const index = items.findIndex((item) => item.id === id);
            if (index === -1) return;

            if (action === 'increase') {
                items[index].qty += 1;
            }

            if (action === 'decrease') {
                items[index].qty = Math.max(1, items[index].qty - 1);
            }

            if (action === 'remove') {
                items.splice(index, 1);
            }

            writeCart(items);
            render();
        });

        if (promoApplyBtn && promoInput && promoFeedback) {
            // Auto-uppercase
            promoInput.addEventListener('input', function () {
                this.value = this.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
            });

            const applyPromo = async () => {
                const code = (promoInput.value || '').trim().toUpperCase();
                if (!code) return;

                promoApplyBtn.disabled = true;
                promoApplyBtn.textContent = '…';
                promoFeedback.style.display = 'none';

                try {
                    const { initializeApp, getApps } = await import('https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js');
                    const { getFirestore, doc, getDoc } = await import('https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js');
                    const { firebaseConfig } = await import('../auth/firebase.js');
                    const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
                    const db = getFirestore(app);

                    const snap = await getDoc(doc(db, 'discountCodes', code));
                    if (!snap.exists()) {
                        promoFeedback.textContent = 'Invalid promo code. Please try again.';
                        promoFeedback.style.color = '#dc2626';
                        promoFeedback.style.display = 'block';
                        activePromo = null;
                        sessionStorage.removeItem('ipordise-cart-discount');
                        promoApplyBtn.disabled = false;
                        promoApplyBtn.textContent = 'Apply';
                        render();
                        return;
                    }

                    const dc = snap.data();
                    const now = Date.now();

                    if (dc.active === false) {
                        promoFeedback.textContent = 'This code is currently disabled.';
                        promoFeedback.style.color = '#dc2626';
                        promoFeedback.style.display = 'block';
                        activePromo = null;
                        sessionStorage.removeItem('ipordise-cart-discount');
                        promoApplyBtn.disabled = false;
                        promoApplyBtn.textContent = 'Apply';
                        render();
                        return;
                    }

                    const expiresMs = dc.expiresAt?.toMillis?.() || (dc.expiresAt ? new Date(dc.expiresAt).getTime() : null);
                    if (expiresMs && expiresMs < now) {
                        promoFeedback.textContent = 'This code has expired.';
                        promoFeedback.style.color = '#dc2626';
                        promoFeedback.style.display = 'block';
                        activePromo = null;
                        sessionStorage.removeItem('ipordise-cart-discount');
                        promoApplyBtn.disabled = false;
                        promoApplyBtn.textContent = 'Apply';
                        render();
                        return;
                    }

                    if (dc.usageLimit > 0 && (dc.usedCount || 0) >= dc.usageLimit) {
                        promoFeedback.textContent = 'This code has reached its usage limit.';
                        promoFeedback.style.color = '#dc2626';
                        promoFeedback.style.display = 'block';
                        activePromo = null;
                        sessionStorage.removeItem('ipordise-cart-discount');
                        promoApplyBtn.disabled = false;
                        promoApplyBtn.textContent = 'Apply';
                        render();
                        return;
                    }

                    const items = readCart();
                    const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
                    if (dc.minOrder > 0 && subtotal < dc.minOrder) {
                        promoFeedback.textContent = `Minimum order of ${dc.minOrder} MAD required for this code.`;
                        promoFeedback.style.color = '#dc2626';
                        promoFeedback.style.display = 'block';
                        activePromo = null;
                        sessionStorage.removeItem('ipordise-cart-discount');
                        promoApplyBtn.disabled = false;
                        promoApplyBtn.textContent = 'Apply';
                        render();
                        return;
                    }

                    // ✓ Valid
                    activePromo = { code, type: dc.type, value: dc.value };
                    sessionStorage.setItem('ipordise-cart-discount', JSON.stringify(activePromo));
                    const discountLabel = dc.type === 'percentage' ? `${dc.value}% off` : `${dc.value} MAD off`;
                    promoFeedback.textContent = `✓ Code "${code}" applied — ${discountLabel}!`;
                    promoFeedback.style.color = '#16a34a';
                    promoFeedback.style.display = 'block';
                    promoInput.disabled = true;
                    promoApplyBtn.textContent = 'Applied ✓';
                    promoApplyBtn.disabled = true;
                    promoApplyBtn.style.background = '#16a34a';
                    promoApplyBtn.style.borderColor = '#16a34a';
                    promoApplyBtn.style.color = '#fff';
                    render();
                } catch (err) {
                    promoFeedback.textContent = 'Error checking code. Try again.';
                    promoFeedback.style.color = '#dc2626';
                    promoFeedback.style.display = 'block';
                    promoApplyBtn.disabled = false;
                    promoApplyBtn.textContent = 'Apply';
                }
            };

            promoApplyBtn.addEventListener('click', applyPromo);
            promoInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') applyPromo();
            });
        }

        if (checkoutBtn) {
            checkoutBtn.addEventListener('click', (event) => {
                const hasItems = readCart().length > 0;
                if (!hasItems) {
                    sessionStorage.removeItem(CHECKOUT_ACCESS_KEY);
                    event.preventDefault();
                    return;
                }

                sessionStorage.setItem(CHECKOUT_ACCESS_KEY, '1');
            });
        }

        window.addEventListener('storage', (event) => {
            if (event.key === CART_STORAGE_KEY || event.key === LEGACY_CART_STORAGE_KEY) {
                migrateLegacyCartIfNeeded();
                render();
            }
        });

        render();
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initCartPage);
    } else {
        initCartPage();
    }
})();