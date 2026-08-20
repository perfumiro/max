import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { borders, colors, motion, radius, sizes, spacing, typography } from '../designSystem';
import { LuxuryButton, LuxuryIconButton } from './LuxuryButton';

export interface LuxuryTextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  hint?: string;
  error?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
}

export function LuxuryTextField({
  label,
  hint,
  error,
  leading,
  trailing,
  editable = true,
  onFocus,
  onBlur,
  containerStyle,
  ...inputProps
}: LuxuryTextFieldProps) {
  const [focused, setFocused] = useState(false);
  const helper = error ?? hint;

  return (
    <View style={containerStyle}>
      <Text style={styles.label}>{label.toLocaleUpperCase()}</Text>
      <View style={[styles.field, focused && styles.fieldFocused, Boolean(error) && styles.fieldError, !editable && styles.fieldDisabled]}>
        {leading}
        <TextInput
          {...inputProps}
          accessibilityLabel={inputProps.accessibilityLabel ?? label}
          editable={editable}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          placeholderTextColor={colors.textQuiet}
          selectionColor={colors.accent}
          style={styles.input}
        />
        {trailing}
      </View>
      {helper ? <Text accessibilityLiveRegion="polite" style={[styles.helper, error && styles.error]}>{helper}</Text> : null}
    </View>
  );
}

export interface LuxurySearchFieldProps extends Omit<LuxuryTextFieldProps, 'label' | 'leading' | 'trailing'> {
  label?: string;
  onClear?: () => void;
}

export function LuxurySearchField({ label = 'Search', value, onClear, ...inputProps }: LuxurySearchFieldProps) {
  return (
    <LuxuryTextField
      {...inputProps}
      accessibilityRole="search"
      label={label}
      leading={<Ionicons name="search-outline" size={sizes.iconMd} color={colors.textSecondary} />}
      returnKeyType="search"
      trailing={value && onClear ? (
        <LuxuryIconButton
          accessibilityLabel="Clear search"
          icon={<Ionicons name="close" size={sizes.iconMd} color={colors.textPrimary} />}
          onPress={onClear}
          style={styles.inlineIcon}
        />
      ) : undefined}
      value={value}
    />
  );
}

export interface LuxurySelectControlProps {
  label: string;
  value?: string;
  placeholder?: string;
  error?: string;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function LuxurySelectControl({ label, value, placeholder = 'Select', error, onPress, disabled, style }: LuxurySelectControlProps) {
  return (
    <View style={style}>
      <Text style={styles.label}>{label.toLocaleUpperCase()}</Text>
      <Pressable
        accessibilityLabel={`${label}, ${value ?? placeholder}`}
        accessibilityRole="button"
        accessibilityState={{ disabled, expanded: false }}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [styles.field, styles.select, error && styles.fieldError, pressed && styles.controlPressed, disabled && styles.fieldDisabled]}
      >
        <Text numberOfLines={1} style={[styles.selectText, !value && styles.placeholder]}>{value ?? placeholder}</Text>
        <Ionicons name="chevron-down" size={sizes.iconSm} color={colors.textPrimary} />
      </Pressable>
      {error ? <Text style={[styles.helper, styles.error]}>{error}</Text> : null}
    </View>
  );
}

export interface LuxuryQuantityControlProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  label?: string;
}

export function LuxuryQuantityControl({ value, onChange, min = 1, max = 99, label = 'Quantity' }: LuxuryQuantityControlProps) {
  return (
    <View accessibilityLabel={`${label}: ${value}`} style={styles.quantity}>
      <LuxuryIconButton
        accessibilityLabel={`Decrease ${label}`}
        disabled={value <= min}
        icon={<Ionicons name="remove" size={sizes.iconSm} color={colors.textPrimary} />}
        onPress={() => onChange(Math.max(min, value - 1))}
      />
      <Text style={styles.quantityValue}>{value}</Text>
      <LuxuryIconButton
        accessibilityLabel={`Increase ${label}`}
        disabled={value >= max}
        icon={<Ionicons name="add" size={sizes.iconSm} color={colors.textPrimary} />}
        onPress={() => onChange(Math.min(max, value + 1))}
      />
    </View>
  );
}

