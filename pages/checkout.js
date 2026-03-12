(function () {
    const CART_STORAGE_KEY = 'cart';
    const LEGACY_CART_STORAGE_KEY = 'ipordise-cart-items';
    const CHECKOUT_ACCESS_KEY = 'ipordise-checkout-access';
    const ORDER_CONFIRM_PENDING_KEY = 'ipordise-order-confirm-pending';
    const ORDER_CONFIRM_LEFT_PAGE_KEY = 'ipordise-order-confirm-left-page';
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

    const formatMAD = (value) => {
        const amount = Number(value);
        const safe = Number.isFinite(amount) ? amount : 0;
        const formatter = new Intl.NumberFormat('en-US', {
            minimumFractionDigits: Number.isInteger(safe) ? 0 : 2,
            maximumFractionDigits: 2
        });
        return `${formatter.format(safe)} MAD`;
    };

    const escapeHtml = (value) => String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const readStorageArray = (keyName) => {
        try {
            const raw = localStorage.getItem(keyName);
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            return [];
        }
    };

    const normalizeItem = (item) => {
        const qty = Math.max(1, Number(item?.qty ?? item?.quantity ?? 1));
        const price = parsePrice(item?.price ?? item?.unitPrice ?? item?.priceText ?? 0);
        const pricePending = Boolean(item?.pricePending ?? item?.onRequest) || price <= 0;
        const id = String(item?.id ?? item?.sku ?? '');
        if (!id) return null;

        return {
            id,
            name: String(item?.name ?? item?.title ?? 'Product'),
            size: item?.size ? String(item.size) : '',
            qty: Number.isFinite(qty) ? qty : 1,
            price,
            pricePending
        };
    };

    const readCart = () => {
        const primary = readStorageArray(CART_STORAGE_KEY).map(normalizeItem).filter(Boolean);
        if (primary.length) return primary;

        const legacy = readStorageArray(LEGACY_CART_STORAGE_KEY).map(normalizeItem).filter(Boolean);
        if (legacy.length) {
            localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(legacy));
        }
        return legacy;
    };

    const hasCheckoutAccess = () => sessionStorage.getItem(CHECKOUT_ACCESS_KEY) === '1';

    const readCheckoutCart = () => {
        if (!hasCheckoutAccess()) return [];
        return readCart();
    };

    const summarize = (items) => {
        const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
        const shipping = items.length ? SHIPPING_MAD : 0;
        const hasPendingPricing = items.some((item) => item.pricePending);
        return {
            subtotal,
            shipping,
            total: subtotal + shipping,
            hasPendingPricing
        };
    };

    const initCheckoutPage = () => {
        const isCheckoutPage = window.location.pathname.replace(/\\/g, '/').endsWith('/pages/checkout.html');
        if (!isCheckoutPage) return;

        const form = document.getElementById('checkoutBillingForm');
        const placeOrderBtn = document.getElementById('placeOrderBtn');
        const validationMsg = document.getElementById('checkoutValidationMessage');
        const legalConsentEl = document.getElementById('checkoutLegalConsent');
        const legalConsentMessageEl = document.getElementById('checkoutLegalConsentMessage');
        const confirmOptions = document.getElementById('orderConfirmOptions');
        const confirmWhatsApp = document.getElementById('confirmWhatsApp');
        const confirmEmail = document.getElementById('confirmEmail');
        const orderItemsEl = document.getElementById('checkoutOrderItems');

        if (!form || !placeOrderBtn || !validationMsg || !confirmOptions || !orderItemsEl || !confirmWhatsApp || !confirmEmail || !legalConsentEl || !legalConsentMessageEl) return;

        const requiredFields = [
            document.getElementById('billingFirstName'),
            document.getElementById('billingLastName'),
            document.getElementById('billingAddress'),
            document.getElementById('billingCity'),
            document.getElementById('billingPhone')
        ].filter(Boolean);

        const subtotalEl = document.getElementById('checkoutSubtotal');
        const shippingEl = document.getElementById('checkoutShipping');
        const promoEl = document.getElementById('checkoutPromo');
        const totalEl = document.getElementById('checkoutTotal');

        const renderOrder = () => {
            const items = readCheckoutCart();

            orderItemsEl.innerHTML = items.length
                ? items.map((item) => {
                    const safeName = escapeHtml(item.name);
                    const safeSize = escapeHtml(item.size || '-');
                    return `
                        <div class="flex items-start justify-between gap-3 pb-3 border-b border-gray-100">
                            <div>
                                <p class="font-semibold text-gray-800">${safeName}</p>
                                <p class="text-xs text-gray-500">${safeSize} · Qty ${item.qty}</p>
                            </div>
                            <span class="font-semibold">${item.pricePending ? 'Pending confirmation' : formatMAD(item.price * item.qty)}</span>
                        </div>
                    `;
                }).join('')
                : '<p class="text-sm text-gray-500 pb-3 border-b border-gray-100">No items in cart yet.</p>';

            const summary = summarize(items);
            if (subtotalEl) subtotalEl.textContent = summary.hasPendingPricing ? 'Pending confirmation' : formatMAD(summary.subtotal);
            if (shippingEl) shippingEl.textContent = summary.shipping ? `${formatMAD(summary.shipping)} (VAT incl.)` : formatMAD(0);
            if (promoEl) promoEl.textContent = '0 MAD';
            if (totalEl) totalEl.textContent = summary.hasPendingPricing ? 'Pending confirmation' : formatMAD(summary.total);
        };

        const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
        const isValidPhone = (value) => {
            const digits = value.replace(/\D/g, '');
            return digits.length >= 9;
        };

        const buildConfirmationPayload = () => {
            const items = readCheckoutCart();
            const summary = summarize(items);

            const firstName = (document.getElementById('billingFirstName')?.value || '').trim();
            const lastName = (document.getElementById('billingLastName')?.value || '').trim();
            const address = (document.getElementById('billingAddress')?.value || '').trim();
            const city = (document.getElementById('billingCity')?.value || '').trim();
            const phone = (document.getElementById('billingPhone')?.value || '').trim();
            const email = (document.getElementById('billingEmail')?.value || '').trim();

            const orderLines = items.map((item, index) => {
                const amountText = item.pricePending ? 'Price confirmed after review' : formatMAD(item.price * item.qty);
                return `${index + 1}. ${item.name} (${item.size || '-'}) x${item.qty} - ${amountText}`;
            }).join('\n');

            const bodyText = [
                'Hello IPORDISE, I want to confirm my order.',
                '',
                'Customer Information',
                `Name: ${firstName} ${lastName}`.trim(),
                `Phone: ${phone}`,
                `Email: ${email}`,
                `Address: ${address}, ${city}, Morocco`,
                '',
                'Order Details',
                orderLines || '- No items -',
                '',
                `Subtotal: ${summary.hasPendingPricing ? 'Pending confirmation' : formatMAD(summary.subtotal)}`,
                `Shipping: ${summary.shipping ? `${formatMAD(summary.shipping)} (VAT incl.)` : formatMAD(0)}`,
                `Total: ${summary.hasPendingPricing ? 'Pending confirmation' : formatMAD(summary.total)}`
            ].join('\n');

            return bodyText;
        };

        const updateConfirmationLinks = () => {
            const messageBody = buildConfirmationPayload();
            const encodedBody = encodeURIComponent(messageBody);
            const encodedSubject = encodeURIComponent('IPORDISE Order Confirmation');

            confirmWhatsApp.href = `https://wa.me/212600000000?text=${encodedBody}`;
            confirmEmail.href = `mailto:orders@ipordise.com?subject=${encodedSubject}&body=${encodedBody}`;
        };

        const markConfirmationPending = (channel) => {
            const payload = {
                channel,
                at: Date.now()
            };
            sessionStorage.setItem(ORDER_CONFIRM_PENDING_KEY, JSON.stringify(payload));
            sessionStorage.removeItem(ORDER_CONFIRM_LEFT_PAGE_KEY);
        };

        const readPendingConfirmation = () => {
            try {
                const raw = sessionStorage.getItem(ORDER_CONFIRM_PENDING_KEY);
                return raw ? JSON.parse(raw) : null;
            } catch (error) {
                return null;
            }
        };

        const clearPendingConfirmation = () => {
            sessionStorage.removeItem(ORDER_CONFIRM_PENDING_KEY);
            sessionStorage.removeItem(ORDER_CONFIRM_LEFT_PAGE_KEY);
        };

        const handleReturnAfterConfirmation = () => {
            const pending = readPendingConfirmation();
            const leftPage = sessionStorage.getItem(ORDER_CONFIRM_LEFT_PAGE_KEY) === '1';
            if (!pending || !leftPage) return;

            const channelParam = encodeURIComponent(pending.channel || 'confirmation');
            clearPendingConfirmation();
            window.location.href = `thank-you.html?channel=${channelParam}`;
        };

        const checkFormValidity = () => {
            const cartHasItems = readCheckoutCart().length > 0;

            const firstName = (document.getElementById('billingFirstName')?.value || '').trim();
            const lastName = (document.getElementById('billingLastName')?.value || '').trim();
            const address = (document.getElementById('billingAddress')?.value || '').trim();
            const city = (document.getElementById('billingCity')?.value || '').trim();
            const phone = document.getElementById('billingPhone')?.value || '';
            const email = document.getElementById('billingEmail')?.value || '';
            const hasLegalConsent = legalConsentEl.checked;

            const fieldsFilled = firstName && lastName && address && city;
            const normalizedEmail = email.trim();
            const emailValidIfProvided = !normalizedEmail || isValidEmail(normalizedEmail);
            const contactValid = isValidPhone(phone) && emailValidIfProvided;
            const isReady = Boolean(cartHasItems && fieldsFilled && contactValid && hasLegalConsent);

            placeOrderBtn.disabled = !isReady;
            placeOrderBtn.setAttribute('aria-disabled', String(!isReady));
            placeOrderBtn.classList.toggle('opacity-50', !isReady);
            placeOrderBtn.classList.toggle('cursor-not-allowed', !isReady);
            legalConsentMessageEl.classList.add('hidden');

            if (!cartHasItems) {
                validationMsg.textContent = 'Your cart is empty. Add items before placing your order.';
                confirmOptions.classList.add('hidden');
                return;
            }

            if (!fieldsFilled) {
                validationMsg.textContent = 'Please complete all required billing fields.';
                confirmOptions.classList.add('hidden');
                return;
            }

            if (!isValidPhone(phone)) {
                validationMsg.textContent = 'Please enter a valid phone number (at least 9 digits).';
                confirmOptions.classList.add('hidden');
                return;
            }

            if (normalizedEmail && !isValidEmail(normalizedEmail)) {
                validationMsg.textContent = 'Email is optional, but if provided it must be valid.';
                confirmOptions.classList.add('hidden');
                return;
            }

            if (!hasLegalConsent) {
                validationMsg.textContent = 'Please accept the Privacy Policy and Terms & Conditions to continue.';
                legalConsentMessageEl.classList.remove('hidden');
                confirmOptions.classList.add('hidden');
                return;
            }

            validationMsg.textContent = 'Perfect. You can now place your order and choose your confirmation method.';
            updateConfirmationLinks();
            confirmOptions.classList.remove('hidden');
        };

        form.addEventListener('submit', (event) => {
            event.preventDefault();
        });

        requiredFields.forEach((field) => {
            field.addEventListener('input', checkFormValidity);
            field.addEventListener('blur', checkFormValidity);
        });

        legalConsentEl.addEventListener('change', checkFormValidity);

        window.addEventListener('storage', (event) => {
            if (event.key === CART_STORAGE_KEY || event.key === LEGACY_CART_STORAGE_KEY) {
                renderOrder();
                checkFormValidity();
            }
        });

        window.addEventListener('pageshow', () => {
            renderOrder();
            checkFormValidity();
        });

        placeOrderBtn.addEventListener('click', () => {
            if (placeOrderBtn.disabled) return;
            updateConfirmationLinks();
            confirmOptions.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });

        confirmWhatsApp.addEventListener('click', () => {
            updateConfirmationLinks();
            markConfirmationPending('whatsapp');
        });

        confirmEmail.addEventListener('click', () => {
            updateConfirmationLinks();
            markConfirmationPending('email');
        });

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                if (readPendingConfirmation()) {
                    sessionStorage.setItem(ORDER_CONFIRM_LEFT_PAGE_KEY, '1');
                }
                return;
            }

            handleReturnAfterConfirmation();
        });

        window.addEventListener('focus', handleReturnAfterConfirmation);
        window.addEventListener('pageshow', handleReturnAfterConfirmation);

        renderOrder();
        checkFormValidity();
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initCheckoutPage);
    } else {
        initCheckoutPage();
    }
})();
