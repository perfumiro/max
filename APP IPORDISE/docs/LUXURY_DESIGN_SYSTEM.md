# IPORDISE Luxury Design System

Version 1.0 — visual foundation

IPORDISE combines classic European perfumery with contemporary luxury commerce. The interface should feel edited, calm, tactile, and product-led. When the logo is hidden, the warm ivory canvas, serif hierarchy, precise spacing, quiet controls, and disciplined crimson accent should still identify the brand.

## Design principles

1. **The fragrance is the hero.** Photography and product names receive more visual weight than controls, badges, or promotional language.
2. **Luxury is space and restraint.** Prefer a separator and whitespace over another card, border, pill, or shadow.
3. **Serif creates ceremony; sans-serif creates clarity.** Serif is for editorial titles and memorable prices. Sans-serif is for interaction, detail, and navigation.
4. **Crimson marks intent.** Use the accent for selection, active navigation, purchase, and essential brand cues—not for large decorative areas.
5. **One system, many screens.** New UI must use semantic tokens from `src/designSystem.ts`; avoid local color, radius, font-size, and shadow inventions.

## Foundation tokens

Import tokens directly:

```tsx
import { colors, spacing, typography } from '../designSystem';
```

### Color roles

| Role | Token | Use |
| --- | --- | --- |
| App canvas | `colors.background` | Warm ivory screen background |
| Default surface | `colors.surface` | Warm white content surface |
| Product/photo surface | `colors.surfaceStrong` | Accurate white behind bottle photography |
| Quiet grouped surface | `colors.surfaceMuted` | Subtle contrast, never a decorative tile wall |
| Primary copy | `colors.textPrimary` | Titles, names, essential values |
| Secondary copy | `colors.textSecondary` | Descriptions and supporting labels |
| Quiet copy | `colors.textQuiet` | Low-priority metadata |
| Divider / border | `colors.divider`, `colors.border` | Separation and inputs |
| Luxury accent | `colors.accent` | Purchase, selected, active, focused brand cue |
| Feedback | `colors.success`, `warning`, `error` | Semantic status only |

Never introduce a local red, beige, gray, green, or warning color. If a legitimate new role is missing, add it centrally and document why.

### Typography roles

| Token | Purpose |
| --- | --- |
| `typography.displayTitle` | Campaign and editorial landing title |
| `typography.productTitle` | Product detail name |
| `typography.sectionTitle` | Screen and collection section heading |
| `typography.eyebrow` | Short uppercase context label |
| `typography.body` | Primary readable copy |
| `typography.bodySmall` | Supporting copy and field values |
| `typography.price` | Hero price presentation |
| `typography.metadata` | Size, availability, tax, delivery detail |
| `typography.button` | Button labels |
| `typography.navigation` | Header and bottom navigation labels |

Do not bold every line. On most compositions, only one title, one current price, and one primary action need strong emphasis. Eyebrows should be short and rare; do not turn paragraphs into uppercase text.

### Spacing and rhythm

Use `spacing.xxs` through `spacing.display`. Typical composition:

- 4–8 px: icon/label and micro-detail spacing
- 12–16 px: control internals and closely related content
- 20–24 px: component padding and content groups
- 32–40 px: section separation
- 48–80 px: major editorial transitions

Screen gutters should usually be 20 px on compact mobile and 24–32 px on larger layouts. Do not compensate for weak hierarchy by adding arbitrary margins.

### Radius, borders, and elevation

- `radius.control` for fields and buttons.
- `radius.card` only when a card boundary is materially useful.
- `radius.feature` for large editorial media, not routine rows.
- `radius.pill` is reserved for circular icon buttons, radio controls, and compact status indicators.
- `borders.divider` separates content; `standard`, `selected`, and `focused` are interaction states.
- `shadows.subtle` is the default maximum. `raised` is for genuine overlays. `sticky` is limited to anchored purchase/navigation surfaces.

Cards should not float by default. First try background contrast, alignment, type, and whitespace.

## Components

Import components directly from their files to keep dependencies explicit.

### Buttons

`src/components/LuxuryButton.tsx`

- `LuxuryButton variant="primary"`: deep-ink primary actions.
- `variant="secondary"`: transparent bordered alternative.
- `variant="text"`: tertiary or inline action.
- `variant="sticky"`: controlled crimson purchase action.
- `LuxuryIconButton`: back, wishlist, share, cart, clear, and other compact actions.

All variants include normal, pressed, loading, and disabled behavior. Use one primary action per region. A sticky purchase button may repeat the page's purchase action only when the main action can scroll out of view.

### Product cards

`src/components/LuxuryProductCard.tsx`

Cards prioritize a neutral photo stage, then brand, product name, price, and size. Wishlist remains an unobtrusive icon action. `operationalLabel` is optional and should only communicate useful states such as “New”, “Exclusive”, or limited availability. Never stack multiple badges.

For grids, keep equal image areas and align card footers. Do not crop bottle caps, bases, labels, or packaging unless the art direction explicitly calls for a detail shot.

### Section headers

`src/components/LuxurySectionHeader.tsx`

