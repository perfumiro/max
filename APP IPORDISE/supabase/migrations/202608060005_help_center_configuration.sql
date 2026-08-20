update public.store_settings
set value = jsonb_set(
  value,
  '{help}',
  '{
    "timezone":"Africa/Casablanca",
    "availabilityOverride":"auto",
    "temporaryClosure":false,
    "holidayClosures":[],
    "businessHours":[],
    "expectedResponse":"",
    "contacts":{"whatsapp":"","phone":"","email":""},
    "topics":[
      {"id":"track","title":"Track my order","description":"View live status and delivery updates","icon":"cube-outline","active":true,"order":1},
      {"id":"delivery","title":"Delivery & returns","description":"Delivery times, fees, exchanges and returns","icon":"swap-horizontal-outline","active":true,"order":2},
      {"id":"advice","title":"Fragrance advice","description":"Get help finding a fragrance that suits you","icon":"sparkles-outline","active":true,"order":3},
      {"id":"contact","title":"Contact support","description":"Speak with the IPORDISE customer-care team","icon":"chatbubble-ellipses-outline","active":true,"order":4}
    ],
    "faqs":[],
    "deliveryPolicies":[],
    "adviceQuestions":["recipient","family","occasion","intensity","budget"]
  }'::jsonb,
  true
)
where id = 'main' and not (value ? 'help');
