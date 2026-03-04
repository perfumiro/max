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

    const translations = {
        en: {
            lang_label: 'EN',
            announcement_html: 'Delivery fee: 35 MAD in all Morocco cities. <a href="#" class="underline hover:text-gray-200">SHOP NOW!</a>',
            search_placeholder: 'Search for perfumes, brands, makeup...',
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
            announcement_html: 'Frais de livraison : 35 MAD dans toutes les villes du Maroc. <a href="#" class="underline hover:text-gray-200">J\'EN PROFITE !</a>',
            search_placeholder: 'Rechercher un parfum, une marque, du maquillage...',
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

        document.querySelectorAll('.header-lang-btn > span:first-child').forEach((label) => {
            label.textContent = t('lang_label');
        });

        const topAnnouncement = document.querySelector('body > div.bg-brand-red.text-white.text-center.py-2');
        if (topAnnouncement) {
            topAnnouncement.innerHTML = t('announcement_html');
        }

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
                Delivery fee: 35 MAD in all Morocco cities. <a href="#" class="top-announcement-link">SHOP NOW!</a>
            </div>
        `;

        const headerHtml = `
            <header class="bg-brand-dark text-white sticky top-0 z-50">
                <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div class="flex items-center justify-between h-20">
                        <div class="flex-shrink-0 flex items-center">
                            <a href="${indexPath}" class="font-serif text-3xl font-bold tracking-widest text-white">
                                IPORDISE<span class="text-brand-red">.</span>
                            </a>
                        </div>

                        <div class="flex-1 max-w-2xl mx-8 relative hidden md:block">
                            <div class="relative">
                                <input type="text" class="w-full bg-white text-gray-900 rounded-full py-2.5 pl-5 pr-12 focus:outline-none focus:ring-2 focus:ring-brand-red" placeholder="Search for perfumes, houses, notes...">
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
                                <a href="${pagePath('login')}" class="header-icon-btn hover:text-brand-red transition" aria-label="Compte"><i class="far fa-user"></i></a>
                                <a href="#" class="header-icon-btn hover:text-brand-red transition" aria-label="Wishlist"><i class="far fa-heart"></i></a>
                                <a href="${pagePath('cart')}" class="header-icon-btn hover:text-brand-red transition relative" aria-label="Panier">
                                    <i class="fas fa-shopping-bag"></i>
                                </a>
                            </div>
                        </div>
                    </div>
                </div>

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

    const productDetailOverrides = {
        'emporio armani stronger with you intensely edp': {
            brand: 'GIORGIO ARMANI',
            subtitle: 'Men\'s fragrance · Oriental Fougère · A bold, addictive signature with pink pepper, vanilla, and ambery woods.',
            longDescription: 'This addictive fougère fragrance unveils notes of pink pepper, vanilla, and an ambery woody accord. It reflects the personality of the modern man seeking a powerful scent to illuminate his intense love story. This intense masculine fragrance reveals warm heart notes of vanilla and vibrant ambery woody accords, contrasted by spicy touches of pink pepper. Its aged cognac hue perfectly embodies the intensity of this fragrance. BOTTLE: The clean lines and essential shapes characteristic of Giorgio Armani are reflected in the Emporio Armani bottle. Its simplicity conveys a profound sensuality, with curves reminiscent of masculine shoulders, and a round metallic cap that underscores understated elegance. Beneath this cap, intertwined rings symbolize a strong connection and unconditional love. Emporio Armani Stronger With You is a men\'s fragrance for bold men, belonging to the Oriental Fougere olfactory family. Because together, we are stronger.',
            sizes: [
                'Decante 10ML — 90DH',
                'Decante 20ML — 180DH',
                'Decante 30ML — 370DH',
                '50ML — 650DH',
                '100ML — 850DH'
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
            subtitle: 'Men\'s fragrance · Smoky Amber · A more intense and powerful signature with cherry, mandarin, lavender, vanilla, and amber woods.',
            longDescription: 'Stronger With You Powerfully reinvents the collection\'s iconic signature with a more intense, smoky, and powerful dimension. This Eau de Parfum opens with a vibrant burst of cherry and juicy mandarin, delivering immediate energy and luminous warmth. At its heart, Diva lavender blends with an aromatic spice accord, balancing freshness and intensity to express modern sophistication. At its base, the fragrance unveils a sensual foundation of creamy vanilla, smoky amber woods, and the iconic caramelized chestnut accord, the signature of the Stronger With You line. The result: an enveloping, addictive trail that lasts up to 24 hours. The perfume comes in an imposing red bottle with bold lines, topped with a blackened silver cap and adorned with the iconic motif of intertwined rings, a symbol of connection and strength.',
            sizes: [
                'Decante 10ML — 90DH',
                'Decante 20ML — 180DH',
                'Decante 30ML — 370DH',
                '50ML — 650DH',
                '100ML — 850DH'
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
            subtitle: 'Men\'s fragrance · Oriental Fougère · An irresistible and addictive signature inspired by the power of absolute love.',
            longDescription: 'GIORGIO ARMANI Stronger With You Absolutely Perfume. Stronger with You Absolutely by Giorgio Armani is an Oriental Fougère fragrance for men. This fragrance was launched in 2021. Olfactory pyramid of Stronger With You Absolutely Parfum: Stronger With You Absolutely Parfum by Giorgio Armani is inspired by the power of absolute love. A refined men\'s fragrance fueled by the addictive new rum accord. The bottle with an intense smoky lacquer envelops the iconic Emporio Armani You fragrance, bringing the absolute strength of the perfume to the bottle. Stronger With You Absolutely Parfum is an irresistible men\'s fragrance.',
            sizes: [
                'Decante 10ML — 90DH',
                'Decante 20ML — 180DH',
                'Decante 30ML — 370DH',
                '50ML — 650DH',
                '100ML — 850DH'
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
            subtitle: 'Men\'s fragrance · Clean Woody · A long-lasting and powerful YSL signature of lavender, cedar, geranium, and incense.',
            longDescription: 'YVES SAINT LAURENT Y Eau de Parfum for Men. Immerse yourself in the essence of the creative and successful man with Y Le Parfum, the fragrance that captures the spirit of YSL personified by legendary ambassador Lenny Kravitz. This fragrance embodies the "Why not?" philosophy that defines the YSL man. Y Le Parfum, the new interpretation of the iconic Y franchise, is a long-lasting, clean, woody fragrance that celebrates self-realization. This version, more intense and powerful than ever, fuses vibrant French lavender with the strength of American cedar, two exclusive ingredients of YSL Beauty. The fragrance is distinguished by the mentholated touch of iconic geranium and the deep sensuality of incense, creating a powerful and addictive olfactory statement. An aroma that reflects the strength and determination of the YSL man in every drop.',
            sizes: [
                'Decante 10ML — 90DH',
                'Decante 20ML — 180DH',
                'Decante 30ML — 370DH',
                '60ML — 650DH',
                '100ML — 850DH'
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
            subtitle: 'Men\'s fragrance · Floral Woody · A modern masculine signature with bergamot, orange blossom, patchouli, and Ambrofix™.',
            longDescription: 'YVES SAINT LAURENT Myslf Refillable Eau de Parfum. Yves Saint Laurent\'s new refillable men\'s fragrance is Myslf. An expression of the man you are, with all your nuances. A declaration of modern masculinity, embracing all its facets and emotions. YSL BEAUTY\'s first floral woody fragrance for a trail of modernity with contrasts. YSL Myslf men\'s fragrance opens with a fresh and vibrant accord of Calabrian bergamot and green bergamot. At its heart lies a pure and intense orange blossom absolute from Tunisia, created exclusively for YSL beauty. The fragrance finishes with a sensual and textured woody accord of Indonesian patchouli and Ambrofix™. A YSL icon in a bottle. Elegant. Fluid. The YSL Myslf men\'s fragrance comes in a black lacquered bottle with shades that reflect your own image. At its center, embedded in the glass, is the iconic YSL Cassandre logo.',
            sizes: [
                'Decante 10ML — 90DH',
                'Decante 20ML — 180DH',
                'Decante 30ML — 370DH',
                '60ML — 650DH',
                '100ML — 850DH'
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
            subtitle: 'Men\'s fragrance · Floral Woody · A new intense and sensual MYSLF signature with black pepper, orange blossom, woods, and vanilla.',
            longDescription: 'YVES SAINT LAURENT MYSLF Le Parfum Floral Woody Men\'s Fragrance. MYSLF Le Parfum, the new and intense floral woody men\'s fragrance designed to leave a sensual and lasting trail. A new affirmation of modern masculinity. The expression of the man you are, with all your facets and emotions. The fragrance opens with a sparkling and exotic accord of black pepper, which gives way to a radiant and rich heart of orange blossom. In the base notes, the sensuality of woods envelops a velvety infusion of vanilla, creating an irresistible trail that lingers on the skin. Matte black and the bold shine of YSL\'s Casandra. The bottle is a perfect play of contrasts that reflects the duality of the YSL man: bold and self-assured, sophisticated and sentimental. A style statement as complex as the man who wears it.',
            sizes: [
                'Decante 10ML — 90DH',
                'Decante 20ML — 180DH',
                'Decante 30ML — 370DH',
                '60ML — 650DH',
                '100ML — 850DH'
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
            subtitle: 'Men\'s fragrance · Aromatic Amber · Intense, sexy and addictive with lavender, tonka bean, mint and benzoin.',
            longDescription: 'Le Male Elixir Eau de Parfum, Jean Paul Gaultier\'s new sailor-inspired fragrance, has arrived. More intense and sexier than ever. When he steps aboard, Le Male Elixir unleashes a wave of heat. This men\'s fragrance is so intense that the gold melts, creating golden trails along its sleek torso and metallic case. Male Elixir takes the reins of sensuality, exuding the ultimate expression of sex appeal. Be careful not to touch its skin, you\'ll get burned! Male Elixir ignites all the senses, creating maximum addiction. Sunny tropical tonka bean blends with already legendary lavender and, with the animal magnetism of benzoin, creates an explosion of fresh mint and bergamot. Impossible not to melt with desire. With Jean Paul Gaultier\'s Le Male Elixir, the senses are awakened, desire burns, and gold flows freely. Dazzling and sexy.',
            sizes: [
                'Decante 10ML — 130DH',
                'Decante 20ML — 240DH',
                'Decante 30ML — 350DH',
                '75ML — 990DH',
                '125ML — 1350DH'
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
            subtitle: 'Men\'s fragrance · Woody Oriental · Intense elegance in a black and gold signature bottle.',
            longDescription: 'On the way to Le Male Le Parfum, the new men\'s fragrance from Jean Paul Gaultier! With its official black and gold packaging, this intense eau de parfum revisits the Le Male olfactory line with style and strength. An elegant, woody oriental trail, imbued with the charisma and power of a leader. Sailors to your stations! The captain is here, for an almost imminent departure.',
            sizes: [
                'Decante 10ML — 120DH',
                'Decante 20ML — 230DH',
                'Decante 30ML — 340DH',
                '75ML — 950DH',
                '125ML — 1290DH'
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
            subtitle: 'Men\'s fragrance · Woody Amber · Intense and sensual with tonka bean, sandalwood, ginger, pineapple, and ambergris.',
            longDescription: 'Le Beau Le Parfum, Men\'s Perfume, Intense Eau de Parfum. Le Beau Le Parfum, the new original and intense men\'s fragrance by Jean Paul Gaultier. While Jean Paul Gaultier created this fragrance in its purest form, it wasn\'t designed to be dressed up! The bottle, lacquered in black and green, boasts a sleek and muscular silhouette, adorned with a golden fabric leaf as if it were a single garment. The new Eau de Parfum Intense is an even more sensual temptation, with its exciting woody amber scent. Le Beau is a men\'s fragrance built around an addictive tonka bean, sandalwood, ginger, pineapple, and ambergris. A light yet powerful base for a seductive and ultra-sexy man.',
            sizes: [
                'Decante 10ML — 125DH',
                'Decante 20ML — 235DH',
                'Decante 30ML — 345DH',
                '75ML — 980DH',
                '125ML — 1320DH'
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

    const cartStorageKey = 'ipordise-cart-items';

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

        const count = readCart().reduce((sum, item) => sum + Math.max(1, Number(item.quantity || 1)), 0);

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

    const extractProductDataFromCard = (card) => {
        const nameEl = card.querySelector('h3, h4, .product-title');
        const brandEl = card.querySelector('p.text-xs');
        const currentPriceEl = card.querySelector('.text-xl.font-bold, .text-lg.font-bold, .related-price');
        const oldPriceEl = card.querySelector('.line-through');
        const discountEl = card.querySelector('.text-brand-red');
        const imageEl = card.querySelector('img');
        const reviewsEl = Array.from(card.querySelectorAll('span')).find((span) => /\(\d+\)/.test(span.textContent || ''));

        return {
            name: (card.dataset.productName || nameEl?.textContent || 'Premium Product').trim(),
            brand: (card.dataset.productBrand || brandEl?.textContent || 'IPORDISE').trim(),
            price: (card.dataset.productPrice || currentPriceEl?.textContent || '0.00 MAD').trim(),
            oldPrice: (card.dataset.productOldPrice || oldPriceEl?.textContent || '').trim(),
            discount: (card.dataset.productDiscount || discountEl?.textContent || '').trim(),
            reviews: (card.dataset.productReviews || (reviewsEl?.textContent || '').replace(/[^0-9]/g, '') || '0').trim(),
            image: normalizeImagePathForCurrentPage(card.dataset.productImage || imageEl?.getAttribute('src') || '')
        };
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
                const data = extractProductDataFromCard(card);
                const query = new URLSearchParams({
                    name: data.name,
                    brand: data.brand,
                    price: data.price,
                    oldPrice: data.oldPrice,
                    discount: data.discount,
                    reviews: data.reviews,
                    image: data.image
                });

                window.location.href = `${getProductPagePath()}?${query.toString()}`;
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
            name: 'Emporio Armani Stronger With You Intensely EDP',
            brand: 'GIORGIO ARMANI',
            price: '50ML 650DH · 100ML 850DH',
            image: 'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Emporio%20Armani%20Stronger%20With%20You%20Intensely/2.webp'
        },
        {
            name: 'Armani Stronger With You Powerfully Eau de Parfum',
            brand: 'GIORGIO ARMANI',
            price: '50ML 650DH · 100ML 850DH',
            image: 'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Armani%20Stronger%20With%20You%20Powerfully%20Eau%20de%20Parfum/1.webp'
        },
        {
            name: 'Armani Stronger With You Absolutely Perfume',
            brand: 'GIORGIO ARMANI',
            price: '50ML 650DH · 100ML 850DH',
            image: 'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Armani%20Stronger%20With%20You%20Absolutely%20Perfume/first.webp'
        },
        {
            name: 'Yves Saint Laurent Y Eau de Parfum',
            brand: 'YVES SAINT LAURENT',
            price: '60ML 650DH · 100ML 850DH',
            image: 'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Yves%20Saint%20Laurent%20Y%20Eau%20de%20Parfum/1.webp'
        },
        {
            name: 'Yves Saint Laurent Myslf Eau de Parfum',
            brand: 'YVES SAINT LAURENT',
            price: '60ML 650DH · 100ML 850DH',
            image: 'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Yves%20Saint%20Laurent%20Myslf%20Eau%20de%20Parfum/1.jpg'
        },
        {
            name: 'Yves Saint Laurent MYSLF Le Parfum',
            brand: 'YVES SAINT LAURENT',
            price: '60ML 650DH · 100ML 850DH',
            image: 'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Yves%20Saint%20Laurent%20MYSLF%20Le%20Parfum/1.webp'
        },
        {
            name: 'Jean Paul Gaultier Le male Elixir Eau de Parfum',
            brand: 'JEAN PAUL GAULTIER',
            price: '75ML 990DH · 125ML 1350DH',
            image: 'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Jean%20Paul%20Gaultier%20Le%20Male%20Elixir/1.webp'
        },
        {
            name: 'Jean Paul Gaultier Le male Le parfum Eau de Parfum',
            brand: 'JEAN PAUL GAULTIER',
            price: '75ML 950DH · 125ML 1290DH',
            image: 'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Jean%20Paul%20Gaultier%20Le%20Male%20Le%20Parfum%20Eau%20de%20Parfum/1.webp'
        },
        {
            name: 'Jean Paul Gaultier Le Beau Eau de Parfum',
            brand: 'JEAN PAUL GAULTIER',
            price: '75ML 980DH · 125ML 1320DH',
            image: 'https://raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/Jean%20Paul%20Gaultier%20Le%20Beau%20Eau%20de%20Parfum/1.webp'
        }
    ];

    const getProductFamilyKey = (name) => {
        const normalizedName = canonicalProductName(name);
        if (!normalizedName) return '';

        if (normalizedName.includes('stronger with you')) return 'armani-stronger-with-you';
        if (normalizedName.includes('myslf')) return 'ysl-myslf';
        if (normalizedName.startsWith('yves saint laurent y ')) return 'ysl-y';
        if (normalizedName.includes('le male')) return 'jpg-le-male';
        if (normalizedName.includes('le beau')) return 'jpg-le-beau';
        return '';
    };

    const extractSizeBadges = (priceText) => {
        const parts = String(priceText || '')
            .split(/Â·|·|\||,/)
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

    const renderRelatedProducts = (currentProductName, currentProductBrand) => {
        const relatedTrack = document.querySelector('.related-track');
        if (!relatedTrack) return;

        const currentCanonicalName = canonicalProductName(currentProductName);
        const currentFamily = getProductFamilyKey(currentProductName);
        const currentCanonicalBrand = canonicalProductName(currentProductBrand);

        const familyMatches = relatedProductCatalog.filter((product) => (
            canonicalProductName(product.name) !== currentCanonicalName
            && getProductFamilyKey(product.name) === currentFamily
        ));

        const fallbackBrandMatches = relatedProductCatalog.filter((product) => (
            canonicalProductName(product.name) !== currentCanonicalName
            && canonicalProductName(product.brand) === currentCanonicalBrand
        ));

        const merged = [...familyMatches];
        fallbackBrandMatches.forEach((product) => {
            const alreadyIncluded = merged.some((item) => canonicalProductName(item.name) === canonicalProductName(product.name));
            if (!alreadyIncluded) merged.push(product);
        });

        const recommendations = merged.slice(0, 4);
        if (!recommendations.length) return;

        relatedTrack.innerHTML = recommendations.map((product) => {
            const sizeBadges = extractSizeBadges(product.price);
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
                        <button type="button" class="js-card-add-btn w-full bg-brand-red text-white text-xs font-semibold py-2 rounded-md hover:bg-brand-redHover transition">Ajouter au panier</button>
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

        const reviewNameEls = document.querySelectorAll(
            '#tab-reviews .review-card h4, .customer-review-list .customer-review-item h3'
        );
        if (!reviewNameEls.length) return;

        const baseHash = getStableHashNumber(canonicalProductName(productName));
        reviewNameEls.forEach((el, index) => {
            const name = pool[(baseHash + index) % pool.length];
            el.textContent = name;
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

        renderRelatedProducts(productName, resolvedBrand);

        const subtitle = document.getElementById('productSubtitle');
        if (subtitle) {
            subtitle.textContent = productOverride?.subtitle
                || `${productName} by ${resolvedBrand}: an elegant choice crafted for a modern signature and long-lasting trail.`;
        }

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

        const getSizeOptionFromLabel = (label, fallbackPriceText) => {
            const normalized = String(label || '').trim();
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
                priceText: fallbackPriceText
            };
        };

        if (Array.isArray(productOverride?.sizes) && productOverride.sizes.length) {
            const sizeSelector = document.getElementById('sizeSelector');
            if (sizeSelector) {
                sizeSelector.innerHTML = productOverride.sizes
                    .map((size) => `<button class="size-pill" type="button">${getSizeOptionFromLabel(size, productPrice).label}</button>`)
                    .join('');
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

        const thumbButtons = document.querySelectorAll('#productThumbs .product-thumb-btn');
        thumbButtons.forEach((btn) => {
            btn.addEventListener('click', () => {
                const imageSrc = btn.dataset.image;
                if (!imageSrc) return;
                if (mainImage) mainImage.src = imageSrc;
                thumbButtons.forEach((item) => item.classList.remove('is-active'));
                btn.classList.add('is-active');
            });
        });

        const mainPriceEl = document.getElementById('productPrice');
        const stickyPriceEl = document.getElementById('stickyPrice');
        const addToCartBtn = document.getElementById('addToCartBtn');
        const stickyAddToCartBtn = document.getElementById('stickyAddToCartBtn');

        const sizeButtons = Array.from(document.querySelectorAll('#sizeSelector .size-pill'));
        const sizeOptions = sizeButtons.map((btn) => {
            const matchingRawSize = Array.isArray(productOverride?.sizes)
                ? productOverride.sizes.find((raw) => getSizeOptionFromLabel(raw, productPrice).label === btn.textContent.trim())
                : btn.textContent.trim();

            const parsed = getSizeOptionFromLabel(matchingRawSize || btn.textContent.trim(), productPrice);
            return {
                button: btn,
                label: parsed.label,
                priceText: parsed.priceText || productPrice,
                unitPrice: parsePriceNumber(parsed.priceText || productPrice)
            };
        });

        let selectedSize = null;

        const setAddButtonsEnabled = (enabled) => {
            [addToCartBtn, stickyAddToCartBtn].forEach((button) => {
                if (!button) return;
                button.classList.toggle('hidden', !enabled);
                button.disabled = !enabled;
                button.classList.toggle('opacity-50', !enabled);
                button.classList.toggle('cursor-not-allowed', !enabled);
            });
        };

        const updateDisplayedPrice = () => {
            const selectedPrice = selectedSize?.priceText || '';
            if (mainPriceEl) {
                mainPriceEl.textContent = selectedPrice || 'Select a size to view price';
                mainPriceEl.classList.toggle('text-gray-400', !selectedPrice);
                mainPriceEl.classList.toggle('text-gray-900', !!selectedPrice);
            }

            if (stickyPriceEl) {
                stickyPriceEl.textContent = selectedPrice || 'Choose size';
                stickyPriceEl.classList.toggle('text-gray-500', !selectedPrice);
                stickyPriceEl.classList.toggle('text-brand-dark', !!selectedPrice);
            }
        };

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

            const nextItems = readCart();
            const existingIndex = nextItems.findIndex((item) => (
                item.name === productName
                && item.brand === resolvedBrand
                && item.size === selectedSize.label
            ));

            if (existingIndex >= 0) {
                nextItems[existingIndex].quantity = Math.min(99, Number(nextItems[existingIndex].quantity || 1) + quantity);
            } else {
                nextItems.unshift({
                    id: `${canonicalProductName(productName)}-${canonicalProductName(selectedSize.label)}-${Date.now()}`,
                    name: productName,
                    brand: resolvedBrand,
                    size: selectedSize.label,
                    quantity,
                    priceText: selectedSize.priceText,
                    unitPrice: selectedSize.unitPrice,
                    image: defaultImage || ''
                });
            }

            writeCart(nextItems);
            window.location.href = getCartPagePath();
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
                        <p class="wishlist-item-price">${item.price || ''}</p>
                        <button class="wishlist-add-cart" type="button" data-id="${item.id}">Add to cart</button>
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

                    const cartItems = readCart();
                    const details = getWishlistItemCartDetails(wishlistItem.price);

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
            if (!card) return;

            const data = extractProductDataFromCard(card);
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

        if (!filterButtons.length || !productsGrid) return;

        const productCards = Array.from(productsGrid.querySelectorAll('.js-product-link'));
        if (!productCards.length) return;

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

        const applyFilter = (filter) => {
            let visibleCount = 0;

            productCards.forEach((card) => {
                const shouldShow = cardMatchesFilter(card, filter);
                card.classList.toggle('hidden', !shouldShow);
                if (shouldShow) {
                    visibleCount += 1;
                }
            });

            emptyState.classList.toggle('hidden', visibleCount !== 0);

            if (countEl) {
                countEl.textContent = String(visibleCount);
            }

            if (countLabelEl) {
                countLabelEl.textContent = `product${visibleCount === 1 ? '' : 's'} available`;
            }
        };

        filterButtons.forEach((button) => {
            button.addEventListener('click', () => {
                const filter = (button.dataset.discoverFilter || 'all').toLowerCase();
                setActiveButton(button);
                applyFilter(filter);
            });
        });

        const allowedFilters = new Set(['all', 'new-in', 'best-sellers', 'for-men', 'for-women', 'unisex', 'niche', 'arabian', 'designer', 'discovery-sets', 'offers']);
        const urlFilterRaw = new URLSearchParams(window.location.search).get('filter') || '';
        const urlFilter = urlFilterRaw.toLowerCase().trim();
        const initialFilter = allowedFilters.has(urlFilter) ? urlFilter : 'all';

        const defaultButton = filterButtons.find((button) => (button.dataset.discoverFilter || '').toLowerCase() === initialFilter)
            || filterButtons.find((button) => button.classList.contains('bg-brand-dark'))
            || filterButtons[0];

        setActiveButton(defaultButton);
        applyFilter((defaultButton.dataset.discoverFilter || 'all').toLowerCase());
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
        let activeTouchId = null;

        carousel.style.cursor = 'grab';

        const getTouchById = (touchList, touchId) => {
            for (let index = 0; index < touchList.length; index += 1) {
                if (touchList[index].identifier === touchId) {
                    return touchList[index];
                }
            }
            return null;
        };

        const startDragging = (clientX, touchId = null) => {
            isDragging = true;
            movedDuringDrag = false;
            activeTouchId = touchId;
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

        carousel.addEventListener('touchstart', (event) => {
            const firstTouch = event.changedTouches[0];
            if (!firstTouch) return;
            startDragging(firstTouch.clientX, firstTouch.identifier);
        }, { passive: true });

        carousel.addEventListener('touchmove', (event) => {
            if (!isDragging || activeTouchId === null) return;
            const activeTouch = getTouchById(event.touches, activeTouchId);
            if (!activeTouch) return;

            updateDragging(activeTouch.clientX);

            if (movedDuringDrag) {
                event.preventDefault();
            }
        }, { passive: false });

        carousel.addEventListener('touchend', (event) => {
            if (activeTouchId === null) return;
            const endedTouch = getTouchById(event.changedTouches, activeTouchId);
            if (!endedTouch) return;
            stopDragging();
        });

        carousel.addEventListener('touchcancel', () => {
            stopDragging();
        });

        const stopDragging = () => {
            if (!isDragging) return;
            isDragging = false;
            activeTouchId = null;
            carousel.style.cursor = 'grab';
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

    const startAutoCarousel = (carouselId, step, delay) => {
        const carousel = document.getElementById(carouselId);
        if (!carousel) return;

        let direction = 1;
        let paused = false;
        let isAutoAnimating = false;

        const animateScrollTo = (targetLeft, duration = 700) => {
            if (isAutoAnimating) return;

            const from = carousel.scrollLeft;
            const maxScrollLeft = Math.max(0, carousel.scrollWidth - carousel.clientWidth);
            const to = Math.max(0, Math.min(maxScrollLeft, targetLeft));

            if (Math.abs(to - from) < 1) return;

            isAutoAnimating = true;
            const start = performance.now();

            const easeInOutCubic = (t) => {
                if (t < 0.5) return 4 * t * t * t;
                return 1 - Math.pow(-2 * t + 2, 3) / 2;
            };

            const frame = (now) => {
                const elapsed = now - start;
                const progress = Math.min(1, elapsed / duration);
                const eased = easeInOutCubic(progress);
                carousel.scrollLeft = from + (to - from) * eased;

                if (progress < 1) {
                    requestAnimationFrame(frame);
                    return;
                }

                isAutoAnimating = false;
            };

            requestAnimationFrame(frame);
        };

        const pauseTemporarily = (duration = 2400) => {
            paused = true;
            window.clearTimeout(carousel.__resumeTimeout);
            carousel.__resumeTimeout = window.setTimeout(() => {
                paused = false;
            }, duration);
        };

        bindDragScroll(carousel, () => pauseTemporarily(3200));

        carousel.addEventListener('mouseenter', () => {
            paused = true;
        });

        carousel.addEventListener('mouseleave', () => {
            paused = false;
        });

        carousel.addEventListener('wheel', () => pauseTemporarily(), { passive: true });

        setInterval(() => {
            if (paused || isAutoAnimating) return;

            const maxScrollLeft = carousel.scrollWidth - carousel.clientWidth;
            if (maxScrollLeft <= 0) return;

            if (carousel.scrollLeft >= maxScrollLeft - 8) {
                direction = -1;
            } else if (carousel.scrollLeft <= 8) {
                direction = 1;
            }

            animateScrollTo(carousel.scrollLeft + (step * direction));
        }, delay);

        setupCarouselIndicator(carouselId);
    };

    startAutoCarousel('productCarousel', 240, 2300);
    startAutoCarousel('brandCarousel', 220, 2200);
    startAutoCarousel('newArrivalsCarousel', 240, 2400);

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

        setInterval(() => {
            const maxScrollLeft = testimonialCarousel.scrollWidth - testimonialCarousel.clientWidth;
            if (maxScrollLeft <= 0) return;

            const nearEnd = testimonialCarousel.scrollLeft >= maxScrollLeft - 12;
            if (nearEnd) {
                testimonialCarousel.scrollTo({ left: 0, behavior: 'smooth' });
                return;
            }

            testimonialCarousel.scrollBy({
                left: getStep(),
                behavior: 'smooth'
            });
        }, 4200);
    }

    applyOfficialHeaderFooter();
    normalizeLegacyFrenchContent();
    initLanguageSwitcher();
    bindProductLinks();
    initProductDetailPage();
    initCartPage();
    initCheckoutPage();
    initAccountMenu();
    initWishlistButtons();
    setHeaderCartCount();
    initDiscoverFilters();
});