Use title case for editorial titles and an optional uppercase eyebrow such as NEW ARRIVALS, DISCOVER, OUR SELECTION, FOR HIM, or FOR HER. Add a description only when it helps the customer choose. Actions should normally be quiet text buttons.

### Forms

`src/components/LuxuryFormControls.tsx`

- `LuxuryTextField`: identity, address, contact, and payment text entry.
- `LuxurySearchField`: the single canonical search control on a screen.
- `LuxurySelectControl`: format, city, country, delivery, and saved-option selection.
- `LuxuryQuantityControl`: compact cart quantity editing.
- `LuxuryCouponControl`: code entry with an integrated apply action.
- `LuxuryAddressField`: street, city, region, postal-code, and country entry with appropriate autocomplete behavior.
- `LuxuryPaymentOption`: accessible radio-style payment choice.

Card inputs should use payment-specific keyboard and autocomplete settings supplied by the payment provider. Errors appear below the affected field; do not replace labels with placeholders.

### Navigation

`src/components/LuxuryNavigation.tsx`

- `LuxuryHeader`: balanced title, optional back action, and a quiet right action group.
- `LuxuryBottomNavigation`: up to five primary destinations, using outline icons and crimson only for the active destination.

Navigation is infrastructure, not decoration. Avoid filled header backgrounds, oversized floating action circles, or multiple search bars. Cart badges communicate count only; do not use them as ornaments.

## Image direction

Use the `imagery` presets as layout contracts.

### Product photography

- Master ratio: 4:5; card stage: 1:1.
- Use contain scaling with generous clear space around the bottle.
- Preserve accurate bottle color, proportions, cap, label, liquid level, and packaging.
- Prefer pure or warm white backgrounds and one very soft contact shadow.
- Keep the perceived bottle scale consistent across a product grid.
- Product detail may show a larger bottle than a grid card, but should never feel edge-to-edge or cropped by accident.

### Editorial photography

Use stone, marble, glass, fine fabric, dark wood, and warm natural light. Maintain one visual idea per frame and enough negative space for copy. Generated imagery is appropriate for non-product campaigns and category atmosphere; actual product renders must remain accurate and should not be regenerated if that changes labels or bottle geometry.

Avoid generic stock arrangements, synthetic neon color, busy floral collages, exaggerated reflections, and unrelated luxury props.

## Motion language

Use `motion.duration.instant` (150 ms), `standard` (220 ms), and `deliberate` (300 ms). Preferred movement is a small opacity change or up to 6 px translation using the supplied easing curves.

- Press: 150 ms opacity plus a maximum scale change to `0.985`.
- Enter: 220–300 ms opacity with a 6 px vertical offset.
- Modal/sheet exit: 150–220 ms.
- Respect reduced-motion preferences.
- Never bounce routine controls, loop decorative motion, or animate every list item.

## Migration sequence

The product page remains the visual benchmark. Migration should happen by customer impact and component reuse, not file order.

### Phase 1 — App shell and shared commerce primitives

Migrate the global header, single search entry point, bottom navigation, cart indicator, wishlist action, buttons, and loading/error states. This eliminates the strongest cross-screen inconsistency first.

**Acceptance:** one header language, one bottom navigation, one search control per context, no hard-coded navigation colors or radii.

### Phase 2 — Discovery and catalogue

Migrate Home, Shop, brand pages, search results, category grids, and recommendations. Replace existing card variations with `LuxuryProductCard` and section headings with `LuxurySectionHeader`.

**Acceptance:** consistent bottle scale, aligned card footers, restrained badges, no empty vertical gaps between filters and results, and reliable scrolling below fixed navigation.

### Phase 3 — Purchase journey

Migrate wishlist, bag, checkout, coupon, address, delivery, payment, order review, and confirmation. Adopt shared buttons and form controls before changing individual page compositions.

**Acceptance:** clear focus/error/disabled/loading states, a single purchase emphasis, accessible payment selection, and no competing floating cards.

### Phase 4 — Customer relationship

Migrate account, authentication, order tracking, reviews, help, care, and support. Keep service information calm and readable; reserve status colors for real status.

**Acceptance:** shared field treatment, consistent page titles, semantic feedback colors, and predictable back/navigation behavior.

### Phase 5 — Campaigns, offers, and administration

Migrate offers and editorial campaigns after the commerce core is coherent. Keep administration functionally consistent but visually quieter; it should use the token system without imitating the boutique storefront composition.

**Acceptance:** campaign imagery follows art direction, promotional red is controlled, and admin UI uses semantic tokens without introducing a second design language.

## Migration checklist

For each screen:

1. Replace local colors, type sizes, spacing, radius, borders, and shadows with semantic tokens.
2. Replace duplicate controls with shared components before restyling layout.
3. Remove decorative pills, redundant borders, and non-semantic badges.
4. Verify content hierarchy at 320, 390, 768, and desktop widths.
5. Verify keyboard focus, screen-reader labels, loading, disabled, error, empty, and pressed states.
6. Verify every scroll view clears sticky purchase and bottom navigation surfaces.
7. Compare bottle scale and whitespace with the product-detail benchmark.
8. Reject the migration if the screen still resembles a generic dashboard or disconnected template.
