import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, motion, radius, shadows, sizes, spacing, typography } from '../designSystem';

export type LuxuryButtonVariant = 'primary' | 'secondary' | 'text' | 'sticky';

export interface LuxuryButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  variant?: LuxuryButtonVariant;
  loading?: boolean;
  icon?: ReactNode;
  trailingIcon?: ReactNode;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function LuxuryButton({
  label,
  variant = 'primary',
  loading = false,
  icon,
  trailingIcon,
  fullWidth = false,
  disabled,
  accessibilityLabel,
  style,
  ...pressableProps
}: LuxuryButtonProps) {
  const isDisabled = Boolean(disabled || loading);

  return (
    <Pressable
      {...pressableProps}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        fullWidth && styles.fullWidth,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' || variant === 'text' ? colors.textPrimary : colors.inverse} />
      ) : (
        <>
          {icon}
          <Text style={[styles.label, styles[`${variant}Label`]]}>{label}</Text>
          {trailingIcon}
        </>
      )}
    </Pressable>
  );
}

export interface LuxuryIconButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  accessibilityLabel: string;
  icon: ReactNode;
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function LuxuryIconButton({ accessibilityLabel, icon, selected = false, disabled, style, ...pressableProps }: LuxuryIconButtonProps) {
  const isDisabled = Boolean(disabled);

  return (
    <Pressable
      {...pressableProps}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, selected }}
      disabled={isDisabled}
      hitSlop={6}
      style={({ pressed }) => [
        styles.iconButton,
        selected && styles.iconButtonSelected,
        pressed && !isDisabled && styles.iconPressed,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {icon}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: sizes.button,
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.control,
    overflow: 'hidden',
  },
  fullWidth: { alignSelf: 'stretch' },
  primary: { backgroundColor: colors.textPrimary },
  secondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
  text: { minHeight: sizes.touch, backgroundColor: 'transparent', paddingHorizontal: spacing.xs, borderRadius: radius.xs },
  sticky: { alignSelf: 'stretch', backgroundColor: colors.accent, borderRadius: radius.control, ...shadows.subtle },
  label: { ...typography.button },
  primaryLabel: { color: colors.inverse },
  secondaryLabel: { color: colors.textPrimary },
  textLabel: { color: colors.textPrimary },
  stickyLabel: { color: colors.inverse },
  pressed: { opacity: 0.86, transform: [{ scale: motion.transform.pressedScale }] },
  disabled: { opacity: 0.42 },
  iconButton: {
    width: sizes.touch,
    height: sizes.touch,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: 'transparent',
  },
  iconButtonSelected: { backgroundColor: colors.accentTint },
  iconPressed: { backgroundColor: colors.surfaceMuted, transform: [{ scale: motion.transform.pressedScale }] },
});
