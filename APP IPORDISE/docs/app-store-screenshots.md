# App Store screenshot plan

Capture real screens from the signed, production-like build. Do not use customer personal data, debug overlays, fake system chrome, unsupported claims, or transparent images.

## Required device sets

- **iPhone:** prioritize the current 6.9-inch presentation. Apple currently accepts portrait captures at 1260×2736, 1290×2796, or 1320×2868 pixels, depending on the source device.
- **iPad:** required because `supportsTablet` is true. Use a 13-inch iPad capture at 2064×2752 or 2048×2732 portrait, or the corresponding landscape dimensions.
- App Store Connect allows one to ten screenshots per device set. Recheck Apple’s live screenshot specification before capture because accepted devices and sizes change.

## Recommended sequence

1. **Home — Discover your next fragrance:** hero and featured collection.
2. **Shop — Browse the full edit:** catalogue, filters, and real product imagery.
3. **Product — Details that help you choose:** fragrance information and available sizes.
4. **Bag — Your selection, clearly organized:** quantities and transparent MAD totals.
5. **Checkout — Cash on delivery across Morocco:** address and delivery summary using dedicated test details.
6. **Account — Your IPORDISE experience:** profile and shortcuts without personal data.
7. **Orders — Keep track of every order:** use a sanitized reviewer order.
8. **Help — Private support from IPORDISE Care:** support topics and message experience.

## iPad composition

Use the same narrative but select screens that demonstrate bounded content widths and intentional use of space. Capture Home, Shop, Product Detail, Checkout, Account/Orders, and Help during portrait and landscape QA, then submit the strongest consistent orientation.

## Localization and QA

- Prepare consistent English, French, and Arabic sets if those localizations are listed in App Store Connect.
- Verify Arabic RTL alignment and ensure optional overlay text is localized and does not cover UI.
- Keep status-bar time, network state, inventory, prices, delivery terms, and promotional claims plausible and consistent.
- Review each export at 100% scale and ensure it has no alpha channel.
