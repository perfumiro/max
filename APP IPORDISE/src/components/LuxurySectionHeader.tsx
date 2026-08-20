import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, spacing, typography } from '../designSystem';

export interface LuxurySectionHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  align?: 'left' | 'center';
  style?: StyleProp<ViewStyle>;
}

export function LuxurySectionHeader({ eyebrow, title, description, action, align = 'left', style }: LuxurySectionHeaderProps) {
  const centered = align === 'center';

  return (
    <View style={[styles.root, centered && styles.centered, style]}>
      <View style={[styles.copy, centered && styles.centeredCopy]}>
        {eyebrow ? <Text style={[styles.eyebrow, centered && styles.centeredText]}>{eyebrow.toLocaleUpperCase()}</Text> : null}
        <Text style={[styles.title, centered && styles.centeredText]}>{title}</Text>
        {description ? <Text style={[styles.description, centered && styles.centeredText]}>{description}</Text> : null}
      </View>
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.md },
  copy: { flex: 1, minWidth: 0 },
  centered: { justifyContent: 'center' },
  centeredCopy: { alignItems: 'center' },
  centeredText: { textAlign: 'center' },
  eyebrow: { ...typography.eyebrow, color: colors.accent, marginBottom: spacing.xs },
  title: { ...typography.sectionTitle, color: colors.textPrimary },
  description: { ...typography.bodySmall, color: colors.textSecondary, marginTop: spacing.xs, maxWidth: 520 },
  action: { flexShrink: 0 },
});
