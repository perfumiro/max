export const breakpoints = {
  compact: 0,
  phone: 360,
  largePhone: 430,
  tablet: 768,
  largeTablet: 1024,
} as const;

export type LayoutSize = 'compact' | 'phone' | 'largePhone' | 'tablet' | 'largeTablet';

export const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));

export function resolveGridColumns(contentWidth: number, minimumCardWidth = 210, minimum = 2, maximum = 5, gap = 12) {
  const available = Math.max(0, contentWidth);
  const columns = Math.floor((available + gap) / (minimumCardWidth + gap));
  return Math.round(clamp(columns, minimum, maximum));
}

export function resolveResponsiveLayout(width: number, height: number, fontScale = 1) {
  const safeWidth = Math.max(280, width || 0);
  const safeHeight = Math.max(320, height || 0);
  const size: LayoutSize = safeWidth < breakpoints.phone ? 'compact'
    : safeWidth < breakpoints.largePhone ? 'phone'
    : safeWidth < breakpoints.tablet ? 'largePhone'
    : safeWidth < breakpoints.largeTablet ? 'tablet'
    : 'largeTablet';
  const tablet = size === 'tablet' || size === 'largeTablet';
  const landscape = safeWidth > safeHeight;
  const shortLandscape = landscape && safeHeight < 560;
  const gutter = size === 'compact' ? 12 : size === 'phone' ? 16 : size === 'largePhone' ? 20 : size === 'tablet' ? 24 : 32;
  const contentMaxWidth = size === 'largeTablet' ? 1180 : tablet ? 960 : 680;
  const shellWidth = Math.min(safeWidth, contentMaxWidth + gutter * 2);
  const contentWidth = Math.max(0, shellWidth - gutter * 2);
  const catalogColumns = resolveGridColumns(contentWidth, 210, 2, size === 'largeTablet' ? 5 : tablet ? 4 : 2);
  return {
    width: safeWidth,
    height: safeHeight,
    fontScale: clamp(fontScale || 1, 0.8, 2.5),
    size,
    compact: size === 'compact',
    tablet,
    largeTablet: size === 'largeTablet',
    landscape,
    shortLandscape,
    shortScreen: safeHeight < 640,
    gutter,
    contentMaxWidth,
    shellWidth,
    contentWidth,
    catalogColumns,
    formColumns: safeWidth >= breakpoints.tablet ? 2 : 1,
    campaignHeight: shortLandscape ? 210 : tablet ? 340 : size === 'compact' ? 210 : 250,
    bottomNavHeight: shortLandscape ? 60 : 76 + clamp((fontScale - 1) * 10, 0, 14),
  } as const;
}

export const percentageForColumns = (columns: number, gap = 10) => columns <= 1 ? '100%'
  : `${(100 - gap * (columns - 1) / 4) / columns}%`;
