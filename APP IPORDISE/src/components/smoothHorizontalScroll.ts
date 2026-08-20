import React, { forwardRef } from 'react';
import { ScrollView as NativeScrollView, type ScrollViewProps } from 'react-native';

/**
 * Shared touch physics for every horizontally scrollable rail.
 * Individual fixed-width rails can add their own snapToInterval.
 */
export const smoothHorizontalScrollProps = Object.freeze({
  horizontal: true,
  nestedScrollEnabled: true,
  directionalLockEnabled: true,
  showsHorizontalScrollIndicator: false,
  scrollEventThrottle: 16,
  decelerationRate: 'fast',
  overScrollMode: 'never',
} satisfies ScrollViewProps);

/** Drop-in ScrollView that improves horizontal gestures and leaves vertical views untouched. */
export const SmoothScrollView = forwardRef<NativeScrollView, ScrollViewProps>(
  function SmoothScrollView(props, ref) {
    const gestureProps = props.horizontal ? smoothHorizontalScrollProps : undefined;
    return React.createElement(NativeScrollView, { ...gestureProps, ...props, ref });
  },
);
