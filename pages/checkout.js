(function () {
    // The static checkout is a retired Firebase-era surface and cannot provide
    // transactional inventory or server-owned pricing. Production traffic must
    // use the canonical Supabase commerce application.
    const localHost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
    if (!localHost && window.location.pathname.replace(/\\/g, '/').endsWith('/pages/checkout.html')) {
        window.location.replace('/app');
        return;
    }

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

    // ── Discount state ──────────────────────────────────────────────────────
    let _appliedDiscount = null; // { code, type, value, discountAmount }

    const getDiscountAmount = (subtotal) => {
        if (!_appliedDiscount) return 0;
        if (_appliedDiscount.type === 'percentage') {
            return Math.min(Math.round(subtotal * _appliedDiscount.value / 100), subtotal);
        }
        return Math.min(_appliedDiscount.value, subtotal);
    };

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
        const discount = getDiscountAmount(subtotal);
        return {
            subtotal,
            shipping,
            discount,
            total: Math.max(0, subtotal + shipping - discount),
            hasPendingPricing
        };
    };

    const initCheckoutPage = () => {
        const isCheckoutPage = window.location.pathname.replace(/\\/g, '/').endsWith('/pages/checkout.html');
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

        const promoCodeInput = document.getElementById('promoCodeInput');
        const applyPromoBtn  = document.getElementById('applyPromoBtn');
        const promoMsgEl     = document.getElementById('promoMsg');

        // ── Pre-load discount applied on cart page ──────────────────────────
        const savedDiscount = sessionStorage.getItem('ipordise-cart-discount');
        if (savedDiscount) {
            try {
                _appliedDiscount = JSON.parse(savedDiscount);
                if (promoCodeInput) { promoCodeInput.value = _appliedDiscount.code; promoCodeInput.disabled = true; }
                if (applyPromoBtn) {
                    applyPromoBtn.textContent = '✓ Applied';
                    applyPromoBtn.disabled = true;
                    applyPromoBtn.style.background = '#16a34a';
                }
                if (promoMsgEl) {
                    const label = _appliedDiscount.type === 'percentage' ? _appliedDiscount.value + '%' : _appliedDiscount.value + ' MAD';
                    promoMsgEl.textContent = `✓ Code "${_appliedDiscount.code}" applied — ${label} off`;
                    promoMsgEl.style.cssText = 'display:block;background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0;font-size:12px;padding:7px 11px;border-radius:7px';
                }
            } catch (_) { _appliedDiscount = null; }
        }

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
            if (promoEl) promoEl.textContent = summary.discount > 0 ? `- ${formatMAD(summary.discount)}` : '— MAD';
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
                ...(_appliedDiscount ? [`Code promo : ${_appliedDiscount.code} (-${formatMAD(summary.discount)})`] : []),
                `Total : ${summary.hasPendingPricing ? 'En attente de confirmation' : formatMAD(summary.total)}`,
                ...(notes ? ['', '--- Notes de commande ---', notes] : [])
            ].join('\n');

            return bodyText;
        };

        // Build a structured order object for Firestore storage
        const buildStructuredOrder = (channel) => {
            const items = readCheckoutCart();
            const summary = summarize(items);
            const firstName = (document.getElementById('billingFirstName')?.value || '').trim();
            const lastName  = (document.getElementById('billingLastName')?.value  || '').trim();
            const address   = (document.getElementById('billingAddress')?.value   || '').trim();
            const city      = (document.getElementById('billingCity')?.value      || '').trim();
            const phone     = (document.getElementById('billingPhone')?.value     || '').trim();
            const email     = (document.getElementById('billingEmail')?.value     || '').trim();
            const notes     = (document.getElementById('orderNotes')?.value       || '').trim();
            return {
                channel,
                items:    items.map((i) => ({ id: i.id, name: i.name, size: i.size || '', qty: i.qty, price: i.price, pricePending: i.pricePending })),
                customer: { firstName, lastName, address, city, phone, email, notes },
                summary:  { subtotal: summary.subtotal, shipping: summary.shipping, discount: summary.discount, total: summary.total, hasPendingPricing: summary.hasPendingPricing },
                ..._appliedDiscount ? { discountCode: _appliedDiscount.code } : {},
            };
        };

        // Store pending order in sessionStorage so thank-you.html can save it to Firestore
        const storePendingOrder = (channel) => {
            try {
                sessionStorage.setItem('ipordise-pending-order', JSON.stringify(buildStructuredOrder(channel)));
                sessionStorage.removeItem('ipordise-cart-discount'); // clear discount after order placed
            } catch(e) {}
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

        // ── Promo code apply ───────────────────────────────────────────────
        const showPromoMsg = (txt, ok) => {
            if (!promoMsgEl) return;
            promoMsgEl.textContent = txt;
            promoMsgEl.style.cssText = `display:block;${ok
                ? 'background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0;'
                : 'background:#fef2f2;color:#dc2626;border:1px solid #fca5a5;'}font-size:12px;padding:7px 11px;border-radius:7px`;
        };

        applyPromoBtn?.addEventListener('click', async () => {
            const code = (promoCodeInput?.value || '').trim().toUpperCase();
            if (!code) { showPromoMsg('Please enter a discount code.', false); return; }

            applyPromoBtn.textContent = '...';
            applyPromoBtn.disabled = true;

            try {
                const { db } = await import('../auth/firebase.js');
                const { doc, getDoc, setDoc, increment } = await import('https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js');

                const snap = await getDoc(doc(db, 'discountCodes', code));
                if (!snap.exists()) { showPromoMsg('Code "' + code + '" not found.', false); return; }

                const dc = snap.data();
                const now = Date.now();

                if (dc.active === false) { showPromoMsg('This code is currently disabled.', false); return; }
                if (dc.expiresAt && dc.expiresAt.toMillis?.() < now) { showPromoMsg('This code has expired.', false); return; }
                if (dc.usageLimit > 0 && (dc.usedCount || 0) >= dc.usageLimit) { showPromoMsg('This code has reached its usage limit.', false); return; }

                const items = readCheckoutCart();
                const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
                if (dc.minOrder > 0 && subtotal < dc.minOrder) {
                    showPromoMsg(`Minimum order of ${dc.minOrder} MAD required for this code.`, false);
                    return;
                }

                _appliedDiscount = { code: dc.code, type: dc.type, value: dc.value };
                const discountAmt = getDiscountAmount(subtotal);
                const label = dc.type === 'percentage' ? dc.value + '%' : dc.value + ' MAD';
                showPromoMsg(`✓ Code "${code}" applied — ${label} off (- ${discountAmt} MAD)`, true);
                if (promoCodeInput) promoCodeInput.disabled = true;
                applyPromoBtn.textContent = '✓ Applied';
                applyPromoBtn.style.background = '#16a34a';
                renderOrder();
                checkFormValidity();
            } catch (e) {
                showPromoMsg('Error: ' + e.message, false);
            } finally {
                if (!_appliedDiscount) {
                    applyPromoBtn.textContent = 'Apply';
                    applyPromoBtn.disabled = false;
                }
            }
        });
        window.addEventListener('ipordise:langchange', () => {
            renderOrder();
            checkFormValidity();
        });

        // ── Send order notifications via backend API ──────────────────────
        // Resolves to true on success or false on any error (never throws).
        const sendOrderNotification = (orderData, orderId) => {
            return new Promise((resolve) => {
                try {
                    // Detect backend base from analytics config (same server) or fall back to same origin
                    const backendBase = (window.IPORDISE_ANALYTICS_BASE
                        || document.querySelector('meta[name="ipordise-analytics-base"]')?.content
                        || '').trim();
                    const endpoint = backendBase ? `${new URL(backendBase, location.href).origin}/api/orders/notify` : '/api/orders/notify';

                    fetch(endpoint, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: backendBase ? 'include' : 'same-origin',
                        body: JSON.stringify({ orderData, orderId: orderId || null })
                    }).then(() => resolve(true)).catch(() => resolve(false));
                } catch (e) { resolve(false); }
            });
        };

        // ── EmailJS notification — works entirely in the browser, no server needed ──
        // Set up at emailjs.com (free · 200 emails/month). Add the 4 meta tags in
        // checkout.html once you have your Public Key, Service ID and Template IDs.
        const sendEmailJSNotification = async (orderData, orderId) => {
            try {
                const publicKey = (document.querySelector('meta[name="emailjs-public-key"]')?.content  || '').trim();
                const serviceId  = (document.querySelector('meta[name="emailjs-service-id"]')?.content  || '').trim();
                const adminTpl   = (document.querySelector('meta[name="emailjs-admin-template"]')?.content  || '').trim();
                const clientTpl  = (document.querySelector('meta[name="emailjs-client-template"]')?.content || '').trim();

                if (!publicKey || !serviceId || !adminTpl) return false;

                const c     = orderData.customer || {};
                const items = Array.isArray(orderData.items) ? orderData.items : [];
                const s     = orderData.summary || {};

                const itemsList = items.map((i) =>
                    `• ${i.name}${i.size ? ` (${i.size})` : ''} ×${i.qty}` +
                    (i.pricePending ? ' — price to confirm' : ` — ${(i.price * i.qty).toFixed(2)} MAD`)
                ).join('\n');

                const params = {
                    order_id:         String(orderId || 'N/A'),
                    customer_name:    (`${c.firstName || ''} ${c.lastName || ''}`).trim() || 'Guest',
                    customer_email:   c.email   || '',
                    customer_phone:   c.phone   || '',
                    customer_address: [c.address, c.city].filter(Boolean).join(', '),
                    customer_notes:   c.notes   || '',
                    order_items:      itemsList,
                    order_subtotal:   `${(s.subtotal || 0).toFixed(2)} MAD`,
                    order_shipping:   `${(s.shipping  || 0).toFixed(2)} MAD`,
                    order_discount:   (s.discount || 0) > 0 ? `-${(s.discount).toFixed(2)} MAD` : '—',
                    order_total:      s.hasPendingPricing ? 'To be confirmed' : `${(s.total || 0).toFixed(2)} MAD`,
                    order_date:       new Date().toLocaleDateString('fr-MA', { year: 'numeric', month: 'long', day: 'numeric' }),
                    order_channel:    orderData.channel || 'email',
                };

                const ejsSend = (templateId, extra) => fetch('https://api.emailjs.com/api/v1.0/email/send', {
                    method:  'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body:    JSON.stringify({
                        service_id:      serviceId,
                        template_id:     templateId,
                        user_id:         publicKey,
                        template_params: { ...params, ...(extra || {}) },
                    }),
                });

                await ejsSend(adminTpl);
                if (c.email && clientTpl) {
                    await ejsSend(clientTpl, { to_email: c.email, to_name: params.customer_name });
                }
                return true;
            } catch (e) { return false; }
        };

        // ── Formspree admin notification — works right now, zero extra setup ──
        // Uses the same Formspree form (meerdrqy) that was already working.
        // Admin receives a full order summary email; _replyto is the customer's
        // email so clicking Reply in your inbox automatically goes to the client.
        const sendFormspreeNotification = async (orderData, orderId) => {
            try {
                const c     = orderData.customer || {};
                const items = Array.isArray(orderData.items) ? orderData.items : [];
                const s     = orderData.summary  || {};

                const itemLines = items.map((i) =>
                    `${i.name}${i.size ? ` (${i.size})` : ''} ×${i.qty || 1}` +
                    (i.pricePending ? ' — prix à confirmer' : ` — ${((i.price || 0) * (i.qty || 1)).toFixed(2)} MAD`)
                ).join('\n');

                const payload = {
                    _replyto:    c.email  || '',
                    'Commande':  `#${String(orderId || 'N/A')}`,
                    'Client':    (`${c.firstName || ''} ${c.lastName || ''}`).trim() || 'Invité',
                    'Email':     c.email  || '—',
                    'Téléphone': c.phone  || '—',
                    'Adresse':   [c.address, c.city].filter(Boolean).join(', ') || '—',
                    'Notes':     c.notes  || '—',
                    'Articles':  itemLines || '—',
                    'Sous-total': `${(s.subtotal || 0).toFixed(2)} MAD`,
                    'Livraison':  `${(s.shipping  || 0).toFixed(2)} MAD`,
                    'Remise':    (s.discount || 0) > 0 ? `-${(s.discount).toFixed(2)} MAD` : '—',
                    'Total':     s.hasPendingPricing ? 'À confirmer' : `${(s.total || 0).toFixed(2)} MAD`,
                    'Canal':     orderData.channel || 'email',
                    'Date':      new Date().toLocaleDateString('fr-MA', { year: 'numeric', month: 'long', day: 'numeric' }),
                };

                const res = await fetch('https://formspree.io/f/meerdrqy', {
                    method:  'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body:    JSON.stringify(payload),
                });
                return res.ok;
            } catch (e) { return false; }
        };

        // ── Brevo transactional email — branded order confirmation to customer ──
        const sendBrevoConfirmation = async (orderData, orderId) => {
            try {
                const c     = orderData.customer || {};
                if (!c.email) return false; // no email, skip

                const items = Array.isArray(orderData.items) ? orderData.items : [];
                const s     = orderData.summary  || {};

                const itemRows = items.map((i) => {
                    const lineTotal = i.pricePending ? 'À confirmer' : `${((i.price || 0) * (i.qty || 1)).toFixed(0)} DH`;
                    return `<tr>
                        <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#374151">${escapeHtml(i.name)}${i.size ? ` <span style="color:#9ca3af">(${escapeHtml(i.size)})</span>` : ''}</td>
                        <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:14px;color:#374151">${i.qty || 1}</td>
                        <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:14px;color:#374151">${lineTotal}</td>
                    </tr>`;
                }).join('');

                const discountRow = (s.discount || 0) > 0
                    ? `<tr><td colspan="2" style="padding:6px 14px;text-align:right;font-size:13px;color:#059669">Remise</td><td style="padding:6px 14px;text-align:right;font-size:13px;color:#059669">-${(s.discount).toFixed(0)} DH</td></tr>`
                    : '';

                const totalLabel = s.hasPendingPricing ? 'À confirmer' : `${(s.total || 0).toFixed(0)} DH`;

                const htmlContent = `<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;padding:40px 0;font-family:Arial,Helvetica,sans-serif">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06)">
  <tr><td style="background:#111827;padding:32px 40px;text-align:center">
    <h1 style="margin:0;color:#fff;font-family:Georgia,serif;font-size:28px;letter-spacing:6px;font-weight:400">IPORDISE</h1>
    <p style="margin:6px 0 0;color:rgba(255,255,255,0.5);font-size:11px;letter-spacing:3px">LUXURY FRAGRANCES</p>
  </td></tr>
  <tr><td style="padding:40px">
    <div style="text-align:center;margin-bottom:24px">
      <div style="display:inline-block;background:#d1fae5;border-radius:50%;width:56px;height:56px;line-height:56px;font-size:24px">✓</div>
    </div>
    <h2 style="margin:0 0 8px;text-align:center;color:#111827;font-size:22px">Commande Confirmée!</h2>
    <p style="color:#6b7280;font-size:14px;text-align:center;margin:0 0 24px;line-height:1.6">
      Merci <strong>${escapeHtml(c.firstName || '')}</strong>, votre commande <strong>#${escapeHtml(String(orderId || 'N/A'))}</strong> a bien été reçue.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;margin-bottom:24px">
      <tr style="background:#f9fafb">
        <th style="padding:10px 14px;text-align:left;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em">Article</th>
        <th style="padding:10px 14px;text-align:center;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em">Qté</th>
        <th style="padding:10px 14px;text-align:right;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em">Prix</th>
      </tr>
      ${itemRows}
      <tr><td colspan="2" style="padding:6px 14px;text-align:right;font-size:13px;color:#6b7280">Sous-total</td><td style="padding:6px 14px;text-align:right;font-size:13px;color:#374151">${(s.subtotal || 0).toFixed(0)} DH</td></tr>
      <tr><td colspan="2" style="padding:6px 14px;text-align:right;font-size:13px;color:#6b7280">Livraison</td><td style="padding:6px 14px;text-align:right;font-size:13px;color:#374151">${(s.shipping || 0).toFixed(0)} DH</td></tr>
      ${discountRow}
      <tr style="background:#f9fafb"><td colspan="2" style="padding:12px 14px;text-align:right;font-size:15px;font-weight:700;color:#111827">Total</td><td style="padding:12px 14px;text-align:right;font-size:15px;font-weight:700;color:#111827">${totalLabel}</td></tr>
    </table>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:10px;padding:16px 20px;margin-bottom:24px">
      <tr><td>
        <p style="margin:0 0 4px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em">Adresse de livraison</p>
        <p style="margin:0;font-size:14px;color:#374151">${escapeHtml(c.firstName || '')} ${escapeHtml(c.lastName || '')}</p>
        <p style="margin:2px 0 0;font-size:14px;color:#374151">${escapeHtml(c.address || '')}, ${escapeHtml(c.city || '')}</p>
        <p style="margin:2px 0 0;font-size:14px;color:#374151">${escapeHtml(c.phone || '')}</p>
      </td></tr>
    </table>
    <p style="color:#9ca3af;font-size:12px;text-align:center;margin:0;line-height:1.6">
      Nous vous contacterons bientôt pour confirmer votre commande.<br>
      Pour toute question, contactez-nous sur WhatsApp: <a href="https://wa.me/212663750210" style="color:#111827">+212 663 750 210</a>
    </p>
  </td></tr>
  <tr><td style="background:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb">
    <p style="color:#9ca3af;font-size:11px;margin:0;letter-spacing:.5px">&copy; 2026 IPORDISE &middot; Luxury Fragrances &middot; Morocco</p>
  </td></tr>
</table>
</td></tr></table>`;

                // Private email-provider credentials must never be embedded in browser code.
                return sendOrderNotification(orderData, orderId);
                const _bk = '';
                const res = await fetch('https://api.brevo.com/v3/smtp/email', {
                    method: 'POST',
                    headers: {
                        'accept': 'application/json',
                        'content-type': 'application/json',
                        'api-key': _bk
                    },
                    body: JSON.stringify({
                        sender: { name: 'IPORDISE', email: 'noreply@ipordise.com' },
                        to: [{ email: c.email, name: (`${c.firstName || ''} ${c.lastName || ''}`).trim() || 'Client' }],
                        subject: `IPORDISE — Confirmation de commande #${orderId || 'N/A'}`,
                        htmlContent: htmlContent,
                    })
                });
                return res.ok;
            } catch (e) { return false; }
        };

        placeOrderBtn.addEventListener('click', () => {
            if (placeOrderBtn.disabled) return;
            updateConfirmationLinks();

            // Disable button and show loading state
            placeOrderBtn.disabled = true;
            placeOrderBtn.innerHTML = '<i class="fas fa-spinner fa-spin text-sm"></i> Envoi en cours...';

            storePendingOrder('email');

            // 1. Save to Firestore first so we get the readable order ID
            // 2. Then send email notifications (admin alert + client confirmation)
            (async () => {
                let orderId = null;
                try {
                    let saveFn = window._ipoSaveOrder;
                    if (!saveFn) {
                        const { saveGlobalOrder } = await import('../auth/user-data.js');
                        saveFn = saveGlobalOrder;
                        window._ipoSaveOrder = saveFn;
                    }
                    const orderData = buildStructuredOrder('email');
                    orderId = await saveFn(orderData);
                    if (orderId) {
                        try {
                            const raw = sessionStorage.getItem('ipordise-pending-order');
                            if (raw) {
                                const obj = JSON.parse(raw);
                                obj.orderId = orderId;
                                sessionStorage.setItem('ipordise-pending-order', JSON.stringify(obj));
                            }
                        } catch(e) {}
                    }
                } catch(e) { console.error('[IPORDISE] Order save failed:', e); }

                // 1. Formspree — admin notification (always works, no setup needed)
                try {
                    await Promise.race([
                        sendFormspreeNotification(buildStructuredOrder('email'), orderId),
                        new Promise((r) => setTimeout(r, 8000)),
                    ]);
                } catch (e) {}
                // 2. EmailJS — client confirmation (works once emailjs.com is configured)
                try {
                    await Promise.race([
                        sendEmailJSNotification(buildStructuredOrder('email'), orderId),
                        new Promise((r) => setTimeout(r, 6000)),
                    ]);
                } catch (e) {}
                // 3. Brevo — branded order confirmation email to customer
                try {
                    await Promise.race([
                        Promise.resolve(false),
                        new Promise((r) => setTimeout(r, 8000)),
                    ]);
                } catch (e) {}
                // 4. Backend notification (best-effort, non-blocking)
                sendOrderNotification(buildStructuredOrder('email'), orderId);

                markConfirmationPending('email');
                sessionStorage.removeItem('ipordise_cart');
                window.location.href = 'thank-you.html';
            })();
        });

        confirmWhatsApp.addEventListener('click', () => {
            updateConfirmationLinks();
            // Save to Firestore + send email notification for WhatsApp orders too
            (async () => {
                try {
                    let saveFn = window._ipoSaveOrder;
                    if (!saveFn) {
                        const { saveGlobalOrder } = await import('../auth/user-data.js');
                        saveFn = saveGlobalOrder;
                        window._ipoSaveOrder = saveFn;
                    }
                    const orderData = buildStructuredOrder('whatsapp');
                    const orderId = await saveFn(orderData);
                    if (orderId) {
                        try {
                            const raw = sessionStorage.getItem('ipordise-pending-order');
                            if (raw) {
                                const obj = JSON.parse(raw);
                                obj.orderId = orderId;
                                sessionStorage.setItem('ipordise-pending-order', JSON.stringify(obj));
                            }
                        } catch(e) {}
                    }
                    sendFormspreeNotification(buildStructuredOrder('whatsapp'), orderId);
                    sendEmailJSNotification(buildStructuredOrder('whatsapp'), orderId);
                    sendOrderNotification(buildStructuredOrder('whatsapp'), orderId);
                } catch(e) { console.error('[IPORDISE] WhatsApp order save failed:', e); }
            })();
            storePendingOrder('whatsapp');
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
