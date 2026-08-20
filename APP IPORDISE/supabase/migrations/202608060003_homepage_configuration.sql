-- Reuse the existing public store_settings document for the app homepage.
-- This keeps catalogue and promotional controls in the same protected admin API.
update public.store_settings
set value = jsonb_set(
  value,
  '{homepage}',
  '{
    "announcements":["100% authentic fragrances","Delivery across Morocco","Pay when your order arrives","Carefully prepared by IPORDISE"],
    "heroSlides":[
      {"id":"new-arrivals","eyebrow":"JUST LANDED · MOROCCO","headline":"Find your next signature.","description":"New fragrances selected for character, quality and lasting presence.","ctaLabel":"Shop new arrivals","destination":"new-in","active":true,"order":1},
      {"id":"bestsellers","eyebrow":"MOST WANTED","headline":"Icons, chosen again.","description":"Discover the fragrances our clients return to season after season.","ctaLabel":"Explore bestsellers","destination":"best-sellers","active":true,"order":2},
      {"id":"luxury","eyebrow":"THE CONNOISSEUR EDIT","headline":"Rare by nature.","description":"Independent houses and exceptional compositions for collectors.","ctaLabel":"Discover luxury","destination":"niche","active":true,"order":3},
      {"id":"discovery","eyebrow":"START YOUR JOURNEY","headline":"Begin with discovery.","description":"Explore smaller formats before choosing your full bottle.","ctaLabel":"Shop discovery sets","destination":"discovery-sets","active":true,"order":4}
    ],
    "categories":[
      {"id":"new","label":"New arrivals","filter":"new-in","icon":"sparkles-outline","active":true,"order":1},
      {"id":"women","label":"Women","filter":"for-women","icon":"female-outline","active":true,"order":2},
      {"id":"men","label":"Men","filter":"for-men","icon":"male-outline","active":true,"order":3},
      {"id":"unisex","label":"Unisex","filter":"unisex","icon":"male-female-outline","active":true,"order":4},
      {"id":"luxury","label":"Luxury","filter":"niche","icon":"diamond-outline","active":true,"order":5},
      {"id":"gifts","label":"Gift sets","filter":"discovery-sets","icon":"gift-outline","active":true,"order":6},
      {"id":"miniatures","label":"Miniatures","filter":"miniatures","icon":"flask-outline","active":true,"order":7},
      {"id":"offers","label":"Offers","filter":"offers","icon":"ticket-outline","active":true,"order":8}
    ],
    "sectionOrder":["benefits","categories","hero","offers","bestsellers","seasonal","families","new","brands","trust"],
    "hiddenSections":[],
    "featuredBrands":[]
  }'::jsonb,
  true
)
where id = 'main' and not (value ? 'homepage');
