import { Platform, StyleSheet } from 'react-native';

export { breakpoints, clamp } from './responsive';

/**
 * IPORDISE visual foundation
 * Classic European perfumery × contemporary luxury commerce.
 *
 * Semantic names are preferred in new UI. The original flat names remain
 * available so existing screens can migrate without a disruptive rewrite.
 */
export const palette = {
  ivory: '#F7F3EE',
  warmWhite: '#FFFEFC',
  pureWhite: '#FFFFFF',
  parchment: '#F1EBE5',
  ink: '#171310',
  charcoal: '#302A27',
  warmGray: '#716963',
  quietGray: '#948A83',
  divider: '#E7DFD8',
  border: '#D8CEC6',
  accent: '#D7193F',
  accentPressed: '#B71334',
  accentTint: '#FFF2F5',
  success: '#176B43',
  successTint: '#EFF8F2',
  warning: '#956515',
  warningTint: '#FFF8E8',
  error: '#B42318',
  errorTint: '#FFF1F0',
  focus: '#5D514B',
} as const;

export const colors = {
  background: palette.ivory,
  surface: palette.warmWhite,
  surfaceStrong: palette.pureWhite,
  surfaceMuted: palette.parchment,
  textPrimary: palette.ink,
  textSecondary: palette.warmGray,
  textQuiet: palette.quietGray,
  divider: palette.divider,
  border: palette.border,
  accent: palette.accent,
  accentPressed: palette.accentPressed,
  accentTint: palette.accentTint,
  success: palette.success,
  successTint: palette.successTint,
  warning: palette.warning,
  warningTint: palette.warningTint,
  error: palette.error,
  errorTint: palette.errorTint,
  focus: palette.focus,
  inverse: palette.pureWhite,
  overlay: 'rgba(23, 19, 16, 0.42)',

  // Legacy aliases. Remove only after the full migration is complete.
  ink: palette.ink,
  paper: palette.pureWhite,
  muted: '#666666',
  line: '#E7E7E7',
  brand: palette.accent,
  action: '#168BD2',
  blush: '#FFF0F4',
  soft: '#F8F3F5',
} as const;

export const fontFamilies = {
  serif: Platform.select({
    ios: 'Iowan Old Style',
    android: 'serif',
    web: 'Iowan Old Style, Baskerville, Georgia, Times New Roman, serif',
    default: 'serif',
  }),
  sans: Platform.select({
    ios: 'System',
    android: 'sans-serif',
    web: 'Inter, Helvetica Neue, Arial, sans-serif',
    default: 'sans-serif',
  }),
} as const;

const typeRoles = {
  displayTitle: { fontFamily: fontFamilies.serif, fontSize: 40, lineHeight: 46, fontWeight: '600' as const, letterSpacing: -0.8 },
  productTitle: { fontFamily: fontFamilies.serif, fontSize: 30, lineHeight: 36, fontWeight: '600' as const, letterSpacing: -0.45 },
  sectionTitle: { fontFamily: fontFamilies.serif, fontSize: 24, lineHeight: 30, fontWeight: '600' as const, letterSpacing: -0.25 },
  eyebrow: { fontFamily: fontFamilies.sans, fontSize: 9, lineHeight: 13, fontWeight: '700' as const, letterSpacing: 1.6 },
  body: { fontFamily: fontFamilies.sans, fontSize: 15, lineHeight: 23, fontWeight: '400' as const, letterSpacing: 0 },
  bodySmall: { fontFamily: fontFamilies.sans, fontSize: 12, lineHeight: 18, fontWeight: '400' as const, letterSpacing: 0.05 },
  price: { fontFamily: fontFamilies.serif, fontSize: 28, lineHeight: 34, fontWeight: '600' as const, letterSpacing: -0.35 },
  metadata: { fontFamily: fontFamilies.sans, fontSize: 10, lineHeight: 15, fontWeight: '500' as const, letterSpacing: 0.25 },
  button: { fontFamily: fontFamilies.sans, fontSize: 12, lineHeight: 16, fontWeight: '700' as const, letterSpacing: 0.45 },
  navigation: { fontFamily: fontFamilies.sans, fontSize: 11, lineHeight: 15, fontWeight: '600' as const, letterSpacing: 0.15 },
} as const;

export const typography = {
  ...typeRoles,

  // Legacy aliases.
  micro: { fontSize: 8, lineHeight: 12 },
  caption: { fontSize: 11, lineHeight: 16 },
  title: { fontSize: 24, lineHeight: 31 },
  display: { fontSize: 32, lineHeight: 40 },
} as const;

export const spacing = {
  none: 0,
  hairline: 2,
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  ml: 20,
  lg: 24,
  xl: 32,
  section: 40,
  xxl: 48,
  xxxl: 64,
  display: 80,
} as const;

export const radius = {
  none: 0,
  xs: 4,
  sm: 8,
  control: 10,
  md: 12,
  card: 14,
  lg: 18,
  feature: 20,
  xl: 24,
  pill: 999,
} as const;

export const borders = {
  divider: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.divider },
  standard: { borderWidth: 1, borderColor: colors.border },
  selected: { borderWidth: 1.5, borderColor: colors.accent },
  focused: { borderWidth: 1.5, borderColor: colors.focus },
} as const;

export const sizes = {
  touch: 44,
  button: 52,
  input: 52,
  header: 72,
  bottomNav: 78,
  contentPhone: 680,
  contentTablet: 960,
  shell: 1180,
  form: 560,
  formWide: 720,
  iconSm: 16,
  iconMd: 20,
  iconLg: 24,
} as const;

export const shadows = {
  none: Platform.select({ ios: { shadowOpacity: 0 }, android: { elevation: 0 }, default: {} }),
  subtle: Platform.select({
    ios: { shadowColor: palette.ink, shadowOpacity: 0.045, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
    android: { elevation: 1 },
    default: { shadowColor: palette.ink, shadowOpacity: 0.045, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  }),
  raised: Platform.select({
    ios: { shadowColor: palette.ink, shadowOpacity: 0.075, shadowRadius: 16, shadowOffset: { width: 0, height: 7 } },
    android: { elevation: 3 },
    default: { shadowColor: palette.ink, shadowOpacity: 0.075, shadowRadius: 16, shadowOffset: { width: 0, height: 7 } },
  }),
  sticky: Platform.select({
    ios: { shadowColor: palette.ink, shadowOpacity: 0.1, shadowRadius: 18, shadowOffset: { width: 0, height: -5 } },
    android: { elevation: 8 },
    default: { shadowColor: palette.ink, shadowOpacity: 0.1, shadowRadius: 18, shadowOffset: { width: 0, height: -5 } },
  }),
} as const;

// Legacy single-shadow export.
export const shadow = shadows.raised;

export const motion = {
  duration: { instant: 150, standard: 220, deliberate: 300 },
  easing: {
    standard: [0.2, 0, 0, 1] as const,
    enter: [0.16, 1, 0.3, 1] as const,
    exit: [0.4, 0, 1, 1] as const,
  },
  transform: { pressedScale: 0.985, enterOffset: 6 },
} as const;

export const imagery = {
  product: { aspectRatio: 4 / 5, backgroundColor: colors.surfaceStrong, resizeMode: 'contain' as const, padding: spacing.lg },
  productCard: { aspectRatio: 1, backgroundColor: colors.surfaceStrong, resizeMode: 'contain' as const, padding: spacing.md },
  lifestyle: { aspectRatio: 4 / 3, resizeMode: 'cover' as const },
} as const;
