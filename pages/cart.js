(function () {
    const CART_STORAGE_KEY = 'cart';
    const LEGACY_CART_STORAGE_KEY = 'ipordise-cart-items';
    const SHIPPING_MAD = 35;

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
        const normalized = {
            id: String(item?.id ?? item?.sku ?? ''),
            name: String(item?.name ?? item?.title ?? 'Product'),
            price: resolvedPrice,
            image: String(item?.image ?? item?.imageUrl ?? ''),
            size: item?.size ? String(item.size) : '',
            qty: Number.isFinite(qty) ? qty : 1
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

    const summarize = (items) => {
        const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
        const shipping = items.length ? SHIPPING_MAD : 0;
        return {
            subtotal,
            shipping,
            total: subtotal + shipping
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
                            <button type="button" data-action="remove" data-id="${safeId}" class="text-gray-400 hover:text-brand-red transition text-sm h-fit" aria-label="Cancel item">
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
                                <p class="text-xs text-gray-500">Unit: ${formatMAD(item.price)}</p>
                                <p class="text-lg font-bold text-brand-dark">${formatMAD(item.price * item.qty)}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </article>
        `;
    };

    const buildEmptyStateHtml = () => {
        return `
            <article class="cart-card bg-white rounded-2xl border border-gray-100 p-6 sm:p-8 shadow-sm text-center">
                <p class="text-lg font-semibold text-brand-dark">Your cart is empty. Start shopping.</p>
                <p class="text-sm text-gray-500 mt-2">Discover our latest fragrances and build your signature routine.</p>
                <a href="../discover.html" class="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-brand-red hover:text-brand-redHover transition">
                    <i class="fas fa-arrow-left text-xs"></i> Continue Shopping
                </a>
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
        migrateLegacyCartIfNeeded();

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

            const summary = summarize(items);

            if (subtotalEl) subtotalEl.textContent = formatMAD(summary.subtotal);
            if (shippingEl) shippingEl.textContent = items.length ? `${formatMAD(summary.shipping)} (VAT incl.)` : formatMAD(0);
            if (taxEl) taxEl.textContent = 'Included in shipping';
            if (promoEl) promoEl.textContent = '0 MAD';
            if (totalEl) totalEl.textContent = formatMAD(summary.total);

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

        if (checkoutBtn) {
            checkoutBtn.addEventListener('click', (event) => {
                if (readCart().length === 0) {
                    event.preventDefault();
                }
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
