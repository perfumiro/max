import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { borders, colors, motion, radius, shadows, sizes, spacing, typography } from '../designSystem';
import { LuxuryIconButton } from './LuxuryButton';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export interface LuxuryHeaderProps {
  title: string;
  eyebrow?: string;
  onBack?: () => void;
  actions?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function LuxuryHeader({ title, eyebrow, onBack, actions, style }: LuxuryHeaderProps) {
  return (
    <View style={[styles.header, style]}>
      <View style={styles.headerSide}>
        {onBack ? (
          <LuxuryIconButton
            accessibilityLabel="Go back"
            icon={<Ionicons name="arrow-back" size={sizes.iconLg} color={colors.textPrimary} />}
            onPress={onBack}
          />
        ) : null}
      </View>
      <View style={styles.headerCopy}>
        {eyebrow ? <Text style={styles.headerEyebrow}>{eyebrow.toLocaleUpperCase()}</Text> : null}
        <Text numberOfLines={1} style={styles.headerTitle}>{title}</Text>
      </View>
      <View style={[styles.headerSide, styles.headerActions]}>{actions}</View>
    </View>
  );
}

export interface LuxuryNavigationItem {
  key: string;
  label: string;
  icon: IoniconName;
  activeIcon?: IoniconName;
  badgeCount?: number;
}

export interface LuxuryBottomNavigationProps {
  items: readonly LuxuryNavigationItem[];
  activeKey: string;
  onSelect: (key: string) => void;
  bottomInset?: number;
  style?: StyleProp<ViewStyle>;
}

export function LuxuryBottomNavigation({ items, activeKey, onSelect, bottomInset = 0, style }: LuxuryBottomNavigationProps) {
  return (
    <View accessibilityRole="tablist" style={[styles.bottomNavigation, { paddingBottom: Math.max(bottomInset, spacing.xs) }, style]}>
      {items.map((item) => {
        const active = item.key === activeKey;
        const icon = active && item.activeIcon ? item.activeIcon : item.icon;
        return (
          <Pressable
            accessibilityLabel={item.label}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            key={item.key}
            onPress={() => onSelect(item.key)}
            style={({ pressed }) => [styles.navigationItem, pressed && styles.navigationPressed]}
          >
            <View style={styles.navigationIcon}>
              <Ionicons name={icon} size={sizes.iconLg} color={active ? colors.accent : colors.textPrimary} />
              {item.badgeCount ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{item.badgeCount > 99 ? '99+' : item.badgeCount}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.navigationLabel, active && styles.navigationLabelActive]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: sizes.header,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: borders.divider.borderWidth,
    borderBottomColor: colors.divider,
  },
  headerSide: { width: 88, minHeight: sizes.touch, flexDirection: 'row', alignItems: 'center' },
  headerActions: { justifyContent: 'flex-end' },
  headerCopy: { flex: 1, minWidth: 0, alignItems: 'center' },
  headerEyebrow: { ...typography.eyebrow, color: colors.accent, marginBottom: spacing.xxs },
  headerTitle: { ...typography.navigation, fontSize: 14, lineHeight: 19, color: colors.textPrimary, textAlign: 'center' },
  bottomNavigation: {
    minHeight: sizes.bottomNav,
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: spacing.xs,
    paddingHorizontal: spacing.xxs,
    backgroundColor: colors.surface,
    borderTopWidth: borders.divider.borderWidth,
    borderTopColor: colors.divider,
    ...shadows.sticky,
  },
  navigationItem: { flex: 1, minHeight: 58, alignItems: 'center', justifyContent: 'center', gap: spacing.xxs, borderRadius: radius.sm },
  navigationPressed: { backgroundColor: colors.surfaceMuted, transform: [{ scale: motion.transform.pressedScale }] },
  navigationIcon: { position: 'relative' },
  navigationLabel: { ...typography.navigation, fontSize: 10, lineHeight: 13, color: colors.textSecondary },
  navigationLabelActive: { color: colors.accent },
  badge: {
    position: 'absolute',
    right: -10,
    top: -6,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    borderWidth: 1,
    borderColor: colors.surface,
  },
  badgeText: { fontSize: 8, lineHeight: 10, fontWeight: '700', color: colors.inverse },
});
