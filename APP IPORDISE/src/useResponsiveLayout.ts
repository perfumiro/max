import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { resolveResponsiveLayout } from './responsive';

export type { LayoutSize } from './responsive';

export function useResponsiveLayout() {
  const { width, height, fontScale } = useWindowDimensions();
  return useMemo(() => resolveResponsiveLayout(width, height, fontScale), [width, height, fontScale]);
}
