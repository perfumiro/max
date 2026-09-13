const API = 'https://gdgrskgegrcgmzswefmn.supabase.co';
const KEY = 'sb_publishable_XbhrBW9Na65u8EkpgtEz4g_PuYkxs_H';
const normalize = value => String(value || '').toLowerCase().replace(/\s+/g, '');

export function availability(product, selectedSize) {
    const variants = (product?.product_variants || []).filter(v => v.enabled);
    const variant = variants.find(v => normalize(v.size_key) === normalize(selectedSize) || normalize(v.size_label) === normalize(selectedSize));
    const soldOut = variant ? variant.stock_quantity !== null && Number(variant.stock_quantity) <= 0
        : variants.length ? variants.every(v => v.stock_quantity !== null && Number(v.stock_quantity) <= 0)
        : product?.stock_left === 0;
    const unavailable = product?.active === false || (Boolean(selectedSize) && variants.length > 0 && !variant);
    return { variant, soldOut, blocked: unavailable || soldOut, preorder: !unavailable && soldOut && product?.preorder_enabled === true };
}

export async function createPreorder(payload, fetcher = fetch) {
    const response = await fetcher(`${API}/functions/v1/create-preorder`, {
        method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, source: 'website' }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Your request could not be sent. Please try again.');
    if (!result.request?.id) throw new Error('Confirmation was not received. Please try again.');
    return result;
}

export async function setupPreorder({ productId, productName, getSize, getLanguage }) {
    const tr = (en, fr) => getLanguage() === 'fr' ? fr : en;
    if (!document.querySelector('link[data-preorder-style]')) {
        const css = document.createElement('link'); css.rel = 'stylesheet';
        css.href = new URL('./preorder.css?v=4', import.meta.url).href;
        css.dataset.preorderStyle = ''; document.head.append(css);
    }
    document.getElementById('arrivalPanel')?.remove();
    document.getElementById('preorderDialog')?.remove();
    const panel = document.createElement('section'); panel.id = 'arrivalPanel'; panel.className = 'arrival-panel';
    panel.setAttribute('aria-live', 'polite');
    panel.innerHTML = `<div class="arrival-flight" role="img">
        <div class="arrival-flight-caption"></div>
        <svg class="arrival-flight-map" viewBox="0 0 320 132" aria-hidden="true">
            <path class="arrival-cloud" d="M61 54h31a8 8 0 0 0 0-16 12 12 0 0 0-23-3 10 10 0 0 0-8 19Z"/>
            <path class="arrival-cloud arrival-cloud-far" d="M227 63h26a7 7 0 0 0 0-14 10 10 0 0 0-19-3 9 9 0 0 0-7 17Z"/>
            <path class="arrival-route" d="M30 108C87 5 233 5 290 108"/>
            <path class="arrival-route-progress" d="M30 108C87 5 233 5 290 108" pathLength="100"/>
            <circle class="arrival-airport-halo" cx="30" cy="108" r="13"/>
            <circle class="arrival-airport" cx="30" cy="108" r="4"/>
            <circle class="arrival-airport-halo arrival-destination" cx="290" cy="108" r="13"/>
            <circle class="arrival-airport" cx="290" cy="108" r="4"/>
            <g class="arrival-plane"><path transform="scale(.72)" d="M-15-4H-3L-8-17H-3L7-4 18-2Q22 0 18 2L7 4-3 17H-8L-3 4H-15L-19 9H-22L-19 0-22-9H-19Z"/></g>
        </svg>
        <div class="arrival-countries">
            <div><svg viewBox="0 0 28 20" aria-hidden="true"><rect width="28" height="20" rx="3" fill="#aa151b"/><path d="M0 5h28v10H0z" fill="#f1bf00"/></svg><span class="arrival-origin-label"></span><small>ES</small></div>
            <div><svg viewBox="0 0 28 20" aria-hidden="true"><rect width="28" height="20" rx="3" fill="#c1272d"/><path d="m14 4 3.5 11-9-6.8h11L10.5 15Z" fill="none" stroke="#006233" stroke-width="1.2"/></svg><span class="arrival-destination-label"></span><small>MA</small></div>
        </div>
    </div><h3></h3><p class="arrival-estimate"></p><p class="arrival-message"></p><button type="button" class="product-cart-btn"></button>`;
    document.getElementById('productPriceCard').before(panel);
    const priceCard = document.getElementById('productPriceCard');
    priceCard.querySelector('.price-soon-summary')?.remove();
    const priceSummary = document.createElement('div');
    priceSummary.className = 'price-soon-summary';
    priceSummary.innerHTML = '<span class="price-soon-kicker"></span><strong></strong><p></p>';
    priceCard.prepend(priceSummary);
    const originalSizePrices = new Map(Array.from(priceCard.querySelectorAll('.spill-price'), el => [el, el.textContent]));
    let product = null, failed = false, missing = false, globallyEnabled = true; const preorderStorageKey = ipordise.preorder.submitted.; let alreadySubmitted = (() => { try { return localStorage.getItem(preorderStorageKey) === '1'; } catch { return false; } })();
    try {
        const query = new URLSearchParams({ id: `eq.${productId}`, select: 'id,name,active,stock_left,preorder_enabled,preorder_message,preorder_estimated_availability,price_coming_soon,product_variants(id,size_key,size_label,stock_quantity,enabled)' });
        const options = { headers: { apikey: KEY }, cache: 'no-store', signal: AbortSignal.timeout(3000) };
        const [response, settingsResponse] = await Promise.all([
            fetch(`${API}/rest/v1/products?${query}`, options),
            fetch(`${API}/rest/v1/store_settings?id=eq.main&select=value`, options).catch(() => null),
        ]);
        if (!response.ok) throw new Error('Availability unavailable');
        product = (await response.json())[0];
        if (settingsResponse?.ok) globallyEnabled = (await settingsResponse.json())[0]?.value?.preorders?.enabled !== false;
        if (!product) { missing = true; throw new Error('Product unavailable'); }
    } catch { failed = true; }
    const state = () => {
        // If the availability endpoint is temporarily unreachable, preserve
        // the product's published price and normal checkout action. Network
        // failure must not turn a priced perfume into an unavailable one.
        if (failed) return { blocked: true, preorder: true, soldOut: true };
        const current = availability(product, getSize());
        return { ...current, preorder: current.preorder && globallyEnabled };
    };
    const render = () => {
        const current = state();
        panel.hidden = !current.blocked;
        // Availability controls ordering, never price visibility. Arriving-soon
        // and preorder products must keep their published prices visible.
        const pricePending = false;
        priceCard.classList.toggle('has-price-coming-soon', pricePending);
        document.getElementById('productCtaHint')?.classList.toggle('is-price-pending', current.blocked);
        priceSummary.hidden = !pricePending;
        priceSummary.querySelector('.price-soon-kicker').textContent = tr('A little anticipation', 'Encore un peu de patience');
        priceSummary.querySelector('strong').textContent = tr('Price coming soon', 'Prix bientôt disponible');
        priceSummary.querySelector('p').textContent = tr('Choose your preferred size. We’ll confirm the price before you order.', 'Choisissez votre format. Nous confirmerons le prix avant votre commande.');
        const priceNote = priceCard.querySelector('.price-live-note');
        if (priceNote) priceNote.textContent = pricePending ? tr('Price to be confirmed', 'Prix à confirmer') : tr('Current prices', 'Prix actuels');
        priceCard.querySelectorAll('.size-pill').forEach(pill => {
            const pending = false;
            const price = pill.querySelector('.spill-price');
            pill.classList.toggle('is-price-pending', pending);
            if (price) price.textContent = pending ? tr('Price soon', 'Prix à venir') : originalSizePrices.get(price) || '';
        });
        if (pricePending) {
            const stickyPrice = document.getElementById('stickyPrice');
            if (stickyPrice) stickyPrice.textContent = originalSizePrices.get(priceCard.querySelector('.spill-price')) || stickyPrice.textContent;
        }
        const arriving = current.preorder || (current.soldOut && Boolean(product?.preorder_estimated_availability));
        // The flight is also the empty-catalog illustration. Its visibility must
        // not depend on checkout eligibility; only confirmed stock enables orders.
        panel.querySelector('.arrival-flight').hidden = !(arriving || missing);
        panel.querySelector('.arrival-flight').setAttribute('aria-label', tr('Animated flight from Spain to Morocco', 'Vol animé de l’Espagne vers le Maroc'));
        panel.querySelector('.arrival-flight-caption').textContent = tr('A fragrance worth waiting for', 'Un parfum qui mérite d’attendre');
        panel.querySelector('.arrival-origin-label').textContent = tr('Spain', 'Espagne');
        panel.querySelector('.arrival-destination-label').textContent = tr('Morocco', 'Maroc');
        const title = missing ? tr('A fragrance worth waiting for', 'Un parfum qui mérite d’attendre')
            : failed ? tr('Preorder available', 'Disponibilité temporairement indisponible')
            : arriving ? tr('Your next fragrance is on its way', 'Votre prochain parfum arrive bientôt')
            : tr('Currently out of stock', 'Actuellement en rupture de stock');
        panel.querySelector('h3').textContent = title;
        panel.querySelector('.arrival-estimate').textContent = arriving ? `${tr('Expected arrival', 'Arrivée estimée')} · ${product.preorder_estimated_availability}` : '';
        panel.querySelector('.arrival-message').textContent = current.preorder
            ? (product.preorder_message || tr('Reserve yours. We will contact you when it is available. No payment now; arrival dates are estimates.', 'Réservez le vôtre. Nous vous contacterons dès sa disponibilité. Aucun paiement maintenant ; les dates sont estimatives.'))
            : missing ? tr('Ask us about its arrival and reserve your interest. We’ll confirm availability before you order.', 'Contactez-nous pour connaître son arrivée et nous faire part de votre intérêt. Nous confirmerons sa disponibilité avant votre commande.')
            : failed ? tr('Reserve your bottle before it arrives.', 'Actualisez la page pour vérifier la disponibilité.')
            : tr('Preorders are not open for this option yet.', 'Les précommandes ne sont pas encore ouvertes pour cette option.');
        const button = panel.querySelector('button'); button.hidden = !missing && !current.preorder && !failed;
        button.textContent = missing ? tr('Ask about this perfume', 'Se renseigner sur ce parfum') : failed ? tr('Preorder this perfume', 'Précommander ce parfum') : tr('Preorder this perfume', 'Précommander ce parfum');
        const badge = document.querySelector('.ipp-badge-stock');
        if (badge) { badge.textContent = current.blocked ? (arriving ? tr('✈ Arriving soon', '✈ Bientôt disponible') : tr('Unavailable', 'Indisponible')) : tr('● In stock', '● En stock'); badge.classList.toggle('arrival-stock', current.blocked); }
        if (badge && missing) badge.textContent = tr('Availability to be confirmed', 'Disponibilité à confirmer');
        if (current.blocked) {
            ['addToCartBtn', 'stickyAddToCartBtn', 'qtyBoxContainer', 'productWhatsappBlock', 'fsProdInfoBar', 'productOndemandBox'].forEach(id => document.getElementById(id)?.classList.add('hidden'));
            const delivery = document.getElementById('productDeliveryChip');
            if (delivery) delivery.textContent = tr('Delivery arranged after stock arrives', 'Livraison organisée après réception du stock');
            if (delivery && missing) delivery.textContent = tr('Contact us for arrival details', 'Contactez-nous pour les détails d’arrivée');
        }
    };
    panel.querySelector('button').addEventListener('click', () => {
        if (missing) {
            const message = tr(`Hello IPORDISE, I would like to know when ${productName} will arrive and whether I can preorder it.`, `Bonjour IPORDISE, je souhaite connaître la date d’arrivée de ${productName} et savoir si je peux le précommander.`);
            window.location.href = `https://wa.me/212663750210?text=${encodeURIComponent(message)}`;
            return;
        }
        if (failed && !product) product = { id: productId, name: productName, active: true, preorder_enabled: true, stock_left: 0, product_variants: [] };
        if (!state().preorder) return;
        const selectedVariant = state().variant;
        const dialog = document.createElement('dialog'); dialog.id = 'preorderDialog'; dialog.className = 'preorder-dialog';
        dialog.setAttribute('aria-labelledby', 'preorderTitle');
        dialog.innerHTML = `<form><button type="button" class="preorder-close" aria-label="${tr('Close', 'Fermer')}">×</button><h2 id="preorderTitle">${tr('Reserve your perfume', 'Réservez votre parfum')}</h2><p class="preorder-product"></p><p>${tr('No payment now. Our team will contact you to confirm availability and delivery.', 'Aucun paiement maintenant. Notre équipe vous contactera pour confirmer la disponibilité et la livraison.')}</p><label>${tr('Full name', 'Nom complet')}<input name="customerName" autocomplete="name" required minlength="2" maxlength="120"></label><label>${tr('Moroccan phone number', 'Téléphone marocain')}<input name="phone" type="tel" autocomplete="tel" placeholder="06 12 34 56 78" required maxlength="30"></label><label>${tr('City (optional)', 'Ville (facultatif)')}<input name="city" autocomplete="address-level2" maxlength="100"></label><label>${tr('Quantity', 'Quantité')}<input name="quantity" type="number" min="1" max="20" value="1" required></label><p class="preorder-result" role="status"></p><button type="submit" class="product-cart-btn">${tr('Send preorder request', 'Envoyer ma précommande')}</button></form>`;
        dialog.querySelector('.preorder-product').textContent = `${productName}${selectedVariant ? ` · ${selectedVariant.size_label}` : ''}`;
        document.body.append(dialog);
        dialog.addEventListener('close', () => { dialog.remove(); panel.querySelector('button').focus(); });
        dialog.querySelector('.preorder-close').onclick = () => dialog.close();
        let pendingKey = null, pendingFingerprint = null;
        dialog.querySelector('form').addEventListener('submit', async event => {
            event.preventDefault(); const form = event.currentTarget;
            const button = form.querySelector('[type="submit"]'); if (button.disabled) return;
            const values = Object.fromEntries(new FormData(form));
            values.phone = String(values.phone).replace(/[\s()-]/g, '').replace(/^00212/, '+212');
            const result = form.querySelector('.preorder-result');
            if (!/^(?:\+?212|0)[5-7]\d{8}$/.test(values.phone)) { result.textContent = tr('Please enter a valid Moroccan phone number.', 'Saisissez un numéro marocain valide.'); return; }
            const fingerprint = JSON.stringify(values);
            if (fingerprint !== pendingFingerprint) { pendingKey = crypto.randomUUID(); pendingFingerprint = fingerprint; }
            button.disabled = true; result.textContent = tr('Sending…', 'Envoi…');
            try {
                const response = await createPreorder({ ...values, quantity: Number(values.quantity), productId, variantId: selectedVariant?.id || null, selectedVariant: selectedVariant?.size_label || null, idempotencyKey: pendingKey });
                result.textContent = `${tr('Preorder received! We will contact you. Reference:', 'Précommande reçue ! Nous vous contacterons. Référence :')} ${response.request.id}`;
                form.querySelectorAll('input').forEach(input => input.disabled = true);
                button.hidden = true;
            } catch (error) { result.textContent = error.message; button.disabled = false; }
        });
        dialog.showModal();
    });
    return { render, blocked: () => state().blocked };
}
