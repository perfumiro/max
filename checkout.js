(function () {
    /* ── i18n helper ── */
    const t = (key, fallback) => {
        const val = window.__i18n?.translate(key);
        return val || fallback;
    };

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
        const hasDecimals = Math.abs(safe % 1) > 0.001;
        const formatter = new Intl.NumberFormat('fr-FR', {
            minimumFractionDigits: hasDecimals ? 2 : 0,
            maximumFractionDigits: 2
        });
        return `${formatter.format(safe)} DH`;
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

    const readCheckoutCart = () => {
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
        const isCheckoutPage = window.location.pathname.replace(/\\/g, '/').endsWith('/checkout.html');
        if (!isCheckoutPage) return;

        const form = document.getElementById('checkoutBillingForm');
        const placeOrderBtn = document.getElementById('placeOrderBtn');
        const validationMsg = document.getElementById('checkoutValidationMessage');

        const confirmOptions = document.getElementById('orderConfirmOptions');
        const confirmWhatsApp = document.getElementById('confirmWhatsApp');
        const orderItemsEl = document.getElementById('checkoutOrderItems');

        if (!form || !placeOrderBtn || !validationMsg || !confirmOptions || !orderItemsEl || !confirmWhatsApp) return;

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

            const qtyLabel   = t('checkout.dyn.qty',     'Qty');
            const pendingTxt = t('checkout.dyn.pending',  'Pending confirmation');
            const vatTxt     = t('checkout.dyn.vat_incl', '(VAT incl.)');
            const noItemsTxt = t('checkout.dyn.no_items', 'No items in cart yet.');

            orderItemsEl.innerHTML = items.length
                ? items.map((item) => {
                    const safeName = escapeHtml(item.name);
                    const safeSize = escapeHtml(item.size || '-');
                    return `
                        <div class="flex items-start justify-between gap-3 pb-3 border-b border-gray-100">
                            <div>
                                <p class="font-semibold text-gray-800">${safeName}</p>
                                <p class="text-xs text-gray-500">${safeSize} · ${qtyLabel} ${item.qty}</p>
                            </div>
                            <span class="font-semibold">${item.pricePending ? pendingTxt : formatMAD(item.price * item.qty)}</span>
                        </div>
                    `;
                }).join('')
                : `<p class="text-sm text-gray-500 pb-3 border-b border-gray-100">${noItemsTxt}</p>`;

            const summary = summarize(items);
            if (subtotalEl) subtotalEl.textContent = summary.hasPendingPricing ? pendingTxt : formatMAD(summary.subtotal);
            if (shippingEl) shippingEl.textContent = summary.shipping ? `${formatMAD(summary.shipping)} ${vatTxt}` : formatMAD(0);
            if (promoEl) promoEl.textContent = '0 MAD';
            if (totalEl) totalEl.textContent = summary.hasPendingPricing ? pendingTxt : formatMAD(summary.total);
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
            const notes = (document.getElementById('orderNotes')?.value || '').trim();

            const orderLines = items.map((item, index) => {
                const amountText = item.pricePending ? 'Prix confirmé après vérification' : formatMAD(item.price * item.qty);
                return `${index + 1}. ${item.name} (${item.size || '-'}) x${item.qty} - ${amountText}`;
            }).join('\n');

            const bodyText = [
                'Bonjour IPORDISE, je souhaite confirmer ma commande.',
                '',
                '--- Informations client ---',
                `Nom : ${firstName} ${lastName}`.trim(),
                `Telephone : ${phone}`,
                `E-mail : ${email}`,
                `Adresse : ${address}, ${city}, Maroc`,
                '',
                '--- Details de la commande ---',
                orderLines || '- Aucun article -',
                '',
                `Sous-total : ${summary.hasPendingPricing ? 'En attente de confirmation' : formatMAD(summary.subtotal)}`,
                `Livraison : ${summary.shipping ? `${formatMAD(summary.shipping)} (TVA incl.)` : formatMAD(0)}`,
                `Total : ${summary.hasPendingPricing ? 'En attente de confirmation' : formatMAD(summary.total)}`,
                ...(notes ? ['', '--- Notes de commande ---', notes] : [])
            ].join('\n');

            return bodyText;
        };

        const updateConfirmationLinks = () => {
            const messageBody = buildConfirmationPayload();
            const encodedBody = encodeURIComponent(messageBody);
            const encodedSubject = encodeURIComponent('IPORDISE Order Confirmation');

            confirmWhatsApp.href = `https://wa.me/212663750210?text=${encodedBody}`;
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
            const fieldsFilled = firstName && lastName && address && city;
            const normalizedEmail = email.trim();
            const emailValidIfProvided = !normalizedEmail || isValidEmail(normalizedEmail);
            const contactValid = isValidPhone(phone) && emailValidIfProvided;
            const isReady = Boolean(cartHasItems && fieldsFilled && contactValid);
            const hasPending = summarize(readCheckoutCart()).hasPendingPricing;

            placeOrderBtn.disabled = !isReady;
            placeOrderBtn.setAttribute('aria-disabled', String(!isReady));
            placeOrderBtn.classList.toggle('opacity-50', !isReady);
            placeOrderBtn.classList.toggle('cursor-not-allowed', !isReady);
            placeOrderBtn.classList.remove('hidden');

            if (!cartHasItems) {
                validationMsg.textContent = t('checkout.dyn.cart_empty', 'Your cart is empty. Add items before placing your order.');
                confirmOptions.classList.add('hidden');
                return;
            }

            if (!fieldsFilled) {
                validationMsg.textContent = t('checkout.dyn.fill_billing', 'Please complete all required billing fields.');
                confirmOptions.classList.add('hidden');
                return;
            }

            if (!isValidPhone(phone)) {
                validationMsg.textContent = t('checkout.dyn.invalid_phone', 'Please enter a valid phone number (at least 9 digits).');
                confirmOptions.classList.add('hidden');
                return;
            }

            if (normalizedEmail && !isValidEmail(normalizedEmail)) {
                validationMsg.textContent = t('checkout.dyn.invalid_email', 'Email is optional, but if provided it must be valid.');
                confirmOptions.classList.add('hidden');
                return;
            }

            validationMsg.textContent = t('checkout.dyn.ready', 'Perfect. You can now place your order and choose your confirmation method.');
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

        /* Re-render dynamic content when the user switches language */
        window.addEventListener('ipordise:langchange', () => {
            renderOrder();
            checkFormValidity();
        });

        // ── Silent email to perfumiro@gmail.com via Formspree ──
        // Sign up free at formspree.io, create a form, paste your Form ID below.
        const FORMSPREE_ID = 'meerdrqy';

        const sendOrderEmail = () => {
            return new Promise((resolve) => {
                if (!FORMSPREE_ID || FORMSPREE_ID === 'YOUR_FORM_ID') { resolve(false); return; }
                try {
                    const body = buildConfirmationPayload();
                    const firstName = (document.getElementById('billingFirstName')?.value || '').trim();
                    const lastName  = (document.getElementById('billingLastName')?.value || '').trim();
                    const phone     = (document.getElementById('billingPhone')?.value || '').trim();
                    const email     = (document.getElementById('billingEmail')?.value || '').trim();
                    const data = new FormData();
                    data.append('_subject', `Nouvelle commande - ${firstName} ${lastName}`.trim());
                    data.append('_replyto', email || 'no-reply@ipordise.com');
                    data.append('Nom', `${firstName} ${lastName}`.trim());
                    data.append('Telephone', phone);
                    data.append('Email', email);
                    data.append('Commande', body);
                    fetch(`https://formspree.io/f/${FORMSPREE_ID}`, {
                        method: 'POST',
                        body: data,
                        headers: { 'Accept': 'application/json' }
                    }).then(() => resolve(true)).catch(() => resolve(false));
                } catch (e) { resolve(false); }
            });
        };

        placeOrderBtn.addEventListener('click', () => {
            if (placeOrderBtn.disabled) return;
            updateConfirmationLinks();

            // Disable button and show loading state
            placeOrderBtn.disabled = true;
            placeOrderBtn.innerHTML = '<i class="fas fa-spinner fa-spin text-sm"></i> Envoi en cours...';

            sendOrderEmail().then(() => {
                markConfirmationPending('email');
                sessionStorage.removeItem('ipordise_cart');
                window.location.href = 'thank-you.html';
            });
        });

        confirmWhatsApp.addEventListener('click', () => {
            updateConfirmationLinks();
            markConfirmationPending('whatsapp');
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