export interface LuxuryCouponControlProps extends Omit<TextInputProps, 'style'> {
  onApply: () => void;
  applying?: boolean;
  error?: string;
}

export function LuxuryCouponControl({ onApply, applying, error, ...inputProps }: LuxuryCouponControlProps) {
  return (
    <LuxuryTextField
      {...inputProps}
      autoCapitalize="characters"
      error={error}
      label="Coupon code"
      trailing={<LuxuryButton label="Apply" loading={applying} onPress={onApply} variant="text" />}
    />
  );
}

export type LuxuryAddressPart = 'street' | 'city' | 'region' | 'postalCode' | 'country';

export interface LuxuryAddressFieldProps extends Omit<LuxuryTextFieldProps, 'autoComplete'> {
  addressPart?: LuxuryAddressPart;
}

const addressAutocomplete: Record<LuxuryAddressPart, TextInputProps['autoComplete']> = {
  street: 'street-address',
  city: 'address-line2',
  region: 'address-line2',
  postalCode: 'postal-code',
  country: 'country',
};

export function LuxuryAddressField({ addressPart = 'street', ...fieldProps }: LuxuryAddressFieldProps) {
  return (
    <LuxuryTextField
      {...fieldProps}
      autoCapitalize="words"
      autoComplete={addressAutocomplete[addressPart]}
      keyboardType={addressPart === 'postalCode' ? 'numbers-and-punctuation' : 'default'}
    />
  );
}

export interface LuxuryPaymentOptionProps {
  title: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
  icon?: ReactNode;
  disabled?: boolean;
}

export function LuxuryPaymentOption({ title, description, selected, onPress, icon, disabled }: LuxuryPaymentOptionProps) {
  return (
    <Pressable
      accessibilityLabel={title}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.payment, selected && styles.paymentSelected, pressed && styles.controlPressed, disabled && styles.fieldDisabled]}
    >
      {icon ? <View style={styles.paymentIcon}>{icon}</View> : null}
      <View style={styles.paymentCopy}>
        <Text style={styles.paymentTitle}>{title}</Text>
        {description ? <Text style={styles.paymentDescription}>{description}</Text> : null}
      </View>
      <View style={[styles.radio, selected && styles.radioSelected]}>{selected ? <View style={styles.radioDot} /> : null}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  label: { ...typography.eyebrow, color: colors.textSecondary, marginBottom: spacing.xs },
  field: {
    minHeight: sizes.input,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceStrong,
    borderRadius: radius.control,
    ...borders.standard,
  },
  fieldFocused: { ...borders.focused },
  fieldError: { borderColor: colors.error },
  fieldDisabled: { opacity: 0.46, backgroundColor: colors.surfaceMuted },
  input: { flex: 1, minWidth: 0, paddingVertical: 0, ...typography.bodySmall, color: colors.textPrimary },
  helper: { ...typography.metadata, color: colors.textQuiet, marginTop: spacing.xs },
  error: { color: colors.error },
  inlineIcon: { width: 36, height: 36, marginRight: -spacing.xs },
  select: { justifyContent: 'space-between' },
  selectText: { flex: 1, ...typography.bodySmall, color: colors.textPrimary },
  placeholder: { color: colors.textQuiet },
  controlPressed: { opacity: 0.76, transform: [{ scale: motion.transform.pressedScale }] },
  quantity: {
    minHeight: sizes.input,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceStrong,
    borderRadius: radius.control,
    ...borders.standard,
  },
  quantityValue: { minWidth: 34, textAlign: 'center', ...typography.button, color: colors.textPrimary },
  payment: {
    minHeight: 74,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.control,
    ...borders.standard,
  },
  paymentSelected: { borderColor: colors.accent, backgroundColor: colors.accentTint },
  paymentIcon: { width: 32, alignItems: 'center' },
  paymentCopy: { flex: 1, minWidth: 0 },
  paymentTitle: { ...typography.button, color: colors.textPrimary },
  paymentDescription: { ...typography.metadata, color: colors.textSecondary, marginTop: spacing.xxs },
  radio: { width: 20, height: 20, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: colors.accent },
  radioDot: { width: 10, height: 10, borderRadius: radius.pill, backgroundColor: colors.accent },
});
