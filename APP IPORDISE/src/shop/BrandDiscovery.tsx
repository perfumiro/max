import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ImageSourcePropType,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLanguage } from '../i18n/LanguageContext';
import { formatBrandProductCount, normalizeBrandText, resolveBrandDiscoveryState, type BrandDiscoveryItem } from './brandDiscoveryLogic';

const RED = '#d7193f';
const WEB_INPUT_RESET = Platform.OS === 'web'
  ? { outlineStyle: 'none', outlineWidth: 0, outlineColor: 'transparent' } as any
  : undefined;

const BRAND_LOGOS: Record<string, ImageSourcePropType> = {
  armani: require('../../assets/brand-logos/armani.png'),
  chanel: require('../../assets/brand-logos/chanel.png'),
  dior: require('../../assets/brand-logos/dior.png'),
  givenchy: require('../../assets/brand-logos/givenchy.png'),
  guerlain: require('../../assets/brand-logos/guerlain.jpg'),
  'jean paul gaultier': require('../../assets/brand-logos/jean-paul-gaultier.png'),
  'maison francis kurkdjian': require('../../assets/brand-logos/maison-francis-kurkdjian.png'),
  'tom ford': require('../../assets/brand-logos/tom-ford.png'),
  valentino: require('../../assets/brand-logos/valentino.png'),
  versace: require('../../assets/brand-logos/versace.png'),
  xerjoff: require('../../assets/brand-logos/xerjoff.png'),
  'yves saint laurent': require('../../assets/brand-logos/ysl.png'),
  ysl: require('../../assets/brand-logos/ysl.png'),
};

const resolveBrandLogo = (label: string) => {
  const normalized = normalizeBrandText(label);
  if (BRAND_LOGOS[normalized]) return BRAND_LOGOS[normalized];
  if (normalized.includes('armani')) return BRAND_LOGOS.armani;
  if (normalized.includes('saint laurent')) return BRAND_LOGOS['yves saint laurent'];
  if (normalized.includes('gaultier')) return BRAND_LOGOS['jean paul gaultier'];
  if (normalized.includes('kurkdjian')) return BRAND_LOGOS['maison francis kurkdjian'];
  return undefined;
};

function useReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => mounted && setReducedMotion(value));
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    return () => { mounted = false; subscription.remove(); };
  }, []);
  return reducedMotion;
}

type BrandCopy = {
  explore: string;
  product: string;
  products: string;
  cardHint: string;
  loading: string;
};

