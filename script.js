
const startPreviewAutoRefresh = () => {
    if (window.__ipordisePreviewAutoRefreshStarted) return;
    window.__ipordisePreviewAutoRefreshStarted = true;

    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    const isLocalPreview = protocol === 'file:'
        || hostname === ''
        || hostname === 'localhost'
        || hostname === '127.0.0.1'
        || hostname === '0.0.0.0';

    if (!isLocalPreview || typeof window.fetch !== 'function') return;

    const buildTrackedUrl = (value) => {
        if (!value) return null;

        try {
            const url = new URL(value, window.location.href);
            if (url.origin !== window.location.origin) return null;
            if (url.protocol !== 'http:' && url.protocol !== 'https:' && url.protocol !== 'file:') return null;

            url.hash = '';
            url.searchParams.delete('previewRefreshTs');
            return url;
        } catch {
            return null;
        }
    };

    const trackedAssets = [buildTrackedUrl(window.location.href)];

    document.querySelectorAll('link[rel="stylesheet"][href], script[src]').forEach((element) => {
        const source = element.getAttribute('href') || element.getAttribute('src');
        const assetUrl = buildTrackedUrl(source);
        if (assetUrl) trackedAssets.push(assetUrl);
    });

    const uniqueTrackedAssets = Array.from(new Map(
        trackedAssets.filter(Boolean).map((assetUrl) => [assetUrl.href, assetUrl])
    ).values());

    const previousFingerprints = new Map();
    let isReloading = false;

    const readFingerprint = async (assetUrl) => {
        const probeUrl = new URL(assetUrl.href);
        probeUrl.searchParams.set('previewRefreshTs', String(Date.now()));

        try {
            const headResponse = await window.fetch(probeUrl.href, {
                method: 'HEAD',
                cache: 'no-store'
            });

            if (headResponse.ok) {
                const etag = headResponse.headers.get('etag') || '';
                const lastModified = headResponse.headers.get('last-modified') || '';
                const contentLength = headResponse.headers.get('content-length') || '';
                const headerFingerprint = `${etag}|${lastModified}|${contentLength}`;

                if (headerFingerprint !== '||') {
                    return headerFingerprint;
                }
            }
        } catch {
            // Fall back to GET for servers that do not support HEAD.
        }

        try {
            const getResponse = await window.fetch(probeUrl.href, { cache: 'no-store' });
            if (!getResponse.ok) return null;

            const text = await getResponse.text();
            return `${text.length}|${text.slice(0, 256)}|${text.slice(-256)}`;
        } catch {
            return null;
        }
    };

    const checkForChanges = async () => {
        if (document.hidden || isReloading) return;

        for (const assetUrl of uniqueTrackedAssets) {
            const fingerprint = await readFingerprint(assetUrl);
            if (!fingerprint) continue;

            const previousFingerprint = previousFingerprints.get(assetUrl.href);
            if (previousFingerprint && previousFingerprint !== fingerprint) {
                isReloading = true;
                window.location.reload();
                return;
            }

            previousFingerprints.set(assetUrl.href, fingerprint);
        }
    };

    checkForChanges();
    window.setInterval(checkForChanges, 2000);
};

startPreviewAutoRefresh();

tailwind.config = {
    theme: {
        extend: {
            colors: {
                brand: {
                    dark: '#1a1a1a',
                    red: '#e73c3c',
                    redHover: '#c0392b',
                    light: '#f9f9f9',
                    gray: '#f3f4f6'
                }
            },
            fontFamily: {
                sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
                serif: ['Playfair Display', 'ui-serif', 'Georgia', 'Cambria', 'Times New Roman', 'Times', 'serif'],
            }
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const FORMSPREE_ENDPOINT = 'https://formspree.io/f/meerdrqy';
    const productNameEl = document.getElementById('productName');
    const languageStorageKey = 'ipordise-language';
    const supportedLanguages = ['en', 'fr'];
    const logoAreaImageUrl = 'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/assets/Herosectionphotos/logo%20area.png';

    const applySharedLogoAreaImage = () => {
        document.querySelectorAll('.site-logo-img').forEach((logoImage) => {
            logoImage.src = logoAreaImageUrl;
            logoImage.setAttribute('src', logoAreaImageUrl);
        });
    };

    const initMobileFlashBannerRotation = () => {
        const bannerContainer = document.querySelector('[data-mobile-flash-banners]');
        if (!bannerContainer) return;

        const slides = Array.from(bannerContainer.querySelectorAll('.mobile-flash-banner-slide'));
        if (slides.length < 2) return;

        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const rotationDelayMs = prefersReducedMotion ? 4500 : 3600;
        const transitionCleanupMs = prefersReducedMotion ? 350 : 950;

        let activeIndex = 0;
        slides.forEach((slide, index) => {
            slide.classList.remove('hidden', 'block', 'is-active', 'is-exiting');
            if (index === activeIndex) {
                slide.classList.add('is-active');
            }
        });

        // Navigate to the active slide's target page on click / Enter key
        bannerContainer.addEventListener('click', () => {
            const target = slides[activeIndex] && slides[activeIndex].dataset.href;
            if (target) window.location.href = target;
        });
        bannerContainer.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                const target = slides[activeIndex] && slides[activeIndex].dataset.href;
                if (target) window.location.href = target;
            }
        });

        window.setInterval(() => {
            const currentSlide = slides[activeIndex];
            const nextIndex = (activeIndex + 1) % slides.length;
            const nextSlide = slides[nextIndex];

            currentSlide.classList.remove('is-active');
            currentSlide.classList.add('is-exiting');

            nextSlide.classList.remove('is-exiting');
            nextSlide.classList.add('is-active');

            window.setTimeout(() => {
                currentSlide.classList.remove('is-exiting');
            }, transitionCleanupMs);

            activeIndex = nextIndex;
        }, rotationDelayMs);
    };

    initMobileFlashBannerRotation();
    applySharedLogoAreaImage();

    const translations = {
        en: {
            lang_label: 'EN',
            announcement_html: '<div class="top-announcement-marquee"><span class="top-announcement-marquee-item">Niche to designer, find your signature scent today. <a href="#" class="top-announcement-link" data-announcement-target="all">SHOP COLLECTION</a></span><span class="top-announcement-marquee-item">Fresh drops just landed in our perfume edit. <a href="#" class="top-announcement-link" data-announcement-target="new-in">EXPLORE NEW IN</a></span><span class="top-announcement-marquee-item" aria-hidden="true">Niche to designer, find your signature scent today. <a href="#" class="top-announcement-link" data-announcement-target="all">SHOP COLLECTION</a></span><span class="top-announcement-marquee-item" aria-hidden="true">Fresh drops just landed in our perfume edit. <a href="#" class="top-announcement-link" data-announcement-target="new-in">EXPLORE NEW IN</a></span></div>',
            search_placeholder: 'Search for perfumes, brands...',
            promo_btn: 'NEW COLLECTION',
            promo_note: '',
            nav_labels: ['BRANDS', 'PERFUMES', 'MAKEUP', 'SKINCARE', 'HAIR', 'PHARMACY', 'HYGIENE', 'MEN', 'SETS', 'SUN CARE', 'BODY', 'SEE MORE'],
            account_title_prefix: 'My account',
            account_subtitle: 'Sign in for faster checkout, saved favorites, and member-only beauty deals.',
            account_signin: 'Sign In',
            account_create: 'Create Account',
            account_offer: 'Unlock <strong>weekly perfume picks</strong> and exclusive member benefits.',
            account_shipping: '<strong>FAST SHIPPING</strong><br>Flat delivery: 35 MAD (VAT included).',
            wishlist_title: 'YOUR FAVORITES',
            wishlist_empty: 'No favorites yet. Tap the heart on a product to save it here.',
            wishlist_remove: 'Remove from wishlist',
            wishlist_item_single: 'item',
            wishlist_item_plural: 'items',
            product_fallback: 'Product',
            product_price_on_request: 'Price on Request',
            product_choose_size: 'Choose a size to see the price',
            product_choose_size_sticky: 'Choose size',
            product_add_to_cart: 'Add to Cart',
            product_added: '\u2713 Added!',
            product_decants: 'D\u00e9cants',
            product_full_bottles: 'Full Bottles',
            product_delivery_in_stock: 'In stock - Delivery in Morocco',
            product_delivery_fee: 'Delivery fee',
            product_verified_purchase: 'Verified purchase',
            product_sort_relevant: 'Sort by: Most relevant',
            product_rating_footnote: 'Calculated from verified customer ratings.',
            toast_added_to_cart: 'added to cart',
            toast_view_cart: 'View Cart'
        },
        fr: {
            lang_label: 'FR',
            announcement_html: '<div class="top-announcement-marquee"><span class="top-announcement-marquee-item">Parfums niche et designer, trouvez votre signature. <a href="#" class="top-announcement-link" data-announcement-target="all">VOIR COLLECTION</a></span><span class="top-announcement-marquee-item">Nouvelles references disponibles dans notre selection. <a href="#" class="top-announcement-link" data-announcement-target="new-in">VOIR NEW IN</a></span><span class="top-announcement-marquee-item" aria-hidden="true">Parfums niche et designer, trouvez votre signature. <a href="#" class="top-announcement-link" data-announcement-target="all">VOIR COLLECTION</a></span><span class="top-announcement-marquee-item" aria-hidden="true">Nouvelles references disponibles dans notre selection. <a href="#" class="top-announcement-link" data-announcement-target="new-in">VOIR NEW IN</a></span></div>',
            search_placeholder: 'Rechercher un parfum, une marque...',
            promo_btn: 'NOUVELLE COLLECTION',
            promo_note: '',
            nav_labels: ['MARQUES', 'PARFUMS', 'MAQUILLAGE', 'SOIN VISAGE', 'CHEVEUX', 'PARAPHARMACIE', 'HYGIÈNE', 'HOMME', 'COFFRETS', 'SOLAIRE', 'CORPS', 'VOIR PLUS'],
            account_title_prefix: 'Mon compte',
            account_subtitle: 'Connectez-vous pour un paiement rapide, vos favoris et des offres beauté exclusives.',
            account_signin: 'Se connecter',
            account_create: 'Créer un compte',
            account_offer: 'Profitez de <strong>sélections parfum chaque semaine</strong> et d’avantages exclusifs.',
            account_shipping: '<strong>LIVRAISON RAPIDE</strong><br>Frais fixes : 35 MAD (TVA incluse).',
            wishlist_title: 'VOS FAVORIS',
            wishlist_empty: 'Aucun favori pour le moment. Touchez le cœur sur un produit pour l’ajouter.',
            wishlist_remove: 'Retirer des favoris',
            wishlist_item_single: 'article',
            wishlist_item_plural: 'articles',
            product_fallback: 'Produit',
            product_price_on_request: 'Prix sur demande',
            product_choose_size: 'Choisissez une taille pour voir le prix',
            product_choose_size_sticky: 'Choisir la taille',
            product_add_to_cart: 'Ajouter au panier',
            product_added: '\u2713 Ajout\u00e9\u00a0!',
            product_decants: 'D\u00e9cants',
            product_full_bottles: 'Flacons complets',
            product_delivery_in_stock: 'En stock \u2013 Livraison au Maroc',
            product_delivery_fee: 'Frais de livraison',
            product_verified_purchase: 'Achat v\u00e9rifi\u00e9',
            product_sort_relevant: 'Trier par\u00a0: Plus pertinents',
            product_rating_footnote: 'Calcul\u00e9 \u00e0 partir d\u2019avis clients v\u00e9rifi\u00e9s.',
            toast_added_to_cart: 'ajout\u00e9 au panier',
            toast_view_cart: 'Voir le panier'
        }
    };

    const getPolicyPageHref = (page) => {
        const isPagesView = window.location.pathname.includes('/pages/');
        if (isPagesView) return `${page}.html`;
        return `pages/${page}.html`;
    };

    let currentLanguage = supportedLanguages.includes(localStorage.getItem(languageStorageKey))
        ? localStorage.getItem(languageStorageKey)
        : 'en';

    const languageSubscribers = [];

    const t = (key) => translations[currentLanguage]?.[key] ?? translations.en[key] ?? key;

    const onLanguageChange = (callback) => {
        if (typeof callback === 'function') {
            languageSubscribers.push(callback);
        }
    };

    const applyStaticLanguage = () => {
        document.documentElement.lang = currentLanguage;
        const newArrivalsHref = window.location.pathname.includes('/pages/') ? '../index.html#newArrivalsCarousel' : '#newArrivalsCarousel';
        const discoverPath = window.location.pathname.includes('/pages/') ? '../discover.html' : 'discover.html';

        document.querySelectorAll('.header-lang-btn > span:first-child').forEach((label) => {
            label.textContent = t('lang_label');
        });

        const topAnnouncement = document.querySelector('.top-announcement');
        if (topAnnouncement) {
            topAnnouncement.innerHTML = t('announcement_html');
        }

        document.querySelectorAll('.top-announcement-link[data-announcement-target]').forEach((link) => {
            const target = (link.getAttribute('data-announcement-target') || 'all').trim() || 'all';
            link.setAttribute('href', `${discoverPath}?filter=${encodeURIComponent(target)}`);
        });

        document.querySelectorAll('header input[placeholder]').forEach((input) => {
            input.placeholder = t('search_placeholder');
        });

        document.querySelectorAll('header a.hidden.lg\\:inline-flex.bg-brand-red').forEach((promoBtn) => {
            const promoNote = t('promo_note');
            promoBtn.setAttribute('href', newArrivalsHref);
            promoBtn.innerHTML = `${t('promo_btn')}${promoNote ? ` <span class="hidden xl:inline ml-2 text-[10px] font-medium opacity-90">${promoNote}</span>` : ''} <i class="fas fa-chevron-right ml-2 text-xs"></i>`;
        });

        document.querySelectorAll('header nav ul').forEach((navList) => {
            const links = navList.querySelectorAll('li a');
            if (links.length < 12) return;
            const labels = t('nav_labels');
            labels.forEach((label, index) => {
                if (links[index]) {
                    links[index].textContent = label;
                }
            });
        });
    };

    const setLanguage = (nextLanguage) => {
        if (!supportedLanguages.includes(nextLanguage) || nextLanguage === currentLanguage) return;
        currentLanguage = nextLanguage;
        localStorage.setItem(languageStorageKey, nextLanguage);
        applyStaticLanguage();
        languageSubscribers.forEach((callback) => callback(nextLanguage));
        window.dispatchEvent(new CustomEvent('ipordise:langchange', { detail: { lang: nextLanguage } }));
    };

    const initLanguageSwitcher = () => {
        const languageButtons = document.querySelectorAll('.header-lang-btn');
        if (!languageButtons.length) return;

        const allLangMenus = [];

        const closeAllLangMenus = () => {
            allLangMenus.forEach((menu) => menu.classList.remove('is-open'));
        };

        languageButtons.forEach((button) => {
            if (button.dataset.langBound === 'true') return;
            button.dataset.langBound = 'true';

            const wrap = button.parentElement;
            if (!wrap) return;
            wrap.classList.add('header-lang-wrap');

            const menu = document.createElement('div');
            menu.className = 'header-lang-menu';
            menu.innerHTML = `
                <button type="button" class="header-lang-option" data-lang="en">English (EN)</button>
                <button type="button" class="header-lang-option" data-lang="fr">Français (FR)</button>
            `;

            wrap.appendChild(menu);
            allLangMenus.push(menu);

            const syncLangMenuUI = () => {
                menu.querySelectorAll('.header-lang-option').forEach((option) => {
                    option.classList.toggle('is-active', option.dataset.lang === currentLanguage);
                });
            };

            syncLangMenuUI();
            onLanguageChange(syncLangMenuUI);

            button.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                const shouldOpen = !menu.classList.contains('is-open');
                closeAllLangMenus();
                menu.classList.toggle('is-open', shouldOpen);
            });

            menu.addEventListener('click', (event) => {
                event.stopPropagation();
                const langOption = event.target.closest('.header-lang-option');
                if (!langOption) return;
                setLanguage(langOption.dataset.lang);
                closeAllLangMenus();
            });
        });

        document.addEventListener('click', (event) => {
            if (!event.target.closest('.header-lang-wrap')) {
                closeAllLangMenus();
            }
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                closeAllLangMenus();
            }
        });

        applyStaticLanguage();
    };

    const applyOfficialHeaderFooter = () => {
        const path = window.location.pathname.replace(/\\/g, '/');
        const inPagesFolder = path.includes('/pages/');
        const rootPrefix = inPagesFolder ? '../' : '';

        const indexPath = `${rootPrefix}index.html`;
        const discoverPath = `${rootPrefix}discover.html`;
        const pagePath = (pageName) => (inPagesFolder ? `${pageName}.html` : `pages/${pageName}.html`);

        const announcementHtml = `
            <div class="top-announcement text-center py-2 text-sm font-medium tracking-wide">
                <div class="top-announcement-marquee">
                    <span class="top-announcement-marquee-item">Niche to designer, find your signature scent today. <a href="${discoverPath}?filter=all" class="top-announcement-link" data-announcement-target="all">SHOP COLLECTION</a></span>
                    <span class="top-announcement-marquee-item">Fresh drops just landed in our perfume edit. <a href="${discoverPath}?filter=new-in" class="top-announcement-link" data-announcement-target="new-in">EXPLORE NEW IN</a></span>
                    <span class="top-announcement-marquee-item" aria-hidden="true">Niche to designer, find your signature scent today. <a href="${discoverPath}?filter=all" class="top-announcement-link" data-announcement-target="all">SHOP COLLECTION</a></span>
                    <span class="top-announcement-marquee-item" aria-hidden="true">Fresh drops just landed in our perfume edit. <a href="${discoverPath}?filter=new-in" class="top-announcement-link" data-announcement-target="new-in">EXPLORE NEW IN</a></span>
                </div>
            </div>
        `;

        const mobileSearchHtml = `
            <div class="header-mobile-search md:hidden px-4 sm:px-6 lg:px-8 pb-4" aria-hidden="true">
                <div class="relative">
                    <input type="text" class="w-full bg-white text-gray-900 rounded-full py-2.5 pl-5 pr-12 focus:outline-none focus:ring-2 focus:ring-brand-red" placeholder="Search for perfumes, brands..." data-discover-search>
                    <button class="absolute right-0 top-0 mt-2.5 mr-4 text-gray-500 hover:text-brand-red" aria-label="Search">
                        <i class="fas fa-search"></i>
                    </button>
                </div>
            </div>
        `;

        const headerHtml = `
            <header class="bg-brand-dark text-white sticky top-0 z-50">
                <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div class="flex items-center justify-between h-20">
                        <div class="flex-shrink-0 flex items-center">
                            <a href="${indexPath}" class="font-serif text-3xl font-bold tracking-widest text-white brand-logo-animated" aria-label="IPORDISE">
                                <span class="sr-only">IPORDISE</span>
                                <span class="brand-logo-word" aria-hidden="true">
                                    <span class="brand-logo-letter">I</span>
                                    <span class="brand-logo-letter">P</span>
                                    <span class="brand-logo-letter">O</span>
                                    <span class="brand-logo-letter">R</span>
                                    <span class="brand-logo-letter">D</span>
                                    <span class="brand-logo-letter">I</span>
                                    <span class="brand-logo-letter">S</span>
                                    <span class="brand-logo-letter">E</span>
                                </span>
                                <span class="brand-logo-dot" aria-hidden="true"></span>
                            </a>
                        </div>

                        <div class="flex-1 max-w-2xl mx-8 hidden md:block">
                            <button type="button" class="ipo-search-trigger-btn" id="ipoSearchTriggerDesktop" aria-label="Open search">
                                <i class="fas fa-search ipo-search-trigger-icon"></i>
                                <span class="ipo-search-trigger-text">Search perfumes, brands, notes...</span>
                            </button>
                        </div>

                        <div class="flex items-center gap-3 md:gap-6">
                            <a href="${indexPath}#newArrivalsCarousel" class="hidden lg:inline-flex bg-brand-red hover:bg-brand-redHover text-white px-4 py-2 rounded-full text-sm font-bold transition duration-200">
                                NEW COLLECTION <i class="fas fa-chevron-right ml-2 text-xs"></i>
                            </a>

                            <div class="flex items-center gap-2 md:gap-3 text-lg">
                                <button class="header-lang-btn hover:text-brand-red transition flex items-center text-xs md:text-sm font-semibold">
                                    <span class="mr-1">EN</span> <i class="fas fa-chevron-down text-[10px]"></i>
                                </button>
                                <button class="header-icon-btn header-search-btn md:hidden hover:text-brand-red transition" aria-label="Search">
                                    <i class="fas fa-search"></i>
                                </button>
                                <a href="${pagePath('login')}" class="header-icon-btn hover:text-brand-red transition" aria-label="Account"><i class="far fa-user"></i></a>
                                <a href="#" class="header-icon-btn hover:text-brand-red transition" aria-label="Wishlist"><i class="far fa-heart"></i></a>
                                <a href="${pagePath('cart')}" class="header-icon-btn hover:text-brand-red transition relative" aria-label="Cart">
                                    <i class="fas fa-shopping-bag"></i>
                                </a>
                            </div>
                        </div>
                    </div>
                </div>

                ${mobileSearchHtml}

                <nav class="perfume-nav hidden md:block">
                    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <ul class="perfume-nav-list">
                            <li><a href="${discoverPath}?filter=all" class="perfume-nav-link is-active">ALL PERFUMES</a></li>
                            <li><a href="${discoverPath}?filter=for-men" class="perfume-nav-link">MEN</a></li>
                            <li><a href="${discoverPath}?filter=for-women" class="perfume-nav-link">WOMEN</a></li>
                            <li><a href="${discoverPath}?filter=unisex" class="perfume-nav-link">UNISEX</a></li>
                            <li><a href="${discoverPath}?filter=niche" class="perfume-nav-link">NICHE</a></li>
                            <li><a href="${discoverPath}?filter=arabian" class="perfume-nav-link">ARABIAN</a></li>
                            <li><a href="${discoverPath}?filter=designer" class="perfume-nav-link">DESIGNER</a></li>
                            <li><a href="${discoverPath}?filter=discovery-sets" class="perfume-nav-link">DISCOVERY SETS</a></li>
                            <li><a href="${discoverPath}?filter=best-sellers" class="perfume-nav-link">BEST SELLERS</a></li>
                            <li><a href="${discoverPath}?filter=new-in" class="perfume-nav-link">NEW IN</a></li>
                            <li><a href="${discoverPath}?filter=offers" class="perfume-nav-link">OFFERS</a></li>
                        </ul>
                    </div>
                </nav>
            </header>
        `;

        const footerHtml = `
            <footer class="bg-brand-dark text-white pt-16 pb-8">
                <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div class="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
                        <div>
                            <h3 class="font-serif text-2xl font-bold mb-6">IPORDISE<span class="text-brand-red">.</span></h3>
                            <p class="text-gray-400 text-sm mb-6" data-i18n="footer.tagline">The ultimate destination for luxury fragrances, cosmetics, and beauty care online. Elevate your everyday routine.</p>
                            <div class="flex space-x-3">
                                <a href="https://www.instagram.com/ipordise_parfums/" target="_blank" rel="noopener noreferrer" aria-label="IPORDISE on Instagram" class="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-brand-red transition text-sm"><i class="fab fa-instagram"></i></a>
                                <a href="https://www.facebook.com/profile.php?id=61563285998567&ref=NONE_xav_ig_profile_page_web#" target="_blank" rel="noopener noreferrer" class="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-brand-red transition text-sm"><i class="fab fa-facebook-f"></i></a>
                                <a href="https://www.tiktok.com/@ipordise_parfume?_r=1&_t=ZS-94xrj0k1Pjp" target="_blank" rel="noopener noreferrer" aria-label="IPORDISE on TikTok" class="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-brand-red transition text-sm"><i class="fab fa-tiktok"></i></a>
                            </div>
                        </div>
                        <div>
                            <h4 class="font-bold text-lg mb-4" data-i18n="footer.customer_service">Customer Care</h4>
                            <ul class="space-y-2 text-gray-400 text-sm">
                                <li><a href="${pagePath('contact')}" class="hover:text-white transition" data-i18n="footer.contact">Contact Us</a></li>
                                <li><a href="${pagePath('shipping')}" class="hover:text-white transition" data-i18n="footer.shipping_returns">Shipping &amp; Returns</a></li>
                                <li><a href="${pagePath('track-order')}" class="hover:text-white transition" data-i18n="footer.track_order">Track Order</a></li>
                                <li><a href="${pagePath('faq')}" class="hover:text-white transition" data-i18n="footer.faq">FAQ</a></li>
                                <li><a href="${pagePath('how-to-order')}" class="hover:text-white transition">How to Order</a></li>
                            </ul>
                        </div>
                        <div>
                            <h4 class="font-bold text-lg mb-4" data-i18n="footer.about">About</h4>
                            <ul class="space-y-2 text-gray-400 text-sm">
                                <li><a href="${pagePath('our-story')}" class="hover:text-white transition" data-i18n="footer.our_story">Our Story</a></li>
                                <li><a href="${pagePath('careers')}" class="hover:text-white transition" data-i18n="footer.careers">Careers</a></li>
                                <li><a href="${pagePath('store-locator')}" class="hover:text-white transition" data-i18n="footer.find_store">Find a Store</a></li>
                                <li><a href="${pagePath('terms')}" class="hover:text-white transition" data-i18n="footer.terms">Terms &amp; Conditions</a></li>
                            </ul>
                        </div>
                        <div>
                            <h4 class="font-bold text-lg mb-4" data-i18n="footer.newsletter_title">Newsletter</h4>
                            <p class="text-gray-400 text-sm mb-4" data-i18n="footer.newsletter_desc">Subscribe to receive new arrivals, beauty tips, and more.</p>
                            <form class="flex" data-footer-newsletter-form action="${pagePath('newsletter')}" method="get">
                                <input name="email" type="email" placeholder="Your email address" data-i18n-placeholder="footer.newsletter_ph2" class="bg-white/10 text-white placeholder-gray-500 px-4 py-2 rounded-l w-full focus:outline-none focus:ring-1 focus:ring-brand-red">
                                <button type="submit" class="bg-brand-red px-4 py-2 rounded-r font-bold hover:bg-brand-redHover transition" data-i18n="footer.subscribe_btn">SUBSCRIBE</button>
                            </form>
                        </div>
                    </div>
                    <div class="border-t border-white/10 pt-8 pb-0 text-center text-gray-500 text-sm">
                        <p data-i18n="footer.copyright">&copy; 2026 IPORDISE. All rights reserved.</p>
                        <p class="mt-1 text-gray-500 text-xs">Created by <a href="https://wa.me/212699289568" target="_blank" rel="noopener noreferrer" class="text-brand-red hover:text-white transition font-semibold">Zakaria Zemzami</a></p>
                    </div>
                </div>
            </footer>
        `;

        const announcementEl = document.querySelector('.top-announcement, body > div.bg-brand-red.text-white.text-center.py-2');
        if (announcementEl) {
            announcementEl.outerHTML = announcementHtml;
        } else {
            document.body.insertAdjacentHTML('afterbegin', announcementHtml);
        }

        const headerEl = document.querySelector('header');
        if (headerEl) {
            headerEl.outerHTML = headerHtml;
        }

        const footerEl = document.querySelector('footer');
        if (footerEl) {
            footerEl.outerHTML = footerHtml;
        }

        document.querySelectorAll('[data-footer-newsletter-form]').forEach((form) => {
            form.addEventListener('submit', (event) => {
                const emailInput = form.querySelector('input[name="email"]');
                const value = String(emailInput?.value || '').trim();
                if (!value) {
                    event.preventDefault();
                    window.location.href = form.getAttribute('action') || '';
                    return;
                }
                if (emailInput && !emailInput.checkValidity()) {
                    event.preventDefault();
                    return;
                }
            });
        });
    };

    const normalizeLegacyFrenchContent = () => {
        const phraseReplacements = [
            ['Accueil', 'Home'],
            ['Découvrir la collection', 'Discover Collection'],
            ['Découvrez notre collection', 'Discover Our Collection'],
            ['Ajouter au panier', 'Add to Cart'],
            ['Livraison & Expédition', 'Shipping & Delivery'],
            ['Livraison & Retours', 'Shipping & Returns'],
            ['Retours & Remboursements', 'Returns & Refunds'],
            ['Paiement sécurisé', 'Secure Checkout'],
            ['Parfums Homme', 'Men\'s Fragrances'],
            ['Parfums Femme', 'Women\'s Fragrances'],
            ['Nouveautés', 'New Arrivals'],
            ['Voir toutes les nouveautés', 'View all new arrivals'],
            ['Nos catégories', 'Our Categories'],
            ['Découvrez nos collections par genre', 'Discover our collections by gender'],
            ['Votre e-mail', 'Your email'],
            ['Votre adresse e-mail', 'Your email address'],
            ['S\'abonner', 'Subscribe'],
            ['S\'ABONNER', 'SUBSCRIBE'],
            ['Tous droits réservés.', 'All rights reserved.'],
            ['Service Client', 'Customer Care'],
            ['Contactez-nous', 'Contact Us'],
            ['Suivre la commande', 'Track Order'],
            ['À Propos', 'About'],
            ['Notre Histoire', 'Our Story'],
            ['Carrières', 'Careers'],
            ['Trouver un magasin', 'Find a Store'],
            ['Conditions Générales', 'Terms & Conditions'],
            ['Politique de confidentialité', 'Privacy Policy'],
            ['HOMME', 'MEN'],
            ['WOHOMME', 'WOMEN'],
            ['Femme', 'Female'],
            ['Homme', 'Male'],
            ['Autre', 'Other'],
            ['Vérifier', 'Checkout'],
            ['Récapitulatif de commande', 'Order Summary'],
            ['Taxe estimée', 'Estimated Tax']
        ];

        const replacePhrase = (value) => {
            if (!value || typeof value !== 'string') return value;
            let output = value;
            phraseReplacements.forEach(([from, to]) => {
                output = output.split(from).join(to);
            });
            return output;
        };

        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
            acceptNode(node) {
                const parentTag = node.parentElement?.tagName;
                if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
                if (parentTag === 'SCRIPT' || parentTag === 'STYLE' || parentTag === 'NOSCRIPT') return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
            }
        });

        const textNodes = [];
        while (walker.nextNode()) {
            textNodes.push(walker.currentNode);
        }

        textNodes.forEach((node) => {
            const updatedText = replacePhrase(node.nodeValue);
            if (updatedText !== node.nodeValue) {
                node.nodeValue = updatedText;
            }
        });

        document.querySelectorAll('input[placeholder], textarea[placeholder]').forEach((field) => {
            const currentPlaceholder = field.getAttribute('placeholder') || '';
            const updatedPlaceholder = replacePhrase(currentPlaceholder);
            if (updatedPlaceholder !== currentPlaceholder) {
                field.setAttribute('placeholder', updatedPlaceholder);
            }
        });

        document.querySelectorAll('[aria-label]').forEach((element) => {
            const currentLabel = element.getAttribute('aria-label') || '';
            const updatedLabel = replacePhrase(currentLabel);
            if (updatedLabel !== currentLabel) {
                element.setAttribute('aria-label', updatedLabel);
            }
        });
    };

    const initHeroOfferRotator = () => {
        const card = document.querySelector('[data-hero-rotate]');
        if (!card) return;

        const titleEl = card.querySelector('[data-hero-title]');
        const subEl = card.querySelector('[data-hero-sub]');
        if (!titleEl || !subEl) return;

        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const messages = [
            {
                title: 'TOP PICKS',
                subtitle: 'Signature scents for day,<br>night & special moments.',
                tints: ['rgba(12, 20, 44, 0.76)', 'rgba(18, 32, 72, 0.42)']
            },
            {
                title: 'NEW ARRIVALS',
                subtitle: 'Fresh launches curated for<br>elevated daily rituals.',
                tints: ['rgba(20, 24, 44, 0.78)', 'rgba(38, 52, 86, 0.42)']
            },
            {
                title: 'BEST SELLERS',
                subtitle: 'The most loved perfumes,<br>chosen by our community.',
                tints: ['rgba(16, 22, 38, 0.78)', 'rgba(28, 42, 74, 0.44)']
            },
            {
                title: 'NIGHT VIBES',
                subtitle: 'Bold, magnetic trails<br>for evenings out.',
                tints: ['rgba(18, 16, 40, 0.78)', 'rgba(36, 28, 70, 0.44)']
            },
            {
                title: 'SIGNATURE SCENTS',
                subtitle: 'Timeless perfumes to define<br>your presence.',
                tints: ['rgba(14, 22, 40, 0.78)', 'rgba(30, 44, 76, 0.44)']
            }
        ];

        let index = 0;
        const intervalMs = 3800;
        const transitionMs = 600;

        const applyMessage = (message, animate = true) => {
            card.style.setProperty('--hero-tint-1', message.tints[0]);
            card.style.setProperty('--hero-tint-2', message.tints[1]);
            if (!animate) {
                titleEl.textContent = message.title;
                subEl.innerHTML = message.subtitle;
                return;
            }

            card.classList.add('is-updating');
            window.setTimeout(() => {
                titleEl.textContent = message.title;
                subEl.innerHTML = message.subtitle;
                card.classList.remove('is-updating');
            }, Math.round(transitionMs * 0.6));
        };

        applyMessage(messages[index], false);

        if (prefersReducedMotion) return;

        window.setInterval(() => {
            index = (index + 1) % messages.length;
            applyMessage(messages[index]);
        }, intervalMs);
    };

    const initProductBadgeRotation = () => {
        const flashCarousel = document.getElementById('productCarousel');
        if (!flashCarousel) return;

        const DAY_MS = 24 * 60 * 60 * 1000;
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        const stateClasses = [
            'badge-state-new',
            'badge-state-seller',
            'badge-state-offer',
            'badge-state-hot',
            'badge-state-trend'
        ];

        const rotatingLabelSets = [
            ['NEW', 'BEST SELLER', 'BEST OFFER'],
            ['NEW', 'HOT PICK', 'BEST SELLER'],
            ['NEW', 'BEST OFFER', 'TOP TREND'],
            ['NEW', 'LIMITED DEAL', 'HOT PICK']
        ];

        const getBadgeStateClass = (label) => {
            const normalized = (label || '').toLowerCase();
            if (normalized.includes('offer') || normalized.includes('deal')) return 'badge-state-offer';
            if (normalized.includes('seller')) return 'badge-state-seller';
            if (normalized.includes('hot')) return 'badge-state-hot';
            if (normalized.includes('trend')) return 'badge-state-trend';
            return 'badge-state-new';
        };

        const hashString = (value) => {
            let hash = 0;
            for (let i = 0; i < value.length; i += 1) {
                hash = ((hash << 5) - hash) + value.charCodeAt(i);
                hash |= 0;
            }
            return Math.abs(hash);
        };

        const clearBadgeTimer = (badge) => {
            if (badge.dataset.badgeTimerId) {
                window.clearInterval(Number(badge.dataset.badgeTimerId));
                badge.dataset.badgeTimerId = '';
            }
        };

        const applyDailyBadgeSelection = () => {
            const cards = Array.from(flashCarousel.querySelectorAll('.js-product-link'));
            if (!cards.length) return;

            const cardBadges = cards
                .map((card) => {
                    const badge = card.querySelector('span.absolute.top-4.left-4');
                    if (!badge) return null;
                    return { card, badge };
                })
                .filter(Boolean);

            if (!cardBadges.length) return;

            const dayKey = Math.floor(Date.now() / DAY_MS);
            const rotatingCount = Math.min(3, cardBadges.length);

            const firstBadge = cardBadges[0];
            const remainingPool = cardBadges.slice(1);
            const remainingNeeded = Math.max(0, rotatingCount - 1);

            const dailySelected = [...remainingPool]
                .sort((a, b) => {
                    const keyA = `${a.card.dataset.productName || ''}-${dayKey}`;
                    const keyB = `${b.card.dataset.productName || ''}-${dayKey}`;
                    return hashString(keyA) - hashString(keyB);
                })
                .slice(0, remainingNeeded);

            const selected = firstBadge ? [firstBadge, ...dailySelected] : dailySelected;

            const selectedSet = new Set(selected.map((item) => item.badge));

            cardBadges.forEach(({ badge }) => {
                badge.classList.add('product-rotating-badge');
                clearBadgeTimer(badge);
                badge.classList.remove('is-switching', ...stateClasses);

                if (!selectedSet.has(badge)) {
                    badge.textContent = 'NEW';
                    badge.classList.add('badge-state-new');
                }
            });

            selected.forEach(({ badge }, index) => {
                const labels = rotatingLabelSets[index % rotatingLabelSets.length];
                let activeIndex = 0;

                const renderBadge = (nextIndex, animate = true) => {
                    activeIndex = nextIndex % labels.length;
                    const nextLabel = labels[activeIndex];

                    const applyVisual = () => {
                        badge.textContent = nextLabel;
                        badge.classList.remove(...stateClasses);
                        badge.classList.add(getBadgeStateClass(nextLabel));
                    };

                    if (!animate || prefersReducedMotion) {
                        applyVisual();
                        return;
                    }

                    badge.classList.add('is-switching');
                    window.setTimeout(() => {
                        applyVisual();
                    }, 160);
                    window.setTimeout(() => {
                        badge.classList.remove('is-switching');
                    }, 420);
                };

                renderBadge(activeIndex, false);

                const timerId = window.setInterval(() => {
                    renderBadge(activeIndex + 1, true);
                }, 2900 + (index * 260));
                badge.dataset.badgeTimerId = String(timerId);
            });
        };

        applyDailyBadgeSelection();

        const msUntilNextDay = DAY_MS - (Date.now() % DAY_MS) + 200;
        window.setTimeout(() => {
            applyDailyBadgeSelection();
            window.setInterval(applyDailyBadgeSelection, DAY_MS);
        }, msUntilNextDay);
    };

    const normalizeImagePathForCurrentPage = (imageSrc) => {
        if (!imageSrc) return '';
        if (/^(https?:)?\/\//.test(imageSrc) || imageSrc.startsWith('data:') || imageSrc.startsWith('/')) {
            return imageSrc;
        }

        const inPagesFolder = window.location.pathname.replace(/\\/g, '/').includes('/pages/');

        if (inPagesFolder && imageSrc.startsWith('assets/')) {
            return `../${imageSrc}`;
        }

        if (!inPagesFolder && imageSrc.startsWith('../assets/')) {
            return imageSrc.replace('../', '');
        }

        return imageSrc;
    };

    const getProductPagePath = () => {
        const inPagesFolder = window.location.pathname.replace(/\\/g, '/').includes('/pages/');
        return inPagesFolder ? 'product.html' : 'pages/product.html';
    };

    const canonicalProductName = (name) => (name || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();

    const splitSizeAndPrice = (value, fallbackPriceText = '') => {
        const normalized = String(value || '').trim();
        const separator = normalized.includes('—') ? '—' : '-';
        const parts = normalized.split(separator).map((part) => part.trim()).filter(Boolean);

        if (parts.length >= 2) {
            return {
                label: parts[0],
                priceText: parts.slice(1).join(' - ').trim()
            };
        }

        return {
            label: normalized,
            priceText: String(fallbackPriceText || '').trim()
        };
    };

    const normalizeSizeOptionEntry = (entry, fallbackPriceText = '') => {
        if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
            const parsed = splitSizeAndPrice(entry.label || entry.size || '', '');
            const label = String(entry.label || entry.size || parsed.label || '').trim();
            const priceText = String(entry.priceText || entry.price || parsed.priceText || fallbackPriceText || '').trim();
            const volumeLabel = label.replace(/decante\s*/i, '').trim();
            const normalizedVolumeKey = normalizeSizeLabelToKey(volumeLabel);
            return {
                label,
                priceText,
                isDecante: ['10ml', '20ml', '30ml'].includes(normalizedVolumeKey),
                volumeLabel
            };
        }

        const parsed = splitSizeAndPrice(entry, fallbackPriceText);
        const volumeLabel = parsed.label.replace(/decante\s*/i, '').trim();
        const normalizedVolumeKey = normalizeSizeLabelToKey(volumeLabel);
        return {
            label: parsed.label,
            priceText: parsed.priceText,
            isDecante: ['10ml', '20ml', '30ml'].includes(normalizedVolumeKey),
            volumeLabel
        };
    };

    const normalizeSizeLabelToKey = (label) => String(label || '')
        .trim()
        .toLowerCase()
        .replace(/decante\s*/i, '')
        .replace(/\s+/g, '');

    const productDetailOverrides = {
        'bleu de chanel eau de parfum spray': {
            brand: 'CHANEL',
            gender: 'men',
            fragranceProfile: { longevity: 85, longevityLabel: '8-10h', sillage: 75, sillageLabel: 'Strong', season: 90, seasonLabel: 'All Year' },
            subtitle: "Men's fragrance · Aromatic Woody · A timeless and magnetic signature with a subtly pronounced aroma.",
            longDescription: 'A tribute to freedom, expressed in an aromatic woody scent with a captivating trail. A timeless fragrance in a bottle of deep, mysterious blue. The Eau de Parfum of BLEU DE CHANEL, with its subtly pronounced aroma, reveals a determined spirit.',
            sizes: [
                'Decante 10ML',
                'Decante 20ML',
                'Decante 30ML',
                '50ML',
                '100ML',
                '150ML'
            ],
            notes: [
                {
                    title: 'AROMATIC OPENING',
                    text: 'A fresh and vibrant opening that expresses energy and freedom.'
                },
                {
                    title: 'WOODY HEART',
                    text: 'A structured woody core that feels elegant, modern, and confident.'
                },
                {
                    title: 'CAPTIVATING TRAIL',
                    text: 'A subtly pronounced signature that lingers with timeless depth.'
                }
            ],
            fr: {
                subtitle: "Parfum homme · Boisé Aromatique · Une signature intemporelle et magnétique à l'arôme subtilement prononcé.",
                longDescription: "Un hymne à la liberté, exprimé dans un sillage boisé aromatique envoûtant. Un parfum intemporel dans un flacon d'un bleu profond et mystérieux. L'Eau de Parfum BLEU DE CHANEL, à l'arôme subtilement prononcé, révèle un esprit déterminé.",
                notes: [
                    { title: 'OUVERTURE AROMATIQUE', text: 'Une ouverture fraîche et vibrante qui exprime énergie et liberté.' },
                    { title: 'CŒUR BOISÉ', text: 'Un noyau boisé structuré qui dégage élégance, modernité et assurance.' },
                    { title: 'SILLAGE CAPTIVANT', text: 'Une signature subtilement prononcée qui persiste avec une profondeur intemporelle.' }
                ]
            },
            images: [
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/BLEU%20DE%20CHANEL%20Eau%20de%20Parfum%20spray/2.jpg',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/BLEU%20DE%20CHANEL%20Eau%20de%20Parfum%20spray/3.jpg',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/BLEU%20DE%20CHANEL%20Eau%20de%20Parfum%20spray/4.jpg'
            ]
        },
        'hugo boss the scent for him elixir': {
            brand: 'HUGO BOSS',
            gender: 'men',
            fragranceProfile: { longevity: 90, longevityLabel: '10-12h', sillage: 80, sillageLabel: 'Strong', season: 60, seasonLabel: 'Fall/Winter' },
            subtitle: "Men's fragrance · Amber Woody Leather · A highly concentrated elixir with spicy chili pepper, lavandin absolute, and warm sandalwood.",
            longDescription: 'Awaken your senses with BOSS The Scent Elixir for Men, a captivating and highly concentrated intense fragrance that symbolizes the powerful alchemy between two unique partners. Taking the intensity of BOSS The Scent to new heights, this amber, woody, and leathery fragrance combines vibrant contrasts to deliver irresistible allure. The composition opens with a burst of spicy chili pepper, providing a complex and stimulating touch, while lavandin absolute adds freshness and vitality. At the base, Caledonian sandalwood infuses a warm, woody depth, leaving a deeply enveloping and unforgettable trail. BOSS The Scent Elixir for Men redefines sensuality in a sophisticated bottle lacquered in an intense red, adorned with the BOSS logo and an elegant gold cap with the Double B monogram. Its multifaceted design and vibrant hue reflect the magnetic and seductive essence of this fragrance, highlighting the many facets of an irresistible connection.',
            sizes: [
                'Decante 10ML',
                'Decante 20ML',
                'Decante 30ML',
                '50ML',
                '100ML'
            ],
            notes: [
                {
                    title: 'CHILI PEPPER BURST',
                    text: 'A vivid spicy opening that feels hot, stimulating, and immediately magnetic.'
                },
                {
                    title: 'LAVANDIN ABSOLUTE',
                    text: 'Aromatic lavandin brings freshness and balance to the heart with refined masculine clarity.'
                },
                {
                    title: 'CALEDONIAN SANDALWOOD',
                    text: 'Warm sandalwood anchors the base with creamy woody depth and a deeply sensual trail.'
                }
            ],
            fr: {
                subtitle: "Parfum homme · Boisé Ambré Cuir · Un élixir hautement concentré aux notes de poivre de chili, lavandin absolu et santal chaud.",
                longDescription: "Éveillez vos sens avec BOSS The Scent Elixir pour Homme, un parfum intense et hautement concentré symbolisant la puissante alchimie entre deux partenaires uniques. Poussant l'intensité de BOSS The Scent vers de nouveaux sommets, ce parfum ambré, boisé et cuiré combine des contrastes vibrants pour une séduction irrésistible. La composition s'ouvre sur un éclat de poivre de chili épicé, tandis que le lavandin absolu apporte fraîcheur et vitalité. En fond, le santal calédonien infuse une profondeur boisée chaude, laissant un sillage enveloppant et inoubliable.",
                notes: [
                    { title: 'EXPLOSION DE POIVRE DE CHILI', text: 'Une ouverture épicée et vive, chaude, stimulante et immédiatement magnétique.' },
                    { title: 'LAVANDIN ABSOLU', text: 'Le lavandin aromatique apporte fraîcheur et équilibre au cœur avec une clarté masculine raffinée.' },
                    { title: 'SANTAL CALÉDONIEN', text: 'Le santal chaud ancre le fond avec une profondeur boisée crémeuse et un sillage sensuellement profond.' }
                ]
            },
            images: [
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Hugo%20Boss%20The%20Scent%20For%20Him%20Elixir/2.png',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Hugo%20Boss%20The%20Scent%20For%20Him%20Elixir/3.png',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Hugo%20Boss%20The%20Scent%20For%20Him%20Elixir/4.png',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Hugo%20Boss%20The%20Scent%20For%20Him%20Elixir/5.png'
            ]
        },
        'boss bottled absolu intense': {
            brand: 'HUGO BOSS',
            gender: 'men',
            fragranceProfile: { longevity: 92, longevityLabel: '10-12h', sillage: 82, sillageLabel: 'Strong', season: 55, seasonLabel: 'Fall/Winter' },
            subtitle: "Men's fragrance · Woody Leather · A bold intense signature with toasted leather, frankincense, patchouli, myrrh, cedarwood, and davana.",
            longDescription: 'Express ultimate sophistication with BOSS Bottled Absolu, a bold and intense fragrance with irresistible toasted notes. Modern and memorable, this distinctive scent embodies the power of the BOSS man, who brings his unique touch to every decision, every challenge, and every success. This woody fragrance with leathery notes, the third installment in the BOSS BOTTLED trilogy of intensity, instantly captivates the senses. A captivating scent from BOSS, formulated with the highest concentration in the fragrance family to date, crafted from its quintessential woody signature with absolute depth: the very essence of BOSS. BOSS Bottled Absolu, created by Annick Menardo in collaboration with Suzy Le Helley, opens smoothly with a textured leather accord with toasty facets, in harmony with the invigorating essence of frankincense. At the heart of this BOSS fragrance for men, the enveloping essence of patchouli and myrrh absolute exalt the strength and splendor of a sophisticated aroma. The warm cedarwood and fruity davana base notes leave a lasting and exquisite trail. The unique bottle of BOSS Bottled is imbued with richness, featuring a warm, luminous amber base that evokes the nobility of the tempting and exquisite fragrance within. A double lacquer finish and a gleaming gold cap complete the exquisite presentation of this woody men\'s fragrance, the perfect accessory for the positive BOSS attitude.',
            sizes: [
                'Decante 10ML',
                'Decante 20ML',
                'Decante 30ML',
                '50ML',
                '100ML'
            ],
            notes: [
                {
                    title: 'TOASTED LEATHER & FRANKINCENSE',
                    text: 'A textured opening where smooth leather meets luminous frankincense for an intense and sophisticated start.'
                },
                {
                    title: 'PATCHOULI & MYRRH ABSOLUTE',
                    text: 'A rich heart of patchouli and myrrh absolute builds depth, strength, and elegant aromatic warmth.'
                },
                {
                    title: 'CEDARWOOD & DAVANA',
                    text: 'Warm cedarwood and fruity davana create a refined base with lasting richness and a memorable trail.'
                }
            ],
            fr: {
                subtitle: "Parfum homme · Boisé Cuir · Une signature intense et audacieuse aux notes de cuir grillé, encens, patchouli, myrrhe, cèdre et davana.",
                longDescription: "Exprimez la sophistication ultime avec BOSS Bottled Absolu, un parfum audacieux et intense aux irrésistibles notes grillées. Moderne et mémorable, ce parfum distinctif incarne la puissance de l'homme BOSS. Ce troisième volet de la trilogie BOSS BOTTLED Intensité s'ouvre en douceur sur un accord de cuir texturé aux facettes grillées, en harmonie avec l'essence revigorante de l'encens. Au cœur, le patchouli et la myrrhe absolue exaltent la force et la splendeur d'un arôme sophistiqué. Les notes de fond de cèdre chaud et de davana fruitée laissent un sillage durable et exquis.",
                notes: [
                    { title: 'CUIR GRILLÉ & ENCENS', text: "Une ouverture texturée où le cuir lisse rencontre l'encens lumineux pour un début intense et sophistiqué." },
                    { title: 'PATCHOULI & MYRRHE ABSOLUE', text: 'Un cœur riche de patchouli et myrrhe absolue construit profondeur, force et chaleur aromatique élégante.' },
                    { title: 'CÈDRE & DAVANA', text: 'Le cèdre chaud et la davana fruitée créent un fond raffiné avec une richesse durable et un sillage mémorable.' }
                ]
            },
            images: [
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Boss%20Bottled%20Absolu%20Intense/2.jpeg',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Boss%20Bottled%20Absolu%20Intense/3.jpeg',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Boss%20Bottled%20Absolu%20Intense/4.jpeg',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Boss%20Bottled%20Absolu%20Intense/5.jpeg',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Boss%20Bottled%20Absolu%20Intense/6.jpeg'
            ]
        },
        'hugo boss boss bottled elixir intense': {
            brand: 'HUGO BOSS',
            gender: 'men',
            fragranceProfile: { longevity: 92, longevityLabel: '10-12h', sillage: 84, sillageLabel: 'Strong', season: 55, seasonLabel: 'Fall/Winter' },
            subtitle: "Men's fragrance · Woody Amber · A highly concentrated elixir with incense, cardamom, vetiver, patchouli, cedar, and cistus absolute.",
            longDescription: 'Experience intensity at its peak. A sophisticated and highly concentrated formula, BOSS Bottled Elixir inspires you to find your inner light and become your own BOSS. This exquisite men\'s fragrance, capturing a high-impact woody and amber scent of BOSS Bottled, features warm top notes of incense and cardamom, a tempting heart of vetiver and patchouli, and a base of cedar essence. Launched 25 years after the original BOSS Bottled, BOSS Bottled Elixir reinterprets a fragrance icon with a vigorous statement, promising unparalleled depth and an enveloping experience. Created by the iconic master perfumer Annick Menardo, creator of the signature BOSS Bottled fragrance, in close collaboration with perfumer Suzy le Helley, this irresistible fragrance celebrates the reinvention of a contemporary classic. The Elixir exudes an incredibly captivating fragrance, rich in highly concentrated ingredients. The essences of frankincense and cardamom radiate warmth and vitality, while the heart of vetiver and patchouli leaves an earthy and unforgettable imprint. With a base of cedar essence and cistus absolute, BOSS Bottled Elixir gives the wearer a strong charisma with woody notes and an explosion of fearless virility. The exclusive BOSS Bottled glass bottle features an intense black lacquered finish that gives way to a golden glow at the center, like a guide for the spirit of the modern BOSS man in the search for his inner light. Its glossy ceramic finish and gold-colored brushed cap further enhance the elegance of this new creation in the BOSS Bottled universe.',
            sizes: [
                'Decante 10ML',
                'Decante 20ML',
                'Decante 30ML',
                '50ML',
                '100ML'
            ],
            notes: [
                {
                    title: 'INCENSE & CARDAMOM',
                    text: 'Warm frankincense and cardamom open the scent with radiant spice, vitality, and immediate presence.'
                },
                {
                    title: 'VETIVER & PATCHOULI',
                    text: 'An earthy heart of vetiver and patchouli builds depth, structure, and an unforgettable masculine imprint.'
                },
                {
                    title: 'CEDAR & CISTUS ABSOLUTE',
                    text: 'Cedar essence and cistus absolute create a powerful woody base with strong charisma and lasting intensity.'
                }
            ],
            fr: {
                subtitle: "Parfum homme · Boisé Ambré · Un élixir hautement concentré à l'encens, à la cardamome, au vétiver, au patchouli, au cèdre et au ciste absolu.",
                longDescription: "Vivez l'intensité à son apogée. Une formule sophistiquée et hautement concentrée, BOSS Bottled Elixir vous inspire à trouver votre lumière intérieure. Ce parfum masculin exquis, au sillage boisé ambré puissant, sublime les notes d'encens et de cardamome, un cœur séduisant de vétiver et patchouli, et un fond d'essence de cèdre. Lancé 25 ans après le BOSS Bottled original, BOSS Bottled Elixir réinterprète une icône olfactive avec une affirmation vigoureuse, promettant une profondeur inégalée et une expérience enveloppante.",
                notes: [
                    { title: 'ENCENS & CARDAMOME', text: "L'encens chaud et la cardamome ouvrent le parfum avec une épice rayonnante, de la vitalité et une présence immédiate." },
                    { title: 'VÉTIVER & PATCHOULI', text: 'Un cœur terreux de vétiver et patchouli construit profondeur, structure et une empreinte masculine inoubliable.' },
                    { title: 'CÈDRE & CISTE ABSOLU', text: "L'essence de cèdre et le ciste absolu créent un fond boisé puissant avec un fort charisme et une intensité durable." }
                ]
            },
            images: [
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Hugo%20Boss%20Boss%20Bottled%20Elixir%20Intense/2.jpeg',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Hugo%20Boss%20Boss%20Bottled%20Elixir%20Intense/3.jpg',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Hugo%20Boss%20Boss%20Bottled%20Elixir%20Intense/4.jpg',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Hugo%20Boss%20Boss%20Bottled%20Elixir%20Intense/5.jpg',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Hugo%20Boss%20Boss%20Bottled%20Elixir%20Intense/6.jpg'
            ]
        },
        'guerlain l homme id al l intense eau de parfum': {
            brand: 'GUERLAIN',
            gender: 'men',
            fragranceProfile: { longevity: 88, longevityLabel: '9-11h', sillage: 78, sillageLabel: 'Strong', season: 60, seasonLabel: 'Fall/Winter' },
            subtitle: "Men's fragrance · Oriental Woody · A spicy and vigorously elegant signature with dark oriental warmth.",
            longDescription: "The ideal man is a myth. But thanks to Guerlain, his fragrance is a reality with L'Homme Idéal L'Intense. An oriental woody fragrance, spicy and vigorously elegant. Masculine, luxurious, a unique fragrance in a square, faceted bottle entirely lacquered in black. Intensity is the high point of this new interpretation of the Ideal Man.",
            sizes: [
                'Decante 10ML',
                'Decante 20ML',
                'Decante 30ML',
                '50ML',
                '100ML'
            ],
            notes: [
                {
                    title: 'ORIENTAL WOODY SIGNATURE',
                    text: 'A deep oriental-woody profile that feels warm, refined, and confidently masculine.'
                },
                {
                    title: 'SPICY ELEGANCE',
                    text: 'Spiced facets bring energy and structure to the composition with vigorous sophistication.'
                },
                {
                    title: 'BLACK LACQUERED INTENSITY',
                    text: 'A luxurious, intensely styled trail mirrored by the faceted black bottle design.'
                }
            ],
            fr: {
                subtitle: "Parfum homme · Boisé Oriental · Une signature épicée et vigoureusement élégante avec une chaleur orientale profonde.",
                longDescription: "L'homme idéal est un mythe. Mais grâce à Guerlain, son parfum est une réalité avec L'Homme Idéal L'Intense. Un parfum boisé oriental, épicé et vigoureusement élégant. Masculin, luxueux, un parfum unique dans un flacon carré et facetté entièrement laqué noir. L'intensité est le point culminant de cette nouvelle interprétation de l'Homme Idéal.",
                notes: [
                    { title: 'SIGNATURE BOISÉE ORIENTALE', text: 'Un profil boisé oriental profond qui se dégage chaud, raffiné et confiablement masculin.' },
                    { title: 'ÉLÉGANCE ÉPICÉE', text: 'Les facettes épicées apportent énergie et structure à la composition avec une sophistication vigoureuse.' },
                    { title: 'INTENSITÉ LAQUÉE NOIRE', text: 'Un sillage luxueux et intensément stylé, reflété par le design de flacon noir facetté.' }
                ]
            },
            images: [
                "https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/L'Homme%20Id%C3%A9al%20L'Intense%20Eau%20de%20Parfum/2.jpg"
            ]
        },
        'guerlain l homme id al extr me': {
            brand: 'GUERLAIN',
            gender: 'men',
            fragranceProfile: { longevity: 86, longevityLabel: '8-10h', sillage: 76, sillageLabel: 'Strong', season: 60, seasonLabel: 'Fall/Winter' },
            subtitle: "Men's fragrance · Oriental Woody · A rich and elegant composition with almond, bergamot, spices, plum, woods, tobacco, and leather.",
            longDescription: "L'homme Idéal Extrême Eau de Parfum by Guerlain. The ideal man is a myth. His cologne, a reality. It's an oriental woody perfume that will keep you looking like an extremely talented man. Your L'Homme Idéal Extrême fragrance in the iconic White Bees Bottle. In 1853, the glassmaker Pochet & du Courval made the bottle, on which is written 'aux abeilles' (for the bees), for the fragrance Eau de Cologne Impériale intended for Empress Eugénie. Its 'tiles', inspired by the dome of the Vendôme column, are adorned with 69 golden bees, symbols of the Empire. The bottle celebrates 160 years and can hold the fragrance of your choice and be personalized with the initials you wish. The color of the perfume and the label seal vary depending on the fragrance. For this new interpretation of L'Homme Idéal, Thierry Wasser, perfumer at Maison Guerlain, has chosen to explore new facets of the almond. The top notes of almond are accompanied by the effervescence of bergamot blended with pink pepper. In the heart notes, cinnamon and plum notes join heliotrope, a floral note with elegant almond accents. Finally, the charm of a woody base note of patchouli and cedar is dressed in tobacco and an intense leather note.",
            sizes: [
                'Decante 10ML',
                'Decante 20ML',
                'Decante 30ML',
                '50ML',
                '100ML'
            ],
            notes: [
                {
                    title: 'ALMOND, BERGAMOT & PINK PEPPER',
                    text: 'An elegant opening where almond meets sparkling bergamot and bright pink pepper for refined lift.'
                },
                {
                    title: 'CINNAMON, PLUM & HELIOTROPE',
                    text: 'A textured heart of spice, fruit, and floral almond nuances builds warmth and sophistication.'
                },
                {
                    title: 'PATCHOULI, CEDAR, TOBACCO & LEATHER',
                    text: 'A powerful woody base wrapped in tobacco and intense leather leaves a rich masculine trail.'
                }
            ],
            fr: {
                subtitle: "Parfum homme · Boisé Oriental · Une composition riche et élégante de l'amande, bergamote, épices, prune, bois, tabac et cuir.",
                longDescription: "L'homme Idéal Extrême Eau de Parfum de Guerlain. L'homme idéal est un mythe. Son eau de cologne, une réalité. C'est un parfum boisé oriental logiquement contenu dans l'iconique flacon aux Abeilles Blanches. En 1853, le verrier Pochet & du Courval créa ce flacon orné de 69 abeilles dorées, symboles de l'Empire. Pour cette interprétation de L'Homme Idéal, Thierry Wasser a choisi d'explorer de nouvelles facettes de l'amande. Les notes de tête d'amande sont accompagnées de l'effervescence du bergamote mélangé au poivre rose. Au cœur, la cannelle et la prune rejoignent l'héliotrope. Enfin, le charme d'un fond boisé de patchouli et cèdre est enveloppé de tabac et d'une note de cuir intense.",
                notes: [
                    { title: 'AMANDE, BERGAMOTE & POIVRE ROSE', text: 'Une ouverture élégante où l’amande rencontre le bergamote étincelant et le poivre rose vif pour un lift raffiné.' },
                    { title: 'CANNELLE, PRUNE & HÉLIOTROPE', text: 'Un cœur texturé d’épice, fruit et nuances florales d’amande construit chaleur et sophistication.' },
                    { title: 'PATCHOULI, CÈDRE, TABAC & CUIR', text: 'Un fond boisé puissant enveloppé de tabac et de cuir intense laisse un sillage masculin riche.' }
                ]
            },
            images: [
                "https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/L'homme%20Id%C3%A9al%20Extr%C3%AAme/2.jpg"
            ]
        },
        'versace eros eau de parfum': {
            brand: 'VERSACE',
            gender: 'men',
            fragranceProfile: { longevity: 88, longevityLabel: '9-11h', sillage: 82, sillageLabel: 'Strong', season: 70, seasonLabel: 'All Year' },
            subtitle: "Men's fragrance · Aromatic Amber · A bold and sensual signature with mint, lemon, green apple, tonka bean, ambroxan, vanilla, and cedar.",
            longDescription: 'Versace Eros Eau de Parfum is a bold statement inspired by Greek mythology and the god of love. More than a fragrance, it is the ultimate expression of strength, passion, and irresistible sensuality for the modern, charismatic man. Its fresh and vibrant opening combines mint leaves, the liveliness of Italian lemon and the fruity sweetness of green apple, instantly awakening the senses. At its heart, warm and enveloping notes of tonka bean, geranium and the modern accord of ambroxan create a subtle balance between elegance and modernity. The deep and seductive base combines Madagascar vanilla, earthy vetiver, aromatic oakmoss, and the nobility of Virginia cedar and Atlas cedar, giving this fragrance exceptional intensity and longevity. Let Versace Eros Eau de Parfum accompany you in every conquest with power and sensuality. Dare to be unforgettable.',
            sizes: [
                'Decante 10ML',
                'Decante 20ML',
                'Decante 30ML',
                '50ML',
                '100ML'
            ],
            notes: [
                {
                    title: 'MINT, LEMON & GREEN APPLE',
                    text: 'A bright and energetic opening where cool mint meets sparkling citrus and crisp fruity freshness.'
                },
                {
                    title: 'TONKA, GERANIUM & AMBROXAN',
                    text: 'A warm modern heart balances aromatic elegance with sensual depth and smooth diffusion.'
                },
                {
                    title: 'VANILLA, VETIVER & CEDARS',
                    text: 'Vanilla, earthy woods, oakmoss, and cedar create an intense base with lasting masculine allure.'
                }
            ],
            fr: {
                subtitle: "Parfum homme · Ambré Aromatique · Un statement audacieux et sensuel avec menthe, citron, pomme verte, fève tonka, ambroxan, vanille et cèdre.",
                longDescription: "Versace Eros Eau de Parfum est une déclaration audacieuse inspirée de la mythologie grecque et du dieu de l'amour. Plus qu'un parfum, c'est l'expression ultime de la force, de la passion et de la sensualité irrésistible pour l'homme moderne et charismatique. Son ouverture fraîche et vibrante combine feuilles de menthe, citron d'Italie et pomme verte, éveillant instantanément les sens. Au cœur, la fève tonka chaude, le géranium et l'accord moderne d'ambroxan créent un subtil équilibre. Le fond profond et séducteur combine la vanille de Madagascar, le vétiver, la mousse de chêne et les cèdres, offrant une intensité et une longue durabilité exceptionnelles.",
                notes: [
                    { title: 'MENTHE, CITRON & POMME VERTE', text: 'Une ouverture lumineuse et énergétique où la menthe fraîche rencontre les agrumes étincelants et la fraîcheur fruitée.' },
                    { title: 'FÈVE TONKA, GÉRANIUM & AMBROXAN', text: 'Un cœur moderne et chaud qui équilibre élégance aromatique et profondeur sensuelle avec une diffusion douce.' },
                    { title: 'VANILLE, VÉTIVER & CÈDRES', text: 'La vanille, les bois terreux, la mousse de chêne et le cèdre créent un fond intense avec un charme masculin durable.' }
                ]
            },
            images: [
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Versace%20Eros%20Eau%20de%20Parfum/2.jpg'
            ]
        },
        'versace eros flame eau de parfum': {
            brand: 'VERSACE',
            gender: 'men',
            fragranceProfile: { longevity: 88, longevityLabel: '9-11h', sillage: 82, sillageLabel: 'Strong', season: 65, seasonLabel: 'All Year' },
            subtitle: "Men's fragrance · Woody Spicy · A fiery and refined signature with citrus, black pepper, rosemary, rose, woods, tonka bean, and vanilla.",
            longDescription: 'Versace Eros Flame is an intense and emotional olfactory statement. Designed for the strong, passionate, and self-assured man, this fragrance plays with the most powerful contrasts: warmth and coolness, sweetness and spice, light and shadow. From the opening, a vibrant citrus burst of Italian lemon, mandarin and bitter orange blends with black pepper from Madagascar and wild rosemary, creating a fiery yet refreshing start. The heart reveals a masculine floral elegance with geranium, rose and a subtle spicy note of pepperwood. Finally, the base notes envelop with warmth and depth: Texas cedar, Haitian vetiver, patchouli coeur, sandalwood, tonka bean, vanilla and oakmoss, leaving a sensual, refined and long-lasting trail. Love intensely. Live with fire. Dare to feel with Eros Flame.',
            sizes: [
                'Decante 10ML',
                'Decante 20ML',
                'Decante 30ML',
                '50ML',
                '100ML'
            ],
            notes: [
                {
                    title: 'CITRUS, PEPPER & ROSEMARY',
                    text: 'A vivid opening of citrus, black pepper, and rosemary creates a fiery yet refreshing first impression.'
                },
                {
                    title: 'GERANIUM, ROSE & PEPPERWOOD',
                    text: 'The heart balances masculine floral elegance with a subtle spicy edge and modern sophistication.'
                },
                {
                    title: 'CEDAR, VETIVER, TONKA & VANILLA',
                    text: 'Warm woods, tonka bean, vanilla, and oakmoss build a sensual, deep, and long-lasting trail.'
                }
            ],
            fr: {
                subtitle: "Parfum homme · Boisé Épicé · Une signature ardente et raffinée avec agrumes, poivre noir, romarin, rose, bois, fève tonka et vanille.",
                longDescription: "Versace Eros Flame est une déclaration olfactive intense et émotionnelle. Conçu pour l'homme fort, passionné et assuré, ce parfum joue avec les contrastes les plus puissants. Dès l'ouverture, un éclat d'agrumes d'un citron, mandarine et orange amère se mélange au poivre noir et au romarin sauvage, créant un début ardent et rafraîchissant. Le cœur révèle une élégance florale masculine avec géranium, rose et poivrette. Enfin, les notes de fond enveloppent de chaleur et de profondeur : cèdre du Texas, vétiver d'Haïti, patchouli, santal, fève tonka, vanille et mousse de chêne.",
                notes: [
                    { title: 'AGRUMES, POIVRE & ROMARIN', text: 'Une ouverture vive d’agrumes, poivre noir et romarin crée une première impression ardente et rafraîchissante.' },
                    { title: 'GÉRANIUM, ROSE & POIVRETTE', text: 'Le cœur équilibre élégance florale masculine avec une touche épicée subtile et une sophistication moderne.' },
                    { title: 'CÈDRE, VÉTIVER, TONKA & VANILLE', text: 'Les bois chauds, la fève tonka, la vanille et la mousse de chêne construisent un sillage sensuel, profond et durable.' }
                ]
            },
            images: [
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Versace%20Eros%20Flame%20Eau%20de%20Parfum/2.jpg'
            ]
        },
        'versace eros energy eau de parfum': {
            brand: 'VERSACE',
            gender: 'men',
            fragranceProfile: { longevity: 84, longevityLabel: '8-10h', sillage: 76, sillageLabel: 'Strong', season: 90, seasonLabel: 'Spring/Summer' },
            subtitle: "Men's fragrance · Citrus Aromatic · A vibrant fresh signature with bergamot, blood orange, lime, grapefruit, pink pepper, blackcurrant, amber, patchouli, and musk.",
            longDescription: "VERSACE presents Eros Energy Eau de Parfum, a masculine fragrance that conveys vitality from its first application. VERSACE Eros Energy Eau de Parfum stands out for its citrus composition, with top notes of Italian bergamot, blood orange, Peruvian lime, green mandarin, grapefruit, and Italian lemon. The heart of VERSACE Eros Energy Eau de Parfum incorporates Orpur CO2 pink pepper and blackcurrant, contrasted with Ambrofix white amber. This aromatic combination in Eros Energy Eau de Parfum reflects the dynamic character of VERSACE. At the base, Orpur Indonesian patchouli, musk, and oakmoss add depth. The Eros Energy Eau de Parfum bottle maintains VERSACE's distinctive style, with translucent yellow glass and details like the engraved Medusa. Eros Energy Eau de Parfum is designed for those seeking a fragrance that combines freshness, contrast, and longevity, in keeping with VERSACE's identity.",
            sizes: [
                'Decante 10ML',
                'Decante 20ML',
                'Decante 30ML',
                '50ML',
                '100ML'
            ],
            notes: [
                {
                    title: 'BERGAMOT, BLOOD ORANGE & LIME',
                    text: 'A vivid citrus opening delivers brightness, freshness, and immediate energetic lift.'
                },
                {
                    title: 'PINK PEPPER, BLACKCURRANT & WHITE AMBER',
                    text: 'The heart blends spicy sparkle, fruity contrast, and modern amber smoothness.'
                },
                {
                    title: 'PATCHOULI, MUSK & OAKMOSS',
                    text: 'A clean but deep base of patchouli, musk, and oakmoss adds structure and lasting character.'
                }
            ],
            fr: {
                subtitle: "Parfum homme · Aromatique Citrus · Une signature fraîche et vibrante avec bergamote, orange sanguine, citron vert, pamplemousse, poivre rose, cassis, ambre et patchouli.",
                longDescription: "VERSACE présente Eros Energy Eau de Parfum, un parfum masculin qui transmet la vitalité dès la première application. Il se distingue par sa composition citruse, avec en tête le bergamote d'Italie, l'orange sanguine, la lime péruvienne, la mandarine verte, le pamplemousse et le citron d'Italie. Le cœur incorpore le poivre rose Orpur CO2 et le cassis, contrastant avec l'ambre blanc Ambrofix. En fond, le patchouli d'Indonésie Orpur, le musc et la mousse de chêne ajoutent de la profondeur.",
                notes: [
                    { title: 'BERGAMOTE, ORANGE SANGUINE & CITRON VERT', text: 'Une ouverture agrumeée et vive apporte luminosité, fraîcheur et une énergie énergétique immédiate.' },
                    { title: 'POIVRE ROSE, CASSIS & AMBRE BLANC', text: 'Le cœur mélange éclat épicé, contraste fruité et douceur d’ambre moderne.' },
                    { title: 'PATCHOULI, MUSC & MOUSSE DE CHÊNE', text: 'Un fond propre mais profond de patchouli, musc et mousse de chêne ajoute structure et caractère durable.' }
                ]
            },
            images: [
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Versace%20Eros%20Energy%20Eau%20de%20Parfum/2.jpg',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Versace%20Eros%20Energy%20Eau%20de%20Parfum/3.jpg'
            ]
        },
        'versace dylan blue eau de toilette': {
            brand: 'VERSACE',
            gender: 'men',
            fragranceProfile: { longevity: 80, longevityLabel: '7-9h', sillage: 74, sillageLabel: 'Moderate', season: 85, seasonLabel: 'All Year' },
            subtitle: "Men's fragrance · Fresh Woody · A Mediterranean signature with bergamot, grapefruit, saffron, musk, and elegant woody depth.",
            longDescription: 'Dylan Blue Pour Homme Eau de Toilette is a fresh, woody fragrance that captures the sensual and powerful essence of the Mediterranean. Designed for the strong, decisive, and modern man who seeks to highlight his unique personality, this olfactory composition combines fresh and spicy notes with exceptional longevity. The opening is refreshed with vibrant citrus notes of bergamot and grapefruit, enriched with unusual spicy nuances of saffron and an intense base of musk. The result is a masculine and elegant scent, ideal for any occasion. The rectangular glass bottle, in a deep blue with golden details, reflects the sophistication and strength of this fragrance. Experience the freshness and power of the Mediterranean with Dylan Blue Pour Homme. A fragrance that defines your style and character.',
            sizes: [
                'Decante 10ML',
                'Decante 20ML',
                'Decante 30ML',
                '50ML',
                '100ML'
            ],
            notes: [
                {
                    title: 'BERGAMOT & GRAPEFRUIT',
                    text: 'A crisp citrus opening brings Mediterranean freshness, brightness, and immediate energy.'
                },
                {
                    title: 'SAFFRON SPICE',
                    text: 'An unusual spicy nuance adds texture and elegant masculine character to the heart.'
                },
                {
                    title: 'MUSK & WOODY DEPTH',
                    text: 'Musk and woods create a smooth, powerful base with refined lasting presence.'
                }
            ],
            fr: {
                subtitle: "Parfum homme · Boisé Frais · Une signature méditerranéenne avec bergamote, pamplemousse, safran, musc et une profondeur boisée élégante.",
                longDescription: "Dylan Blue Pour Homme Eau de Toilette est un parfum frais et boisé qui capture l’essence sensuelle et puissante de la Méditerranée. Conçu pour l'homme fort, décisé et moderne qui souhaite mettre en valeur sa personnalité unique, cette composition combine des notes fraîches et épicées avec une longue durabilité exceptionnelle. L'ouverture se rafraîchit avec des notes d'agrumes vibrantes de bergamote et pamplemousse, enrichies de nuances épicées inhabituelles de safran et d'un fond intense de musc.",
                notes: [
                    { title: 'BERGAMOTE & PAMPLEMOUSSE', text: 'Une ouverture agrumeée et nette apporte fraîcheur méditerranéenne, luminosité et énergie immédiate.' },
                    { title: 'SAFRAN ÉPICÉ', text: 'Une nuance épicée inhabituelle ajoute texture et caractère masculin élégant au cœur.' },
                    { title: 'MUSC & PROFONDEUR BOISÉE', text: 'Le musc et les bois créent un fond lisse et puissant avec une présence durable raffinée.' }
                ]
            },
            images: [
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Versace%20Dylan%20Blue%20%20Eau%20de%20Toilette/2.jpg'
            ]
        },
        'rabanne one million parfum': {
            brand: 'RABANNE',
            gender: 'men',
            fragranceProfile: { longevity: 80, longevityLabel: '7-9h', sillage: 80, sillageLabel: 'Strong', season: 70, seasonLabel: 'Fall/Winter' },
            subtitle: "Men's fragrance · Salty Woody · An iconic signature blending leather audacity with floral and spicy touches.",
            longDescription: "One Million Eau de Parfum is Paco Rabanne's star men's fragrance that has been a sensation since its launch. It's a recognized scent that leaves its mark wherever it goes. The sensuality and freshness it conveys are part of its unique identity, which possesses the audacity of the most authentic leather and the duality between a salty and woody impulse with floral and spicy touches. The One Million EDP gift set will allow you to offer the gift with the intense aroma that everyone desires.",
            sizes: [
                'Decante 10ML',
                'Decante 20ML',
                'Decante 30ML',
                '50ML',
                '100ML'
            ],
            notes: [
                {
                    title: 'AUTHENTIC LEATHER',
                    text: 'A bold leather character gives the fragrance its audacious and unmistakable identity.'
                },
                {
                    title: 'SALTY WOODY IMPULSE',
                    text: 'A sensual salty-woody contrast creates freshness, depth, and modern intensity.'
                },
                {
                    title: 'FLORAL & SPICY TOUCHES',
                    text: 'Floral nuances and spicy accents round out the trail with lasting sophistication.'
                }
            ],
            fr: {
                subtitle: "Parfum homme · Salé Boisé · Une signature iconique mélant l'audace du cuir avec des touches florales et épicées.",
                longDescription: "One Million Eau de Parfum est le parfum phare pour homme de Paco Rabanne, une sensation depuis son lancement. Un parfum reconnu qui marque partout où il passe. La sensualité et la fraîcheur qu'il dégage font partie de son identité unique, qui possède l'audace du cuir le plus authentique et la dualité entre une impulsion salée et boisée avec des touches florales et épicées.",
                notes: [
                    { title: 'CUIR AUTHENTIQUE', text: 'Un caractère affirmé de cuir donne au parfum son identité audacieuse et irremplaçable.' },
                    { title: 'IMPULSION SALÉE BOISÉE', text: 'Un contraste sensuel salé-boisé crée fraîcheur, profondeur et intensité moderne.' },
                    { title: 'TOUCHES FLORALES & ÉPICÉES', text: 'Les nuances florales et les accents épicés complètent le sillage avec une sophistication durable.' }
                ]
            },
            images: [
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Rabanne%20One%20Million%20Parfum/2.jpg',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Rabanne%20One%20Million%20Parfum/3.jpg',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Rabanne%20One%20Million%20Parfum/4.jpg'
            ]
        },
        'rabanne one million elixir intense': {
            brand: 'RABANNE',
            gender: 'men',
            fragranceProfile: { longevity: 90, longevityLabel: '10-12h', sillage: 85, sillageLabel: 'Very Strong', season: 65, seasonLabel: 'Fall/Winter' },
            subtitle: "Men's fragrance · Aromatic Amber · The pinnacle of One Million intensity with rose, tonka bean, woods, and black vanilla.",
            longDescription: "Discover One Million Elixir , the pinnacle of Million 's intensity , a new fragrance guided by the desire for supreme quality. A blend of carefully selected ingredients from around the world, celebrating the craftsmanship of our perfumers and the fusion of the finest raw materials. A new dimension, incredibly intense, undoubtedly One Million. The iconic One Million gold ingot , bolder and more sophisticated than ever. A handcrafted jewel that reflects the different facets of the fragrance. A symbol of a new strength: elegant, intense, and enigmatic. The exquisitely crafted bottle encapsulates the soul and essence of One Million , the infinite depth of this new olfactory creation. The pinnacle of absolute intensity. One Million Elixir , more intense than ever, to captivate you. Hand-selected ingredients—Turkish rose, osmanthus, and wild-harvested tonka bean—make this masterpiece stand out for its exceptional quality. The deeply sensual Davana liqueur vibrates with the touch of soft woods and black vanilla seeds; supreme sensuality meets absolute, long-lasting power.",
            sizes: [
                'Decante 10ML',
                'Decante 20ML',
                'Decante 30ML',
                '50ML',
                '100ML'
            ],
            notes: [
                {
                    title: 'TURKISH ROSE & OSMANTHUS',
                    text: 'A refined floral duo that brings richness, elegance, and exceptional depth.'
                },
                {
                    title: 'DAVANA LIQUEUR',
                    text: 'A deeply sensual heart with a warm liqueur-like texture and magnetic character.'
                },
                {
                    title: 'TONKA, WOODS & BLACK VANILLA',
                    text: 'Wild tonka bean, soft woods, and black vanilla create an intense, long-lasting trail.'
                }
            ],
            fr: {
                subtitle: "Parfum homme · Ambré Aromatique · L'apogée de l'intensité One Million avec rose, fève tonka, bois et vanille noire.",
                longDescription: "Découvrez One Million Elixir, l'apogée de l'intensité Million, un nouveau parfum guidé par le désir de qualité suprême. Un mélange d'ingrédients soigneusement sélectionnés du monde entier, célébrant le savoir-faire de nos parfumeurs. Le lingot d'or iconique One Million, plus audacieux et sophistiqué que jamais. Des ingrédients sélectionnés à la main, rose turque, osmanthus et fève tonka récoltée sauvagement, font de ce chef-d'œuvre une pièce de qualité exceptionnelle. La liqueur de davana profondément sensuelle vibre au contact des bois doux et des graines de vanille noire.",
                notes: [
                    { title: 'ROSE TURQUE & OSMANTHUS', text: 'Un duo floral raffiné qui apporte richesse, élégance et profondeur exceptionnelle.' },
                    { title: 'LIQUEUR DE DAVANA', text: 'Un cœur profondément sensuel avec une texture chaude à la liqueur de davana et un caractère magnétique.' },
                    { title: 'TONKA, BOIS & VANILLE NOIRE', text: 'La fève tonka sauvage, les bois doux et la vanille noire créent un sillage intense et durable.' }
                ]
            },
            images: [
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Rabanne%20One%20Million%20Elixir%20Intense/2.webp',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Rabanne%20One%20Million%20Elixir%20Intense/3.jpg',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Rabanne%20One%20Million%20Elixir%20Intense/4.jpg',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Rabanne%20One%20Million%20Elixir%20Intense/5.jpg'
            ]
        },
        'givenchy gentleman society amber eau de parfum': {
            brand: 'GIVENCHY',
            gender: 'men',
            fragranceProfile: { longevity: 80, longevityLabel: '7-9h', sillage: 70, sillageLabel: 'Moderate', season: 60, seasonLabel: 'Fall/Winter' },
            subtitle: "Men's fragrance · Amber Woody · Narcissus and vetiver enhanced by leather, tobacco, warm spices, and Tasuki vanilla.",
            longDescription: "Givenchy presents Gentleman Society Eau de Parfum Ambree , a captivating blend of vibrant narcissus flower and a quartet of vetivers, enhanced by rich notes of leather and tobacco. A COMPOSITION MADE WITH EXCEPTIONAL RAW MATERIALS Gentleman Society Ambree reinvents the iconic woody signature of Gentleman Society with a new amber facet, enriched with the balsamic notes of Tasuki vanilla. Expressing Givenchy's unique savoir-faire, Gentleman Society Eau de Parfum Ambree unveils a sophisticated accord of narcissus blossom and a quartet of vetiver, intensified by the boldness of leather and tobacco. Warm spices blend harmoniously with the richness of Tasuki vanilla from Madagascar, combined with a balsam essence, creating an elegant and deeply captivating trail. AN ICONIC BOTTLE WITH GOLDEN REFLECTIONS The iconic Gentleman Society bottle, entirely lacquered in black, is adorned with a refined gold crest, a symbol of elegance and prestige. Combining opulence and timelessness, it invites the expression of sensuality and individuality. GENTLEMAN SOCIETY. MORE THAN A PLACE, A STATE OF MIND For this new chapter, Gentleman Society expands around the English composer Benjamin Clementine. His elegance and undeniable charisma resonate as an invitation to join a community that is bolder and more inclusive than ever.",
            sizes: [
                'Decante 10ML',
                'Decante 20ML',
                'Decante 30ML',
                '50ML',
                '100ML'
            ],
            notes: [
                {
                    title: 'NARCISSUS & VETIVER',
                    text: 'A sophisticated floral-woody core built around narcissus and a quartet of vetivers.'
                },
                {
                    title: 'LEATHER & TOBACCO',
                    text: 'Rich leather and tobacco add bold texture and deep masculine character.'
                },
                {
                    title: 'TASUKI VANILLA',
                    text: 'Warm spices and balsamic vanilla from Madagascar create an elegant amber trail.'
                }
            ],
            fr: {
                subtitle: "Parfum homme · Ambré Boisé · Narcisse et vétiver élevés par le cuir, le tabac, les épices chaudes et la vanille Tasuki.",
                longDescription: "Givenchy présente Gentleman Society Eau de Parfum Ambrée, un mélange captivant de narcisse éclatant et d'un quatuor de vétivers, enrichi de riches notes de cuir et tabac. Gentleman Society Ambrée réinvente la signature boisée iconique de Gentleman Society avec une nouvelle facette ambrée, enrichie des notes balsamiques de la vanille Tasuki. Les épices chaudes se mélangent harmonieusement à la richesse de la vanille Tasuki de Madagascar, créant un sillage élégant et profondément captivant.",
                notes: [
                    { title: 'NARCISSE & VÉTIVER', text: 'Un cœur sophistiqué floral-boisé construit autour du narcisse et d’un quatuor de vétivers.' },
                    { title: 'CUIR & TABAC', text: 'Le cuir riche et le tabac ajoutent une texture audacieuse et un caractère masculin profond.' },
                    { title: 'VANILLE TASUKI', text: 'Les épices chaudes et la vanille balsamique de Madagascar créent un sillage ambré élégant.' }
                ]
            },
            images: [
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Givenchy%20Gentleman%20Society%20Amber%20Eau%20de%20Parfum/2.jpg',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Givenchy%20Gentleman%20Society%20Amber%20Eau%20de%20Parfum/3.jpg',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Givenchy%20Gentleman%20Society%20Amber%20Eau%20de%20Parfum/4.jpg',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Givenchy%20Gentleman%20Society%20Amber%20Eau%20de%20Parfum/5.jpg'
            ]
        },
        'givenchy gentleman society nomade eau de parfum': {
            brand: 'GIVENCHY',
            gender: 'men',
            fragranceProfile: { longevity: 75, longevityLabel: '6-8h', sillage: 70, sillageLabel: 'Moderate', season: 85, seasonLabel: 'Spring/Summer' },
            subtitle: "Men's fragrance · Floral Woody · Sage, narcissus, vetiver quartet, woods, and vanilla in a bold Givenchy signature.",
            longDescription: "Givenchy redefines the figure of the gentleman with Gentleman Society Eau de Parfum, a bold statement for men who reinvent their own rules and always act for a better world. Wild narcissus blossom blends with a mysterious woody accord to create a fragrance of rare sophistication. An expression of Givenchy's unique savoir-faire, Gentleman Society is composed of exceptional raw materials. From the very first spritz, the fresh, aromatic notes of sage blend with wild narcissus absolute harvested in the heart of France. This unique floral facet is contrasted by the dark intensity of a quartet of vetiver from Uruguay and Madagascar. Essences of cedarwood and sandalwood melt into an addictive and sensual vanilla, leaving a truly memorable trail. A deep and multifaceted men's Eau de Parfum. The couture design reimagines the iconic Gentleman bottle with pure elegance. Like a coat of arms, a reinterpreted 4G monogram in gleaming silver metal adorns the intense black lacquer. The bottle contains 15% recycled glass.",
            sizes: [
                'Decante 10ML',
                'Decante 20ML',
                'Decante 30ML',
                '50ML',
                '100ML'
            ],
            notes: [
                {
                    title: 'SAGE & NARCISSUS',
                    text: 'An aromatic opening with wild narcissus that brings freshness and floral sophistication.'
                },
                {
                    title: 'VETIVER QUARTET',
                    text: 'Vetiver from Uruguay and Madagascar adds a dark, textured, and modern woody heart.'
                },
                {
                    title: 'CEDAR, SANDALWOOD & VANILLA',
                    text: 'Woods and sensual vanilla leave a deep, memorable, and multifaceted trail.'
                }
            ],
            fr: {
                subtitle: "Parfum homme · Floral Boisé · Sauge, narcisse, quatuor de vétiver, bois et vanille dans une signature audacieuse Givenchy.",
                longDescription: "Givenchy redéfinit la figure du gentleman avec Gentleman Society Eau de Parfum, une déclaration audacieuse pour les hommes qui réinventent leurs propres règles. Le narcisse sauvage absolu récolté au cœur de la France se mélange à un accord boisé mystérieux pour créer un parfum d'une sophistication rare. Dès le premier jet, les notes fraîches et aromatiques de sauge se mélangent au narcisse absolu sauvage. Cette facette florale unique est contrastée par l'intensité sombre d'un quatuor de vétiver d'Uruguay et de Madagascar. Les essences de cèdre et de santal fondent dans une vanille addictive et sensuelle.",
                notes: [
                    { title: 'SAUGE & NARCISSE', text: 'Une ouverture aromatique au narcisse sauvage qui apporte fraîcheur et sophistication florale.' },
                    { title: 'QUATUOR DE VÉTIVER', text: 'Le vétiver d’Uruguay et de Madagascar ajoute un cœur boisé sombre, texturé et moderne.' },
                    { title: 'CÈDRE, SANTAL & VANILLE', text: 'Les bois et la vanille sensuelle laissent un sillage profond, mémorable et multifacèttes.' }
                ]
            },
            images: [
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Givenchy%20Gentleman%20Society%20Nomade%20Eau%20de%20Parfum/2.jpg',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Givenchy%20Gentleman%20Society%20Nomade%20Eau%20de%20Parfum/3.jpg',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Givenchy%20Gentleman%20Society%20Nomade%20Eau%20de%20Parfum/4.jpg',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Givenchy%20Gentleman%20Society%20Nomade%20Eau%20de%20Parfum/5.jpg'
            ]
        },
        'givenchy gentleman society extreme eau de parfum': {
            brand: 'GIVENCHY',
            gender: 'men',
            fragranceProfile: { longevity: 85, longevityLabel: '8-10h', sillage: 80, sillageLabel: 'Strong', season: 55, seasonLabel: 'Fall/Winter' },
            subtitle: "Men's fragrance · Woody Aromatic · A daring blend of clary sage, iced mint, coffee, vetiver, woods, patchouli, and vanilla.",
            longDescription: "GIVENCHY Gentleman Society Extreme EDP With its magnetic masculine signature, Gentleman Society Eau de Parfum Extreme embodies a new attitude within the Gentleman Society. Tailor-made for the most daring, this addictive fragrance is designed for the man who pushes his limits in an eternal quest for excellence, breaking barriers and fearlessly leaping into the unknown. Crafted with Givenchy's expertise, Gentleman Society Eau de Parfum Extreme is composed of exceptional raw materials, carefully selected for their outstanding olfactory qualities. The top notes of Clary Sage are enhanced by Iced Mint and Nutmeg, creating an immediate aromatic and spicy touch. The mysterious heart reveals the original Gentleman Society accord, a blend of Narcissus Absolute and Iris Concrete, contrasted by the characteristic quartet of Vetiver. From this accord emerges a powerful and unexpected Coffee Absolute Extract. Combined with Mint Essence, this Coffee note becomes icy, revealing a new and intensely textured facet. At the base, the woody notes of Cedar and Sandalwood are deepened with Patchouli Essence and Vanilla Absolute, perfecting this profound signature. Inspired by haute couture, the iconic design of the Gentleman bottle is reinterpreted with a striking new look. The deep black lacquered finish is enhanced with Givenchy's symbol: the 4G logo, engraved like a crest, in a new metallic bronze finish. The Gentleman Society Eau de Parfum Extreme bottle is made with 15% recycled glass. Gentleman Society. It's not a place, it's a state of mind. Join us.",
            sizes: [
                'Decante 10ML',
                'Decante 20ML',
                'Decante 30ML',
                '50ML',
                '100ML'
            ],
            notes: [
                {
                    title: 'CLARY SAGE, MINT & NUTMEG',
                    text: 'An aromatic-spicy opening with iced freshness and immediate intensity.'
                },
                {
                    title: 'NARCISSUS, IRIS & VETIVER',
                    text: 'The signature Gentleman Society heart gains depth through floral elegance and smoky vetiver power.'
                },
                {
                    title: 'COFFEE, WOODS & VANILLA',
                    text: 'Icy coffee meets cedar, sandalwood, patchouli, and vanilla for a bold, long-lasting finish.'
                }
            ],
            fr: {
                subtitle: "Parfum homme · Boisé Aromatique · Un mélange audacieux de sauge sclarée, menthe glacée, café, vétiver, bois, patchouli et vanille.",
                longDescription: "Gentleman Society Extreme EDP de GIVENCHY incarne une nouvelle attitude avec sa signature masculine magnétique. Sur mesure pour les plus audacieux, ce parfum addictif est conçu pour l'homme qui repousse ses limites. Les notes de tête de sauge sclarée sont rehussées par la menthe glacée et la muscade. Le cœur mystérieux révèle l'accord Gentleman Society original, un mélange de narcisse absolu et d'iris concrète, contrasté par le quatuor de vétiver. Émerge alors un puissant extrait de café absolu combiné à l'essence de menthe, créant une facette glacée et intensement texturée. En fond, cèdre, santal, patchouli et vanille absolue.",
                notes: [
                    { title: 'SAUGE SCLARÉE, MENTHE & MUSCADE', text: 'Une ouverture aromatique-épicée avec une fraîcheur glacée et une intensité immédiate.' },
                    { title: 'NARCISSE, IRIS & VÉTIVER', text: 'Le cœur signature de Gentleman Society gagne en profondeur grâce à l’élégance florale et à la puissance fumée du vétiver.' },
                    { title: 'CAFÉ, BOIS & VANILLE', text: 'Le café glacé rencontre cèdre, santal, patchouli et vanille pour une finition audacieuse et durable.' }
                ]
            },
            images: [
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Givenchy%20Gentleman%20Society%20Extreme%20Eau%20de%20Parfum/2.webp',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Givenchy%20Gentleman%20Society%20Extreme%20Eau%20de%20Parfum/3.jpg',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Givenchy%20Gentleman%20Society%20Extreme%20Eau%20de%20Parfum/4.jpg',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Givenchy%20Gentleman%20Society%20Extreme%20Eau%20de%20Parfum/5.jpg'
            ]
        },
        'gentleman private reserve eau de parfum': {
            brand: 'GIVENCHY',
            gender: 'men',
            fragranceProfile: { longevity: 88, longevityLabel: '9-11h', sillage: 75, sillageLabel: 'Strong', season: 50, seasonLabel: 'Fall/Winter' },
            subtitle: "Men's fragrance · Amber Woody · Airy iris and amber woods elevated by natural whisky absolute.",
            longDescription: "Timeless elegance is reinvented with Givenchy Gentleman Reserve Privee , a fragrance that celebrates the sensuality of amber wood and the sophistication of airy iris . This olfactory duo creates an addictive and enveloping composition , a symbol of contemporary masculine refinement. At the heart of this creation beats the absolute of natural whisky , made in Grasse from aromatic barley from a Scottish distillery , for a warm, intense and unique character. Its bottle with clean lines and amber finish , inspired by the silhouette of an elegant flask, reflects the perfect fusion between tradition and modernity. Gentleman Reserve Privee Eau de Parfum is an ode to the sophisticated, self-assured, and profoundly authentic man. A fragrance that embodies the art of French savoir-faire combined with the essence of Scotch whisky: intense, refined, and eternally elegant .",
            sizes: [
                'Decante 10ML',
                'Decante 20ML',
                'Decante 30ML',
                '50ML',
                '100ML'
            ],
            notes: [
                {
                    title: 'AIRY IRIS',
                    text: 'A refined iris accord brings elegance and contemporary masculine sophistication.'
                },
                {
                    title: 'WHISKY ABSOLUTE',
                    text: 'Natural whisky absolute from aromatic barley adds warmth, intensity, and uniqueness.'
                },
                {
                    title: 'AMBER WOODS',
                    text: 'Sensual amber woods create an enveloping and long-lasting elegant trail.'
                }
            ],
            fr: {
                subtitle: "Parfum homme · Ambré Boisé · Un iris aérien et des bois ambrés sublimés par le whisky absolu naturel.",
                longDescription: "L'élégance intemporelle est réinventée avec Givenchy Gentleman Réserve Privée, un parfum qui célèbre la sensualité du bois ambré et la sophistication de l'iris aérien. Au cœur de cette création bat l'absolu de whisky naturel, fabriqué en Grasse à partir d'orge aromatique d'une distillerie écossaise, pour un caractère chaud, intense et unique. Son flacon aux lignes épurées et à la finition ambrée, inspiré de la silhouette d'une élégante flasque, reflète la fusion parfaite entre tradition et modernité.",
                notes: [
                    { title: 'IRIS AÉRIEN', text: 'Un accord d’iris raffiné apporte élégance et sophistication masculine contemporaine.' },
                    { title: 'WHISKY ABSOLU', text: "Le whisky absolu naturel d'orge aromatique ajoute chaleur, intensité et unicité." },
                    { title: 'BOIS AMBRÉS', text: 'Des bois ambrés sensuels créent un sillage enveloppant et élégant durable.' }
                ]
            },
            images: [
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Gentleman%20Private%20Reserve%20Eau%20de%20Parfum/2.webp',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Gentleman%20Private%20Reserve%20Eau%20de%20Parfum/3.jpg',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Gentleman%20Private%20Reserve%20Eau%20de%20Parfum/4.jpg',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Gentleman%20Private%20Reserve%20Eau%20de%20Parfum/5.jpg'
            ]
        },
        'jean paul gaultier scandal elixir': {
            brand: 'JEAN PAUL GAULTIER',
            gender: 'men',
            fragranceProfile: { longevity: 82, longevityLabel: '8-10h', sillage: 78, sillageLabel: 'Strong', season: 60, seasonLabel: 'Fall/Winter' },
            subtitle: "Men's fragrance · Amber Fruity Woody · Black cherry, patchouli, and tonka bean in a rich, provocative elixir.",
            longDescription: "In first class on the Gaultier train, Scandal Pour Homme Elixir reigns supreme, with its amber, fruity, and woody fragrance. Its provocative black cherry and audacious patchouli assert themselves with elegance, while its tonka bean reveals a scandalous sweetness. Who wouldn't dream of encountering it? Behind the red velvet and the closed door of its exclusive case, only the most audacious can enter and succumb to the silver gradient of its amber-hued bottle. Crowned with intensity and excess, everything about it is temptation. Excess dominates, pleasures multiply. The passengers are outraged? So much the better! That's exactly what it's after.",
            sizes: [
                'Decante 10ML',
                'Decante 20ML',
                'Decante 30ML',
                '75ML',
                '125ML'
            ],
            notes: [
                {
                    title: 'BLACK CHERRY',
                    text: 'A provocative fruity opening that immediately commands attention.'
                },
                {
                    title: 'PATCHOULI',
                    text: 'Audacious patchouli adds depth, elegance, and bold character.'
                },
                {
                    title: 'TONKA BEAN',
                    text: 'A smooth, scandalous sweetness that lingers with addictive intensity.'
                }
            ],
            fr: {
                subtitle: "Parfum homme · Ambré Fruité Boisé · Cerise noire, patchouli et fève tonka dans un élixir riche et provocateur.",
                longDescription: "En première classe dans le train Gaultier, Scandal Pour Homme Elixir règne en maître, avec son parfum ambré, fruité et boisé. Sa cerise noire provocatrice et son patchouli audacieux s'affirment avec élégance, tandis que sa fève tonka révèle une douceur scandaleuse. Derrière le velours rouge et la porte fermée de son étui exclusif, seuls les plus audacieux peuvent entrer et succomber au dégradé argenté de son flacon aux reflets ambrés.",
                notes: [
                    { title: 'CERISE NOIRE', text: 'Une ouverture fruitée provocatrice qui commande immédiatement l’attention.' },
                    { title: 'PATCHOULI', text: 'Un patchouli audacieux ajoute profondeur, élégance et caractère affirmé.' },
                    { title: 'FÈVE TONKA', text: 'Une douceur lisse et scandaleuse qui persiste avec une intensité addictive.' }
                ]
            },
            images: [
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Jean%20Paul%20Gaultier%20Scandal%20Elixir/2.jpg',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Jean%20Paul%20Gaultier%20Scandal%20Elixir/3.jpg',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Jean%20Paul%20Gaultier%20Scandal%20Elixir/4.jpg',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Jean%20Paul%20Gaultier%20Scandal%20Elixir/5.jpg'
            ]
        },
        'jean paul gaultier scandal intense eau de parfum': {
            brand: 'JEAN PAUL GAULTIER',
            gender: 'men',
            fragranceProfile: { longevity: 86, longevityLabel: '8-10h', sillage: 80, sillageLabel: 'Strong', season: 62, seasonLabel: 'Fall/Winter' },
            subtitle: 'Perfume for men · Leather Woody · An intense signature with firm presence and unapologetic character.',
            longDescription: 'JEAN PAUL GAULTIER presenta Scandal Intense Eau de Parfum For Him, una propuesta olfativa que refuerza la identidad del perfume hombre en su versión más intensa.\n\nScandal Intense Eau de Parfum For Him de JEAN PAUL GAULTIER combina notas de cuero y madera, creando un perfil aromático que acompaña a quienes buscan un perfume hombre con presencia firme.\n\nScandal Intense Eau de Parfum For Him, refleja la visión de JEAN PAUL GAULTIER sobre la masculinidad sin concesiones. Cada aplicación de Scandal Intense Eau de Parfum For Him de JEAN PAUL GAULTIER representa una declaración personal, diseñada para quienes no se ajustan a lo establecido.\n\nLa estructura del Scandal Intense Eau de Parfum For Him está pensada para mantenerse en la piel con intensidad. Con este perfume de hombre, JEAN PAUL GAULTIER confirma su apuesta por fragancias que proponen un estilo propio sin necesidad de artificios.',
            sizes: [
                '50ML',
                '100ML'
            ],
            notes: [
                {
                    title: 'LEATHER',
                    text: 'Leather notes reinforce the scent with a dense, assertive masculine signature.'
                },
                {
                    title: 'WOODS',
                    text: 'A woody backbone keeps the composition grounded, structured, and long-lasting.'
                },
                {
                    title: 'INTENSITY',
                    text: 'The overall profile stays firm on skin and reads as a personal statement rather than ornament.'
                }
            ],
            images: [
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Jean%20Paul%20Gaultier%20Scandal%20Intense%20Eau%20de%20Parfum/1.jpg',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Jean%20Paul%20Gaultier%20Scandal%20Intense%20Eau%20de%20Parfum/2.jpg',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Jean%20Paul%20Gaultier%20Scandal%20Intense%20Eau%20de%20Parfum/3.jpg',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Jean%20Paul%20Gaultier%20Scandal%20Intense%20Eau%20de%20Parfum/4.jpg',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Jean%20Paul%20Gaultier%20Scandal%20Intense%20Eau%20de%20Parfum/5.jpg'
            ]
        },
        'azzaro the most wanted parfum': {
            brand: 'AZZARO',
            gender: 'men',
            fragranceProfile: { longevity: 88, longevityLabel: '9-11h', sillage: 85, sillageLabel: 'Very Strong', season: 55, seasonLabel: 'Fall/Winter' },
            subtitle: "Men's fragrance · Spicy Amber · A bold signature with red ginger, woods, and bourbon vanilla.",
            longDescription: 'Azzaro The Most Wanted Parfum is an intense, magnetic scent built for confident evenings. It opens with a burst of red ginger, settles into warm woods, and finishes with a rich bourbon vanilla trail that feels smooth and addictive. Crafted for modern allure, it leaves a strong, long-lasting impression without overpowering the room.',
            sizes: [
                'Decante 10ML',
                'Decante 20ML',
                'Decante 30ML',
                '50ML',
                '100ML'
            ],
            notes: [
                {
                    title: 'RED GINGER',
                    text: 'A vibrant opening that adds energy and an inviting spicy edge.'
                },
                {
                    title: 'WOODY HEART',
                    text: 'Warm woods create depth and a confident, masculine signature.'
                },
                {
                    title: 'BOURBON VANILLA',
                    text: 'A smooth, addictive base that lingers with refined sweetness.'
                }
            ],
            fr: {
                subtitle: "Parfum homme · Épicé Ambré · Une signature audacieuse avec gingembre rouge, bois et vanille bourbon.",
                longDescription: "Azzaro The Most Wanted Parfum est un parfum intense et magnétique conçu pour les soirées intenses. Il s'ouvre sur un éclat de gingembre rouge, se pose sur des bois chauds, et se termine par un sillage riche de vanille bourbon qui se sent lisse et addictif. Conçu pour un charme moderne, il laisse une impression forte et durable sans être envahissant.",
                notes: [
                    { title: 'GINGEMBRE ROUGE', text: 'Une ouverture vibrante qui ajoute énergie et une touche épicée invitante.' },
                    { title: 'CŒUR BOISÉ', text: 'Les bois chauds créent de la profondeur et une signature masculine et confiante.' },
                    { title: 'VANILLE BOURBON', text: 'Un fond lisse et addictif qui persiste avec une douceur raffinée.' }
                ]
            },
            images: [
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Azzaro%20The%20Most%20Wanted%20Parfum/2.webp',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Azzaro%20The%20Most%20Wanted%20Parfum/3.webp',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Azzaro%20The%20Most%20Wanted%20Parfum/4.webp'
            ]
        },
        'azzaro the most wanted eau de parfum intense': {
            brand: 'AZZARO',
            gender: 'men',
            fragranceProfile: { longevity: 85, longevityLabel: '8-10h', sillage: 82, sillageLabel: 'Strong', season: 55, seasonLabel: 'Fall/Winter' },
            subtitle: "Men's fragrance · Spicy Woody · A powerful signature with cardamom, caramel, and amber woods.",
            longDescription: 'Azzaro The Most Wanted Eau de Parfum Intense delivers a bold, addictive trail built around warm spices and deep woods. The opening is energetic and bright, the heart is rich and confident, and the dry-down is smooth and long-lasting for evening wear.',
            sizes: [
                'Decante 10ML',
                'Decante 20ML',
                'Decante 30ML',
                '50ML',
                '100ML'
            ],
            notes: [
                {
                    title: 'CARDAMOM',
                    text: 'A warm and spicy opening that feels vibrant and confident.'
                },
                {
                    title: 'CARAMEL ACCORD',
                    text: 'A sweet, addictive heart that adds depth and richness.'
                },
                {
                    title: 'AMBER WOODS',
                    text: 'A smooth woody base that gives long-lasting presence.'
                }
            ],
            fr: {
                subtitle: "Parfum homme · Épicé Boisé · Une signature puissante avec cardamome, caramel et bois ambrés.",
                longDescription: "Azzaro The Most Wanted Eau de Parfum Intense délivre un sillage audacieux et addictif construit autour d'épices chaudes et de bois profonds. L'ouverture est énergétique et lumineuse, le cœur est riche et confié, et le séchage est lisse et durable pour une tenue soirée.",
                notes: [
                    { title: 'CARDAMOME', text: 'Une ouverture chaude et épicée qui se sent vibrante et confiante.' },
                    { title: 'ACCORD CARAMEL', text: 'Un cœur doux et addictif qui ajoute de la profondeur et de la richesse.' },
                    { title: 'BOIS AMBRÉS', text: 'Un fond boisé lisse qui donne une présence durable.' }
                ]
            },
            images: [
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Azzaro%20The%20Most%20Wanted%20Eau%20de%20Parfum%20Intense/2.webp',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Azzaro%20The%20Most%20Wanted%20Eau%20de%20Parfum%20Intense/3.webp',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Azzaro%20The%20Most%20Wanted%20Eau%20de%20Parfum%20Intense/4.webp'
            ]
        },
        'azzaro forever wanted elixir eau de parfum': {
            brand: 'AZZARO',
            gender: 'men',
            fragranceProfile: { longevity: 90, longevityLabel: '10-12h', sillage: 80, sillageLabel: 'Strong', season: 50, seasonLabel: 'Fall/Winter' },
            subtitle: "Men's fragrance · Amber Gourmand · A rich, smooth elixir with warm woods and vanilla.",
            longDescription: 'Azzaro Forever Wanted Elixir is a deep, luxurious scent designed for night. It opens with a refined freshness, settles into rich amber warmth, and finishes with a smooth vanilla trail that stays on skin for hours.',
            sizes: [
                'Decante 10ML',
                'Decante 20ML',
                'Decante 30ML',
                '50ML',
                '100ML'
            ],
            notes: [
                {
                    title: 'FRESH OPENING',
                    text: 'A bright start that feels clean and inviting.'
                },
                {
                    title: 'AMBER HEART',
                    text: 'A warm, resinous core that adds richness.'
                },
                {
                    title: 'VANILLA WOODS',
                    text: 'A smooth, addictive base for a lasting trail.'
                }
            ],
            fr: {
                subtitle: "Parfum homme · Ambré Gourmand · Un élixir riche et lisse avec des bois chauds et de la vanille.",
                longDescription: "Azzaro Forever Wanted Elixir est un parfum profond et luxueux conçu pour la nuit. Il s'ouvre sur une fraîcheur affinée, se pose sur une chaleur ambrée riche, et se termine par un sillage doux de vanille qui reste sur la peau pendant des heures.",
                notes: [
                    { title: 'OUVERTURE FRAÎCHE', text: 'Un début lumineux qui se feel propre et invitant.' },
                    { title: 'CŒUR AMBRÉ', text: 'Un noyau chaud et résineux qui ajoute de la richesse.' },
                    { title: 'BOIS VANILLÉ', text: 'Un fond lisse et addictif pour un sillage durable.' }
                ]
            },
            images: [
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Azzaro%20Forever%20Wanted%20Elixir%20Eau%20de%20Parfum/2.jpg',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Azzaro%20Forever%20Wanted%20Elixir%20Eau%20de%20Parfum/3.jpg',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Azzaro%20Forever%20Wanted%20Elixir%20Eau%20de%20Parfum/4.jpg'
            ]
        },
        'valentino donna born in roma eau de parfum': {
            brand: 'VALENTINO',
            gender: 'women',
            fragranceProfile: { longevity: 78, longevityLabel: '7-9h', sillage: 72, sillageLabel: 'Moderate', season: 75, seasonLabel: 'All Year' },
            subtitle: "Women's fragrance · Floral Woody · A luminous blend of jasmine, blackcurrant, and warm woods.",
            longDescription: 'Valentino Donna Born in Roma is a modern floral with a bright, elegant opening and a smooth, woody base. It feels refined yet bold, perfect for day-to-night wear.',
            sizes: [
                'Decante 10ML',
                'Decante 20ML',
                'Decante 30ML',
                '50ML',
                '100ML'
            ],
            notes: [
                {
                    title: 'BLACKCURRANT',
                    text: 'A juicy, vibrant opening with a modern edge.'
                },
                {
                    title: 'JASMINE',
                    text: 'A rich floral heart that feels elegant and radiant.'
                },
                {
                    title: 'WOODY VANILLA',
                    text: 'A warm, smooth base that lingers softly on skin.'
                }
            ],
            fr: {
                subtitle: "Parfum femme · Floral Boisé · Un mélange lumineux de jasmin, cassis et bois chauds.",
                longDescription: "Valentino Donna Born in Roma est un floral moderne avec une ouverture lumineuse et élégante et un fond boisé lisse. Il se felt raffiné mais audacieux, parfait du jour au soir.",
                notes: [
                    { title: 'CASSIS', text: 'Une ouverture juteuse et vibrante avec une touche moderne.' },
                    { title: 'JASMIN', text: 'Un cœur floral riche qui se felt élégant et rayonnant.' },
                    { title: 'BOIS VANILLÉ', text: 'Un fond chaud et lisse qui persiste doucement sur la peau.' }
                ]
            },
            images: [
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Valentino%20Donna%20Born%20in%20Roma%20Eau%20de%20Parfum/2.webp',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Valentino%20Donna%20Born%20in%20Roma%20Eau%20de%20Parfum/3.webp',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Valentino%20Donna%20Born%20in%20Roma%20Eau%20de%20Parfum/4.webp'
            ]
        },
        'valentino uomo born in roma coral fantasy eau de toilette': {
            brand: 'VALENTINO',
            gender: 'men',
            fragranceProfile: { longevity: 65, longevityLabel: '5-7h', sillage: 60, sillageLabel: 'Moderate', season: 90, seasonLabel: 'Spring/Summer' },
            subtitle: "Men's fragrance · Fruity Woody · A fresh and vibrant blend with apple, sage, and tobacco.",
            longDescription: 'Valentino Uomo Born in Roma Coral Fantasy Eau de Toilette is a bright, modern scent that balances juicy fruit with aromatic woods. It feels fresh, energetic, and easy to wear.',
            sizes: [
                { label: 'Decante 10ML', priceText: '110 DH' },
                { label: 'Decante 20ML', priceText: '220 DH' },
                { label: 'Decante 30ML', priceText: '330 DH' },
                { label: '50ML' },
                { label: '100ML' }
            ],
            notes: [
                {
                    title: 'RED APPLE',
                    text: 'A crisp, juicy opening that feels vibrant and fresh.'
                },
                {
                    title: 'SAGE',
                    text: 'An aromatic heart that adds clean, herbal texture.'
                },
                {
                    title: 'TOBACCO',
                    text: 'A smooth, warm base that adds depth and character.'
                }
            ],
            fr: {
                subtitle: "Parfum homme · Fruité Boisé · Un mélange frais et vibrant avec pomme, sauge et tabac.",
                longDescription: "Valentino Uomo Born in Roma Coral Fantasy Eau de Toilette est un parfum lumineux et moderne qui équilibre fruits juteux et bois aromatiques. Il se felt frais, énergétique et facile à porter.",
                notes: [
                    { title: 'POMME ROUGE', text: 'Une ouverture croquante et juteusse qui se felt vibrante et fraîche.' },
                    { title: 'SAUGE', text: 'Un cœur aromatique qui ajoute une texture propre et herbace.' },
                    { title: 'TABAC', text: 'Un fond lisse et chaud qui ajoute profondeur et caractère.' }
                ]
            },
            images: [
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Valentino%20Uomo%20Born%20In%20Roma%20Coral%20Fantasy%20Eau%20de%20Toilette/2.webp',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Valentino%20Uomo%20Born%20In%20Roma%20Coral%20Fantasy%20Eau%20de%20Toilette/3.webp',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Valentino%20Uomo%20Born%20In%20Roma%20Coral%20Fantasy%20Eau%20de%20Toilette/4.webp'
            ]
        },
        'valentino born in roma extradose eau de toilette': {
            brand: 'VALENTINO',
            gender: 'men',
            fragranceProfile: { longevity: 70, longevityLabel: '6-8h', sillage: 68, sillageLabel: 'Moderate', season: 80, seasonLabel: 'Spring/Summer' },
            subtitle: "Men's fragrance · Woody Aromatic · A bold, modern scent with fresh spice and woods.",
            longDescription: 'Valentino Born in Roma Extradose Eau de Toilette is a clean and confident signature with a fresh opening, aromatic heart, and a smooth woody base for everyday wear.',
            sizes: [
                'Decante 10ML',
                'Decante 20ML',
                'Decante 30ML',
                '50ML',
                '100ML'
            ],
            notes: [
                {
                    title: 'FRESH SPICE',
                    text: 'A lively opening with a clean, modern edge.'
                },
                {
                    title: 'AROMATIC HEART',
                    text: 'A refined aromatic core that feels crisp and masculine.'
                },
                {
                    title: 'WOODY BASE',
                    text: 'A smooth, long-lasting wood finish.'
                }
            ],
            fr: {
                subtitle: "Parfum homme · Boisé Aromatique · Un parfum moderne et audacieux avec épice fraîche et bois.",
                longDescription: "Valentino Born in Roma Extradose Eau de Toilette est une signature propre et confiante avec une ouverture fraîche, un cœur aromatique et un fond boisé lisse pour une tenue quotidienne.",
                notes: [
                    { title: 'ÉPICE FRAÎCHE', text: 'Une ouverture vivante avec une touche propre et moderne.' },
                    { title: 'CŒUR AROMATIQUE', text: 'Un noyau aromatique raffiné qui se felt crisp et masculin.' },
                    { title: 'FOND BOISÉ', text: 'Une finition boisée lisse et durable.' }
                ]
            },
            images: [
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Valentino%20Born%20in%20Rome%20Extradose/2.jpg',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Valentino%20Born%20in%20Rome%20Extradose/3.jpg',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Valentino%20Born%20in%20Rome%20Extradose/4.jpg'
            ]
        },
        'dior sauvage eau de parfum': {
            brand: 'DIOR',
            gender: 'men',
            fragranceProfile: { longevity: 88, longevityLabel: '9-12h', sillage: 85, sillageLabel: 'Very Strong', season: 90, seasonLabel: 'All Year' },
            subtitle: "Men's fragrance · Woody Amber · A desert-inspired trail with vanilla and ambery woods.",
            longDescription: "Sauvage Eau de Parfum by Dior embodies the wildest, most elegant, and most audacious masculine spirit. A fragrance inspired by desert sunsets, it spreads its exoticism and sensuality through an unforgettable olfactory trail that leaves its mark wherever it goes. The warmth of the desert blends with the coolness of the night, highlighting exceptional notes such as vanilla from Papua New Guinea and a woody, ambery base. The result is a long-lasting, unique, and unforgettable men's fragrance. The 100ml format of Dior's Sauvage Eau de Parfum is refillable and is part of the House of Dior's sustainable plan to reuse bottles.",
            sizes: [
                'Decante 10ML',
                'Decante 20ML',
                'Decante 30ML',
                '60ML',
                '100ML'
            ],
            notes: [
                {
                    title: 'DESERT SUNSET ACCORD',
                    text: 'A warm, radiant opening inspired by the heat of the desert at dusk.'
                },
                {
                    title: 'PAPUA VANILLA',
                    text: 'Creamy vanilla from Papua New Guinea adds depth and sensuality.'
                },
                {
                    title: 'AMBERY WOODS',
                    text: 'A woody, ambery base that leaves a long-lasting, memorable trail.'
                }
            ],
            fr: {
                subtitle: "Parfum homme · Boisé Ambré · Un sillage inspiré du désert avec de la vanille et des bois ambrés.",
                longDescription: "Sauvage Eau de Parfum de Dior incarne l'esprit masculin le plus sauvage, le plus élégant et le plus audacieux. Un parfum inspiré des couchers de soleil du désert, qui répand son exotisme et sa sensualité à travers un sillage olfactif inoubliable qui laisse sa marque partout où il passe. La chaleur du désert se mélange à la fraîcheur de la nuit, mettant en valeur des notes exceptionnelles comme la vanille de Papouasie-Nouvelle-Guinée et un fond boisé ambré. Le résultat est un parfum masculin durable, unique et inoubliable.",
                notes: [
                    { title: 'ACCORD COUCHER DE SOLEIL DÉSERT', text: 'Une ouverture chaude et rayonnante inspirée de la chaleur du désert au crépuscule.' },
                    { title: 'VANILLE DE PAPOUASIE', text: 'La vanille crémeuse de Papouasie-Nouvelle-Guinée ajoute profondeur et sensualité.' },
                    { title: 'BOIS AMBRÉS', text: 'Un fond boisé et ambré qui laisse un sillage durable et mémorable.' }
                ]
            },
            images: [
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Dior%20SAUVAGE%20Eau%20de%20Parfum/2.jpg',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Dior%20SAUVAGE%20Eau%20de%20Parfum/3.webp'
            ]
        },
        'dior homme intense eau de parfum': {
            brand: 'DIOR',
            gender: 'men',
            fragranceProfile: { longevity: 82, longevityLabel: '8-10h', sillage: 70, sillageLabel: 'Moderate', season: 65, seasonLabel: 'Fall/Winter' },
            subtitle: "Men's fragrance · Iris Woody · A refined, elegant scent with iris, amber, and cedar.",
            longDescription: 'Dior Homme Intense is a smooth, elegant fragrance built around soft iris and warm amber woods. It feels refined and confident, perfect for evening wear and cooler seasons.',
            sizes: [
                'Decante 10ML',
                'Decante 20ML',
                'Decante 30ML',
                '50ML',
                '100ML'
            ],
            notes: [
                {
                    title: 'IRIS',
                    text: 'A soft, powdery signature that feels luxurious.'
                },
                {
                    title: 'AMBER',
                    text: 'A warm core that adds depth and richness.'
                },
                {
                    title: 'CEDAR',
                    text: 'A clean woody base that gives structure and longevity.'
                }
            ],
            fr: {
                subtitle: "Parfum homme · Iris Boisé · Un parfum raffiné et élégant avec iris, ambre et cèdre.",
                longDescription: "Dior Homme Intense est un parfum lisse et élégant construit autour d'un iris doux et de bois ambrés chauds. Il se felt raffiné et confiant, parfait pour la soirée et les saisons plus fraîches.",
                notes: [
                    { title: 'IRIS', text: 'Une signature douce et poudrée qui se felt luxueuse.' },
                    { title: 'AMBRE', text: 'Un noyau chaud qui ajoute profondeur et richesse.' },
                    { title: 'CÈDRE', text: 'Un fond boisé propre qui donne structure et longue durabilité.' }
                ]
            },
            images: [
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/DIOR%20HOMME%20INTENSE%20Eau%20de%20Parfum/2.webp',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/DIOR%20HOMME%20INTENSE%20Eau%20de%20Parfum/3.avif',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/DIOR%20HOMME%20INTENSE%20Eau%20de%20Parfum/4.avif'
            ]
        },
        'valentino born in roma uomo intense eau de parfum': {
            brand: 'VALENTINO',
            gender: 'men',
            fragranceProfile: { longevity: 85, longevityLabel: '8-10h', sillage: 78, sillageLabel: 'Strong', season: 60, seasonLabel: 'Fall/Winter' },
            subtitle: "Men's fragrance · Amber Woody · A deep, intense blend with vanilla and smoky woods.",
            longDescription: 'Valentino Born in Roma Uomo Intense Eau de Parfum offers a rich, warm signature with smooth vanilla and dark woods. It is bold yet elegant, ideal for evening wear.',
            sizes: [
                'Decante 10ML',
                'Decante 20ML',
                'Decante 30ML',
                '50ML',
                '100ML'
            ],
            notes: [
                {
                    title: 'VANILLA',
                    text: 'A rich opening that feels smooth and addictive.'
                },
                {
                    title: 'LAVENDER',
                    text: 'A refined aromatic heart for balance.'
                },
                {
                    title: 'SMOKY WOODS',
                    text: 'A deep base that leaves a lasting trail.'
                }
            ],
            fr: {
                subtitle: "Parfum homme · Ambré Boisé · Un mélange profond et intense avec vanille et bois fumés.",
                longDescription: "Valentino Born in Roma Uomo Intense Eau de Parfum offre une signature riche et chaude avec une vanille lisse et des bois sombres. Il est audacieux mais élégant, idéal pour la soirée.",
                notes: [
                    { title: 'VANILLE', text: 'Une ouverture riche qui se felt lisse et addictive.' },
                    { title: 'LAVANDE', text: 'Un cœur aromatique raffiné pour l’équilibre.' },
                    { title: 'BOIS FUMÉS', text: 'Un fond profond qui laisse un sillage durable.' }
                ]
            },
            images: [
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Valentino%20Born%20In%20Roma%20Uomo%20Intense%20Eau%20de%20Parfum/2.webp',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Valentino%20Born%20In%20Roma%20Uomo%20Intense%20Eau%20de%20Parfum/3.webp',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Valentino%20Born%20In%20Roma%20Uomo%20Intense%20Eau%20de%20Parfum/4.webp'
            ]
        },
        'valentino born in roma donna intense eau de parfum': {
            brand: 'VALENTINO',
            gender: 'women',
            fragranceProfile: { longevity: 80, longevityLabel: '7-9h', sillage: 75, sillageLabel: 'Strong', season: 70, seasonLabel: 'All Year' },
            subtitle: "Women's fragrance · Amber Floral · A sensual blend of jasmine and vanilla with warm woods.",
            longDescription: 'Valentino Born in Roma Donna Intense is a richer, deeper take on the original with luminous florals and a warm vanilla base. It is elegant, confident, and long-lasting.',
            sizes: [
                'Decante 10ML',
                'Decante 20ML',
                'Decante 30ML',
                '50ML',
                '100ML'
            ],
            notes: [
                {
                    title: 'JASMINE',
                    text: 'A radiant floral heart with refined elegance.'
                },
                {
                    title: 'VANILLA',
                    text: 'A warm, smooth signature that feels sensual.'
                },
                {
                    title: 'WOODY BASE',
                    text: 'Soft woods that add depth and longevity.'
                }
            ],
            fr: {
                subtitle: "Parfum femme · Floral Ambré · Un mélange sensuel de jasmin et vanille avec des bois chauds.",
                longDescription: "Valentino Born in Roma Donna Intense est une version plus riche et plus profonde de l'original avec des floraux lumineux et un fond vanillé chaud. Il est élégant, confiant et durable.",
                notes: [
                    { title: 'JASMIN', text: 'Un cœur floral rayonnant avec une élégance raffinée.' },
                    { title: 'VANILLE', text: 'Une signature chaude et lisse qui se felt sensuelle.' },
                    { title: 'FOND BOISÉ', text: 'Des bois doux qui ajoutent profondeur et longue durabilité.' }
                ]
            },
            images: [
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Valentino%20Born%20In%20Roma%20Donna%20Intense%20Eau%20de%20Parfum/2.webp',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Valentino%20Born%20In%20Roma%20Donna%20Intense%20Eau%20de%20Parfum/3.webp',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Valentino%20Born%20In%20Roma%20Donna%20Intense%20Eau%20de%20Parfum/4.webp'
            ]
        },
        'valentino uomo born in roma eau de toilette': {
            brand: 'VALENTINO',
            gender: 'men',
            fragranceProfile: { longevity: 72, longevityLabel: '6-8h', sillage: 65, sillageLabel: 'Moderate', season: 75, seasonLabel: 'Spring/Summer' },
            subtitle: "Men's fragrance · Woody Aromatic · A clean and vibrant blend of citrus, sage, and woods.",
            longDescription: 'Valentino Uomo Born in Roma Eau de Toilette is a fresh and modern signature with crisp citrus, aromatic herbs, and a smooth woody base. Ideal for everyday wear.',
            sizes: [
                'Decante 10ML',
                'Decante 20ML',
                'Decante 30ML',
                '50ML',
                '100ML'
            ],
            notes: [
                {
                    title: 'CITRUS',
                    text: 'A bright opening that feels fresh and modern.'
                },
                {
                    title: 'SAGE',
                    text: 'An aromatic heart that adds clean texture.'
                },
                {
                    title: 'WOODS',
                    text: 'A smooth base that lasts comfortably on skin.'
                }
            ],
            fr: {
                subtitle: "Parfum homme · Boisé Aromatique · Un mélange propre et vibrant de citrus, sauge et bois.",
                longDescription: "Valentino Uomo Born in Roma Eau de Toilette est une signature fraîche et moderne avec des agrumes croquants, des herbes aromatiques et un fond boisé lisse. Idéal pour l'usage quotidien.",
                notes: [
                    { title: 'AGRUMES', text: 'Une ouverture lumineuse qui se felt fraîche et moderne.' },
                    { title: 'SAUGE', text: 'Un cœur aromatique qui ajoute une texture propre.' },
                    { title: 'BOIS', text: 'Un fond lisse qui dure confortablement sur la peau.' }
                ]
            },
            images: [
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Valentino%20Uomo%20Born%20in%20Roma%20Eau%20de%20Toilette/2.jpg',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Valentino%20Uomo%20Born%20in%20Roma%20Eau%20de%20Toilette/3.jpg',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Valentino%20Uomo%20Born%20in%20Roma%20Eau%20de%20Toilette/4.jpg'
            ]
        },
        'valentino uomo born in roma purple melancholia eau de toilette': {
            brand: 'VALENTINO',
            gender: 'men',
            fragranceProfile: { longevity: 78, longevityLabel: '7-9h', sillage: 70, sillageLabel: 'Moderate', season: 85, seasonLabel: 'All Year' },
            subtitle: "Men's fragrance · Spicy Aromatic · A balanced daily signature with cardamom, lavandin, amber woods, and coconut accord.",
            longDescription: "Uomo Born In Roma Purple Melancholia Eau de Toilette is a men's fragrance created by VALENTINO for those looking for a scent with a defined identity and everyday use. From the first application, it presents a striking cardamom opening, delivering a spicy yet controlled sensation. In its evolution, it incorporates lavandin at its heart, creating a balance between aromatic notes and a consistent structure. The base combines amber woods with a coconut accord that provides continuity and longevity on the skin. Presented in the signature Rockstud bottle, this Born In Roma fragrance is designed for the man who seeks to express his personal style through a balanced and contemporary scent.",
            sizes: [
                'Decante 10ML',
                'Decante 20ML',
                'Decante 30ML',
                '50ML',
                '100ML'
            ],
            notes: [
                {
                    title: 'CARDAMOM OPENING',
                    text: 'A spicy opening with a defined yet controlled character that feels modern from the first spray.'
                },
                {
                    title: 'LAVANDIN HEART',
                    text: 'Lavandin brings aromatic balance and keeps the composition structured for easy everyday wear.'
                },
                {
                    title: 'AMBER WOODS & COCONUT ACCORD',
                    text: 'Amber woods and coconut accord create smooth continuity and comfortable longevity on skin.'
                }
            ],
            fr: {
                subtitle: "Parfum homme · Aromatique Épicé · Une signature quotidienne équilibrée avec cardamome, lavandin, bois ambrés et accord coco.",
                longDescription: "Uomo Born In Roma Purple Melancholia Eau de Toilette est un parfum pour homme créé par VALENTINO pour ceux qui recherchent une senteur à l'identité affirmée et adaptée au quotidien. Dès la première vaporisation, il dévoile une ouverture marquée par la cardamome, offrant une sensation épicée mais maîtrisée. En son cœur, le lavandin apporte un équilibre entre les notes aromatiques et une structure constante. Le fond associe des bois ambrés à un accord coco qui prolonge la continuité et la tenue sur la peau. Présenté dans le flacon Rockstud emblématique, ce parfum Born In Roma est pensé pour l'homme qui souhaite exprimer son style personnel à travers une senteur équilibrée et contemporaine.",
                notes: [
                    { title: 'OUVERTURE CARDAMOME', text: 'Une ouverture épicée au caractère affirmé mais maîtrisé, moderne dès la première vaporisation.' },
                    { title: 'CŒUR DE LAVANDIN', text: 'Le lavandin apporte un équilibre aromatique et maintient une structure nette pour un usage quotidien.' },
                    { title: 'BOIS AMBRÉS & ACCORD COCO', text: 'Les bois ambrés et l’accord coco créent une continuité douce et une bonne tenue sur la peau.' }
                ]
            },
            images: [
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Valentino%20Uomo%20Born%20In%20Roma%20Purple%20Melancholia%20Eau%20de%20Toilette/2.jpg',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Valentino%20Uomo%20Born%20In%20Roma%20Purple%20Melancholia%20Eau%20de%20Toilette/3.jpg'
            ]
        },
        'emporio armani stronger with you intensely edp': {
            brand: 'GIORGIO ARMANI',
            fragranceProfile: { longevity: 88, longevityLabel: '9-12h', sillage: 82, sillageLabel: 'Strong', season: 55, seasonLabel: 'Fall/Winter' },
            subtitle: 'Men\'s fragrance · Oriental Fougère · A bold, addictive signature with pink pepper, vanilla, and ambery woods.',
            longDescription: 'This addictive fougère fragrance unveils notes of pink pepper, vanilla, and an ambery woody accord. It reflects the personality of the modern man seeking a powerful scent to illuminate his intense love story. This intense masculine fragrance reveals warm heart notes of vanilla and vibrant ambery woody accords, contrasted by spicy touches of pink pepper. Its aged cognac hue perfectly embodies the intensity of this fragrance. BOTTLE: The clean lines and essential shapes characteristic of Giorgio Armani are reflected in the Emporio Armani bottle. Its simplicity conveys a profound sensuality, with curves reminiscent of masculine shoulders, and a round metallic cap that underscores understated elegance. Beneath this cap, intertwined rings symbolize a strong connection and unconditional love. Emporio Armani Stronger With You is a men\'s fragrance for bold men, belonging to the Oriental Fougere olfactory family. Because together, we are stronger.',
            sizes: [
                'Decante 10ML',
                'Decante 20ML',
                'Decante 30ML',
                '50ML',
                '100ML'
            ],
            notes: [
                {
                    title: 'PINK PEPPER ESSENCE',
                    text: 'The spicy essence of pink pepper blends with an addictive accord of caramelized chestnut for a touch of originality.'
                },
                {
                    title: 'VANILLA ESSENCE',
                    text: 'The intensity of vanilla, combined with a lightly tanned suede accord, creates a sensual and unique olfactory signature.'
                },
                {
                    title: 'WOODY AMBER ACCORDS',
                    text: 'Woody amber accords, enhanced by notes of Bourbon vetiver, amplify the vibrant facet of the sillage.'
                }
            ],
            fr: {
                subtitle: "Parfum homme · Fougère Oriental · Une signature audacieuse et addictive avec poivre rose, vanille et bois ambrés.",
                longDescription: "Ce parfum fougère addictif dévoile des notes de poivre rose, vanille et accord boisé ambré. Il reflète la personnalité de l'homme moderne à la recherche d'un parfum puissant pour illuminer son histoire d'amour intense. Ce parfum masculin intense révèle des notes de cœur de vanille chaudes et des accords boisés ambrés vibrants, contrastant par des touches épicées de poivre rose. Parce qu'ensemble, nous sommes plus forts.",
                notes: [
                    { title: 'ESSENCE DE POIVRE ROSE', text: "L'essence épicée du poivre rose se mélange à un accord addictif de marron caramilisé pour une touche d'originalité." },
                    { title: 'ESSENCE DE VANILLE', text: "L'intensité de la vanille, combinée à un accord suède légèrement tané, crée une signature olfactive sensuelle et unique." },
                    { title: 'ACCORDS BOISÉS AMBRÉS', text: 'Les accords boisés ambrés, renforcés par des notes de vétiver Bourbon, amplifient la facette vibrante du sillage.' }
                ]
            },
            images: [
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Emporio%20Armani%20Stronger%20With%20You%20Intensely/1.webp',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Emporio%20Armani%20Stronger%20With%20You%20Intensely/3.webp',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Emporio%20Armani%20Stronger%20With%20You%20Intensely/4.webp',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Emporio%20Armani%20Stronger%20With%20You%20Intensely/5.webp',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Emporio%20Armani%20Stronger%20With%20You%20Intensely/6.webp'
            ]
        },
        'armani stronger with you powerfully eau de parfum': {
            brand: 'GIORGIO ARMANI',
            fragranceProfile: { longevity: 85, longevityLabel: '8-10h', sillage: 80, sillageLabel: 'Strong', season: 50, seasonLabel: 'Fall/Winter' },
            subtitle: 'Men\'s fragrance · Smoky Amber · A more intense and powerful signature with cherry, mandarin, lavender, vanilla, and amber woods.',
            longDescription: 'Stronger With You Powerfully reinvents the collection\'s iconic signature with a more intense, smoky, and powerful dimension. This Eau de Parfum opens with a vibrant burst of cherry and juicy mandarin, delivering immediate energy and luminous warmth. At its heart, Diva lavender blends with an aromatic spice accord, balancing freshness and intensity to express modern sophistication. At its base, the fragrance unveils a sensual foundation of creamy vanilla, smoky amber woods, and the iconic caramelized chestnut accord, the signature of the Stronger With You line. The result: an enveloping, addictive trail that lasts up to 24 hours. The perfume comes in an imposing red bottle with bold lines, topped with a blackened silver cap and adorned with the iconic motif of intertwined rings, a symbol of connection and strength.',
            sizes: [
                'Decante 10ML',
                'Decante 20ML',
                'Decante 30ML',
                '50ML',
                '100ML'
            ],
            notes: [
                {
                    title: 'CHERRY & MANDARIN',
                    text: 'A vibrant and juicy opening where cherry meets bright mandarin for instant energy and luminous warmth.'
                },
                {
                    title: 'DIVA LAVENDER & SPICE',
                    text: 'An aromatic heart blending Diva lavender with a refined spice accord to balance freshness and intensity.'
                },
                {
                    title: 'VANILLA, AMBER WOODS & CHESTNUT',
                    text: 'A sensual base of creamy vanilla, smoky amber woods, and caramelized chestnut creates an addictive 24-hour trail.'
                }
            ],
            fr: {
                subtitle: "Parfum homme · Ambré Fumé · Une signature plus intense et puissante avec cerise, mandarine, lavande, vanille et bois ambrés.",
                longDescription: "Stronger With You Powerfully réinvente la signature iconique de la collection avec une dimension plus intense, fumée et puissante. Cette Eau de Parfum s'ouvre sur un éclat vibrant de cerise et mandarine juteuse. Au cœur, la lavande Diva se mélange à un accord d'épice aromatique. En fond, le parfum dévoile une base sensuelle de vanille crémeuse, de bois ambrés fumés et l'accord iconique de marron caramilisé, la signature de la ligne Stronger With You. Le résultat : un sillage enveloppant et addictif qui dure jusqu'à 24 heures.",
                notes: [
                    { title: 'CERISE & MANDARINE', text: 'Une ouverture vibrante et juteüase où la cerise rencontre la mandarine lumineuse pour une énergie instantanée et une chaleur lumineuse.' },
                    { title: 'LAVANDE DIVA & ÉPICE', text: 'Un cœur aromatique mélant lavande Diva et accord d’épice raffiné pour équilibrer fraîcheur et intensité.' },
                    { title: 'VANILLE, BOIS AMBRÉS & MARRON', text: 'Une base sensuelle de vanille crémeuse, de bois ambrés fumés et de marron caramilisé crée un sillage addictif de 24 heures.' }
                ]
            },
            images: [
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Armani%20Stronger%20With%20You%20Powerfully%20Eau%20de%20Parfum/2.webp',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Armani%20Stronger%20With%20You%20Powerfully%20Eau%20de%20Parfum/3.webp',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Armani%20Stronger%20With%20You%20Powerfully%20Eau%20de%20Parfum/4.webp',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Armani%20Stronger%20With%20You%20Powerfully%20Eau%20de%20Parfum/5.webp'
            ]
        },
        'armani stronger with you absolutely perfume': {
            brand: 'GIORGIO ARMANI',
            fragranceProfile: { longevity: 90, longevityLabel: '10-12h', sillage: 85, sillageLabel: 'Very Strong', season: 45, seasonLabel: 'Fall/Winter' },
            subtitle: 'Men\'s fragrance · Oriental Fougère · An irresistible and addictive signature inspired by the power of absolute love.',
            longDescription: 'GIORGIO ARMANI Stronger With You Absolutely Perfume. Stronger with You Absolutely by Giorgio Armani is an Oriental Fougère fragrance for men. This fragrance was launched in 2021. Olfactory pyramid of Stronger With You Absolutely Parfum: Stronger With You Absolutely Parfum by Giorgio Armani is inspired by the power of absolute love. A refined men\'s fragrance fueled by the addictive new rum accord. The bottle with an intense smoky lacquer envelops the iconic Emporio Armani You fragrance, bringing the absolute strength of the perfume to the bottle. Stronger With You Absolutely Parfum is an irresistible men\'s fragrance.',
            sizes: [
                'Decante 10ML',
                'Decante 20ML',
                'Decante 30ML',
                '50ML',
                '100ML'
            ],
            notes: [
                {
                    title: 'ORIENTAL FOUGÈRE PROFILE',
                    text: 'An elegant Oriental Fougère composition built for a modern masculine signature.'
                },
                {
                    title: 'ADDICTIVE RUM ACCORD',
                    text: 'A refined and addictive rum accord brings warmth, depth, and sensual character.'
                },
                {
                    title: 'SMOKY LACQUER BOTTLE',
                    text: 'The iconic Emporio Armani bottle is dressed in an intense smoky lacquer to express absolute strength.'
                }
            ],
            fr: {
                subtitle: "Parfum homme · Fougère Oriental · Une signature irrésistible et addictive inspirée par la puissance de l'amour absolu.",
                longDescription: "Stronger With You Absolutely de Giorgio Armani est un parfum Fougère Oriental pour homme. Ce parfum est inspiré par la puissance de l'amour absolu. Un parfum masculin raffiné propulsé par le nouvel accord de rhum addictif. Le flacon à la laque intensité fumée enveloppe le parfum iconique Emporio Armani You, apportant la force absolue du parfum au flacon. Stronger With You Absolutely Parfum est un parfum masculin irrésistible.",
                notes: [
                    { title: 'PROFIL FOUGÈRE ORIENTAL', text: 'Une composition Fougère Oriental élégante construite pour une signature masculine moderne.' },
                    { title: 'ACCORD DE RHUM ADDICTIF', text: 'Un accord de rhum raffiné et addictif apporte chaleur, profondeur et caractère sensuel.' },
                    { title: 'FLACON LAQUÉ FUMÉ', text: "Le flacon iconique Emporio Armani est habillé d'une laque fumée intense pour exprimer la force absolue." }
                ]
            },
            images: [
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Armani%20Stronger%20With%20You%20Absolutely%20Perfume/2.webp',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Armani%20Stronger%20With%20You%20Absolutely%20Perfume/3.webp',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Armani%20Stronger%20With%20You%20Absolutely%20Perfume/4.webp',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Armani%20Stronger%20With%20You%20Absolutely%20Perfume/5.webp',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Armani%20Stronger%20With%20You%20Absolutely%20Perfume/6.webp'
            ]
        },
        'yves saint laurent y eau de parfum': {
            brand: 'YVES SAINT LAURENT',
            fragranceProfile: { longevity: 82, longevityLabel: '8-10h', sillage: 75, sillageLabel: 'Strong', season: 85, seasonLabel: 'All Year' },
            subtitle: 'Men\'s fragrance · Clean Woody · A long-lasting and powerful YSL signature of lavender, cedar, geranium, and incense.',
            longDescription: 'YVES SAINT LAURENT Y Eau de Parfum for Men. Immerse yourself in the essence of the creative and successful man with Y Le Parfum, the fragrance that captures the spirit of YSL personified by legendary ambassador Lenny Kravitz. This fragrance embodies the "Why not?" philosophy that defines the YSL man. Y Le Parfum, the new interpretation of the iconic Y franchise, is a long-lasting, clean, woody fragrance that celebrates self-realization. This version, more intense and powerful than ever, fuses vibrant French lavender with the strength of American cedar, two exclusive ingredients of YSL Beauty. The fragrance is distinguished by the mentholated touch of iconic geranium and the deep sensuality of incense, creating a powerful and addictive olfactory statement. An aroma that reflects the strength and determination of the YSL man in every drop.',
            sizes: [
                'Decante 10ML',
                'Decante 20ML',
                'Decante 30ML',
                '60ML',
                '100ML'
            ],
            notes: [
                {
                    title: 'FRENCH LAVENDER',
                    text: 'A vibrant aromatic opening driven by refined French lavender for a clean and energetic start.'
                },
                {
                    title: 'GERANIUM & INCENSE',
                    text: 'The mentholated touch of geranium meets deep incense to create a powerful and addictive core.'
                },
                {
                    title: 'AMERICAN CEDAR',
                    text: 'Strong American cedar anchors the base with long-lasting woody depth and masculine elegance.'
                }
            ],
            fr: {
                subtitle: "Parfum homme · Boisé Propre · Une signature YSL durable et puissante de lavande, cèdre, géranium et encens.",
                longDescription: "Yves Saint Laurent Y Eau de Parfum pour Homme. Plongez dans l'essence de l'homme créatif et accompli avec Y Le Parfum, le parfum qui capture l'esprit de YSL incarné par le légendaire ambassadeur Lenny Kravitz. Ce parfum incarne la philosophie \'Pourquoi pas ?\'  qui définit l'homme YSL. Y Le Parfum, la nouvelle interprétation de la franchise iconique Y, est un parfum boisé propre et durable qui célèbre la réalisation de soi. Cette version, plus intense et puissante que jamais, fusionne la lavande française vibrante avec la force du cèdre américain.",
                notes: [
                    { title: 'LAVANDE FRANÇAISE', text: 'Une ouverture aromatique vibrante conduite par la lavande française raffinée pour un début propre et énergétique.' },
                    { title: 'GÉRANIUM & ENCENS', text: 'La touche mentholée du géranium rencontre l’encens profond pour créer un cœur puissant et addictif.' },
                    { title: 'CÈDRE AMÉRICAIN', text: 'Le fort cèdre américain ancre le fond avec une profondeur boisée durable et une élégance masculine.' }
                ]
            },
            images: [
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Yves%20Saint%20Laurent%20Y%20Eau%20de%20Parfum/2.webp',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Yves%20Saint%20Laurent%20Y%20Eau%20de%20Parfum/3.webp',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Yves%20Saint%20Laurent%20Y%20Eau%20de%20Parfum/4.webp'
            ]
        },
        'yves saint laurent myslf eau de parfum': {
            brand: 'YVES SAINT LAURENT',
            fragranceProfile: { longevity: 78, longevityLabel: '7-9h', sillage: 72, sillageLabel: 'Moderate', season: 80, seasonLabel: 'Spring/Summer' },
            subtitle: 'Men\'s fragrance · Floral Woody · A modern masculine signature with bergamot, orange blossom, patchouli, and Ambrofix™.',
            longDescription: 'YVES SAINT LAURENT Myslf Refillable Eau de Parfum. Yves Saint Laurent\'s new refillable men\'s fragrance is Myslf. An expression of the man you are, with all your nuances. A declaration of modern masculinity, embracing all its facets and emotions. YSL BEAUTY\'s first floral woody fragrance for a trail of modernity with contrasts. YSL Myslf men\'s fragrance opens with a fresh and vibrant accord of Calabrian bergamot and green bergamot. At its heart lies a pure and intense orange blossom absolute from Tunisia, created exclusively for YSL beauty. The fragrance finishes with a sensual and textured woody accord of Indonesian patchouli and Ambrofix™. A YSL icon in a bottle. Elegant. Fluid. The YSL Myslf men\'s fragrance comes in a black lacquered bottle with shades that reflect your own image. At its center, embedded in the glass, is the iconic YSL Cassandre logo.',
            sizes: [
                'Decante 10ML',
                'Decante 20ML',
                'Decante 30ML',
                '60ML',
                '100ML'
            ],
            notes: [
                {
                    title: 'CALABRIAN BERGAMOT',
                    text: 'A fresh and vibrant opening with Calabrian bergamot and green bergamot for instant brightness.'
                },
                {
                    title: 'TUNISIAN ORANGE BLOSSOM',
                    text: 'An intense orange blossom absolute from Tunisia, crafted exclusively for YSL Beauty.'
                },
                {
                    title: 'PATCHOULI & AMBROFIX™',
                    text: 'A sensual woody base of Indonesian patchouli and Ambrofix™ creates texture and modern depth.'
                }
            ],
            fr: {
                subtitle: "Parfum homme · Floral Boisé · Une signature masculine moderne avec bergamote, fleur d'oranger, patchouli et Ambrofix™.",
                longDescription: "Yves Saint Laurent\'s nouveau parfum homme rechargeable est Myslf. Une expression de l'homme que vous êtes, avec toutes vos nuances. Une déclaration de masculinité moderne, embrassant toutes ses facettes et émotions. Le premier parfum floral boisé de YSL BEAUTY pour un sillage de modernité. Le parfum YSL Myslf s'ouvre sur un accord frais et vibrant de bergamote calabraise et bergamote verte. En cœur, un absolu de fleur d'oranger pur et intense de Tunisie, créé exclusivement pour YSL beauty. Le parfum se termine sur un accord boisé sensuel et texturé de patchouli indonésien et d'Ambrofix™.",
                notes: [
                    { title: 'BERGAMOTE DE CALABRE', text: 'Une ouverture fraîche et vibrante avec bergamote de Calabre et bergamote verte pour une luminosité instantanée.' },
                    { title: 'FLEUR D\'ORANGER DE TUNISIE', text: 'Un absolu de fleur d\'oranger intense de Tunisie, créé exclusivement pour YSL Beauty.' },
                    { title: 'PATCHOULI & AMBROFIX™', text: 'Une base boisée sensuelle de patchouli indonésien et d\'Ambrofix™ crée texture et profondeur moderne.' }
                ]
            },
            images: [
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Yves%20Saint%20Laurent%20Myslf%20Eau%20de%20Parfum/2.webp',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Yves%20Saint%20Laurent%20Myslf%20Eau%20de%20Parfum/3.webp',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Yves%20Saint%20Laurent%20Myslf%20Eau%20de%20Parfum/4.webp',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Yves%20Saint%20Laurent%20Myslf%20Eau%20de%20Parfum/5.webp'
            ]
        },
        'yves saint laurent myslf le parfum': {
            brand: 'YVES SAINT LAURENT',
            fragranceProfile: { longevity: 85, longevityLabel: '8-10h', sillage: 78, sillageLabel: 'Strong', season: 75, seasonLabel: 'All Year' },
            subtitle: 'Men\'s fragrance · Floral Woody · A new intense and sensual MYSLF signature with black pepper, orange blossom, woods, and vanilla.',
            longDescription: 'YVES SAINT LAURENT MYSLF Le Parfum Floral Woody Men\'s Fragrance. MYSLF Le Parfum, the new and intense floral woody men\'s fragrance designed to leave a sensual and lasting trail. A new affirmation of modern masculinity. The expression of the man you are, with all your facets and emotions. The fragrance opens with a sparkling and exotic accord of black pepper, which gives way to a radiant and rich heart of orange blossom. In the base notes, the sensuality of woods envelops a velvety infusion of vanilla, creating an irresistible trail that lingers on the skin. Matte black and the bold shine of YSL\'s Casandra. The bottle is a perfect play of contrasts that reflects the duality of the YSL man: bold and self-assured, sophisticated and sentimental. A style statement as complex as the man who wears it.',
            sizes: [
                'Decante 10ML',
                'Decante 20ML',
                'Decante 30ML',
                '60ML',
                '100ML'
            ],
            notes: [
                {
                    title: 'BLACK PEPPER ACCORD',
                    text: 'A sparkling and exotic opening of black pepper creates an energetic first impression.'
                },
                {
                    title: 'ORANGE BLOSSOM HEART',
                    text: 'A radiant and rich orange blossom heart gives the fragrance elegant floral intensity.'
                },
                {
                    title: 'WOODS & VANILLA',
                    text: 'Sensual woods wrapped in velvety vanilla create a lasting and irresistible trail.'
                }
            ],
            fr: {
                subtitle: "Parfum homme · Floral Boisé · Une nouvelle signature MYSLF intense et sensuelle avec poivre noir, fleur d'oranger, bois et vanille.",
                longDescription: "MYSLF Le Parfum, le nouveau et intense parfum floral boisé pour homme conçu pour laisser un sillage sensuel et durable. Une nouvelle affirmation de la masculinité moderne. Le parfum s\'ouvre sur un accord étincelant et exotique de poivre noir, qui laisse place à un cœur radieux et riche de fleur d'oranger. En fond, la sensualité des bois enveloppe une infusion veloutée de vanille, créant un sillage irrésistible qui persiste sur la peau.",
                notes: [
                    { title: 'ACCORD POIVRE NOIR', text: 'Une ouverture étincelante et exotique de poivre noir crée une première impression énergétique.' },
                    { title: 'CŒUR FLEUR D\'ORANGER', text: 'Un cœur de fleur d\'oranger radieux et riche donne au parfum une intensité florale élégante.' },
                    { title: 'BOIS & VANILLE', text: 'Les bois sensuels enveloppés dans la vanille veloutée créent un sillage durable et irrésistible.' }
                ]
            },
            images: [
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Yves%20Saint%20Laurent%20MYSLF%20Le%20Parfum/2.webp',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Yves%20Saint%20Laurent%20MYSLF%20Le%20Parfum/3.webp',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Yves%20Saint%20Laurent%20MYSLF%20Le%20Parfum/4.jpg'
            ]
        },
        'jean paul gaultier le male elixir eau de parfum': {
            brand: 'JEAN PAUL GAULTIER',
            fragranceProfile: { longevity: 90, longevityLabel: '10-12h', sillage: 88, sillageLabel: 'Very Strong', season: 55, seasonLabel: 'Fall/Winter' },
            subtitle: 'Men\'s fragrance · Aromatic Amber · Intense, sexy and addictive with lavender, tonka bean, mint and benzoin.',
            longDescription: 'Le Male Elixir Eau de Parfum, Jean Paul Gaultier\'s new sailor-inspired fragrance, has arrived. More intense and sexier than ever. When he steps aboard, Le Male Elixir unleashes a wave of heat. This men\'s fragrance is so intense that the gold melts, creating golden trails along its sleek torso and metallic case. Male Elixir takes the reins of sensuality, exuding the ultimate expression of sex appeal. Be careful not to touch its skin, you\'ll get burned! Male Elixir ignites all the senses, creating maximum addiction. Sunny tropical tonka bean blends with already legendary lavender and, with the animal magnetism of benzoin, creates an explosion of fresh mint and bergamot. Impossible not to melt with desire. With Jean Paul Gaultier\'s Le Male Elixir, the senses are awakened, desire burns, and gold flows freely. Dazzling and sexy.',
            sizes: [
                'Decante 10ML',
                'Decante 20ML',
                'Decante 30ML',
                '75ML',
                '125ML'
            ],
            notes: [
                {
                    title: 'LAVENDER & MINT',
                    text: 'A fresh aromatic opening where iconic lavender meets sparkling mint and bright bergamot.'
                },
                {
                    title: 'TONKA BEAN',
                    text: 'Sunny tropical tonka bean adds warmth and addictive sweetness at the heart of the fragrance.'
                },
                {
                    title: 'BENZOIN MAGNETISM',
                    text: 'Sensual benzoin deepens the trail with an animalic amber touch for a bold, burning signature.'
                }
            ],
            fr: {
                subtitle: "Parfum homme · Ambré Aromatique · Intense, sexy et addictif avec lavande, fève tonka, menthe et benzoïn.",
                longDescription: "Le Male Elixir Eau de Parfum, le nouveau parfum de Jean Paul Gaultier inspiré du marin, est arrivé. Plus intense et plus sexy que jamais. Quand il monte à bord, Le Male Elixir libère une vague de chaleur. Ce parfum masculin est si intense que l'or fond, créant des traînees dorées. La fève tonka tropicale et ensoleillée se mélange à la lavande légendaire et, avec le magnétisme animal du benzoïn, crée une explosion de menthe fraîche et de bergamote.",
                notes: [
                    { title: 'LAVANDE & MENTHE', text: 'Une ouverture aromatique fraîche où la lavande iconique rencontre la menthe étincelante et la bergamote lumineuse.' },
                    { title: 'FÈVE TONKA', text: 'La fève tonka tropicale et ensoleillée ajoute chaleur et douceur addictive au cœur du parfum.' },
                    { title: 'MAGNÉTISME DU BENZOÏN', text: 'Le benzoïn sensuel approfondit le sillage avec une touche ambrée animale pour une signature audacieuse et brûlante.' }
                ]
            },
            images: [
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Jean%20Paul%20Gaultier%20Le%20Male%20Elixir/2.webp',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Jean%20Paul%20Gaultier%20Le%20Male%20Elixir/3.webp',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Jean%20Paul%20Gaultier%20Le%20Male%20Elixir/4.webp'
            ]
        },
        'jean paul gaultier le male in blue eau de parfum': {
            brand: 'JEAN PAUL GAULTIER',
            fragranceProfile: { longevity: 86, longevityLabel: '8-10h', sillage: 84, sillageLabel: 'Strong', season: 68, seasonLabel: 'Spring/Summer' },
            subtitle: 'Men\'s fragrance · Aromatic Spicy · A bold blue limited edition with lavender, benzoin, and an ocean-charged trail.',
            longDescription: 'With Le Male In Blue, a wave of aromatic and spicy freedom looms over the sea. Vaster than the horizon, stronger than a tidal wave, its intense eau de parfum immerses you in a captivating, all-encompassing blue. Gone are the gentle waves. Wearing a black sailor shirt over his deep blue torso, the boldest of sailors tattoos his case with an eccentric wave inspired by the Maison\'s archives. He provokes with his wingspan, bare torso, and lavender on his stern, and with a benzoin-drenched courage. A limited edition with a lasting trail, transforming this new wave into legend.',
            sizes: [
                'Decante 10ML',
                'Decante 20ML',
                'Decante 30ML',
                '75ML',
                '125ML'
            ],
            notes: [
                {
                    title: 'AROMATIC BLUE WAVE',
                    text: 'An aromatic and spicy opening surges forward with the energy of open sea air and a daring blue freshness.'
                },
                {
                    title: 'LAVENDER STERN',
                    text: 'Jean Paul Gaultier\'s iconic lavender signature gives the fragrance its sensual sailor identity and refined lift.'
                },
                {
                    title: 'BENZOIN TRAIL',
                    text: 'Benzoin drenches the base in warm courage, leaving a deep and lasting limited-edition signature.'
                }
            ],
            fr: {
                subtitle: "Parfum homme · Aromatique Épicé · Une édition limitée bleue audacieuse avec lavande, benzoïn et un sillage chargé d'océan.",
                longDescription: "Avec Le Male In Blue, une vague de liberté aromatique et épicée se profile sur la mer. Plus vaste que l’horizon, plus forte qu’une marée, son eau de parfum intense vous plonge dans un bleu captivant et global. Le marin le plus audacieux tatouage son étui d'une vague excentrique inspirée des archives de la Maison, avec la lavande à la poupe et un courage trempé de benzoïn.",
                notes: [
                    { title: 'VAGUE BLEUE AROMATIQUE', text: 'Une ouverture aromatique et épicée se projette en avant avec l’énergie de l’air marin ouvert et une fraîcheur bleue audacieuse.' },
                    { title: 'LAVANDE POUPE', text: 'La signature iconique de lavande de Jean Paul Gaultier donne au parfum son identité de marin sensuel et une tonalité raffinée.' },
                    { title: 'SILLAGE DE BENZOÏN', text: 'Le benzoïn trempe le fond d’un courage chaud, laissant une signature profonde et durable d’édition limitée.' }
                ]
            },
            images: [
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Jean%20Paul%20Gaultier%20Le%20Male%20In%20Blue%20Eau%20de%20Parfum/2.jpg',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Jean%20Paul%20Gaultier%20Le%20Male%20In%20Blue%20Eau%20de%20Parfum/3.jpg'
            ]
        },
        'jean paul gaultier le male eau de toilette': {
            brand: 'JEAN PAUL GAULTIER',
            fragranceProfile: { longevity: 78, longevityLabel: '6-8h', sillage: 76, sillageLabel: 'Strong', season: 72, seasonLabel: 'All Year' },
            subtitle: 'Men\'s fragrance · Fresh Amber · The iconic sailor signature balancing mint, lavender, vanilla, and sandalwood.',
            longDescription: 'Jean Paul Gaultier Le Male EDT, a men\'s fragrance that combines freshness and warmth, inspired by the iconic sailor. Ideal for men with bold style. This perfume is an expression of modern masculinity, capturing the essence of the contemporary man who defies traditional norms. With a blend of fresh and warm notes, Le Male EDT offers an olfactory experience that is both stimulating and comforting, leaving a lasting impression. What sets Le Male EDT apart from other fragrances is its ability to balance freshness with enveloping warmth. Its top notes include mint and lavender, which provide an immediate sense of freshness. As it evolves, the fragrance reveals a heart of cinnamon and orange blossom, adding a spicy and floral touch. Finally, the base notes of vanilla and sandalwood provide a soft, sensual warmth that lingers on the skin. This perfume is designed for men seeking a distinctive fragrance that reflects their bold and confident personality. It is ideal for those who want to stand out with a scent that is both classic and modern. Perfect for everyday wear or special occasions, Le Male EDT is a versatile choice for any man looking to leave a lasting impression. Le Male EDT comes in a bottle designed in the iconic male torso shape that characterizes the Jean Paul Gaultier brand. To apply, spray a small amount on pulse points, such as the neck and wrists, for optimal fragrance diffusion. In addition to its captivating fragrance, Le Male EDT stands out for its commitment to sustainability. The brand strives to use recyclable materials in its packaging and promotes responsible production practices. This makes Le Male EDT not only an exceptional olfactory choice but also a conscious option for the modern consumer.',
            sizes: [
                'Decante 10ML',
                'Decante 20ML',
                'Decante 30ML',
                '75ML',
                '125ML'
            ],
            notes: [
                {
                    title: 'MINT & LAVENDER',
                    text: 'A fresh aromatic opening of mint and lavender gives Le Male EDT its instantly recognizable sailor signature.'
                },
                {
                    title: 'CINNAMON BLOOM',
                    text: 'Cinnamon and orange blossom create a warm spicy-floral heart that feels bold, modern, and comforting.'
                },
                {
                    title: 'VANILLA WOODS',
                    text: 'Vanilla and sandalwood settle into a smooth sensual base with lasting warmth and everyday versatility.'
                }
            ],
            fr: {
                subtitle: "Parfum homme · Ambré Frais · La signature iconique du marin alliant menthe, lavande, vanille et santal.",
                longDescription: "Jean Paul Gaultier Le Male EDT, un parfum masculin qui associe fraîcheur et chaleur, inspiré du marin iconique. Idéal pour les hommes au style audacieux. Ce parfum est une expression de la masculinité moderne, capturant l'essence de l'homme contemporain qui brave les normes traditionnelles. Ses notes de tête incluent la menthe et la lavande. Au cœur, la cannelle et la fleur d'oranger ajoutent une touche épicée et florale. Les notes de fond de vanille et santal procurent leur douceur sensuelle.",
                notes: [
                    { title: 'MENTHE & LAVANDE', text: 'Une ouverture aromatique fraîche de menthe et lavande donne au Le Male EDT sa signature de marin immmédiatement reconnaissable.' },
                    { title: 'FLEUR DE CANNELLE', text: 'La cannelle et la fleur d\'oranger créent un cœur épicé-floral chaud qui se felt audacieux, moderne et réconfortant.' },
                    { title: 'BOIS VANILLÉ', text: 'La vanille et le santal s\'installent dans un fond sensuel lisse avec une chaleur durable et une polyvalence quotidienne.' }
                ]
            },
            images: [
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Le%20Male%20Eau%20de%20Toilette/2.png',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Le%20Male%20Eau%20de%20Toilette/3.jpg',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Le%20Male%20Eau%20de%20Toilette/4.jpg'
            ]
        },
        'jean paul gaultier le male le parfum eau de parfum': {
            brand: 'JEAN PAUL GAULTIER',
            fragranceProfile: { longevity: 85, longevityLabel: '8-10h', sillage: 80, sillageLabel: 'Strong', season: 60, seasonLabel: 'Fall/Winter' },
            subtitle: 'Men\'s fragrance · Woody Oriental · Intense elegance in a black and gold signature bottle.',
            longDescription: 'On the way to Le Male Le Parfum, the new men\'s fragrance from Jean Paul Gaultier! With its official black and gold packaging, this intense eau de parfum revisits the Le Male olfactory line with style and strength. An elegant, woody oriental trail, imbued with the charisma and power of a leader. Sailors to your stations! The captain is here, for an almost imminent departure.',
            sizes: [
                'Decante 10ML',
                'Decante 20ML',
                'Decante 30ML',
                '75ML',
                '125ML'
            ],
            notes: [
                {
                    title: 'SPICY OPENING',
                    text: 'A bold spicy start sets a commanding tone and announces the fragrance with confidence.'
                },
                {
                    title: 'WOODY HEART',
                    text: 'A rich woody core shapes the elegant masculine character of this intense composition.'
                },
                {
                    title: 'ORIENTAL TRAIL',
                    text: 'A warm oriental base leaves a charismatic and powerful trail with long-lasting depth.'
                }
            ],
            fr: {
                subtitle: "Parfum homme · Boisé Oriental · Élégance intense dans un flacon signature noir et or.",
                longDescription: "Direction Le Male Le Parfum, le nouveau parfum masculin de Jean Paul Gaultier ! Avec son emballage officiel noir et or, cette eau de parfum intense revisite la ligne olfactive Le Male avec style et force. Un sillage oriental boisé élégant, empreint du charisme et de la puissance d'un leader.",
                notes: [
                    { title: 'OUVERTURE ÉPICÉE', text: 'Un début épicé et audacieux donne le ton et annonce le parfum avec confiance.' },
                    { title: 'CŒUR BOISÉ', text: 'Un noyau boisé riche façonne le caractère masculin élégant de cette composition intense.' },
                    { title: 'SILLAGE ORIENTAL', text: 'Un fond oriental chaud laisse un sillage charismatique et puissant avec une profondeur durable.' }
                ]
            },
            images: [
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Jean%20Paul%20Gaultier%20Le%20Male%20Le%20Parfum%20Eau%20de%20Parfum/2.webp',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Jean%20Paul%20Gaultier%20Le%20Male%20Le%20Parfum%20Eau%20de%20Parfum/1.webp',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Jean%20Paul%20Gaultier%20Le%20Male%20Le%20Parfum%20Eau%20de%20Parfum/3.webp',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Jean%20Paul%20Gaultier%20Le%20Male%20Le%20Parfum%20Eau%20de%20Parfum/4.webp',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Jean%20Paul%20Gaultier%20Le%20Male%20Le%20Parfum%20Eau%20de%20Parfum/5.webp'
            ]
        },
        'jean paul gaultier le beau eau de parfum': {
            brand: 'JEAN PAUL GAULTIER',
            fragranceProfile: { longevity: 80, longevityLabel: '7-9h', sillage: 75, sillageLabel: 'Strong', season: 70, seasonLabel: 'Spring/Summer' },
            subtitle: 'Men\'s fragrance · Woody Amber · Intense and sensual with tonka bean, sandalwood, ginger, pineapple, and ambergris.',
            longDescription: 'Le Beau Le Parfum, Men\'s Perfume, Intense Eau de Parfum. Le Beau Le Parfum, the new original and intense men\'s fragrance by Jean Paul Gaultier. While Jean Paul Gaultier created this fragrance in its purest form, it wasn\'t designed to be dressed up! The bottle, lacquered in black and green, boasts a sleek and muscular silhouette, adorned with a golden fabric leaf as if it were a single garment. The new Eau de Parfum Intense is an even more sensual temptation, with its exciting woody amber scent. Le Beau is a men\'s fragrance built around an addictive tonka bean, sandalwood, ginger, pineapple, and ambergris. A light yet powerful base for a seductive and ultra-sexy man.',
            sizes: [
                'Decante 10ML',
                'Decante 20ML',
                'Decante 30ML',
                '75ML',
                '125ML'
            ],
            notes: [
                {
                    title: 'GINGER & PINEAPPLE',
                    text: 'A vibrant fruity-spicy opening where fresh ginger meets juicy pineapple for instant attraction.'
                },
                {
                    title: 'TONKA BEAN',
                    text: 'Addictive tonka bean builds warmth and sensual depth in the heart of the fragrance.'
                },
                {
                    title: 'SANDALWOOD & AMBERGRIS',
                    text: 'A woody amber base of sandalwood and ambergris creates a smooth, powerful masculine trail.'
                }
            ],
            fr: {
                subtitle: "Parfum homme · Boisé Ambré · Intense et sensuel avec fève tonka, santal, gingembre, ananas et ambre gris.",
                longDescription: "Le Beau Le Parfum, parfum masculin intense de Jean Paul Gaultier. La nouvelle eau de parfum intense est une tentation encore plus sensuelle, avec son parfum boisé ambré excitant. Le Beau est un parfum masculin construit autour d'une fève tonka addictive, du santal, du gingembre, de l'ananas et de l'ambre gris. Une base légère mais puissante pour un homme séducteur et ultra-sexy.",
                notes: [
                    { title: 'GINGEMBRE & ANANAS', text: 'Une ouverture fruitée-épicée et vibrante où le gingembre frais rencontre l’ananas juteux pour une attraction instantanée.' },
                    { title: 'FÈVE TONKA', text: 'La fève tonka addictive construit chaleur et profondeur sensuelle au cœur du parfum.' },
                    { title: 'SANTAL & AMBRE GRIS', text: 'Un fond boisé ambré de santal et ambre gris crée un sillage masculin lisse et puissant.' }
                ]
            },
            images: [
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Jean%20Paul%20Gaultier%20Le%20Beau%20Eau%20de%20Parfum/2.jpg',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Jean%20Paul%20Gaultier%20Le%20Beau%20Eau%20de%20Parfum/3.jpg',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Jean%20Paul%20Gaultier%20Le%20Beau%20Eau%20de%20Parfum/4.jpg',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Jean%20Paul%20Gaultier%20Le%20Beau%20Eau%20de%20Parfum/5.jpg'
            ]
        },
        'carolina herrera bad boy eau de toilette': {
            brand: 'CAROLINA HERRERA',
            gender: 'men',
            fragranceProfile: { longevity: 82, longevityLabel: '8-10h', sillage: 74, sillageLabel: 'Moderate-Strong', season: 68, seasonLabel: 'All Year' },
            subtitle: "Men's fragrance · Oriental · A modern masculine signature balancing sparkling bergamot, pepper, cedarwood, sage, tonka bean, and cacao.",
            longDescription: 'CAROLINA HERRERA Bad Boy Refillable Eau de Toilette embodies the duality between playful freshness and the warmth of nature. This Carolina Herrera perfume for men, with its oriental scent, is a manifestation of modern masculinity, intended for men who forge their own paths without fear of showing their sensitivity alongside their great strength. Bad Boy Eau de Toilette opens with a citrus burst featuring top notes of green Italian bergamot. As you explore its nuances, cedarwood and sage add warmth that settles on a base of tonka bean and cacao. It is a true statement of intent. Olfactory Family: Oriental. Top notes: Black Pepper, White Pepper and Italian Green Bergamot. Heart notes: Cedarwood and Sage. Base notes: Tonka bean and cocoa.',
            sizes: [
                'Decante 10ML',
                'Decante 20ML',
                'Decante 30ML',
                '50ML',
                '100ML'
            ],
            notes: [
                {
                    title: 'PEPPER & BERGAMOT OPENING',
                    text: 'Black pepper, white pepper, and Italian green bergamot create a bright citrus-spice opening with instant energy.'
                },
                {
                    title: 'CEDARWOOD & SAGE HEART',
                    text: 'Cedarwood and sage bring aromatic warmth through the heart, giving the scent its confident modern structure.'
                },
                {
                    title: 'TONKA BEAN & CACAO BASE',
                    text: 'Tonka bean and cacao settle into a warm oriental trail that feels sensual, smooth, and unmistakably masculine.'
                }
            ],
            fr: {
                subtitle: "Parfum homme · Oriental · Une signature masculine moderne avec bergamote, poivre, cèdre, sauge, fève tonka et cacao.",
                longDescription: "CAROLINA HERRERA Bad Boy Refillable Eau de Toilette incarne la dualité entre fraîcheur ludique et chaleur naturelle. Ce parfum Carolina Herrera pour homme, au parfum oriental, est une manifestation de la masculinité moderne, destiné aux hommes qui tracent leur propre chemin. Bad Boy EDT s'ouvre sur un éclat citrus avec des notes de tête de bergamote verte d'Italie. Le cèdre et la sauge ajoutent de la chaleur qui repose sur un fond de fève tonka et cacao.",
                notes: [
                    { title: 'OUVERTURE POIVRE & BERGAMOTE', text: 'Le poivre noir, poivre blanc et bergamote verte d\'Italie créent une ouverture agrumes-épicée avec une énergie instantanée.' },
                    { title: 'CÈDRE & SAUGE AU CŒUR', text: 'Le cèdre et la sauge apportent chaleur aromatique au cœur, donnant au parfum sa structure moderne et confiante.' },
                    { title: 'FÈVE TONKA & CACAO EN FOND', text: 'La fève tonka et le cacao s\'installent dans un sillage oriental chaud qui se felt sensuel, lisse et incontestablement masculin.' }
                ]
            },
            images: [
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Carolina%20Herrera%20Bad%20Boy%20Eau%20de%20Toilette/2.jpg',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Carolina%20Herrera%20Bad%20Boy%20Eau%20de%20Toilette/3.jpg',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Carolina%20Herrera%20Bad%20Boy%20Eau%20de%20Toilette/4.jpg',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Carolina%20Herrera%20Bad%20Boy%20Eau%20de%20Toilette/5.jpg'
            ]
        },
        'gucci guilty absolu de parfum pour homme': {
            brand: 'GUCCI',
            gender: 'men',
            fragranceProfile: { longevity: 88, longevityLabel: '9-11h', sillage: 77, sillageLabel: 'Strong', season: 58, seasonLabel: 'Fall/Winter' },
            subtitle: "Men's fragrance · Woody Ambery · An intimate refined composition with rum accord, orange blossom absolute, and red chili pepper.",
            longDescription: 'The new Gucci Guilty fragrances celebrate the art of refinement, inviting the wearer on a sensory journey into an intimate and sophisticated world. Gucci Guilty Absolu de Parfum for Men is an intense, woody, and ambery composition. At its heart, a rich rum accord brings warmth and depth, enhanced by the radiance of orange blossom absolute. A touch of red chili pepper adds dynamism, creating a striking contrast that enriches the fragrance\'s complexity.',
            sizes: [
                'Decante 10ML',
                'Decante 20ML',
                'Decante 30ML',
                '50ML',
                '100ML'
            ],
            notes: [
                {
                    title: 'RUM ACCORD WARMTH',
                    text: 'A rich rum accord shapes the heart with warmth, depth, and a smooth refined intensity.'
                },
                {
                    title: 'ORANGE BLOSSOM RADIANCE',
                    text: 'Orange blossom absolute brightens the composition with a sophisticated floral glow.'
                },
                {
                    title: 'RED CHILI PEPPER CONTRAST',
                    text: 'Red chili pepper adds a vivid spicy contrast that sharpens the scent and deepens its character.'
                }
            ],
            fr: {
                subtitle: "Parfum homme · Boisé Ambré · Une composition intime et raffinée avec accord rhum, fleur d'oranger absolue et poivre de piment rouge.",
                longDescription: "Les nouveaux parfums Gucci Guilty célèbrent l'art du raffinement, invitant le porteur dans un voyage sensoriel intime et sophistiqué. Gucci Guilty Absolu de Parfum pour Homme est une composition intense, boisée et ambrée. Au cœur, un riche accord de rhum apporte chaleur et profondeur, rehussé par le rayonnement du fleur d'oranger absolu. Une touche de piment rouge ajoute du dynamisme, créant un contraste saisissant.",
                notes: [
                    { title: 'CHALEUR DE L\'ACCORD RHUM', text: 'Un riche accord de rhum façonne le cœur avec chaleur, profondeur et une intensité raffinée et lisse.' },
                    { title: 'RAYONNEMENT FLEUR D\'ORANGER', text: 'La fleur d\'oranger absolue éclaire la composition avec une lueur florale sophistiquée.' },
                    { title: 'CONTRASTE PIMENT ROUGE', text: 'Le piment rouge ajoute un contraste épicé vif qui aiguise le parfum et approfondit son caractère.' }
                ]
            },
            images: [
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Gucci%20Guilty%20Absolu%20de%20Parfum%20Pour%20Homme/2.webp',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Gucci%20Guilty%20Absolu%20de%20Parfum%20Pour%20Homme/3.jpg'
            ]
        },
        'gucci guilty elixir pour homme': {
            brand: 'GUCCI',
            gender: 'men',
            fragranceProfile: { longevity: 92, longevityLabel: '10-12h', sillage: 84, sillageLabel: 'Strong', season: 54, seasonLabel: 'Fall/Winter' },
            subtitle: "Men's fragrance · Amber Leather · A powerful Gucci Guilty elixir with iris butter, Ambrofix, benzoin, vanillin, and smoky nutmeg.",
            longDescription: 'Gucci Guilty Elixir de Parfum for Men is an invitation to self-love and self-acceptance. It exudes an amber and tanned fragrance with notes of patchouli, the signature ingredient of the Gucci Guilty line, whose high concentration produces an intensely powerful effect. The fragrance is presented in a vibrant bottle, designed to elegantly mirror its feminine counterpart. Eau de parfum. Olfactory family: amber and tanned notes. Key ingredients: iris butter, Ambrofix, benzoin. The original essence is amplified by the addition of vanillin extract, while iris butter, noble by nature, gives it a warm and enveloping aroma. The exhilarating Ambrofix, complemented by smoky nutmeg notes, enhances the uniqueness of the fragrance and allows it to fully express its character. Benzoin in the base note lends depth and magnetism to this fragrance. Packaging: the bottle comes in a refined green color; it is embellished with the House\'s intertwined GG detail and topped with a brushed silver cap.',
            sizes: [
                'Decante 10ML',
                'Decante 20ML',
                'Decante 30ML',
                '50ML',
                '100ML'
            ],
            notes: [
                {
                    title: 'IRIS BUTTER & VANILLIN',
                    text: 'Warm iris butter and vanillin build an enveloping amber core with rich sensual texture.'
                },
                {
                    title: 'AMBROFIX & SMOKY NUTMEG',
                    text: 'Ambrofix and smoky nutmeg sharpen the signature with modern radiance and bold character.'
                },
                {
                    title: 'BENZOIN DEPTH',
                    text: 'Benzoin anchors the base with resinous depth and lasting magnetism.'
                }
            ],
            fr: {
                subtitle: "Parfum homme · Cuir Ambré · Un élixir Gucci Guilty puissant avec beurre d'iris, Ambrofix, benzoïn, vanilline et muscade fumée.",
                longDescription: "Gucci Guilty Elixir de Parfum pour Homme est une invitation à l'amour de soi et à l'acceptation de soi. Il dégage un parfum ambré et tauné avec des notes de patchouli, l'ingrédient signature de la ligne Gucci Guilty. Le beurre d'iris, noble par nature, lui confère un arôme chaud et enveloppant. L'Ambrofix exhilarant, complété par des notes de muscade fumée, renforce l'unicité du parfum. Le benzoïn en fond confère profondeur et magnétisme.",
                notes: [
                    { title: 'BEURRE D\'IRIS & VANILLINE', text: 'Le beurre d\'iris chaud et la vanilline construisent un cœur ambré enveloppant avec une texture sensuelle riche.' },
                    { title: 'AMBROFIX & MUSCADE FUMÉE', text: 'L\'Ambrofix et la muscade fumée affinent la signature avec un rayonnement moderne et un caractère audacieux.' },
                    { title: 'PROFONDEUR DU BENZOÏN', text: 'Le benzoïn ancre le fond avec une profondeur résineuse et un magnétisme durable.' }
                ]
            },
            images: [
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Gucci%20Guilty%20Elixir%20Pour%20Homme/2.webp',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Gucci%20Guilty%20Elixir%20Pour%20Homme/3.webp',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Gucci%20Guilty%20Elixir%20Pour%20Homme/4.webp'
            ]
        },
        'montale arabians tonka': {
            brand: 'MONTALE',
            gender: 'unisex',
            fragranceProfile: { longevity: 94, longevityLabel: '12h+', sillage: 88, sillageLabel: 'Powerful', season: 48, seasonLabel: 'Fall/Winter' },
            subtitle: 'Unisex fragrance · Oriental Gourmand · An iconic bestseller blending tonka bean, rose, bergamot, oud, and leather.',
            longDescription: 'An iconic bestseller, Arabians Tonka charms with its refined gourmand notes: smooth tonka bean, captivating rose, and the radiance of bergamot unite with oud and leather. Powerful, sweet, unforgettable.',
            sizes: [
                'Decante 10ML',
                'Decante 20ML',
                'Decante 30ML',
                '50ML',
                '100ML'
            ],
            notes: [
                {
                    title: 'BERGAMOT & TONKA',
                    text: 'Radiant bergamot and smooth tonka bean open the scent with sweetness and polished lift.'
                },
                {
                    title: 'CAPTIVATING ROSE',
                    text: 'Rose adds a refined floral richness that softens the power of the composition.'
                },
                {
                    title: 'OUD & LEATHER TRAIL',
                    text: 'Oud and leather form a dark unforgettable base with bold niche presence.'
                }
            ],
            fr: {
                subtitle: "Parfum unisexe · Gourmand Oriental · Un bestseller iconique alliant fève tonka, rose, bergamote, oud et cuir.",
                longDescription: "Un bestseller iconique, Arabians Tonka charme avec ses raffinées notes gourmandes : la douce fève tonka, la rose captivante et le rayonnement de la bergamote s'unissent à l'oud et au cuir. Puissant, doux, inoubliable.",
                notes: [
                    { title: 'BERGAMOTE & TONKA', text: 'La bergamote rayonnante et la douce fève tonka ouvrent le parfum avec douceur et légèreté raffinée.' },
                    { title: 'ROSE CAPTIVANTE', text: 'La rose ajoute une richesse florale raffinée qui adoucit la puissance de la composition.' },
                    { title: 'SILLAGE OUD & CUIR', text: 'L\'oud et le cuir forment un fond sombre et inoubliable avec une présence niche audacieuse.' }
                ]
            },
            images: [
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Montale%20Arabians%20Tonka/2.webp',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Montale%20Arabians%20Tonka/3.webp'
            ]
        },
        'prada luna rossa ocean eau de parfum': {
            brand: 'PRADA',
            gender: 'men',
            fragranceProfile: { longevity: 89, longevityLabel: '9-11h', sillage: 79, sillageLabel: 'Strong', season: 82, seasonLabel: 'All Year' },
            subtitle: "Men's fragrance · Amber Woody · A sophisticated and sensual signature blending grapefruit essence, incense, vanilla, and the amplified power of AmberXtreme.",
            longDescription: 'PRADA Luna Rossa Ocean Eau de Parfum combines intense sophistication and sensuality through a contrast of innovative technology and nature\'s finest ingredients. The fragrance opens with an invigorating burst of grapefruit essence, moves into the woody vibrancy of incense, and settles into a rich vanilla accord, creating a fresh yet deeply sensual trail that lasts with confident intensity.',
            mainAccords: ['Fresh', 'Citrus', 'Incense', 'Woody', 'Vanilla', 'Amber'],
            sizes: [
                'Decante 10ML',
                'Decante 20ML',
                'Decante 30ML',
                '50ML',
                '100ML'
            ],
            notes: [
                {
                    title: 'GRAPEFRUIT, INCENSE & VANILLA',
                    text: 'A vivid citrus opening meets smoky incense and a rich vanilla accord for a refined contrast of freshness and sensual depth.'
                },
                {
                    title: 'AMBERXTREME TECHNOLOGY',
                    text: 'Enriched with the advanced AmberXtreme molecule, the composition feels more intense, more radiant, and leaves a longer-lasting trail.'
                },
                {
                    title: 'COMPLEX MODERN BALANCE',
                    text: 'Fresh, woody, and sweet facets are balanced with precision, making it an elegant designer scent for everyday confidence and evening polish.'
                }
            ],
            fr: {
                subtitle: 'Parfum homme · Boisé Ambré · Une signature sophistiquée et sensuelle mêlant essence de pamplemousse, encens, vanille et la puissance amplifiée de AmberXtreme.',
                longDescription: 'PRADA Luna Rossa Ocean Eau de Parfum associe sophistication intense et sensualité grâce au contraste entre technologie innovante et ingrédients naturels d\'exception. Le parfum s\'ouvre sur un éclat vivifiant d\'essence de pamplemousse, évolue vers la vibration boisée de l\'encens, puis se pose sur un accord de vanille riche, créant un sillage à la fois frais, profond et durable.',
                notes: [
                    { title: 'PAMPLEMOUSSE, ENCENS & VANILLE', text: 'Une ouverture citrique vive rencontre un encens fumé et un accord de vanille riche pour un contraste raffiné entre fraîcheur et sensualité profonde.' },
                    { title: 'TECHNOLOGIE AMBERXTREME', text: 'Enrichie par la molécule avancée AmberXtreme, la composition gagne en intensité, en rayonnement et en tenue longue durée.' },
                    { title: 'ÉQUILIBRE MODERNE COMPLEXE', text: 'Les facettes fraîches, boisées et douces s\'équilibrent avec précision pour une fragrance designer élégante, adaptée au quotidien comme au soir.' }
                ]
            },
            images: [
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Prada%20Luna%20Rossa%20Ocean%20Eau%20de%20Parfum/1.jpg',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Prada%20Luna%20Rossa%20Ocean%20Eau%20de%20Parfum/2.jpg',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Prada%20Luna%20Rossa%20Ocean%20Eau%20de%20Parfum/3.jpg'
            ]
        },
        'prada luna rossa carbon edt': {
            brand: 'PRADA',
            gender: 'men',
            fragranceProfile: { longevity: 84, longevityLabel: '8-10h', sillage: 72, sillageLabel: 'Strong', season: 85, seasonLabel: 'All Year' },
            subtitle: "Men's fragrance · Aromatic Fougère · A mineral, modern Prada signature with metallic lavender, Italian bergamot, patchouli, and amber-dry Ambroxan.",
            longDescription: 'PRADA Luna Rossa Carbon EDT, launched in 2017, offers a unique olfactory experience by fusing steam-distilled botanical notes with synthetic elements in a captivating mineral blend. Classified as an aromatic fougère, it achieves the intensity of the darkest rock alongside the freshness of air. The composition reveals metallic touches of lavender, the citrus lift of Vert di Bergamote from Italy, the radiant wood of patchouli, and the amber dryness of Ambroxan. Luna Rossa Carbon is a manifestation of elegance and modernity in every drop.',
            mainAccords: ['Aromatic', 'Mineral', 'Lavender', 'Citrus', 'Patchouli', 'Amber'],
            sizes: [
                'Decante 10ML',
                'Decante 20ML',
                'Decante 30ML',
                '50ML',
                '100ML'
            ],
            notes: [
                {
                    title: 'MINERAL FRESHNESS',
                    text: 'Steam-distilled botanicals and modern synthetic facets create a mineral profile that feels airy, clean, and sharply contemporary.'
                },
                {
                    title: 'LAVENDER & BERGAMOT',
                    text: 'Metallic lavender and Vert di Bergamote from Italy bring aromatic clarity and citrus freshness to the opening and heart.'
                },
                {
                    title: 'PATCHOULI & AMBROXAN',
                    text: 'Radiant patchouli woods and the dry amber effect of Ambroxan give the fragrance structure, elegance, and modern masculine persistence.'
                }
            ],
            fr: {
                subtitle: 'Parfum homme · Fougère Aromatique · Une signature Prada minérale et moderne avec lavande métallique, bergamote d’Italie, patchouli et Ambroxan ambré sec.',
                longDescription: 'PRADA Luna Rossa Carbon EDT, lancé en 2017, propose une expérience olfactive unique en fusionnant des notes botaniques distillées à la vapeur avec des éléments synthétiques dans un accord minéral captivant. Classé comme une fougère aromatique, il associe l’intensité de la roche la plus sombre à la fraîcheur de l’air. La composition révèle les touches métalliques de la lavande, la fraîcheur zestée du Vert di Bergamote d’Italie, le bois rayonnant du patchouli et la sécheresse ambrée de l’Ambroxan. Luna Rossa Carbon est une manifestation d’élégance et de modernité à chaque goutte.',
                notes: [
                    { title: 'FRAÎCHEUR MINÉRALE', text: 'Des notes botaniques distillées à la vapeur et des facettes synthétiques modernes créent un profil minéral, aérien, propre et résolument contemporain.' },
                    { title: 'LAVANDE & BERGAMOTE', text: 'La lavande métallique et le Vert di Bergamote d’Italie apportent clarté aromatique et fraîcheur citronnée à l’ouverture et au cœur.' },
                    { title: 'PATCHOULI & AMBROXAN', text: 'Le patchouli boisé rayonnant et l’effet ambré sec de l’Ambroxan donnent à la fragrance sa structure, son élégance et sa tenue masculine moderne.' }
                ]
            },
            images: [
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Prada%20Luna%20Rossa%20Carbon%20EDT/1.jpg',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Prada%20Luna%20Rossa%20Carbon%20EDT/2.jpg',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Prada%20Luna%20Rossa%20Carbon%20EDT/3.jpg',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Prada%20Luna%20Rossa%20Carbon%20EDT/4.jpg',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Prada%20Luna%20Rossa%20Carbon%20EDT/5.jpg'
            ]
        },
        'prada luna rossa black eau de parfum': {
            brand: 'PRADA',
            gender: 'men',
            fragranceProfile: { longevity: 90, longevityLabel: '10-12h', sillage: 80, sillageLabel: 'Strong', season: 68, seasonLabel: 'Fall/Winter' },
            subtitle: "Men's fragrance · Amber Woody · A bold and sophisticated Prada signature with bergamot, angelica, woody amber, patchouli, coumarin, musk, and ambergris.",
            longDescription: 'PRADA Luna Rossa Black Eau de Parfum for men is a bold and sophisticated expression of urban exploration, capturing the thrill of discovering new facets of the everyday landscape. Inspired by the transition between work and play, this fragrance embodies the vibrant spirit of the city as it ignites with possibilities and risks. It opens with an energetic fusion of bergamot and angelica, evolving into a captivating sweetness of woody amber, enhanced by the intensity of patchouli and coumarin. Patchouli, musk, ambergris, and the long-lasting power of coumarin intertwine to create an enveloping, magnetic, and enduring fragrance suited to any occasion.',
            mainAccords: ['Amber', 'Patchouli', 'Musky', 'Woody', 'Sweet', 'Coumarin'],
            sizes: [
                'Decante 10ML',
                'Decante 20ML',
                'Decante 30ML',
                '50ML',
                '100ML'
            ],
            notes: [
                {
                    title: 'BERGAMOT & ANGELICA',
                    text: 'A vibrant opening of bergamot and angelica creates an energetic first impression with freshness and aromatic lift.'
                },
                {
                    title: 'WOODY AMBER, PATCHOULI & COUMARIN',
                    text: 'The heart moves into a sweet and textured woody amber accord deepened by patchouli and the lasting warmth of coumarin.'
                },
                {
                    title: 'MUSK, AMBERGRIS & URBAN ELEGANCE',
                    text: 'Sensual musk and ambergris bring magnetic depth, giving the fragrance a sophisticated city-night character that stays enveloping for hours.'
                }
            ],
            fr: {
                subtitle: 'Parfum homme · Boisé Ambré · Une signature Prada audacieuse et sophistiquée avec bergamote, angélique, ambre boisé, patchouli, coumarine, musc et ambre gris.',
                longDescription: 'PRADA Luna Rossa Black Eau de Parfum pour homme est une expression audacieuse et sophistiquée de l’exploration urbaine, capturant le frisson de découvrir de nouvelles facettes du paysage quotidien. Inspiré par la transition entre le travail et le jeu, ce parfum incarne l’esprit vibrant de la ville lorsqu’elle s’embrase de possibilités et de risques. Il s’ouvre sur une fusion énergique de bergamote et d’angélique, puis évolue vers une douceur captivante d’ambre boisé, renforcée par l’intensité du patchouli et de la coumarine. Patchouli, musc, ambre gris et la tenue longue durée de la coumarine s’entrelacent pour créer une fragrance enveloppante, magnétique et durable, adaptée à toutes les occasions.',
                notes: [
                    { title: 'BERGAMOTE & ANGÉLIQUE', text: 'Une ouverture vibrante de bergamote et d’angélique crée une première impression énergique avec fraîcheur et envolée aromatique.' },
                    { title: 'AMBRE BOISÉ, PATCHOULI & COUMARINE', text: 'Le cœur évolue vers un accord ambré boisé doux et texturé, approfondi par le patchouli et la chaleur durable de la coumarine.' },
                    { title: 'MUSC, AMBRE GRIS & ÉLÉGANCE URBAINE', text: 'Le musc sensuel et l’ambre gris apportent une profondeur magnétique, donnant au parfum un caractère sophistiqué de nuit urbaine qui reste enveloppant pendant des heures.' }
                ]
            },
            images: [
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Prada%20Luna%20Rossa%20Black%20Eau%20de%20Parfum/1.jpg',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Prada%20Luna%20Rossa%20Black%20Eau%20de%20Parfum/2.jpg',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Prada%20Luna%20Rossa%20Black%20Eau%20de%20Parfum/3.jpg',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Prada%20Luna%20Rossa%20Black%20Eau%20de%20Parfum/4.jpg'
            ]
        },
        'prada l homme edt': {
            brand: 'PRADA',
            gender: 'men',
            fragranceProfile: { longevity: 86, longevityLabel: '8-10h', sillage: 74, sillageLabel: 'Strong', season: 84, seasonLabel: 'All Year' },
            subtitle: "Men's fragrance · Woody Chypre · A contrasted Prada signature with neroli, pepper, amber, patchouli, and cedar that redefines modern masculinity.",
            longDescription: "PRADA L'Homme Prada EDT for men belongs to the Woody Chypre fragrance family and is built on contrast, representing the duality of masculine identity through Prada's lens. Created in 2016 by perfumer Daniela Andrier, it blends sweet, almost feminine facets with pure masculine ingredients to create a layered and multifaceted composition. The fragrance opens with neroli and pepper, pairing a soft floral brightness with a spicy and vibrant intensity. Its heart unfolds into a warm, sensual floral-amber fusion with a creamy and comforting texture before settling into a virile base of patchouli and cedar. With its sober and edgy tone, this fragrance moves away from trends to establish a more assertive Prada masculinity, echoed by its steel-like silver bottle that reflects classic elegance and strength.",
            mainAccords: ['Neroli', 'Pepper', 'Amber', 'Patchouli', 'Cedar', 'Powdery'],
            sizes: [
                'Decante 10ML',
                'Decante 20ML',
                'Decante 30ML',
                '50ML',
                '100ML'
            ],
            notes: [
                {
                    title: 'NEROLI & PEPPER',
                    text: 'The opening balances delicate neroli with spicy pepper, creating a bright yet intense first impression full of contrast.'
                },
                {
                    title: 'FLORAL AMBER HEART',
                    text: 'A warm floral-amber heart brings creamy comfort and sensual depth, blending softness with a more forceful masculine edge.'
                },
                {
                    title: 'PATCHOULI & CEDAR BASE',
                    text: 'Patchouli and cedar anchor the fragrance with a seductive woody foundation that feels serious, refined, and enduring.'
                }
            ],
            fr: {
                subtitle: 'Parfum homme · Chypre Boisé · Une signature Prada contrastée avec néroli, poivre, ambre, patchouli et cèdre qui redéfinit la masculinité moderne.',
                longDescription: "PRADA L'Homme Prada EDT pour homme appartient à la famille Chypre Boisé et se construit sur les contrastes, représentant la dualité de l'identité masculine à travers le regard de Prada. Créé en 2016 par la parfumeuse Daniela Andrier, il associe des facettes douces, presque féminines, à des ingrédients masculins purs pour former une composition en couches et multifacette. Le parfum s'ouvre sur le néroli et le poivre, alliant une luminosité florale délicate à une intensité épicée et vibrante. Son cœur dévoile une fusion florale et ambrée, chaude et sensuelle, avec une texture crémeuse et réconfortante avant de se poser sur un fond viril de patchouli et de cèdre. Avec son ton sobre et tranchant, ce parfum s'éloigne des tendances pour affirmer une masculinité Prada plus assumée, reflétée par son flacon argenté rappelant l'acier, symbole d'élégance classique et de force.",
                notes: [
                    { title: 'NÉROLI & POIVRE', text: 'L’ouverture équilibre le néroli délicat et le poivre épicé pour une première impression lumineuse mais intense, pleine de contraste.' },
                    { title: 'CŒUR FLORAL AMBRÉ', text: 'Un cœur floral-ambré chaleureux apporte un confort crémeux et une profondeur sensuelle, mêlant douceur et puissance masculine.' },
                    { title: 'FOND PATCHOULI & CÈDRE', text: 'Le patchouli et le cèdre ancrent le parfum dans une base boisée séduisante, sérieuse, raffinée et durable.' }
                ]
            },
            images: [
                "https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Prada%20L'Homme%20EDT/1.jpg",
                "https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Prada%20L'Homme%20EDT/2.jpg",
                "https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Prada%20L'Homme%20EDT/3.jpg"
            ]
        },
        'prada paradigme eau de parfum': {
            brand: 'PRADA',
            gender: 'men',
            fragranceProfile: { longevity: 87, longevityLabel: '8-10h', sillage: 76, sillageLabel: 'Strong', season: 83, seasonLabel: 'All Year' },
            subtitle: "Men's fragrance · Woody Citrus · An innovative Prada scent balancing Calabrian bergamot, airy musks, green bourbon geranium, Peru balsam, benzoin, and guaiac wood.",
            longDescription: "PRADA Paradigme Eau de Parfum offers a distinctive olfactory experience built around an inverted architecture inspired by Prada's iconic triangle. Its composition sets it apart with a balanced interplay between woody warmth and citrus freshness. The olfactory pyramid opens with Calabrian bergamot and airy musks, develops into a heart of green bourbon geranium with pink floral nuances, and settles into a base of Peru balsam resin, benzoin, and guaiac wood. The refillable bottle pairs architectural design with a black-to-green gradient lacquer finish and Prada's tilted signature triangle, reflecting the care, innovation, and modern sustainability behind the fragrance.",
            mainAccords: ['Citrus', 'Musky', 'Geranium', 'Balsamic', 'Woody', 'Fresh'],
            sizes: [
                'Decante 10ML',
                'Decante 20ML',
                'Decante 30ML',
                '50ML',
                '100ML'
            ],
            notes: [
                {
                    title: 'BERGAMOT & AIRY MUSKS',
                    text: 'Calabrian bergamot and airy musks create a bright, clean opening with a lifted and contemporary freshness.'
                },
                {
                    title: 'GREEN BOURBON GERANIUM',
                    text: 'The heart brings green bourbon geranium with pink floral nuances, giving the fragrance elegance, balance, and a refined aromatic core.'
                },
                {
                    title: 'PERU BALSAM, BENZOIN & GUAIAC WOOD',
                    text: 'A balsamic woody base of Peru balsam resin, benzoin, and guaiac wood delivers smooth warmth and a composed long-lasting trail.'
                }
            ],
            fr: {
                subtitle: 'Parfum homme · Boisé Citronné · Une création Prada innovante équilibrant bergamote de Calabre, muscs aériens, géranium bourbon vert, baume du Pérou, benjoin et bois de gaïac.',
                longDescription: "PRADA Paradigme Eau de Parfum offre une expérience olfactive singulière construite autour d'une architecture inversée inspirée du triangle iconique de Prada. Sa composition se distingue par un équilibre entre la chaleur des bois et la fraîcheur des agrumes. La pyramide olfactive s'ouvre sur la bergamote de Calabre et des muscs aériens, évolue vers un cœur de géranium bourbon vert aux nuances florales rosées, puis se pose sur un fond de résine de baume du Pérou, de benjoin et de bois de gaïac. Son flacon rechargeable associe un design architectural à une laque dégradée noir-vert et au triangle incliné signature de Prada, reflétant le soin, l'innovation et la durabilité moderne de la fragrance.",
                notes: [
                    { title: 'BERGAMOTE & MUSCS AÉRIENS', text: 'La bergamote de Calabre et les muscs aériens créent une ouverture lumineuse, propre et fraîchement contemporaine.' },
                    { title: 'GÉRANIUM BOURBON VERT', text: 'Le cœur dévoile un géranium bourbon vert aux nuances florales rosées, apportant élégance, équilibre et un noyau aromatique raffiné.' },
                    { title: 'BAUME DU PÉROU, BENJOIN & BOIS DE GAÏAC', text: 'Un fond boisé balsamique de baume du Pérou, de benjoin et de bois de gaïac apporte une chaleur douce et un sillage posé de longue durée.' }
                ]
            },
            images: [
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Prada%20Paradigme%20Eau%20de%20Parfum/1.png',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Prada%20Paradigme%20Eau%20de%20Parfum/2.jpg',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Prada%20Paradigme%20Eau%20de%20Parfum/3.jpg'
            ]
        },
        'prada luna rossa men edt': {
            brand: 'PRADA',
            gender: 'men',
            fragranceProfile: { longevity: 85, longevityLabel: '8-10h', sillage: 73, sillageLabel: 'Strong', season: 86, seasonLabel: 'All Year' },
            subtitle: "Men's fragrance · Aromatic Fresh · A sophisticated Prada interpretation of lavender with bitter orange, clary sage, spearmint, Ambroxan, and amber woods.",
            longDescription: 'PRADA Luna Rossa Men EDT is a sophisticated fragrance by Daniela Andrier that reinterprets classic ingredients with an innovative approach. At the center is a fresh and masculine vision of lavender, blending traditional elegance with modern aromatic energy. The fragrance opens with the vibrant freshness of bitter orange essence, sharpening the primary fresh facet of lavender with a bitter and stimulating edge. The heart unfolds with aromatic lavender essence, clary sage oil, and nanah spearmint, evoking open spaces and rich natural nuances. In the base, the sensual warmth of Ambroxan and the woody touch of hibiscus amber combine synthetic and natural elements to create a refined, dignified, and timeless sophistication.',
            mainAccords: ['Lavender', 'Citrus', 'Aromatic', 'Mint', 'Ambroxan', 'Woody'],
            sizes: [
                'Decante 10ML',
                'Decante 20ML',
                'Decante 30ML',
                '50ML',
                '100ML'
            ],
            notes: [
                {
                    title: 'BITTER ORANGE & LAVENDER',
                    text: 'Bitter orange essence energizes the opening and highlights a clean, contemporary facet of lavender with fresh masculine brightness.'
                },
                {
                    title: 'LAVENDER, CLARY SAGE & NANAH SPEARMINT',
                    text: 'The aromatic heart layers lavender, clary sage oil, and nanah spearmint for an expansive green freshness with rich natural nuance.'
                },
                {
                    title: 'AMBROXAN & HIBISCUS AMBER',
                    text: 'Ambroxan and woody hibiscus amber create a sensual warm base, blending synthetic precision with timeless refined depth.'
                }
            ],
            fr: {
                subtitle: 'Parfum homme · Frais Aromatique · Une interprétation Prada sophistiquée de la lavande avec orange amère, sauge sclarée, menthe nanah, Ambroxan et bois ambrés.',
                longDescription: 'PRADA Luna Rossa Men EDT est une fragrance sophistiquée signée Daniela Andrier qui réinterprète des ingrédients classiques avec une approche innovante. Au centre se trouve une vision fraîche et masculine de la lavande, mêlant élégance traditionnelle et énergie aromatique moderne. Le parfum s’ouvre sur la fraîcheur vibrante de l’essence d’orange amère, qui souligne la facette fraîche principale de la lavande avec une intensité stimulante et amère. Le cœur se déploie autour de l’essence aromatique de lavande, de l’huile de sauge sclarée et des essences de menthe nanah, évoquant les grands espaces et la richesse des éléments naturels. En fond, la chaleur sensuelle de l’Ambroxan et la touche boisée de l’ambre d’hibiscus associent ingrédients synthétiques et naturels pour créer une sophistication raffinée, digne et intemporelle.',
                notes: [
                    { title: 'ORANGE AMÈRE & LAVANDE', text: 'L’essence d’orange amère dynamise l’ouverture et met en lumière une facette propre et contemporaine de la lavande avec une fraîcheur masculine éclatante.' },
                    { title: 'LAVANDE, SAUGE SCLARÉE & MENTHE NANAH', text: 'Le cœur aromatique superpose lavande, huile de sauge sclarée et menthe nanah pour une fraîcheur verte ample aux nuances naturelles riches.' },
                    { title: 'AMBROXAN & AMBRE D’HIBISCUS', text: 'L’Ambroxan et l’ambre boisé d’hibiscus créent un fond chaleureux et sensuel, mêlant précision synthétique et profondeur raffinée intemporelle.' }
                ]
            },
            images: [
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Prada%20Luna%20Rossa%20Men%20EDT/1.jfif',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Prada%20Luna%20Rossa%20Men%20EDT/2.webp'
            ]
        }
    };

    productDetailOverrides['jean paul gaultier le homme elixir eau de parfum'] = productDetailOverrides['jean paul gaultier le male elixir eau de parfum'];
    productDetailOverrides['jean paul gaultier le homme le parfum eau de parfum'] = productDetailOverrides['jean paul gaultier le male le parfum eau de parfum'];
    productDetailOverrides['guerlain l homme ideal l intense eau de parfum'] = productDetailOverrides['guerlain l homme id al l intense eau de parfum'];
    productDetailOverrides['guerlain l homme ideal extreme'] = productDetailOverrides['guerlain l homme id al extr me'];

    const cartStorageKey = 'cart';

    const readCart = () => {
        try {
            const raw = localStorage.getItem(cartStorageKey);
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            return [];
        }
    };

    const setHeaderCartCount = () => {
        const cartButtons = Array.from(document.querySelectorAll('.header-icon-btn')).filter((button) => {
            const ariaLabel = (button.getAttribute('aria-label') || '').toLowerCase();
            const href = (button.getAttribute('href') || '').toLowerCase();
            const hasCartLabel = ariaLabel === 'cart' || ariaLabel === 'panier';
            const hasCartHref = href.endsWith('/cart.html') || href.endsWith('cart.html') || href.includes('pages/cart.html');
            const hasCartIcon = Boolean(button.querySelector('.fa-shopping-bag'));
            return hasCartLabel || hasCartHref || hasCartIcon;
        });

        const count = readCart().reduce((sum, item) => sum + Math.max(1, Number(item.qty || item.quantity || 1)), 0);

        cartButtons.forEach((button) => {
            let badge = button.querySelector('.header-cart-badge');

            if (count > 0) {
                if (!badge) {
                    badge = document.createElement('span');
                    badge.className = 'header-wishlist-badge header-cart-badge absolute -top-1.5 -right-2';
                    button.appendChild(badge);
                }
                badge.textContent = String(Math.min(count, 99));
                button.classList.add('is-active');
            } else {
                if (badge) {
                    badge.remove();
                }
                button.classList.remove('is-active');
            }
        });

        /* ── Bottom nav Panier badge ── */
        const bnavBadge = document.getElementById('ipoBnavCartBadge');
        if (bnavBadge) {
            if (count > 0) {
                bnavBadge.textContent = String(Math.min(count, 99));
                bnavBadge.style.display = 'block';
            } else {
                bnavBadge.style.display = 'none';
            }
        }
    };

    const writeCart = (items) => {
        localStorage.setItem(cartStorageKey, JSON.stringify(items));
        setHeaderCartCount();
    };

    const showAddedToCartToast = (name, size) => {
        const existing = document.getElementById('ipordise-cart-toast');
        if (existing) existing.remove();

        const cartPath = getCartPagePath ? getCartPagePath() : 'cart.html';
        const toast = document.createElement('div');
        toast.id = 'ipordise-cart-toast';
        toast.innerHTML = `
            <div style="display:flex;align-items:center;gap:0.75rem;">
                <div style="width:2.2rem;height:2.2rem;background:#111827;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <div style="flex:1;min-width:0;">
                    <p style="margin:0;font-weight:700;font-size:0.82rem;color:#111827;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${name}</p>
                    <p style="margin:0;font-size:0.75rem;color:#6b7280;">${size} ${t('toast_added_to_cart')}</p>
                </div>
                <a href="${cartPath}" style="flex-shrink:0;background:#111827;color:#fff;font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;padding:0.45rem 0.9rem;border-radius:999px;text-decoration:none;">${t('toast_view_cart')}</a>
            </div>`;
        Object.assign(toast.style, {
            position: 'fixed', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%) translateY(6rem)',
            background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '1rem',
            padding: '0.85rem 1rem', boxShadow: '0 8px 32px rgba(15,23,42,0.18)',
            zIndex: '9999', minWidth: '20rem', maxWidth: '90vw',
            transition: 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s ease',
            opacity: '0', fontFamily: 'inherit'
        });
        document.body.appendChild(toast);
        requestAnimationFrame(() => {
            toast.style.transform = 'translateX(-50%) translateY(0)';
            toast.style.opacity = '1';
        });
        setTimeout(() => {
            toast.style.transform = 'translateX(-50%) translateY(6rem)';
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 350);
        }, 3500);
    };

    const parsePriceNumber = (priceText) => {
        const normalized = String(priceText || '').replace(',', '.');
        const match = normalized.match(/(\d+(?:\.\d+)?)/);
        return match ? Number(match[1]) : 0;
    };

    const formatMad = (value) => {
        const amount = Number.isFinite(value) ? value : 0;
        const hasDecimals = Math.abs(amount % 1) > 0.001;
        return `${amount.toLocaleString('fr-FR', {
            minimumFractionDigits: hasDecimals ? 2 : 0,
            maximumFractionDigits: 2
        })} DH`;
    };

    const getCartPagePath = () => {
        const inPagesFolder = window.location.pathname.replace(/\\/g, '/').includes('/pages/');
        return inPagesFolder ? 'cart.html' : 'pages/cart.html';
    };

    const normalizeSearchText = (value) => String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();

    const parseAddedValue = (value) => {
        const raw = String(value || '').trim();
        if (!raw) return null;
        const numeric = Number(raw);
        if (Number.isFinite(numeric)) return numeric;
        const parsed = Date.parse(raw);
        if (!Number.isNaN(parsed)) return parsed;
        return null;
    };

    const getCardAddedScore = (card, fallbackIndex = 0) => {
        const raw = card?.dataset?.added || card?.dataset?.productAdded || card?.dataset?.addedAt || '';
        const parsed = parseAddedValue(raw);
        return Number.isFinite(parsed) ? parsed : fallbackIndex;
    };

    const toProductDataId = (value) => String(value || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    const getPricesJsonPath = () => {
        const normalizedPath = window.location.pathname.replace(/\\/g, '/');
        return normalizedPath.includes('/pages/') ? '../prices.json' : 'prices.json';
    };

    // ─────────────────────────────────────────────────────────────────────────
    //  SIZES.JSON  –  Dynamic size configuration
    //
    //  As a store owner: ONLY edit sizes.json to add / remove / rename sizes.
    //  - Remove a size entry  →  that pill disappears from every product page
    //  - Add a size entry     →  it appears automatically (if priced in prices.json)
    //  - Change "label"       →  the button text updates everywhere
    //  - Change "type"        →  controls whether it shows in Décants or Full Bottles
    //
    //  The "key" must match the key used in prices.json  (e.g. "50ml", "100ml")
    // ─────────────────────────────────────────────────────────────────────────

    const getSizesJsonPath = () => {
        const p = window.location.pathname.replace(/\\/g, '/');
        return p.includes('/pages/') ? '../sizes.json' : 'sizes.json';
    };

    let sizesJsonPromise         = null;
    let lastKnownSizesSnapshot   = '';
    let sizesConfigWatcherStarted = false;

    // Live runtime lists – populated from sizes.json as soon as it loads.
    // The defaults below are fallbacks so the site still works without the file.
    let _runtimeSizeOrder    = ['10ml', '20ml', '30ml', '50ml', '100ml', '150ml'];
    let _runtimeDecantKeys   = new Set(['10ml', '20ml', '30ml']);
    // Per-product size overrides from sizes.json "products" section.
    // Keyed by product slug (lowercase); value = ordered array of size keys.
    let _runtimeProductSizes = {}; // { [productId]: string[] }
    // Key → priceKey: maps the sizes.json key to the prices.json field name.
    // This is what makes label/key changes safe — prices are ALWAYS looked up
    // via priceKey, never via the visible label or renamed key.
    let _runtimePriceKeyBySizeKey = {}; // { [sizeKey]: pricesJsonFieldName }
    // Key → label: maps the sizes.json key to the display label for that size.
    let _runtimeLabelBySizeKey    = {}; // { [sizeKey]: string }

    /**
     * Loads sizes.json once, caches the result, and updates _runtimeSizeOrder
     * and _runtimeDecantKeys so the rest of the code picks up the new sizes.
     */
    const loadSizesJson = async () => {
        if (!sizesJsonPromise) {
            sizesJsonPromise = fetch(getSizesJsonPath(), { cache: 'no-store' })
                .then((res) => (res.ok ? res.json() : null))
                .then((data) => {
                    if (!data || !Array.isArray(data.sizes)) return null;
                    // Strip comment/meta entries — only keep objects with a real "key"
                    const valid = data.sizes.filter(
                        (e) => e && typeof e.key === 'string' && /[a-z0-9]/i.test(e.key)
                    );
                    if (!valid.length) return null;
                    _runtimeSizeOrder  = valid.map((s) => s.key.trim().toLowerCase());
                    _runtimeDecantKeys = new Set(
                        valid
                            .filter((s) => s.type === 'decant')
                            .map((s) => s.key.trim().toLowerCase())
                    );
                    // Build the priceKey and label maps so the rest of the code
                    // never needs to derive pricing from visible label text.
                    _runtimePriceKeyBySizeKey = {};
                    _runtimeLabelBySizeKey    = {};
                    valid.forEach((s) => {
                        const k = s.key.trim().toLowerCase();
                        // priceKey defaults to key when not set, keeping prices.json backward-compatible
                        _runtimePriceKeyBySizeKey[k] = (s.priceKey || s.key).trim().toLowerCase();
                        if (s.label) _runtimeLabelBySizeKey[k] = String(s.label).trim();
                    });
                    // Parse per-product size lists from the "products" section.
                    _runtimeProductSizes = {};
                    if (data.products && typeof data.products === 'object') {
                        Object.entries(data.products).forEach(([productId, cfg]) => {
                            if (cfg && Array.isArray(cfg.sizes) && cfg.sizes.length) {
                                _runtimeProductSizes[productId.trim().toLowerCase()] =
                                    cfg.sizes.map((k) => String(k).trim().toLowerCase()).filter(Boolean);
                            }
                        });
                    }
                    return valid;
                })
                .catch(() => null);
        }
        return sizesJsonPromise;
    };

    // Snapshot helper for change detection
    const fetchSizesJsonSnapshot = async () => {
        try {
            const res = await fetch(getSizesJsonPath() + '?t=' + Date.now(), { cache: 'no-store' });
            return res.ok ? res.text() : '';
        } catch { return ''; }
    };

    /**
     * Starts a background poller (every 5 s) that reloads the page when
     * sizes.json changes — so edits take effect without a manual refresh.
     */
    const watchSizesJsonChanges = () => {
        if (sizesConfigWatcherStarted) return;
        sizesConfigWatcherStarted = true;
        const poll = async () => {
            const next = await fetchSizesJsonSnapshot();
            if (!next) return;
            if (!lastKnownSizesSnapshot) { lastKnownSizesSnapshot = next; return; }
            if (next !== lastKnownSizesSnapshot) {
                lastKnownSizesSnapshot = next;
                window.location.reload();
            }
        };
        // Delay the first poll a few seconds so it doesn't compete with page load
        setTimeout(() => { poll(); setInterval(poll, 5000); }, 4000);
    };

    // ─────────────────────────────────────────────────────────────────────────
    //  Keep PRICE_SIZE_ORDER for backward-compat. The live order is
    //  _runtimeSizeOrder (from sizes.json). Both start from the same defaults.
    // ─────────────────────────────────────────────────────────────────────────
    const PRICE_SIZE_ORDER = ['10ml', '20ml', '30ml', '50ml', '100ml', '150ml'];

    const formatPriceAmount = (amount) => {
        const n = Number(amount);
        const safe = Number.isFinite(n) ? n : 0;
        const hasDecimals = Math.abs(safe % 1) > 0.001;
        return `${safe.toLocaleString('fr-FR', {
            minimumFractionDigits: hasDecimals ? 2 : 0,
            maximumFractionDigits: 2
        })} DH`;
    };

    const formatSizeLabel = (sizeKey) => {
        const k = String(sizeKey || '').trim().toLowerCase();
        // Use the label defined in sizes.json if available; fall back to
        // deriving the label from the key text (e.g. "50ml" → "50 ML").
        return _runtimeLabelBySizeKey[k] || String(sizeKey || '').replace(/ml$/i, ' ML').toUpperCase();
    };

    // isDecanteSizeKey is now driven by sizes.json (type:"decant") instead of a hardcoded list
    const isDecanteSizeKey = (sizeKey) =>
        _runtimeDecantKeys.has(String(sizeKey || '').trim().toLowerCase());
    const PRICE_CONFIG_REFRESH_MS = 3000;

    let pricesJsonPromise = null;
    let priceConfigWatcherStarted = false;
    let lastKnownPricesSnapshot = '';

    const loadPricesJson = async () => {
        if (!pricesJsonPromise) {
            pricesJsonPromise = fetch(getPricesJsonPath(), { cache: 'no-store' })
                .then((response) => {
                    if (!response.ok) return {};
                    return response.json();
                })
                .then((pricesById) => (pricesById && typeof pricesById === 'object' ? pricesById : {}))
                .catch(() => ({}));
        }

        return pricesJsonPromise;
    };

    const fetchPricesJsonSnapshot = async () => {
        try {
            const response = await fetch(`${getPricesJsonPath()}?t=${Date.now()}`, { cache: 'no-store' });
            if (!response.ok) return '';
            return await response.text();
        } catch {
            return '';
        }
    };

    const checkForPricesJsonUpdate = async () => {
        const nextSnapshot = await fetchPricesJsonSnapshot();
        if (!nextSnapshot) return;

        if (!lastKnownPricesSnapshot) {
            lastKnownPricesSnapshot = nextSnapshot;
            return;
        }

        if (nextSnapshot !== lastKnownPricesSnapshot) {
            lastKnownPricesSnapshot = nextSnapshot;
            window.location.reload();
        }
    };

    const watchPricesJsonChanges = () => {
        if (priceConfigWatcherStarted || !document.getElementById('productPrice')) return;

        priceConfigWatcherStarted = true;
        void checkForPricesJsonUpdate();

        window.setInterval(() => {
            if (document.hidden) return;
            void checkForPricesJsonUpdate();
        }, PRICE_CONFIG_REFRESH_MS);

        window.addEventListener('focus', () => {
            void checkForPricesJsonUpdate();
        });

        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                void checkForPricesJsonUpdate();
            }
        });
    };

    const getPriceTextByProductId = (productId, pricesById) => {
        const normalizedId = String(productId || '').trim();
        if (!normalizedId || !pricesById || typeof pricesById !== 'object') return '';
        return typeof pricesById[normalizedId] === 'string'
            ? pricesById[normalizedId].trim()
            : '';
    };

    const getProductOverrideById = (productId) => {
        const normalizedId = String(productId || '').trim();
        if (!normalizedId) return null;

        const overrideEntry = Object.entries(productDetailOverrides).find(([productName]) => toProductDataId(productName) === normalizedId);
        return overrideEntry ? overrideEntry[1] : null;
    };

    const getConfiguredSizeKeys = (productId, pricesById, extraSizeKeys = []) => {
        const normalizedId = String(productId || '').trim();
        const rawPrices = normalizedId && pricesById && typeof pricesById === 'object'
            ? pricesById[normalizedId]
            : null;
        const override = getProductOverrideById(normalizedId);

        const overrideSizeKeys = Array.isArray(override?.sizes)
            ? override.sizes
                .map((entry) => normalizeSizeOptionEntry(entry, ''))
                .map((entry) => normalizeSizeLabelToKey(entry.volumeLabel || entry.label))
                .filter(Boolean)
            : [];

        const normalizedExtraSizeKeys = (Array.isArray(extraSizeKeys) ? extraSizeKeys : [extraSizeKeys])
            .map((entry) => normalizeSizeLabelToKey(entry))
            .filter(Boolean);

        const positivePriceKeys = rawPrices && typeof rawPrices === 'object'
            ? Object.entries(rawPrices)
                .filter(([sizeKey, rawValue]) => /ml$/i.test(sizeKey) && Number(rawValue) > 0)
                .map(([sizeKey]) => normalizeSizeLabelToKey(sizeKey))
                .filter(Boolean)
            : [];

        const baseKeys = (() => {
            // 1. Per-product sizes from sizes.json "products" section (highest priority)
            const fromJson = _runtimeProductSizes[normalizedId];
            if (fromJson && fromJson.length) return fromJson;
            // 2. Hard-coded overrides in script.js (getProductOverrideById)
            if (overrideSizeKeys.length) return overrideSizeKeys;
            // 3. Size keys from HTML data-* attributes
            if (normalizedExtraSizeKeys.length) return normalizedExtraSizeKeys;
            // 4. Global size list from sizes.json "sizes" section
            return _runtimeSizeOrder;
        })();

        // Determine which sizes to actually display:
        // - If sizes.json has a per-product list, it is fully authoritative —
        //   render exactly those sizes regardless of what prices.json contains.
        //   Sizes without a price render as "price on request".
        // - Otherwise, prices.json positive-price keys are the canonical source.
        const fromJsonWhitelist = _runtimeProductSizes[normalizedId];
        const canonicalKeys = fromJsonWhitelist && fromJsonWhitelist.length
            ? fromJsonWhitelist
            : positivePriceKeys.length ? positivePriceKeys : baseKeys;

        return Array.from(new Set(canonicalKeys))
            .sort((left, right) => {
                const leftIsDecante = isDecanteSizeKey(left);
                const rightIsDecante = isDecanteSizeKey(right);
                if (leftIsDecante !== rightIsDecante) {
                    return leftIsDecante ? -1 : 1;
                }

                const leftValue = Number.parseInt(String(left).replace(/[^0-9]/g, ''), 10);
                const rightValue = Number.parseInt(String(right).replace(/[^0-9]/g, ''), 10);
                if (Number.isFinite(leftValue) && Number.isFinite(rightValue)) {
                    return leftValue - rightValue;
                }

                return String(left).localeCompare(String(right));
            });
    };

    const getProductPriceMap = (productId, pricesById, extraSizeKeys = []) => {
        const normalizedId = String(productId || '').trim();
        const rawPrices = normalizedId && pricesById && typeof pricesById === 'object'
            ? pricesById[normalizedId]
            : null;

        return getConfiguredSizeKeys(productId, pricesById, extraSizeKeys).reduce((accumulator, sizeKey) => {
            // Always look up the price via priceKey, never via the visible label.
            // This lets you rename a size key without losing its price.
            const priceLookup = _runtimePriceKeyBySizeKey[sizeKey] || sizeKey;
            const rawValue = rawPrices && typeof rawPrices === 'object' ? rawPrices[priceLookup] : 0;
            const parsedValue = Number(rawValue);
            accumulator[sizeKey] = Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : 0;
            return accumulator;
        }, {});
    };

    const getAvailableSizePriceOptions = (productId, pricesById, extraSizeKeys = []) => {
        const productPrices = getProductPriceMap(productId, pricesById, extraSizeKeys);

        return Object.keys(productPrices)
            .map((sizeKey) => ({
                sizeKey,
                label: formatSizeLabel(sizeKey),
                price: productPrices[sizeKey],
                priceText: productPrices[sizeKey] > 0 ? formatPriceAmount(productPrices[sizeKey]) : '',
                unitPrice: productPrices[sizeKey],
                isDecante: isDecanteSizeKey(sizeKey),
                volumeLabel: formatSizeLabel(sizeKey)
            }));
    };

    const formatCatalogPrice = (productId, pricesById) => {
        const sizeOptions = getAvailableSizePriceOptions(productId, pricesById).filter((entry) => entry.price > 0);
        const fullBottleOptions = sizeOptions.filter((entry) => !entry.isDecante);
        const visibleOptions = fullBottleOptions.length ? fullBottleOptions : sizeOptions;

        return visibleOptions
            .map((entry) => `${entry.label.replace(/\s+/g, '')} ${entry.priceText}`)
            .join(' - ');
    };

    const normalizeDisplayedSizeLabel = (value) => {
        const compact = String(value || '').replace(/\s+/g, '').toUpperCase();
        const match = compact.match(/^(\d+)ML$/);
        return match ? `${match[1]}ML` : '';
    };

    const prioritizeBottleSizeLabels = (labels) => {
        const uniqueLabels = Array.from(new Set((labels || []).map(normalizeDisplayedSizeLabel).filter(Boolean)));
        const bottleLabels = uniqueLabels.filter((label) => !['10ML', '20ML', '30ML'].includes(label));
        const decanteLabels = uniqueLabels.filter((label) => ['10ML', '20ML', '30ML'].includes(label));
        return [...bottleLabels, ...decanteLabels];
    };

    const extractSizeLabelsFromText = (value) => prioritizeBottleSizeLabels(
        String(value || '')
            .split(/\s-\s|·|\||,/)
            .map((part) => part.trim())
            .filter(Boolean)
            .map((part) => {
                const match = part.match(/(\d+\s*ML)/i);
                return match ? match[1] : '';
            })
    );

    const extractSizeLabelsFromCard = (card) => {
        if (!card) return [];

        const spanLabels = Array.from(card.querySelectorAll('span, .card-2026-size, .size-pill'))
            .map((node) => normalizeDisplayedSizeLabel(node.textContent || ''))
            .filter(Boolean);

        return prioritizeBottleSizeLabels(spanLabels);
    };

    const getCatalogCardSizeLabels = (productName, productId, priceText, pricesById, fallbackLabels = []) => {
        const productOverride = productDetailOverrides[canonicalProductName(productName)] || null;

        // prices.json takes priority — if this product has priced sizes there, use them
        const pricedOptions = getAvailableSizePriceOptions(productId, pricesById).filter((entry) => entry.price > 0);
        if (pricedOptions.length) {
            const fullBottleOptions = pricedOptions.filter((entry) => !entry.isDecante);
            const visibleOptions = fullBottleOptions.length ? fullBottleOptions : pricedOptions;
            const derivedLabels = prioritizeBottleSizeLabels(visibleOptions.map((entry) => entry.volumeLabel || entry.label));
            if (derivedLabels.length) return derivedLabels.slice(0, 2);
        }

        // Fall back to hardcoded sizes from script.js only when prices.json has no data
        if (Array.isArray(productOverride?.sizes) && productOverride.sizes.length) {
            const overrideLabels = prioritizeBottleSizeLabels(productOverride.sizes.map((entry) => {
                const normalizedEntry = normalizeSizeOptionEntry(entry, '');
                return normalizedEntry.volumeLabel || normalizedEntry.label;
            }));

            if (overrideLabels.length) {
                return overrideLabels.slice(0, 2);
            }
        }

        const priceLabels = extractSizeLabelsFromText(priceText);
        if (priceLabels.length) {
            return priceLabels.slice(0, 2);
        }

        const fallback = prioritizeBottleSizeLabels(fallbackLabels);
        if (fallback.length) {
            return fallback.slice(0, 2);
        }

        return [];
    };

    const ensureCardSizeBadgeContainer = (card) => {
        if (!card) return null;

        const existingContainer = Array.from(card.querySelectorAll('div'))
            .find((node) => Array.from(node.querySelectorAll(':scope > span, :scope > .card-2026-size')).some((badge) => normalizeDisplayedSizeLabel(badge.textContent || '')));
        if (existingContainer) return existingContainer;

        const footer = card.querySelector('.card-2026-footer, .mt-auto.pt-3.border-t.border-gray-100.pb-1, .mt-3.pt-3.border-t.border-gray-100');
        if (!footer) return null;

        const container = document.createElement('div');
        if (card.classList.contains('card-2026')) {
            container.className = 'card-2026-sizes';
        } else {
            container.className = 'catalog-size-badges flex items-center gap-2 mb-3';
        }
        footer.insertAdjacentElement('beforebegin', container);
        return container;
    };

    const renderCardSizeBadges = (card, sizeLabels) => {
        if (!card || !sizeLabels.length) return;

        const container = ensureCardSizeBadgeContainer(card);
        if (!container) return;

        if (container.classList.contains('card-2026-sizes')) {
            container.innerHTML = sizeLabels
                .map((label) => `<span class="card-2026-size">${label}</span>`)
                .join('');
            return;
        }

        container.classList.add('catalog-size-badges', 'flex', 'items-center', 'gap-2');
        container.innerHTML = sizeLabels
            .map((label, index) => `<span class="card-size-badge text-[10px] font-bold border ${index === 0 ? 'border-gray-800' : 'border-gray-300 text-gray-500'} px-2 py-1 rounded">${label}</span>`)
            .join('');
    };

    const getResolvedProductImageGallery = (primaryImage, productOverride) => {
        const normalizedPrimaryImage = normalizeImagePathForCurrentPage(primaryImage || '');
        const overrideImages = Array.isArray(productOverride?.images)
            ? productOverride.images.map((src) => normalizeImagePathForCurrentPage(src)).filter(Boolean)
            : [];
        const seenImages = new Set();

        return [normalizedPrimaryImage, ...overrideImages].filter((src) => {
            if (!src || seenImages.has(src)) return false;
            seenImages.add(src);
            return true;
        });
    };

    const ensureCardPriceElement = (card) => {
        if (!card) return null;

        const existingPriceEl = card.querySelector('.price');
        if (existingPriceEl) return existingPriceEl;

        const titleEl = card.querySelector('.product-title, .related-title, h3, h4');
        if (!titleEl) return null;

        const priceEl = document.createElement('p');
        priceEl.className = 'price';
        titleEl.insertAdjacentElement('afterend', priceEl);
        return priceEl;
    };

    const initCatalogPrices = async () => {
        const cards = Array.from(document.querySelectorAll('.js-product-link[data-id]'));
        if (!cards.length) return;

        // Load both configs in parallel — sizes + prices
        const [pricesById] = await Promise.all([loadPricesJson(), loadSizesJson()]);

        cards.forEach((card) => {
            const existingPriceEl = card.querySelector('.price');
            if (existingPriceEl) existingPriceEl.remove();

            const productId = card.dataset.id;
            if (!productId) return;

            // Strip brand prefix from displayed card title (brand already shown separately above title)
            const brand = (card.dataset.productBrand || '').trim();
            if (brand) {
                const titleEl = card.querySelector('h3, h4, .product-title');
                if (titleEl) {
                    const currentTitle = titleEl.textContent.trim();
                    const brandPattern = new RegExp('^' + brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*', 'i');
                    if (brandPattern.test(currentTitle)) {
                        titleEl.textContent = currentTitle.replace(brandPattern, '').trim();
                    }
                }
            }

            const resolvedSizeLabels = getCatalogCardSizeLabels(
                card.dataset.productName || '',
                productId,
                card.dataset.productPrice || '',
                pricesById,
                extractSizeLabelsFromCard(card)
            );
            if (resolvedSizeLabels.length) {
                card.dataset.productSizes = resolvedSizeLabels.join('|');
                renderCardSizeBadges(card, resolvedSizeLabels);
            }

            const formatted = formatCatalogPrice(productId, pricesById);
            if (!formatted) return;

            // Keep data attribute in sync so cart / navigation code always reads live prices
            card.dataset.productPrice = formatted;

            const priceEl = ensureCardPriceElement(card);
            if (priceEl) {
                priceEl.textContent = formatted;
            }
        });
    };

    const extractProductDataFromCard = (card) => {
        const nameEl = card.querySelector('h3, h4, .product-title');
        const brandEl = card.querySelector('p.text-xs');
        const currentPriceEl = card.querySelector('.text-xl.font-bold, .text-lg.font-bold, .related-price');
        const oldPriceEl = card.querySelector('.line-through');
        const discountEl = card.querySelector('.text-brand-red');
        const imageEl = card.querySelector('img');
        const reviewsEl = Array.from(card.querySelectorAll('span')).find((span) => /\(\d+\)/.test(span.textContent || ''));

        const name = (card.dataset.productName || card.dataset.name || nameEl?.textContent || 'Premium Product').trim();
        const brand = (card.dataset.productBrand || card.dataset.brand || brandEl?.textContent || 'IPORDISE').trim();

        return {
            id: (card.dataset.id || toProductDataId(name)).trim(),
            name,
            brand,
            sizes: (card.dataset.productSizes || extractSizeLabelsFromCard(card).join('|') || '').trim(),
            price: (card.dataset.productPrice || currentPriceEl?.textContent || '').trim().replace(/\s*-\s*/g, ' · '),
            oldPrice: (card.dataset.productOldPrice || oldPriceEl?.textContent || '').trim(),
            discount: (card.dataset.productDiscount || discountEl?.textContent || '').trim(),
            reviews: (card.dataset.productReviews || (reviewsEl?.textContent || '').replace(/[^0-9]/g, '') || '0').trim(),
            image: normalizeImagePathForCurrentPage(card.dataset.productImage || card.dataset.img || imageEl?.getAttribute('src') || '')
        };
    };

    const extractCurrentProductData = () => {
        const mainImageEl = document.getElementById('productMainImage');
        const reviewsEl = document.getElementById('productReviewsCount');
        const params = new URLSearchParams(window.location.search);
        const name = (document.getElementById('productName')?.textContent || params.get('name') || 'Premium Product').trim();

        return {
            id: (params.get('id') || toProductDataId(name)).trim(),
            name,
            brand: (document.getElementById('productBrand')?.textContent || params.get('brand') || 'IPORDISE').trim(),
            price: '',
            oldPrice: (document.getElementById('productOldPrice')?.textContent || params.get('oldPrice') || '').trim(),
            discount: (document.getElementById('productDiscount')?.textContent || params.get('discount') || '').trim(),
            reviews: ((reviewsEl?.textContent || params.get('reviews') || '').replace(/[^0-9]/g, '') || '0').trim(),
            image: normalizeImagePathForCurrentPage(mainImageEl?.getAttribute('src') || params.get('image') || '')
        };
    };

    const buildProductQuery = (data) => new URLSearchParams({
        id: data.id || '',
        name: data.name || '',
        brand: data.brand || '',
        sizes: data.sizes || '',
        price: data.price || '',
        oldPrice: data.oldPrice || '',
        discount: data.discount || '',
        reviews: data.reviews || '',
        image: data.image || ''
    });

    const navigateToProductPage = (data) => {
        window.location.href = `${getProductPagePath()}?${buildProductQuery(data).toString()}`;
    };

    const initHeaderSearchSuggestions = () => {
        const searchInputs = Array.from(document.querySelectorAll('header input[type="text"]'));
        if (!searchInputs.length) return;

        const path = window.location.pathname.replace(/\\/g, '/');
        const onDiscoverPage = path.endsWith('/discover.html') || path.endsWith('/discover.html/');
        const discoverPath = path.includes('/pages/') ? '../discover.html' : 'discover.html';

        const productCards = Array.from(document.querySelectorAll(
            '#productCarousel > .group, #newArrivalsCarousel > article, article.group, .js-product-link'
        ));

        const catalog = [];
        const seenKeys = new Set();

        productCards.forEach((card) => {
            const data = extractProductDataFromCard(card);
            const key = `${normalizeSearchText(data.name)}|${normalizeSearchText(data.brand)}`;
            if (!data.name || seenKeys.has(key)) return;
            seenKeys.add(key);
            catalog.push(data);
        });

        /* Always merge the full relatedProductCatalog so every product is searchable
           on every page, not just discover.html */
        if (Array.isArray(relatedProductCatalog)) {
            relatedProductCatalog.forEach((item) => {
                const key = `${normalizeSearchText(item.name)}|${normalizeSearchText(item.brand)}`;
                if (!item.name || seenKeys.has(key)) return;
                seenKeys.add(key);
                catalog.push({
                    name: item.name,
                    brand: item.brand,
                    price: item.price,
                    image: item.image
                });
            });
        }

        const featuredItems = catalog.slice(0, 5);
        const quickLinks = [
            { label: 'New In', meta: 'Fresh arrivals', type: 'filter', value: 'new-in' },
            { label: 'Best Sellers', meta: 'Most wanted', type: 'filter', value: 'best-sellers' },
            { label: 'For Men', meta: 'Daily staples', type: 'filter', value: 'for-men' },
            { label: 'For Women', meta: 'Iconic signatures', type: 'filter', value: 'for-women' },
            { label: 'Blue Fragrances', meta: 'Clean and modern', type: 'query', value: 'blue' },
            { label: 'Vanilla', meta: 'Warm and addictive', type: 'query', value: 'vanilla' },
            { label: 'Fresh Citrus', meta: 'Bright and crisp', type: 'query', value: 'citrus' },
            { label: 'Arabian', meta: 'Rich oriental styles', type: 'filter', value: 'arabian' }
        ];

        const openDiscoverQuery = (query, filter = '') => {
            const params = new URLSearchParams();
            const trimmedQuery = String(query || '').trim();
            const trimmedFilter = String(filter || '').trim();
            if (trimmedQuery) params.set('q', trimmedQuery);
            if (trimmedFilter) params.set('filter', trimmedFilter);
            window.location.href = `${discoverPath}${params.toString() ? `?${params.toString()}` : ''}`;
        };

        const closeAllMenus = () => {
            document.querySelectorAll('.search-suggest').forEach((menu) => {
                menu.classList.add('hidden');
                menu.innerHTML = '';
            });
        };

        const buildSuggestions = (query) => {
            const normalizedQuery = normalizeSearchText(query);
            if (!normalizedQuery) return [];

            const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
            const scored = catalog
                .map((item) => {
                    const haystack = normalizeSearchText(`${item.name} ${item.brand}`);
                    if (!tokens.every((token) => haystack.includes(token))) return null;
                    /* score: starts-with match ranks higher than contains */
                    const score = tokens.every((token) => haystack.startsWith(token)
                        || normalizeSearchText(item.brand).startsWith(token)
                        || normalizeSearchText(item.name).startsWith(token)) ? 1 : 0;
                    return { item, score };
                })
                .filter(Boolean)
                .sort((a, b) => b.score - a.score)
                .map(({ item }) => item);

            return scored.slice(0, 8);
        };

        const formatSearchPrice = (value) => {
            const numeric = Number(String(value || '').replace(/[^\d.,]/g, '').replace(',', '.'));
            if (!Number.isFinite(numeric) || numeric <= 0) return '';
            return `${numeric.toFixed(2)} MAD`;
        };

        const buildQuickLinkMarkup = () => quickLinks.map((item) => `
            <button type="button" class="search-discovery-link" data-chip-type="${item.type}" data-chip-value="${item.value}">
                <span class="search-discovery-link-label">${item.label}</span>
                <span class="search-discovery-link-meta">${item.meta}</span>
            </button>
        `).join('');

        const buildFeaturedMarkup = (items) => items.map((item, index) => `
            <button type="button" class="search-discovery-card" data-featured-index="${index}">
                <span class="search-discovery-card-media">
                    <img src="${item.image || ''}" alt="" class="search-discovery-card-thumb" />
                </span>
                <span class="search-discovery-card-copy">
                    <span class="search-discovery-card-brand">${item.brand}</span>
                    <span class="search-discovery-card-name">${item.name}</span>
                    <span class="search-discovery-card-price">${formatSearchPrice(item.price)}</span>
                </span>
            </button>
        `).join('');

        const buildResultMarkup = (items) => items.map((item, index) => `
            <button type="button" class="search-suggest-item search-result-row" data-index="${index}">
                <img src="${item.image || ''}" alt="" class="search-suggest-thumb" />
                <span class="search-suggest-text">
                    <span class="search-suggest-name">${item.name}</span>
                    <span class="search-suggest-brand">${item.brand}</span>
                </span>
            </button>
        `).join('');

        const renderMenu = (menu, items, query) => {
            const trimmedQuery = String(query || '').trim();
            const hasQuery = trimmedQuery.length >= 2;
            const panelMarkup = hasQuery
                ? `
                    <div class="search-discovery-shell is-results">
                        <div class="search-discovery-header-row">
                            <div>
                                <p class="search-discovery-kicker">Search Results</p>
                                <h3 class="search-discovery-title">${items.length ? 'Matching fragrances' : 'No exact match yet'}</h3>
                            </div>
                            <button type="button" class="search-discovery-all-link" data-search-all="true">View all</button>
                        </div>
                        <div class="search-discovery-results">
                            ${items.length ? buildResultMarkup(items) : '<p class="search-discovery-empty">Try a brand name, a note like vanilla, or a style like blue fragrance.</p>'}
                        </div>
                    </div>
                `
                : `
                    <div class="search-discovery-shell">
                        <div class="search-discovery-column search-discovery-column-links">
                            <p class="search-discovery-kicker">Start Here</p>
                            <h3 class="search-discovery-title">Popular searches</h3>
                            <p class="search-discovery-copy">Jump back into the categories and scent families shoppers open most often.</p>
                            <div class="search-discovery-link-list">
                                ${buildQuickLinkMarkup()}
                            </div>
                        </div>
                        <div class="search-discovery-column search-discovery-column-featured">
                            <div class="search-discovery-header-row">
                                <div>
                                    <p class="search-discovery-kicker">Curated Picks</p>
                                    <h3 class="search-discovery-title">Trending now</h3>
                                </div>
                                <button type="button" class="search-discovery-all-link" data-search-all="discover">Explore all</button>
                            </div>
                            <div class="search-discovery-card-grid">
                                ${buildFeaturedMarkup(featuredItems)}
                            </div>
                        </div>
                    </div>
                `;

            menu.innerHTML = panelMarkup;
            menu.classList.remove('hidden');
        };

        searchInputs.forEach((input) => {
            const wrapper = input.closest('.relative') || input.parentElement;
            if (!wrapper) return;

            let menu = wrapper.querySelector('.search-suggest');
            if (!menu) {
                menu = document.createElement('div');
                menu.className = 'search-suggest hidden';
                wrapper.appendChild(menu);
            }

            input.addEventListener('input', (event) => {
                const value = event.target.value || '';
                const suggestions = value.length < 1 ? [] : buildSuggestions(value);
                renderMenu(menu, suggestions, value);
            });

            input.addEventListener('focus', (event) => {
                const value = event.target.value || '';
                const suggestions = value.length < 1 ? [] : buildSuggestions(value);
                renderMenu(menu, suggestions, value);
            });

            input.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    const trimmed = String(input.value || '').trim();
                    openDiscoverQuery(trimmed || '', trimmed ? '' : 'all');
                }
                if (event.key === 'Escape') {
                    closeAllMenus();
                }
            });

            menu.addEventListener('click', (event) => {
                const button = event.target.closest('.search-suggest-item');
                if (button) {
                    const index = Number(button.dataset.index || 0);
                    const items = buildSuggestions(input.value || '');
                    const selected = items[index];
                    if (!selected) return;
                    navigateToProductPage(selected);
                    return;
                }

                const featuredCard = event.target.closest('[data-featured-index]');
                if (featuredCard) {
                    const index = Number(featuredCard.dataset.featuredIndex || 0);
                    const selected = featuredItems[index];
                    if (!selected) return;
                    navigateToProductPage(selected);
                    return;
                }

                const chip = event.target.closest('[data-chip-value]');
                if (chip) {
                    const chipType = chip.dataset.chipType || 'query';
                    const chipValue = chip.dataset.chipValue || '';
                    if (chipType === 'filter') {
                        openDiscoverQuery('', chipValue);
                    } else {
                        input.value = chipValue;
                        renderMenu(menu, buildSuggestions(chipValue), chipValue);
                        input.focus();
                    }
                    return;
                }

                const allLink = event.target.closest('[data-search-all]');
                if (allLink) {
                    const trimmed = String(input.value || '').trim();
                    openDiscoverQuery(trimmed);
                }
            });

            const button = wrapper.querySelector('button');
            if (button) {
                button.addEventListener('click', (event) => {
                    event.preventDefault();
                    const trimmed = String(input.value || '').trim();
                    if (!trimmed) {
                        renderMenu(menu, [], '');
                        input.focus();
                        return;
                    }
                    openDiscoverQuery(trimmed);
                });
            }
        });

        document.addEventListener('click', (event) => {
            if (!event.target.closest('.search-suggest') && !event.target.closest('header input[type="text"]')) {
                closeAllMenus();
            }
        });

        window.addEventListener('scroll', () => { closeAllMenus(); }, { passive: true });
    };

    const bindProductLinks = () => {
        const candidates = document.querySelectorAll(
            '#productCarousel > .group, #newArrivalsCarousel > article, article.group, .js-product-link'
        );

        candidates.forEach((card) => {
            if (card.dataset.productBound === 'true') return;
            card.dataset.productBound = 'true';

            if (!card.classList.contains('cursor-pointer')) {
                card.classList.add('cursor-pointer');
            }

            if (!card.hasAttribute('tabindex')) {
                card.setAttribute('tabindex', '0');
            }

            const navigateToProduct = () => {
                try {
                    sessionStorage.setItem('lastCatalogUrl', window.location.href);
                } catch (error) {
                    // Ignore storage errors (private mode or blocked storage).
                }

                if (window.location.pathname.replace(/\\/g, '/').endsWith('/discover.html')) {
                    try {
                        const rawState = sessionStorage.getItem('ipordise-discover-state');
                        const prevState = rawState ? JSON.parse(rawState) : {};
                        sessionStorage.setItem('ipordise-discover-state', JSON.stringify({
                            ...prevState,
                            path: window.location.pathname,
                            scrollY: window.scrollY
                        }));
                    } catch (error) {
                        // Ignore storage errors (private mode or blocked storage).
                    }
                }

                const data = extractProductDataFromCard(card);
                navigateToProductPage(data);
            };

            card.addEventListener('click', (event) => {
                const clickableTarget = event.target.closest('a, button, input, select, textarea, label');
                if (clickableTarget) return;
                navigateToProduct();
            });

            card.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    navigateToProduct();
                }
            });

            const addToCartBtn = card.querySelector('.js-card-add-btn');
            if (addToCartBtn) {
                addToCartBtn.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    navigateToProduct();
                });
            }
        });
    };

    const relatedProductCatalog = [
        {
            name: 'Rabanne One Million Parfum',
            brand: 'RABANNE',
            price: '',
            gender: 'men',
            image: 'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Rabanne%20One%20Million%20Parfum/1.jpg'
        },
        {
            name: 'Rabanne One Million Elixir Intense',
            brand: 'RABANNE',
            price: '',
            gender: 'men',
            image: 'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Rabanne%20One%20Million%20Elixir%20Intense/1.webp'
        },
        {
            name: 'Givenchy Gentleman Society Amber Eau de Parfum',
            brand: 'GIVENCHY',
            price: '',
            gender: 'men',
            image: 'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Givenchy%20Gentleman%20Society%20Amber%20Eau%20de%20Parfum/1.jpg'
        },
        {
            name: 'Givenchy Gentleman Society Nomade Eau de Parfum',
            brand: 'GIVENCHY',
            price: '',
            gender: 'men',
            image: 'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Givenchy%20Gentleman%20Society%20Nomade%20Eau%20de%20Parfum/1.webp'
        },
        {
            name: 'Givenchy Gentleman Society Extreme Eau de Parfum',
            brand: 'GIVENCHY',
            price: '',
            gender: 'men',
            image: 'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Givenchy%20Gentleman%20Society%20Extreme%20Eau%20de%20Parfum/1.webp'
        },
        {
            name: 'Gentleman Private Reserve Eau de Parfum',
            brand: 'GIVENCHY',
            price: '',
            gender: 'men',
            image: 'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Gentleman%20Private%20Reserve%20Eau%20de%20Parfum/1.png'
        },
        {
            name: 'Jean Paul Gaultier Scandal Elixir',
            brand: 'JEAN PAUL GAULTIER',
            price: '',
            gender: 'men',
            image: 'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Jean%20Paul%20Gaultier%20Scandal%20Elixir/1.jpg'
        },
        {
            name: 'Jean Paul Gaultier Scandal Intense Eau de Parfum',
            brand: 'JEAN PAUL GAULTIER',
            price: '',
            gender: 'men',
            image: 'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Jean%20Paul%20Gaultier%20Scandal%20Intense%20Eau%20de%20Parfum/1.jpg'
        },
        {
            name: 'Emporio Armani Stronger With You Intensely EDP',
            brand: 'GIORGIO ARMANI',
            price: '',
            gender: 'men',
            image: 'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Emporio%20Armani%20Stronger%20With%20You%20Intensely/2.webp'
        },
        {
            name: 'Armani Stronger With You Powerfully Eau de Parfum',
            brand: 'GIORGIO ARMANI',
            price: '',
            gender: 'men',
            image: 'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Armani%20Stronger%20With%20You%20Powerfully%20Eau%20de%20Parfum/1.webp'
        },
        {
            name: 'Armani Stronger With You Absolutely Perfume',
            brand: 'GIORGIO ARMANI',
            price: '',
            gender: 'men',
            image: 'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Armani%20Stronger%20With%20You%20Absolutely%20Perfume/first.webp'
        },
        {
            name: 'Yves Saint Laurent Y Eau de Parfum',
            brand: 'YVES SAINT LAURENT',
            price: '',
            gender: 'men',
            image: 'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Yves%20Saint%20Laurent%20Y%20Eau%20de%20Parfum/1.webp'
        },
        {
            name: 'Yves Saint Laurent Myslf Eau de Parfum',
            brand: 'YVES SAINT LAURENT',
            price: '',
            gender: 'men',
            image: 'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Yves%20Saint%20Laurent%20Myslf%20Eau%20de%20Parfum/1.jpg'
        },
        {
            name: 'Yves Saint Laurent MYSLF Le Parfum',
            brand: 'YVES SAINT LAURENT',
            price: '',
            gender: 'men',
            image: 'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Yves%20Saint%20Laurent%20MYSLF%20Le%20Parfum/1.webp'
        },
        {
            name: 'Jean Paul Gaultier Le male Elixir Eau de Parfum',
            brand: 'JEAN PAUL GAULTIER',
            price: '',
            gender: 'men',
            image: 'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Jean%20Paul%20Gaultier%20Le%20Male%20Elixir/1.webp'
        },
        {
            name: 'Jean Paul Gaultier Le Male In Blue Eau de Parfum',
            brand: 'JEAN PAUL GAULTIER',
            price: '',
            gender: 'men',
            image: 'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Jean%20Paul%20Gaultier%20Le%20Male%20In%20Blue%20Eau%20de%20Parfum/1.jpg'
        },
        {
            name: 'Jean Paul Gaultier Le Male Eau de Toilette',
            brand: 'JEAN PAUL GAULTIER',
            price: '',
            gender: 'men',
            image: 'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Le%20Male%20Eau%20de%20Toilette/1.png'
        },
        {
            name: 'Jean Paul Gaultier Le male Le parfum Eau de Parfum',
            brand: 'JEAN PAUL GAULTIER',
            price: '',
            gender: 'men',
            image: 'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Jean%20Paul%20Gaultier%20Le%20Male%20Le%20Parfum%20Eau%20de%20Parfum/2.webp'
        },
        {
            name: 'Jean Paul Gaultier Le Beau Eau de Parfum',
            brand: 'JEAN PAUL GAULTIER',
            price: '',
            gender: 'men',
            image: 'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Jean%20Paul%20Gaultier%20Le%20Beau%20Eau%20de%20Parfum/1.webp'
        },
        {
            name: 'Azzaro The Most Wanted Eau de Parfum Intense',
            brand: 'AZZARO',
            price: '',
            gender: 'men',
            image: 'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Azzaro%20The%20Most%20Wanted%20Eau%20de%20Parfum%20Intense/1.webp'
        },
        {
            name: 'Azzaro Forever Wanted Elixir Eau de Parfum',
            brand: 'AZZARO',
            price: '',
            gender: 'men',
            image: 'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Azzaro%20Forever%20Wanted%20Elixir%20Eau%20de%20Parfum/1.jpg'
        },
        {
            name: 'Azzaro The Most Wanted Parfum',
            brand: 'AZZARO',
            price: '',
            gender: 'men',
            image: 'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Azzaro%20The%20Most%20Wanted%20Parfum/1.webp'
        },
        {
            name: 'Valentino Donna Born in Roma Eau de Parfum',
            brand: 'VALENTINO',
            price: '',
            gender: 'women',
            image: 'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Valentino%20Donna%20Born%20in%20Roma%20Eau%20de%20Parfum/1.webp'
        },
        {
            name: 'Valentino Uomo Born In Roma Coral Fantasy Eau de Toilette',
            brand: 'VALENTINO',
            price: '',
            gender: 'men',
            image: 'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Valentino%20Uomo%20Born%20In%20Roma%20Coral%20Fantasy%20Eau%20de%20Toilette/1.webp'
        },
        {
            name: 'Valentino Born in Roma Extradose Eau de Toilette',
            brand: 'VALENTINO',
            price: '',
            gender: 'men',
            image: 'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Valentino%20Born%20in%20Rome%20Extradose/1.jpg'
        },
        {
            name: 'Dior Homme Intense Eau de Parfum',
            brand: 'DIOR',
            price: '',
            gender: 'men',
            image: 'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/DIOR%20HOMME%20INTENSE%20Eau%20de%20Parfum/1.jpg'
        },
        {
            name: 'Valentino Born In Roma Uomo Intense Eau de Parfum',
            brand: 'VALENTINO',
            price: '',
            gender: 'men',
            image: 'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Valentino%20Born%20In%20Roma%20Uomo%20Intense%20Eau%20de%20Parfum/1.webp'
        },
        {
            name: 'Valentino Born In Roma Donna Intense Eau de Parfum',
            brand: 'VALENTINO',
            price: '',
            gender: 'women',
            image: 'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Valentino%20Born%20In%20Roma%20Donna%20Intense%20Eau%20de%20Parfum/1.webp'
        },
        {
            name: 'Valentino Uomo Born in Roma Eau de Toilette',
            brand: 'VALENTINO',
            price: '',
            gender: 'men',
            image: 'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Valentino%20Uomo%20Born%20in%20Roma%20Eau%20de%20Toilette/1.jpg'
        },
        {
            name: 'Valentino Uomo Born In Roma Purple Melancholia Eau de Toilette',
            brand: 'VALENTINO',
            price: '',
            gender: 'men',
            image: 'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Valentino%20Uomo%20Born%20In%20Roma%20Purple%20Melancholia%20Eau%20de%20Toilette/1.jpg'
        },
        {
            name: 'Carolina Herrera Bad Boy Eau de Toilette',
            brand: 'CAROLINA HERRERA',
            price: '',
            gender: 'men',
            image: 'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Carolina%20Herrera%20Bad%20Boy%20Eau%20de%20Toilette/1.jpg'
        },
        {
            name: 'Gucci Guilty Absolu de Parfum Pour Homme',
            brand: 'GUCCI',
            price: '',
            gender: 'men',
            image: 'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Gucci%20Guilty%20Absolu%20de%20Parfum%20Pour%20Homme/1.webp'
        },
        {
            name: 'Gucci Guilty Elixir Pour Homme',
            brand: 'GUCCI',
            price: '',
            gender: 'men',
            image: 'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Gucci%20Guilty%20Elixir%20Pour%20Homme/1.webp'
        },
        {
            name: 'Montale Arabians Tonka',
            brand: 'MONTALE',
            price: '',
            gender: 'unisex',
            image: 'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Montale%20Arabians%20Tonka/1.webp'
        }
    ];

    const getGenderFromText = (text) => {
        const normalized = String(text || '').toLowerCase();
        if (!normalized) return '';
        if (normalized.includes("men's") || normalized.includes('mens') || normalized.includes('homme')) return 'men';
        if (normalized.includes("women's") || normalized.includes('womens') || normalized.includes('femme')) return 'women';
        if (normalized.includes('unisex')) return 'unisex';
        return '';
    };

    const getProductGenderKey = (productName, productOverride, subtitleText) => {
        if (productOverride?.gender) return productOverride.gender;
        const subtitleGender = getGenderFromText(productOverride?.subtitle || subtitleText);
        if (subtitleGender) return subtitleGender;
        return getGenderFromText(productName);
    };

    const getProductFamilyKey = (name) => {
        const normalizedName = canonicalProductName(name);
        if (!normalizedName) return '';

        if (normalizedName.includes('stronger with you')) return 'armani-stronger-with-you';
        if (normalizedName.includes('myslf')) return 'ysl-myslf';
        if (normalizedName.startsWith('yves saint laurent y ')) return 'ysl-y';
        if (normalizedName.includes('most wanted')) return 'azzaro-most-wanted';
        if (normalizedName.includes('forever wanted')) return 'azzaro-wanted';
        if (normalizedName.includes('wanted')) return 'azzaro-wanted';
        if (normalizedName.includes('born in roma') || normalizedName.includes('born in rome')) return 'valentino-born-in-roma';
        if (normalizedName.includes('dior homme')) return 'dior-homme';
        if (normalizedName.includes('le male')) return 'jpg-le-male';
        if (normalizedName.includes('le beau')) return 'jpg-le-beau';
        if (normalizedName.includes('scandal')) return 'jpg-scandal';
        if (normalizedName.includes('one million')) return 'rabanne-one-million';
        if (normalizedName.includes('gentleman')) return 'givenchy-gentleman';
        if (normalizedName.includes('guilty')) return 'gucci-guilty';
        return '';
    };

    const extractSizeBadges = (productName, priceText) => {
        const productOverride = productDetailOverrides[canonicalProductName(productName)] || null;
        if (Array.isArray(productOverride?.sizes) && productOverride.sizes.length) {
            const normalizedSizes = productOverride.sizes
                .map((entry) => normalizeSizeOptionEntry(entry, ''))
                .filter((entry) => entry.label);

            const fullBottleSizes = normalizedSizes
                .filter((entry) => !entry.isDecante)
                .map((entry) => entry.volumeLabel.replace(/\s+/g, '').toUpperCase());
            const decanteSizes = normalizedSizes
                .filter((entry) => entry.isDecante)
                .map((entry) => entry.volumeLabel.replace(/\s+/g, '').toUpperCase());
            const sizeLabels = [...fullBottleSizes, ...decanteSizes].filter(Boolean);

            if (sizeLabels.length) {
                return sizeLabels.slice(0, 2);
            }
        }

        const parts = String(priceText || '')
            .split(/\s-\s|·|\||,/)
            .map((part) => part.trim())
            .filter(Boolean);

        const sizeLabels = parts
            .map((part) => {
                const match = part.match(/(\d+\s*ML)/i);
                return match ? match[1].replace(/\s+/g, '').toUpperCase() : '';
            })
            .filter(Boolean);

        return sizeLabels.length ? sizeLabels.slice(0, 2) : ['ONE SIZE'];
    };

    /* ── Format long description: splits plain text into styled blocks ── */
    function formatLongDesc(text) {
        if (!text) return '';
        // Sections we can detect and label
        const sectionMarkers = [
            { key: 'BOTTLE:', icon: 'fas fa-cube',  label: 'The Bottle' },
            { key: 'FLACON:', icon: 'fas fa-cube',  label: 'The Bottle' },
            { key: 'NOTE:',   icon: 'fas fa-leaf',  label: 'A Note'     },
        ];

        let mainText = text;
        let bottleHTML = '';

        for (const { key, icon, label } of sectionMarkers) {
            const idx = text.indexOf(key);
            if (idx !== -1) {
                mainText   = text.slice(0, idx).trim();
                const rest = text.slice(idx + key.length).trim();
                bottleHTML = `<div class="prod-desc-section">
                    <span class="prod-desc-section-label"><i class="${icon}"></i>${label}</span>
                    <p class="prod-desc-section-text">${rest}</p>
                </div>`;
                break;
            }
        }

        // Split main text into sentences and highlight first sentence as pull-quote
        const sentenceEnd = mainText.search(/[.!?]\s/);
        let leadHTML = '', bodyHTML = '';
        if (sentenceEnd !== -1 && sentenceEnd < 180) {
            leadHTML = `<p class="prod-desc-lead">${mainText.slice(0, sentenceEnd + 1).trim()}</p>`;
            bodyHTML = `<p class="prod-desc-body">${mainText.slice(sentenceEnd + 2).trim()}</p>`;
        } else {
            bodyHTML = `<p class="prod-desc-body">${mainText}</p>`;
        }

        return leadHTML + bodyHTML + bottleHTML;
    }

    const renderRelatedProducts = (currentProductName, currentProductBrand, currentGender) => {
        const relatedTrack = document.querySelector('.related-track');
        if (!relatedTrack) return;

        const currentCanonicalName = canonicalProductName(currentProductName);
        const currentFamily = getProductFamilyKey(currentProductName);

        const familyMatches = currentFamily
            ? relatedProductCatalog.filter((product) => (
                canonicalProductName(product.name) !== currentCanonicalName
                && getProductFamilyKey(product.name) === currentFamily
                && (!currentGender || product.gender === currentGender || product.gender === 'unisex')
            ))
            : [];

        let recommendations = familyMatches.slice(0, 6);
        let useAccordFallback = false;

        if (!recommendations.length) {
            // Accord / note similarity fallback
            const currentAccords = mainAccordCatalog[currentCanonicalName] || [];

            const scored = relatedProductCatalog
                .filter((product) => canonicalProductName(product.name) !== currentCanonicalName)
                .filter((product) => !currentGender || product.gender === currentGender || product.gender === 'unisex')
                .map((product) => {
                    const productAccords = mainAccordCatalog[canonicalProductName(product.name)] || [];
                    const shared = currentAccords.filter((a) => productAccords.includes(a)).length;
                    return { product, shared };
                })
                .filter(({ shared }) => shared > 0)
                .sort((a, b) => b.shared - a.shared);

            if (scored.length) {
                recommendations = scored.slice(0, 6).map(({ product }) => product);
                useAccordFallback = true;
            } else {
                // Last resort: same gender, different brand, shuffled by hash
                const baseHash = getStableHashNumber(currentCanonicalName);
                const pool = relatedProductCatalog
                    .filter((product) => (
                        canonicalProductName(product.name) !== currentCanonicalName
                        && product.brand !== currentProductBrand
                        && (!currentGender || product.gender === currentGender || product.gender === 'unisex')
                    ));
                const shuffled = pool.slice().sort((a, b) =>
                    (getStableHashNumber(canonicalProductName(a.name)) + baseHash) % 97
                    - (getStableHashNumber(canonicalProductName(b.name)) + baseHash) % 97
                );
                recommendations = shuffled.slice(0, 6);
                useAccordFallback = true;
            }
        }

        if (!recommendations.length) {
            const section = relatedTrack.closest('section');
            if (section) section.style.display = 'none';
            return;
        }

        // Update section header wording when showing accord-based suggestions
        if (useAccordFallback) {
            const kicker = relatedTrack.closest('section')?.querySelector('.product-section-kicker');
            const heading = relatedTrack.closest('section')?.querySelector('[data-i18n="product.related_title"]');
            if (kicker) kicker.textContent = currentLanguage === 'fr' ? 'Profil Olfactif Similaire' : 'Similar Scent Profile';
            if (heading) heading.textContent = currentLanguage === 'fr' ? 'Vous aimerez peut-être aussi' : 'You Might Also Enjoy';
        }

        relatedTrack.innerHTML = recommendations.map((product) => {
            const sizeBadges = extractSizeBadges(product.name, product.price);
            const sizeBadgesHtml = sizeBadges.map((size, index) => (
                `<span class="text-[10px] font-bold border ${index === 0 ? 'border-gray-800' : 'border-gray-300 text-gray-500'} px-2 py-1 rounded">${size}</span>`
            )).join('');

            return `
                <article class="related-card js-product-link" data-product-name="${product.name}" data-id="${toProductDataId(product.name)}" data-product-brand="${product.brand}" data-product-price="${product.price}" data-product-old-price="" data-product-discount="" data-product-reviews="0" data-product-image="${product.image}">
                    <img src="${product.image}" alt="${product.name}" class="related-image">
                    <p class="related-brand">${product.brand}</p>
                    <h3 class="related-title">${product.name}</h3>
                    <div class="flex items-center gap-2 mt-2">
                        ${sizeBadgesHtml}
                    </div>
                    <div class="mt-3 pt-3 border-t border-gray-100">
                        <button type="button" class="js-card-add-btn w-full bg-brand-red text-white text-xs font-semibold py-2 rounded-md hover:bg-brand-redHover transition">${t('product_add_to_cart')}</button>
                    </div>
                </article>
            `;
        }).join('');

        bindProductLinks();
    };

    const getStableHashNumber = (value) => {
        const text = String(value || '');
        let hash = 0;
        for (let index = 0; index < text.length; index += 1) {
            hash = ((hash << 5) - hash) + text.charCodeAt(index);
            hash |= 0;
        }
        return Math.abs(hash);
    };

    const getHonestReviewCount = (productName, providedReviews) => {
        const parsedProvided = Number.parseInt(String(providedReviews || '0'), 10);
        if (Number.isFinite(parsedProvided) && parsedProvided > 0 && parsedProvided <= 120) {
            return parsedProvided;
        }

        const canonicalName = canonicalProductName(productName);
        const fixedReviewCounts = {
            'yves saint laurent myslf le parfum': 7
        };

        if (fixedReviewCounts[canonicalName]) {
            return fixedReviewCounts[canonicalName];
        }

        const hash = getStableHashNumber(canonicalName);
        return 4 + (hash % 23);
    };

    const getHonestRatingValue = (productName) => {
        const hash = getStableHashNumber(canonicalProductName(productName));
        const min = 4.2;
        const max = 4.9;
        const value = min + ((hash % 1000) / 1000) * (max - min);
        return value.toFixed(1);
    };

    const inferFragranceAudience = (productName, productOverride) => {
        const context = `${productName || ''} ${productOverride?.subtitle || ''}`.toLowerCase();
        if (context.includes('women') || context.includes('for her') || context.includes('femme')) return 'women';
        if (context.includes('unisex')) return 'unisex';
        return 'men';
    };

    const pickSeededValue = (pool, seed) => {
        if (!Array.isArray(pool) || !pool.length) return '';
        return pool[Math.abs(seed) % pool.length];
    };

    const buildReviewDateLabel = (baseHash, index) => {
        const dayOffset = (baseHash + (index * 5)) % 46;
        const reviewDate = new Date(Date.UTC(2026, 0, 12 + dayOffset));
        return reviewDate.toISOString().slice(0, 10);
    };

    const getReviewAccentPool = (productName, productOverride) => {
        const accordPhraseMap = {
            amber: 'amber warmth',
            aromatic: 'aromatic freshness',
            boozy: 'boozy warmth',
            citrus: 'fresh citrus opening',
            coffee: 'dark coffee facet',
            floral: 'floral nuance',
            fresh: 'clean fresh opening',
            'fresh spicy': 'peppery freshness',
            fruity: 'fruity opening',
            leather: 'leather trail',
            musky: 'clean musky dry-down',
            powdery: 'powdery elegance',
            salty: 'salty contrast',
            smoky: 'smoky depth',
            sweet: 'smooth sweetness',
            tobacco: 'tobacco richness',
            vanilla: 'vanilla dry-down',
            'warm spicy': 'warm spicy opening',
            'white floral': 'white floral heart',
            woody: 'woody dry-down'
        };

        const explicitAccords = Array.isArray(productOverride?.mainAccords)
            ? productOverride.mainAccords
            : mainAccordCatalog[canonicalProductName(productName)] || [];

        const accordAccents = explicitAccords
            .map((accord) => accordPhraseMap[String(accord || '').toLowerCase()] || '')
            .filter(Boolean);

        const noteAccents = Array.isArray(productOverride?.notes)
            ? productOverride.notes
                .map((note) => String(note?.title || '').trim())
                .filter(Boolean)
                .map((title) => title.toLowerCase().replace(/\s*&\s*/g, ' and '))
            : [];

        const subtitleAccents = [];
        const subtitle = String(productOverride?.subtitle || '').toLowerCase();
        if (subtitle.includes('oriental')) subtitleAccents.push('oriental character');
        if (subtitle.includes('woody')) subtitleAccents.push('woody structure');
        if (subtitle.includes('amber')) subtitleAccents.push('amber signature');
        if (subtitle.includes('gourmand')) subtitleAccents.push('gourmand touch');

        return Array.from(new Set([
            ...accordAccents,
            ...noteAccents,
            ...subtitleAccents,
            'overall balance',
            'dry-down'
        ].filter(Boolean)));
    };

    const buildProductReviewSet = (productName, productOverride) => {
        const baseHash = getStableHashNumber(canonicalProductName(productName));
        const accentPool = getReviewAccentPool(productName, productOverride);
        const cities = ['Casablanca', 'Rabat', 'Marrakech', 'Tangier', 'Agadir', 'Fes'];
        const openerTemplates = currentLanguage === 'fr' ? [
            'Le %ACCENT% est ce qui a retenu mon attention en premier et cela se sent très raffiné sur la peau.',
            'Je remarque constamment le %ACCENT%, et cela donne au parfum une identité très distinctive.',
            'Le %ACCENT% rend ce parfum plus raffiné que beaucoup d\'autres dans le même style.',
            'Ce que j\'ai le plus apprécié, c\'est le %ACCENT% ; il se dégage clairement sans être excessif.',
            'Dès le premier jet, le %ACCENT% donne au parfum une impression propre et premium.'
        ] : [
            'The %ACCENT% is what stood out first and it feels very polished on skin.',
            'I keep noticing the %ACCENT%, and it gives the fragrance a very distinctive identity.',
            'The %ACCENT% makes this one feel more refined than many others in the same style.',
            'What I liked most is the %ACCENT%; it comes through clearly without feeling too much.',
            'From the first spray, the %ACCENT% gives the scent a clean and premium impression.'
        ];
        const closerTemplates = currentLanguage === 'fr' ? [
            'La longévité a été très solide pour moi et le parfum reste élégant tout au long du port.',
            'La projection est forte au départ, puis elle se stabilise en un sillage lisse et agréable.',
            'Il sent authentique, bien mélangé et facile à utiliser quand je veux quelque chose de raffiné.',
            'Le flacon et l\'emballage sont également excellents en personne, ce qui a rendu toute la commande premium.',
            'La livraison a été rapide et le parfum est arrivé très bien protégé.',
            'Le séchage est particulièrement bon et semble plus cher que le prix ne le suggère.'
        ] : [
            'Longevity has been very solid for me and the scent stays elegant throughout the wear.',
            'Projection is strong at the start, then it settles into a smooth and wearable trail.',
            'It smells authentic, well blended, and easy to reach for when I want something polished.',
            'Bottle and packaging also look excellent in person, which made the whole order feel premium.',
            'Delivery was quick and the fragrance arrived very well protected.',
            'The dry-down is especially good and feels more expensive than the price suggests.'
        ];

        return Array.from({ length: 3 }, (_, index) => {
            const accent = pickSeededValue(accentPool, baseHash + (index * 7)) || 'overall balance';
            const opener = pickSeededValue(openerTemplates, baseHash + (index * 11)).replace('%ACCENT%', accent);
            const closer = pickSeededValue(closerTemplates, baseHash + (index * 13));

            return {
                date: buildReviewDateLabel(baseHash, index),
                city: pickSeededValue(cities, baseHash + (index * 3)),
                summary: `${opener} ${closer}`,
                detail: `${opener} ${closer}`
            };
        });
    };

    const assignReviewerNames = (productName, productOverride) => {
        const maleNames   = ['Yassine A', 'Mehdi B', 'Omar E', 'Anas F', 'Hamza K', 'Rachid M',
                             'Karim D',   'Bilal H', 'Tarik N', 'Zakaria L', 'Soufiane R', 'Adil C'];
        const femaleNames = ['Salma B', 'Imane E', 'Nadia H', 'Sara A', 'Khadija R', 'Aya M',
                             'Fatima Z', 'Hind K',  'Meryem O', 'Amina S',  'Loubna T',   'Zineb F'];
        const avatarGradients = [
            'linear-gradient(135deg,#1f2937,#374151)',   // dark grey
            'linear-gradient(135deg,#c9a227,#e8c84a)',   // gold
            'linear-gradient(135deg,#6366f1,#8b5cf6)',   // purple
            'linear-gradient(135deg,#0f766e,#14b8a6)',   // teal
            'linear-gradient(135deg,#b45309,#d97706)',   // amber/brown
            'linear-gradient(135deg,#be185d,#ec4899)',   // rose
            'linear-gradient(135deg,#1d4ed8,#60a5fa)',   // blue
            'linear-gradient(135deg,#064e3b,#10b981)',   // emerald
            'linear-gradient(135deg,#7c3aed,#c084fc)',   // violet
            'linear-gradient(135deg,#9f1239,#fb7185)',   // red-pink
            'linear-gradient(135deg,#854d0e,#ca8a04)',   // dark gold
            'linear-gradient(135deg,#134e4a,#2dd4bf)',   // dark teal
        ];
        const audience = inferFragranceAudience(productName, productOverride);

        let pool = maleNames;
        if (audience === 'women') pool = femaleNames;
        if (audience === 'unisex') pool = [
            maleNames[0],   femaleNames[0],
            maleNames[1],   femaleNames[1],
            maleNames[2],   femaleNames[2],
            maleNames[3],   femaleNames[3],
            maleNames[4],   femaleNames[4],
            maleNames[5],   femaleNames[5]
        ];

        const summaryNames = Array.from(document.querySelectorAll('#tab-reviews .review-card h4'));
        const detailNames = Array.from(document.querySelectorAll('.customer-review-list .customer-review-item h3'));
        const summaryCards = Array.from(document.querySelectorAll('#tab-reviews .review-card'));
        const detailCards = Array.from(document.querySelectorAll('.customer-review-list .customer-review-item'));
        if (!summaryNames.length && !detailNames.length && !summaryCards.length && !detailCards.length) return;

        const baseHash = getStableHashNumber(canonicalProductName(productName));
        const getNameForIndex = (index) => pool[(baseHash + index) % pool.length];
        const reviewSet = buildProductReviewSet(productName, productOverride);

        summaryNames.forEach((el, index) => {
            el.textContent = getNameForIndex(index);
        });

        detailNames.forEach((el, index) => {
            el.textContent = getNameForIndex(index);
        });

        summaryCards.forEach((card, index) => {
            const review = reviewSet[index % reviewSet.length];
            const dateEl = card.querySelector('.text-xs.text-gray-500');
            const bodyEl = card.querySelector('.text-sm.text-gray-700');
            if (dateEl) dateEl.textContent = review.date;
            if (bodyEl) bodyEl.textContent = review.summary;
        });

        detailCards.forEach((card, index) => {
            const review = reviewSet[index % reviewSet.length];
            const dateEl    = card.querySelector('.rev-date');
            const bodyEl    = card.querySelector('.rev-body');
            const initialEl = card.querySelector('.rev-avatar-initial');
            const nameEl    = card.querySelector('.rev-name');
            const avatarEl  = card.querySelector('.rev-avatar');
            const footerEl  = card.querySelector('.rev-footer');

            if (dateEl) {
                const d = new Date(review.date + 'T00:00:00Z');
                const formatted = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
                dateEl.textContent = formatted + ' \u00B7 ' + review.city;
            }
            if (bodyEl) bodyEl.textContent = '\u201C' + review.detail + '\u201D';
            if (nameEl && avatarEl) {
                var gradIdx = (baseHash + index * 4) % avatarGradients.length;
                avatarEl.style.background = avatarGradients[gradIdx];
                // Use dark text for light/gold gradients
                var isLight = gradIdx === 1 || gradIdx === 4 || gradIdx === 10;
                var textColor = isLight ? '#78350f' : '#ffffff';
                avatarEl.style.color = textColor;
                if (initialEl) {
                    initialEl.textContent = nameEl.textContent.trim().charAt(0).toUpperCase();
                    initialEl.style.color = textColor;
                }
            }
            if (footerEl) {
                var tagPool = [
                    { icon: 'fa-fire-flame-curved', label: 'Longevity'    },
                    { icon: 'fa-star',              label: 'Elegance'     },
                    { icon: 'fa-wind',              label: 'Projection'   },
                    { icon: 'fa-gem',               label: 'Luxury feel'  },
                    { icon: 'fa-box-open',          label: 'Packaging'    },
                    { icon: 'fa-truck-fast',        label: 'Fast delivery'},
                    { icon: 'fa-leaf',              label: 'Freshness'    },
                    { icon: 'fa-spa',               label: 'Floral heart' },
                    { icon: 'fa-seedling',          label: 'Woody depth'  },
                    { icon: 'fa-pepper-hot',        label: 'Spicy kick'   },
                    { icon: 'fa-feather',           label: 'Soft trail'   }
                ];
                var t1i = (baseHash + index * 3) % tagPool.length;
                var t2i = (baseHash + index * 7 + 4) % tagPool.length;
                if (t2i === t1i) t2i = (t2i + 1) % tagPool.length;
                var t1 = tagPool[t1i], t2 = tagPool[t2i];
                footerEl.innerHTML =
                    '<span class="rev-tag"><i class="fas ' + t1.icon + '"></i> ' + t1.label + '</span>' +
                    '<span class="rev-tag"><i class="fas ' + t2.icon + '"></i> ' + t2.label + '</span>';
            }
        });
    };

    const applyReviewVisibility = (productName) => {
        const baseHash = getStableHashNumber(canonicalProductName(productName));
        const visibleCount = (baseHash % 3) + 1;
        const reviewCards = Array.from(document.querySelectorAll('#tab-reviews .review-card'));
        const customerReviews = Array.from(document.querySelectorAll('.customer-review-list .customer-review-item'));

        reviewCards.forEach((card, index) => {
            card.classList.toggle('hidden', index >= visibleCount);
        });

        customerReviews.forEach((card, index) => {
            card.classList.toggle('hidden', index >= visibleCount);
        });
    };

    const accordDefinitions = [
        { label: 'lavender', weight: 16, color: '#b8addf', textColor: '#233044', terms: ['lavender'] },
        { label: 'vanilla', weight: 16, color: '#efe8c6', textColor: '#2b2b2b', terms: ['vanilla', 'tonka'] },
        { label: 'amber', weight: 15, color: '#d4a373', textColor: '#ffffff', terms: ['amber', 'ambery', 'ambree', 'ambrofix'] },
        { label: 'aromatic', weight: 14, color: '#61c3b1', textColor: '#163b38', terms: ['aromatic', 'sage', 'mint', 'fougere', 'fougère', 'herbal'] },
        { label: 'woody', weight: 14, color: '#9b7a5f', textColor: '#ffffff', terms: ['woody', 'woods', 'wood', 'cedar', 'sandalwood', 'vetiver', 'patchouli'] },
        { label: 'fresh spicy', weight: 13, color: '#b6cf84', textColor: '#26321d', terms: ['fresh spice', 'fresh spicy', 'pepper', 'cardamom', 'nutmeg', 'ginger', 'spicy'] },
        { label: 'warm spicy', weight: 13, color: '#c2885d', textColor: '#ffffff', terms: ['warm spicy', 'spice', 'spicy', 'nutmeg', 'pepper', 'cardamom', 'ginger', 'cinnamon'] },
        { label: 'fruity', weight: 13, color: '#e88c8b', textColor: '#ffffff', terms: ['fruity', 'apple', 'cherry', 'pineapple', 'blackcurrant', 'mandarin', 'bergamot', 'pear'] },
        { label: 'floral', weight: 13, color: '#dfa7b8', textColor: '#402633', terms: ['floral', 'jasmine', 'rose', 'orange blossom', 'narcissus', 'iris', 'osmanthus'] },
        { label: 'white floral', weight: 13, color: '#f2e8ef', textColor: '#533a47', terms: ['white floral', 'jasmine', 'orange blossom', 'tuberose', 'gardenia', 'narcissus'] },
        { label: 'powdery', weight: 12, color: '#f2ede5', textColor: '#5a5350', terms: ['powdery', 'iris'] },
        { label: 'citrus', weight: 12, color: '#e7d67a', textColor: '#413a12', terms: ['citrus', 'bergamot', 'lemon', 'mandarin'] },
        { label: 'leather', weight: 12, color: '#7c5a46', textColor: '#ffffff', terms: ['leather', 'suede'] },
        { label: 'tobacco', weight: 12, color: '#8b6847', textColor: '#ffffff', terms: ['tobacco'] },
        { label: 'smoky', weight: 11, color: '#7b7b88', textColor: '#ffffff', terms: ['smoky', 'incense', 'benzoin'] },
        { label: 'sweet', weight: 11, color: '#e3b1b2', textColor: '#ffffff', terms: ['sweet', 'caramel', 'sugar', 'gourmand', 'chestnut'] },
        { label: 'earthy', weight: 11, color: '#8c8880', textColor: '#ffffff', terms: ['earthy', 'moss', 'soil', 'vetiver'] },
        { label: 'fresh', weight: 11, color: '#bbddd2', textColor: '#21433c', terms: ['fresh', 'clean', 'mint', 'watery'] },
        { label: 'boozy', weight: 11, color: '#8d5a3b', textColor: '#ffffff', terms: ['boozy', 'whisky', 'whiskey', 'rum', 'cognac', 'liqueur'] },
        { label: 'coffee', weight: 11, color: '#6e4c39', textColor: '#ffffff', terms: ['coffee'] },
        { label: 'salty', weight: 11, color: '#8fb8cc', textColor: '#173040', terms: ['salty', 'marine', 'sea salt'] },
        { label: 'herbal', weight: 10, color: '#c8d5cb', textColor: '#33423a', terms: ['herbal', 'clary sage', 'sage', 'green'] },
        { label: 'musky', weight: 10, color: '#d9d5d0', textColor: '#49433f', terms: ['musk', 'musky'] }
    ];
    const accordWidths = ['100%', '93%', '85%', '72%', '69%', '62%', '58%', '54%'];
    const mainAccordCatalog = {
        'bleu de chanel eau de parfum spray': ['citrus', 'woody', 'aromatic', 'amber', 'fresh spicy'],
        'hugo boss the scent for him elixir': ['warm spicy', 'aromatic', 'woody', 'amber', 'leather'],
        'boss bottled absolu intense': ['leather', 'woody', 'warm spicy', 'resinous', 'amber'],
        'hugo boss boss bottled elixir intense': ['woody', 'amber', 'warm spicy', 'earthy', 'resinous'],
        'guerlain l homme id al l intense eau de parfum': ['warm spicy', 'woody', 'amber', 'oriental', 'leather'],
        'guerlain l homme ideal l intense eau de parfum': ['warm spicy', 'woody', 'amber', 'oriental', 'leather'],
        'guerlain l homme id al extr me': ['almond', 'warm spicy', 'woody', 'tobacco', 'leather'],
        'guerlain l homme ideal extreme': ['almond', 'warm spicy', 'woody', 'tobacco', 'leather'],
        'versace eros eau de parfum': ['fresh', 'vanilla', 'aromatic', 'woody', 'amber'],
        'versace eros flame eau de parfum': ['citrus', 'warm spicy', 'woody', 'vanilla', 'aromatic'],
        'versace eros energy eau de parfum': ['citrus', 'fresh', 'aromatic', 'musky', 'woody'],
        'versace dylan blue eau de toilette': ['citrus', 'fresh spicy', 'musky', 'woody', 'aromatic'],
        'rabanne one million parfum': ['salty', 'white floral', 'amber', 'leather', 'warm spicy'],
        'rabanne one million elixir intense': ['vanilla', 'sweet', 'fruity', 'warm spicy', 'amber'],
        'givenchy gentleman society amber eau de parfum': ['amber', 'tobacco', 'woody', 'warm spicy', 'leather'],
        'givenchy gentleman society nomade eau de parfum': ['woody', 'aromatic', 'floral', 'earthy', 'vanilla'],
        'givenchy gentleman society extreme eau de parfum': ['aromatic', 'coffee', 'woody', 'warm spicy', 'vanilla'],
        'gentleman private reserve eau de parfum': ['powdery', 'boozy', 'woody', 'amber', 'sweet'],
        'jean paul gaultier scandal elixir': ['fruity', 'sweet', 'warm spicy', 'woody', 'amber'],
        'jean paul gaultier scandal intense eau de parfum': ['leather', 'woody', 'amber', 'aromatic', 'warm spicy'],
        'azzaro the most wanted parfum': ['vanilla', 'amber', 'warm spicy', 'woody', 'sweet'],
        'azzaro the most wanted eau de parfum intense': ['sweet', 'warm spicy', 'amber', 'woody', 'vanilla'],
        'azzaro forever wanted elixir eau de parfum': ['amber', 'sweet', 'vanilla', 'woody', 'warm spicy'],
        'valentino donna born in roma eau de parfum': ['fruity', 'white floral', 'vanilla', 'woody', 'sweet'],
        'valentino uomo born in roma coral fantasy eau de toilette': ['fruity', 'aromatic', 'tobacco', 'woody', 'fresh spicy'],
        'valentino born in roma extradose eau de toilette': ['woody', 'aromatic', 'fresh spicy', 'citrus', 'amber'],
        'dior sauvage eau de parfum': ['fresh spicy', 'amber', 'vanilla', 'woody', 'citrus'],
        'dior homme intense eau de parfum': ['powdery', 'woody', 'amber', 'musky', 'floral'],
        'valentino born in roma uomo intense eau de parfum': ['vanilla', 'amber', 'woody', 'aromatic', 'smoky'],
        'valentino born in roma donna intense eau de parfum': ['vanilla', 'amber', 'white floral', 'woody', 'sweet'],
        'valentino uomo born in roma eau de toilette': ['citrus', 'aromatic', 'woody', 'fresh spicy', 'fresh'],
        'emporio armani stronger with you intensely edp': ['vanilla', 'sweet', 'amber', 'warm spicy', 'woody'],
        'armani stronger with you powerfully eau de parfum': ['fruity', 'aromatic', 'smoky', 'vanilla', 'amber'],
        'armani stronger with you absolutely perfume': ['boozy', 'vanilla', 'amber', 'sweet', 'woody'],
        'yves saint laurent y eau de parfum': ['aromatic', 'fresh spicy', 'woody', 'citrus', 'smoky'],
        'yves saint laurent myslf eau de parfum': ['citrus', 'white floral', 'woody', 'fresh', 'amber'],
        'yves saint laurent myslf le parfum': ['warm spicy', 'white floral', 'vanilla', 'woody', 'amber'],
        'jean paul gaultier le male elixir eau de parfum': ['vanilla', 'aromatic', 'sweet', 'amber', 'fresh spicy'],
        'jean paul gaultier le male in blue eau de parfum': ['aromatic', 'fresh spicy', 'amber', 'marine', 'lavender'],
        'jean paul gaultier le male eau de toilette': ['aromatic', 'fresh spicy', 'vanilla', 'warm spicy', 'woody'],
        'jean paul gaultier le male le parfum eau de parfum': ['warm spicy', 'vanilla', 'woody', 'amber', 'aromatic'],
        'jean paul gaultier le beau eau de parfum': ['fruity', 'sweet', 'vanilla', 'woody', 'amber'],
        'carolina herrera bad boy eau de toilette': ['warm spicy', 'citrus', 'woody', 'aromatic', 'sweet'],
        'gucci guilty absolu de parfum pour homme': ['boozy', 'woody', 'amber', 'warm spicy', 'white floral'],
        'gucci guilty elixir pour homme': ['amber', 'powdery', 'woody', 'smoky', 'warm spicy'],
        'montale arabians tonka': ['sweet', 'amber', 'leather', 'woody', 'floral']
    };
    const accordLookup = accordDefinitions.reduce((lookup, accord) => {
        lookup[accord.label] = accord;
        return lookup;
    }, {});

    const normalizeAccordEntries = (entries) => entries.slice(0, 8).map((entry, index) => {
        const label = String(typeof entry === 'string' ? entry : entry?.label || '').trim().toLowerCase();
        const configuredWidth = typeof entry === 'object' && entry?.width ? entry.width : '';
        const accordMeta = accordLookup[label] || {
            color: '#b59374',
            textColor: '#ffffff'
        };

        return {
            label,
            color: accordMeta.color,
            textColor: accordMeta.textColor,
            width: configuredWidth || accordWidths[index] || '52%'
        };
    }).filter((accord) => accord.label);

    const buildMainAccords = (productName, productOverride, subtitleText) => {
        const explicitAccords = Array.isArray(productOverride?.mainAccords)
            ? productOverride.mainAccords
            : mainAccordCatalog[canonicalProductName(productName)] || [];

        if (explicitAccords.length) {
            return normalizeAccordEntries(explicitAccords);
        }

        const sourceText = normalizeSearchText([
            productName,
            subtitleText,
            productOverride?.longDescription,
            ...(Array.isArray(productOverride?.notes)
                ? productOverride.notes.flatMap((note) => [note.title, note.text])
                : [])
        ].filter(Boolean).join(' '));

        const matches = accordDefinitions.map((accord, index) => {
            let score = 0;
            accord.terms.forEach((term) => {
                const normalizedTerm = normalizeSearchText(term);
                if (!normalizedTerm) return;
                if (sourceText.includes(normalizedTerm)) {
                    score += accord.weight;
                }
            });

            return {
                ...accord,
                score,
                index
            };
        }).filter((accord) => accord.score > 0);

        const ranked = (matches.length ? matches : accordDefinitions.slice(0, 6).map((accord, index) => ({
            ...accord,
            score: accord.weight - index,
            index
        })))
            .sort((left, right) => right.score - left.score || left.index - right.index)
            .slice(0, 8);

        return ranked.map((accord, index) => ({
            label: accord.label,
            color: accord.color,
            textColor: accord.textColor,
            width: accordWidths[index] || '52%'
        }));
    };

    const renderMainAccords = (productName, productOverride, subtitleText) => {
        const targets = [
            {
                panel: document.getElementById('productMainAccordsPanel'),
                list: document.getElementById('productMainAccordsList')
            },
            {
                panel: document.getElementById('productMainAccordsPanelMobile'),
                list: document.getElementById('productMainAccordsListMobile')
            }
        ].filter((target) => target.panel && target.list);

        if (!targets.length) return;

        const accords = buildMainAccords(productName, productOverride, subtitleText);
        if (!accords.length) {
            targets.forEach(({ panel }) => {
                panel.setAttribute('hidden', 'hidden');
            });
            return;
        }

        const markup = accords.map((accord) => `
            <div class="product-accord-row" style="--accord-width:${accord.width};--accord-bg:${accord.color};--accord-fg:${accord.textColor};">
                <span class="product-accord-pill">${accord.label}</span>
            </div>
        `).join('');

        targets.forEach(({ panel, list }) => {
            list.innerHTML = markup;
            panel.removeAttribute('hidden');
        });
    };

    const initProductDetailPage = async () => {
        if (!productNameEl) return;

        const params = new URLSearchParams(window.location.search);
        const productName = params.get('name') || productNameEl.textContent.trim();
        const productId = params.get('id') || toProductDataId(productName);
        const productBrand = params.get('brand') || 'IPORDISE';

        /* ── Show the product image immediately, before prices load ── */
        const earlyImage = normalizeImagePathForCurrentPage(params.get('image') || '');
        const earlyOverride = productDetailOverrides[canonicalProductName(productName)] || null;
        const earlyResolvedImages = getResolvedProductImageGallery(earlyImage, earlyOverride);
        const earlyDefaultImage = earlyResolvedImages[0] || '';
        if (earlyDefaultImage) {
            const mainImageEl = document.getElementById('productMainImage');
            if (mainImageEl) mainImageEl.src = earlyDefaultImage;
        }

        // Load sizes and prices in parallel
        const [pricesById] = await Promise.all([loadPricesJson(), loadSizesJson()]);
        const productPrice = formatCatalogPrice(productId, pricesById) || params.get('price') || '/';
        const productOldPrice = params.get('oldPrice') || '';
        const productDiscount = params.get('discount') || '';
        const productReviews = params.get('reviews') || '0';
        const productImage = normalizeImagePathForCurrentPage(params.get('image') || '');
        const productOverride = productDetailOverrides[canonicalProductName(productName)] || null;
        const requestedSizeKeys = String(params.get('sizes') || '')
            .split(/[|,]/)
            .map((entry) => normalizeSizeLabelToKey(entry))
            .filter(Boolean);
        const fallbackSizeKeys = new Set(requestedSizeKeys);
        const _normalizedPid   = String(productId || '').trim();
        const _jsonSizeList    = _runtimeProductSizes[_normalizedPid];
        const jsonControlsThisProduct = Boolean(_jsonSizeList && _jsonSizeList.length);

        let productSizePriceOptions;
        if (jsonControlsThisProduct) {
            // sizes.json is fully authoritative — build options DIRECTLY from it.
            // This bypasses getAvailableSizePriceOptions / getConfiguredSizeKeys
            // entirely so nothing else can drop or reorder custom size keys.
            const _rawPrices = pricesById && typeof pricesById === 'object' ? pricesById[_normalizedPid] : null;
            productSizePriceOptions = _jsonSizeList.map((sizeKey) => {
                // Use priceKey to read prices.json so renamed keys still find their price
                const priceLookup = _runtimePriceKeyBySizeKey[sizeKey] || sizeKey;
                const rawVal = _rawPrices && typeof _rawPrices === 'object' ? _rawPrices[priceLookup] : 0;
                const price  = Number.isFinite(Number(rawVal)) && Number(rawVal) > 0 ? Number(rawVal) : 0;
                const label  = formatSizeLabel(sizeKey);
                return {
                    sizeKey,
                    label,
                    price,
                    priceText:   price > 0 ? formatPriceAmount(price) : '',
                    unitPrice:   price,
                    isDecante:   isDecanteSizeKey(sizeKey),
                    volumeLabel: label,
                };
            });
        } else {
            // No sizes.json entry — fall back to the original pipeline
            productSizePriceOptions = getAvailableSizePriceOptions(productId, pricesById, requestedSizeKeys);

            if (Array.isArray(productOverride?.sizes) && productOverride.sizes.length) {
                const allowedSizeKeys = new Set(
                    productOverride.sizes
                        .map((entry) => normalizeSizeOptionEntry(entry, ''))
                        .map((entry) => normalizeSizeLabelToKey(entry.volumeLabel || entry.label))
                        .filter(Boolean)
                );
                if (allowedSizeKeys.size) {
                    productSizePriceOptions = productSizePriceOptions.filter((entry) => allowedSizeKeys.has(normalizeSizeLabelToKey(entry.volumeLabel || entry.label)));
                }
            } else if (fallbackSizeKeys.size) {
                productSizePriceOptions = productSizePriceOptions.filter((entry) => fallbackSizeKeys.has(normalizeSizeLabelToKey(entry.volumeLabel || entry.label)));
            }
        }

        const setText = (id, value) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.textContent = value;
        };

        const resolvedBrand = productOverride?.brand || productBrand;
        const honestReviews = getHonestReviewCount(productName, productReviews);
        const honestRating = getHonestRatingValue(productName);
        setText('productName', productName);
        setText('productBrand', resolvedBrand);
        setText('productBrandBannerName', resolvedBrand);
        setText('productPrice', productPrice);
        setText('productOldPrice', productOldPrice || '');
        setText('productDiscount', productDiscount || '');
        setText('productReviewsCount', `(${honestReviews} reviews)`);
        setText('productBreadcrumb', productName);
        setText('stickyName', productName);
        setText('stickyPrice', productPrice);

        const ratingSummaryValue = document.querySelector('.review-summary .text-5xl.font-bold.text-brand-dark');
        if (ratingSummaryValue) {
            ratingSummaryValue.textContent = honestRating;
        }

        const ratingSummaryCount = document.querySelector('.review-summary .text-sm.text-gray-500.mt-1');
        if (ratingSummaryCount) {
            ratingSummaryCount.textContent = `Based on ${honestReviews} verified reviews`;
        }

        const moreReviewsRatingValue = document.querySelector('.customer-rating-value');
        if (moreReviewsRatingValue) {
            moreReviewsRatingValue.textContent = Number.parseFloat(honestRating).toFixed(2);
        }

        const moreReviewsToolbar = document.querySelector('.customer-reviews-toolbar p');
        if (moreReviewsToolbar) {
            moreReviewsToolbar.textContent = `5 star · ${honestReviews} reviews`;
        }

        assignReviewerNames(productName, productOverride);
        applyReviewVisibility(productName);

        // Update fragrance profile bars dynamically
        const fp = productOverride?.fragranceProfile;
        if (fp) {
            const sillageFr = { 'Strong': 'Fort', 'Very Strong': 'Très fort', 'Moderate': 'Modéré', 'Moderate-Strong': 'Modéré-Fort', 'Powerful': 'Puissant' };
            const seasonFr = { 'All Year': "Toute l'année", 'Fall/Winter': 'Automne/Hiver', 'Spring/Summer': 'Printemps/Été' };
            const dnaRows = document.querySelectorAll('#fragranceProfile .product-dna-row');
            const profiles = [
                { fill: fp.longevity, label: fp.longevityLabel },
                { fill: fp.sillage,   label: currentLanguage === 'fr' ? (sillageFr[fp.sillageLabel] || fp.sillageLabel) : fp.sillageLabel },
                { fill: fp.season,    label: currentLanguage === 'fr' ? (seasonFr[fp.seasonLabel]   || fp.seasonLabel)   : fp.seasonLabel  }
            ];
            dnaRows.forEach((row, i) => {
                if (!profiles[i]) return;
                const fill = row.querySelector('.product-dna-fill');
                const value = row.querySelector('.product-dna-value');
                if (fill) {
                    fill.style.width = '0%';
                    fill.setAttribute('data-target', profiles[i].fill + '%');
                }
                if (value) value.textContent = profiles[i].label;
            });
        }

        const lastCatalogUrl = (() => {
            try {
                return sessionStorage.getItem('lastCatalogUrl') || '';
            } catch (error) {
                return '';
            }
        })();

        if (lastCatalogUrl) {
            document.querySelectorAll('main a[href*="discover.html"]').forEach((link) => {
                link.setAttribute('href', lastCatalogUrl);
            });
        }

        const subtitle = document.getElementById('productSubtitle');
        if (subtitle) {
            subtitle.textContent = (currentLanguage === 'fr' ? productOverride?.fr?.subtitle : null)
                || productOverride?.subtitle
                || `${productName} by ${resolvedBrand}: an elegant choice crafted for a modern signature and long-lasting trail.`;
        }

        renderMainAccords(productName, productOverride, subtitle?.textContent || '');

        const currentGender = getProductGenderKey(productName, productOverride, subtitle?.textContent || '');
        renderRelatedProducts(productName, resolvedBrand, currentGender);

        const longDescription = document.getElementById('productLongDescription');
        if (longDescription) {
            const _ldText = (currentLanguage === 'fr' ? productOverride?.fr?.longDescription : null)
                || productOverride?.longDescription
                || `${productName} balances freshness and depth for a sophisticated daily scent. The composition opens bright, evolves into a refined floral-spiced heart, then settles into a warm and memorable base that stays close and elegant on skin.`;
            longDescription.innerHTML = formatLongDesc(_ldText);
        }

        const activeNotes = (currentLanguage === 'fr' && Array.isArray(productOverride?.fr?.notes))
            ? productOverride.fr.notes
            : productOverride?.notes;
        if (Array.isArray(activeNotes)) {
            const noteCards = document.querySelectorAll('#tab-notes .note-card');
            activeNotes.forEach((note, index) => {
                const card = noteCards[index];
                if (!card) return;
                const titleEl = card.querySelector('h3');
                const textEl = card.querySelector('p');
                if (titleEl && note.title) titleEl.textContent = note.title;
                if (textEl && note.text) textEl.textContent = note.text;
            });
        }

        let hasPrices = productSizePriceOptions.some((entry) => entry.price > 0);

        const sizeSelector = document.getElementById('sizeSelector');
        if (sizeSelector && productSizePriceOptions.length) {
            const buildBtn = ({ sizeKey, label, priceText, isDecante, price }) => `
                <button class="size-pill${isDecante ? ' is-decante' : ''}" type="button" data-size-key="${sizeKey}" data-label="${label}">
                    <span class="spill-indicator"></span>
                    <span class="spill-vol">${label}</span>
                    <span class="spill-price">${price > 0 ? priceText : t('product_price_on_request')}</span>
                </button>
            `;

            const decanteOptions = productSizePriceOptions.filter((entry) => entry.isDecante);
            const fullBottleOptions = productSizePriceOptions.filter((entry) => !entry.isDecante);
            const groupMarkup = [];

            if (decanteOptions.length) {
                groupMarkup.push(`
                    <div class="size-group size-group-decants">
                        <p class="size-group-label"><i class="fas fa-flask"></i> ${t('product_decants')}</p>
                        <div class="size-group-pills">
                            ${decanteOptions.map(buildBtn).join('')}
                        </div>
                    </div>
                `);
            }

            if (fullBottleOptions.length) {
                groupMarkup.push(`
                    <div class="size-group size-group-bottles">
                        <p class="size-group-label"><i class="fas fa-bottle-droplet"></i> ${t('product_full_bottles')}</p>
                        <div class="size-group-pills">
                            ${fullBottleOptions.map(buildBtn).join('')}
                        </div>
                    </div>
                `);
            }

            sizeSelector.innerHTML = groupMarkup.join('');
        }

        const mainImage = document.getElementById('productMainImage');
        const stickyImage = document.getElementById('stickyImage');
        const productThumbs = document.getElementById('productThumbs');
        const resolvedGalleryImages = getResolvedProductImageGallery(productImage, productOverride);

        if (productThumbs && resolvedGalleryImages.length) {
            productThumbs.innerHTML = resolvedGalleryImages.map((src, index) => `
                <button class="product-thumb-btn${index === 0 ? ' is-active' : ''}" type="button" data-image="${src}">
                    <img src="${src}" alt="Thumb ${index + 1}" class="product-thumb-image" draggable="false" oncontextmenu="return false;" ondragstart="return false;">
                </button>
            `).join('');
        } else if (productThumbs && productImage) {
            const normalizedImage = normalizeImagePathForCurrentPage(productImage);
            productThumbs.innerHTML = `
                <button class="product-thumb-btn is-active" type="button" data-image="${normalizedImage}">
                    <img src="${normalizedImage}" alt="Thumb 1" class="product-thumb-image" draggable="false" oncontextmenu="return false;" ondragstart="return false;">
                </button>
            `;
        }

        const defaultImage = resolvedGalleryImages[0] || productImage;
        if (defaultImage) {
            if (mainImage) mainImage.src = defaultImage;
            if (stickyImage) stickyImage.src = defaultImage;

            const firstThumb = document.querySelector('#productThumbs .product-thumb-btn img');
            const firstThumbBtn = document.querySelector('#productThumbs .product-thumb-btn');
            if (firstThumb) firstThumb.src = defaultImage;
            if (firstThumbBtn) firstThumbBtn.dataset.image = defaultImage;
        }

        const applyThumbFallbacks = () => {
            if (!defaultImage) return;
            const thumbImages = document.querySelectorAll('#productThumbs .product-thumb-btn img');
            thumbImages.forEach((img) => {
                if (img.dataset.fallbackBound === 'true') return;
                img.dataset.fallbackBound = 'true';
                img.addEventListener('error', () => {
                    if (img.dataset.fallbackApplied === 'true') return;
                    img.dataset.fallbackApplied = 'true';
                    img.src = defaultImage;
                    const btn = img.closest('.product-thumb-btn');
                    if (btn) btn.dataset.image = defaultImage;
                });
            });
        };

        applyThumbFallbacks();

        const thumbButtons = document.querySelectorAll('#productThumbs .product-thumb-btn');
        thumbButtons.forEach((btn) => {
            btn.addEventListener('click', () => {
                const imageSrc = btn.dataset.image;
                if (!imageSrc) return;
                if (mainImage) {
                    mainImage.style.opacity = '0';
                    setTimeout(() => {
                        mainImage.src = imageSrc;
                        mainImage.style.opacity = '1';
                    }, 200);
                }
                thumbButtons.forEach((item) => item.classList.remove('is-active'));
                btn.classList.add('is-active');
            });
        });

        const mainPriceEl = document.getElementById('productPrice');
        const oldPriceEl = document.getElementById('productOldPrice');
        const discountEl = document.getElementById('productDiscount');
        const priceCardEl = mainPriceEl ? mainPriceEl.closest('.product-price-card') : null;
        const stickyPriceEl = document.getElementById('stickyPrice');
        const addToCartBtn = document.getElementById('addToCartBtn');
        const stickyAddToCartBtn = document.getElementById('stickyAddToCartBtn');

        const sizeButtons = Array.from(document.querySelectorAll('#sizeSelector .size-pill'));
        const sizeOptions = sizeButtons.map((btn) => {
            const sizeKey = String(btn.dataset.sizeKey || '').trim().toLowerCase();
            const matchedOption = productSizePriceOptions.find((entry) => entry.sizeKey === sizeKey);

            return {
                button: btn,
                label: matchedOption?.label || btn.dataset.label || btn.textContent.trim(),
                priceText: matchedOption?.priceText || '',
                unitPrice: matchedOption?.unitPrice || 0,
                isDecante: Boolean(matchedOption?.isDecante)
            };
        });

        let selectedSize = null;

        const syncPriceCardState = (selectedPriceText) => {
            if (!priceCardEl) return;

            const hasMeta = Boolean((oldPriceEl?.textContent || '').trim() || (discountEl?.textContent || '').trim());
            const hasSelectedPrice = Boolean(selectedPriceText);

            priceCardEl.classList.toggle('has-meta', hasMeta);
            priceCardEl.classList.toggle('is-priced', hasSelectedPrice);

            if (!hasSelectedPrice) {
                priceCardEl.classList.remove('is-price-animating');
                return;
            }

            // Re-trigger the reveal animation each time a size is selected.
            priceCardEl.classList.remove('is-price-animating');
            void priceCardEl.offsetWidth;
            priceCardEl.classList.add('is-price-animating');
        };

        const qtyBoxContainer = document.getElementById('qtyBoxContainer');
        const whatsappInquiryBtn = document.getElementById('whatsappInquiryBtn');

        const setAddButtonsEnabled = (enabled) => {
            // For no-price products, never show the cart UI
            if (!hasPrices) {
                [addToCartBtn, stickyAddToCartBtn].forEach((button) => {
                    if (!button) return;
                    button.classList.add('hidden');
                    button.disabled = true;
                });
                if (qtyBoxContainer) qtyBoxContainer.classList.add('hidden');
                return;
            }
            [addToCartBtn, stickyAddToCartBtn].forEach((button) => {
                if (!button) return;
                if (!enabled) {
                    button.classList.add('hidden');
                    button.disabled = true;
                } else {
                    button.classList.remove('hidden');
                    button.disabled = false;
                    button.className = 'product-cart-btn';
                    button.textContent = 'Add to Cart';
                }
            });
            if (qtyBoxContainer) {
                qtyBoxContainer.classList.toggle('hidden', !enabled);
            }
        };

        const updateWhatsAppBtn = () => {
            if (!whatsappInquiryBtn) return;
            if (!hasPrices && selectedSize) {
                const msg = `Bonjour IPORDISE,\n\nJe suis intéressé(e) par le produit suivant et j'aimerais connaître le prix et la disponibilité :\n\n- Produit : ${productName}\n- Marque : ${resolvedBrand}\n- Taille : ${selectedSize.label}\n\nMerci !`;
                whatsappInquiryBtn.href = `https://wa.me/212663750210?text=${encodeURIComponent(msg)}`;
                whatsappInquiryBtn.classList.remove('hidden');
            } else {
                whatsappInquiryBtn.classList.add('hidden');
            }
        };

        const deliveryChipEl = document.getElementById('productDeliveryChip');
        const deliveryInfoEl = document.getElementById('productDeliveryInfo');

        const updateDisplayedPrice = () => {
            const selectedPrice = selectedSize?.priceText || '';
            const sizeHasPrice = selectedSize && selectedSize.unitPrice > 0;
            const isDecante = Boolean(selectedSize?.isDecante);
            const deliveryFee = isDecante ? '35 MAD' : '35 MAD (VAT included)';

            if (hasPrices) {
                if (mainPriceEl) {
                    mainPriceEl.classList.toggle('text-gray-400', !sizeHasPrice);
                    mainPriceEl.classList.toggle('text-gray-900', !!sizeHasPrice);
                    if (!selectedSize) {
                        mainPriceEl.textContent = t('product_choose_size');
                    } else if (sizeHasPrice) {
                        // Split "270 DH" → number + styled unit span
                        const priceMatch = selectedPrice.match(/^(.+?)\s*(DH)$/);
                        if (priceMatch) {
                            mainPriceEl.innerHTML = `${priceMatch[1]}<span class="price-unit"> ${priceMatch[2]}</span>`;
                        } else {
                            mainPriceEl.textContent = selectedPrice;
                        }
                    } else {
                        mainPriceEl.textContent = t('product_price_on_request');
                    }
                }
                if (stickyPriceEl) {
                    stickyPriceEl.textContent = sizeHasPrice ? selectedPrice : (selectedSize ? t('product_price_on_request') : t('product_choose_size_sticky'));
                }
                if (deliveryInfoEl) {
                    deliveryInfoEl.textContent = `${t('product_delivery_in_stock')}: ${deliveryFee}`;
                }
                syncPriceCardState(sizeHasPrice ? selectedPrice : '');
            }
            if (deliveryChipEl) {
                deliveryChipEl.innerHTML = `<i class="fas fa-truck text-brand-red"></i> ${t('product_delivery_fee')}: ${deliveryFee}`;
            }
        };

        // Show the correct info block and configure the CTA button based on price availability
        const productPriceCard = document.getElementById('productPriceCard');
        const productOndemandBox = document.getElementById('productOndemandBox');
        if (hasPrices) {
            if (productPriceCard) productPriceCard.removeAttribute('hidden');
            if (addToCartBtn) {
                addToCartBtn.className = 'hidden product-cart-btn';
                addToCartBtn.textContent = t('product_add_to_cart');
            }
        } else {
            if (productOndemandBox) productOndemandBox.removeAttribute('hidden');
            if (addToCartBtn) {
                addToCartBtn.className = 'hidden product-cart-btn';
                addToCartBtn.textContent = t('product_add_to_cart');
            }
        }

        sizeButtons.forEach((btn) => btn.classList.remove('is-active'));
        updateDisplayedPrice();
        setAddButtonsEnabled(false);
        updateWhatsAppBtn();

        sizeOptions.forEach((option) => {
            option.button.addEventListener('click', () => {
                sizeButtons.forEach((item) => item.classList.remove('is-active'));
                option.button.classList.add('is-active');
                selectedSize = option;
                updateDisplayedPrice();
                setAddButtonsEnabled(true);
                updateWhatsAppBtn();
            });
        });

        const qtyMinus = document.getElementById('qtyMinus');
        const qtyPlus = document.getElementById('qtyPlus');
        const qtyValue = document.getElementById('qtyValue');
        let quantity = Number(qtyValue?.textContent || '1');

        if (qtyMinus && qtyPlus && qtyValue) {
            qtyMinus.addEventListener('click', () => {
                quantity = Math.max(1, quantity - 1);
                qtyValue.textContent = String(quantity);
            });

            qtyPlus.addEventListener('click', () => {
                quantity = Math.min(99, quantity + 1);
                qtyValue.textContent = String(quantity);
            });
        }

        const handleAddToCart = () => {
            if (!selectedSize) return;
            const qty = qtyValue ? Number(qtyValue.textContent) || 1 : 1;
            const nextItems = readCart();
            const existingIndex = nextItems.findIndex(
                (item) => item.name === productName && item.brand === resolvedBrand && item.size === selectedSize.label
            );
            if (existingIndex >= 0) {
                nextItems[existingIndex].quantity = Math.min(99, Number(nextItems[existingIndex].quantity || 1) + qty);
                nextItems[existingIndex].priceText = selectedSize.priceText || '';
                nextItems[existingIndex].unitPrice = selectedSize.unitPrice;
                nextItems[existingIndex].pricePending = selectedSize.unitPrice <= 0;
            } else {
                nextItems.unshift({
                    id: `${canonicalProductName(productName)}-${canonicalProductName(selectedSize.label)}-${Date.now()}`,
                    name: productName,
                    brand: resolvedBrand,
                    size: selectedSize.label,
                    quantity: qty,
                    priceText: selectedSize.priceText || '',
                    unitPrice: selectedSize.unitPrice,
                    pricePending: selectedSize.unitPrice <= 0,
                    image: defaultImage || ''
                });
            }
            writeCart(nextItems);
            // Flash button green then back to black
            [addToCartBtn, stickyAddToCartBtn].forEach((btn) => {
                if (!btn) return;
                btn.style.transition = 'background 0.2s ease';
                btn.style.background = 'linear-gradient(135deg, #22c55e, #16a34a)';
                btn.textContent = t('product_added');
                setTimeout(() => {
                    btn.style.background = '';
                    btn.textContent = t('product_add_to_cart');
                }, 1800);
            });
            showAddedToCartToast(productName, selectedSize.label);
        };

        if (addToCartBtn) {
            addToCartBtn.addEventListener('click', handleAddToCart);
        }

        if (stickyAddToCartBtn) {
            stickyAddToCartBtn.addEventListener('click', handleAddToCart);
        }

        const tabButtons = document.querySelectorAll('#productTabs .tab-btn');
        const tabPanels = document.querySelectorAll('.tab-panel');

        tabButtons.forEach((btn) => {
            btn.addEventListener('click', () => {
                const tabId = btn.dataset.tab;
                tabButtons.forEach((item) => {
                    item.classList.remove('is-active');
                    item.setAttribute('aria-selected', 'false');
                });

                tabPanels.forEach((panel) => {
                    panel.classList.remove('is-active');
                    panel.hidden = true;
                });

                const activePanel = document.getElementById(`tab-${tabId}`);
                if (activePanel) {
                    activePanel.classList.add('is-active');
                    activePanel.hidden = false;
                }

                btn.classList.add('is-active');
                btn.setAttribute('aria-selected', 'true');
            });
        });

        /* ── Re-render all language-sensitive content on language switch ── */
        onLanguageChange(() => {
            // Subtitle
            const subtitleEl = document.getElementById('productSubtitle');
            if (subtitleEl) {
                subtitleEl.textContent = (currentLanguage === 'fr' ? productOverride?.fr?.subtitle : null)
                    || productOverride?.subtitle
                    || `${productName} by ${resolvedBrand}: an elegant choice crafted for a modern signature and long-lasting trail.`;
            }

            // Long description
            const longDescEl = document.getElementById('productLongDescription');
            if (longDescEl) {
                const _ldText2 = (currentLanguage === 'fr' ? productOverride?.fr?.longDescription : null)
                    || productOverride?.longDescription
                    || `${productName} balances freshness and depth for a sophisticated daily scent. The composition opens bright, evolves into a refined floral-spiced heart, then settles into a warm and memorable base that stays close and elegant on skin.`;
                longDescEl.innerHTML = formatLongDesc(_ldText2);
            }

            // Notes
            const reActiveNotes = (currentLanguage === 'fr' && Array.isArray(productOverride?.fr?.notes))
                ? productOverride.fr.notes
                : productOverride?.notes;
            if (Array.isArray(reActiveNotes)) {
                const noteCards = document.querySelectorAll('#tab-notes .note-card');
                reActiveNotes.forEach((note, index) => {
                    const card = noteCards[index];
                    if (!card) return;
                    const titleEl = card.querySelector('h3');
                    const textEl = card.querySelector('p');
                    if (titleEl && note.title) titleEl.textContent = note.title;
                    if (textEl && note.text) textEl.textContent = note.text;
                });
            }

            // DNA fragrance profile sillage / season labels
            if (fp) {
                const sillageFrMap = { 'Strong': 'Fort', 'Very Strong': 'Très fort', 'Moderate': 'Modéré', 'Moderate-Strong': 'Modéré-Fort', 'Powerful': 'Puissant' };
                const seasonFrMap = { 'All Year': "Toute l'année", 'Fall/Winter': 'Automne/Hiver', 'Spring/Summer': 'Printemps/Été' };
                const dnaRows = document.querySelectorAll('#fragranceProfile .product-dna-row');
                const relabels = [
                    { label: fp.longevityLabel },
                    { label: currentLanguage === 'fr' ? (sillageFrMap[fp.sillageLabel] || fp.sillageLabel) : fp.sillageLabel },
                    { label: currentLanguage === 'fr' ? (seasonFrMap[fp.seasonLabel]   || fp.seasonLabel)   : fp.seasonLabel  }
                ];
                dnaRows.forEach((row, i) => {
                    if (!relabels[i]) return;
                    const value = row.querySelector('.product-dna-value');
                    if (value) value.textContent = relabels[i].label;
                });
            }

            // Size group labels
            document.querySelectorAll('.size-group-decants .size-group-label').forEach((el) => {
                el.innerHTML = `<i class="fas fa-flask"></i> ${t('product_decants')}`;
            });
            document.querySelectorAll('.size-group-bottles .size-group-label').forEach((el) => {
                el.innerHTML = `<i class="fas fa-bottle-droplet"></i> ${t('product_full_bottles')}`;
            });

            // Add to cart buttons
            [addToCartBtn, stickyAddToCartBtn].forEach((btn) => {
                if (btn && !btn.classList.contains('hidden')) btn.textContent = t('product_add_to_cart');
            });

            // Price / delivery display
            updateDisplayedPrice();

            // Reviews count
            const reviewsCountEl = document.getElementById('productReviewsCount');
            if (reviewsCountEl) {
                reviewsCountEl.textContent = currentLanguage === 'fr'
                    ? `(${honestReviews} avis)`
                    : `(${honestReviews} reviews)`;
            }

            // Review summary
            const ratingSummaryCount = document.querySelector('.review-summary .text-sm.text-gray-500.mt-1');
            if (ratingSummaryCount) {
                ratingSummaryCount.textContent = currentLanguage === 'fr'
                    ? `Basé sur ${honestReviews} avis vérifiés`
                    : `Based on ${honestReviews} verified reviews`;
            }

            const moreReviewsToolbar = document.querySelector('.customer-reviews-toolbar p');
            if (moreReviewsToolbar) {
                moreReviewsToolbar.textContent = currentLanguage === 'fr'
                    ? `5 étoiles · ${honestReviews} avis`
                    : `5 star · ${honestReviews} reviews`;
            }

            // Re-render related products cards so button text updates
            renderRelatedProducts(productName, resolvedBrand, currentGender);

            // Re-apply data-i18n translations (tabs, labels, static elements)
            if (window.__i18n) window.__i18n.applyTranslations();
        });
    };

    const initAccountMenu = () => {
        const accountTriggers = document.querySelectorAll('.header-icon-btn[aria-label="Account"]');
        if (!accountTriggers.length) return;

        const allMenus = [];

        const closeAllMenus = (exceptMenu = null) => {
            allMenus.forEach((menu) => {
                if (menu === exceptMenu) return;
                menu.classList.remove('is-open');
            });
        };

        const buildAccountMenuHtml = (triggerHref) => `
            <div class="account-menu-inner">
                <div class="account-menu-head">
                    <i class="far fa-user"></i>
                    <span>${t('account_title_prefix')} <strong>IPORDISE</strong></span>
                </div>
                <p class="account-menu-subtitle">${t('account_subtitle')}</p>
                <div class="account-menu-actions">
                    <a href="${triggerHref || '#'}" class="account-menu-btn account-menu-btn-login">${t('account_signin')}</a>
                    <a href="${triggerHref || '#'}" class="account-menu-btn account-menu-btn-signup">${t('account_create')}</a>
                </div>
                <div class="account-menu-row">
                    <i class="fas fa-bolt"></i>
                    <span>${t('account_offer')}</span>
                </div>
                <div class="account-menu-row">
                    <i class="fas fa-truck"></i>
                    <span>${t('account_shipping')}</span>
                </div>
            </div>
        `;

        accountTriggers.forEach((trigger) => {
            const wrap = trigger.parentElement;
            if (!wrap) return;

            wrap.classList.add('header-account-wrap');

            const menu = document.createElement('div');
            menu.className = 'account-menu';
            menu.setAttribute('role', 'dialog');
            menu.setAttribute('aria-label', 'Account menu');
            const triggerHref = trigger.getAttribute('href') || '#';
            menu.innerHTML = buildAccountMenuHtml(triggerHref);

            wrap.appendChild(menu);
            allMenus.push(menu);

            onLanguageChange(() => {
                menu.innerHTML = buildAccountMenuHtml(triggerHref);
            });

            trigger.addEventListener('click', (event) => {
                event.preventDefault();
                const shouldOpen = !menu.classList.contains('is-open');
                closeAllMenus();
                menu.classList.toggle('is-open', shouldOpen);
            });

            menu.addEventListener('click', (event) => {
                event.stopPropagation();
            });
        });

        document.addEventListener('click', (event) => {
            const isAccountArea = event.target.closest('.header-account-wrap');
            if (!isAccountArea) {
                closeAllMenus();
            }
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                closeAllMenus();
            }
        });
    };

    const initWishlistButtons = () => {
        const headerWishlistButtons = document.querySelectorAll('.header-icon-btn[aria-label="Wishlist"]');
        const productFavoriteButtons = Array.from(document.querySelectorAll('button i.fa-heart, button i.far.fa-heart, button i.fas.fa-heart'))
            .map((icon) => icon.closest('button'))
            .filter((button) => button && !button.closest('.header-icon-btn'));

        const storageKey = 'ipordise-wishlist-items';

        const readWishlist = () => {
            try {
                const raw = localStorage.getItem(storageKey);
                const parsed = raw ? JSON.parse(raw) : [];
                return Array.isArray(parsed) ? parsed : [];
            } catch (error) {
                return [];
            }
        };

        const writeWishlist = (items) => {
            localStorage.setItem(storageKey, JSON.stringify(items));
        };

        const wishlistCountLabel = (count) => {
            const singular = t('wishlist_item_single');
            const plural = t('wishlist_item_plural');
            return `${count} ${count === 1 ? singular : plural}`;
        };

        const getFavoriteId = (data) => {
            const seed = `${data.name || ''}-${data.brand || ''}-${data.price || ''}`
                .toLowerCase()
                .replace(/\s+/g, '-')
                .replace(/[^a-z0-9-]/g, '');
            return seed || `product-${Date.now()}`;
        };

        const getWishlistItemCartDetails = (priceText) => {
            const raw = String(priceText || '').trim();
            if (!raw) {
                return {
                    size: 'Default',
                    priceText: '/',
                    unitPrice: 0
                };
            }

            const firstChunk = raw.split('·')[0]?.trim() || raw;
            const match = firstChunk.match(/(\d+\s*ML)\s*([0-9]+(?:[.,][0-9]+)?)\s*DH/i);

            if (match) {
                const size = match[1].replace(/\s+/g, '').toUpperCase();
                const amount = Number(String(match[2]).replace(',', '.'));
                return {
                    size,
                    priceText: `${size} ${Number.isFinite(amount) ? amount : 0}DH`,
                    unitPrice: Number.isFinite(amount) ? amount : parsePriceNumber(firstChunk)
                };
            }

            return {
                size: 'Default',
                priceText: firstChunk,
                unitPrice: parsePriceNumber(firstChunk)
            };
        };

        const findCardForFavoriteButton = (button) => {
            return button.closest('#productCarousel > .group, #newArrivalsCarousel > article, article.group, .js-product-link, .group');
        };

        const syncFavoriteButtonsUI = () => {
            const wishlist = readWishlist();
            const ids = new Set(wishlist.map((item) => item.id));

            productFavoriteButtons.forEach((button) => {
                const favoriteId = button.dataset.favoriteId;
                const isActive = !!favoriteId && ids.has(favoriteId);
                button.classList.toggle('is-active', isActive);
                button.classList.toggle('product-favorite-btn', true);

                const icon = button.querySelector('i');
                if (!icon) return;
                icon.classList.toggle('far', !isActive);
                icon.classList.toggle('fas', isActive);
            });
        };

        const setHeaderWishlistCount = () => {
            const count = readWishlist().length;
            headerWishlistButtons.forEach((button) => {
                button.classList.toggle('is-active', count > 0);
                let badge = button.querySelector('.header-wishlist-badge');

                if (count > 0) {
                    if (!badge) {
                        badge = document.createElement('span');
                        badge.className = 'header-wishlist-badge absolute -top-1.5 -right-2';
                        button.classList.add('relative');
                        button.appendChild(badge);
                    }
                    badge.textContent = String(Math.min(count, 99));
                } else if (badge) {
                    badge.remove();
                }
            });
        };

        const renderWishlistMenu = (menuEl) => {
            const wishlist = readWishlist();
            const listEl = menuEl.querySelector('.wishlist-list');
            const countEl = menuEl.querySelector('.wishlist-menu-count');
            if (!listEl || !countEl) return;

            countEl.textContent = wishlistCountLabel(wishlist.length);

            if (!wishlist.length) {
                listEl.innerHTML = `<div class="wishlist-empty">${t('wishlist_empty')}</div>`;
                return;
            }

            listEl.innerHTML = wishlist.map((item) => `
                <div class="wishlist-item" data-id="${item.id}">
                    <img src="${item.image || ''}" alt="${item.name || t('product_fallback')}">
                    <div class="wishlist-item-copy">
                        <p class="wishlist-item-name">${item.name || t('product_fallback')}</p>
                        <p class="wishlist-item-price">${item.price || t('product_price_on_request')}</p>
                        <button class="wishlist-add-cart" type="button" data-id="${item.id}">${item.price ? 'Add to cart' : 'View product'}</button>
                    </div>
                    <button class="wishlist-remove" type="button" aria-label="${t('wishlist_remove')}">
                        <i class="fas fa-xmark"></i>
                    </button>
                </div>
            `).join('');

            Array.from(listEl.querySelectorAll('.wishlist-add-cart')).forEach((addButton) => {
                addButton.addEventListener('click', (event) => {
                    event.preventDefault();
                    const itemId = addButton.dataset.id;
                    if (!itemId) return;

                    const wishlistItem = readWishlist().find((item) => item.id === itemId);
                    if (!wishlistItem) return;

                    if (!String(wishlistItem.price || '').trim()) {
                        navigateToProductPage(wishlistItem);
                        return;
                    }

                    const cartItems = readCart();
                    const details = getWishlistItemCartDetails(wishlistItem.price);

                    if (details.unitPrice <= 0) {
                        navigateToProductPage(wishlistItem);
                        return;
                    }

                    const existingIndex = cartItems.findIndex((item) => (
                        item.name === wishlistItem.name
                        && item.brand === wishlistItem.brand
                        && item.size === details.size
                    ));

                    if (existingIndex >= 0) {
                        cartItems[existingIndex].quantity = Math.min(99, Number(cartItems[existingIndex].quantity || 1) + 1);
                    } else {
                        cartItems.unshift({
                            id: `${canonicalProductName(wishlistItem.name)}-${canonicalProductName(details.size)}-${Date.now()}`,
                            name: wishlistItem.name,
                            brand: wishlistItem.brand,
                            size: details.size,
                            quantity: 1,
                            priceText: details.priceText,
                            unitPrice: details.unitPrice,
                            image: wishlistItem.image || ''
                        });
                    }

                    writeCart(cartItems);
                    addButton.textContent = 'Added';
                    addButton.disabled = true;
                    window.setTimeout(() => {
                        addButton.textContent = 'Add to cart';
                        addButton.disabled = false;
                    }, 1000);
                });
            });

            Array.from(listEl.querySelectorAll('.wishlist-remove')).forEach((removeButton) => {
                removeButton.addEventListener('click', (event) => {
                    event.preventDefault();
                    const itemEl = removeButton.closest('.wishlist-item');
                    const itemId = itemEl?.dataset.id;
                    if (!itemId) return;

                    const nextWishlist = readWishlist().filter((item) => item.id !== itemId);
                    writeWishlist(nextWishlist);
                    syncFavoriteButtonsUI();
                    setHeaderWishlistCount();
                    renderWishlistMenu(menuEl);
                });
            });
        };

        productFavoriteButtons.forEach((button) => {
            button.classList.add('product-favorite-btn');

            const card = findCardForFavoriteButton(button);
            const data = card ? extractProductDataFromCard(card) : extractCurrentProductData();
            if (!data.name) return;
            const favoriteId = getFavoriteId(data);
            button.dataset.favoriteId = favoriteId;

            button.addEventListener('click', () => {
                const wishlist = readWishlist();
                const exists = wishlist.some((item) => item.id === favoriteId);

                const nextWishlist = exists
                    ? wishlist.filter((item) => item.id !== favoriteId)
                    : [{
                        id: favoriteId,
                        name: data.name,
                        brand: data.brand,
                        price: data.price,
                        image: data.image
                    }, ...wishlist];

                writeWishlist(nextWishlist);
                syncFavoriteButtonsUI();
                setHeaderWishlistCount();

                document.querySelectorAll('.wishlist-menu').forEach((menu) => {
                    if (menu.classList.contains('is-open')) {
                        renderWishlistMenu(menu);
                    }
                });
            });
        });

        if (headerWishlistButtons.length) {
            const allWishlistMenus = [];

            const closeWishlistMenus = () => {
                allWishlistMenus.forEach((menu) => menu.classList.remove('is-open'));
            };

            headerWishlistButtons.forEach((button) => {
                const wrap = button.parentElement;
                if (!wrap) return;

                wrap.classList.add('header-wishlist-wrap');

                const menu = document.createElement('div');
                menu.className = 'wishlist-menu';
                menu.innerHTML = `
                    <div class="wishlist-menu-inner">
                        <div class="wishlist-menu-head">
                            <span class="wishlist-menu-title">${t('wishlist_title')}</span>
                            <span class="wishlist-menu-count">${wishlistCountLabel(0)}</span>
                        </div>
                        <div class="wishlist-list"></div>
                    </div>
                `;

                wrap.appendChild(menu);
                allWishlistMenus.push(menu);

                button.addEventListener('click', (event) => {
                    event.preventDefault();
                    const shouldOpen = !menu.classList.contains('is-open');
                    closeWishlistMenus();
                    if (shouldOpen) {
                        renderWishlistMenu(menu);
                        menu.classList.add('is-open');
                    }
                });

                menu.addEventListener('click', (event) => {
                    event.stopPropagation();
                });

                onLanguageChange(() => {
                    const title = menu.querySelector('.wishlist-menu-title');
                    if (title) {
                        title.textContent = t('wishlist_title');
                    }
                    renderWishlistMenu(menu);
                });
            });

            document.addEventListener('click', (event) => {
                const isWishlistArea = event.target.closest('.header-wishlist-wrap');
                if (!isWishlistArea) {
                    closeWishlistMenus();
                }
            });

            document.addEventListener('keydown', (event) => {
                if (event.key === 'Escape') {
                    closeWishlistMenus();
                }
            });
        }

        syncFavoriteButtonsUI();
        setHeaderWishlistCount();
    };

    const initDiscoverFilters = () => {
        const filterButtons = Array.from(document.querySelectorAll('[data-discover-filter]'));
        const productsGrid = document.querySelector('[data-discover-grid]');
        const countEl = document.querySelector('[data-discover-count]');
        const countLabelEl = document.querySelector('[data-discover-count-label]');
        const paginationEl = document.querySelector('[data-discover-pagination]');

        if (!filterButtons.length || !productsGrid) return;

        const productCards = Array.from(productsGrid.querySelectorAll('.js-product-link'));
        const searchInputs = Array.from(document.querySelectorAll('[data-discover-search]'));
        if (!productCards.length) return;

        const addedIndexMap = new Map(productCards.map((card, index) => [card, index]));

        const emptyState = document.createElement('p');
        emptyState.className = 'col-span-full text-sm sm:text-base text-gray-500 text-center py-8 hidden';
        emptyState.textContent = 'No perfumes found for this category.';
        productsGrid.appendChild(emptyState);

        const setActiveButton = (activeButton) => {
            filterButtons.forEach((button) => {
                button.classList.toggle('is-active', button === activeButton);
            });
        };

        const cardMatchesFilter = (card, filter) => {
            if (!filter || filter === 'all') return true;

            const filters = (card.dataset.filters || '')
                .split(',')
                .map((entry) => entry.trim().toLowerCase())
                .filter(Boolean);

            return filters.includes(filter);
        };

        const cardMatchesQuery = (card, query) => {
            if (!query) return true;
            const priceText = card.querySelector('.price')?.textContent || '';
            const visibleTitle = card.querySelector('.product-title, h3')?.textContent || '';
            const visibleBrand = card.querySelector('p')?.textContent || '';
            const imageAlt = card.querySelector('img')?.getAttribute('alt') || '';
            const haystack = normalizeSearchText([
                card.dataset.productName,
                card.dataset.productBrand,
                card.dataset.id,
                card.dataset.filters,
                card.dataset.productPrice,
                priceText,
                visibleTitle,
                visibleBrand,
                imageAlt
            ].filter(Boolean).join(' '));
            const tokens = normalizeSearchText(query).split(/\s+/).filter(Boolean);
            /* each token must appear somewhere in the haystack (prefix-friendly) */
            return tokens.every((token) => haystack.includes(token));
        };

        const discoverStateKey = 'ipordise-discover-state';
        const readDiscoverState = () => {
            try {
                const raw = sessionStorage.getItem(discoverStateKey);
                return raw ? JSON.parse(raw) : null;
            } catch (error) {
                return null;
            }
        };

        const writeDiscoverState = (state) => {
            try {
                sessionStorage.setItem(discoverStateKey, JSON.stringify(state));
            } catch (error) {
                // Ignore storage errors (private mode or blocked storage).
            }
        };

        let activeFilter = 'all';
        let activeQuery = '';
        let currentPage = 1;
        const getPageSize = () => (window.matchMedia('(max-width: 639px)').matches ? 8 : 12);
        let pageSize = getPageSize();

        const setPaginationVisible = (visible) => {
            if (!paginationEl) return;
            paginationEl.classList.toggle('hidden', !visible);
        };

        const renderPagination = (totalPages) => {
            if (!paginationEl) return;
            if (totalPages <= 1) {
                paginationEl.innerHTML = '';
                setPaginationVisible(false);
                return;
            }

            const parts = [];

            // Prev arrow
            parts.push(`<button type="button" class="discover-page-btn discover-page-arrow${currentPage === 1 ? ' disabled' : ''}" data-discover-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled' : ''} aria-label="Previous page"><i class="fas fa-chevron-left text-[10px]"></i></button>`);

            // Page numbers – show up to 5 centered around current page
            const delta = 2;
            const rangeStart = Math.max(1, currentPage - delta);
            const rangeEnd = Math.min(totalPages, currentPage + delta);

            if (rangeStart > 1) {
                parts.push(`<button type="button" class="discover-page-btn" data-discover-page="1">1</button>`);
                if (rangeStart > 2) parts.push(`<span class="px-1 text-gray-400 text-xs self-center">&hellip;</span>`);
            }
            for (let p = rangeStart; p <= rangeEnd; p += 1) {
                parts.push(`<button type="button" class="discover-page-btn${p === currentPage ? ' is-active' : ''}" data-discover-page="${p}">${p}</button>`);
            }
            if (rangeEnd < totalPages) {
                if (rangeEnd < totalPages - 1) parts.push(`<span class="px-1 text-gray-400 text-xs self-center">&hellip;</span>`);
                parts.push(`<button type="button" class="discover-page-btn" data-discover-page="${totalPages}">${totalPages}</button>`);
            }

            // Next arrow
            parts.push(`<button type="button" class="discover-page-btn discover-page-arrow${currentPage === totalPages ? ' disabled' : ''}" data-discover-page="${currentPage + 1}" ${currentPage === totalPages ? 'disabled' : ''} aria-label="Next page"><i class="fas fa-chevron-right text-[10px]"></i></button>`);

            paginationEl.innerHTML = parts.join('');
            setPaginationVisible(true);

            paginationEl.querySelectorAll('[data-discover-page]').forEach((button) => {
                button.addEventListener('click', () => {
                    const nextPage = Number(button.dataset.discoverPage || 1);
                    if (Number.isFinite(nextPage) && nextPage >= 1 && nextPage <= totalPages) {
                        currentPage = nextPage;
                        applyFilter();
                        const gridTop = productsGrid.getBoundingClientRect().top + window.scrollY - 80;
                        window.scrollTo({ top: gridTop, behavior: 'smooth' });
                    }
                });
            });
        };

        const shuffleCards = (cards) => {
            const shuffled = cards.slice();
            for (let index = shuffled.length - 1; index > 0; index -= 1) {
                const swapIndex = Math.floor(Math.random() * (index + 1));
                [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
            }
            return shuffled;
        };

        const getCardKey = (card) => {
            const nameKey = canonicalProductName(card.dataset.productName || '');
            const brandKey = canonicalProductName(card.dataset.productBrand || '');
            return `${nameKey}|${brandKey}`;
        };

        const getOrderKey = () => {
            const queryKey = normalizeSearchText(activeQuery || '');
            return `ipordise-discover-order:${activeFilter}:${queryKey}`;
        };

        const getShuffledVisible = (cards) => {
            const orderKey = getOrderKey();
            const cardMap = new Map(cards.map((card) => [getCardKey(card), card]));
            let storedOrder = [];

            try {
                const raw = sessionStorage.getItem(orderKey);
                storedOrder = raw ? JSON.parse(raw) : [];
            } catch (error) {
                storedOrder = [];
            }

            if (Array.isArray(storedOrder) && storedOrder.length) {
                const ordered = storedOrder.map((key) => cardMap.get(key)).filter(Boolean);
                const missing = cards.filter((card) => !storedOrder.includes(getCardKey(card)));
                const combined = ordered.concat(missing);
                return combined.length ? combined : cards.slice();
            }

            const shuffled = shuffleCards(cards);
            try {
                sessionStorage.setItem(orderKey, JSON.stringify(shuffled.map((card) => getCardKey(card))));
            } catch (error) {
                // Ignore storage errors (private mode or blocked storage).
            }
            return shuffled;
        };

        const applyFilter = () => {
            const visibleCards = [];
            const hiddenCards = [];

            productCards.forEach((card) => {
                const shouldShow = cardMatchesFilter(card, activeFilter)
                    && cardMatchesQuery(card, activeQuery);
                if (shouldShow) {
                    visibleCards.push(card);
                } else {
                    hiddenCards.push(card);
                }
            });

            const orderedVisible = (activeFilter === 'new-in' || activeFilter === '2026')
                ? visibleCards
                    .slice()
                    .sort((a, b) => getCardAddedScore(b, addedIndexMap.get(b)) - getCardAddedScore(a, addedIndexMap.get(a)))
                    .slice(0, activeFilter === 'new-in' ? 15 : undefined)
                : getShuffledVisible(visibleCards);

            const totalPages = Math.max(1, Math.ceil(orderedVisible.length / pageSize));
            if (currentPage > totalPages) currentPage = 1;

            const startIndex = (currentPage - 1) * pageSize;
            const pageSlice = orderedVisible.slice(startIndex, startIndex + pageSize);

            productCards.forEach((card) => {
                const shouldShow = pageSlice.includes(card);
                card.classList.toggle('hidden', !shouldShow);
            });

            [...pageSlice, ...orderedVisible.filter((card) => !pageSlice.includes(card)), ...hiddenCards].forEach((card) => {
                productsGrid.appendChild(card);
            });
            productsGrid.appendChild(emptyState);

            emptyState.classList.toggle('hidden', orderedVisible.length !== 0);

            if (countEl) {
                countEl.textContent = String(orderedVisible.length);
            }

            if (countLabelEl) {
                countLabelEl.textContent = `product${orderedVisible.length === 1 ? '' : 's'} available`;
            }

            renderPagination(totalPages);

            writeDiscoverState({
                path: window.location.pathname,
                filter: activeFilter,
                query: activeQuery,
                page: currentPage,
                scrollY: window.scrollY
            });
        };

        const scrollToGrid = () => {
            const gridTop = productsGrid.getBoundingClientRect().top + window.scrollY - 80;
            window.scrollTo({ top: gridTop, behavior: 'smooth' });
        };

        filterButtons.forEach((button) => {
            button.addEventListener('click', () => {
                const filter = (button.dataset.discoverFilter || 'all').toLowerCase();
                setActiveButton(button);
                activeFilter = filter;
                currentPage = 1;
                applyFilter();
                scrollToGrid();
            });
        });

        searchInputs.forEach((input) => {
            input.addEventListener('input', (event) => {
                activeQuery = event.target.value || '';
                currentPage = 1;
                searchInputs.forEach((peer) => {
                    if (peer !== event.target) {
                        peer.value = event.target.value;
                    }
                });
                applyFilter();
            });
        });

        const allowedFilters = new Set(['all', 'new-in', 'best-sellers', 'for-men', 'for-women', 'unisex', 'niche', 'arabian', 'designer', 'discovery-sets', 'offers', '2026']);
        const urlParams = new URLSearchParams(window.location.search);
        const urlFilterRaw = urlParams.get('filter') || '';
        const urlQueryRaw = urlParams.get('q') || '';
        const urlFilter = urlFilterRaw.toLowerCase().trim();
        const initialFilter = allowedFilters.has(urlFilter) ? urlFilter : 'all';

        const savedState = readDiscoverState();
        const canRestoreState = savedState && savedState.path === window.location.pathname;
        const savedFilter = canRestoreState && allowedFilters.has(savedState.filter) ? savedState.filter : null;
        const savedQuery = canRestoreState ? String(savedState.query || '') : '';
        const savedPage = canRestoreState && Number.isFinite(savedState.page) ? Number(savedState.page) : 1;

        const hasUrlFilter = allowedFilters.has(urlFilter);
        const preferredFilter = hasUrlFilter ? urlFilter : (savedFilter || initialFilter);
        const defaultButton = filterButtons.find((button) => (button.dataset.discoverFilter || '').toLowerCase() === preferredFilter)
            || filterButtons.find((button) => button.classList.contains('bg-brand-dark'))
            || filterButtons[0];

        setActiveButton(defaultButton);
        activeFilter = (defaultButton.dataset.discoverFilter || 'all').toLowerCase();
        /* When arriving via a direct URL filter link, ignore any saved search query/page
           so the user sees clean results for the chosen filter. */
        activeQuery = hasUrlFilter ? (urlQueryRaw || '') : (savedQuery || urlQueryRaw || '');
        currentPage = hasUrlFilter ? 1 : (savedPage || 1);
        if (activeQuery) {
            searchInputs.forEach((input) => {
                input.value = activeQuery;
            });
            /* Only open the mobile search panel and focus when there is an actual query */
            const mobileSearchPanel = document.querySelector('.header-mobile-search');
            if (mobileSearchPanel) {
                mobileSearchPanel.classList.add('is-open');
                mobileSearchPanel.setAttribute('aria-hidden', 'false');
            }
            const mobileInput = mobileSearchPanel
                ? mobileSearchPanel.querySelector('input[type="text"]')
                : null;
            const targetInput = mobileInput || searchInputs[0];
            if (targetInput) {
                targetInput.focus({ preventScroll: true });
                const length = targetInput.value.length;
                targetInput.setSelectionRange(length, length);
            }
        }
        applyFilter();

        if (canRestoreState && Number.isFinite(savedState.scrollY)) {
            window.requestAnimationFrame(() => {
                window.scrollTo({ top: savedState.scrollY, behavior: 'auto' });
            });
        } else if (urlFilter && allowedFilters.has(urlFilter)) {
            // Arrived via a filter link (e.g. ?filter=2026) — scroll to the grid
            window.requestAnimationFrame(() => scrollToGrid());
        }

        let scrollSaveTimer = null;
        window.addEventListener('scroll', () => {
            if (scrollSaveTimer) window.clearTimeout(scrollSaveTimer);
            scrollSaveTimer = window.setTimeout(() => {
                writeDiscoverState({
                    path: window.location.pathname,
                    filter: activeFilter,
                    query: activeQuery,
                    page: currentPage,
                    scrollY: window.scrollY
                });
            }, 120);
        }, { passive: true });

        window.addEventListener('resize', () => {
            const nextPageSize = getPageSize();
            if (nextPageSize !== pageSize) {
                pageSize = nextPageSize;
                currentPage = 1;
                applyFilter();
            }
        });
    };

    const buildCartItemHtml = (item) => {
        const totalPrice = Number(item.unitPrice || 0) * Number(item.quantity || 1);
        return `
            <article class="cart-card bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 shadow-sm" data-cart-id="${item.id}">
                <div class="flex flex-col sm:flex-row gap-4 sm:gap-5">
                    <img src="${item.image || ''}" alt="${item.name || 'Product'}" class="cart-item-image w-full sm:w-28 h-28 object-contain bg-brand-light rounded-xl">
                    <div class="flex-1 min-w-0">
                        <div class="flex justify-between gap-3">
                            <div>
                                <p class="text-[11px] font-bold tracking-widest text-gray-500 uppercase">${item.brand || 'IPORDISE'}</p>
                                <h2 class="font-semibold text-brand-dark text-base leading-tight mt-1">${item.name || 'Product'}</h2>
                                <p class="text-xs text-gray-500 mt-1">Size: ${item.size || '-'}</p>
                            </div>
                        </div>
                        <div class="mt-4 flex flex-wrap items-center justify-between gap-3">
                            <div class="inline-flex items-center rounded-full border border-gray-200 overflow-hidden">
                                <span class="cart-qty-value text-gray-900 px-4 py-2 text-sm">Qty ${Math.max(1, Number(item.quantity || 1))}</span>
                            </div>
                            <div class="text-right">
                                <p class="text-xs text-gray-500">Unit: ${item.priceText || formatMad(item.unitPrice || 0)}</p>
                                <p class="text-lg font-bold text-brand-dark">${formatMad(totalPrice)}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </article>
        `;
    };

    const summarizeCart = (items) => {
        const subtotal = items.reduce((sum, item) => sum + (Number(item.unitPrice || 0) * Number(item.quantity || 1)), 0);
        const shipping = subtotal === 0 ? 0 : 35;
        const promo = 0;
        const tax = 0;
        const total = Math.max(0, subtotal + shipping);

        return { subtotal, shipping, promo, tax, total };
    };

    const initCartPage = () => {
        if (window.__IPORDISE_DEDICATED_CART__) return;

        const isCartPage = window.location.pathname.replace(/\\/g, '/').endsWith('/pages/cart.html');
        if (!isCartPage) return;

        const cartItemsContainer = document.getElementById('cartItemsContainer');
        if (!cartItemsContainer) return;

        const items = readCart();
        const cartCountText = document.getElementById('cartCountText');

        if (!items.length) {
            cartItemsContainer.innerHTML = `
                <article class="cart-card bg-white rounded-2xl border border-gray-100 p-6 shadow-sm text-center text-gray-600">
                    Your cart is empty. Go back and select a size to add your fragrance.
                </article>
            `;
            if (cartCountText) {
                cartCountText.textContent = '0 products selected.';
            }
        } else {
            cartItemsContainer.innerHTML = items.map((item) => buildCartItemHtml(item)).join('');
            const totalQuantity = items.reduce((sum, item) => sum + Math.max(1, Number(item.quantity || 1)), 0);
            if (cartCountText) {
                cartCountText.textContent = `${totalQuantity} product${totalQuantity > 1 ? 's' : ''} selected for your signature routine.`;
            }
        }

        const summary = summarizeCart(items);
        const subtotalEl = document.getElementById('cartSubtotal');
        const shippingEl = document.getElementById('cartShipping');
        const taxEl = document.getElementById('cartTax');
        const promoEl = document.getElementById('cartPromo');
        const totalEl = document.getElementById('cartTotal');

        if (subtotalEl) subtotalEl.textContent = formatMad(summary.subtotal);
        if (shippingEl) shippingEl.textContent = summary.shipping === 0 ? '0 MAD' : '35 MAD (VAT incl.)';
        if (taxEl) taxEl.textContent = summary.shipping === 0 ? '0 MAD' : 'Included in shipping';
        if (promoEl) promoEl.textContent = formatMad(summary.promo);
        if (totalEl) totalEl.textContent = formatMad(summary.total);
    };

    const initCheckoutPage = () => {
        if (window.__IPORDISE_DEDICATED_CHECKOUT__) return;

        const isCheckoutPage = window.location.pathname.replace(/\\/g, '/').endsWith('/pages/checkout.html');
        if (!isCheckoutPage) return;

        const orderItemsEl = document.getElementById('checkoutOrderItems');
        if (!orderItemsEl) return;

        const items = readCart();
        orderItemsEl.innerHTML = items.length
            ? items.map((item) => {
                const isPricePending = Boolean(item.pricePending) || !(item.unitPrice > 0);
                const itemTotal = isPricePending ? 0 : Number(item.unitPrice || 0) * Number(item.quantity || 1);
                return `
                    <div class="flex items-start justify-between gap-3 pb-3 border-b border-gray-100">
                        <div>
                            <p class="font-semibold text-gray-800">${item.name || 'Product'}</p>
                            <p class="text-xs text-gray-500">${item.size || '-'} · Qty ${Math.max(1, Number(item.quantity || 1))}</p>
                        </div>
                        <span class="font-semibold">${isPricePending ? 'Pending confirmation' : formatMad(itemTotal)}</span>
                    </div>
                `;
            }).join('')
            : '<p class="text-sm text-gray-500 pb-3 border-b border-gray-100">No items in cart yet.</p>';

        const summary = summarizeCart(items);
        const subtotalEl = document.getElementById('checkoutSubtotal');
        const shippingEl = document.getElementById('checkoutShipping');
        const promoEl = document.getElementById('checkoutPromo');
        const totalEl = document.getElementById('checkoutTotal');

        if (subtotalEl) subtotalEl.textContent = formatMad(summary.subtotal);
        if (shippingEl) shippingEl.textContent = summary.shipping === 0 ? '0 MAD' : '35 MAD (VAT incl.)';
        if (promoEl) promoEl.textContent = formatMad(summary.promo);
        if (totalEl) totalEl.textContent = formatMad(summary.total);
    };

    const getCarouselSnapItems = (carousel) => {
        if (!carousel) return [];

        return Array.from(carousel.children).filter((node) => {
            if (!(node instanceof HTMLElement)) return false;
            if (node.offsetWidth <= 0) return false;
            return true;
        });
    };

    const getCenteredScrollLeftForItem = (carousel, item) => {
        if (!carousel || !item) return 0;

        const maxScrollLeft = Math.max(0, carousel.scrollWidth - carousel.clientWidth);
        const targetLeft = item.offsetLeft - ((carousel.clientWidth - item.offsetWidth) / 2);
        return Math.max(0, Math.min(maxScrollLeft, targetLeft));
    };

    const getNearestCarouselItemIndex = (carousel, items, bias = 0) => {
        if (!carousel || !items.length) return -1;

        const viewportCenter = carousel.scrollLeft + (carousel.clientWidth / 2) + bias;
        let nearestIndex = 0;
        let nearestDistance = Number.POSITIVE_INFINITY;

        items.forEach((item, index) => {
            const itemCenter = item.offsetLeft + (item.offsetWidth / 2);
            const distance = Math.abs(itemCenter - viewportCenter);
            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearestIndex = index;
            }
        });

        return nearestIndex;
    };

    const snapCarouselToNearestItem = (carousel, options = {}) => {
        if (!carousel) return;

        const items = getCarouselSnapItems(carousel);
        if (!items.length) return;

        const nearestIndex = getNearestCarouselItemIndex(carousel, items, options.bias || 0);
        const targetItem = items[nearestIndex];
        if (!targetItem) return;

        const targetLeft = getCenteredScrollLeftForItem(carousel, targetItem);
        if (Math.abs(carousel.scrollLeft - targetLeft) < 1) return;

        carousel.scrollTo({
            left: targetLeft,
            behavior: options.behavior || 'smooth'
        });
    };

    const scrollCarouselToSiblingItem = (carousel, direction) => {
        if (!carousel) return;

        const items = getCarouselSnapItems(carousel);
        if (!items.length) return;

        const directionSign = direction === 'prev' ? -1 : 1;
        const bias = directionSign * Math.max(24, carousel.clientWidth * 0.08);
        const currentIndex = getNearestCarouselItemIndex(carousel, items, bias);
        const nextIndex = Math.max(0, Math.min(items.length - 1, currentIndex + directionSign));
        const targetItem = items[nextIndex];
        if (!targetItem) return;

        // When navigating to the last card, scroll to the very end so it's fully visible
        const isLast = nextIndex === items.length - 1;
        const maxScrollLeft = Math.max(0, carousel.scrollWidth - carousel.clientWidth);
        const targetLeft = isLast ? maxScrollLeft : getCenteredScrollLeftForItem(carousel, targetItem);

        carousel.scrollTo({
            left: targetLeft,
            behavior: 'smooth'
        });
    };

    const bindDragScroll = (carousel, onInteract) => {
        if (!carousel) return;

        let isDragging = false;
        let dragStartX = 0;
        let startScrollLeft = 0;
        let movedDuringDrag = false;
        let snapTimerId = 0;
        let scrollEndTimerId = 0;
        let touchStartX = 0;
        let touchLastX = 0;
        let touchStartTime = 0;
        let touchLastTime = 0;
        let touchGestureMoved = false;
        let touchStartIndex = -1;
        let pendingTouchTargetIndex = -1;
        const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;

        carousel.style.cursor = isCoarsePointer ? 'auto' : 'grab';

        const clearSnapTimer = () => {
            if (!snapTimerId) return;
            window.clearTimeout(snapTimerId);
            snapTimerId = 0;
        };

        const clearScrollEndTimer = () => {
            if (!scrollEndTimerId) return;
            window.clearTimeout(scrollEndTimerId);
            scrollEndTimerId = 0;
        };

        const snapToItemIndex = (targetIndex, behavior = 'smooth') => {
            const items = getCarouselSnapItems(carousel);
            if (!items.length) return;

            const clampedIndex = Math.max(0, Math.min(items.length - 1, targetIndex));
            const targetItem = items[clampedIndex];
            if (!targetItem) return;

            const targetLeft = getCenteredScrollLeftForItem(carousel, targetItem);
            if (Math.abs(carousel.scrollLeft - targetLeft) < 1) return;

            carousel.scrollTo({
                left: targetLeft,
                behavior
            });
        };

        const queueSnap = (delay = 90) => {
            clearSnapTimer();

            snapTimerId = window.setTimeout(() => {
                snapTimerId = 0;
                if (pendingTouchTargetIndex >= 0) {
                    snapToItemIndex(pendingTouchTargetIndex);
                    pendingTouchTargetIndex = -1;
                    return;
                }

                snapCarouselToNearestItem(carousel);
            }, delay);
        };

        const queueSnapAfterScrollSettles = (delay = 110) => {
            clearScrollEndTimer();
            scrollEndTimerId = window.setTimeout(() => {
                scrollEndTimerId = 0;
                if (isDragging) return;
                queueSnap(0);
            }, delay);
        };

        const startDragging = (clientX) => {
            isDragging = true;
            movedDuringDrag = false;
            dragStartX = clientX;
            startScrollLeft = carousel.scrollLeft;
            pendingTouchTargetIndex = -1;
            clearSnapTimer();
            clearScrollEndTimer();
            carousel.style.cursor = 'grabbing';
            carousel.classList.add('is-dragging-carousel');
            onInteract?.();
        };

        const updateDragging = (clientX) => {
            if (!isDragging) return;
            const delta = clientX - dragStartX;
            if (Math.abs(delta) > 6) {
                movedDuringDrag = true;
            }
            carousel.scrollLeft = startScrollLeft - delta;
        };

        carousel.addEventListener('mousedown', (event) => {
            if (event.button !== 0) return;
            startDragging(event.clientX);
            event.preventDefault();
        });

        window.addEventListener('mousemove', (event) => {
            updateDragging(event.clientX);
        });

        carousel.addEventListener('touchstart', (event) => {
            const touch = event.touches?.[0];
            const items = getCarouselSnapItems(carousel);

            touchStartX = touch?.clientX || 0;
            touchLastX = touchStartX;
            touchStartTime = performance.now();
            touchLastTime = touchStartTime;
            touchGestureMoved = false;
            touchStartIndex = items.length ? getNearestCarouselItemIndex(carousel, items) : -1;
            pendingTouchTargetIndex = -1;
            clearSnapTimer();
            clearScrollEndTimer();
            onInteract?.();
        }, { passive: true });

        carousel.addEventListener('touchmove', (event) => {
            const touch = event.touches?.[0];
            if (!touch) return;

            touchLastX = touch.clientX;
            touchLastTime = performance.now();
            if (Math.abs(touchLastX - touchStartX) > 10) {
                touchGestureMoved = true;
            }
        }, { passive: true });

        carousel.addEventListener('touchend', () => {
            const items = getCarouselSnapItems(carousel);
            const referenceItem = touchStartIndex >= 0 ? items[touchStartIndex] : items[0];
            const itemWidth = referenceItem?.offsetWidth || carousel.clientWidth || 1;
            const elapsed = Math.max(touchLastTime - touchStartTime, 1);
            const deltaX = touchLastX - touchStartX;
            const velocityX = deltaX / elapsed; // px/ms
            // Lower threshold: 40px or 15% card width, or velocity > 0.25 px/ms
            const shouldAdvance = Math.abs(deltaX) > Math.min(40, itemWidth * 0.15) || Math.abs(velocityX) > 0.25;

            if (items.length && touchGestureMoved && shouldAdvance) {
                const direction = deltaX < 0 ? 1 : -1;
                const baseIndex = touchStartIndex >= 0
                    ? touchStartIndex
                    : getNearestCarouselItemIndex(carousel, items);
                // Fast flick (velocity > 0.7 px/ms) → advance 2 cards at once
                const steps = Math.abs(velocityX) > 0.7 ? 2 : 1;
                pendingTouchTargetIndex = Math.max(0, Math.min(items.length - 1, baseIndex + direction * steps));
            }

            // Reduced delay (50ms) so snap feels instant after finger lifts
            queueSnapAfterScrollSettles(50);
        }, { passive: true });

        carousel.addEventListener('touchcancel', () => {
            pendingTouchTargetIndex = -1;
            queueSnapAfterScrollSettles(50);
        }, { passive: true });

        const stopDragging = () => {
            if (!isDragging) return;
            isDragging = false;
            carousel.style.cursor = isCoarsePointer ? 'auto' : 'grab';
            carousel.classList.remove('is-dragging-carousel');
            if (movedDuringDrag) {
                queueSnapAfterScrollSettles(50);
            }
        };

        window.addEventListener('mouseup', stopDragging);
        carousel.addEventListener('mouseleave', stopDragging);

        carousel.addEventListener('scroll', () => {
            if (isDragging) return;
            queueSnapAfterScrollSettles(isCoarsePointer ? 60 : 90);
        }, { passive: true });

        carousel.addEventListener('click', (event) => {
            if (!movedDuringDrag) return;
            event.preventDefault();
            event.stopPropagation();
            movedDuringDrag = false;
        }, true);
    };

    const setupCarouselEdgeState = (carousel) => {
        if (!carousel) return;
        const shell = carousel.closest('.carousel-shell');
        if (!shell) return;

        const update = () => {
            const atStart = carousel.scrollLeft <= 4;
            const atEnd = carousel.scrollLeft >= carousel.scrollWidth - carousel.clientWidth - 4;
            shell.classList.toggle('is-at-start', atStart);
            shell.classList.toggle('is-at-end', atEnd);
        };

        carousel.addEventListener('scroll', update, { passive: true });
        window.addEventListener('resize', update);
        // Defer initial check until after browser has completed layout and paint
        requestAnimationFrame(() => requestAnimationFrame(update));
    };

    const setupCarouselIndicator = (carouselId) => {
        const carousel = document.getElementById(carouselId);
        const indicator = document.querySelector(`[data-carousel-indicator="${carouselId}"]`);
        const fill = indicator?.querySelector('[data-carousel-fill]');
        if (!carousel || !indicator || !fill) return;

        const updateIndicator = () => {
            const maxScrollLeft = Math.max(0, carousel.scrollWidth - carousel.clientWidth);
            const thumbPercent = Math.max(18, Math.min(55, (carousel.clientWidth / Math.max(carousel.scrollWidth, 1)) * 100));
            const progress = maxScrollLeft === 0 ? 0 : carousel.scrollLeft / maxScrollLeft;
            const leftPercent = progress * (100 - thumbPercent);

            fill.style.width = `${thumbPercent}%`;
            fill.style.left = `${leftPercent}%`;
        };

        indicator.addEventListener('click', (event) => {
            const rect = indicator.getBoundingClientRect();
            if (!rect.width) return;
            const clickRatio = (event.clientX - rect.left) / rect.width;
            const maxScrollLeft = Math.max(0, carousel.scrollWidth - carousel.clientWidth);

            carousel.scrollTo({
                left: maxScrollLeft * Math.max(0, Math.min(1, clickRatio)),
                behavior: 'smooth'
            });
        });

        carousel.addEventListener('scroll', updateIndicator, { passive: true });
        window.addEventListener('resize', updateIndicator);
        updateIndicator();
    };

    const shuffleFlashOffersDaily = () => {
        const carousel = document.getElementById('productCarousel');
        if (!carousel) return;

        const cards = Array.from(carousel.children).filter((node) => node.nodeType === 1);
        if (!cards.length) return;

        const dateKey = new Date().toISOString().slice(0, 10);
        const storageKey = `ipordise-flash-offers-order-${dateKey}`;
        const getCardKey = (card) => {
            const nameKey = canonicalProductName(card.dataset.productName || card.textContent || '');
            const brandKey = canonicalProductName(card.dataset.productBrand || '');
            return `${nameKey}|${brandKey}`;
        };

        const tryGetStoredOrder = () => {
            try {
                const raw = localStorage.getItem(storageKey);
                return raw ? JSON.parse(raw) : null;
            } catch (error) {
                return null;
            }
        };

        const saveOrder = (order) => {
            try {
                localStorage.setItem(storageKey, JSON.stringify(order));
            } catch (error) {
                // Ignore storage errors (private mode or blocked storage).
            }
        };

        const seededShuffle = (items, seedText) => {
            let seed = 0;
            for (let index = 0; index < seedText.length; index += 1) {
                seed = ((seed << 5) - seed) + seedText.charCodeAt(index);
                seed |= 0;
            }

            let t = Math.abs(seed) + 0x6D2B79F5;
            const rand = () => {
                t += 0x6D2B79F5;
                let r = t;
                r = Math.imul(r ^ (r >>> 15), r | 1);
                r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
                return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
            };

            const shuffled = items.slice();
            for (let index = shuffled.length - 1; index > 0; index -= 1) {
                const swapIndex = Math.floor(rand() * (index + 1));
                [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
            }
            return shuffled;
        };

        const cardMap = new Map(cards.map((card) => [getCardKey(card), card]));
        const storedOrder = tryGetStoredOrder();

        let orderedCards = [];
        if (Array.isArray(storedOrder) && storedOrder.length) {
            orderedCards = storedOrder.map((key) => cardMap.get(key)).filter(Boolean);
            const missing = cards.filter((card) => !storedOrder.includes(getCardKey(card)));
            orderedCards = orderedCards.concat(missing);
        } else {
            orderedCards = seededShuffle(cards, dateKey);
            saveOrder(orderedCards.map((card) => getCardKey(card)));
        }

        orderedCards.forEach((card) => {
            carousel.appendChild(card);
        });
    };

    const initCarousel = (carouselId) => {
        const carousel = document.getElementById(carouselId);
        if (!carousel) return;

        bindDragScroll(carousel);
        setupCarouselEdgeState(carousel);
        setupCarouselIndicator(carouselId);
    };

    const initCarouselDepthEffect = (carouselId) => {
        const carousel = document.getElementById(carouselId);
        if (!carousel || carouselId !== 'productCarousel' || carousel.dataset.depthBound === 'true') return;

        const cards = Array.from(carousel.children).filter((node) => node.nodeType === 1 && node.matches('.js-product-link'));
        if (!cards.length) return;

        carousel.dataset.depthBound = 'true';
        carousel.classList.add('carousel-depth-ready');

        const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        let animationFrameId = 0;

        const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

        const resetCardDepth = (card, depthState = 'near') => {
            card.dataset.depthState = depthState;
            card.style.setProperty('--carousel-card-lift', '0px');
            card.style.setProperty('--carousel-card-shift', '0px');
            card.style.setProperty('--carousel-card-z', '0px');
            card.style.setProperty('--carousel-card-rotate-y', '0deg');
            card.style.setProperty('--carousel-card-rotate-x', '0deg');
            card.style.setProperty('--carousel-card-scale', '1');
            card.style.setProperty('--carousel-card-opacity', '1');
            card.style.setProperty('--carousel-card-saturate', '1');
            card.style.setProperty('--carousel-card-blur', '0px');
            card.style.setProperty('--carousel-card-shadow-alpha', depthState === 'active' ? '0.17' : '0.1');
            card.style.setProperty('--carousel-card-border-alpha', depthState === 'active' ? '0.14' : '0.08');
        };

        const applyDepth = () => {
            animationFrameId = 0;

            const viewportCenter = carousel.scrollLeft + (carousel.clientWidth / 2);
            // Batch all layout reads first, before any writes
            const cardMetrics = cards.map((card) => {
                const cardWidth = card.offsetWidth;
                const cardCenter = card.offsetLeft + (cardWidth / 2);
                const distance = cardCenter - viewportCenter;
                return {
                    card,
                    cardWidth,
                    distance,
                    absoluteDistance: Math.abs(distance)
                };
            });

            const activeMetric = cardMetrics.reduce((closest, metric) => {
                if (!closest || metric.absoluteDistance < closest.absoluteDistance) return metric;
                return closest;
            }, null);

            if (!activeMetric) return;

            const activeThreshold = Math.max(220, activeMetric.cardWidth * 1.12);

            cardMetrics.forEach(({ card, cardWidth, distance, absoluteDistance }) => {
                if (reducedMotionQuery.matches) {
                    resetCardDepth(card, card === activeMetric.card ? 'active' : 'near');
                    return;
                }

                const normalized = clamp(distance / Math.max(cardWidth * 1.08, 1), -1.35, 1.35);
                const focus = 1 - Math.min(Math.abs(normalized), 1);
                const rotateY = normalized * -9.5;
                const rotateX = Math.abs(normalized) * 2.6;
                const lift = -11 * focus;
                const shift = normalized * -4.5;
                const zDepth = 28 * focus;
                const scale = 0.955 + (focus * 0.06);
                const opacity = 0.76 + (focus * 0.24);
                const saturate = 0.92 + (focus * 0.14);
                const blur = 0;
                const shadowAlpha = 0.08 + (focus * 0.07);
                const borderAlpha = 0.07 + (focus * 0.05);
                const depthState = absoluteDistance <= (activeThreshold * 0.42)
                    ? 'active'
                    : absoluteDistance <= activeThreshold
                        ? 'near'
                        : 'far';

                card.dataset.depthState = depthState;
                card.style.setProperty('--carousel-card-lift', `${lift.toFixed(2)}px`);
                card.style.setProperty('--carousel-card-shift', `${shift.toFixed(2)}px`);
                card.style.setProperty('--carousel-card-z', `${zDepth.toFixed(2)}px`);
                card.style.setProperty('--carousel-card-rotate-y', `${rotateY.toFixed(2)}deg`);
                card.style.setProperty('--carousel-card-rotate-x', `${rotateX.toFixed(2)}deg`);
                card.style.setProperty('--carousel-card-scale', scale.toFixed(3));
                card.style.setProperty('--carousel-card-opacity', opacity.toFixed(3));
                card.style.setProperty('--carousel-card-saturate', saturate.toFixed(3));
                card.style.setProperty('--carousel-card-blur', `${blur.toFixed(2)}px`);
                card.style.setProperty('--carousel-card-shadow-alpha', shadowAlpha.toFixed(3));
                card.style.setProperty('--carousel-card-border-alpha', borderAlpha.toFixed(3));
            });
        };

        const requestDepthUpdate = () => {
            if (animationFrameId) return;
            animationFrameId = window.requestAnimationFrame(applyDepth);
        };

        carousel.addEventListener('scroll', requestDepthUpdate, { passive: true });
        window.addEventListener('resize', requestDepthUpdate);

        if (typeof reducedMotionQuery.addEventListener === 'function') {
            reducedMotionQuery.addEventListener('change', requestDepthUpdate);
        } else if (typeof reducedMotionQuery.addListener === 'function') {
            reducedMotionQuery.addListener(requestDepthUpdate);
        }

        requestDepthUpdate();
        window.setTimeout(requestDepthUpdate, 120);
    };

    const enableCarouselAutoplay = (carouselId, step = 160, delay = 2600) => {
        const carousel = document.getElementById(carouselId);
        if (!carousel) return;

        let paused = false;

        const scrollNext = () => {
            if (paused) return;

            const maxScrollLeft = Math.max(0, carousel.scrollWidth - carousel.clientWidth);
            if (maxScrollLeft <= 0) return;

            const nextLeft = carousel.scrollLeft + step;
            if (nextLeft >= maxScrollLeft - 8) {
                carousel.scrollTo({ left: 0, behavior: 'smooth' });
                return;
            }

            carousel.scrollTo({
                left: nextLeft,
                behavior: 'smooth'
            });
        };

        carousel.addEventListener('mouseenter', () => {
            paused = true;
        });

        carousel.addEventListener('mouseleave', () => {
            paused = false;
        });

        carousel.addEventListener('touchstart', () => {
            paused = true;
        }, { passive: true });

        carousel.addEventListener('touchend', () => {
            window.setTimeout(() => {
                paused = false;
            }, 1200);
        });

        window.setInterval(scrollNext, delay);
    };

    const bindSectionCarouselNav = (sectionId, carouselId) => {
        const section = document.getElementById(sectionId);
        if (!section) return;

        const carousel = section.querySelector(`#${carouselId}`);
        const prevButton = section.querySelector(`[data-carousel-nav="${carouselId}"][data-direction="prev"]`);
        const nextButton = section.querySelector(`[data-carousel-nav="${carouselId}"][data-direction="next"]`);
        if (!carousel || !prevButton || !nextButton) return;

        const scrollCarousel = (direction) => {
            scrollCarouselToSiblingItem(carousel, direction);
        };

        prevButton.addEventListener('click', () => scrollCarousel('prev'));
        nextButton.addEventListener('click', () => scrollCarousel('next'));
    };

    shuffleFlashOffersDaily();
    const limitNewArrivalsToLatest = () => {
        const carousel = document.getElementById('newArrivalsCarousel');
        if (!carousel) return;
        const cards = Array.from(carousel.querySelectorAll('article'));
        if (!cards.length) return;

        const indexMap = new Map(cards.map((card, index) => [card, index]));
        const sorted = cards
            .slice()
            .sort((a, b) => getCardAddedScore(b, indexMap.get(b)) - getCardAddedScore(a, indexMap.get(a)));
        const latest = sorted.slice(0, 8);

        carousel.innerHTML = '';
        latest.forEach((card) => {
            carousel.appendChild(card);
        });
    };

    const populate2026Section = () => {
        const track = document.getElementById('carousel2026');
        if (!track) return;

        // ── 2026 release catalogue ──────────────────────────────────────────
        // Products confirmed in stock for 2026 — sorted by arrival date, newest first.
        const catalog2026 = [
            {
                name: 'Jean Paul Gaultier Le Male In Blue Eau de Parfum',
                brand: 'JEAN PAUL GAULTIER',
                id: 'jean-paul-gaultier-le-male-in-blue-eau-de-parfum',
                image: 'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Jean%20Paul%20Gaultier%20Le%20Male%20In%20Blue%20Eau%20de%20Parfum/1.jpg',
                price: '',
                sizes: ['75ML', '125ML'],
                added: '2026-01-15'
            },
            {
                name: 'Valentino Born in Roma Extradose Eau de Toilette',
                brand: 'VALENTINO',
                id: 'valentino-born-in-roma-extradose-eau-de-toilette',
                image: 'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Valentino%20Born%20in%20Rome%20Extradose/1.jpg',
                price: '',
                sizes: ['50ML', '100ML'],
                added: '2026-01-01'
            },
            {
                name: 'Jean Paul Gaultier Scandal Elixir',
                brand: 'JEAN PAUL GAULTIER',
                id: 'jean-paul-gaultier-scandal-elixir',
                image: 'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Jean%20Paul%20Gaultier%20Scandal%20Elixir/1.jpg',
                price: '',
                sizes: ['75ML', '125ML'],
                added: '2025-11-01'
            },
            {
                name: 'Jean Paul Gaultier Le Male Eau de Toilette',
                brand: 'JEAN PAUL GAULTIER',
                id: 'jean-paul-gaultier-le-male-eau-de-toilette',
                image: 'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Le%20Male%20Eau%20de%20Toilette/1.png',
                price: '',
                sizes: ['75ML', '125ML'],
                added: '2025-09-01'
            },
            {
                name: 'Armani Stronger With You Powerfully Eau de Parfum',
                brand: 'GIORGIO ARMANI',
                id: 'armani-stronger-with-you-powerfully-eau-de-parfum',
                image: 'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Armani%20Stronger%20With%20You%20Powerfully%20Eau%20de%20Parfum/1.webp',
                price: '',
                sizes: ['50ML', '100ML'],
                added: '2025-08-01'
            }
        ];
        // ── end catalogue ───────────────────────────────────────────────────

        // Sort newest first
        catalog2026.sort((a, b) => b.added.localeCompare(a.added));

        const buildCard = (p, index) => {
            const sizesAttr = p.sizes.join('|');
            const sizesHTML = p.sizes
                .map((s) => `<span class="card-2026-size">${s}</span>`)
                .join('');
            const priceHTML = p.price
                ? `<p class="card-2026-price"><i class="fas fa-tag card-2026-price-icon"></i>${p.price}</p>`
                : '';
            const favoriteId = `${p.id}-${p.brand.toLowerCase().replace(/\s+/g, '-')}-`;
            return `<article class="card-2026 js-product-link cursor-pointer card-2026-init"
                    data-product-name="${p.name}"
                    data-product-brand="${p.brand}"
                    data-product-image="${p.image}"
                    data-product-price="${p.price}"
                    data-product-old-price=""
                    data-product-discount=""
                    data-product-reviews="0"
                    data-id="${p.id}"
                    data-added="${p.added}"
                    data-product-sizes="${sizesAttr}"
                    tabindex="0"
                    style="--stagger:${index}">
                    <span class="card-2026-badge" data-i18n="index.class2026_badge">New 2026</span>
                    <button class="card-2026-wish js-wishlist-btn product-favorite-btn" aria-label="Add to wishlist" data-favorite-id="${favoriteId}"><i class="far fa-heart"></i></button>
                    <div class="card-2026-img-wrap">
                        <img src="${p.image}" alt="${p.name}" loading="lazy" width="200" height="200">
                    </div>
                    <div class="card-2026-body">
                        <p class="card-2026-brand">${p.brand}</p>
                        <p class="card-2026-name">${p.name}</p>
                        ${priceHTML}
                        <div class="card-2026-sizes">${sizesHTML}</div>
                        <div class="card-2026-footer">
                            <button class="card-2026-btn js-card-add-btn js-add-to-cart-btn">
                                <i class="fas fa-cart-plus" style="margin-right:0.45em;font-size:0.82em;opacity:0.9"></i>
                                <span data-i18n="index.add_to_cart">Add to Cart</span>
                            </button>
                        </div>
                    </div>
                </article>`;
        };

        track.innerHTML = catalog2026.map((p, i) => buildCard(p, i)).join('\n');

        // Build dot indicators to match the number of cards
        const dotsContainer = document.getElementById('carousel2026Dots');
        if (dotsContainer) {
            dotsContainer.innerHTML = catalog2026.map((_, i) =>
                `<button class="carousel-dot${i === 0 ? ' is-active' : ''}" aria-label="Go to fragrance ${i + 1}"></button>`
            ).join('');
        }

        // Staggered entrance animation via IntersectionObserver
        if ('IntersectionObserver' in window) {
            const io = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        const card = entry.target;
                        const stagger = parseInt(card.style.getPropertyValue('--stagger') || '0', 10);
                        window.setTimeout(() => card.classList.add('card-2026-in'), Math.min(stagger * 60, 480));
                        io.unobserve(card);
                    }
                });
            }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
            track.querySelectorAll('.card-2026-init').forEach((c) => io.observe(c));
        } else {
            track.querySelectorAll('.card-2026-init').forEach((c) => c.classList.add('card-2026-in'));
        }
    };

    populate2026Section();
    limitNewArrivalsToLatest();

    /* Eagerly load all images inside the main product carousel so they are
       ready instantly when the user swipes — lazy loading breaks on horizontal
       off-screen cards because the browser never triggers the load. */
    document.querySelectorAll('#productCarousel img').forEach((img) => {
        img.loading = 'eager';
        img.decoding = 'async';
    });

    initCarousel('productCarousel');
    initCarousel('brandCarousel');
    initCarousel('newArrivalsCarousel');
    enableCarouselAutoplay('brandCarousel', 180, 2400);
    bindSectionCarouselNav('flashOffersSection', 'productCarousel');
    bindSectionCarouselNav('newArrivalsSection', 'newArrivalsCarousel');
    bindSectionCarouselNav('class2026Section', 'carousel2026');

    // ── Carousel position reset ──────────────────────────────────────────
    // Runs AFTER all carousel inits (bindDragScroll + setupCarouselEdgeState).
    // Two nested RAFs ensure layout is fully committed before the reset fires,
    // overriding scroll-anchor compensation or CSS snap drift.
    // behavior:'instant' bypasses scroll-behavior:smooth so there is no
    // visible slide animation from a previous position to 0.
    const resetCarouselPositions = () => {
        ['productCarousel', 'newArrivalsCarousel'].forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.scrollTo({ left: 0, behavior: 'instant' });
        });
    };
    requestAnimationFrame(() => requestAnimationFrame(resetCarouselPositions));

    // bfcache restore: DOMContentLoaded does NOT re-fire when the browser
    // restores a page from the back/forward cache, so we must reset here too.
    window.addEventListener('pageshow', (e) => {
        if (e.persisted) {
            requestAnimationFrame(() => requestAnimationFrame(resetCarouselPositions));
        }
    });

    // 2026 carousel: drag scroll + 3D mouse tilt
    const carousel2026El = document.getElementById('carousel2026');
    if (carousel2026El) {
        bindDragScroll(carousel2026El);
    }

    const testimonialCarousel = document.getElementById('testimonialCarousel');
    const testimonialPrev = document.getElementById('testimonialPrev');
    const testimonialNext = document.getElementById('testimonialNext');

    if (testimonialCarousel) {
        bindDragScroll(testimonialCarousel);

        const getStep = () => Math.max(280, Math.round(testimonialCarousel.clientWidth * 0.82));

        if (testimonialPrev) {
            testimonialPrev.addEventListener('click', () => {
                testimonialCarousel.scrollBy({
                    left: -getStep(),
                    behavior: 'smooth'
                });
            });
        }

        if (testimonialNext) {
            testimonialNext.addEventListener('click', () => {
                testimonialCarousel.scrollBy({
                    left: getStep(),
                    behavior: 'smooth'
                });
            });
        }

    }

    const initBrandLogoDotAnimation = () => {
        const logos = document.querySelectorAll('.brand-logo-animated');
        if (!logos.length) return;

        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const animationStartDelayMs = 0;
        const dotDuration = 7600;
        const idleDelayMs = 30000;
        const holdOffset = 0.11;
        const hopWindow = 0.67;

        logos.forEach((logo) => {
            if (logo.dataset.brandDotReady === 'true') return;

            const word = logo.querySelector('.brand-logo-word');
            const dot = logo.querySelector('.brand-logo-dot');
            const letters = Array.from(logo.querySelectorAll('.brand-logo-letter'));

            if (!word || !dot || letters.length !== 8) return;

            logo.dataset.brandDotReady = 'true';

            // Lock opacity to 1 after entry animation so hover/click can't revert to base opacity:0
            letters.forEach((letter) => {
                letter.addEventListener('animationend', () => {
                    letter.style.opacity = '1';
                }, { once: true });
            });

            let currentAnimation;
            let resizeTimer;
            let letterLoopTimer;
            let startDelayTimer;
            let letterLiftTimeouts = [];
            let activeLetterAnimations = [];

            const computePositions = () => {
                const logoRect = logo.getBoundingClientRect();
                const wordRect = word.getBoundingClientRect();
                const dotRect = dot.getBoundingClientRect();

                const baseX = (wordRect.right - logoRect.left) + Math.max(2, dotRect.width * 0.18);
                const baseY = (wordRect.bottom - logoRect.top) - dotRect.height * 0.92;

                const points = letters.map((letter) => {
                    const letterRect = letter.getBoundingClientRect();
                    const jumpX = (letterRect.left + letterRect.width / 2) - logoRect.left - dotRect.width / 2;
                    const jumpTopY = (letterRect.top - logoRect.top) - dotRect.height * 1.1;
                    const settleY = jumpTopY + dotRect.height * 0.34;
                    return {
                        x: jumpX,
                        topY: jumpTopY,
                        settleY
                    };
                });

                return {
                    baseX,
                    baseY,
                    points
                };
            };

            const applyStaticDot = () => {
                const { baseX, baseY } = computePositions();
                dot.style.transform = `translate3d(${baseX}px, ${baseY}px, 0)`;
            };

            const clearPendingLetterTimeouts = () => {
                letterLiftTimeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
                letterLiftTimeouts = [];
            };

            const clearLetterAnimations = () => {
                activeLetterAnimations.forEach((animation) => {
                    try {
                        animation.cancel();
                    } catch (_) {
                        // No-op
                    }
                });
                activeLetterAnimations = [];
                letters.forEach((letter) => {
                    letter.style.transform = 'translate3d(0, 0, 0)';
                });
            };

            const clearLetterLoop = () => {
                clearPendingLetterTimeouts();
                clearLetterAnimations();
                if (startDelayTimer) {
                    window.clearTimeout(startDelayTimer);
                    startDelayTimer = undefined;
                }
                if (letterLoopTimer) {
                    window.clearTimeout(letterLoopTimer);
                    letterLoopTimer = undefined;
                }
            };

            const animateLetterLift = (letter) => {
                const fontSize = parseFloat(window.getComputedStyle(letter).fontSize) || 28;
                const liftPx = Math.min(10, Math.max(5, fontSize * 0.24));

                const animation = letter.animate([
                    { transform: 'translate3d(0, 0, 0)', offset: 0 },
                    { transform: `translate3d(0, -${liftPx}px, 0)`, offset: 0.38 },
                    { transform: 'translate3d(0, 0, 0)', offset: 1 }
                ], {
                    duration: 520,
                    easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
                    fill: 'none'
                });

                activeLetterAnimations.push(animation);
                animation.onfinish = () => {
                    activeLetterAnimations = activeLetterAnimations.filter((entry) => entry !== animation);
                };
                animation.oncancel = () => {
                    activeLetterAnimations = activeLetterAnimations.filter((entry) => entry !== animation);
                };
            };

            const scheduleLetterLifts = () => {
                clearPendingLetterTimeouts();
                clearLetterAnimations();

                const segment = hopWindow / letters.length;

                letters.forEach((letter, index) => {
                    const touchOffset = holdOffset + segment * index + segment * 0.42;
                    const delay = Math.round(dotDuration * touchOffset);

                    const timeoutId = window.setTimeout(() => {
                        animateLetterLift(letter);
                    }, delay);

                    letterLiftTimeouts.push(timeoutId);
                });
            };

            const runAnimationOnce = () => {
                const { baseX, baseY, points } = computePositions();

                if (!points.length) {
                    dot.style.transform = `translate3d(${baseX}px, ${baseY}px, 0)`;
                    return;
                }

                if (currentAnimation) {
                    currentAnimation.cancel();
                }

                const keyframes = [
                    {
                        offset: 0,
                        transform: `translate3d(${baseX}px, ${baseY}px, 0)`,
                        easing: 'cubic-bezier(0.22, 1, 0.36, 1)'
                    },
                    {
                        offset: 0.11,
                        transform: `translate3d(${baseX}px, ${baseY}px, 0)`,
                        easing: 'cubic-bezier(0.22, 1, 0.36, 1)'
                    }
                ];

                const segment = hopWindow / points.length;

                points.forEach((point, index) => {
                    const segmentStart = 0.11 + segment * index;
                    const apexOffset = segmentStart + segment * 0.4;
                    const settleOffset = segmentStart + segment * 0.8;

                    keyframes.push({
                        offset: apexOffset,
                        transform: `translate3d(${point.x}px, ${point.topY}px, 0)`,
                        easing: 'cubic-bezier(0.22, 1, 0.36, 1)'
                    });

                    keyframes.push({
                        offset: settleOffset,
                        transform: `translate3d(${point.x}px, ${point.settleY}px, 0)`,
                        easing: 'cubic-bezier(0.33, 1, 0.68, 1)'
                    });
                });

                const lastPoint = points[points.length - 1];

                keyframes.push(
                    {
                        offset: 0.84,
                        transform: `translate3d(${lastPoint.x}px, ${lastPoint.settleY}px, 0)`,
                        easing: 'cubic-bezier(0.2, 0.9, 0.2, 1)'
                    },
                    {
                        offset: 0.93,
                        transform: `translate3d(${baseX}px, ${Math.max(baseY - 2, 0)}px, 0)`,
                        easing: 'cubic-bezier(0.33, 1, 0.68, 1)'
                    },
                    {
                        offset: 1,
                        transform: `translate3d(${baseX}px, ${baseY}px, 0)`
                    }
                );

                currentAnimation = dot.animate(keyframes, {
                    duration: dotDuration,
                    iterations: 1,
                    fill: 'both'
                });

                scheduleLetterLifts();
                if (letterLoopTimer) {
                    window.clearTimeout(letterLoopTimer);
                }
                letterLoopTimer = window.setTimeout(() => {
                    clearLetterAnimations();
                }, dotDuration);

                currentAnimation.onfinish = () => {
                    applyStaticDot();
                    startDelayTimer = window.setTimeout(runAnimationOnce, idleDelayMs);
                };
            };

            if (prefersReducedMotion) {
                clearLetterLoop();
                applyStaticDot();
                return;
            }

            // Show dot immediately in its final static position, then animate
            applyStaticDot();
            if (currentAnimation) {
                currentAnimation.cancel();
                currentAnimation = undefined;
            }
            startDelayTimer = window.setTimeout(() => {
                runAnimationOnce();
            }, animationStartDelayMs);

            window.addEventListener('resize', () => {
                window.clearTimeout(resizeTimer);
                resizeTimer = window.setTimeout(() => {
                    if (currentAnimation) {
                        runAnimationOnce();
                        return;
                    }
                    applyStaticDot();
                }, 150);
            }, { passive: true });
        });
    };

    const initMobileSearchToggle = () => {
        const toggleButtons = Array.from(document.querySelectorAll('.header-search-btn'));
        const mobileSearch = document.querySelector('.header-mobile-search');
        if (!toggleButtons.length || !mobileSearch) return;

        const input = mobileSearch.querySelector('input[type="text"]');

        const openSearch = () => {
            mobileSearch.classList.add('is-open');
            mobileSearch.setAttribute('aria-hidden', 'false');
            if (input) {
                input.focus();
                const valueLength = input.value.length;
                input.setSelectionRange(valueLength, valueLength);
            }
        };

        const closeSearch = () => {
            mobileSearch.classList.remove('is-open');
            mobileSearch.setAttribute('aria-hidden', 'true');
        };

        toggleButtons.forEach((button) => {
            button.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                if (mobileSearch.classList.contains('is-open')) {
                    closeSearch();
                } else {
                    openSearch();
                }
            });
        });

        document.addEventListener('click', (event) => {
            if (!mobileSearch.contains(event.target) && !event.target.closest('.header-search-btn')) {
                closeSearch();
            }
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                closeSearch();
            }
        });
    };

    /* ═══════════════════════════════════════════════════════════════
       SEARCH OVERLAY — full-width Druni-style search panel
       ═══════════════════════════════════════════════════════════════ */
    const initSearchOverlay = () => {
        const overlay   = document.getElementById('ipoSearchOverlay');
        const bodyEl    = document.getElementById('ipoSearchOverlayBody');
        const input     = document.getElementById('ipoSearchOverlayInput');
        const clearBtn  = document.getElementById('ipoSearchOverlayClear');
        const closeBtn  = document.getElementById('ipoSearchOverlayClose');
        const backdrop  = document.getElementById('ipoSearchOverlayBackdrop');
        if (!overlay || !input) return;

        const pagePath = window.location.pathname.replace(/\\/g, '/');
        const discoverPath = pagePath.includes('/pages/') ? '../discover.html' : 'discover.html';

        const goDiscover = (query, filter) => {
            const params = new URLSearchParams();
            if (query && query.trim()) params.set('q', query.trim());
            if (filter && filter.trim()) params.set('filter', filter.trim());
            window.location.href = `${discoverPath}${params.toString() ? '?' + params.toString() : ''}`;
        };

        const popularSearches = [
            'Valentino', 'Xerjoff', 'Armani', 'Dior', 'Creed',
            'Tom Ford', 'Rabanne', 'Givenchy', 'Vanilla',
            'Oud & Rose', 'Blue Fragrances', 'For Women'
        ];

        let catalogCache = null;
        const buildCatalog = () => {
            const catalog = [];
            const seen = new Set();
            // Use .js-product-link[data-id] to catch every product card on the page,
            // regardless of class name or parent carousel
            document.querySelectorAll('.js-product-link[data-id]').forEach((card) => {
                const data = extractProductDataFromCard(card);
                const key = (data.name || '').toLowerCase() + '|' + (data.brand || '').toLowerCase();
                if (!data.name || seen.has(key)) return;
                seen.add(key);
                catalog.push(data);
            });
            if (Array.isArray(relatedProductCatalog)) {
                relatedProductCatalog.forEach((item) => {
                    const key = (item.name || '').toLowerCase() + '|' + (item.brand || '').toLowerCase();
                    if (!item.name || seen.has(key)) return;
                    seen.add(key);
                    catalog.push({ name: item.name, brand: item.brand, price: item.price, image: item.image });
                });
            }
            return catalog;
        };
        const getCatalog = () => { if (!catalogCache) catalogCache = buildCatalog(); return catalogCache; };

        const norm = (s) => String(s || '').toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')   // strip accents: é→e, â→a
            .replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();

        /* synonym map — query word → replacement word(s) */
        const SYNONYMS = {
            'blue':    'bleu',
            'bleu':    'blue',
            'sauvage': 'sauvage',
            'savauge': 'sauvage',
            'savag':   'sauvage',
            'homme':   'homme',
            'man':     'homme',
            'men':     'homme',
            'woman':   'femme',
            'women':   'femme',
            'lady':    'femme',
            'ladies':  'femme',
            'noir':    'noir',
            'black':   'noir',
            'rouge':   'rouge',
            'red':     'rouge',
            'or':      'or',
            'gold':    'or',
            'intense': 'intense',
            'absolut': 'absolu',
            'absolute':'absolu',
            'extreme': 'extreme',
            'elixr':   'elixir',
            '1m':      'one million',
            'million': 'one million',
            'eros':    'eros',
            'eross':   'eros',
        };

        /* expand query tokens with synonyms */
        const expandTokens = (tokens) => {
            const expanded = [];
            for (const t of tokens) {
                expanded.push(t);
                if (SYNONYMS[t] && SYNONYMS[t] !== t) expanded.push(...SYNONYMS[t].split(' '));
            }
            return [...new Set(expanded)];
        };

        /* bigram similarity 0-1 */
        const bigrams = (s) => { const b = new Set(); for (let i = 0; i < s.length - 1; i++) b.add(s.slice(i, i + 2)); return b; };
        const bigramSim = (a, b) => { const ba = bigrams(a), bb = bigrams(b); if (!ba.size || !bb.size) return 0; let n = 0; ba.forEach((g) => { if (bb.has(g)) n++; }); return (2 * n) / (ba.size + bb.size); };

        /* score how well one token matches a haystack string */
        const tokenScore = (token, hay, hayWords) => {
            if (hay === token) return 120;               // exact full match
            if (hayWords.includes(token)) return 110;   // exact word match
            if (hay.startsWith(token)) return 100;      // hay starts with token
            if (hayWords.some((w) => w.startsWith(token))) return 85; // word starts with token
            if (hay.includes(token)) return 70;          // substring anywhere
            if (hayWords.some((w) => w.includes(token))) return 55;  // token in a word
            if (token.length >= 3) {
                const sim = bigramSim(token, hay);
                if (sim >= 0.45) return Math.round(sim * 50); // fuzzy bigram
            }
            return 0;
        };

        /* get notes string for a product name */
        const notesForProduct = (name) => {
            const key = norm(name);
            const entry = typeof mainAccordCatalog !== 'undefined' && mainAccordCatalog
                ? Object.entries(mainAccordCatalog).find(([k]) => norm(k) === key)
                : null;
            return entry ? entry[1].join(' ') : '';
        };

        const searchCatalog = (q) => {
            const normQ = norm(q);
            const rawTokens = normQ.split(/\s+/).filter(Boolean);
            if (!rawTokens.length) return [];
            const tokens = expandTokens(rawTokens);

            return getCatalog()
                .map((item) => {
                    const nameN   = norm(item.name);
                    const brandN  = norm(item.brand);
                    const notesN  = norm(notesForProduct(item.name));
                    const nameWords  = nameN.split(/\s+/);
                    const brandWords = brandN.split(/\s+/);
                    const notesWords = notesN.split(/\s+/);

                    let totalScore = 0;
                    let matchedTokens = 0;

                    for (const token of tokens) {
                        // Score against name, brand, and notes — take best
                        const ns = tokenScore(token, nameN,  nameWords);
                        const bs = tokenScore(token, brandN, brandWords);
                        const ks = notesN ? tokenScore(token, notesN, notesWords) * 0.6 : 0; // notes = lower priority
                        const best = Math.max(ns, bs, ks);
                        if (best > 0) { totalScore += best; matchedTokens++; }
                    }

                    if (matchedTokens === 0) return null;

                    // Penalty when not all tokens match (partial query still works but ranks lower)
                    // Coverage based on original query tokens, not expanded synonyms
                    const coverage = matchedTokens / rawTokens.length;
                    totalScore *= (0.4 + 0.6 * coverage);

                    // Boost: the full query string hits somewhere
                    if (nameN.includes(normQ) || brandN.includes(normQ)) totalScore += 40;
                    // Boost: name or brand starts with full query
                    if (nameN.startsWith(normQ) || brandN.startsWith(normQ)) totalScore += 25;

                    return { item, score: totalScore };
                })
                .filter(Boolean)
                .sort((a, b) => b.score - a.score)
                .map(({ item }) => item)
                .slice(0, 12);
        };

        const fmtPrice = (v) => {
            const n = Number(String(v || '').replace(/[^\d.,]/g, '').replace(',', '.'));
            return Number.isFinite(n) && n > 0 ? n.toFixed(2) + ' MAD' : '';
        };

        /* ── Render default: popular searches + product cards ── */
        const renderDefault = () => {
            const featured = getCatalog();
            bodyEl.className = 'ipo-search-overlay-body';
            bodyEl.innerHTML =
                '<div class="ipo-search-popular">' +
                    '<span class="ipo-search-section-label">Popular searches</span>' +
                    '<div class="ipo-search-popular-list">' +
                        popularSearches.map((s) => '<button type="button" class="ipo-search-popular-btn" data-popular="' + s + '">' + s + '</button>').join('') +
                    '</div>' +
                '</div>' +
                '<div class="ipo-search-products">' +
                    '<span class="ipo-search-section-label">Recommended products</span>' +
                    '<div class="ipo-search-products-scroll">' +
                        featured.map((item) =>
                            '<button type="button" class="ipo-search-prod-card" data-prod-name="' + (item.name || '').replace(/"/g, '&quot;') + '" data-prod-brand="' + (item.brand || '').replace(/"/g, '&quot;') + '">' +
                                '<div class="ipo-search-prod-img-wrap">' +
                                    '<img src="' + (item.image || '') + '" alt="" class="ipo-search-prod-img" loading="lazy" />' +
                                '</div>' +
                                '<span class="ipo-search-prod-brand">' + (item.brand || '') + '</span>' +
                                '<span class="ipo-search-prod-name">' + (item.name || '') + '</span>' +
                                (fmtPrice(item.price) ? '<span class="ipo-search-prod-price">' + fmtPrice(item.price) + '</span>' : '') +
                            '</button>'
                        ).join('') +
                    '</div>' +
                '</div>';
            /* Smooth momentum drag-scroll for desktop */
            const scrollEl = bodyEl.querySelector('.ipo-search-products-scroll');
            if (scrollEl && !scrollEl._dragBound) {
                scrollEl._dragBound = true;
                let isDown = false, startX, scrollLeft, velX = 0, lastX, lastT, rafId;

                const momentum = () => {
                    if (Math.abs(velX) < 0.5) return;
                    scrollEl.scrollLeft += velX;
                    velX *= 0.92;
                    rafId = requestAnimationFrame(momentum);
                };

                scrollEl.addEventListener('mousedown', (e) => {
                    cancelAnimationFrame(rafId);
                    isDown = true;
                    startX = e.pageX;
                    scrollLeft = scrollEl.scrollLeft;
                    lastX = e.pageX;
                    lastT = Date.now();
                    velX = 0;
                    scrollEl.style.userSelect = 'none';
                    scrollEl.style.scrollSnapType = 'none';
                });

                const endDrag = () => {
                    if (!isDown) return;
                    isDown = false;
                    scrollEl.style.userSelect = '';
                    scrollEl.style.scrollSnapType = '';
                    rafId = requestAnimationFrame(momentum);
                };

                scrollEl.addEventListener('mouseleave', endDrag);
                scrollEl.addEventListener('mouseup', endDrag);

                scrollEl.addEventListener('mousemove', (e) => {
                    if (!isDown) return;
                    e.preventDefault();
                    const now = Date.now();
                    const dt = Math.max(now - lastT, 1);
                    velX = (lastX - e.pageX) / dt * 16;
                    lastX = e.pageX;
                    lastT = now;
                    scrollEl.scrollLeft = scrollLeft + (startX - e.pageX);
                });

                /* Prevent click on children after a drag */
                scrollEl.addEventListener('click', (e) => {
                    if (Math.abs(scrollEl.scrollLeft - scrollLeft) > 4) e.stopPropagation();
                }, { capture: true });
            }
        };

        /* ── Render results ── */
        const renderResults = (q) => {
            const results = searchCatalog(q);
            bodyEl.className = 'ipo-search-overlay-body is-results';
            const label = results.length
                ? results.length + ' result' + (results.length > 1 ? 's' : '') + ' for \u201c' + q + '\u201d'
                : 'No results for \u201c' + q + '\u201d';
            bodyEl.innerHTML =
                '<div class="ipo-search-results">' +
                    '<span class="ipo-search-section-label">' + label + '</span>' +
                    (results.length
                        ? '<div class="ipo-search-results-list">' +
                            results.map((item) =>
                                '<button type="button" class="ipo-search-result-row" data-prod-name="' + (item.name || '').replace(/"/g, '&quot;') + '" data-prod-brand="' + (item.brand || '').replace(/"/g, '&quot;') + '">' +
                                    '<img src="' + (item.image || '') + '" alt="" class="ipo-search-result-thumb" loading="lazy" />' +
                                    '<span class="ipo-search-result-text">' +
                                        '<span class="ipo-search-result-name">' + (item.name || '') + '</span>' +
                                        '<span class="ipo-search-result-brand">' + (item.brand || '') + '</span>' +
                                    '</span>' +
                                    (fmtPrice(item.price) ? '<span class="ipo-search-result-price">' + fmtPrice(item.price) + '</span>' : '') +
                                '</button>'
                            ).join('') +
                          '</div>'
                        : '<p class="ipo-search-no-results">Try a brand name, a note like \u201cvanilla\u201d, or a style like \u201cblue fragrance\u201d.</p>'
                    ) +
                    '<div class="ipo-search-view-all-wrap">' +
                        '<button type="button" class="ipo-search-view-all-btn" data-view-all="' + q.replace(/"/g, '&quot;') + '">View all results for \u201c' + q + '\u201d &rarr;</button>' +
                    '</div>' +
                '</div>';
        };

        /* ── Open / Close ── */
        let rendered = false;
        const openOverlay = () => {
            overlay.classList.add('is-open');
            overlay.setAttribute('aria-hidden', 'false');
            document.body.style.overflow = 'hidden';
            if (!rendered) { rendered = true; renderDefault(); }
            else if (!input.value.trim()) renderDefault();
            requestAnimationFrame(() => { try { input.focus(); } catch (e) {} });
        };
        const closeOverlay = () => {
            overlay.classList.remove('is-open');
            overlay.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = '';
        };

        window.ipoOpenSearchOverlay = openOverlay;

        /* ── Input events ── */
        input.addEventListener('input', () => {
            const val = input.value.trim();
            clearBtn.classList.toggle('is-visible', val.length > 0);
            if (val.length >= 1) { renderResults(val); }
            else { renderDefault(); }
        });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const trimmed = input.value.trim();
                closeOverlay();
                goDiscover(trimmed || '', trimmed ? '' : 'all');
            }
            if (e.key === 'Escape') closeOverlay();
        });
        clearBtn.addEventListener('click', () => {
            input.value = '';
            clearBtn.classList.remove('is-visible');
            renderDefault();
            input.focus();
        });
        closeBtn.addEventListener('click', closeOverlay);
        backdrop.addEventListener('click', closeOverlay);

        /* ── Delegate clicks inside body ── */
        bodyEl.addEventListener('click', (e) => {
            const pop = e.target.closest('[data-popular]');
            if (pop) {
                input.value = pop.dataset.popular;
                clearBtn.classList.add('is-visible');
                renderResults(pop.dataset.popular);
                input.focus();
                return;
            }
            const card = e.target.closest('[data-prod-name]');
            if (card) {
                closeOverlay();
                navigateToProductPage({ name: card.dataset.prodName, brand: card.dataset.prodBrand });
                return;
            }
            const viewAll = e.target.closest('[data-view-all]');
            if (viewAll) { closeOverlay(); goDiscover(viewAll.dataset.viewAll); }
        });

        /* ── Intercept ALL search trigger points ── */
        document.addEventListener('click', (e) => {
            if (e.target.closest('.ipo-search-trigger-btn')) { openOverlay(); }
        });
        document.addEventListener('click', (e) => {
            if (e.target.closest('.header-search-btn')) {
                e.preventDefault();
                e.stopImmediatePropagation();
                openOverlay();
            }
        }, { capture: true });
        document.addEventListener('click', (e) => {
            if (e.target.closest('#ipoBnavSearch')) { openOverlay(); }
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && overlay.classList.contains('is-open')) closeOverlay();
        });
    };

    const disableInspectTools = () => {
        document.addEventListener('contextmenu', (event) => {
            event.preventDefault();
        }, { capture: true });

        document.addEventListener('keydown', (event) => {
            const key = (event.key || '').toLowerCase();
            const ctrlOrMeta = event.ctrlKey || event.metaKey;
            const shift = event.shiftKey;

            const blockDevToolsCombo = key === 'f12'
                || (ctrlOrMeta && shift && (key === 'i' || key === 'j' || key === 'c'))
                || (ctrlOrMeta && (key === 'u' || key === 's'));

            if (!blockDevToolsCombo) return;

            event.preventDefault();
            event.stopImmediatePropagation();
        }, { capture: true });
    };

    const initSocialVideoSwitcher = () => {
        const section = document.getElementById('socialVideoSection');
        if (!section) return;

        const frame = section.querySelector('#socialVideoFrame');
        const links = Array.from(section.querySelectorAll('.js-social-video-link[data-video-src]'));
        if (!frame || !links.length) return;

        const activeClasses = ['border-brand-red', 'bg-red-50', 'text-brand-red'];
        const inactiveClasses = ['border-gray-300', 'text-gray-700'];

        const setActiveLink = (activeLink) => {
            links.forEach((link) => {
                const isActive = link === activeLink;
                link.classList.toggle('border-brand-red', isActive);
                link.classList.toggle('bg-red-50', isActive);
                link.classList.toggle('text-brand-red', isActive);
                link.classList.toggle('border-gray-300', !isActive);
                link.classList.toggle('text-gray-700', !isActive);
                link.setAttribute('aria-pressed', isActive ? 'true' : 'false');
            });
        };

        const placeholder = section.querySelector('#socialVideoPlaceholder');

        links.forEach((link) => {
            link.addEventListener('click', (event) => {
                event.preventDefault();

                const nextVideoSrc = (link.getAttribute('data-video-src') || '').trim();
                if (nextVideoSrc && frame.getAttribute('src') !== nextVideoSrc) {
                    frame.setAttribute('src', nextVideoSrc);
                    if (placeholder) placeholder.style.display = 'none';
                }

                setActiveLink(link);

                frame.scrollIntoView({
                    behavior: 'smooth',
                    block: 'nearest'
                });
            });
        });

        const preselectedLink = links.find((link) => link.classList.contains('bg-red-50')) || links[0];
        if (preselectedLink) {
            setActiveLink(preselectedLink);
        }
    };

    const initLoginLegalConsent = () => {
        const isLoginPage = window.location.pathname.replace(/\\/g, '/').endsWith('/pages/login.html');
        if (!isLoginPage) return;

        const accountStorageKey = 'ipordise-accounts';
        const currentAccountStorageKey = 'ipordise-current-account';
        const loginForm = document.getElementById('loginForm');
        const signupForm = document.getElementById('signupForm');
        const loginConsentCheckbox = document.getElementById('loginLegalConsent');
        const loginSubmitButton = document.getElementById('loginSubmitBtn');
        const loginConsentMessage = document.getElementById('loginLegalConsentMessage');
        const loginMessage = document.getElementById('loginFormMessage');
        const loginEmailInput = document.getElementById('loginEmailInput');
        const loginPasswordInput = document.getElementById('loginPasswordInput');
        const loginRememberMe = document.getElementById('loginRememberMe');
        const signupConsentCheckbox = document.getElementById('signupLegalConsent');
        const signupSubmitButton = document.getElementById('signupSubmitBtn');
        const signupConsentMessage = document.getElementById('signupLegalConsentMessage');
        const signupMessage = document.getElementById('signupFormMessage');
        const signupFirstNameInput = document.getElementById('signupFirstNameInput');
        const signupLastNameInput = document.getElementById('signupLastNameInput');
        const signupEmailInput = document.getElementById('signupEmailInput');
        const signupPasswordInput = document.getElementById('signupPasswordInput');
        const signupConfirmPasswordInput = document.getElementById('signupConfirmPasswordInput');
        const modeButtons = Array.from(document.querySelectorAll('[data-auth-mode]'));
        const modePanels = Array.from(document.querySelectorAll('[data-auth-panel]'));
        const modeSwitches = Array.from(document.querySelectorAll('[data-auth-switch]'));
        const passwordToggles = Array.from(document.querySelectorAll('[data-password-toggle]'));

        if (!loginForm || !signupForm || !loginConsentCheckbox || !signupConsentCheckbox || !loginSubmitButton || !signupSubmitButton) return;

        const readAccounts = () => {
            try {
                const raw = JSON.parse(localStorage.getItem(accountStorageKey) || '[]');
                return Array.isArray(raw) ? raw : [];
            } catch (error) {
                return [];
            }
        };

        const writeAccounts = (accounts) => {
            localStorage.setItem(accountStorageKey, JSON.stringify(accounts));
        };

        const writeCurrentAccount = (account, rememberMe) => {
            const storage = rememberMe ? localStorage : sessionStorage;
            const payload = {
                firstName: account.firstName,
                lastName: account.lastName,
                email: account.email,
                signedInAt: Date.now()
            };
            storage.setItem(currentAccountStorageKey, JSON.stringify(payload));
            if (rememberMe) {
                sessionStorage.removeItem(currentAccountStorageKey);
            }
        };

        const setFormMessage = (element, text, tone) => {
            if (!element) return;
            if (!text) {
                element.textContent = '';
                element.classList.add('hidden');
                element.classList.remove('is-error', 'is-success');
                return;
            }

            element.textContent = text;
            element.classList.remove('hidden', 'is-error', 'is-success');
            element.classList.add(tone === 'success' ? 'is-success' : 'is-error');
        };

        const setButtonState = (button, isEnabled) => {
            button.disabled = !isEnabled;
            button.setAttribute('aria-disabled', String(!isEnabled));
            button.classList.toggle('opacity-50', !isEnabled);
            button.classList.toggle('cursor-not-allowed', !isEnabled);
        };

        const activateAuthMode = (mode) => {
            modeButtons.forEach((button) => {
                const isActive = button.dataset.authMode === mode;
                button.classList.toggle('is-active', isActive);
                button.setAttribute('aria-selected', String(isActive));
            });

            modePanels.forEach((panel) => {
                const isActive = panel.dataset.authPanel === mode;
                panel.classList.toggle('is-active', isActive);
                panel.classList.toggle('hidden', !isActive);
            });
        };

        passwordToggles.forEach((passwordToggle) => {
            const targetSelector = passwordToggle.getAttribute('data-password-target');
            const passwordInput = targetSelector ? document.querySelector(targetSelector) : null;
            if (!passwordInput || passwordToggle.dataset.bound === 'true') return;

            passwordToggle.dataset.bound = 'true';
            passwordToggle.addEventListener('click', () => {
                const isVisible = passwordInput.type === 'text';
                passwordInput.type = isVisible ? 'password' : 'text';
                passwordToggle.setAttribute('aria-label', isVisible ? 'Show password' : 'Hide password');
                const icon = passwordToggle.querySelector('i');
                if (icon) {
                    icon.classList.toggle('fa-eye', isVisible);
                    icon.classList.toggle('fa-eye-slash', !isVisible);
                }
            });
        });

        const syncLoginState = () => {
            const isAccepted = loginConsentCheckbox.checked;
            setButtonState(loginSubmitButton, isAccepted);
            loginConsentMessage.classList.toggle('hidden', isAccepted);
        };

        const syncSignupState = () => {
            const isAccepted = signupConsentCheckbox.checked;
            const hasMatchingPasswords = signupPasswordInput.value.length >= 6
                && signupPasswordInput.value === signupConfirmPasswordInput.value;
            setButtonState(signupSubmitButton, isAccepted && hasMatchingPasswords);
            signupConsentMessage.classList.toggle('hidden', isAccepted);
        };

        modeButtons.forEach((button) => {
            button.addEventListener('click', () => {
                activateAuthMode(button.dataset.authMode || 'signin');
            });
        });

        modeSwitches.forEach((button) => {
            button.addEventListener('click', () => {
                activateAuthMode(button.dataset.authSwitch || 'signup');
            });
        });

        loginForm.addEventListener('submit', (event) => {
            event.preventDefault();
            syncLoginState();
            setFormMessage(loginMessage, '', 'error');

            if (!loginConsentCheckbox.checked) return;

            const email = String(loginEmailInput.value || '').trim().toLowerCase();
            const password = String(loginPasswordInput.value || '');
            const accounts = readAccounts();
            const account = accounts.find((entry) => entry.email === email);

            if (!account || account.password !== password) {
                setFormMessage(loginMessage, 'We could not match that email and password. Please try again or create a new account.', 'error');
                return;
            }

            writeCurrentAccount(account, loginRememberMe?.checked);
            setFormMessage(loginMessage, `Welcome back, ${account.firstName}. Redirecting to the homepage...`, 'success');
            window.setTimeout(() => {
                window.location.href = '../index.html';
            }, 1200);
        });

        signupForm.addEventListener('submit', (event) => {
            event.preventDefault();
            syncSignupState();
            setFormMessage(signupMessage, '', 'error');

            if (!signupConsentCheckbox.checked) return;

            const firstName = String(signupFirstNameInput.value || '').trim();
            const lastName = String(signupLastNameInput.value || '').trim();
            const email = String(signupEmailInput.value || '').trim().toLowerCase();
            const password = String(signupPasswordInput.value || '');
            const confirmPassword = String(signupConfirmPasswordInput.value || '');

            if (!firstName || !lastName || !email) {
                setFormMessage(signupMessage, 'Please complete all required fields.', 'error');
                return;
            }

            if (password.length < 6) {
                setFormMessage(signupMessage, 'Your password must contain at least 6 characters.', 'error');
                return;
            }

            if (password !== confirmPassword) {
                setFormMessage(signupMessage, 'Passwords do not match. Please confirm your password again.', 'error');
                return;
            }

            const accounts = readAccounts();
            const alreadyExists = accounts.some((entry) => entry.email === email);
            if (alreadyExists) {
                setFormMessage(signupMessage, 'An account already exists with this email. Please sign in instead.', 'error');
                activateAuthMode('signin');
                loginEmailInput.value = email;
                return;
            }

            const account = {
                firstName,
                lastName,
                email,
                password,
                createdAt: Date.now()
            };

            accounts.push(account);
            writeAccounts(accounts);
            writeCurrentAccount(account, true);
            setFormMessage(signupMessage, `Your account has been created, ${firstName}. Redirecting to the homepage...`, 'success');
            window.setTimeout(() => {
                window.location.href = '../index.html';
            }, 1200);
        });

        loginConsentCheckbox.addEventListener('change', syncLoginState);
        signupConsentCheckbox.addEventListener('change', syncSignupState);
        signupPasswordInput.addEventListener('input', syncSignupState);
        signupConfirmPasswordInput.addEventListener('input', syncSignupState);

        activateAuthMode('signin');
        syncLoginState();
        syncSignupState();
    };

    const initConsentBanner = () => {
        const storageKey = 'ipordise-consent-choice';
        const consentCopy = {
            en: {
                badge: 'Privacy choices',
                title: 'We respect your privacy.',
                description: 'IPORDISE uses cookies and similar technologies to improve navigation, secure the website, and understand how visitors use our pages. You can accept or refuse non-essential cookies at any time.',
                accept: 'Accept',
                refuse: 'Refuse',
                manage: 'Privacy settings',
                links: 'Read our',
                privacy: 'Privacy Policy',
                and: 'and',
                terms: 'Terms & Conditions',
                statusAccepted: 'Accepted',
                statusRefused: 'Refused'
            },
            fr: {
                badge: 'Choix de confidentialite',
                title: 'Nous respectons votre vie privee.',
                description: 'IPORDISE utilise des cookies et des technologies similaires pour ameliorer la navigation, securiser le site et comprendre l\'utilisation des pages. Vous pouvez accepter ou refuser les cookies non essentiels a tout moment.',
                accept: 'Accepter',
                refuse: 'Refuser',
                manage: 'Parametres de confidentialite',
                links: 'Consultez notre',
                privacy: 'Politique de confidentialite',
                and: 'et nos',
                terms: 'Conditions generales',
                statusAccepted: 'Accepte',
                statusRefused: 'Refuse'
            }
        };

        const getCopy = () => consentCopy[currentLanguage] || consentCopy.en;
        const readStoredConsent = () => {
            try {
                return JSON.parse(localStorage.getItem(storageKey) || 'null');
            } catch (error) {
                return null;
            }
        };

        const writeStoredConsent = (choice) => {
            try {
                localStorage.setItem(storageKey, JSON.stringify({
                    choice,
                    timestamp: Date.now()
                }));
            } catch (error) {
                // Ignore storage failures and keep the banner functional for the session.
            }
        };

        const existingBanner = document.querySelector('.site-consent-banner');
        const existingManage = document.querySelector('.site-consent-manage');
        if (existingBanner || existingManage) return;

        const banner = document.createElement('section');
        banner.className = 'site-consent-banner';
        banner.setAttribute('role', 'dialog');
        banner.setAttribute('aria-live', 'polite');
        banner.setAttribute('aria-label', 'Cookie consent');

        const manageButton = document.createElement('button');
        manageButton.type = 'button';
        manageButton.className = 'site-consent-manage';

        const renderConsentUi = () => {
            const copy = getCopy();
            const stored = readStoredConsent();
            const statusLabel = stored?.choice === 'accepted'
                ? copy.statusAccepted
                : stored?.choice === 'refused'
                    ? copy.statusRefused
                    : '';

            banner.innerHTML = `
                <div class="site-consent-shell">
                    <div class="site-consent-copy">
                        <span class="site-consent-badge">${copy.badge}</span>
                        <h3 class="site-consent-title">${copy.title}</h3>
                        <p class="site-consent-text">${copy.description}</p>
                        <p class="site-consent-links">${copy.links} <a href="${getPolicyPageHref('privacy-policy')}" class="site-consent-link">${copy.privacy}</a> ${copy.and} <a href="${getPolicyPageHref('terms')}" class="site-consent-link">${copy.terms}</a>.</p>
                    </div>
                    <div class="site-consent-actions">
                        <button type="button" class="site-consent-btn site-consent-btn-secondary" data-consent-action="refused">${copy.refuse}</button>
                        <button type="button" class="site-consent-btn site-consent-btn-primary" data-consent-action="accepted">${copy.accept}</button>
                    </div>
                </div>
            `;

            manageButton.innerHTML = `<i class="fas fa-shield-heart" aria-hidden="true"></i><span>${copy.manage}${statusLabel ? ` · ${statusLabel}` : ''}</span>`;
        };

        const closeBanner = () => {
            banner.classList.remove('is-visible');
            document.body.classList.remove('consent-visible');
        };

        const openBanner = () => {
            renderConsentUi();
            banner.classList.add('is-visible');
            document.body.classList.add('consent-visible');
        };

        const applyConsentState = (stored) => {
            document.documentElement.dataset.consentChoice = stored?.choice || 'unset';
            manageButton.classList.toggle('is-visible', stored?.choice === 'refused');
            if (stored?.choice) {
                closeBanner();
            } else {
                openBanner();
            }
            renderConsentUi();
        };

        banner.addEventListener('click', (event) => {
            const actionButton = event.target.closest('[data-consent-action]');
            if (!actionButton) return;

            const choice = actionButton.getAttribute('data-consent-action');
            writeStoredConsent(choice);
            applyConsentState(readStoredConsent());
        });

        manageButton.addEventListener('click', () => {
            openBanner();
        });

        document.body.appendChild(banner);
        document.body.appendChild(manageButton);
        applyConsentState(readStoredConsent());
        onLanguageChange(() => applyConsentState(readStoredConsent()));
    };

    const initBackgroundMusic = () => {
        const normalizedPath = window.location.pathname.replace(/\\/g, '/').toLowerCase();
        const isHomePage = normalizedPath === '/' || normalizedPath.endsWith('/index.html') || normalizedPath.endsWith('/index.htm');
        if (!isHomePage) return;

        const playerMountId = 'yt-player';
        const wrapperId = 'yt-bg-music';
        const toggleId = 'music-toggle-btn';
        const storageKey = 'ipordise-music-muted';
        const preferredVideoId = '0HDuzhQOhuM';

        if (!document.body) return;

        let ytPlayer = null;
        let isReady = false;
        let isPlaying = false;
        // Always start silent — only play after an explicit button click
        let isMuted = true;

        if (!document.getElementById(wrapperId)) {
            const wrapper = document.createElement('div');
            wrapper.id = wrapperId;
            wrapper.style.position = 'fixed';
            wrapper.style.left = '-9999px';
            wrapper.style.top = '-9999px';
            wrapper.style.width = '1px';
            wrapper.style.height = '1px';
            wrapper.style.overflow = 'hidden';
            wrapper.style.pointerEvents = 'none';
            wrapper.setAttribute('aria-hidden', 'true');
            wrapper.innerHTML = `<div id="${playerMountId}"></div>`;
            document.body.appendChild(wrapper);
        }

        if (!document.getElementById(toggleId)) {
            const button = document.createElement('button');
            button.id = toggleId;
            button.className = 'music-toggle-btn';
            button.setAttribute('aria-label', 'Toggle background music');
            button.title = 'Background Music';
            button.innerHTML = `
                <span class="music-toggle-icon"><i class="fas fa-music"></i></span>
                <span class="music-bars" aria-hidden="true"><span></span><span></span><span></span><span></span></span>
                <span class="music-toggle-tooltip">Tap to hear music</span>
            `;
            document.body.appendChild(button);
        }

        const updateBtn = () => {
            const btn = document.getElementById(toggleId);
            if (!btn) return;

            btn.classList.toggle('is-playing', isReady && isPlaying && !isMuted);
            btn.classList.toggle('is-muted', !isReady || isMuted);
            btn.setAttribute('aria-label', isMuted ? 'Unmute background music' : 'Mute background music');
        };

        const persistMutedState = () => {
            localStorage.setItem(storageKey, String(isMuted));
        };



        const setupMusicBtn = () => {
            const btn = document.getElementById(toggleId);
            if (!btn || btn.dataset.musicBound === 'true') return;
            btn.dataset.musicBound = 'true';

            btn.addEventListener('click', (event) => {
                event.stopPropagation();
                if (!ytPlayer || !isReady) return;

                if (isMuted) {
                    ytPlayer.playVideo();
                    ytPlayer.unMute();
                    ytPlayer.setVolume(40);
                    isMuted = false;
                } else {
                    ytPlayer.mute();
                    isMuted = true;
                }

                persistMutedState();
                updateBtn();
            });
        };

        const onPlayerReady = (event) => {
            isReady = true;
            ytPlayer = event.target;
            ytPlayer.setVolume(40);
            // Do NOT auto-play — wait for explicit button click
            ytPlayer.mute();
            ytPlayer.stopVideo();
            updateBtn();
        };

        const onPlayerStateChange = (event) => {
            if (event.data === 1) {
                isPlaying = true;
            } else if (event.data === 0 || event.data === 2) {
                isPlaying = false;
            }
            updateBtn();
        };

        const createPlayer = () => {
            if (!window.YT || !window.YT.Player || document.getElementById(playerMountId)?.dataset.playerReady === 'true') return;
            const mount = document.getElementById(playerMountId);
            if (!mount) return;
            mount.dataset.playerReady = 'true';

            ytPlayer = new window.YT.Player(playerMountId, {
                videoId: preferredVideoId,
                playerVars: {
                    autoplay: 1,
                    mute: isMuted ? 1 : 0,
                    loop: 1,
                    playlist: preferredVideoId,
                    controls: 0,
                    disablekb: 1,
                    fs: 0,
                    playsinline: 1,
                    iv_load_policy: 3,
                    modestbranding: 1,
                    rel: 0
                },
                events: {
                    onReady: onPlayerReady,
                    onStateChange: onPlayerStateChange
                }
            });
        };

        setupMusicBtn();
        updateBtn();

        if (window.YT && window.YT.Player) {
            createPlayer();
            return;
        }

        const previousReady = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = function () {
            if (typeof previousReady === 'function') previousReady();
            createPlayer();
        };

        if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
            const tag = document.createElement('script');
            tag.src = 'https://www.youtube.com/iframe_api';
            document.head.appendChild(tag);
        }
    };

    const submitToFormspree = async (payload) => {
        const response = await fetch(FORMSPREE_ENDPOINT, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error('Formspree request failed');
        }

        return response;
    };

    const initNewsletterForms = () => {
        const forms = Array.from(document.querySelectorAll('.ipordise-news-form'));
        if (!forms.length) return;

        const storageKey = 'ipordise-newsletter-subscribers';

        const readSubscribers = () => {
            try {
                const raw = JSON.parse(localStorage.getItem(storageKey) || '[]');
                return Array.isArray(raw) ? raw : [];
            } catch (error) {
                return [];
            }
        };

        const writeSubscribers = (subscribers) => {
            localStorage.setItem(storageKey, JSON.stringify(subscribers));
        };

        forms.forEach((form, index) => {
            const submitButton = form.querySelector('.ipordise-news-submit');
            const nameInput = form.querySelector('input[type="text"]');
            const emailInput = form.querySelector('input[type="email"]');
            const genderInput = form.querySelector('select');
            const consentCheckbox = form.querySelector('input[type="checkbox"]');

            if (!submitButton || !emailInput) return;

            let feedback = form.querySelector('.ipordise-news-feedback');
            if (!feedback) {
                feedback = document.createElement('p');
                feedback.className = 'ipordise-news-feedback hidden';
                feedback.setAttribute('aria-live', 'polite');
                form.appendChild(feedback);
            }

            const applySubscribedState = () => {
                submitButton.textContent = 'SUBSCRIBED';
                submitButton.disabled = true;
                submitButton.classList.add('is-subscribed');

                [nameInput, emailInput, genderInput, consentCheckbox].forEach((field) => {
                    if (field) field.disabled = true;
                });
            };

            const setFeedback = (message, tone) => {
                feedback.textContent = message;
                feedback.classList.remove('hidden', 'is-error', 'is-success');
                feedback.classList.add(tone === 'success' ? 'is-success' : 'is-error');
            };

            const setSubmittingState = (isSubmitting) => {
                submitButton.disabled = isSubmitting;
                if (isSubmitting) {
                    submitButton.dataset.originalText = submitButton.textContent;
                    submitButton.textContent = 'SENDING...';
                } else if (!submitButton.classList.contains('is-subscribed')) {
                    submitButton.textContent = submitButton.dataset.originalText || submitButton.textContent;
                }

                [nameInput, emailInput, genderInput, consentCheckbox].forEach((field) => {
                    if (field) field.disabled = isSubmitting;
                });
            };

            const emailKey = `ipordise-newsletter-last-email-${index}`;
            const rememberedEmail = localStorage.getItem(emailKey);
            if (rememberedEmail && rememberedEmail === String(emailInput.value || '').trim().toLowerCase()) {
                applySubscribedState();
                setFeedback('You are already subscribed to the IPORDISE newsletter.', 'success');
            }

            form.addEventListener('submit', async (event) => {
                event.preventDefault();
                if (!form.reportValidity()) return;

                const email = String(emailInput.value || '').trim().toLowerCase();
                const name = String(nameInput?.value || '').trim();
                const gender = String(genderInput?.value || '').trim();
                const subscribers = readSubscribers();
                const existingIndex = subscribers.findIndex((entry) => entry.email === email);
                const payload = {
                    _replyto: email,
                    _subject: `[IPORDISE Newsletter] New subscriber${name ? ' — ' + name : ''}`,
                    formType: 'newsletter',
                    source: window.location.pathname,
                    name,
                    email,
                    gender,
                    subscribedAt: new Date().toISOString()
                };

                try {
                    setSubmittingState(true);
                    await submitToFormspree(payload);

                    if (existingIndex >= 0) {
                        subscribers[existingIndex] = { ...subscribers[existingIndex], ...payload };
                    } else {
                        subscribers.push(payload);
                    }

                    writeSubscribers(subscribers);
                    localStorage.setItem(emailKey, email);
                    applySubscribedState();
                    setFeedback('Subscribed successfully. Welcome to the IPORDISE newsletter.', 'success');
                } catch (error) {
                    setFeedback('Unable to subscribe right now. Please try again in a moment.', 'error');
                } finally {
                    if (!submitButton.classList.contains('is-subscribed')) {
                        setSubmittingState(false);
                    }
                }
            });
        });
    };

    const initContactForm = () => {
        const form = document.getElementById('contactForm');
        if (!form) return;

        const nameInput = document.getElementById('contactName');
        const emailInput = document.getElementById('contactEmail');
        const phoneInput = document.getElementById('contactPhone');
        const subjectInput = document.getElementById('contactSubject');
        const orderNumberInput = document.getElementById('contactOrderNumber');
        const orderNumberField = document.getElementById('orderNumberField');
        const messageInput = document.getElementById('contactMessage');
        const charCounter = document.getElementById('charCounter');
        const submitButton = form.querySelector('button[type="submit"]');
        if (!nameInput || !emailInput || !messageInput || !submitButton) return;

        // Live character counter
        if (messageInput && charCounter) {
            messageInput.addEventListener('input', () => {
                const len = messageInput.value.length;
                charCounter.textContent = `${len} / 1000`;
                charCounter.style.color = len > 900 ? '#e73c3c' : '';
            });
        }

        // Show order number field for order-related subjects
        if (subjectInput && orderNumberField) {
            subjectInput.addEventListener('change', () => {
                const v = subjectInput.value.toLowerCase();
                const show = v.includes('order') || v.includes('delivery') || v.includes('return');
                orderNumberField.classList.toggle('hidden', !show);
            });
        }

        let feedback = form.querySelector('.contact-form-feedback');
        if (!feedback) {
            feedback = document.createElement('p');
            feedback.className = 'contact-form-feedback hidden text-sm mt-1';
            feedback.setAttribute('aria-live', 'polite');
            form.appendChild(feedback);
        }

        const setFeedback = (message, tone) => {
            feedback.textContent = message;
            feedback.classList.remove('hidden', 'text-red-600', 'text-green-600');
            feedback.classList.add(tone === 'success' ? 'text-green-600' : 'text-red-600');
        };

        const setSubmittingState = (isSubmitting) => {
            submitButton.disabled = isSubmitting;
            const btnLabel = submitButton.querySelector('.btn-label');
            if (btnLabel) {
                if (isSubmitting) {
                    btnLabel.dataset.original = btnLabel.textContent;
                    btnLabel.textContent = 'SENDING...';
                } else {
                    btnLabel.textContent = btnLabel.dataset.original || btnLabel.textContent;
                }
            } else {
                if (isSubmitting) {
                    submitButton.dataset.originalText = submitButton.textContent;
                    submitButton.textContent = 'SENDING...';
                } else {
                    submitButton.textContent = submitButton.dataset.originalText || submitButton.textContent;
                }
            }
            [nameInput, emailInput, phoneInput, subjectInput, messageInput].forEach(field => {
                if (field) field.disabled = isSubmitting;
            });
        };

        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (!form.reportValidity()) return;

            const email = String(emailInput.value || '').trim().toLowerCase();
            const subject = String(subjectInput?.value || '').trim();
            const phone = String(phoneInput?.value || '').trim();
            const orderNumber = String(orderNumberInput?.value || '').trim();

            const payload = {
                _replyto: email,
                _subject: `[IPORDISE Contact] ${subject || 'New message'}`,
                formType: 'contact',
                source: window.location.pathname,
                name: String(nameInput.value || '').trim(),
                email,
                subject,
                message: String(messageInput.value || '').trim()
            };
            if (phone) payload.phone = phone;
            if (orderNumber) payload.orderNumber = orderNumber;

            try {
                setSubmittingState(true);
                await submitToFormspree(payload);
                form.reset();
                if (charCounter) charCounter.textContent = '0 / 1000';
                if (orderNumberField) orderNumberField.classList.add('hidden');
                setFeedback('Message sent successfully. We will get back to you soon.', 'success');
            } catch (error) {
                setFeedback('Unable to send your message right now. Please try again in a moment.', 'error');
            } finally {
                setSubmittingState(false);
            }
        });
    };

    applyOfficialHeaderFooter();
    initBrandLogoDotAnimation();
    normalizeLegacyFrenchContent();
    initLanguageSwitcher();
    initMobileSearchToggle();
    initSearchOverlay();
    initNewsletterForms();
    initContactForm();
    initBackgroundMusic();
    initConsentBanner();
    initLoginLegalConsent();
    disableInspectTools();
    initSocialVideoSwitcher();
    initHeroOfferRotator();
    initProductBadgeRotation();
    bindProductLinks();
    void initProductDetailPage();
    initCartPage();
    initCheckoutPage();
    initAccountMenu();
    initWishlistButtons();
    setHeaderCartCount();
    initDiscoverFilters();
    void initCatalogPrices();
    initHeaderSearchSuggestions();
    watchPricesJsonChanges();
    watchSizesJsonChanges();  // auto-reload when sizes.json changes

    /* --- Mobile Menu --- */
    const mobileMenuToggle = document.getElementById('mobileMenuToggle');
    const mobileMenuClose = document.getElementById('mobileMenuClose');
    const mobileMenuOverlay = document.getElementById('mobileMenuOverlay');
    const mobileMenuDrawer = document.getElementById('mobileMenuDrawer');

    const openMobileMenu = () => {
        if (!mobileMenuDrawer) return;
        mobileMenuDrawer.classList.add('is-open');
        mobileMenuOverlay.classList.add('is-open');
        document.body.style.overflow = 'hidden';
    };
    const closeMobileMenu = () => {
        if (!mobileMenuDrawer) return;
        mobileMenuDrawer.classList.remove('is-open');
        mobileMenuOverlay.classList.remove('is-open');
        document.body.style.overflow = '';
    };

    if (mobileMenuToggle) mobileMenuToggle.addEventListener('click', openMobileMenu);
    if (mobileMenuClose) mobileMenuClose.addEventListener('click', closeMobileMenu);
    if (mobileMenuOverlay) mobileMenuOverlay.addEventListener('click', closeMobileMenu);

    /* --- Flash Offers Countdown Timer --- */
    const flashHoursEl = document.getElementById('flashHours');
    const flashMinutesEl = document.getElementById('flashMinutes');
    const flashSecondsEl = document.getElementById('flashSeconds');

    if (flashHoursEl && flashMinutesEl && flashSecondsEl) {
        const updateFlashCountdown = () => {
            const now = new Date();
            const endOfDay = new Date(now);
            endOfDay.setHours(23, 59, 59, 999);
            const diff = endOfDay - now;
            const hours = Math.floor(diff / 3600000);
            const minutes = Math.floor((diff % 3600000) / 60000);
            const seconds = Math.floor((diff % 60000) / 1000);
            flashHoursEl.textContent = String(hours).padStart(2, '0');
            flashMinutesEl.textContent = String(minutes).padStart(2, '0');
            flashSecondsEl.textContent = String(seconds).padStart(2, '0');
        };
        updateFlashCountdown();
        setInterval(updateFlashCountdown, 1000);
    }

    /* --- Back to Top Button --- */
    const backToTopBtn = document.getElementById('backToTop');

    /* --- Carousel Dot Indicators --- */
    const initCarouselDots = (carouselId, dotsContainerId) => {
        const carousel = document.getElementById(carouselId);
        const dotsContainer = document.getElementById(dotsContainerId);
        if (!carousel || !dotsContainer) return;

        const dots = Array.from(dotsContainer.querySelectorAll('.carousel-dot'));
        if (!dots.length) return;

        // newArrivalsCarousel uses scroll-snap-align:start → detect by left-edge proximity
        const useStartDetection = carouselId === 'newArrivalsCarousel';

        const getActiveCardIndex = (items) => {
            if (useStartDetection) {
                return items.reduce((best, item, index) => {
                    const dist = Math.abs(item.offsetLeft - carousel.scrollLeft);
                    return dist < Math.abs(items[best].offsetLeft - carousel.scrollLeft) ? index : best;
                }, 0);
            }
            return getNearestCarouselItemIndex(carousel, items);
        };

        const updateActiveDot = () => {
            const items = getCarouselSnapItems(carousel);
            if (!items.length) return;

            const activeCardIndex = getActiveCardIndex(items);
            const lastCardIndex = Math.max(items.length - 1, 1);
            const activeDotIndex = Math.min(
                Math.round((activeCardIndex / lastCardIndex) * (dots.length - 1)),
                dots.length - 1
            );

            dots.forEach((dot, index) => dot.classList.toggle('is-active', index === activeDotIndex));
        };

        carousel.addEventListener('scroll', updateActiveDot, { passive: true });

        dots.forEach((dot, index) => {
            dot.addEventListener('click', () => {
                const items = getCarouselSnapItems(carousel);
                if (!items.length) return;

                const maxIndex = Math.max(items.length - 1, 1);
                const targetIndex = Math.round((index / Math.max(dots.length - 1, 1)) * maxIndex);
                const targetItem = items[targetIndex];
                if (!targetItem) return;

                const targetLeft = useStartDetection
                    ? targetItem.offsetLeft
                    : getCenteredScrollLeftForItem(carousel, targetItem);

                carousel.scrollTo({
                    left: targetLeft,
                    behavior: 'smooth'
                });
            });
        });

        // Defer initial dot sync until layout is complete
        requestAnimationFrame(() => requestAnimationFrame(updateActiveDot));
    };

    initCarouselDots('productCarousel', 'productCarouselDots');
    initCarouselDots('newArrivalsCarousel', 'newArrivalsCarouselDots');
    initCarouselDots('carousel2026', 'carousel2026Dots');

    // 2026 product count badge
    (() => {
        const track = document.getElementById('carousel2026');
        const countEl = document.getElementById('section2026Count');
        const updateCount = () => {
            if (track && countEl) {
                const n = track.querySelectorAll('.card-2026').length;
                if (n > 0) countEl.textContent = n + (currentLanguage === 'fr' ? ' parfums' : ' fragrances');
            }
        };
        updateCount();
        onLanguageChange(updateCount);
    })();

    if (backToTopBtn) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 600) {
                backToTopBtn.classList.add('is-visible');
            } else {
                backToTopBtn.classList.remove('is-visible');
            }
        }, { passive: true });
        backToTopBtn.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    /* --- Product Image Zoom on Hover --- */
    const zoomContainer = document.getElementById('productZoomContainer');
    if (zoomContainer) {
        const zoomImg = zoomContainer.querySelector('.product-main-image');
        if (zoomImg) {
            zoomContainer.addEventListener('mousemove', (e) => {
                const rect = zoomContainer.getBoundingClientRect();
                const x = ((e.clientX - rect.left) / rect.width) * 100;
                const y = ((e.clientY - rect.top) / rect.height) * 100;
                zoomImg.style.transformOrigin = `${x}% ${y}%`;
            });
            zoomContainer.addEventListener('mouseleave', () => {
                zoomImg.style.transformOrigin = 'center center';
            });
        }

        /* Mobile swipe to change images */
        let touchStartX = 0;
        let touchEndX = 0;
        const swipeThreshold = 50;

        zoomContainer.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });

        zoomContainer.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            const diff = touchStartX - touchEndX;
            if (Math.abs(diff) < swipeThreshold) return;

            const thumbs = Array.from(document.querySelectorAll('#productThumbs .product-thumb-btn'));
            if (!thumbs.length) return;
            const activeIndex = thumbs.findIndex((t) => t.classList.contains('is-active'));
            let nextIndex;
            if (diff > 0) {
                nextIndex = activeIndex < thumbs.length - 1 ? activeIndex + 1 : 0;
            } else {
                nextIndex = activeIndex > 0 ? activeIndex - 1 : thumbs.length - 1;
            }
            thumbs[nextIndex].click();
            const thumbsContainer = document.getElementById('productThumbs');
            if (thumbsContainer) {
                thumbsContainer.scrollLeft = thumbs[nextIndex].offsetLeft - thumbsContainer.offsetLeft - (thumbsContainer.clientWidth / 2) + (thumbs[nextIndex].offsetWidth / 2);
            }
        }, { passive: true });
    }

    /* --- Thumbnail Arrow Navigation --- */
    const thumbsRow = document.getElementById('productThumbs');
    if (thumbsRow) {
        const leftArrow = document.querySelector('.thumbs-arrow-left');
        const rightArrow = document.querySelector('.thumbs-arrow-right');

        const navigateThumb = (direction) => {
            const thumbs = Array.from(thumbsRow.querySelectorAll('.product-thumb-btn'));
            if (thumbs.length < 2) return;
            const activeIndex = thumbs.findIndex((t) => t.classList.contains('is-active'));
            let nextIndex;
            if (direction === 'next') {
                nextIndex = activeIndex < thumbs.length - 1 ? activeIndex + 1 : 0;
            } else {
                nextIndex = activeIndex > 0 ? activeIndex - 1 : thumbs.length - 1;
            }
            thumbs[nextIndex].click();
            thumbsRow.scrollLeft = thumbs[nextIndex].offsetLeft - thumbsRow.offsetLeft - (thumbsRow.clientWidth / 2) + (thumbs[nextIndex].offsetWidth / 2);
        };

        if (leftArrow) {
            leftArrow.addEventListener('click', () => navigateThumb('prev'));
        }
        if (rightArrow) {
            rightArrow.addEventListener('click', () => navigateThumb('next'));
        }
    }

    /* --- Product Image Auto-Slideshow --- */
    const autoSlideThumbsContainer = document.getElementById('productThumbs');
    if (autoSlideThumbsContainer) {
        let autoSlideTimer = null;
        const AUTO_SLIDE_DELAY = 3500;

        const startAutoSlide = () => {
            stopAutoSlide();
            autoSlideTimer = setInterval(() => {
                const thumbs = Array.from(autoSlideThumbsContainer.querySelectorAll('.product-thumb-btn'));
                if (thumbs.length < 2) return;
                const activeIndex = thumbs.findIndex((t) => t.classList.contains('is-active'));
                const nextIndex = (activeIndex + 1) % thumbs.length;
                thumbs[nextIndex].click();
                autoSlideThumbsContainer.scrollLeft = thumbs[nextIndex].offsetLeft - autoSlideThumbsContainer.offsetLeft - (autoSlideThumbsContainer.clientWidth / 2) + (thumbs[nextIndex].offsetWidth / 2);
            }, AUTO_SLIDE_DELAY);
        };

        const stopAutoSlide = () => {
            if (autoSlideTimer) { clearInterval(autoSlideTimer); autoSlideTimer = null; }
        };

        // Auto-slideshow is disabled — user-initiated navigation only.
        // stopAutoSlide is kept available for any future use.
    }

    /* --- Share Buttons --- */
    document.querySelectorAll('.product-share-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            const url = encodeURIComponent(window.location.href);
            const title = encodeURIComponent(document.title);
            const label = btn.getAttribute('aria-label') || '';

            if (label.includes('Facebook')) {
                window.open('https://www.facebook.com/sharer/sharer.php?u=' + url, '_blank', 'width=600,height=400');
            } else if (label.includes('Instagram')) {
                window.open('https://www.instagram.com/', '_blank');
            } else if (label.includes('WhatsApp')) {
                window.open('https://wa.me/?text=' + title + '%20' + url, '_blank');
            } else if (label.includes('Copy')) {
                navigator.clipboard.writeText(window.location.href).then(() => {
                    const icon = btn.querySelector('i');
                    if (icon) {
                        icon.className = 'fas fa-check';
                        setTimeout(() => { icon.className = 'fas fa-link'; }, 1500);
                    }
                });
            }
        });
    });

    // Gallery share button (top-right of image)
    const galleryShareBtn = document.querySelector('.gallery-share-btn');
    if (galleryShareBtn) {
        galleryShareBtn.addEventListener('click', () => {
            if (navigator.share) {
                navigator.share({ title: document.title, url: window.location.href });
            } else {
                navigator.clipboard.writeText(window.location.href).then(() => {
                    const icon = galleryShareBtn.querySelector('i');
                    if (icon) {
                        icon.className = 'fas fa-check';
                        setTimeout(() => { icon.className = 'fas fa-share-nodes'; }, 1500);
                    }
                });
            }
        });
    }

    /* --- Fragrance DNA animation on scroll --- */
    const dnaFills = document.querySelectorAll('.product-dna-fill');
    if (dnaFills.length) {
        const animateDna = () => {
            dnaFills.forEach((fill) => {
                const rect = fill.getBoundingClientRect();
                if (rect.top < window.innerHeight - 40) {
                    fill.style.width = fill.style.width; // triggers transition
                }
            });
        };
        // Start fills at 0 and animate when visible
        dnaFills.forEach((fill) => {
            const target = fill.dataset.target || fill.style.width;
            fill.dataset.target = target;
            fill.style.width = '0%';
        });
        const dnaObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    const fill = entry.target;
                    fill.style.width = fill.dataset.target;
                    dnaObserver.unobserve(fill);
                }
            });
        }, { threshold: 0.3 });
        dnaFills.forEach((fill) => dnaObserver.observe(fill));
    }

    /* --- Scroll-reveal for sect-reveal elements --- */
    if ('IntersectionObserver' in window) {
        const revealObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    revealObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -32px 0px' });
        document.querySelectorAll('.sect-reveal').forEach((el) => revealObserver.observe(el));
    } else {
        document.querySelectorAll('.sect-reveal').forEach((el) => el.classList.add('is-visible'));
    }

    /* --- Server Down Modal for Login --- */
    const serverDownModal = document.createElement('div');
    serverDownModal.id = 'serverDownModal';
    serverDownModal.setAttribute('role', 'alertdialog');
    serverDownModal.setAttribute('aria-modal', 'true');
    serverDownModal.setAttribute('aria-labelledby', 'serverDownTitle');
    serverDownModal.innerHTML = `
        <div id="serverDownBackdrop" style="
            position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:9998;
            display:flex;align-items:center;justify-content:center;
            backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);
        ">
            <div style="
                background:#1a1a1a;color:#fff;border-radius:1rem;
                padding:2.5rem 2rem;max-width:420px;width:90%;text-align:center;
                box-shadow:0 25px 60px rgba(0,0,0,0.5);position:relative;z-index:9999;
                border:1px solid rgba(255,255,255,0.1);
            ">
                <div style="font-size:3rem;margin-bottom:1rem;">🛠️</div>
                <h2 id="serverDownTitle" style="font-size:1.4rem;font-weight:700;margin-bottom:0.75rem;letter-spacing:0.05em;">
                    Server Under Maintenance
                </h2>
                <p style="color:rgba(255,255,255,0.7);font-size:0.95rem;line-height:1.6;margin-bottom:1.75rem;">
                    Our login servers are currently down for maintenance.<br>
                    We apologize for the inconvenience and will be back shortly.
                </p>
                <button id="serverDownClose" style="
                    background:#e73c3c;color:#fff;border:none;border-radius:999px;
                    padding:0.65rem 2rem;font-size:0.9rem;font-weight:700;
                    cursor:pointer;letter-spacing:0.05em;transition:background 0.2s;
                " onmouseover="this.style.background='#c0392b'" onmouseout="this.style.background='#e73c3c'">
                    OK, Got It
                </button>
            </div>
        </div>
    `;
    serverDownModal.style.display = 'none';
    document.body.appendChild(serverDownModal);

    const showServerDownModal = (e) => {
        e.preventDefault();
        serverDownModal.style.display = 'block';
        document.getElementById('serverDownClose').focus();
    };

    const closeServerDownModal = () => {
        serverDownModal.style.display = 'none';
    };

    document.getElementById('serverDownClose').addEventListener('click', closeServerDownModal);
    document.getElementById('serverDownBackdrop').addEventListener('click', (e) => {
        if (e.target === document.getElementById('serverDownBackdrop')) closeServerDownModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && serverDownModal.style.display !== 'none') closeServerDownModal();
    });

    document.querySelectorAll('a[href*="login.html"]').forEach((link) => {
        link.addEventListener('click', showServerDownModal);
    });

    /* ════════════════════════════════════════════════════════
       LUXURY UI MICRO-INTERACTIONS — v4
       Ripple, scroll-reveal, heart-pop, image lazy-load,
       touch feedback. Fully non-breaking.
    ════════════════════════════════════════════════════════ */
    const initLuxuryUI = () => {
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        /* ── 1. Ripple effect on Add-to-Cart buttons ── */
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('.js-card-add-btn');
            if (!btn || prefersReducedMotion) return;

            const rect = btn.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top  - size / 2;

            const ripple = document.createElement('span');
            ripple.className = 'lux-btn-ripple';
            Object.assign(ripple.style, {
                width:  `${size}px`,
                height: `${size}px`,
                left:   `${x}px`,
                top:    `${y}px`,
            });

            btn.appendChild(ripple);
            ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
        });

        /* ── 2. Heart-pop animation on wishlist toggle ── */
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('.product-favorite-btn');
            if (!btn) return;

            btn.classList.add('lux-heart-popping');
            btn.addEventListener('animationend', () => {
                btn.classList.remove('lux-heart-popping');
            }, { once: true });
        });

        /* ── 3. Scroll-reveal for product cards & key sections ── */
        if (!prefersReducedMotion && 'IntersectionObserver' in window) {
            const revealSelectors = [
                '#productCarousel > .group',
                '#newArrivalsCarousel > article',
                '.testimonial-card',
                '.ipordise-adv-item',
                '.brand-marquee-tile',
            ].join(', ');

            const revealTargets = document.querySelectorAll(revealSelectors);
            revealTargets.forEach((el) => el.classList.add('lux-reveal'));

            const revealObserver = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('lux-reveal--visible');
                        revealObserver.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.1, rootMargin: '0px 0px -32px 0px' });

            revealTargets.forEach((el) => revealObserver.observe(el));
        }

        /* ── 4. Lazy loading: apply to any image missing the attribute ── */
        document.querySelectorAll('img:not([loading])').forEach((img) => {
            img.setAttribute('loading', 'lazy');
        });

        /* ── 5. Mobile touch-press feedback on cards ── */
        if (window.matchMedia('(hover: none)').matches && 'ontouchstart' in window) {
            const touchEls = document.querySelectorAll('.js-product-link');
            touchEls.forEach((el) => {
                el.addEventListener('touchstart', () => {
                    el.style.transition = 'transform 0.12s ease, box-shadow 0.12s ease';
                    el.style.transform = 'scale(0.984)';
                    el.style.boxShadow = '0 8px 20px rgba(15,23,42,0.1)';
                }, { passive: true });

                const resetTouch = () => {
                    el.style.transform = '';
                    el.style.boxShadow = '';
                };
                el.addEventListener('touchend',    resetTouch, { passive: true });
                el.addEventListener('touchcancel', resetTouch, { passive: true });
            });
        }
    };

    initLuxuryUI();

    /* ══════════════════════════════════════════════════════════════════════
       GRATEFUL ANIMATION SYSTEM  v1.0
       Page entrance · hero orbs · extended section reveals · counters
    ══════════════════════════════════════════════════════════════════════ */
    const initGratefulAnimations = () => {
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        // ── 1. Page entrance ──────────────────────────────────────────────
        document.body.classList.add('ip-loaded');

        // ── 2. Hero floating gold orbs ────────────────────────────────────
        if (!reduced) {
            const heroEl = document.getElementById('heroSection');
            if (heroEl) {
                const orbWrap = document.createElement('div');
                orbWrap.className = 'ip-hero-orbs';
                orbWrap.setAttribute('aria-hidden', 'true');
                for (let i = 0; i < 5; i++) {
                    const orb = document.createElement('div');
                    orb.className = 'ip-hero-orb';
                    orbWrap.appendChild(orb);
                }
                heroEl.appendChild(orbWrap);
            }
        }

        // ── 3. Extended scroll-reveal for sections not yet covered ────────
        // Reuses the existing sect-reveal / is-visible CSS system.
        // We create a fresh observer so elements added here are observed even
        // though the original sect-reveal observer already ran earlier.
        const revealItems = [];   // {el, extraClass?}[]

        const markReveal = (selector, modClass, delayClass) => {
            document.querySelectorAll(selector).forEach((el) => {
                if (modClass)   el.classList.add(modClass);
                if (delayClass) el.classList.add(delayClass);
                el.classList.add('sect-reveal');
                revealItems.push(el);
            });
        };

        // Flash Offers — title words slide from sides
        markReveal('.flash-word-left',  'sect-reveal--left',  null);
        markReveal('.flash-word-right', 'sect-reveal--right', 'sect-reveal-d1');
        // Flash Offers — subtitle, countdown, view-all CTA
        markReveal('#flashOffersSection .text-center > p.text-sm', null, 'sect-reveal-d2');
        markReveal('#flashOffersSection .flash-countdown-bar',     'sect-reveal--scale', 'sect-reveal-d3');
        markReveal('#flashOffersSection .flash-view-all-btn',      null, 'sect-reveal-d4');
        // Promo banners — scale in with stagger
        document.querySelectorAll('.promo-banner-card').forEach((el, i) => {
            el.classList.add('sect-reveal', 'sect-reveal--scale');
            if (i > 0) el.classList.add('sect-reveal-d2');
            revealItems.push(el);
        });
        // Brand marquee header
        markReveal('.brand-marquee-header', null, 'sect-reveal-d1');
        // Class 2026 — kicker drops from above, sub fades up
        markReveal('.section-2026-kicker',  'sect-reveal--down', null);
        markReveal('.section-2026-sub',     null,  'sect-reveal-d2');
        markReveal('.section-2026-viewall', null,  'sect-reveal-d3');
        // New Arrivals — header row fades up
        markReveal('#newArrivalsSection .new-arrivals-header', null, null);
        // Valentino — copy slides from left, visual from right
        markReveal('#valentino-house-section .luxury-story-copy',   'sect-reveal--left',  null);
        markReveal('#valentino-house-section .luxury-story-visual',  'sect-reveal--right', 'sect-reveal-d1');
        // Client proof — heading + sub
        markReveal('.client-proof-section h2',               null,  null);
        // Metric items — stagger up
        document.querySelectorAll('.proof-metrics .metric-item').forEach((el, i) => {
            const delays = [null, 'sect-reveal-d1', 'sect-reveal-d2', 'sect-reveal-d3'];
            if (delays[i]) el.classList.add(delays[i]);
            el.classList.add('sect-reveal');
            revealItems.push(el);
        });

        if ('IntersectionObserver' in window) {
            const gRevealObs = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) return;
                    entry.target.classList.add('is-visible');
                    gRevealObs.unobserve(entry.target);
                });
            }, { threshold: 0.1, rootMargin: '0px 0px -30px 0px' });
            revealItems.forEach((el) => gRevealObs.observe(el));
        } else {
            revealItems.forEach((el) => el.classList.add('is-visible'));
        }

        // ── 5. Metric number counters ─────────────────────────────────────
        if (!reduced && 'IntersectionObserver' in window) {
            const counterObs = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) return;
                    const valueEl = entry.target.querySelector('.metric-value');
                    if (!valueEl || valueEl.dataset.ipCounted) return;
                    valueEl.dataset.ipCounted = '1';

                    const raw = valueEl.textContent.trim();
                    const numMatch = raw.match(/[\d.]+/);
                    if (!numMatch) return;

                    const target  = parseFloat(numMatch[0]);
                    const prefix  = raw.charAt(0) === '+' ? '+' : '';
                    const suffix  = raw.slice(raw.indexOf(numMatch[0]) + numMatch[0].length);
                    const isFloat = numMatch[0].includes('.');
                    const dur     = 1500;
                    const t0      = performance.now();

                    const tick = (now) => {
                        const prog  = Math.min((now - t0) / dur, 1);
                        const ease  = 1 - Math.pow(1 - prog, 3);   // ease-out cubic
                        const val   = isFloat
                            ? (target * ease).toFixed(1)
                            : Math.round(target * ease);
                        valueEl.textContent = `${prefix}${val}${suffix}`;
                        if (prog < 1) requestAnimationFrame(tick);
                    };
                    requestAnimationFrame(tick);
                    entry.target.classList.add('ip-metric-in');
                    counterObs.unobserve(entry.target);
                });
            }, { threshold: 0.45 });

            document.querySelectorAll('.metric-item').forEach((el) => counterObs.observe(el));
        }
    };

    initGratefulAnimations();
});

/* ── Sliding nav ink-bar indicator ──────────────────────────────────── */
document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.perfume-nav-list').forEach(function (nav) {
        /* Create the sliding indicator element */
        var indicator = document.createElement('div');
        indicator.className = 'perfume-nav-indicator';
        indicator.setAttribute('aria-hidden', 'true');
        nav.appendChild(indicator);

        function moveIndicator(el, skipTransition) {
            var navRect = nav.getBoundingClientRect();
            var elRect  = el.getBoundingClientRect();
            var left    = elRect.left - navRect.left + nav.scrollLeft;
            var width   = elRect.width;
            if (skipTransition) {
                indicator.style.transition = 'none';
                indicator.style.left  = left + 'px';
                indicator.style.width = width + 'px';
                /* Re-enable transition after two frames so the snap isn't animated */
                requestAnimationFrame(function () {
                    requestAnimationFrame(function () {
                        indicator.style.transition = '';
                    });
                });
            } else {
                indicator.style.left  = left + 'px';
                indicator.style.width = width + 'px';
            }
        }

        var links  = nav.querySelectorAll('.perfume-nav-link');
        var filter = new URLSearchParams(window.location.search).get('filter');

        /* On discover.html: derive active link from the URL filter param */
        if (filter !== null) {
            links.forEach(function (l) { l.classList.remove('is-active'); });
            var matched = false;
            links.forEach(function (link) {
                var lf = new URLSearchParams(
                    (link.getAttribute('href') || '').split('?')[1] || ''
                ).get('filter') || '';
                if (filter === lf) {
                    link.classList.add('is-active');
                    matched = true;
                }
            });
            /* No ?filter in URL → default to the first link (ALL PERFUMES) */
            if (!matched && links.length) {
                links[0].classList.add('is-active');
            }
        }

        /* Position indicator on load (no animation) */
        requestAnimationFrame(function () {
            var active = nav.querySelector('.perfume-nav-link.is-active');
            if (active) moveIndicator(active, true);
        });

        /* Slide indicator on click */
        links.forEach(function (link) {
            link.addEventListener('click', function () {
                links.forEach(function (l) { l.classList.remove('is-active'); });
                link.classList.add('is-active');
                moveIndicator(link, false);
            });
        });

        /* Reposition on resize without animation */
        window.addEventListener('resize', function () {
            var active = nav.querySelector('.perfume-nav-link.is-active');
            if (active) moveIndicator(active, true);
        }, { passive: true });
    });
});

document.addEventListener('DOMContentLoaded', function () {
    if (!document.body || document.querySelector('[data-scroll-progress]')) return;

    var progressRoot = document.createElement('div');
    progressRoot.className = 'scroll-progress';
    progressRoot.setAttribute('data-scroll-progress', 'true');
    progressRoot.setAttribute('aria-hidden', 'true');

    var progressBar = document.createElement('div');
    progressBar.className = 'scroll-progress__bar';
    progressRoot.appendChild(progressBar);
    document.body.prepend(progressRoot);

    var targetProgress = 0;
    var currentProgress = 0;
    var frameId = null;
    var scrollingClassTimer = null;
    var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    function getScrollProgress() {
        var scrollTop = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
        var doc = document.documentElement;
        var maxScroll = Math.max(doc.scrollHeight - window.innerHeight, 0);

        if (maxScroll <= 0) return 0;

        return Math.min(Math.max(scrollTop / maxScroll, 0), 1);
    }

    function setProgress(progress) {
        var safeProgress = Math.min(Math.max(progress, 0), 1);
        progressRoot.style.setProperty('--scroll-progress-scale', safeProgress.toFixed(4));
    }

    function renderProgress() {
        var easing = prefersReducedMotion.matches ? 1 : 0.14;
        currentProgress += (targetProgress - currentProgress) * easing;

        if (Math.abs(targetProgress - currentProgress) < 0.001) {
            currentProgress = targetProgress;
        }

        setProgress(currentProgress);

        if (currentProgress !== targetProgress) {
            frameId = window.requestAnimationFrame(renderProgress);
            return;
        }

        frameId = null;
    }

    function queueRender() {
        if (frameId !== null) return;
        frameId = window.requestAnimationFrame(renderProgress);
    }

    function markScrolling() {
        progressRoot.classList.add('is-scrolling');
        window.clearTimeout(scrollingClassTimer);
        scrollingClassTimer = window.setTimeout(function () {
            progressRoot.classList.remove('is-scrolling');
        }, prefersReducedMotion.matches ? 80 : 180);
    }

    function syncProgress() {
        targetProgress = getScrollProgress();
        markScrolling();

        if (prefersReducedMotion.matches) {
            currentProgress = targetProgress;
            setProgress(currentProgress);
            return;
        }

        queueRender();
    }

    syncProgress();

    window.addEventListener('scroll', syncProgress, { passive: true });
    window.addEventListener('resize', syncProgress, { passive: true });
    window.addEventListener('load', syncProgress, { passive: true });

    if (typeof prefersReducedMotion.addEventListener === 'function') {
        prefersReducedMotion.addEventListener('change', syncProgress);
    } else if (typeof prefersReducedMotion.addListener === 'function') {
        prefersReducedMotion.addListener(syncProgress);
    }
});

/* ── Service Worker registration with auto-update ── */
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then((reg) => {
            // Check for updates every 60 seconds
            setInterval(() => reg.update(), 60000);

            // When a new SW is waiting, activate it and reload
            const applyUpdate = (worker) => {
                worker.addEventListener('statechange', () => {
                    if (worker.state === 'activated') {
                        window.location.reload();
                    }
                });
                worker.postMessage({ type: 'SKIP_WAITING' });
            };

            if (reg.waiting) {
                applyUpdate(reg.waiting);
            }

            reg.addEventListener('updatefound', () => {
                const newWorker = reg.installing;
                if (!newWorker) return;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        applyUpdate(newWorker);
                    }
                });
            });
        }).catch(() => {/* SW registration failed silently */});

        // Reload once when a new SW takes control
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (!refreshing) {
                refreshing = true;
                window.location.reload();
            }
        });
    });
}