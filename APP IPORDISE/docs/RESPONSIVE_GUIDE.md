# IPORDISE responsive UI guide

The app uses one width-driven layout resolver in `src/responsive.ts`. Components consume it through `useResponsiveLayout()` instead of reading one-time window dimensions or applying a global scale transform.

## Breakpoints

| Layout | Width | Typical use |
| --- | ---: | --- |
| Compact | below 360 px | 320 px phones and constrained split views |
| Phone | 360–429 px | standard phones |
| Large phone | 430–767 px | large phones and small portrait windows |
| Tablet | 768–1023 px | tablets and wide landscape windows |
| Large tablet | 1024 px and above | large tablets and desktop web |

The resolver also detects landscape, short landscape, short screens, and the current accessibility font scale. Content gutters move from 12 to 32 px, bounded content widths prevent excessive line length, catalogue grids move from two to three and four columns, and the bottom navigation adapts its height without overlapping safe areas.

## Component rules

- Use `ResponsiveContainer` for centred, width-bounded page content.
- Use `minWidth: 0`, `flexShrink`, wrapping, and minimum heights for content that may expand with accessibility text.
- Primary interactive targets are at least 44 × 44 px; larger visual areas may contain smaller icons.
- Product and menu grids derive their columns from `catalogColumns`; compact menu cards stack vertically.
- Horizontal scrolling is reserved for intentional carousels and filter rails.
- Images use `contain` for product cut-outs and `cover` for editorial campaigns, with stable aspect ratios or adaptive heights.
- `SafeAreaView` protects both top and bottom edges. Forms remain scrollable and keyboard-aware.

## Validation matrix

The pure resolver test covers 320×568, 360×640, 375×667, 390×844, 412×915, 430×932, 768×1024, 820×1180, and 1024×1366. Landscape behavior is checked independently at phone and large-tablet widths. Run `npm run test` after changing breakpoints.