const BrandCard = memo(function BrandCard({
  item,
  index,
  width,
  reducedMotion,
  rtl,
  copy,
  onOpenBrand,
}: {
  item: BrandDiscoveryItem;
  index: number;
  width: number;
  reducedMotion: boolean;
  rtl: boolean;
  copy: BrandCopy;
  onOpenBrand: (label: string) => void;
}) {
  const entrance = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const logo = resolveBrandLogo(item.label);
  const initials = item.label.split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase();

  useEffect(() => setImageFailed(false), [item.sampleImage]);

  useEffect(() => {
    if (reducedMotion) { entrance.setValue(1); return; }
    entrance.setValue(0);
    const animation = Animated.sequence([
      Animated.delay(Math.min(index, 7) * 42),
      Animated.timing(entrance, { toValue: 1, duration: 260, useNativeDriver: true }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [entrance, index, reducedMotion]);

  return (
    <Animated.View style={{ width, opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${copy.explore} ${item.label}, ${formatBrandProductCount(item.count, copy.product, copy.products)}`}
        accessibilityHint={copy.cardHint}
        onBlur={() => setFocused(false)}
        onFocus={() => setFocused(true)}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        onPress={() => onOpenBrand(item.label)}
        style={({ pressed }) => [styles.card, hovered && styles.cardHovered, focused && styles.cardFocused, hovered && !reducedMotion && styles.cardLifted, pressed && styles.cardPressed]}
      >
        <View style={styles.visual}>
          <View style={styles.visualGlow} />
          <View style={[styles.identity, rtl && styles.identityRtl]}>
            {logo
              ? <Image accessibilityIgnoresInvertColors source={logo} resizeMode="contain" style={styles.logo} />
              : <><Text style={styles.fallbackInitials}>{initials}</Text><View style={styles.fallbackRule} /></>}
          </View>
          {item.sampleImage && !imageFailed
            ? <Image accessibilityIgnoresInvertColors source={item.sampleImage} resizeMode="contain" onError={() => setImageFailed(true)} style={[styles.bottle, rtl && styles.bottleRtl]} />
            : <View style={[styles.bottleFallback, rtl && styles.bottleFallbackRtl]}><Ionicons name="sparkles-outline" size={22} color="#6e5b55" /></View>}
        </View>
        <View style={styles.cardCopy}>
          <Text numberOfLines={2} style={[styles.brandName, rtl && styles.rtlText]}>{item.label}</Text>
          <View style={styles.cardFooter}>
            <View>
              <Text style={[styles.count, rtl && styles.rtlText]}>{formatBrandProductCount(item.count, copy.product, copy.products)}</Text>
              <Text style={[styles.explore, rtl && styles.rtlText]}>{copy.explore}</Text>
            </View>
            <View style={styles.arrow}><Ionicons name={rtl ? 'arrow-back' : 'arrow-forward'} size={15} color="#fff" /></View>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
});

const BrandSkeleton = memo(function BrandSkeleton({ width, label }: { width: number; label: string }) {
  return <View accessibilityLabel={label} style={[styles.skeleton, { width }]}><View style={styles.skeletonVisual} /><View style={styles.skeletonTitle} /><View style={styles.skeletonMeta} /></View>;
});

const BrandEmptyState = memo(function BrandEmptyState({ error, rtl, title, message, action, onClear, onRetry }: {
  error: boolean;
  rtl: boolean;
  title: string;
  message: string;
  action: string;
  onClear: () => void;
  onRetry: () => void;
}) {
  return (
    <View accessibilityRole="alert" style={styles.empty}>
      <View style={styles.emptyIcon}><Ionicons name={error ? 'cloud-offline-outline' : 'search-outline'} size={23} color={RED} /></View>
      <Text style={[styles.emptyTitle, rtl && styles.rtlText]}>{title}</Text>
      <Text style={[styles.emptyText, rtl && styles.rtlText]}>{message}</Text>
      <Pressable accessibilityRole="button" onPress={error ? onRetry : onClear} style={({ pressed }) => [styles.emptyButton, pressed && styles.cardPressed]}>
        <Text style={styles.emptyButtonText}>{action}</Text>
      </Pressable>
    </View>
  );
});

export const BrandDiscovery = memo(function BrandDiscovery({
  brands,
  totalBrandCount,
  query,
  cardWidth,
  contentWidth,
  loading,
  error,
  directory,
  onQueryChange,
  onBack,
  onOpenBrand,
  onRetry,
}: {
  brands: BrandDiscoveryItem[];
  totalBrandCount: number;
  query: string;
  cardWidth: number;
  contentWidth: number;
  loading: boolean;
  error: boolean;
  directory?: boolean;
  onQueryChange: (value: string) => void;
  onBack?: () => void;
  onOpenBrand: (label: string) => void;
  onRetry: () => void;
}) {
  const [focused, setFocused] = useState(false);
  const reducedMotion = useReducedMotion();
  const { t, rtl } = useLanguage();
  const visibleBrands = brands;
  const state = resolveBrandDiscoveryState(loading, error, visibleBrands.length, query, totalBrandCount);
  const wideHeader = !directory && contentWidth >= 620;
  const copy = useMemo<BrandCopy>(() => ({
    explore: t('brandExplore'),
    product: t('brandProduct'),
    products: t('brandProducts'),
    cardHint: t('brandCardHint'),
    loading: t('brandLoading'),
  }), [t]);
  const emptyError = state === 'error';
  const emptyMessage = emptyError ? t('brandUnavailableText') : `${t('brandNoResultPrefix')}${query}${t('brandNoResultSuffix')}`;

  return (
    <View style={[styles.section, rtl && styles.rtlSection]}>
      {directory && onBack ? <Pressable accessibilityRole="button" accessibilityLabel={t('brandBack')} onPress={onBack} style={({ pressed }) => [styles.directoryBack, pressed && styles.viewAllPressed]}><View style={styles.directoryBackIcon}><Ionicons name={rtl ? 'arrow-forward' : 'arrow-back'} size={17} color="#171310" /></View><Text style={[styles.directoryBackText, rtl && styles.rtlText]}>{t('brandBack')}</Text></Pressable> : null}
      <View style={[styles.header, wideHeader && styles.headerWide]}>
        <View style={styles.headerCopy}>
          <Text style={[styles.eyebrow, rtl && styles.rtlText]}>{t('brandEyebrow')}</Text>
          <Text maxFontSizeMultiplier={1.35} style={[styles.title, rtl && styles.rtlText]}>{t(directory ? 'brandDirectoryTitle' : 'brandTitle')}</Text>
          <Text style={[styles.subtitle, rtl && styles.rtlText]}>{t('brandSubtitle')}</Text>
        </View>
      </View>

      {directory ? <View style={[styles.search, focused && styles.searchFocused]}>
        <Ionicons accessibilityElementsHidden name="search-outline" size={19} color={focused ? '#30363a' : '#72777b'} />
        <TextInput
          accessibilityRole="search"
          accessibilityLabel={t('brandSearchLabel')}
          accessibilityHint={t('brandSearchHint')}
          autoCapitalize="none"
          autoComplete="off"
          autoCorrect={false}
          importantForAutofill="no"
          underlineColorAndroid="transparent"
          selectionColor={RED}
          cursorColor={RED}
          value={query}
          onChangeText={onQueryChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={t('brandSearchPlaceholder')}
          placeholderTextColor="#85898c"
          returnKeyType="search"
          style={[styles.input, rtl && styles.rtlInput, WEB_INPUT_RESET]}
        />
        {query ? <Pressable accessibilityRole="button" accessibilityLabel={t('brandClearSearch')} hitSlop={6} onPress={() => onQueryChange('')} style={({ pressed }) => [styles.clear, pressed && styles.clearPressed]}><Ionicons name="close" size={16} color="#4b5053" /></Pressable> : null}
      </View> : null}

      {error && visibleBrands.length ? <View accessibilityRole="alert" style={styles.offline}><Ionicons name="cloud-offline-outline" size={16} color="#7d3a48" /><Text style={[styles.offlineText, rtl && styles.rtlText]}>{t('brandOffline')}</Text><Pressable accessibilityRole="button" onPress={onRetry} style={styles.offlineRetry}><Text style={styles.offlineRetryText}>{t('brandTryAgain')}</Text></Pressable></View> : null}
      {state === 'loading'
        ? <View style={styles.grid}>{[0, 1, 2, 3].map(index => <BrandSkeleton key={index} width={cardWidth} label={copy.loading} />)}</View>
        : state === 'ready'
          ? <View style={styles.grid}>{visibleBrands.map((item, index) => <BrandCard key={item.label} item={item} index={index} width={cardWidth} reducedMotion={reducedMotion} rtl={rtl} copy={copy} onOpenBrand={onOpenBrand} />)}</View>
          : <BrandEmptyState error={emptyError} rtl={rtl} title={t(emptyError ? 'brandUnavailableTitle' : 'brandNoResultTitle')} message={emptyMessage} action={t(emptyError ? 'brandTryAgain' : 'brandClear')} onClear={() => onQueryChange('')} onRetry={onRetry} />}
    </View>
  );
});

const styles = StyleSheet.create({
  section: { marginTop: 32 },
  rtlSection: { direction: 'rtl' },
  rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  rtlInput: { textAlign: 'right', writingDirection: 'rtl' },
  directoryBack: { minHeight: 48, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 14 },
  directoryBackIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2ddda', alignItems: 'center', justifyContent: 'center' },
  directoryBackText: { fontSize: 10, fontWeight: '800', color: '#171310' },
  header: { marginBottom: 19 },
  headerWide: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24 },
  headerCopy: { maxWidth: 560, flexShrink: 1 },
  eyebrow: { fontSize: 8.5, lineHeight: 13, fontWeight: '900', letterSpacing: 1.55, color: RED },
  title: { fontFamily: 'serif', fontSize: 29, lineHeight: 34, fontWeight: '700', color: '#171310', marginTop: 4, letterSpacing: -.35 },
  subtitle: { maxWidth: 520, fontSize: 11.5, lineHeight: 18, color: '#706964', marginTop: 6 },
  viewAllPressed: { opacity: .62 },
  search: { minHeight: 56, borderRadius: 19, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dcd6d2', paddingLeft: 16, paddingRight: 6, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  searchFocused: { borderColor: '#858b90', shadowColor: '#1b1412', shadowOpacity: .06, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  input: { flex: 1, minWidth: 0, height: 54, paddingVertical: 0, borderWidth: 0, backgroundColor: 'transparent', fontSize: 13, color: '#171310' },
  clear: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#f0eeee', alignItems: 'center', justifyContent: 'center' },
  clearPressed: { backgroundColor: '#e4e1df' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: { height: 240, borderRadius: 20, overflow: 'hidden', backgroundColor: '#fff', borderWidth: 1, borderColor: '#e1dad6', shadowColor: '#221613', shadowOpacity: .075, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  cardHovered: { borderColor: '#c9bcb7', shadowOpacity: .12, shadowRadius: 14 },
  cardFocused: { borderColor: RED, shadowColor: RED, shadowOpacity: .13, shadowRadius: 8 },
  cardLifted: { transform: [{ translateY: -2 }] },
  cardPressed: { opacity: .88, transform: [{ scale: .985 }] },
  visual: { height: 132, overflow: 'hidden', backgroundColor: '#f3efec', borderBottomWidth: 1, borderBottomColor: '#ebe5e1' },
  visualGlow: { position: 'absolute', left: -20, top: -34, width: 122, height: 122, borderRadius: 61, backgroundColor: 'rgba(255,255,255,.78)' },
  identity: { position: 'absolute', left: 13, top: 14, width: '49%', minHeight: 46, zIndex: 2, justifyContent: 'center' },
  identityRtl: { left: 'auto', right: 12, alignItems: 'flex-end' },
  logo: { width: '100%', height: 40 },
  fallbackInitials: { fontFamily: 'serif', fontSize: 23, lineHeight: 27, fontWeight: '700', letterSpacing: 1.4, color: '#2f2825' },
  fallbackRule: { width: 24, height: 1, backgroundColor: RED, marginTop: 5 },
  bottle: { position: 'absolute', right: 1, bottom: 4, width: '50%', height: 118 },
  bottleRtl: { right: 'auto', left: -1 },
  bottleFallback: { position: 'absolute', right: 14, bottom: 16, width: 50, height: 64, borderRadius: 18, backgroundColor: 'rgba(255,255,255,.58)', alignItems: 'center', justifyContent: 'center' },
  bottleFallbackRtl: { right: 'auto', left: 14 },
  cardCopy: { flex: 1, paddingHorizontal: 13, paddingTop: 12, paddingBottom: 11 },
  brandName: { height: 38, fontFamily: 'serif', fontSize: 15.5, lineHeight: 18.5, fontWeight: '700', color: '#171310', letterSpacing: -.15 },
  cardFooter: { marginTop: 'auto', flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 6 },
  count: { fontSize: 9, lineHeight: 13, fontWeight: '800', letterSpacing: .45, color: '#675f5b' },
  explore: { fontSize: 8.5, lineHeight: 13, fontWeight: '900', letterSpacing: .72, color: RED, marginTop: 2 },
  arrow: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#211719', alignItems: 'center', justifyContent: 'center' },
  skeleton: { height: 240, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e8e2df', padding: 11 },
  skeletonVisual: { height: 120, borderRadius: 14, backgroundColor: '#ece7e4' },
  skeletonTitle: { width: '68%', height: 15, borderRadius: 8, backgroundColor: '#ece7e4', marginTop: 16 },
  skeletonMeta: { width: '42%', height: 9, borderRadius: 5, backgroundColor: '#f0ece9', marginTop: 12 },
  empty: { minHeight: 210, borderRadius: 19, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2ddda', alignItems: 'center', justifyContent: 'center', padding: 22 },
  emptyIcon: { width: 48, height: 48, borderRadius: 17, backgroundColor: '#fff0f4', alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontFamily: 'serif', fontSize: 20, lineHeight: 25, fontWeight: '700', color: '#171310', textAlign: 'center', marginTop: 11 },
  emptyText: { maxWidth: 330, fontSize: 11, lineHeight: 17, color: '#776e69', textAlign: 'center', marginTop: 4 },
  emptyButton: { minHeight: 44, borderRadius: 22, backgroundColor: '#211719', paddingHorizontal: 17, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  emptyButtonText: { fontSize: 8.5, fontWeight: '900', letterSpacing: .75, color: '#fff' },
  offline: { minHeight: 48, borderRadius: 15, backgroundColor: '#f7e9ec', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  offlineText: { flex: 1, fontSize: 10, lineHeight: 15, color: '#713341' },
  offlineRetry: { minWidth: 44, minHeight: 44, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' },
  offlineRetryText: { fontSize: 8, fontWeight: '900', letterSpacing: .55, color: RED },
});
