import { Ionicons } from '@expo/vector-icons';
import {
  Image,
  type ImageSourcePropType,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, imagery, motion, radius, sizes, spacing, typography } from '../designSystem';
import { LuxuryIconButton } from './LuxuryButton';

export interface LuxuryProductCardProps {
  brand: string;
  name: string;
  price: string;
  size?: string;
  image: ImageSourcePropType;
  onPress: () => void;
  onToggleWishlist?: () => void;
  wishlisted?: boolean;
  operationalLabel?: string;
  imageAccessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export function LuxuryProductCard({
  brand,
  name,
  price,
  size,
  image,
  onPress,
  onToggleWishlist,
  wishlisted = false,
  operationalLabel,
  imageAccessibilityLabel,
  style,
}: LuxuryProductCardProps) {
  return (
    <View style={[styles.card, style]}>
      <Pressable
        accessibilityLabel={`${brand} ${name}, ${price}`}
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.media, pressed && styles.pressed]}
      >
        <Image
          accessibilityLabel={imageAccessibilityLabel ?? `${brand} ${name}`}
          resizeMode={imagery.productCard.resizeMode}
          source={image}
          style={styles.image}
        />
      </Pressable>
      {operationalLabel ? <Text style={styles.operationalLabel}>{operationalLabel.toLocaleUpperCase()}</Text> : null}
      {onToggleWishlist ? (
        <LuxuryIconButton
          accessibilityLabel={wishlisted ? `Remove ${name} from wishlist` : `Add ${name} to wishlist`}
          icon={<Ionicons name={wishlisted ? 'heart' : 'heart-outline'} size={sizes.iconMd} color={wishlisted ? colors.accent : colors.textPrimary} />}
          onPress={onToggleWishlist}
          selected={wishlisted}
          style={styles.wishlist}
        />
      ) : null}
      <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.copy, pressed && styles.copyPressed]}>
        <Text numberOfLines={1} style={styles.brand}>{brand.toLocaleUpperCase()}</Text>
        <Text numberOfLines={2} style={styles.name}>{name}</Text>
        <View style={styles.footer}>
          <Text style={styles.price}>{price}</Text>
          {size ? <Text style={styles.size}>{size}</Text> : null}
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { position: 'relative', backgroundColor: colors.surface },
  media: {
    aspectRatio: imagery.productCard.aspectRatio,
    padding: imagery.productCard.padding,
    backgroundColor: imagery.productCard.backgroundColor,
    borderRadius: radius.sm,
  },
  image: { width: '100%', height: '100%' },
  pressed: { opacity: 0.82, transform: [{ scale: motion.transform.pressedScale }] },
  operationalLabel: {
    ...typography.eyebrow,
    position: 'absolute',
    left: spacing.sm,
    top: spacing.sm,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
  },
  wishlist: { position: 'absolute', right: spacing.xs, top: spacing.xs, backgroundColor: 'rgba(255, 254, 252, 0.92)' },
  copy: { minHeight: 116, paddingTop: spacing.sm, paddingBottom: spacing.md },
  copyPressed: { opacity: 0.68 },
  brand: { ...typography.eyebrow, color: colors.textSecondary },
  name: { ...typography.body, color: colors.textPrimary, marginTop: spacing.xxs, minHeight: 46 },
  footer: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.sm, marginTop: spacing.xs },
  price: { ...typography.button, color: colors.textPrimary },
  size: { ...typography.metadata, color: colors.textQuiet },
});
