# Google Play screenshot plan

Capture screenshots from the final signed production or internal-testing build using production data that contains no real customer personal information.

## Phone sequence

1. Home — branded launch destination, featured edit, and primary categories.
2. Shop — searchable brand discovery and the live product catalogue.
3. Product details — gallery, real size options, price, scent notes, and Add to Bag.
4. Bag — selected products, quantity controls, and order summary.
5. Checkout — completed delivery form and cash-on-delivery selection; use fictional customer details.
6. Order confirmation or tracking — fictional/test order only, with no real phone or address visible.
7. Account — customer benefits, orders, addresses, and privacy controls.
8. Help — customer-care topics and secure support entry point.

Use consistent devices and current UI. Do not add device frames, ratings, awards, or claims that are not supported. Capture at least two phone screenshots; a coherent 6–8 image sequence is preferred. Google Play accepts up to eight per device type.

## Large-screen sequence

Because `supportsTablet` is enabled and the responsive code has tablet breakpoints, capture at least four tablet screenshots after completing physical or emulator tablet QA. Use 9:16 portrait or 16:9 landscape images between 1080 and 7680 px, matching Google Play's current large-screen guidance.

Recommended tablet screens: Home, Shop/product grid, Product Details, and Checkout or Account. Do not publish tablet assets until safe areas, keyboard behavior, landscape, Arabic RTL, and multi-column grids are verified on a real tablet/emulator.

## Capture checklist

- Use fictional names, addresses, phone numbers, emails, order IDs, and support messages.
- Remove debug overlays and Expo development UI.
- Confirm English, French, and Arabic have no visible placeholder/development copy.
- Keep status/navigation bars consistent and unobstructed.
- Check contrast, clipping, keyboard dismissal, and bottom navigation before capture.
- Add concise alt text in Play Console (140 characters or fewer).
