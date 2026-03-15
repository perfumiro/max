/**
 * IPORDISE – Full site French / English translation engine
 * Reads data-i18n, data-i18n-html, data-i18n-placeholder attributes
 * and wires into the existing language-switcher in script.js
 */
(function () {
    'use strict';

    /* ─────────────── TRANSLATION DICTIONARY ─────────────── */
    const dict = {
        /* ===== COMMON / SHARED ===== */
        'common.home': { fr: 'Accueil' },
        'common.shop_now': { fr: 'ACHETER' },
        'common.add_to_cart': { fr: 'Ajouter au panier' },
        'common.continue_shopping': { fr: 'Continuer les achats' },
        'common.search_placeholder': { fr: 'Rechercher un parfum, une marque…' },
        'common.breadcrumb_home': { fr: 'Accueil' },

        /* ===== FOOTER (shared) ===== */
        'footer.tagline': { fr: 'La destination ultime pour les parfums de luxe, les cosmétiques et les soins beauté en ligne.' },
        'footer.customer_service': { fr: 'Service Client' },
        'footer.contact': { fr: 'Contactez-nous' },
        'footer.shipping_returns': { fr: 'Livraison & Retours' },
        'footer.track_order': { fr: 'Suivre la commande' },
        'footer.faq': { fr: 'FAQ' },
        'footer.about': { fr: 'À Propos' },
        'footer.our_story': { fr: 'Notre Histoire' },
        'footer.careers': { fr: 'Carrières' },
        'footer.terms': { fr: 'Conditions générales' },
        'footer.privacy': { fr: 'Politique de confidentialité' },
        'footer.find_store': { fr: 'Trouver un magasin' },
        'footer.returns': { fr: 'Retours' },
        'footer.newsletter_title': { fr: 'Newsletter' },
        'footer.newsletter_desc': { fr: 'Abonnez-vous pour des offres exclusives et les nouveautés.' },
        'footer.newsletter_placeholder': { fr: 'Votre email' },
        'footer.newsletter_ph2': { fr: 'Votre adresse email' },
        'footer.subscribe_btn': { fr: "S'ABONNER" },
        'footer.copyright': { fr: '© 2026 IPORDISE. Tous droits réservés.' },
        'footer.support': { fr: 'Centre d\'assistance' },
        'footer.payment_methods': { fr: 'Modes de paiement acceptés' },
        'index.promotions_title': { fr: 'Promotions' },
        'footer.promo_flash': { fr: 'Offres Flash' },
        'footer.promo_newin': { fr: 'Nouvelles Arrivées' },
        'footer.promo_bestsellers': { fr: 'Meilleures Ventes' },
        'footer.promo_niche': { fr: 'Collection Niche' },
        'footer.promo_designer': { fr: 'Collection Designer' },
        'index.flash_sec': { fr: 'SEC' },
        'index.explore_link': { fr: 'Explorer la collection <i class="fas fa-arrow-right ml-2 text-xs"></i>' },

        /* ===== INDEX PAGE ===== */
        'index.page_title': { fr: 'IPORDISE – Parfums Premium & Beauté' },
        'index.trust_delivery': { fr: '<strong>Livraison gratuite</strong> dès 35 MAD' },
        'index.trust_returns': { fr: '<strong>Retours 14 jours</strong> sans tracas' },
        'index.trust_payment': { fr: '<strong>Paiement sécurisé</strong> & commande 1 clic' },
        'index.trust_authentic': { fr: '<strong>100% Authentique</strong> garanti' },
        'index.nav.all': { fr: 'TOUS LES PARFUMS' },
        'index.nav.men': { fr: 'HOMMES' },
        'index.nav.women': { fr: 'FEMMES' },
        'index.nav.unisex': { fr: 'UNISEXE' },
        'index.nav.niche': { fr: 'NICHE' },
        'index.nav.arabian': { fr: 'ARABIQUE' },
        'index.nav.designer': { fr: 'DESIGNER' },
        'index.nav.discovery': { fr: 'COFFRETS DÉCOUVERTE' },
        'index.nav.bestsellers': { fr: 'MEILLEURES VENTES' },
        'index.nav.newin': { fr: 'NOUVEAUTÉS' },
        'index.nav.offers': { fr: 'OFFRES' },
        'index.mobile.all': { fr: 'Tous les parfums' },
        'index.mobile.men': { fr: 'Hommes' },
        'index.mobile.women': { fr: 'Femmes' },
        'index.mobile.unisex': { fr: 'Unisexe' },
        'index.mobile.niche': { fr: 'Niche' },
        'index.mobile.designer': { fr: 'Designer' },
        'index.mobile.arabian': { fr: 'Arabique' },
        'index.mobile.bestsellers': { fr: 'Meilleures ventes' },
        'index.mobile.newin': { fr: 'Nouveautés' },
        'index.mobile.offers': { fr: 'Offres Flash' },
        'index.mobile.my_account': { fr: 'Mon compte' },
        'index.mobile.contact': { fr: 'Contactez-nous' },
        'index.quick.offers': { fr: 'Offres Flash' },
        'index.quick.newin': { fr: 'Nouveautés' },
        'index.quick.bestsellers': { fr: 'Meilleures ventes' },
        'index.quick.men': { fr: 'Hommes' },
        'index.quick.women': { fr: 'Femmes' },
        'index.quick.niche': { fr: 'Niche' },
        'index.quick.designer': { fr: 'Designer' },
        'index.hero_kicker': { fr: 'Semaine Beauté Célébration' },
        'index.hero_title': { fr: 'VOTRE BEAUTÉ,\nVOTRE POUVOIR.' },
        'index.hero_kicker_w': { fr: 'Édition Luxe Féminine' },
        'index.hero_title_w': { fr: 'SON PARFUM,<br>SON MONDE.' },
        'index.hero_offer_label': { fr: 'OFFRE EXCLUSIVE EN LIGNE' },
        'index.hero_offer_code': { fr: 'EMBALLAGE CADEAU OFFERT' },
        'index.hero_cta_perfumes': { fr: 'PARFUMS' },
        'index.hero_cta_men': { fr: 'HOMMES' },
        'index.hero_cta_women': { fr: 'FEMMES' },
        'index.flash_title': { fr: 'OFFRES FLASH' },
        'index.flash_subtitle': { fr: "Découvrez les parfums les plus recherchés aujourd'hui, des sélections niche rares et des coffrets édition limitée. Les offres flash sont disponibles 24 heures seulement." },
        'index.flash_ends': { fr: 'Se termine dans' },
        'index.flash_hrs': { fr: 'HRS' },
        'index.flash_min': { fr: 'MIN' },
        'index.flash_sec': { fr: 'SEC' },
        'index.add_to_cart': { fr: 'Ajouter au panier' },
        'index.view_all': { fr: 'VOIR TOUT' },
        'index.class2026_kicker': { fr: 'La Classe De' },
        'index.class2026_sub': { fr: "Les nouvelles fragrances les plus convoitées de l'année \u2014 sélectionnées avec soin & fraîchement disponibles." },
        'index.class2026_viewall': { fr: 'Voir tout' },
        'index.class2026_badge': { fr: 'Nouveau 2026' },
        'index.xerjoff_kicker': { fr: 'LA MAISON XERJOFF' },
        'index.xerjoff_title': { fr: 'HAUTE PARFUMERIE ITALIENNE.' },
        'index.xerjoff_copy': { fr: "Née à Turin, façonnée avec obsession. Les parfums XERJOFF sont des chefs-d\u2019\u0153uvre d'ingrédients rares, d\u2019orfèvrerie artistique et d\u2019un luxe sans compromis \u2014 où chaque flacon raconte une histoire d'excellence italienne." },
        'index.xerjoff_link': { fr: 'Explorer la Collection' },

        /* ===== CLIENT PROOF / TESTIMONIALS ===== */
        'index.metric_rating':    { fr: 'Note moyenne' },
        'index.metric_orders':    { fr: 'Commandes livrées' },
        'index.metric_clients':   { fr: 'Clients satisfaits' },
        'index.metric_authentic': { fr: 'Produits authentiques' },
        'index.proof_title': { fr: 'Ce que nos clients aiment chez IPORDISE' },
        'index.proof_sub':   { fr: 'De l\u2019emballage luxueux aux fragrances longue tenue, notre communauté partage ses avis après chaque commande.' },
        'index.proof_customer_casa':   { fr: 'Client(e) - Casablanca' },
        'index.proof_customer_rabat':  { fr: 'Client(e) - Rabat' },
        'index.proof_customer_tangier':{ fr: 'Client(e) - Tanger' },
        'index.proof_review_sara':    { fr: 'Le parfum était exactement comme décrit, élégant et longue tenue. La livraison était très rapide et l\u2019emballage était luxueux dès le premier contact.' },
        'index.proof_review_youssef': { fr: 'J\u2019ai commandé deux parfums, tous deux authentiques avec une excellente longévité. Le service client a répondu à toutes mes questions en quelques minutes.' },
        'index.proof_review_imane':   { fr: 'Belle sélection et prix honnêtes. La recommandation de parfum que j\u2019ai reçue correspondait parfaitement à mon style et j\u2019ai déjà passé une deuxième commande.' },

        /* ===== SCENT FINDER ===== */
        'index.sf_kicker':          { fr: 'Personnalisé Pour Vous' },
        'index.sf_title':           { fr: 'Trouvez Votre<br><em>Parfum Signature</em>' },
        'index.sf_sub':             { fr: 'Des orientaux boisés aux agrumes frais — découvrez des fragrances sélectionnées pour votre humeur, votre personnalité et chaque occasion.' },
        'index.sf_btn_explore':     { fr: 'Explorer la Collection' },
        'index.sf_btn_best':        { fr: 'Meilleures Ventes' },
        'index.sf_tag_him':         { fr: 'Pour Lui' },
        'index.sf_tag_her':         { fr: 'Pour Elle' },
        'index.sf_tag_niche':       { fr: 'Niche' },
        'index.sf_tag_arabian':     { fr: 'Oriental' },
        'index.sf_tag_designer':    { fr: 'Designer' },
        'index.sf_tag_unisex':      { fr: 'Unisexe' },
        'index.sf_tag_sets':        { fr: 'Coffrets Découverte' },
        'index.sf_stat_fragrances': { fr: 'Fragrances' },
        'index.sf_stat_brands':     { fr: 'Marques' },
        'index.sf_stat_authentic':  { fr: 'Authentique' },
        'index.sf_stat_rating':     { fr: 'Note Clients' },

        /* ===== SOCIAL VIDEO ===== */
        'index.social_kicker':      { fr: 'Réseaux Sociaux' },
        'index.social_title':       { fr: 'Regardez Notre Dernière Vidéo' },
        'index.social_sub':         { fr: 'Découvrez notre dernière publication, les temps forts de nos fragrances et les coulisses d\u2019IPORDISE.' },
        'index.social_placeholder': { fr: 'Sélectionnez une plateforme ci-dessus pour regarder notre contenu' },

        /* ===== STORE / MAP ===== */
        'index.store_kicker':     { fr: 'Nous Rendre Visite' },
        'index.store_title':      { fr: 'Notre Boutique à Tanger' },
        'index.store_sub':        { fr: 'Retrouvez IPORDISE à Tanger, Maroc. Venez pour des conseils parfumerie personnalisés et des exclusivités en magasin.' },
        'index.store_address':    { fr: 'Centre-ville, Tanger' },
        'index.store_hours':      { fr: 'Tous les jours : 10h00 - 21h00' },
        'index.store_directions': { fr: 'Obtenir l’itinéraire' },

        /* ===== ADVANTAGES ===== */
        'index.adv_kicker':      { fr: 'POURQUOI CHOISIR IPORDISE' },
        'index.adv_title':       { fr: 'La Différence IPORDISE' },
        'index.adv_delivery_h':  { fr: 'Livraison Offerte' },
        'index.adv_delivery_p':  { fr: 'À partir de 35 MAD — rapide &amp; fiable' },
        'index.adv_returns_h':   { fr: 'Satisfait ou Remboursé' },
        'index.adv_returns_p':   { fr: 'Retours sans tracas sous 14 jours, sans questions' },
        'index.adv_payment_h':   { fr: 'Paiement Sécurisé &amp; Achat en 1 Clic' },
        'index.adv_payment_p':   { fr: 'Paiement 100 % sécurisé, sans frais cachés' },

        /* ===== NEWSLETTER ===== */
        'index.news_title':         { fr: 'Abonnez-vous à notre newsletter pour les nouveautés et conseils parfumerie.' },
        'index.news_subtitle':      { fr: 'Restez connecté(e) avec IPORDISE.' },
        'index.news_ph_name':       { fr: 'Prénom *' },
        'index.news_ph_email':      { fr: 'Adresse e-mail *' },
        'index.news_required':      { fr: '* Champs obligatoires' },
        'index.news_gender_ph':     { fr: 'Genre *' },
        'index.news_gender_female': { fr: 'Femme' },
        'index.news_gender_male':   { fr: 'Homme' },
        'index.news_gender_other':  { fr: 'Autre' },
        'index.news_privacy':       { fr: 'J’ai lu la <a href="pages/privacy-policy.html" class="text-blue-500 hover:text-blue-700 underline transition ipordise-privacy-link">politique de confidentialité</a> et souhaite m’abonner à la newsletter IPORDISE. *' },
        'index.news_submit':        { fr: 'S’ABONNER' },

        'index.view_all_new': { fr: 'Voir toutes les nouveautés' },
        'index.new_arrivals_title': { fr: 'NOUVELLES ARRIVÉES' },
        'index.new_arrivals_subtitle': { fr: "Les toutes dernières fragrances sélectionnées pour leur caractère et leur excellence olfactive." },
        'index.categories_title': { fr: 'EXPLORER PAR CATÉGORIE' },
        'index.categories_sub': { fr: 'Trouvez votre parfum idéal dans notre collection organisée.' },
        'index.for_him': { fr: 'POUR LUI' },
        'index.for_her': { fr: 'POUR ELLE' },
        'index.unisex_cat': { fr: 'UNISEXE' },
        'index.niche_cat': { fr: 'NICHE' },
        'index.promotions_btn': { fr: 'PROMOTIONS' },
        'index.footer_customer_care': { fr: 'Service Client' },
        'index.footer_about': { fr: 'À Propos' },
        'index.footer_newsletter': { fr: 'Newsletter' },
        'index.footer_newsletter_desc': { fr: 'Abonnez-vous pour recevoir les nouveautés, conseils beauté et plus encore.' },
        'index.footer_newsletter_ph': { fr: 'Votre adresse email' },
        'index.footer_subscribe': { fr: "S'ABONNER" },
        'index.footer_copyright': { fr: '© 2026 IPORDISE. Tous droits réservés.' },

        /* ===== CONTACT PAGE ===== */
        'contact.page_title': { fr: 'IPORDISE – Contactez-nous' },
        'contact.announce': { fr: 'Notre équipe est disponible <strong style="color:#fff">Lun–Sam, 9h–20h</strong> pour vous aider.' },
        'contact.breadcrumb': { fr: 'Contactez-nous' },
        'contact.h1': { fr: 'Contactez-nous' },
        'contact.subtitle': { fr: "Vous avez une question, un problème de commande, ou envie de dire bonjour ? Nous serions ravis d'avoir de vos nouvelles." },
        'contact.get_in_touch': { fr: 'Nous contacter' },
        'contact.email_label': { fr: 'Email' },
        'contact.email_response': { fr: 'Nous répondons sous 24 heures' },
        'contact.whatsapp_label': { fr: 'WhatsApp' },
        'contact.whatsapp_response': { fr: 'Réponses rapides, Lun–Sam' },
        'contact.phone_label': { fr: 'Téléphone' },
        'contact.phone_response': { fr: 'Lun–Sam, 9:00–20:00' },
        'contact.address_label': { fr: 'Adresse' },
        'contact.address_value': { fr: 'Casablanca, Maroc' },
        'contact.find_stores': { fr: 'Voir tous les magasins' },
        'contact.send_message': { fr: 'Envoyer un message' },
        'contact.fullname_label': { fr: 'Nom complet' },
        'contact.fullname_ph': { fr: 'Votre nom' },
        'contact.email_form_label': { fr: 'Email' },
        'contact.subject_label': { fr: 'Sujet' },
        'contact.subject_ph': { fr: 'Choisir un sujet…' },
        'contact.subject_order': { fr: 'Problème de commande' },
        'contact.subject_delivery': { fr: 'Question de livraison' },
        'contact.subject_return': { fr: 'Demande de retour' },
        'contact.subject_product': { fr: 'Question produit' },
        'contact.subject_general': { fr: 'Question générale' },
        'contact.message_label': { fr: 'Message' },
        'contact.message_ph': { fr: 'Comment pouvons-nous vous aider ?' },
        'contact.submit_btn': { fr: 'Envoyer le message' },
        'contact.faq_title': { fr: 'FAQ' },
        'contact.faq_sub': { fr: 'Réponses rapides' },
        'contact.shipping_title': { fr: 'Livraison' },
        'contact.shipping_sub': { fr: 'Infos livraison' },
        'contact.returns_title': { fr: 'Retours' },
        'contact.returns_sub': { fr: 'Politique de retour' },
        'contact.track_title': { fr: 'Suivre' },
        'contact.track_sub': { fr: 'Suivi de commande' },

        /* ===== FAQ PAGE ===== */
        'faq.page_title': { fr: 'IPORDISE – Foire aux questions' },
        'faq.announce': { fr: 'Frais de livraison fixes <strong style="color:#fff">35 MAD</strong> partout au Maroc.' },
        'faq.h1': { fr: 'Foire aux questions' },
        'faq.subtitle': { fr: 'Tout ce que vous devez savoir sur les commandes, la livraison, les produits et les retours.' },
        'faq.orders_cat': { fr: 'Commandes' },
        'faq.q_place_order': { fr: 'Comment passer une commande ?' },
        'faq.a_place_order': { fr: "Parcourez notre catalogue, ajoutez des articles au panier, puis procédez à la caisse. Renseignez vos coordonnées de livraison et validez votre commande. Vous recevrez une confirmation par WhatsApp ou email." },
        'faq.q_modify_cancel': { fr: "Puis-je modifier ou annuler une commande après l'avoir passée ?" },
        'faq.a_modify_cancel': { fr: "Les modifications ou annulations sont possibles dans l'heure suivant la commande. Passé ce délai, la commande est en cours de traitement. Contactez-nous immédiatement via WhatsApp pour les demandes urgentes." },
        'faq.q_payment': { fr: 'Quels modes de paiement sont acceptés ?' },
        'faq.a_payment': { fr: "Nous acceptons le paiement à la livraison (COD) pour toutes les commandes au Maroc. D'autres méthodes sont en cours d'introduction — restez informé." },
        'faq.shipping_cat': { fr: 'Livraison' },
        'faq.q_shipping_cost': { fr: 'Combien coûte la livraison ?' },
        'faq.a_shipping_cost': { fr: 'La livraison est à un tarif fixe de <strong>35 MAD</strong> pour toutes les villes du Maroc, sans frais cachés.' },
        'faq.q_delivery_time': { fr: 'Combien de temps prend la livraison ?' },
        'faq.a_delivery_time': { fr: "La plupart des commandes nationales sont livrées dans les 24 à 72 heures suivant l'expédition. Les zones éloignées peuvent prendre légèrement plus de temps. Les commandes internationales prennent 3 à 7 jours ouvrables." },
        'faq.q_track': { fr: 'Puis-je suivre ma commande ?' },
        'faq.a_track': { fr: 'Oui. Une fois votre commande expédiée, vous recevrez un numéro de suivi. Vous pouvez utiliser notre page <a href="track-order.html" style="color:#e73c3c;font-weight:600">Suivi de commande</a> à tout moment.' },
        'faq.products_cat': { fr: 'Produits' },
        'faq.q_authentic': { fr: 'Tous les produits sont-ils 100% authentiques ?' },
        'faq.a_authentic': { fr: "Absolument. Chaque parfum et produit de beauté vendu sur IPORDISE provient de distributeurs agréés et est 100% authentique. Nous ne vendons pas d'imitations ni de testeurs." },
        'faq.q_samples': { fr: 'Des échantillons ou coffrets découverte sont-ils disponibles ?' },
        'faq.a_samples': { fr: "Oui ! Nous proposons des Coffrets Découverte qui vous permettent d'explorer plusieurs fragrances avant d'investir dans un flacon complet." },
        'faq.q_store': { fr: 'Comment conserver mon parfum ?' },
        'faq.a_store': { fr: "Conservez vos parfums à l'abri de la lumière directe, de la chaleur et de l'humidité. Rangez-les dans un endroit frais et sec, idéalement dans leur boîte d'origine." },
        'faq.returns_cat': { fr: 'Retours' },
        'faq.q_return_policy': { fr: 'Quelle est la politique de retour ?' },
        'faq.a_return_policy': { fr: 'Vous pouvez retourner les articles éligibles dans les <strong>14 jours</strong> suivant la livraison, à condition qu\'ils soient non ouverts, non utilisés et dans leur emballage d\'origine. Voir notre <a href="returns.html" style="color:#e73c3c;font-weight:600">Politique de retour</a>.' },
        'faq.q_refund_time': { fr: 'Combien de temps prend le remboursement ?' },
        'faq.a_refund_time': { fr: "Une fois votre retour inspecté et approuvé (généralement 1 à 2 jours ouvrables), le remboursement est traité dans les 3 à 5 jours ouvrables." },
        'faq.still_q': { fr: 'Vous avez encore une question ?' },
        'faq.still_q_sub': { fr: 'Notre équipe est disponible du lundi au samedi, de 9h à 20h.' },
        'faq.contact_support': { fr: 'Contacter le support' },

        /* ===== SHIPPING PAGE ===== */
        'shipping.page_title': { fr: 'IPORDISE – Livraison & Expédition' },
        'shipping.announce': { fr: 'Frais de livraison fixes <strong style="color:#fff">35 MAD</strong> partout au Maroc — rapide &amp; sécurisé.' },
        'shipping.breadcrumb': { fr: 'Livraison & Expédition' },
        'shipping.h1': { fr: 'Livraison & Expédition' },
        'shipping.subtitle': { fr: 'Délais clairs, frais transparents et une expérience de livraison fluide dans tout le Maroc.' },
        'shipping.perk_fee': { fr: 'Frais fixes 35 MAD' },
        'shipping.perk_time': { fr: 'Livraison 24–72h' },
        'shipping.perk_cities': { fr: 'Toutes les villes du Maroc' },
        'shipping.perk_safe': { fr: 'Sécurisé & assuré' },
        'shipping.perk_returns': { fr: 'Retours 14 jours' },
        'shipping.how_title': { fr: 'Comment ça marche' },
        'shipping.step1_h': { fr: 'Commande passée' },
        'shipping.step1_p': { fr: 'Vous passez votre commande et notre équipe reçoit une confirmation instantanément.' },
        'shipping.step2_h': { fr: 'Traitement & emballage' },
        'shipping.step2_p': { fr: "Votre commande est soigneusement vérifiée, emballée et préparée pour l'expédition sous 24 heures." },
        'shipping.step3_h': { fr: 'Remise au transporteur' },
        'shipping.step3_p': { fr: 'Votre colis est remis à notre partenaire livreur local de confiance avec un numéro de suivi.' },
        'shipping.step4_h': { fr: 'Livré à votre porte' },
        'shipping.step4_p': { fr: 'Livraison à domicile en 1 à 3 jours ouvrables. Paiement à la livraison accepté.' },
        'shipping.fees_title': { fr: 'Frais & délais' },
        'shipping.domestic_title': { fr: 'National — Tout le Maroc' },
        'shipping.domestic_sub': { fr: 'Toute ville, toute région' },
        'shipping.domestic_time': { fr: '1–3 jours ouvrables' },
        'shipping.intl_title': { fr: 'International' },
        'shipping.intl_sub': { fr: 'Europe, Golfe & ailleurs' },
        'shipping.intl_calc': { fr: 'Calculé à la caisse' },
        'shipping.intl_time': { fr: '3–7 jours ouvrables' },
        'shipping.returns_title': { fr: 'Retours & remboursements' },
        'shipping.returns_desc': { fr: 'Les produits éligibles non ouverts peuvent être retournés dans les <strong>14 jours</strong> suivant la livraison. Les remboursements sont traités après inspection qualité.' },
        'shipping.view_returns': { fr: 'Voir la politique de retour' },

        /* ===== RETURNS PAGE ===== */
        'returns.page_title': { fr: 'IPORDISE – Retours & Remboursements' },
        'returns.announce': { fr: '<strong style="color:#fff">Retours 14 jours</strong> — simples, transparents et sans tracas.' },
        'returns.breadcrumb': { fr: 'Retours & Remboursements' },
        'returns.h1': { fr: 'Retours & Remboursements' },
        'returns.subtitle': { fr: 'Besoin de renvoyer quelque chose ? Nous gardons le processus simple, transparent et sans stress.' },
        'returns.how_title': { fr: 'Comment retourner' },
        'returns.step1_h': { fr: 'Contactez-nous dans les 14 jours' },
        'returns.step1_p': { fr: 'Envoyez un email à <a href="mailto:support@ipordise.com" style="color:#e73c3c">support@ipordise.com</a> ou contactez-nous sur WhatsApp. Incluez votre numéro de commande et la raison.' },
        'returns.step2_h': { fr: 'Obtenez votre étiquette de retour' },
        'returns.step2_p': { fr: "Notre équipe vous enverra une étiquette de retour et des instructions dans les 24 heures suivant votre demande." },
        'returns.step3_h': { fr: "Emballez & expédiez l'article" },
        'returns.step3_p': { fr: "Placez l'article dans son emballage d'origine, scellé et non utilisé. Déposez-le au point col du transporteur désigné." },
        'returns.step4_h': { fr: 'Remboursement traité' },
        'returns.step4_p': { fr: "Une fois reçu et inspecté, votre remboursement est traité dans les 3 à 5 jours ouvrables." },
        'returns.window_title': { fr: 'Délai de 14 jours' },
        'returns.window_desc': { fr: 'Les demandes de retour doivent être soumises dans les 14 jours suivant la date de livraison.' },
        'returns.condition_title': { fr: "État d'origine" },
        'returns.condition_desc': { fr: "Les articles doivent être complètement non ouverts, non utilisés et retournés dans leur emballage d'origine avec les scellés intacts." },
        'returns.nonreturn_title': { fr: 'Articles non retournables' },
        'returns.nonreturn_desc': { fr: "Les parfums ouverts, les commandes personnalisées et les coffrets cadeaux ne peuvent pas être retournés pour des raisons d'hygiène." },
        'returns.questions': { fr: 'Des questions sur votre retour ?' },
        'returns.questions_sub': { fr: 'Notre équipe support est disponible Lun–Sam, 9h–20h.' },
        'returns.contact_btn': { fr: 'Contacter le support' },
        'returns.browse_faq': { fr: 'Parcourir la FAQ' },

        /* ===== TRACK ORDER PAGE ===== */
        'track.page_title': { fr: 'IPORDISE – Suivi de commande' },
        'track.announce': { fr: 'Toutes les commandes Maroc — <strong style="color:#fff">livraison 24–72h.</strong>' },
        'track.breadcrumb': { fr: 'Suivi de commande' },
        'track.h1': { fr: 'Suivre votre commande' },
        'track.subtitle': { fr: 'Entrez les détails de votre commande pour vérifier le statut de livraison et la date estimée.' },
        'track.form_title': { fr: 'Entrer les détails de suivi' },
        'track.order_label': { fr: 'Numéro de commande' },
        'track.order_ph': { fr: 'ex. IPD-2026-00123' },
        'track.email_label': { fr: 'Email ou téléphone' },
        'track.email_ph': { fr: 'Celui utilisé lors de la commande' },
        'track.submit_btn': { fr: 'Suivre la commande' },
        'track.info': { fr: 'Votre numéro de commande est inclus dans votre message de confirmation. Vérifiez votre WhatsApp ou boîte email.' },
        'track.stages_title': { fr: 'Étapes de livraison' },
        'track.stage1_h': { fr: 'Commande confirmée' },
        'track.stage1_sub': { fr: 'Reçue & en cours de vérification' },
        'track.stage2_h': { fr: 'En traitement' },
        'track.stage2_sub': { fr: "En cours d'emballage pour l'expédition" },
        'track.stage3_h': { fr: 'Expédiée' },
        'track.stage3_sub': { fr: 'En route vers vous' },
        'track.stage4_h': { fr: 'Livrée' },
        'track.stage4_sub': { fr: 'Livrée avec succès' },

        /* ===== OUR STORY PAGE ===== */
        'story.page_title': { fr: 'IPORDISE – Notre Histoire' },
        'story.announce': { fr: "<strong style='color:#fff'>Découvrez l'histoire</strong> derrière la destination parfum préférée du Maroc." },
        'story.breadcrumb': { fr: 'Notre Histoire' },
        'story.h1': { fr: "Née d'une passion<br><em class='not-italic' style='color:#e73c3c'>pour le parfum de luxe</em>" },
        'story.subtitle': { fr: "IPORDISE a débuté avec une mission simple : rendre les meilleures fragrances du monde accessibles à tous au Maroc — avec confiance, élégance et rapidité." },
        'story.mission_cat': { fr: 'Notre Mission' },
        'story.mission_h': { fr: "Parfum de luxe,<br>à la portée de tous" },
        'story.mission_p1': { fr: "Nous croyons que chaque personne mérite de porter une fragrance qui raconte son histoire. C'est pourquoi nous sélectionnons les meilleurs parfums niche et designer — authentifiés, magnifiquement emballés et livrés à votre porte à travers le Maroc." },
        'story.mission_p2': { fr: "De notre première vente en 2019 à des milliers d'amateurs de parfums aujourd'hui, notre engagement reste le même : authenticité, service exceptionnel et amour de tout ce qui est olfactif." },
        'story.fragrances': { fr: 'Fragrances' },
        'story.brands': { fr: 'Marques' },
        'story.customers': { fr: 'Clients satisfaits' },
        'story.rating': { fr: 'Note moyenne' },
        'story.journey_cat': { fr: 'Notre Parcours' },
        'story.2019_h': { fr: 'Les débuts' },
        'story.2019_p': { fr: 'IPORDISE a lancé avec une sélection de 50 fragrances des maisons les plus prestigieuses au monde, expédiées depuis Casablanca.' },
        'story.2021_h': { fr: 'Expansion des horizons' },
        'story.2021_p': { fr: "Nous avons élargi notre catalogue pour inclure des parfums niche et oud arabique, répondant à la demande de parfums exclusifs difficiles à trouver en magasin." },
        'story.2022_h': { fr: 'Beauté & bien-être' },
        'story.2022_p': { fr: "Extension vers le maquillage de luxe, les soins de la peau et les essentiels beauté — une destination complète pour l'amateur de beauté." },
        'story.2025_h': { fr: 'Lancement des Coffrets Découverte' },
        'story.2025_p': { fr: "Nous avons lancé nos populaires Coffrets Découverte — des samplers curatés pour explorer de nouvelles fragrances avant d'investir dans un flacon complet." },
        'story.2026_h': { fr: "Aujourd'hui & au-delà" },
        'story.2026_p': { fr: "Au service de dizaines de milliers d'amateurs de parfums à travers le Maroc, avec expédition le jour même et une communauté croissante." },
        'story.values_cat': { fr: 'Nos Valeurs' },
        'story.val1_h': { fr: '100% Authentique' },
        'story.val1_p': { fr: "Chaque produit provient de distributeurs agréés. Nous ne vendons jamais d'imitations, de produits du marché gris ou de flacons testeurs." },
        'story.val2_h': { fr: 'Client en premier' },
        'story.val2_p': { fr: "Notre équipe est animée par un désir sincère de vous aider à trouver votre fragrance parfaite. Votre satisfaction est notre mesure de succès." },
        'story.val3_h': { fr: 'Commerce responsable' },
        'story.val3_p': { fr: "Nous travaillons avec des fournisseurs éthiques, minimisons les déchets d'emballage et nous engageons à gérer une entreprise de luxe responsable." },

        'login.form_title': { fr: 'Bon retour parmi nous.' },
        'login.form_subtitle': { fr: 'Utilisez votre email et mot de passe pour accéder à votre compte, retrouver vos favoris et reprendre votre commande.' },
        'login.tab_signin': { fr: 'Se connecter' },
        'login.tab_signup': { fr: 'Créer un compte' },
        'login.email_label': { fr: 'Adresse email' },
        'login.email_ph': { fr: 'vous@exemple.com' },
        'login.password_label': { fr: 'Mot de passe' },
        'login.password_ph': { fr: 'Entrez votre mot de passe' },
        'login.remember_me': { fr: 'Rester connecté sur cet appareil' },
        'login.forgot_pw': { fr: 'Mot de passe oublié ?' },
        'login.submit_btn': { fr: 'Se connecter en toute sécurité' },
        'login.create_account_btn': { fr: 'Créer un nouveau compte' },
        'login.metric3_span': { fr: 'accès à votre liste de souhaits et profil' },
        'login.signup_btn': { fr: 'Créer un compte' },
        'login.existing_account_btn': { fr: 'J\'ai déjà un compte' },
        'checkout.payment_method': { fr: 'Mode de paiement' },
        'checkout.cash_on_delivery': { fr: 'Paiement à la livraison' },
        'support.contact_h': { fr: 'Contactez-nous' },
        'support.contact_p': { fr: 'Nos conseillers parfum répondent rapidement pour l\'aide produit, la livraison et les commandes.' },
        'support.track_h': { fr: 'Suivi de commande' },
        'support.track_p': { fr: 'Entrez les détails de votre commande pour vérifier le statut de livraison en temps réel.' },
        'support.email_ph': { fr: 'Adresse email' },
        'support.shipping_h': { fr: 'Livraison & Retours' },
        'support.faq_h': { fr: 'FAQ' },
        'support.story_h': { fr: 'Notre histoire' },
        'support.story_p': { fr: 'IPORDISE a été créé pour rendre la découverte de parfums de luxe simple, fiable et inspirante pour chaque client.' },
        'support.careers_h': { fr: 'Carrières' },
        'support.careers_p': { fr: 'Rejoignez notre équipe beauté en plein essor dans la vente, l\'e-commerce, la logistique et le service client.' },
        'support.stores_h': { fr: 'Trouver un magasin' },
        'support.stores_p': { fr: 'Visitez-nous à Casablanca, Rabat, Marrakech et Tanger pour des consultations de parfums en boutique.' },
        'support.terms_h': { fr: 'Conditions générales' },
        'support.terms_p': { fr: 'En utilisant les services IPORDISE, vous acceptez nos politiques couvrant le paiement, la livraison, les retours et l\'utilisation du compte.' },
        'login.announce': { fr: "Emballage cadeau offert - Code : <span class='top-announcement-code'>PARFUM15</span> - <a href='#' class='top-announcement-link'>ACHETER MAINTENANT!</a>" },
        'login.breadcrumb': { fr: 'Connexion au compte' },
        'login.kicker': { fr: 'Accès membre privé' },
        'login.h1': { fr: 'Entrez dans votre espace fragrance privé.' },
        'login.text': { fr: "Connectez-vous pour accéder à vos sélections sauvegardées, suivre vos livraisons, finaliser votre commande plus rapidement et conserver votre archive personnelle de parfums." },
        'login.metric1_strong': { fr: '1 clic' },
        'login.metric1_span': { fr: 'pour recommander vos parfums signatures' },
        'login.metric2_strong': { fr: 'En direct' },
        'login.metric2_span': { fr: 'suivi de chaque commande active' },
        'login.metric3_strong': { fr: '24/7' },
        'login.metric3_span': { fr: 'accès à votre liste de souhaits et profil' },
        'login.concierge_title': { fr: 'Accès conciergerie' },
        'login.concierge_hours': { fr: 'Lun - Sam · 09:00 - 20:00' },
        'login.concierge_desc': { fr: "Support compte, aide commande et conseils fragrance de notre équipe service client." },
        'login.concierge_link': { fr: 'Parler à un conseiller' },
        'login.aside_kicker': { fr: 'Expérience membre' },
        'login.aside_h': { fr: "Accès luxe conçu pour les clients fidèles." },
        'login.aside_p': { fr: "De la curation de liste de souhaits au suivi de livraison, votre compte IPORDISE rend chaque partie de votre parcours parfum élégante, sécurisée et rapide." },
        'login.card_title': { fr: 'Dans votre compte' },
        'login.card_subtitle': { fr: 'Contrôle de profil premium' },
        'login.feat1_h': { fr: 'Favoris sauvegardés' },
        'login.feat1_p': { fr: 'Gardez vos flacons et décants préférés prêts à revisiter.' },
        'login.feat2_h': { fr: 'Livraison suivie' },
        'login.feat2_p': { fr: "Suivez chaque expédition de la confirmation à votre porte." },
        'login.feat3_h': { fr: 'Commande rapide' },
        'login.feat3_p': { fr: "Revenez avec vos informations de profil et passez commande en moins de temps." },
        'login.stat1_h': { fr: 'Tableau de bord personnel' },
        'login.stat1_p': { fr: "Consultez commandes, favoris et informations de compte depuis un seul endroit." },
        'login.stat2_h': { fr: 'Accès protégé' },
        'login.stat2_p': { fr: "Connexion sécurisée grâce à une gestion de session chiffrée." },
        'login.stat3_h': { fr: 'Suivi de luxe' },
        'login.stat3_p': { fr: 'Restez informé des livraisons, retours et support conciergerie.' },
        'login.stat4_h': { fr: 'Découverte rapide' },
        'login.stat4_p': { fr: "Revenez aux collections vues et aux parfums aimés." },
        'login.benefit1': { fr: 'Recommandations de fragrances personnalisées pour votre profil' },
        'login.benefit2': { fr: "Historique de commandes rapide et suivi de livraison" },
        'login.benefit3': { fr: 'Flux de compte sécurisé avec protection des données fiable' },
        'login.meta_title': { fr: 'Support client' },
        'login.meta_p': { fr: "Besoin d'aide pour vous connecter ou vérifier une commande ? Nos conseillers aident pour l'accès au compte, le suivi de commande et les conseils produits." },
        'login.meta_link': { fr: 'Contacter le service client' },
        'login.form_kicker': { fr: 'Connexion sécurisée' },
        'login.form_badge': { fr: 'Accès compte de confiance' },

        /* ===== CART PAGE ===== */
        'cart.page_title': { fr: 'IPORDISE – Votre panier' },
        'cart.announce': { fr: "Frais de livraison fixes <strong style='color:#fff'>35 MAD</strong> partout au Maroc — rapide & sécurisé." },
        'cart.breadcrumb': { fr: 'Panier' },
        'cart.step1': { fr: 'Panier' },
        'cart.step2': { fr: 'Commande' },
        'cart.step3': { fr: 'Confirmation' },
        'cart.h1': { fr: 'Votre panier' },
        'cart.subtitle': { fr: 'Vérifiez et ajustez votre sélection avant de procéder au paiement sécurisé.' },
        'cart.continue': { fr: 'Continuer les achats' },
        'cart.order_summary': { fr: 'Récapitulatif de commande' },
        'cart.subtotal': { fr: 'Sous-total' },
        'cart.shipping': { fr: 'Livraison' },
        'cart.tax': { fr: 'TVA' },
        'cart.discount': { fr: 'Remise' },
        'cart.promo_ph': { fr: 'Code promo' },
        'cart.apply': { fr: 'Appliquer' },
        'cart.total': { fr: 'Total' },
        'cart.checkout_btn': { fr: 'Passer à la caisse' },
        'cart.trust_secure': { fr: 'Sécurisé' },
        'cart.trust_return': { fr: 'Retour 14 jours' },
        'cart.trust_authentic': { fr: '100% Authentique' },

        /* ===== CHECKOUT PAGE ===== */
        'checkout.page_title': { fr: 'IPORDISE – Paiement sécurisé' },
        'checkout.announce': { fr: "<strong style='color:#fff'>Paiement sécurisé</strong> — vos données sont protégées de bout en bout." },
        'checkout.back_cart': { fr: '← Retour au panier' },
        'checkout.breadcrumb_cart': { fr: 'Panier' },
        'checkout.breadcrumb': { fr: 'Commande' },
        'checkout.step1': { fr: 'Panier' },
        'checkout.step2': { fr: 'Commande' },
        'checkout.step3': { fr: 'Confirmation' },
        'checkout.h1': { fr: 'Paiement sécurisé' },
        'checkout.subtitle': { fr: 'Finalisez vos informations et vérifiez votre commande avant de la passer.' },
        'checkout.returning': { fr: 'Client fidèle ?' },
        'checkout.signin': { fr: 'Connectez-vous pour préremplir vos informations →' },
        'checkout.billing_title': { fr: 'Informations de facturation' },
        'checkout.required': { fr: 'Les champs marqués * sont obligatoires.' },
        'checkout.required_badge': { fr: '* Obligatoire' },
        'checkout.identity': { fr: 'Identité' },
        'checkout.first_name': { fr: 'Prénom' },
        'checkout.first_name_ph': { fr: 'Votre prénom' },
        'checkout.last_name': { fr: 'Nom' },
        'checkout.last_name_ph': { fr: 'Votre nom' },
        'checkout.delivery_address': { fr: "Adresse de livraison" },
        'checkout.address': { fr: 'Adresse' },
        'checkout.address_ph': { fr: 'Rue, quartier, bâtiment' },
        'checkout.city': { fr: 'Ville' },
        'checkout.city_ph': { fr: 'ex. Casablanca' },
        'checkout.country': { fr: 'Pays / Région' },
        'checkout.contact_section': { fr: 'Contact' },
        'checkout.order_summary': { fr: 'Récapitulatif de commande' },
        'checkout.subtotal': { fr: 'Sous-total' },
        'checkout.shipping': { fr: 'Livraison' },
        'checkout.tax': { fr: 'TVA' },
        'checkout.discount': { fr: 'Remise' },
        'checkout.total': { fr: 'Total' },
        'checkout.promo_ph': { fr: 'Code promo' },
        'checkout.apply': { fr: 'Appliquer' },
        'checkout.place_order': { fr: 'Passer la commande' },
        'checkout.trust_secure': { fr: 'Sécurisé' },
        'checkout.trust_return': { fr: 'Retour 14 jours' },
        'checkout.trust_authentic': { fr: '100% Authentique' },

        /* ===== CART PAGE - sidebar ===== */
        'cart.delivery_title':  { fr: 'Livraison' },
        'cart.delivery_desc':   { fr: 'Frais de livraison fixes de <strong>35 MAD</strong> dans toutes les villes du Maroc. Livraison express vers les grandes villes.' },
        'cart.benefits_title':  { fr: 'Avantages Shopping' },
        'cart.benefit1':        { fr: 'Emballage luxe sécurisé pour les parfums' },
        'cart.benefit2':        { fr: 'Retours faciles sous 14 jours, sans questions' },
        'cart.benefit3':        { fr: 'Produits 100% authentiques garantis' },
        'cart.we_accept':       { fr: 'Modes de paiement' },
        'cart.finder_store':    { fr: 'Trouver un magasin' },

        /* ===== CHECKOUT PAGE - additional ===== */
        'checkout.phone':              { fr: 'Téléphone' },
        'checkout.email_label':        { fr: 'Email' },
        'checkout.optional':           { fr: '(optionnel)' },
        'checkout.validation_msg':     { fr: 'Complétez les champs obligatoires ci-dessus pour activer Passer la commande.' },
        'checkout.notes_label':        { fr: 'Notes de commande' },
        'checkout.notes_ph':           { fr: 'Instructions spéciales, note cadeau, heure de livraison préférée…' },
        'checkout.cod_desc':           { fr: 'Payez en toute sécurité à la réception de votre colis.' },
        'checkout.consent_title':      { fr: 'J\'accepte la Politique de confidentialité et les Conditions générales.' },
        'checkout.consent_body':       { fr: 'J\'autorise IPORDISE à utiliser mes informations de commande pour le traitement de la livraison et le support.' },
        'checkout.consent_error':      { fr: 'Veuillez accepter la Politique de confidentialité et les Conditions générales pour passer votre commande.' },
        'checkout.confirm_hint':       { fr: 'Vos options de confirmation apparaîtront une fois tous les détails complétés.' },
        'checkout.confirm_whatsapp':   { fr: 'Confirmer via WhatsApp' },
        'checkout.confirm_email':      { fr: 'Confirmer par Email' },
        'checkout.delivery_title':     { fr: 'Livraison' },
        'checkout.delivery_morocco':   { fr: 'Toutes les villes du Maroc — fixe <strong>35 MAD</strong>' },
        'checkout.delivery_time':      { fr: '24–72 heures de livraison estimée' },
        'checkout.delivery_returns':   { fr: 'Retours faciles sous 14 jours' },

        /* ===== NEWSLETTER PAGE ===== */
        'newsletter.page_title': { fr: 'IPORDISE – Newsletter' },
        'newsletter.announce': { fr: "Rejoignez <strong style='color:#fff'>12 000+ abonnés</strong> qui reçoivent les nouvelles fragrances en avant-première." },
        'newsletter.breadcrumb': { fr: 'Newsletter' },
        'newsletter.h1': { fr: 'Restez connecté' },
        'newsletter.subtitle': { fr: 'Soyez le premier informé des offres exclusives, des nouvelles fragrances et des conseils beauté.' },
        'newsletter.subscribe_cat': { fr: 'Abonnez-vous maintenant' },
        'newsletter.card_h': { fr: 'Votre parcours fragrance commence ici' },
        'newsletter.card_p': { fr: "Accédez en exclusivité aux nouvelles arrivées, aux remises membres et aux guides olfactifs livrés directement dans votre boîte mail." },
        'newsletter.fname_ph': { fr: 'Prénom *' },
        'newsletter.email_ph': { fr: 'Adresse email *' },
        'newsletter.interest_ph': { fr: 'Je suis intéressé(e) par… (optionnel)' },
        'newsletter.opt_men': { fr: 'Parfums hommes' },
        'newsletter.opt_women': { fr: 'Parfums femmes' },
        'newsletter.opt_unisex': { fr: 'Unisexe & niche' },
        'newsletter.opt_arabian': { fr: 'Arabique & oud' },
        'newsletter.opt_discovery': { fr: 'Coffrets découverte' },
        'newsletter.opt_offers': { fr: 'Offres & promotions' },
        'newsletter.consent': { fr: "J'accepte de recevoir des emails marketing d'IPORDISE. Je peux me désabonner à tout moment. Voir notre <a href='privacy-policy.html' class='underline text-white/80'>Politique de confidentialité</a>." },
        'newsletter.submit_btn': { fr: "S'abonner — C'est gratuit" },
        'newsletter.perk1_h': { fr: 'Accès en avant-première' },
        'newsletter.perk1_p': { fr: 'Les nouvelles arrivées et éditions limitées arrivent dans votre boîte mail avant le public.' },
        'newsletter.perk2_h': { fr: 'Remises exclusives' },
        'newsletter.perk2_p': { fr: "Codes promo et ventes flash réservés aux abonnés, introuvables ailleurs." },
        'newsletter.perk3_h': { fr: 'Guides olfactifs' },
        'newsletter.perk3_p': { fr: "Guides de fragrances curatés, conseils de superposition et sélections saisonnières de nos experts." },
        'newsletter.no_spam': { fr: "Nous respectons votre boîte mail — aucun spam, pas plus de 2 emails par semaine. Désinscription à tout moment." },

        /* ===== CAREERS PAGE ===== */
        'careers.page_title': { fr: 'IPORDISE – Carrières' },
        'careers.announce': { fr: "Rejoignez une équipe passionnée qui construit la <strong style='color:#fff'>marque de parfum n°1 du Maroc</strong>." },
        'careers.breadcrumb': { fr: 'Carrières' },
        'careers.h1': { fr: 'Rejoindre notre équipe' },
        'careers.subtitle': { fr: "Nous construisons la marque de parfum la plus aimée du Maroc. Venez nous aider à façonner l'avenir du luxe e-commerce." },
        'careers.why_cat': { fr: 'Pourquoi travailler avec nous' },
        'careers.perk1_h': { fr: 'Avantages parfum' },
        'careers.perk1_p': { fr: 'Remises employés sur tous les produits' },
        'careers.perk2_h': { fr: 'Évolution de carrière' },
        'careers.perk2_p': { fr: 'Parcours de progression clairs' },
        'careers.perk3_h': { fr: 'Travail flexible' },
        'careers.perk3_p': { fr: 'Options télétravail & hybride' },
        'careers.perk4_h': { fr: 'Super culture' },
        'careers.perk4_p': { fr: 'Collaboratif, créatif & accueillant' },
        'careers.positions_cat': { fr: 'Postes ouverts' },
        'careers.job1_h': { fr: 'Conseiller(ère) de vente' },
        'careers.job1_badge': { fr: 'Sur site' },
        'careers.job1_p': { fr: "Guidez les clients vers leur fragrance signature parfaite. Vous serez le visage d'IPORDISE dans nos points de vente physiques." },
        'careers.job1_li1': { fr: 'Passion pour la parfumerie & beauté' },
        'careers.job1_li2': { fr: 'Excellentes compétences relationnelles' },
        'careers.job1_li3': { fr: 'Arabe & français requis' },
        'careers.job2_h': { fr: 'Coordinateur(trice) e-commerce' },
        'careers.job2_badge': { fr: 'Hybride' },
        'careers.job2_p': { fr: "Gérez les lancements de produits, les mises à jour d'inventaire et les campagnes digitales." },
        'careers.job2_li1': { fr: 'Expérience avec les plateformes e-commerce' },
        'careers.job2_li2': { fr: 'Esprit orienté données' },
        'careers.job2_li3': { fr: 'Excellente communication écrite' },
        'careers.job3_h': { fr: 'Créateur(trice) de contenu & réseaux sociaux' },
        'careers.job3_badge': { fr: 'Télétravail' },
        'careers.job3_p': { fr: "Créez du contenu visuel captivant pour Instagram, TikTok et YouTube. Donnez vie à notre univers parfum." },
        'careers.job3_li1': { fr: 'Portfolio de contenu créatif' },
        'careers.job3_li2': { fr: 'Connaissance de la parfumerie appréciée' },
        'careers.job3_li3': { fr: 'Compétences en montage vidéo requises' },
        'careers.job4_h': { fr: 'Spécialiste logistique & préparation de commandes' },
        'careers.job4_badge': { fr: 'Sur site' },
        'careers.job4_p': { fr: "Supervisez l'emballage des commandes, la coordination des transporteurs et la gestion des stocks." },
        'careers.job4_li1': { fr: 'Expérience logistique ou entrepôt' },
        'careers.job4_li2': { fr: 'Souci du détail' },
        'careers.job4_li3': { fr: 'Disponible pour les équipes du matin' },
        'careers.apply_btn': { fr: 'Postuler' },
        'careers.open_app_h': { fr: 'Vous ne voyez pas votre rôle ?' },
        'careers.open_app_p': { fr: "Envoyez-nous votre CV et une courte présentation. Nous sommes toujours ouverts aux talents exceptionnels." },
        'careers.open_app_btn': { fr: 'Envoyer une candidature spontanée' },

        /* ===== TERMS PAGE ===== */
        'terms.page_title': { fr: 'IPORDISE – Conditions générales' },
        'terms.announce': { fr: "En utilisant IPORDISE, vous acceptez nos <strong style='color:#fff'>Conditions générales</strong>." },
        'terms.breadcrumb': { fr: 'Conditions générales' },
        'terms.h1': { fr: 'Conditions générales' },
        'terms.subtitle': { fr: 'Veuillez lire attentivement ces conditions avant d\'utiliser IPORDISE.' },
        'terms.effective': { fr: 'En vigueur : 4 mars 2026' },
        'terms.s1_h': { fr: 'Acceptation des conditions' },
        'terms.s1_p': { fr: "En accédant au site IPORDISE et en passant commande, vous acceptez d'être lié par ces Conditions générales. Si vous n'êtes pas d'accord, veuillez ne pas utiliser nos services." },
        'terms.s2_h': { fr: 'Commandes & tarification' },
        'terms.s2_p1': { fr: "En passant une commande, vous confirmez que toutes les informations soumises sont exactes et complètes. IPORDISE se réserve le droit de refuser ou d'annuler des commandes en cas de fraude suspectée, de rupture de stock ou d'erreur de prix." },
        'terms.s2_p2': { fr: "Tous les prix sont affichés en Dirham marocain (MAD). Les prix et la disponibilité des produits peuvent changer sans préavis." },
        'terms.s3_h': { fr: 'Livraison' },
        'terms.s3_p': { fr: "Nous visons à expédier les commandes sous 24 heures. Les délais de livraison sont des estimations et peuvent varier. IPORDISE n'est pas responsable des retards causés par les transporteurs ou les cas de force majeure." },
        'terms.s4_h': { fr: 'Retours & remboursements' },
        'terms.s4_p': { fr: "Les retours sont acceptés dans les 14 jours suivant la livraison pour les articles éligibles non ouverts. Consultez notre <a href='returns.html' class='font-semibold hover:underline' style='color:#e73c3c'>Politique de retour</a> pour tous les détails. Les parfums ouverts ne peuvent pas être retournés pour des raisons d'hygiène." },
        'terms.s5_h': { fr: 'Propriété intellectuelle' },
        'terms.s5_p': { fr: "Tout le contenu sur IPORDISE — images, textes, logos et actifs de marque — reste la propriété d'IPORDISE ou de ses titulaires de droits. Aucun contenu ne peut être reproduit sans autorisation écrite préalable." },
        'terms.s6_h': { fr: 'Limitation de responsabilité' },
        'terms.s6_p': { fr: "IPORDISE ne saurait être tenu responsable de tout dommage indirect, accessoire ou consécutif découlant de l'utilisation de notre site ou de nos produits, dans la mesure permise par la loi marocaine." },
        'terms.s7_h': { fr: 'Droit applicable' },
        'terms.s7_p': { fr: "Ces Conditions sont régies par les lois du Royaume du Maroc. Tout litige sera soumis à la juridiction exclusive des tribunaux compétents de Casablanca." },
        'terms.contact_note': { fr: "Des questions sur ces conditions ? Contactez-nous à <a href='mailto:support@ipordise.com' class='font-semibold' style='color:#e73c3c'>support@ipordise.com</a>." },

        /* ===== PRIVACY POLICY PAGE ===== */
        'privacy.page_title': { fr: 'IPORDISE – Politique de confidentialité' },
        'privacy.announce': { fr: "Vos données sont <strong style='color:#fff'>toujours sécurisées</strong> avec IPORDISE. Nous ne vendons jamais vos informations personnelles." },
        'privacy.breadcrumb': { fr: 'Politique de confidentialité' },
        'privacy.h1': { fr: 'Politique de confidentialité' },
        'privacy.subtitle': { fr: "Comment IPORDISE collecte, utilise et protège vos informations personnelles." },
        'privacy.updated': { fr: 'Dernière mise à jour : 4 mars 2026' },
        'privacy.s1_h': { fr: 'Informations que nous collectons' },
        'privacy.s1_p': { fr: "Nous pouvons collecter votre nom, adresse email, numéro de téléphone, adresse de livraison, informations de facturation et historique de commandes lorsque vous passez une commande, créez un compte ou soumettez un formulaire." },
        'privacy.s2_h': { fr: 'Comment nous utilisons vos données' },
        'privacy.s2_p': { fr: 'Nous utilisons vos informations pour :' },
        'privacy.s2_li1': { fr: 'Traiter et livrer vos commandes.' },
        'privacy.s2_li2': { fr: 'Fournir des mises à jour de commande et le support client.' },
        'privacy.s2_li3': { fr: "Améliorer l'expérience sur le site et les recommandations de produits." },
        'privacy.s2_li4': { fr: "Envoyer des newsletters uniquement lorsque vous vous êtes explicitement abonné." },
        'privacy.s3_h': { fr: 'Partage des informations' },
        'privacy.s3_p': { fr: "Nous ne vendons pas vos données personnelles à des tiers. Les informations sont partagées uniquement avec des prestataires de confiance — livraison et paiement — lorsque strictement nécessaire pour exécuter votre commande." },
        'privacy.s4_h': { fr: 'Cookies & Analytics' },
        'privacy.s4_p': { fr: "Notre site peut utiliser des cookies pour mémoriser vos préférences, améliorer les performances et comprendre le comportement des visiteurs. Vous pouvez contrôler les paramètres des cookies via votre navigateur." },
        'privacy.s5_h': { fr: 'Conservation & sécurité des données' },
        'privacy.s5_p': { fr: "Nous conservons les données personnelles uniquement aussi longtemps que nécessaire. Nous appliquons des mesures techniques et organisationnelles raisonnables — y compris le stockage chiffré — pour protéger vos informations." },
        'privacy.s6_h': { fr: 'Vos droits' },
        'privacy.s6_p': { fr: "Vous pouvez à tout moment demander l'accès, la correction ou la suppression de vos informations personnelles, ou vous désabonner des emails marketing." },
        'privacy.s7_h': { fr: 'Nous contacter pour la confidentialité' },
        'privacy.s7_p': { fr: "Pour toute question liée à la vie privée, contactez-nous à <a href='mailto:support@ipordise.com' class='font-semibold hover:underline' style='color:#e73c3c'>support@ipordise.com</a> ou au <a href='tel:+212522000000' class='font-semibold hover:underline' style='color:#e73c3c'>+212 5 22 00 00 00</a>." },
        'privacy.review_note': { fr: "Cette Politique de confidentialité a été dernièrement révisée le <strong>4 mars 2026</strong>. Les modifications importantes seront communiquées par email ou avis sur le site au moins 14 jours avant leur entrée en vigueur." },

        /* ===== SUPPORT PAGE ===== */
        'support.page_title': { fr: 'IPORDISE – Service Client & Entreprise' },
        'support.announce': { fr: "Emballage cadeau offert - Code : <span class='top-announcement-code'>PARFUM15</span> - <a href='#' class='top-announcement-link'>ACHETER MAINTENANT!</a>" },
        'support.breadcrumb': { fr: 'Service Client & Entreprise' },
        'support.h1': { fr: 'Service Client & Entreprise' },
        'support.subtitle': { fr: "Tout en un seul endroit : support, suivi de commande, livraison, retours, histoire, carrières, informations légales et newsletter." },

        /* ===== STORE LOCATOR PAGE ===== */
        'locator.page_title': { fr: 'IPORDISE – Trouver un magasin' },
        'locator.announce': { fr: "Visitez-nous ou <strong style='color:#fff'>commandez en ligne</strong> avec livraison à votre porte." },
        'locator.breadcrumb': { fr: 'Trouver un magasin' },
        'locator.h1': { fr: 'Trouver un magasin' },
        'locator.subtitle': { fr: 'Visitez l\'un de nos showrooms pour découvrir notre collection complète de fragrances en personne.' },
        'locator.perk1': { fr: 'Sentez avant d\'acheter' },
        'locator.perk2': { fr: 'Consultants experts' },
        'locator.perk3': { fr: 'Emballage cadeau' },
        'locator.perk4': { fr: 'Stations testeurs' },
        'locator.our_stores': { fr: 'Nos magasins' },
        'locator.store_open': { fr: 'Ouvert maintenant' },
        'locator.whatsapp': { fr: 'Nous écrire sur WhatsApp' },
        'locator.directions': { fr: 'Obtenir l\'itinéraire' },
        'locator.not_near': { fr: 'Pas près d\'un magasin ?' },
        'locator.not_near_p': { fr: 'Achetez notre catalogue complet en ligne et bénéficiez d\'une livraison rapide partout au Maroc pour seulement 35 MAD.' },
        'locator.shop_online': { fr: 'Acheter en ligne' },

        /* ===== THANK YOU PAGE ===== */
        'thankyou.page_title': { fr: 'IPORDISE – Commande confirmée !' },        'thankyou.announce': { fr: "Votre commande est en route ! <strong style='color:#fff'>Merci pour votre achat chez IPORDISE.</strong>" },
        'thankyou.h1': { fr: 'Commande confirmée !' },
        'thankyou.p': { fr: "Merci pour votre commande. Nous la préparons déjà pour l'expédition. Vous recevrez une confirmation par WhatsApp ou email sous peu." },
        'thankyou.dispatch_note': { fr: "Les commandes sont généralement expédiées sous <strong>24 heures</strong> et livrées en <strong>1 à 3 jours ouvrables</strong>." },
        'thankyou.whats_next': { fr: 'Ce qui se passe ensuite' },
        'thankyou.step1_h': { fr: '1. Emballage' },
        'thankyou.step1_p': { fr: 'Vos articles sont soigneusement vérifiés et emballés sous 24 heures.' },
        'thankyou.step2_h': { fr: '2. En transit' },
        'thankyou.step2_p': { fr: 'Remis à notre transporteur avec un numéro de suivi envoyé.' },
        'thankyou.step3_h': { fr: '3. Livré' },
        'thankyou.step3_p': { fr: 'Livraison à domicile. Paiement à la livraison accepté.' },
        'thankyou.track_btn': { fr: 'Suivre ma commande' },
        'thankyou.continue_btn': { fr: 'Continuer les achats' },
        'thankyou.trust_secure': { fr: 'SSL Sécurisé' },
        'thankyou.trust_authentic': { fr: '100% Authentique' },
        'thankyou.trust_returns': { fr: 'Retours 14 jours' },

        /* ===== PRODUCT PAGE ===== */
        'product.page_title': { fr: 'IPORDISE – Détails du produit' },
        'product.add_to_cart': { fr: 'Ajouter au panier' },
        'product.add_to_wishlist': { fr: 'Ajouter à la liste de souhaits' },
        'product.description': { fr: 'Description' },
        'product.size': { fr: 'Taille' },

        /* -- Product page static elements -- */
        'product.trust_fast_delivery': { fr: 'Livraison rapide' },
        'product.trust_authentic':     { fr: '100 % Authentique' },
        'product.trust_returns':       { fr: 'Retours faciles' },
        'product.trust_secure_pay':    { fr: 'Paiement sécurisé' },
        'product.bc_perfumes':         { fr: 'Parfums' },
        'product.zoom_hint':           { fr: 'Survoler pour zoomer' },
        'product.accords_kicker':      { fr: 'Signature olfactive' },
        'product.accords_title':       { fr: 'Accords principaux' },
        'product.ondemand_title':      { fr: 'Prix sur demande' },
        'product.ondemand_sub':        { fr: 'Sélectionnez votre taille et ajoutez-la au panier. Nous vous confirmerons le prix avant de finaliser la commande.' },
        'product.chip_authentic':      { fr: '100% authentique' },
        'product.chip_returns':        { fr: 'Retours faciles' },
        'product.fragrance_profile':   { fr: 'Profil olfactif' },
        'product.dna_longevity':       { fr: 'Longévité' },
        'product.dna_sillage':         { fr: 'Sillage' },
        'product.dna_season':          { fr: 'Saison' },
        'product.trust_auth_title':    { fr: 'Authenticité garantie' },
        'product.trust_auth_sub':      { fr: 'Approvisionnement auprès de distributeurs officiels' },
        'product.trust_pack_title':    { fr: 'Emballage premium' },
        'product.trust_pack_sub':      { fr: 'Présentation luxueuse prête à offrir' },
        'product.trust_support_title': { fr: 'Support expert' },
        'product.trust_support_sub':   { fr: 'Conseils en parfumerie disponibles' },
        'product.share':               { fr: 'Partager' },
        'product.tab_details':         { fr: 'Détails' },
        'product.tab_notes':           { fr: 'Notes' },
        'product.tab_ingredients':     { fr: 'Ingrédients' },
        'product.tab_reviews':         { fr: 'Avis' },
        'product.related_title':       { fr: 'Vous aimerez aussi' },
        'product.related_link':        { fr: 'Explorer plus' },
        'product.more_reviews':        { fr: "Plus d'avis" },
        'product.rating_footnote':     { fr: "Calculé à partir d'avis clients vérifiés." },
        'product.adv_title':           { fr: 'Avantages IPORDISE' },
        'product.adv_delivery_h':      { fr: 'Livraison au Maroc' },
        'product.adv_delivery_p':      { fr: 'Frais fixe : 35 MAD' },
        'product.adv_returns_h':       { fr: 'Satisfait ou remboursé' },
        'product.adv_returns_p':       { fr: 'Retours sous 14 jours, sous conditions' },
        'product.adv_payment_h':       { fr: 'Paiement sécurisé & achat 1 clic' },
        'product.adv_payment_p':       { fr: 'Rapide, sécurisé et sans frais cachés' },
        'product.news_title':          { fr: 'Abonnez-vous à notre newsletter pour recevoir les nouvelles et conseils beauté.' },
        'product.news_subtitle':       { fr: "Ne manquez pas nos offres exclusives !" },
        'product.footer_legal':        { fr: 'Légal' },
        'product.footer_ship_policy':  { fr: 'Politique de livraison' },
        'product.notes_top':           { fr: 'Notes de tête' },
        'product.notes_heart':         { fr: 'Notes de cœur' },
        'product.notes_base':          { fr: 'Notes de fond' },
        'product.reviews_count':       { fr: 'Calculé à partir de 69 avis vérifiés' },

        /* ===== XERJOFF PAGE ===== */
        'xerjoff.page_title': { fr: 'IPORDISE – Collection XERJOFF | Haute Parfumerie Italienne' },

        /* Hero */
        'xerjoff.hero_kicker':  { fr: 'Haute Parfumerie Italienne' },
        'xerjoff.hero_sub':     { fr: 'Fondée à Turin en 2003 par Sergio Momo, XERJOFF est une maison de luxe italienne où des ingrédients rares, l\'art du verre de Murano et un savoir-faire sans compromis convergent pour créer certaines des fragrances les plus convoitées au monde.' },
        'xerjoff.hero_badge':   { fr: 'Collection Niche Exclusive' },

        /* Brand Story */
        'xerjoff.story_label':  { fr: 'La Maison' },
        'xerjoff.story_title':  { fr: 'Là où la Parfumerie Rencontre l\'Art' },
        'xerjoff.story_text':   { fr: 'Chaque fragrance XERJOFF est un chef-d\'œuvre né de l\'alliance des plus belles traditions italiennes : l\'art de la parfumerie, la maîtrise du verre de Murano et une dévotion inébranlable aux matières premières les plus rares du monde entier.<br><br>De l\'ambre doré d\'Alexandria II à la chaleur intemporelle de Naxos et à la fraîcheur lumineuse d\'Erba Pura, chaque création raconte une histoire d\'artisanat obsessionnel, de luxe sans compromis et de la quête italienne de la beauté éternelle.' },

        /* Collection header */
        'xerjoff.collection_label': { fr: 'La Collection' },
        'xerjoff.collection_title': { fr: 'Notre Sélection XERJOFF' },
        'xerjoff.collection_sub':   { fr: 'Toutes les fragrances disponibles en décants premium — <strong>5 ML</strong> &amp; <strong>10 ML</strong>' },

        /* Shared product labels */
        'xerjoff.brand_tag':        { fr: 'XERJOFF · Eau de Parfum' },
        'xerjoff.decante_badge':    { fr: 'Décant — Choisissez votre taille' },
        'xerjoff.size_label':       { fr: 'Taille' },
        'xerjoff.price_choose':     { fr: 'Choisissez une taille pour demander le prix' },
        'xerjoff.price_note':       { fr: 'Livraison au Maroc : 35 MAD — TVA incluse' },
        'xerjoff.add_to_cart':      { fr: 'Ajouter au panier' },
        'xerjoff.notes_toggle':     { fr: 'Notes olfactives' },
        'xerjoff.top_notes':        { fr: 'Notes de Tête' },
        'xerjoff.heart_notes':      { fr: 'Notes de Cœur' },
        'xerjoff.base_notes':       { fr: 'Notes de Fond' },
        'xerjoff.trust_delivery':   { fr: 'Livraison : 35 MAD' },
        'xerjoff.trust_authentic':  { fr: '100% Authentique' },
        'xerjoff.trust_decante':    { fr: 'Décant Premium' },
        'xerjoff.trust_returns':    { fr: 'Retours faciles' },
        'xerjoff.wishlist_aria':    { fr: 'Liste de souhaits' },

        /* Alexandria II */
        'xerjoff.alex_subtitle':    { fr: 'Unisexe · Ambre Oud · Monument iconique de la parfumerie niche italienne, né dans la célèbre collection Cachemire de XERJOFF. Oud riche, vanille chaude et ambre doré créent un sillage inoubliable d\'opulence intemporelle et de présence royale.' },

        /* Erba Pura */
        'xerjoff.erba_subtitle':    { fr: 'Unisexe · Musqué Fruité Citrus · Une explosion lumineuse de citrus siciliens, de fruits juteux et de musc blanc. La célébration par XERJOFF de la fraîcheur méditerranéenne et de la joie ensoleillée — lumineux, addictif et parfait en toute saison.' },

        /* Naxos */
        'xerjoff.naxos_subtitle':   { fr: 'Unisexe · Fougère Ambré · Inspiré par l\'île grecque baignée de soleil, Naxos mêle miel sicilien, feuille de tabac et lavande aromatique dans une composition de chaleur méditerranéenne et de sophistication italienne.' },

        /* Values strip */
        'xerjoff.val_ingredients_title': { fr: 'Ingrédients Rares' },
        'xerjoff.val_ingredients_text':  { fr: 'Sourcés dans les plus belles régions du monde' },
        'xerjoff.val_perfumers_title':   { fr: 'Maîtres Parfumeurs' },
        'xerjoff.val_perfumers_text':    { fr: 'Créés par les meilleurs nez d\'Italie' },
        'xerjoff.val_authentic_title':   { fr: '100% Authentique' },
        'xerjoff.val_authentic_text':    { fr: 'Produits garantis d\'origine' },
        'xerjoff.val_delivery_title':    { fr: 'Livraison Rapide' },
        'xerjoff.val_delivery_text':     { fr: 'Emballage sécurisé & expédition rapide' },

        /* CTA */
        'xerjoff.cta_title': { fr: 'Intéressé par XERJOFF ?' },
        'xerjoff.cta_text':  { fr: 'Contactez-nous pour les prix, la disponibilité et pour découvrir les décants et flacons complets de la collection XERJOFF.' },
        'xerjoff.cta_btn':   { fr: 'Contactez-nous' },

        /* Footer customer care (xerjoff page uses plain text links) */
        'xerjoff.footer_care_title':     { fr: 'Service Client' },
        'xerjoff.footer_contact':        { fr: 'Contactez-nous' },
        'xerjoff.footer_shipping':       { fr: 'Livraison & Retours' },
        'xerjoff.footer_track':          { fr: 'Suivre la commande' },
        'xerjoff.footer_faq':            { fr: 'FAQ' },
        'xerjoff.footer_about_title':    { fr: 'À Propos' },
        'xerjoff.footer_story':          { fr: 'Notre Histoire' },
        'xerjoff.footer_careers':        { fr: 'Carrières' },
        'xerjoff.footer_store':          { fr: 'Trouver un magasin' },
        'xerjoff.footer_terms':          { fr: 'Conditions générales' },
        'xerjoff.footer_subscribe':      { fr: "S'ABONNER" },
        'xerjoff.footer_copyright':      { fr: '© 2026 IPORDISE. Tous droits réservés.' },

        /* ===== DISCOVER PAGE ===== */
        'discover.page_title':           { fr: 'IPORDISE – Découvrir notre collection' },
        'discover.breadcrumb':           { fr: 'Découvrir la collection' },
        'discover.hero_kicker':          { fr: 'Sélection Premium de Fragrances' },
        'discover.hero_title':           { fr: 'Découvrez notre collection' },
        'discover.hero_sub':             { fr: 'Explorez des fragrances signature pour chaque humeur, saison et occasion, soigneusement sélectionnées parmi nos meilleures ventes pour hommes et femmes.' },
        'discover.collection_title':     { fr: 'Produits de la Collection' },
        'discover.products_label':       { fr: 'produits disponibles' },
        'discover.filter_all':           { fr: 'Tout' },
        'discover.filter_newin':         { fr: 'Nouveautés' },
        'discover.filter_2026':          { fr: '✦ Classe de 2026' },
        'discover.filter_bestsellers':   { fr: 'Meilleures Ventes' },
        'discover.filter_men':           { fr: 'Pour Hommes' },
        'discover.filter_women':         { fr: 'Pour Femmes' },
        'discover.filter_unisex':        { fr: 'Unisexe' },
        'discover.filter_niche':         { fr: 'Niche' },
        'discover.filter_arabian':       { fr: 'Arabian' },
        'discover.filter_designer':      { fr: 'Designer' },
        'discover.filter_sets':          { fr: 'Coffrets Découverte' },
        'discover.filter_offers':        { fr: 'Offres' },
        'discover.announce':             { fr: '-15% supplémentaire sur des catégories sélectionnées - Code : <span class="font-bold border-b border-white border-dashed">GLAM15</span> - <a href="#" class="underline hover:text-gray-200">ACHETER !</a>' },
        'discover.search_ph':            { fr: 'Rechercher un parfum, une marque…' },
        'discover.mobile_search_ph':     { fr: 'Rechercher un parfum…' },
        'discover.mobile_all':           { fr: 'Tous les parfums' },
        'discover.mobile_men':           { fr: 'Hommes' },
        'discover.mobile_women':         { fr: 'Femmes' },
        'discover.mobile_unisex':        { fr: 'Unisexe' },
        'discover.mobile_niche':         { fr: 'Niche' },
        'discover.mobile_designer':      { fr: 'Designer' },
        'discover.mobile_arabian':       { fr: 'Arabian' },
        'discover.mobile_bestsellers':   { fr: 'Meilleures ventes' },
        'discover.mobile_newin':         { fr: 'Nouveautés' },
        'discover.mobile_2026':          { fr: 'Classe de 2026' },
        'discover.mobile_offers':        { fr: 'Offres Flash' },
        'discover.mobile_account':       { fr: 'Mon compte' },
        'discover.mobile_contact':       { fr: 'Contactez-nous' },
        'discover.footer_tagline':       { fr: 'La destination ultime pour les parfums de luxe et la beauté en ligne.' },
        'discover.footer_cs':            { fr: 'Service Client' },
        'discover.footer_contact':       { fr: 'Contactez-nous' },
        'discover.footer_shipping':      { fr: 'Livraison & Retours' },
        'discover.footer_track':         { fr: 'Suivre la commande' },
        'discover.footer_faq':           { fr: 'FAQ' },
        'discover.footer_support':       { fr: 'Centre d\'assistance' },
        'discover.footer_about':         { fr: 'À Propos' },
        'discover.footer_story':         { fr: 'Notre Histoire' },
        'discover.footer_careers':       { fr: 'Carrières' },
        'discover.footer_store':         { fr: 'Trouver un magasin' },
        'discover.footer_terms':         { fr: 'Conditions générales' },
        'discover.footer_privacy':       { fr: 'Politique de confidentialité' },
        'discover.footer_promo':         { fr: 'Promotions' },
        'discover.footer_flash':         { fr: 'Offres Flash' },
        'discover.footer_newin':         { fr: 'Nouvelles Arrivées' },
        'discover.footer_bestsellers':   { fr: 'Meilleures Ventes' },
        'discover.footer_niche':         { fr: 'Collection Niche' },
        'discover.footer_designer':      { fr: 'Collection Designer' },
        'discover.footer_news':          { fr: 'Newsletter' },
        'discover.footer_news_desc':     { fr: 'Abonnez-vous pour des offres exclusives, les nouveautés et conseils parfumerie.' },
        'discover.footer_news_ph':       { fr: 'Votre email' },
        'discover.footer_payment':       { fr: 'Modes de paiement acceptés' },
        'discover.footer_copyright':     { fr: '© 2026 IPORDISE. Tous droits réservés.' },
        'discover.footer_link_terms':    { fr: 'Conditions' },
        'discover.footer_link_privacy':  { fr: 'Confidentialité' },
        'discover.footer_link_returns':  { fr: 'Retours' },
    };

    /* ─────────────── HELPERS ─────────────── */

    const LANG_KEY = 'ipordise-language';

    function getLang() {
        return localStorage.getItem(LANG_KEY) || 'en';
    }

    function translate(key) {
        const entry = dict[key];
        if (!entry) return null;
        const lang = getLang();
        return lang === 'fr' ? (entry.fr || null) : null; // null = keep English original
    }

    /* ─────────────── APPLY TRANSLATIONS ─────────────── */

    /* Cache originals once so English can always be restored */
    function cacheOriginals() {
        document.querySelectorAll('[data-i18n]').forEach(function (el) {
            if (!el.hasAttribute('data-i18n-orig')) {
                el.setAttribute('data-i18n-orig', el.textContent);
            }
        });
        document.querySelectorAll('[data-i18n-html]').forEach(function (el) {
            if (!el.hasAttribute('data-i18n-orig-html')) {
                el.setAttribute('data-i18n-orig-html', el.innerHTML);
            }
        });
        document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
            if (!el.hasAttribute('data-i18n-orig-ph')) {
                el.setAttribute('data-i18n-orig-ph', el.placeholder);
            }
        });
        document.querySelectorAll('[data-i18n-aria]').forEach(function (el) {
            if (!el.hasAttribute('data-i18n-orig-aria')) {
                el.setAttribute('data-i18n-orig-aria', el.getAttribute('aria-label') || '');
            }
        });
    }

    function applyTranslations() {
        const lang = getLang();
        const isFr = lang === 'fr';

        /* --- document.title --- */
        const titleEl = document.querySelector('[data-i18n-title]');
        if (titleEl) {
            const key = titleEl.getAttribute('data-i18n-title');
            if (isFr) {
                const val = translate(key);
                if (val) document.title = val;
            } else {
                const orig = titleEl.getAttribute('data-i18n-orig-title');
                if (orig) document.title = orig;
            }
        }

        /* --- text content --- */
        document.querySelectorAll('[data-i18n]').forEach(function (el) {
            const key = el.getAttribute('data-i18n');
            if (isFr) {
                const val = translate(key);
                if (val) el.textContent = val;
            } else {
                const orig = el.getAttribute('data-i18n-orig');
                if (orig !== null) el.textContent = orig;
            }
        });

        /* --- innerHTML (for HTML with tags) --- */
        document.querySelectorAll('[data-i18n-html]').forEach(function (el) {
            const key = el.getAttribute('data-i18n-html');
            if (isFr) {
                const val = translate(key);
                if (val) el.innerHTML = val;
            } else {
                const orig = el.getAttribute('data-i18n-orig-html');
                if (orig !== null) el.innerHTML = orig;
            }
        });

        /* --- placeholder --- */
        document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
            const key = el.getAttribute('data-i18n-placeholder');
            if (isFr) {
                const val = translate(key);
                if (val) el.placeholder = val;
            } else {
                const orig = el.getAttribute('data-i18n-orig-ph');
                if (orig !== null) el.placeholder = orig;
            }
        });

        /* --- aria-label --- */
        document.querySelectorAll('[data-i18n-aria]').forEach(function (el) {
            const key = el.getAttribute('data-i18n-aria');
            if (isFr) {
                const val = translate(key);
                if (val) el.setAttribute('aria-label', val);
            } else {
                const orig = el.getAttribute('data-i18n-orig-aria');
                if (orig !== null) el.setAttribute('aria-label', orig);
            }
        });

        /* --- Update html lang attribute --- */
        document.documentElement.lang = lang;
    }

    /* ─────────────── INIT ─────────────── */

    function init() {
        cacheOriginals();
        applyTranslations();

        /* React instantly when script.js fires the language change event */
        window.addEventListener('ipordise:langchange', function () {
            applyTranslations();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    /* Expose for manual calls if needed */
    window.__i18n = { applyTranslations: applyTranslations, translate: translate, dict: dict };
})();
