-- Extends the existing protected storefront settings document with the Shop hub.
-- Product visibility and counts remain derived from the live products table.
update public.store_settings
set value = jsonb_set(
  coalesce(value, '{}'::jsonb),
  '{shop}',
  '{
    "banner":{"eyebrow":"JUST LANDED","headline":"New arrivals","description":"Meet the fragrances defining now.","ctaLabel":"Explore new arrivals","filter":"new-in","active":true},
    "quickLinks":[
      {"id":"new","label":"New","description":"Latest arrivals","filter":"new-in","icon":"sparkles-outline","active":true,"order":1},
      {"id":"best","label":"Bestsellers","description":"Most wanted","filter":"best-sellers","icon":"ribbon-outline","active":true,"order":2},
      {"id":"offers","label":"Offers","description":"Current reductions","filter":"offers","icon":"ticket-outline","active":true,"order":3},
      {"id":"under-500","label":"Under 500 MAD","description":"Shop by price","filter":"price-under-500","icon":"wallet-outline","active":true,"order":4},
      {"id":"gifts","label":"Gift sets","description":"Ready to give","filter":"discovery-sets","icon":"gift-outline","active":true,"order":5},
      {"id":"miniatures","label":"Miniatures","description":"Smaller formats","filter":"miniatures","icon":"flask-outline","active":true,"order":6}
    ],
    "categories":[
      {"id":"men","label":"For Him","description":"Modern masculine signatures","filter":"for-men","icon":"male-outline","active":true,"order":1},
      {"id":"women","label":"For Her","description":"Expressive feminine scents","filter":"for-women","icon":"female-outline","active":true,"order":2},
      {"id":"unisex","label":"Unisex","description":"Signatures without boundaries","filter":"unisex","icon":"male-female-outline","active":true,"order":3},
      {"id":"gifts","label":"Gift Sets","description":"Thoughtfully selected gifts","filter":"discovery-sets","icon":"gift-outline","active":true,"order":4},
      {"id":"miniatures","label":"Miniatures","description":"Discover smaller formats","filter":"miniatures","icon":"flask-outline","active":true,"order":5},
      {"id":"luxury","label":"Luxury","description":"Rare and distinctive houses","filter":"niche","icon":"diamond-outline","active":true,"order":6},
      {"id":"new","label":"New Arrivals","description":"The latest additions","filter":"new-in","icon":"sparkles-outline","active":true,"order":7},
      {"id":"offers","label":"Offers","description":"Special prices available now","filter":"offers","icon":"ticket-outline","active":true,"order":8}
    ],
    "familyOrder":["Fresh","Floral","Woody","Amber","Citrus","Sweet","Spicy","Aromatic"],
    "featuredBrands":[],
    "collections":[
      {"id":"under-300","label":"Under 300 MAD","description":"Accessible discoveries","filter":"price-under-300","icon":"pricetag-outline","active":true,"order":1},
      {"id":"under-500","label":"Under 500 MAD","description":"Curated within your budget","filter":"price-under-500","icon":"wallet-outline","active":true,"order":2},
      {"id":"luxury","label":"Luxury selection","description":"Exceptional compositions","filter":"niche","icon":"diamond-outline","active":true,"order":3},
      {"id":"offers","label":"Current offers","description":"Live catalogue reductions","filter":"offers","icon":"ticket-outline","active":true,"order":4}
    ]
  }'::jsonb,
  true
)
where id = 'main' and not (coalesce(value, '{}'::jsonb) ? 'shop');
