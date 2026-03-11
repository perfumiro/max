
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
    const productNameEl = document.getElementById('productName');
    const languageStorageKey = 'ipordise-language';
    const supportedLanguages = ['en', 'fr'];

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
            product_fallback: 'Product'
        },
        fr: {
            lang_label: 'FR',
            announcement_html: '<div class="top-announcement-marquee"><span class="top-announcement-marquee-item">Parfums niche et designer, trouvez votre signature. <a href="#" class="top-announcement-link" data-announcement-target="all">VOIR COLLECTION</a></span><span class="top-announcement-marquee-item">Nouvelles references disponibles dans notre selection. <a href="#" class="top-announcement-link" data-announcement-target="new-in">VOIR NEW IN</a></span><span class="top-announcement-marquee-item" aria-hidden="true">Parfums niche et designer, trouvez votre signature. <a href="#" class="top-announcement-link" data-announcement-target="all">VOIR COLLECTION</a></span><span class="top-announcement-marquee-item" aria-hidden="true">Nouvelles references disponibles dans notre selection. <a href="#" class="top-announcement-link" data-announcement-target="new-in">VOIR NEW IN</a></span></div>',
            search_placeholder: 'Rechercher un parfum, une marque...',
            promo_btn: 'NEW COLLECTION',
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
            product_fallback: 'Produit'
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

                        <div class="flex-1 max-w-2xl mx-8 relative hidden md:block">
                            <div class="relative">
                                <input type="text" class="w-full bg-white text-gray-900 rounded-full py-2.5 pl-5 pr-12 focus:outline-none focus:ring-2 focus:ring-brand-red" placeholder="Search for perfumes, brands..." data-discover-search>
                                <button class="absolute right-0 top-0 mt-2.5 mr-4 text-gray-500 hover:text-brand-red">
                                    <i class="fas fa-search"></i>
                                </button>
                            </div>
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
                                <a href="${pagePath('login')}" class="header-icon-btn hover:text-brand-red transition" aria-label="Compte"><i class="far fa-user"></i></a>
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
                            <li><a href="${discoverPath}?filter=for-men" class="perfume-nav-link">HOMME</a></li>
                            <li><a href="${discoverPath}?filter=for-women" class="perfume-nav-link">WOHOMME</a></li>
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
                            <p class="text-gray-400 text-sm mb-6">The ultimate destination for luxury fragrances, cosmetics, and beauty care online. Elevate your everyday routine.</p>
                            <div class="flex space-x-4">
                                <a href="#" class="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-brand-red transition"><i class="fab fa-instagram"></i></a>
                                <a href="#" class="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-brand-red transition"><i class="fab fa-facebook-f"></i></a>
                                <a href="#" class="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-brand-red transition"><i class="fab fa-tiktok"></i></a>
                            </div>
                        </div>
                        <div>
                            <h4 class="font-bold text-lg mb-4">Customer Care</h4>
                            <ul class="space-y-2 text-gray-400 text-sm">
                                <li><a href="${pagePath('contact')}" class="hover:text-white transition">Contact Us</a></li>
                                <li><a href="${pagePath('shipping')}" class="hover:text-white transition">Shipping & Returns</a></li>
                                <li><a href="${pagePath('track-order')}" class="hover:text-white transition">Track Order</a></li>
                                <li><a href="${pagePath('faq')}" class="hover:text-white transition">FAQ</a></li>
                            </ul>
                        </div>
                        <div>
                            <h4 class="font-bold text-lg mb-4">About</h4>
                            <ul class="space-y-2 text-gray-400 text-sm">
                                <li><a href="${pagePath('our-story')}" class="hover:text-white transition">Our Story</a></li>
                                <li><a href="${pagePath('careers')}" class="hover:text-white transition">Careers</a></li>
                                <li><a href="${pagePath('store-locator')}" class="hover:text-white transition">Find a Store</a></li>
                                <li><a href="${pagePath('terms')}" class="hover:text-white transition">Terms & Conditions</a></li>
                            </ul>
                        </div>
                        <div>
                            <h4 class="font-bold text-lg mb-4">Newsletter</h4>
                            <p class="text-gray-400 text-sm mb-4">Subscribe to receive new arrivals, beauty tips, and more.</p>
                            <div class="flex">
                                <input type="email" placeholder="Your email address" class="bg-white/10 text-white placeholder-gray-500 px-4 py-2 rounded-l w-full focus:outline-none focus:ring-1 focus:ring-brand-red">
                                <a href="${pagePath('newsletter')}" class="bg-brand-red px-4 py-2 rounded-r font-bold hover:bg-brand-redHover transition">SUBSCRIBE</a>
                            </div>
                        </div>
                    </div>
                    <div class="border-t border-white/10 pt-8 text-center text-gray-500 text-sm">
                        <p>&copy; 2026 IPORDISE. All rights reserved.</p>
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
            return {
                label,
                priceText,
                isDecante: /decante/i.test(label),
                volumeLabel: label.replace(/decante\s*/i, '').trim()
            };
        }

        const parsed = splitSizeAndPrice(entry, fallbackPriceText);
        return {
            label: parsed.label,
            priceText: parsed.priceText,
            isDecante: /decante/i.test(parsed.label),
            volumeLabel: parsed.label.replace(/decante\s*/i, '').trim()
        };
    };

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
                '100ML'
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
            images: [
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/BLEU%20DE%20CHANEL%20Eau%20de%20Parfum%20spray/1.jpg',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/BLEU%20DE%20CHANEL%20Eau%20de%20Parfum%20spray/2.jpg',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/BLEU%20DE%20CHANEL%20Eau%20de%20Parfum%20spray/3.jpg',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/BLEU%20DE%20CHANEL%20Eau%20de%20Parfum%20spray/4.jpg'
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
            images: [
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Rabanne%20One%20Million%20Parfum/1.jpg',
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
            images: [
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Rabanne%20One%20Million%20Elixir%20Intense/1.webp',
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
            images: [
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Givenchy%20Gentleman%20Society%20Amber%20Eau%20de%20Parfum/1.jpg',
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
            images: [
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Givenchy%20Gentleman%20Society%20Nomade%20Eau%20de%20Parfum/1.webp',
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
            images: [
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Givenchy%20Gentleman%20Society%20Extreme%20Eau%20de%20Parfum/1.webp',
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
            images: [
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Gentleman%20Private%20Reserve%20Eau%20de%20Parfum/1.png',
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
            images: [
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Jean%20Paul%20Gaultier%20Scandal%20Elixir/1.jpg',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Jean%20Paul%20Gaultier%20Scandal%20Elixir/2.jpg',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Jean%20Paul%20Gaultier%20Scandal%20Elixir/3.jpg',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Jean%20Paul%20Gaultier%20Scandal%20Elixir/4.jpg',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Jean%20Paul%20Gaultier%20Scandal%20Elixir/5.jpg'
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
            images: [
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Azzaro%20The%20Most%20Wanted%20Parfum/1.webp',
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
            images: [
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Azzaro%20The%20Most%20Wanted%20Eau%20de%20Parfum%20Intense/1.webp',
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
            images: [
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Azzaro%20Forever%20Wanted%20Elixir%20Eau%20de%20Parfum/1.jpg',
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
            images: [
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Valentino%20Donna%20Born%20in%20Roma%20Eau%20de%20Parfum/1.webp',
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
                { label: 'Decante 10ML', priceText: '110DH' },
                { label: 'Decante 20ML', priceText: '220DH' },
                { label: 'Decante 30ML', priceText: '330DH' },
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
            images: [
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Valentino%20Uomo%20Born%20In%20Roma%20Coral%20Fantasy%20Eau%20de%20Toilette/1.webp',
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
            images: [
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Valentino%20Born%20in%20Rome%20Extradose/1.jpg',
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
            images: [
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Dior%20SAUVAGE%20Eau%20de%20Parfum/1.jpg',
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
            images: [
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/DIOR%20HOMME%20INTENSE%20Eau%20de%20Parfum/1.jpg',
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
            images: [
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Valentino%20Born%20In%20Roma%20Uomo%20Intense%20Eau%20de%20Parfum/1.webp',
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
            images: [
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Valentino%20Born%20In%20Roma%20Donna%20Intense%20Eau%20de%20Parfum/1.webp',
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
            images: [
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Valentino%20Uomo%20Born%20in%20Roma%20Eau%20de%20Toilette/1.jpg',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Valentino%20Uomo%20Born%20in%20Roma%20Eau%20de%20Toilette/2.jpg',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Valentino%20Uomo%20Born%20in%20Roma%20Eau%20de%20Toilette/3.jpg',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Valentino%20Uomo%20Born%20in%20Roma%20Eau%20de%20Toilette/4.jpg'
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
            images: [
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Emporio%20Armani%20Stronger%20With%20You%20Intensely/2.webp',
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
            images: [
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Armani%20Stronger%20With%20You%20Powerfully%20Eau%20de%20Parfum/1.webp',
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
            images: [
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Armani%20Stronger%20With%20You%20Absolutely%20Perfume/first.webp',
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
            images: [
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Yves%20Saint%20Laurent%20Y%20Eau%20de%20Parfum/1.webp',
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
            images: [
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Yves%20Saint%20Laurent%20Myslf%20Eau%20de%20Parfum/1.jpg',
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
            images: [
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Yves%20Saint%20Laurent%20MYSLF%20Le%20Parfum/1.webp',
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
            images: [
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Jean%20Paul%20Gaultier%20Le%20Male%20Elixir/1.webp',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Jean%20Paul%20Gaultier%20Le%20Male%20Elixir/2.webp',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Jean%20Paul%20Gaultier%20Le%20Male%20Elixir/3.webp',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Jean%20Paul%20Gaultier%20Le%20Male%20Elixir/4.webp'
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
            images: [
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Jean%20Paul%20Gaultier%20Le%20Male%20Le%20Parfum%20Eau%20de%20Parfum/1.webp',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Jean%20Paul%20Gaultier%20Le%20Male%20Le%20Parfum%20Eau%20de%20Parfum/2.webp',
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
            images: [
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Jean%20Paul%20Gaultier%20Le%20Beau%20Eau%20de%20Parfum/1.webp',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Jean%20Paul%20Gaultier%20Le%20Beau%20Eau%20de%20Parfum/2.jpg',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Jean%20Paul%20Gaultier%20Le%20Beau%20Eau%20de%20Parfum/3.jpg',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Jean%20Paul%20Gaultier%20Le%20Beau%20Eau%20de%20Parfum/4.jpg',
                'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Jean%20Paul%20Gaultier%20Le%20Beau%20Eau%20de%20Parfum/5.jpg'
            ]
        }
    };

    productDetailOverrides['jean paul gaultier le homme elixir eau de parfum'] = productDetailOverrides['jean paul gaultier le male elixir eau de parfum'];
    productDetailOverrides['jean paul gaultier le homme le parfum eau de parfum'] = productDetailOverrides['jean paul gaultier le male le parfum eau de parfum'];

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
        if (!cartButtons.length) return;

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
                    <p style="margin:0;font-size:0.75rem;color:#6b7280;">${size} added to cart</p>
                </div>
                <a href="${cartPath}" style="flex-shrink:0;background:#111827;color:#fff;font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;padding:0.45rem 0.9rem;border-radius:999px;text-decoration:none;">View Cart</a>
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
        return `${amount.toLocaleString('en-US', {
            minimumFractionDigits: hasDecimals ? 2 : 0,
            maximumFractionDigits: 2
        })} MAD`;
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

    const extractProductDataFromCard = (card) => {
        const nameEl = card.querySelector('h3, h4, .product-title');
        const brandEl = card.querySelector('p.text-xs');
        const currentPriceEl = card.querySelector('.text-xl.font-bold, .text-lg.font-bold, .related-price');
        const oldPriceEl = card.querySelector('.line-through');
        const discountEl = card.querySelector('.text-brand-red');
        const imageEl = card.querySelector('img');
        const reviewsEl = Array.from(card.querySelectorAll('span')).find((span) => /\(\d+\)/.test(span.textContent || ''));

        const name = (card.dataset.productName || nameEl?.textContent || 'Premium Product').trim();
        const brand = (card.dataset.productBrand || brandEl?.textContent || 'IPORDISE').trim();

        return {
            name,
            brand,
            price: '',
            oldPrice: (card.dataset.productOldPrice || oldPriceEl?.textContent || '').trim(),
            discount: (card.dataset.productDiscount || discountEl?.textContent || '').trim(),
            reviews: (card.dataset.productReviews || (reviewsEl?.textContent || '').replace(/[^0-9]/g, '') || '0').trim(),
            image: normalizeImagePathForCurrentPage(card.dataset.productImage || imageEl?.getAttribute('src') || '')
        };
    };

    const extractCurrentProductData = () => {
        const mainImageEl = document.getElementById('productMainImage');
        const reviewsEl = document.getElementById('productReviewsCount');
        const params = new URLSearchParams(window.location.search);

        return {
            name: (document.getElementById('productName')?.textContent || params.get('name') || 'Premium Product').trim(),
            brand: (document.getElementById('productBrand')?.textContent || params.get('brand') || 'IPORDISE').trim(),
            price: '',
            oldPrice: (document.getElementById('productOldPrice')?.textContent || params.get('oldPrice') || '').trim(),
            discount: (document.getElementById('productDiscount')?.textContent || params.get('discount') || '').trim(),
            reviews: ((reviewsEl?.textContent || params.get('reviews') || '').replace(/[^0-9]/g, '') || '0').trim(),
            image: normalizeImagePathForCurrentPage(mainImageEl?.getAttribute('src') || params.get('image') || '')
        };
    };

    const buildProductQuery = (data) => new URLSearchParams({
        name: data.name || '',
        brand: data.brand || '',
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

        if (!onDiscoverPage) {
            let hasRedirected = false;
            const redirectToDiscover = (query) => {
                if (hasRedirected) return;
                const trimmed = String(query || '').trim();
                if (!trimmed) return;
                hasRedirected = true;
                const params = new URLSearchParams();
                params.set('q', trimmed);
                window.location.href = `${discoverPath}?${params.toString()}`;
            };

            searchInputs.forEach((input) => {
                input.addEventListener('input', (event) => {
                    redirectToDiscover(event.target.value || '');
                });

                input.addEventListener('keydown', (event) => {
                    if (event.key === 'Enter') {
                        event.preventDefault();
                        redirectToDiscover(event.target.value || '');
                    }
                });

                const wrapper = input.closest('.relative') || input.parentElement;
                const button = wrapper ? wrapper.querySelector('button') : null;
                if (button) {
                    button.addEventListener('click', (event) => {
                        event.preventDefault();
                        redirectToDiscover(input.value || '');
                    });
                }
            });

            return;
        }

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

        if (!catalog.length && Array.isArray(relatedProductCatalog)) {
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
            const results = catalog.filter((item) => {
                const haystack = normalizeSearchText(`${item.name} ${item.brand}`);
                return tokens.every((token) => haystack.includes(token));
            });

            return results.slice(0, 6);
        };

        const renderMenu = (menu, items) => {
            if (!items.length) {
                menu.classList.add('hidden');
                menu.innerHTML = '';
                return;
            }

            menu.innerHTML = items.map((item, index) => `
                <button type="button" class="search-suggest-item" data-index="${index}">
                    <img src="${item.image || ''}" alt="" class="search-suggest-thumb" />
                    <span class="search-suggest-text">
                        <span class="search-suggest-name">${item.name}</span>
                        <span class="search-suggest-brand">${item.brand}</span>
                    </span>
                </button>
            `).join('');
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
                const suggestions = value.length < 2 ? [] : buildSuggestions(value);
                renderMenu(menu, suggestions);
            });

            input.addEventListener('focus', (event) => {
                const value = event.target.value || '';
                const suggestions = value.length < 2 ? [] : buildSuggestions(value);
                renderMenu(menu, suggestions);
            });

            menu.addEventListener('click', (event) => {
                const button = event.target.closest('.search-suggest-item');
                if (!button) return;

                const index = Number(button.dataset.index || 0);
                const items = buildSuggestions(input.value || '');
                const selected = items[index];
                if (!selected) return;

                navigateToProductPage(selected);
            });
        });

        document.addEventListener('click', (event) => {
            if (!event.target.closest('.search-suggest') && !event.target.closest('header input[type="text"]')) {
                closeAllMenus();
            }
        });
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
            name: 'Jean Paul Gaultier Le male Le parfum Eau de Parfum',
            brand: 'JEAN PAUL GAULTIER',
            price: '',
            gender: 'men',
            image: 'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Jean%20Paul%20Gaultier%20Le%20Male%20Le%20Parfum%20Eau%20de%20Parfum/1.webp'
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

    const renderRelatedProducts = (currentProductName, currentProductBrand, currentGender) => {
        const relatedTrack = document.querySelector('.related-track');
        if (!relatedTrack) return;

        const currentCanonicalName = canonicalProductName(currentProductName);
        const currentFamily = getProductFamilyKey(currentProductName);

        // Only show products from the exact same family — no brand fallback
        if (!currentFamily) {
            const section = relatedTrack.closest('section');
            if (section) section.style.display = 'none';
            return;
        }

        const familyMatches = relatedProductCatalog.filter((product) => (
            canonicalProductName(product.name) !== currentCanonicalName
            && getProductFamilyKey(product.name) === currentFamily
        ));

        const recommendations = familyMatches.slice(0, 6);
        if (!recommendations.length) {
            const section = relatedTrack.closest('section');
            if (section) section.style.display = 'none';
            return;
        }

        relatedTrack.innerHTML = recommendations.map((product) => {
            const sizeBadges = extractSizeBadges(product.name, product.price);
            const sizeBadgesHtml = sizeBadges.map((size, index) => (
                `<span class="text-[10px] font-bold border ${index === 0 ? 'border-gray-800' : 'border-gray-300 text-gray-500'} px-2 py-1 rounded">${size}</span>`
            )).join('');

            return `
                <article class="related-card js-product-link" data-product-name="${product.name}" data-product-brand="${product.brand}" data-product-price="${product.price}" data-product-old-price="" data-product-discount="" data-product-reviews="0" data-product-image="${product.image}">
                    <img src="${product.image}" alt="${product.name}" class="related-image">
                    <p class="related-brand">${product.brand}</p>
                    <h3 class="related-title">${product.name}</h3>
                    <div class="flex items-center gap-2 mt-2">
                        ${sizeBadgesHtml}
                    </div>
                    <div class="mt-3 pt-3 border-t border-gray-100">
                        <button type="button" class="js-card-add-btn w-full bg-brand-red text-white text-xs font-semibold py-2 rounded-md hover:bg-brand-redHover transition">Add to Cart</button>
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

    const assignReviewerNames = (productName, productOverride) => {
        const maleNames = ['Yassine A', 'Mehdi B', 'Omar E', 'Anas F', 'Hamza K', 'Rachid M'];
        const femaleNames = ['Salma B', 'Imane E', 'Nadia H', 'Sara A', 'Khadija R', 'Aya M'];
        const audience = inferFragranceAudience(productName, productOverride);

        let pool = maleNames;
        if (audience === 'women') pool = femaleNames;
        if (audience === 'unisex') pool = [
            maleNames[0],
            femaleNames[0],
            maleNames[1],
            femaleNames[1],
            maleNames[2],
            femaleNames[2]
        ];

        const summaryNames = Array.from(document.querySelectorAll('#tab-reviews .review-card h4'));
        const detailNames = Array.from(document.querySelectorAll('.customer-review-list .customer-review-item h3'));
        if (!summaryNames.length && !detailNames.length) return;

        const baseHash = getStableHashNumber(canonicalProductName(productName));
        const getNameForIndex = (index) => pool[(baseHash + index) % pool.length];

        summaryNames.forEach((el, index) => {
            el.textContent = getNameForIndex(index);
        });

        detailNames.forEach((el, index) => {
            el.textContent = getNameForIndex(index);
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
        'rabanne one million parfum': ['salty', 'white floral', 'amber', 'leather', 'warm spicy'],
        'rabanne one million elixir intense': ['vanilla', 'sweet', 'fruity', 'warm spicy', 'amber'],
        'givenchy gentleman society amber eau de parfum': ['amber', 'tobacco', 'woody', 'warm spicy', 'leather'],
        'givenchy gentleman society nomade eau de parfum': ['woody', 'aromatic', 'floral', 'earthy', 'vanilla'],
        'givenchy gentleman society extreme eau de parfum': ['aromatic', 'coffee', 'woody', 'warm spicy', 'vanilla'],
        'gentleman private reserve eau de parfum': ['powdery', 'boozy', 'woody', 'amber', 'sweet'],
        'jean paul gaultier scandal elixir': ['fruity', 'sweet', 'warm spicy', 'woody', 'amber'],
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
        'jean paul gaultier le male le parfum eau de parfum': ['warm spicy', 'vanilla', 'woody', 'amber', 'aromatic'],
        'jean paul gaultier le beau eau de parfum': ['fruity', 'sweet', 'vanilla', 'woody', 'amber']
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

    const initProductDetailPage = () => {
        if (!productNameEl) return;

        const params = new URLSearchParams(window.location.search);
        const productName = params.get('name') || productNameEl.textContent.trim();
        const productBrand = params.get('brand') || 'IPORDISE';
        const productPrice = params.get('price') || '0.00 MAD';
        const productOldPrice = params.get('oldPrice') || '';
        const productDiscount = params.get('discount') || '';
        const productReviews = params.get('reviews') || '0';
        const productImage = normalizeImagePathForCurrentPage(params.get('image') || '');
        const productOverride = productDetailOverrides[canonicalProductName(productName)] || null;

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
            const dnaRows = document.querySelectorAll('#fragranceProfile .product-dna-row');
            const profiles = [
                { fill: fp.longevity, label: fp.longevityLabel },
                { fill: fp.sillage, label: fp.sillageLabel },
                { fill: fp.season, label: fp.seasonLabel }
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
            subtitle.textContent = productOverride?.subtitle
                || `${productName} by ${resolvedBrand}: an elegant choice crafted for a modern signature and long-lasting trail.`;
        }

        renderMainAccords(productName, productOverride, subtitle?.textContent || '');

        const currentGender = getProductGenderKey(productName, productOverride, subtitle?.textContent || '');
        renderRelatedProducts(productName, resolvedBrand, currentGender);

        const longDescription = document.getElementById('productLongDescription');
        if (longDescription) {
            longDescription.textContent = productOverride?.longDescription
                || `${productName} balances freshness and depth for a sophisticated daily scent. The composition opens bright, evolves into a refined floral-spiced heart, then settles into a warm and memorable base that stays close and elegant on skin.`;
        }

        if (Array.isArray(productOverride?.notes)) {
            const noteCards = document.querySelectorAll('#tab-notes .note-card');
            productOverride.notes.forEach((note, index) => {
                const card = noteCards[index];
                if (!card) return;
                const titleEl = card.querySelector('h3');
                const textEl = card.querySelector('p');
                if (titleEl && note.title) titleEl.textContent = note.title;
                if (textEl && note.text) textEl.textContent = note.text;
            });
        }

        let hasPrices = parsePriceNumber(productPrice) > 0;
        let normalizedOverrideSizes = [];

        if (Array.isArray(productOverride?.sizes) && productOverride.sizes.length) {
            const sizeSelector = document.getElementById('sizeSelector');
            if (sizeSelector) {
                const allOpts = productOverride.sizes.map((entry) => normalizeSizeOptionEntry(entry, ''));
                normalizedOverrideSizes = allOpts;
                hasPrices = allOpts.some((o) => parsePriceNumber(o.priceText) > 0);
                const decanteOpts = allOpts.filter((o) => o.isDecante);
                const fullOpts = allOpts.filter((o) => !o.isDecante);

                const buildBtn = ({ label, priceText, isDecante }) => {
                    const vol = label.replace(/decante\s*/i, '').trim();
                    const priceLabel = priceText || 'Request price';
                    return `<button class="size-pill${isDecante ? ' is-decante' : ''}" type="button" data-label="${label}">
                        <span class="spill-indicator"></span>
                        <span class="spill-vol">${vol}</span>
                        <span class="spill-price">${priceLabel}</span>
                    </button>`;
                };

                if (decanteOpts.length && fullOpts.length) {
                    sizeSelector.innerHTML =
                        `<div class="size-group">
                            <span class="size-group-label"><i class="fas fa-flask"></i> Décante</span>
                            <div class="size-group-pills">${decanteOpts.map(buildBtn).join('')}</div>
                        </div>
                        <div class="size-group">
                            <span class="size-group-label"><i class="fas fa-bottle-droplet"></i> Full Bottle</span>
                            <div class="size-group-pills">${fullOpts.map(buildBtn).join('')}</div>
                        </div>`;
                } else {
                    sizeSelector.innerHTML = allOpts.map(buildBtn).join('');
                }
            }
        }

        const mainImage = document.getElementById('productMainImage');
        const stickyImage = document.getElementById('stickyImage');
        const productThumbs = document.getElementById('productThumbs');
        const overrideImages = Array.isArray(productOverride?.images)
            ? productOverride.images.map((src) => normalizeImagePathForCurrentPage(src)).filter(Boolean)
            : [];

        if (productThumbs && overrideImages.length) {
            productThumbs.innerHTML = overrideImages.map((src, index) => `
                <button class="product-thumb-btn${index === 0 ? ' is-active' : ''}" type="button" data-image="${src}">
                    <img src="${src}" alt="Thumb ${index + 1}" class="product-thumb-image">
                </button>
            `).join('');
        } else if (productThumbs && productImage) {
            const normalizedImage = normalizeImagePathForCurrentPage(productImage);
            productThumbs.innerHTML = `
                <button class="product-thumb-btn is-active" type="button" data-image="${normalizedImage}">
                    <img src="${normalizedImage}" alt="Thumb 1" class="product-thumb-image">
                </button>
            `;
        }

        const defaultImage = overrideImages[0] || productImage;
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
            const bLabel = btn.dataset.label || btn.textContent.trim();
            const parsed = normalizedOverrideSizes.find((entry) => entry.label === bLabel)
                || normalizeSizeOptionEntry(bLabel, productPrice);
            return {
                button: btn,
                label: parsed.label,
                priceText: parsed.priceText,
                unitPrice: parsePriceNumber(parsed.priceText)
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
        const setAddButtonsEnabled = (enabled) => {
            const sizeHasPrice = enabled && selectedSize && selectedSize.unitPrice > 0;
            [addToCartBtn, stickyAddToCartBtn].forEach((button) => {
                if (!button) return;
                if (!enabled) {
                    button.classList.add('hidden');
                    button.disabled = true;
                } else {
                    button.classList.remove('hidden');
                    button.disabled = false;
                    if (sizeHasPrice) {
                        button.className = 'product-cart-btn';
                        button.textContent = 'Add to Cart';
                    } else {
                        button.className = 'product-whatsapp-btn';
                        button.innerHTML = '<i class="fab fa-whatsapp"></i> Ask for Price on WhatsApp';
                    }
                }
            });
            if (qtyBoxContainer) {
                qtyBoxContainer.classList.toggle('hidden', !sizeHasPrice);
            }
        };

        const deliveryChipEl = document.getElementById('productDeliveryChip');
        const deliveryInfoEl = document.getElementById('productDeliveryInfo');

        const updateDisplayedPrice = () => {
            const selectedPrice = selectedSize?.priceText || '';
            const sizeHasPrice = selectedSize && selectedSize.unitPrice > 0;
            const isDecante = /decante/i.test(selectedSize?.label || '');
            const deliveryFee = isDecante ? '35 MAD' : '35 MAD (VAT included)';

            if (hasPrices) {
                if (mainPriceEl) {
                    const displayText = !selectedSize
                        ? 'Choose a size to see the price'
                        : sizeHasPrice ? selectedPrice : 'Price on Request';
                    mainPriceEl.textContent = displayText;
                    mainPriceEl.classList.toggle('text-gray-400', !sizeHasPrice);
                    mainPriceEl.classList.toggle('text-gray-900', !!sizeHasPrice);
                }
                if (stickyPriceEl) {
                    stickyPriceEl.textContent = sizeHasPrice ? selectedPrice : (selectedSize ? 'Ask on WhatsApp' : 'Choose size');
                }
                if (deliveryInfoEl) {
                    deliveryInfoEl.textContent = `In stock - Delivery in Morocco: ${deliveryFee}`;
                }
                syncPriceCardState(sizeHasPrice ? selectedPrice : '');
            } else {
                if (addToCartBtn && selectedSize) {
                    addToCartBtn.innerHTML = `<i class="fab fa-whatsapp"></i> Ask for Price — ${selectedSize.label}`;
                }
            }
            if (deliveryChipEl) {
                deliveryChipEl.innerHTML = `<i class="fas fa-truck text-brand-red"></i> Delivery fee: ${deliveryFee}`;
            }
        };

        // Show the correct info block and configure the CTA button based on price availability
        const productPriceCard = document.getElementById('productPriceCard');
        const productOndemandBox = document.getElementById('productOndemandBox');
        if (hasPrices) {
            if (productPriceCard) productPriceCard.removeAttribute('hidden');
            if (addToCartBtn) {
                addToCartBtn.className = 'hidden product-cart-btn';
                addToCartBtn.textContent = 'Add to Cart';
            }
        } else {
            if (productOndemandBox) productOndemandBox.removeAttribute('hidden');
            if (addToCartBtn) {
                addToCartBtn.className = 'hidden product-whatsapp-btn';
                addToCartBtn.innerHTML = '<i class="fab fa-whatsapp"></i> Ask for Price on WhatsApp';
            }
        }

        sizeButtons.forEach((btn) => btn.classList.remove('is-active'));
        updateDisplayedPrice();
        setAddButtonsEnabled(false);

        sizeOptions.forEach((option) => {
            option.button.addEventListener('click', () => {
                sizeButtons.forEach((item) => item.classList.remove('is-active'));
                option.button.classList.add('is-active');
                selectedSize = option;
                updateDisplayedPrice();
                setAddButtonsEnabled(true);
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
            if (selectedSize.unitPrice > 0) {
                const qty = qtyValue ? Number(qtyValue.textContent) || 1 : 1;
                const nextItems = readCart();
                const existingIndex = nextItems.findIndex(
                    (item) => item.name === productName && item.brand === resolvedBrand && item.size === selectedSize.label
                );
                if (existingIndex >= 0) {
                    nextItems[existingIndex].quantity = Math.min(99, Number(nextItems[existingIndex].quantity || 1) + qty);
                } else {
                    nextItems.unshift({
                        id: `${canonicalProductName(productName)}-${canonicalProductName(selectedSize.label)}-${Date.now()}`,
                        name: productName,
                        brand: resolvedBrand,
                        size: selectedSize.label,
                        quantity: qty,
                        priceText: selectedSize.priceText,
                        unitPrice: selectedSize.unitPrice,
                        image: defaultImage || ''
                    });
                }
                writeCart(nextItems);
                // Flash button green then back to black
                [addToCartBtn, stickyAddToCartBtn].forEach((btn) => {
                    if (!btn) return;
                    btn.style.transition = 'background 0.2s ease';
                    btn.style.background = 'linear-gradient(135deg, #22c55e, #16a34a)';
                    btn.textContent = '✓ Added!';
                    setTimeout(() => {
                        btn.style.background = '';
                        btn.textContent = 'Add to Cart';
                    }, 1800);
                });
                showAddedToCartToast(productName, selectedSize.label);
            } else {
                const msg = `Bonjour IPORDISE 👋%0A%0AJe suis intéressé(e) par :%0A🌸 *${productName}*%0A📦 Taille : *${selectedSize.label}*%0A%0APourriez-vous me donner le prix et les détails de livraison ? Merci !`;
                window.open(`https://wa.me/212600000000?text=${msg}`, '_blank');
            }
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
                    priceText: '0 MAD',
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
                        <p class="wishlist-item-price">${item.price || 'Price on request'}</p>
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
                const isActive = button === activeButton;
                button.classList.toggle('bg-brand-dark', isActive);
                button.classList.toggle('text-white', isActive);
                button.classList.toggle('border', !isActive);
                button.classList.toggle('border-gray-300', !isActive);
                button.classList.toggle('text-gray-700', !isActive);
                button.classList.toggle('hover:border-brand-red', !isActive);
                button.classList.toggle('hover:text-brand-red', !isActive);
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
            const haystack = normalizeSearchText([
                card.dataset.productName,
                card.dataset.productBrand,
                card.dataset.productPrice
            ].filter(Boolean).join(' '));
            const tokens = normalizeSearchText(query).split(/\s+/).filter(Boolean);
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
        const getPageSize = () => (window.matchMedia('(max-width: 639px)').matches ? 10 : 9);
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

            const buttons = [];
            for (let page = 1; page <= totalPages; page += 1) {
                const isActive = page === currentPage;
                buttons.push(`
                    <button type="button" class="px-3 py-1.5 rounded-full text-xs sm:text-sm font-semibold ${isActive ? 'bg-brand-dark text-white' : 'border border-gray-300 text-gray-700 hover:border-brand-red hover:text-brand-red transition'}" data-discover-page="${page}">${page}</button>
                `);
            }

            paginationEl.innerHTML = buttons.join('');
            setPaginationVisible(true);

            paginationEl.querySelectorAll('[data-discover-page]').forEach((button) => {
                button.addEventListener('click', () => {
                    const nextPage = Number(button.dataset.discoverPage || 1);
                    if (Number.isFinite(nextPage)) {
                        currentPage = nextPage;
                        applyFilter();
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

            const orderedVisible = activeFilter === 'new-in'
                ? visibleCards
                    .slice()
                    .sort((a, b) => getCardAddedScore(b, addedIndexMap.get(b)) - getCardAddedScore(a, addedIndexMap.get(a)))
                    .slice(0, 15)
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

        filterButtons.forEach((button) => {
            button.addEventListener('click', () => {
                const filter = (button.dataset.discoverFilter || 'all').toLowerCase();
                setActiveButton(button);
                activeFilter = filter;
                currentPage = 1;
                applyFilter();
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

        const allowedFilters = new Set(['all', 'new-in', 'best-sellers', 'for-men', 'for-women', 'unisex', 'niche', 'arabian', 'designer', 'discovery-sets', 'offers']);
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
        activeQuery = savedQuery || urlQueryRaw || '';
        currentPage = savedPage || 1;
        if (activeQuery) {
            searchInputs.forEach((input) => {
                input.value = activeQuery;
            });
        }
        if (searchInputs.length) {
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
                const itemTotal = Number(item.unitPrice || 0) * Number(item.quantity || 1);
                return `
                    <div class="flex items-start justify-between gap-3 pb-3 border-b border-gray-100">
                        <div>
                            <p class="font-semibold text-gray-800">${item.name || 'Product'}</p>
                            <p class="text-xs text-gray-500">${item.size || '-'} · Qty ${Math.max(1, Number(item.quantity || 1))}</p>
                        </div>
                        <span class="font-semibold">${formatMad(itemTotal)}</span>
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

    const bindDragScroll = (carousel, onInteract) => {
        if (!carousel) return;

        let isDragging = false;
        let dragStartX = 0;
        let startScrollLeft = 0;
        let movedDuringDrag = false;
        const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;

        carousel.style.cursor = isCoarsePointer ? 'auto' : 'grab';

        const startDragging = (clientX) => {
            isDragging = true;
            movedDuringDrag = false;
            dragStartX = clientX;
            startScrollLeft = carousel.scrollLeft;
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

        carousel.addEventListener('touchstart', () => {
            onInteract?.();
        }, { passive: true });

        const stopDragging = () => {
            if (!isDragging) return;
            isDragging = false;
            carousel.style.cursor = isCoarsePointer ? 'auto' : 'grab';
            carousel.classList.remove('is-dragging-carousel');
        };

        window.addEventListener('mouseup', stopDragging);
        carousel.addEventListener('mouseleave', stopDragging);

        carousel.addEventListener('click', (event) => {
            if (!movedDuringDrag) return;
            event.preventDefault();
            event.stopPropagation();
            movedDuringDrag = false;
        }, true);
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

        setupCarouselIndicator(carouselId);
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
            const step = Math.max(240, Math.round(carousel.clientWidth * 0.7));
            const delta = direction === 'prev' ? -step : step;
            carousel.scrollBy({ left: delta, behavior: 'smooth' });
        };

        prevButton.addEventListener('click', () => scrollCarousel('prev'));
        nextButton.addEventListener('click', () => scrollCarousel('next'));
    };

    shuffleFlashOffersDaily();
    // Always reset carousel to the first product on page load
    const _pcReset = document.getElementById('productCarousel');
    if (_pcReset) { _pcReset.scrollLeft = 0; }
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

    limitNewArrivalsToLatest();
    initCarousel('productCarousel');
    initCarousel('brandCarousel');
    initCarousel('newArrivalsCarousel');
    enableCarouselAutoplay('brandCarousel', 180, 2400);
    bindSectionCarouselNav('flashOffersSection', 'productCarousel');
    bindSectionCarouselNav('newArrivalsSection', 'newArrivalsCarousel');

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

        links.forEach((link) => {
            link.addEventListener('click', (event) => {
                event.preventDefault();

                const nextVideoSrc = (link.getAttribute('data-video-src') || '').trim();
                if (nextVideoSrc && frame.getAttribute('src') !== nextVideoSrc) {
                    frame.setAttribute('src', nextVideoSrc);
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

        const form = document.getElementById('loginForm') || document.querySelector('main form[action="#"]');
        const consentCheckbox = document.getElementById('loginLegalConsent');
        const submitButton = document.getElementById('loginSubmitBtn');
        const messageEl = document.getElementById('loginLegalConsentMessage');
        const passwordInput = document.getElementById('loginPasswordInput');
        const passwordToggle = document.querySelector('[data-password-toggle]');

        if (!form || !consentCheckbox || !submitButton || !messageEl) return;

        if (passwordInput && passwordToggle && passwordToggle.dataset.bound !== 'true') {
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
        }

        const syncLoginState = () => {
            const isAccepted = consentCheckbox.checked;
            submitButton.disabled = !isAccepted;
            submitButton.setAttribute('aria-disabled', String(!isAccepted));
            submitButton.classList.toggle('opacity-50', !isAccepted);
            submitButton.classList.toggle('cursor-not-allowed', !isAccepted);
            messageEl.classList.toggle('hidden', isAccepted);
        };

        form.addEventListener('submit', (event) => {
            if (consentCheckbox.checked) return;
            event.preventDefault();
            syncLoginState();
        });

        consentCheckbox.addEventListener('change', syncLoginState);
        syncLoginState();
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
        const interactionEvents = ['touchstart', 'click', 'scroll', 'keydown', 'mousemove'];
        const preferredVideoId = '0HDuzhQOhuM';

        if (!document.body) return;

        let ytPlayer = null;
        let isReady = false;
        let isPlaying = false;
        let isMuted = localStorage.getItem(storageKey) !== 'false';

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

        const removeInteractionListeners = () => {
            interactionEvents.forEach((eventName) => {
                document.removeEventListener(eventName, startAndUnmuteOnInteraction);
            });
        };

        const startAndUnmuteOnInteraction = () => {
            if (!ytPlayer || !isReady || !isMuted) return;
            ytPlayer.playVideo();
            ytPlayer.unMute();
            ytPlayer.setVolume(40);
            isMuted = false;
            persistMutedState();
            updateBtn();
            removeInteractionListeners();
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
                    removeInteractionListeners();
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

            if (isMuted) {
                ytPlayer.mute();
                ytPlayer.playVideo();
                interactionEvents.forEach((eventName) => {
                    document.addEventListener(eventName, startAndUnmuteOnInteraction, { passive: true });
                });
            } else {
                ytPlayer.unMute();
                ytPlayer.playVideo();
            }

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

    applyOfficialHeaderFooter();
    initBrandLogoDotAnimation();
    normalizeLegacyFrenchContent();
    initLanguageSwitcher();
    initMobileSearchToggle();
    initBackgroundMusic();
    initConsentBanner();
    initLoginLegalConsent();
    disableInspectTools();
    initSocialVideoSwitcher();
    initHeroOfferRotator();
    initProductBadgeRotation();
    bindProductLinks();
    initProductDetailPage();
    initCartPage();
    initCheckoutPage();
    initAccountMenu();
    initWishlistButtons();
    setHeaderCartCount();
    initDiscoverFilters();
    initHeaderSearchSuggestions();

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

        // Pause on hover / touch, resume on leave
        const galleryShell = autoSlideThumbsContainer.closest('.product-gallery-v2');
        if (galleryShell) {
            galleryShell.addEventListener('mouseenter', stopAutoSlide);
            galleryShell.addEventListener('mouseleave', startAutoSlide);
            galleryShell.addEventListener('touchstart', stopAutoSlide, { passive: true });
            galleryShell.addEventListener('touchend', () => { setTimeout(startAutoSlide, 4000); }, { passive: true });
        }

        startAutoSlide();
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
});
