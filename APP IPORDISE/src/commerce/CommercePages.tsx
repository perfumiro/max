import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type TextInput as NativeTextInput,
  type TextInputProps,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { formatMad, loadSharedProducts, type Product } from "../sharedCatalog";
import {
  createOrder,
  loadDeliveryQuote,
  type CheckoutCustomer,
  type CompletedOrder,
} from "../services/orderService";
import { ApiError } from "../services/apiClient";
import {
  useBagSnapshot,
  useFavouriteSnapshot,
  useShoppingActions,
  type BagLine,
} from "./ShoppingContext";
import { useResponsiveLayout } from "../useResponsiveLayout";
import { SmoothScrollView as ScrollView } from "../components/smoothHorizontalScroll";
import {
  LocalizedText as Text,
  LocalizedTextInput as TextInput,
} from "../i18n/LocalizedPrimitives";
import { useCustomerAuth } from "../account/CustomerAuthContext";
import { useCustomer } from "../account/CustomerContext";
import {
  formatMoroccanPhoneInput,
  isValidEmail,
  isValidMoroccanPhone,
} from "../services/customerValidation";

const RED = "#d7193f";
const EMPTY_CHECKOUT_CUSTOMER: CheckoutCustomer = {
  name: "",
  phone: "",
  email: "",
  city: "",
  address: "",
};
let checkoutSessionDraft: { customer: CheckoutCustomer; notes: string } | null = null;
const linePrice = (line: BagLine) => {
  if (line.size && line.product.sizes[line.size])
    return line.product.sizes[line.size];
  const entries = Object.entries(line.product.sizes).filter(
    ([, price]) => price > 0,
  );
  return (
    (entries.find(
      ([size]) => size.replace(/\s/g, "").toLowerCase() === "100ml",
    ) ||
      entries.sort(
        ([a], [b]) => (parseFloat(b) || 0) - (parseFloat(a) || 0),
      )[0])?.[1] || 0
  );
};
const isPurchasable = (product: Product) =>
  Object.values(product.sizes).some((price) => price > 0);

function CommerceHeader({
  title,
  eyebrow,
  onBack,
  action,
}: {
  title: string;
  eyebrow: string;
  onBack: () => void;
  action?: React.ReactNode;
}) {
  return (
    <>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={6}
          onPress={onBack}
          style={({ pressed }) => [
            styles.back,
            pressed && bagStyles.controlPressed,
          ]}
        >
          <Ionicons name="arrow-back" size={21} color="#171310" />
        </Pressable>
        <View style={[styles.headerCopy, bagStyles.headerCopy]}>
          <Text
            maxFontSizeMultiplier={1.5}
            style={[styles.eyebrow, bagStyles.headerEyebrow]}
          >
            {eyebrow}
          </Text>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.72}
            maxFontSizeMultiplier={1.35}
            style={styles.title}
          >
            {title}
          </Text>
        </View>
        {action || <View style={styles.headerSpacer} />}
      </View>
      {title === "Checkout" ? <CheckoutFlow /> : null}
    </>
  );
}

function CheckoutFlow() {
  const reveal = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;
  const completedLine = useRef(new Animated.Value(0)).current;
  const activePulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let mounted = true;
    let sequence: Animated.CompositeAnimation | undefined;
    let pulse: Animated.CompositeAnimation | undefined;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (!mounted) return;
      if (reduceMotion) {
        reveal.forEach((value) => value.setValue(1));
        completedLine.setValue(1);
        return;
      }
      sequence = Animated.sequence([
        Animated.stagger(
          105,
          reveal.map((value) =>
            Animated.spring(value, {
              toValue: 1,
              friction: 8,
              tension: 88,
              useNativeDriver: true,
            }),
          ),
        ),
        Animated.timing(completedLine, {
          toValue: 1,
          duration: 520,
          useNativeDriver: true,
        }),
      ]);
      pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(activePulse, {
            toValue: 1,
            duration: 760,
            useNativeDriver: true,
          }),
          Animated.timing(activePulse, {
            toValue: 0,
            duration: 760,
            useNativeDriver: true,
          }),
          Animated.delay(500),
        ]),
        { iterations: 3 },
      );
      sequence.start(() => pulse?.start());
    });
    return () => {
      mounted = false;
      sequence?.stop();
      pulse?.stop();
    };
  }, [activePulse, completedLine, reveal]);
  const stepStyle = (value: Animated.Value) => ({
    opacity: value,
    transform: [
      {
        translateY: value.interpolate({
          inputRange: [0, 1],
          outputRange: [7, 0],
        }),
      },
      {
        scale: value.interpolate({
          inputRange: [0, 1],
          outputRange: [0.92, 1],
        }),
      },
    ],
  });
  return (
    <Animated.View
      accessible
      accessibilityLabel="Checkout progress: bag complete, delivery details current, confirmation next"
      style={professionalCheckoutStyles.flow}
    >
      <Animated.View
        style={[professionalCheckoutStyles.flowStep, stepStyle(reveal[0])]}
      >
        <View
          style={[
            professionalCheckoutStyles.flowNumber,
            professionalCheckoutStyles.flowNumberDone,
          ]}
        >
          <Ionicons name="checkmark" size={13} color="#fff" />
        </View>
        <View style={professionalCheckoutStyles.flowCopy}>
          <Text style={professionalCheckoutStyles.flowTextDone}>BAG</Text>
          <Text style={professionalCheckoutStyles.flowMetaDone}>COMPLETE</Text>
        </View>
      </Animated.View>
      <View style={professionalCheckoutStyles.flowLine}>
        <Animated.View
          style={[
            professionalCheckoutStyles.flowLineFill,
            { transform: [{ scaleX: completedLine }] },
          ]}
        />
      </View>
      <Animated.View
        style={[professionalCheckoutStyles.flowStep, stepStyle(reveal[1])]}
      >
        <View style={professionalCheckoutStyles.flowNumberStage}>
          <Animated.View
            pointerEvents="none"
            style={[
              professionalCheckoutStyles.flowPulse,
              {
                opacity: activePulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.22, 0],
                }),
                transform: [
                  {
                    scale: activePulse.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 1.62],
                    }),
                  },
                ],
              },
            ]}
          />
          <View
            style={[
              professionalCheckoutStyles.flowNumber,
              professionalCheckoutStyles.flowNumberActive,
            ]}
          >
            <Text style={professionalCheckoutStyles.flowNumberActiveText}>
              2
            </Text>
          </View>
        </View>
        <View style={professionalCheckoutStyles.flowCopy}>
          <Text style={professionalCheckoutStyles.flowTextActive}>DETAILS</Text>
          <Text style={professionalCheckoutStyles.flowMetaActive}>
            CURRENT STEP
          </Text>
        </View>
      </Animated.View>
      <View style={professionalCheckoutStyles.flowLine}>
        <View style={professionalCheckoutStyles.flowLineShimmer} />
      </View>
      <Animated.View
        style={[professionalCheckoutStyles.flowStep, stepStyle(reveal[2])]}
      >
        <View style={professionalCheckoutStyles.flowNumber}>
          <Text style={professionalCheckoutStyles.flowNumberText}>3</Text>
        </View>
        <View style={professionalCheckoutStyles.flowCopy}>
          <Text style={professionalCheckoutStyles.flowText}>CONFIRM</Text>
          <Text style={professionalCheckoutStyles.flowMeta}>UP NEXT</Text>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

function PremiumBagHeader({
  itemLabel,
  onBack,
}: {
  itemLabel: string;
  onBack: () => void;
}) {
  const entrance = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let active = true;
    let animation: Animated.CompositeAnimation | undefined;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (!active) return;
      if (reduceMotion) {
        entrance.setValue(1);
        progress.setValue(1);
        return;
      }
      animation = Animated.parallel([
        Animated.timing(entrance, {
          toValue: 1,
          duration: 360,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(180),
          Animated.timing(progress, {
            toValue: 1,
            duration: 680,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.delay(120),
          Animated.spring(pulse, {
            toValue: 1,
            friction: 5,
            tension: 110,
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 0,
            duration: 220,
            useNativeDriver: true,
          }),
        ]),
      ]);
      animation.start();
    });
    return () => {
      active = false;
      animation?.stop();
    };
  }, [entrance, progress, pulse]);
  return (
    <Animated.View
      style={[
        professionalBagStyles.headerCard,
        {
          opacity: entrance,
          transform: [
            {
              translateY: entrance.interpolate({
                inputRange: [0, 1],
                outputRange: [-7, 0],
              }),
            },
          ],
        },
      ]}
    >
      <View style={professionalBagStyles.headerTop}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
          onPress={onBack}
          style={({ pressed }) => [
            professionalBagStyles.headerBack,
            pressed && professionalBagStyles.pressed,
          ]}
        >
          <Ionicons name="arrow-back" size={20} color="#211719" />
        </Pressable>
        <View style={professionalBagStyles.headerCopy}>
          <Text style={professionalBagStyles.headerEyebrow}>
            YOUR SELECTION
          </Text>
          <View style={professionalBagStyles.headerTitleRow}>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              style={professionalBagStyles.headerTitle}
            >
              Shopping bag
            </Text>
            <View style={professionalBagStyles.headerCount}>
              <Text style={professionalBagStyles.headerCountText}>
                {itemLabel}
              </Text>
            </View>
          </View>
        </View>
        <View
          accessibilityLabel="Protected shopping bag"
          style={professionalBagStyles.headerSeal}
        >
          <Ionicons name="shield-checkmark-outline" size={19} color="#176b43" />
        </View>
      </View>
      <View
        accessibilityLabel="Checkout progress: bag, details, confirmation"
        style={professionalBagStyles.headerProgress}
      >
        <View style={professionalBagStyles.headerStep}>
          <Animated.View
            style={[
              professionalBagStyles.headerStepNumber,
              professionalBagStyles.headerStepNumberActive,
              {
                transform: [
                  {
                    scale: pulse.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 1.14],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={professionalBagStyles.headerStepNumberTextActive}>
              1
            </Text>
          </Animated.View>
          <Text style={professionalBagStyles.headerStepTextActive}>BAG</Text>
        </View>
        <View style={professionalBagStyles.headerStepLine}>
          <Animated.View
            style={[
              professionalBagStyles.headerStepLineFill,
              { transform: [{ scaleX: progress }] },
            ]}
          />
        </View>
        <View style={professionalBagStyles.headerStep}>
          <View style={professionalBagStyles.headerStepNumber}>
            <Text style={professionalBagStyles.headerStepNumberText}>2</Text>
          </View>
          <Text style={professionalBagStyles.headerStepText}>DETAILS</Text>
        </View>
        <View style={professionalBagStyles.headerStepLine} />
        <View style={professionalBagStyles.headerStep}>
          <View style={professionalBagStyles.headerStepNumber}>
            <Text style={professionalBagStyles.headerStepNumberText}>3</Text>
          </View>
          <Text style={professionalBagStyles.headerStepText}>CONFIRM</Text>
        </View>
      </View>
    </Animated.View>
  );
}

function ExploreButton({ onPress }: { onPress: () => void }) {
  const arrow = useRef(new Animated.Value(0)).current;
  const move = (toValue: number) =>
    Animated.spring(arrow, {
      toValue,
      useNativeDriver: true,
      speed: 24,
      bounciness: 4,
    }).start();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Explore fragrances"
      onPress={onPress}
      onPressIn={() => move(1)}
      onPressOut={() => move(0)}
      style={({ pressed }) => [
        styles.emptyBagButton,
        bagStyles.heroButton,
        pressed && bagStyles.controlPressed,
      ]}
    >
      <Text maxFontSizeMultiplier={1.4} style={bagStyles.heroButtonText}>
        Explore fragrances
      </Text>
      <View style={styles.emptyBagButtonArrow}>
        <Animated.View
          style={{
            transform: [
              {
                translateX: arrow.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 4],
                }),
              },
            ],
          }}
        >
          <Ionicons name="arrow-forward" size={18} color="#171310" />
        </Animated.View>
      </View>
    </Pressable>
  );
}

function BestsellerCard({
  product,
  width,
  onView,
}: {
  product: Product;
  width: number;
  onView: () => void;
}) {
  const { addToBag } = useShoppingActions();
  const purchasable = isPurchasable(product);
  const handleAction = () => {
    if (purchasable) addToBag(product);
    else onView();
  };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`View ${product.brand} ${product.name}, ${product.price}`}
      onPress={onView}
      style={({ pressed }) => [
        bagStyles.bestsellerCard,
        { width },
        pressed && bagStyles.cardPressed,
      ]}
    >
      <View style={bagStyles.bestsellerImageWrap}>
        <Image
          accessibilityLabel={`${product.brand} ${product.name}`}
          accessibilityIgnoresInvertColors
          source={product.image}
          resizeMode="contain"
          style={bagStyles.bestsellerImage}
        />
        {product.badge ? (
          <Text numberOfLines={1} style={bagStyles.bestsellerBadge}>
            {product.badge}
          </Text>
        ) : null}
      </View>
      <View style={bagStyles.bestsellerCopy}>
        <Text
          numberOfLines={1}
          maxFontSizeMultiplier={1.4}
          style={bagStyles.bestsellerBrand}
        >
          {product.brand}
        </Text>
        <Text
          numberOfLines={2}
          maxFontSizeMultiplier={1.35}
          style={bagStyles.bestsellerName}
        >
          {product.name}
        </Text>
        <Text
          numberOfLines={1}
          maxFontSizeMultiplier={1.3}
          style={bagStyles.bestsellerPrice}
        >
          {product.price}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            purchasable
              ? `Add ${product.brand} ${product.name} to bag`
              : `View ${product.brand} ${product.name}`
          }
          onPress={(event) => {
            event.stopPropagation();
            handleAction();
          }}
          style={({ pressed }) => [
            bagStyles.bestsellerAction,
            pressed && bagStyles.controlPressed,
          ]}
        >
          <Text style={bagStyles.bestsellerActionText}>
            {purchasable ? "Add to bag" : "View fragrance"}
          </Text>
          <Ionicons
            name={purchasable ? "add" : "arrow-forward"}
            size={17}
            color="#fff"
          />
        </Pressable>
      </View>
    </Pressable>
  );
}

function BestsellerSkeleton({ width }: { width: number }) {
  return (
    <View
      accessibilityLabel="Loading fragrance"
      style={[bagStyles.bestsellerCard, { width }]}
    >
      <View style={[bagStyles.bestsellerImageWrap, bagStyles.skeletonBlock]} />
      <View style={bagStyles.bestsellerCopy}>
        <View style={[bagStyles.skeletonLine, { width: "38%" }]} />
        <View style={[bagStyles.skeletonLine, { width: "82%", height: 15 }]} />
        <View style={[bagStyles.skeletonLine, { width: "55%" }]} />
        <View style={[bagStyles.bestsellerAction, bagStyles.skeletonBlock]} />
      </View>
    </View>
  );
}

export function WishlistPage({
  onBack,
  onBag,
  onProduct,
}: {
  onBack: () => void;
  onBag: () => void;
  onProduct: (product: Product) => void;
}) {
  const { favourites } = useFavouriteSnapshot();
  const { bagCount } = useBagSnapshot();
  const { toggleFavourite, addToBag } = useShoppingActions();
  const layout = useResponsiveLayout();
  const columns = layout.compact ? 1 : layout.tablet ? 3 : 2;
  const cardWidth = layout.compact ? "100%" : layout.tablet ? "31.8%" : "48.5%";
  const header = (
    <>
      <CommerceHeader
        eyebrow="YOUR IPORDISE"
        title="Saved fragrances"
        onBack={onBack}
        action={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open bag with ${bagCount} items`}
            onPress={onBag}
            style={[styles.headerAction, styles.touchTarget]}
          >
            <Ionicons name="bag-handle-outline" size={20} color="#171310" />
            {bagCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{bagCount}</Text>
              </View>
            )}
          </Pressable>
        }
      />
      {favourites.length ? (
        <Text style={styles.pageIntro}>
          A private edit of the fragrances you love. Add one to your bag
          whenever it feels right.
        </Text>
      ) : null}
    </>
  );
  const empty = (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name="heart-outline" size={34} color={RED} />
      </View>
      <Text style={styles.emptyTitle}>Your wishlist is waiting.</Text>
      <Text style={styles.emptyText}>
        Save the fragrances that catch your attention and return to them here.
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={onBack}
        style={styles.darkButton}
      >
        <Text style={styles.darkButtonText}>DISCOVER FRAGRANCES</Text>
      </Pressable>
    </View>
  );
  return (
    <FlatList
      key={`wishlist-${columns}`}
      data={favourites}
      numColumns={columns}
      keyExtractor={(product) => product.id}
      renderItem={({ item: product }) => (
        <View style={[styles.savedCard, { width: cardWidth }]}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Open ${product.brand} ${product.name}`} onPress={() => onProduct(product)} style={styles.savedImageWrap}>
            <Image
              source={product.image}
              resizeMode="contain"
              resizeMethod="resize"
              fadeDuration={0}
              style={styles.savedImage}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Remove from saved fragrances"
              onPress={() => toggleFavourite(product)}
              style={[styles.savedHeart, styles.touchTarget]}
            >
              <Ionicons name="heart" size={19} color={RED} />
            </Pressable>
          </Pressable>
          <Text style={styles.productBrand}>{product.brand}</Text>
          <Text accessibilityRole="link" onPress={() => onProduct(product)} numberOfLines={2} style={styles.productName}>{product.name}</Text>
          <Text style={styles.productPrice}>{product.price}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !isPurchasable(product) }}
            disabled={!isPurchasable(product)}
            onPress={() => addToBag(product)}
            style={[
              styles.savedAdd,
              styles.touchHeight,
              !isPurchasable(product) && styles.disabled,
            ]}
          >
            <Text style={styles.savedAddText}>
              {isPurchasable(product) ? "ADD TO BAG" : "NOT AVAILABLE"}
            </Text>
            <Ionicons
              name={isPurchasable(product) ? "add" : "hourglass-outline"}
              size={17}
              color="#fff"
            />
          </Pressable>
        </View>
      )}
      columnWrapperStyle={columns > 1 ? styles.savedGrid : undefined}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      contentContainerStyle={[styles.page, styles.shell]}
      initialNumToRender={columns * 4}
      maxToRenderPerBatch={columns * 3}
      windowSize={7}
      removeClippedSubviews={Platform.OS !== "web"}
      showsVerticalScrollIndicator={false}
    />
  );
}

// Retained temporarily while the premium bag rollout is compared in visual QA.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function FilledBagPage({
  onBack,
  onCheckout,
}: {
  onBack: () => void;
  onCheckout: () => void;
}) {
  const { bag, bagCount } = useBagSnapshot();
  const { removeFromBag, updateQuantity } = useShoppingActions();
  const layout = useResponsiveLayout();
  const subtotal = bag.reduce(
    (sum, line) => sum + linePrice(line) * line.quantity,
    0,
  );
  const delivery = 35;
  const itemLabel = `${bagCount} ${bagCount === 1 ? "item" : "items"}`;
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.page}
    >
      <View style={styles.shell}>
        <CommerceHeader
          eyebrow="YOUR SELECTION"
          title="Shopping bag"
          onBack={onBack}
          action={
            <View
              accessibilityLabel="Secure shopping bag"
              style={styles.bagHeaderSeal}
            >
              <Ionicons
                name="shield-checkmark-outline"
                size={19}
                color="#176b43"
              />
            </View>
          }
        />
        {bag.length ? (
          <>
            <View style={styles.bagIntro}>
              <Text style={styles.bagIntroText}>
                Review your fragrance selection before secure checkout.
              </Text>
              <Text style={styles.bagIntroCount}>
                {itemLabel.toUpperCase()}
              </Text>
            </View>
            <View style={styles.bagList}>
              {bag.map((line) => (
                <View
                  key={line.key}
                  style={[
                    styles.bagRow,
                    styles.bagRowPremium,
                    layout.compact && styles.bagRowCompact,
                  ]}
                >
                  <View
                    style={[
                      styles.bagImageWrap,
                      styles.bagImagePremium,
                      layout.compact && { width: 82 },
                    ]}
                  >
                    <Image
                      source={line.product.image}
                      resizeMode="contain"
                      style={styles.bagImage}
                    />
                    <View style={styles.bagAuthenticMark}>
                      <Ionicons name="checkmark" size={9} color="#fff" />
                    </View>
                  </View>
                  <View style={styles.bagCopy}>
                    <View style={styles.bagTop}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.productBrand}>
                          {line.product.brand}
                        </Text>
                        <Text numberOfLines={2} style={styles.bagName}>
                          {line.product.name}
                        </Text>
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${line.product.name}`}
                        onPress={() => removeFromBag(line.key)}
                        style={styles.bagRemove}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={16}
                          color="#786d67"
                        />
                      </Pressable>
                    </View>
                    <View style={styles.bagMetaRow}>
                      <View style={styles.bagSizePill}>
                        <Text style={styles.bagSizeText}>
                          {line.size?.replace(/(\d)ml/i, "$1 ml") ||
                            "Selected size"}
                        </Text>
                      </View>
                      <View style={styles.bagStockPill}>
                        <View style={styles.bagStockDot} />
                        <Text style={styles.bagStockText}>IN STOCK</Text>
                      </View>
                    </View>
                    <Text style={styles.bagUnitPrice}>
                      {formatMad(linePrice(line))} each
                    </Text>
                    <View style={styles.bagBottom}>
                      <View style={styles.quantity}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Decrease quantity"
                          onPress={() =>
                            updateQuantity(line.key, line.quantity - 1)
                          }
                          style={styles.quantityButton}
                        >
                          <Ionicons name="remove" size={15} color="#171310" />
                        </Pressable>
                        <Text
                          accessibilityLabel={`Quantity ${line.quantity}`}
                          style={styles.quantityText}
                        >
                          {line.quantity}
                        </Text>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Increase quantity"
                          onPress={() =>
                            updateQuantity(line.key, line.quantity + 1)
                          }
                          style={styles.quantityButton}
                        >
                          <Ionicons name="add" size={15} color="#171310" />
                        </Pressable>
                      </View>
                      <View style={styles.lineTotalGroup}>
                        <Text style={styles.lineTotalLabel}>LINE TOTAL</Text>
                        <Text style={styles.lineTotal}>
                          {formatMad(linePrice(line) * line.quantity)}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              ))}
            </View>
            <View style={[styles.summary, styles.summaryPremium]}>
              <View style={styles.summaryHeader}>
                <View>
                  <Text style={styles.summaryEyebrow}>ORDER SUMMARY</Text>
                  <Text style={styles.summaryHeading}>Your total</Text>
                </View>
                <Text style={styles.summaryItems}>{itemLabel}</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Fragrance subtotal</Text>
                <Text style={styles.summaryValue}>{formatMad(subtotal)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <View style={styles.deliveryLabel}>
                  <Ionicons name="car-outline" size={14} color="#756a64" />
                  <Text style={styles.summaryLabel}>
                    Delivery across Morocco
                  </Text>
                </View>
                <Text style={styles.summaryValue}>{formatMad(delivery)}</Text>
              </View>
              <View style={styles.totalPanel}>
                <View>
                  <Text style={styles.totalLabel}>Estimated total</Text>
                  <Text style={styles.totalTax}>
                    Cash on delivery · VAT included
                  </Text>
                </View>
                <Text style={styles.totalValue}>
                  {formatMad(subtotal + delivery)}
                </Text>
              </View>
              <View style={styles.bagTrustRow}>
                <View style={styles.bagTrustItem}>
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={15}
                    color="#176b43"
                  />
                  <Text style={styles.bagTrustText}>AUTHENTIC</Text>
                </View>
                <View style={styles.bagTrustDivider} />
                <View style={styles.bagTrustItem}>
                  <Ionicons name="cash-outline" size={15} color="#176b43" />
                  <Text style={styles.bagTrustText}>PAY ON DELIVERY</Text>
                </View>
                <View style={styles.bagTrustDivider} />
                <View style={styles.bagTrustItem}>
                  <Ionicons name="refresh-outline" size={15} color="#176b43" />
                  <Text style={styles.bagTrustText}>7-DAY RETURNS</Text>
                </View>
              </View>
              <Text style={styles.summaryHint}>
                Availability and the latest dashboard prices are confirmed
                securely at checkout.
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Continue to checkout, total ${formatMad(subtotal + delivery)}`}
                onPress={onCheckout}
                style={({ pressed }) => [
                  styles.checkoutButton,
                  pressed && { opacity: 0.88, transform: [{ scale: 0.99 }] },
                ]}
              >
                <View>
                  <Text style={styles.checkoutText}>CONTINUE TO CHECKOUT</Text>
                  <Text style={styles.checkoutSubtext}>
                    Secure order · Cash on delivery
                  </Text>
                </View>
                <View style={styles.checkoutArrow}>
                  <Ionicons name="arrow-forward" size={18} color="#fff" />
                </View>
              </Pressable>
            </View>
          </>
        ) : (
          <View style={styles.emptyBag}>
            <View
              style={[
                styles.emptyBagHero,
                layout.compact && styles.emptyBagHeroCompact,
              ]}
            >
              <Image
                accessibilityIgnoresInvertColors
                source={require("../../assets/empty-bag-editorial-v1.png")}
                resizeMode="cover"
                style={styles.emptyBagPhoto}
              />
              <LinearGradient
                colors={[
                  "rgba(7,5,6,.96)",
                  "rgba(12,7,8,.76)",
                  "rgba(12,7,8,.12)",
                ]}
                locations={[0, 0.58, 1]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFill}
              />
              <LinearGradient
                colors={[
                  "rgba(8,6,6,.12)",
                  "rgba(8,6,6,.24)",
                  "rgba(8,6,6,.92)",
                ]}
                locations={[0, 0.48, 1]}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.emptyBagTop}>
                <View style={styles.emptyBagStatus}>
                  <View style={styles.emptyBagStatusDot} />
                  <Text style={styles.emptyBagStatusText}>
                    YOUR BAG · 0 ITEMS
                  </Text>
                </View>
                <Text style={styles.emptyBagEdition}>IPORDISE EDIT</Text>
              </View>
              <View style={styles.emptyBagMark}>
                <Ionicons name="bag-handle-outline" size={25} color="#fff" />
              </View>
              <Text style={styles.emptyBagEyebrow}>YOUR NEXT SIGNATURE</Text>
              <Text style={styles.emptyBagTitle}>
                A fragrance is waiting for you.
              </Text>
              <Text style={styles.emptyBagText}>
                Explore our curated houses and discover the scent that belongs
                in your collection.
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Explore the fragrance collection"
                onPress={onBack}
                style={({ pressed }) => [
                  styles.emptyBagButton,
                  pressed && { opacity: 0.88, transform: [{ scale: 0.99 }] },
                ]}
              >
                <Text style={styles.emptyBagButtonText}>
                  EXPLORE THE COLLECTION
                </Text>
                <View style={styles.emptyBagButtonArrow}>
                  <Ionicons name="arrow-forward" size={16} color="#171310" />
                </View>
              </Pressable>
            </View>
            <View style={styles.emptyBagBenefits}>
              {[
                { icon: "shield-checkmark-outline", label: "100% AUTHENTIC" },
                { icon: "car-outline", label: "MOROCCO DELIVERY" },
                { icon: "cash-outline", label: "PAY ON DELIVERY" },
              ].map((item, index) => (
                <React.Fragment key={item.label}>
                  <View style={styles.emptyBagBenefit}>
                    <View style={styles.emptyBagBenefitIcon}>
                      <Ionicons
                        name={item.icon as any}
                        size={16}
                        color="#176b43"
                      />
                    </View>
                    <Text style={styles.emptyBagBenefitText}>{item.label}</Text>
                  </View>
                  {index < 2 ? (
                    <View style={styles.emptyBagBenefitDivider} />
                  ) : null}
                </React.Fragment>
              ))}
            </View>
            <Text style={styles.emptyBagFootnote}>
              Every order is checked and prepared by the IPORDISE boutique team.
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function PremiumBagLineCard({
  line,
  compact,
  onRemove,
  onQuantity,
}: {
  line: BagLine;
  compact: boolean;
  onRemove: () => void;
  onQuantity: (quantity: number) => void;
}) {
  const unitPrice = linePrice(line);
  const size = line.size?.replace(/(\d)ml/i, "$1 ml") || "Selected size";
  return (
    <View
      style={[
        professionalBagStyles.itemCard,
        compact && professionalBagStyles.itemCardCompact,
      ]}
    >
      <View
        style={[
          professionalBagStyles.productImageWrap,
          compact && professionalBagStyles.productImageCompact,
        ]}
      >
        <Image
          accessibilityLabel={`${line.product.brand} ${line.product.name}`}
          accessibilityIgnoresInvertColors
          source={line.product.image}
          resizeMode="contain"
          style={professionalBagStyles.productImage}
        />
        <View style={professionalBagStyles.authenticBadge}>
          <Ionicons name="checkmark" size={10} color="#fff" />
        </View>
      </View>
      <View style={professionalBagStyles.itemContent}>
        <View style={professionalBagStyles.itemTop}>
          <View style={professionalBagStyles.itemHeading}>
            <Text numberOfLines={1} style={professionalBagStyles.brand}>
              {line.product.brand}
            </Text>
            <Text numberOfLines={2} style={professionalBagStyles.productName}>
              {line.product.name}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove ${line.product.name}`}
            hitSlop={6}
            onPress={onRemove}
            style={({ pressed }) => [
              professionalBagStyles.removeButton,
              pressed && professionalBagStyles.pressed,
            ]}
          >
            <Ionicons name="trash-outline" size={17} color="#706761" />
          </Pressable>
        </View>
        <View style={professionalBagStyles.productMeta}>
          <Text style={professionalBagStyles.sizeText}>{size}</Text>
          <View style={professionalBagStyles.metaDot} />
          <View style={professionalBagStyles.stockRow}>
            <View style={professionalBagStyles.stockDot} />
            <Text style={professionalBagStyles.stockText}>In stock</Text>
          </View>
        </View>
        <View style={professionalBagStyles.itemPriceRow}>
          <View>
            <Text style={professionalBagStyles.unitLabel}>UNIT PRICE</Text>
            <Text style={professionalBagStyles.unitValue}>
              {formatMad(unitPrice)}
            </Text>
          </View>
          <View style={professionalBagStyles.linePriceGroup}>
            <Text style={professionalBagStyles.unitLabel}>ITEM TOTAL</Text>
            <Text style={professionalBagStyles.linePrice}>
              {formatMad(unitPrice * line.quantity)}
            </Text>
          </View>
        </View>
        <View style={professionalBagStyles.itemFooter}>
          <View style={professionalBagStyles.quantity}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Decrease ${line.product.name} quantity`}
              onPress={() => onQuantity(line.quantity - 1)}
              style={({ pressed }) => [
                professionalBagStyles.quantityButton,
                pressed && professionalBagStyles.pressed,
              ]}
            >
              <Ionicons name="remove" size={16} color="#211719" />
            </Pressable>
            <Text
              accessibilityLabel={`Quantity ${line.quantity}`}
              style={professionalBagStyles.quantityValue}
            >
              {line.quantity}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Increase ${line.product.name} quantity`}
              onPress={() => onQuantity(line.quantity + 1)}
              style={({ pressed }) => [
                professionalBagStyles.quantityButton,
                pressed && professionalBagStyles.pressed,
              ]}
            >
              <Ionicons name="add" size={16} color="#211719" />
            </Pressable>
          </View>
          <Text style={professionalBagStyles.quantityHint}>Quantity</Text>
        </View>
      </View>
    </View>
  );
}

function PremiumOrderSummary({
  subtotal,
  delivery,
  itemLabel,
  onCheckout,
}: {
  subtotal: number;
  delivery: number;
  itemLabel: string;
  onCheckout: () => void;
}) {
  const entrance = useRef(new Animated.Value(0)).current;
  const totalReveal = useRef(new Animated.Value(0)).current;
  const trustReveals = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;
  const arrowCue = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const intro = Animated.parallel([
      Animated.timing(entrance, {
        toValue: 1,
        duration: 430,
        useNativeDriver: true,
      }),
      Animated.spring(totalReveal, {
        toValue: 1,
        friction: 7,
        tension: 58,
        delay: 150,
        useNativeDriver: true,
      }),
      Animated.stagger(
        90,
        trustReveals.map((value) =>
          Animated.timing(value, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
        ),
      ),
    ]);
    const arrow = Animated.loop(
      Animated.sequence([
        Animated.timing(arrowCue, {
          toValue: 1,
          duration: 380,
          useNativeDriver: true,
        }),
        Animated.timing(arrowCue, {
          toValue: 0,
          duration: 380,
          useNativeDriver: true,
        }),
        Animated.delay(240),
      ]),
      { iterations: 3 },
    );
    intro.start(() => arrow.start());
    return () => {
      intro.stop();
      arrow.stop();
    };
  }, [arrowCue, entrance, totalReveal, trustReveals]);
  return (
    <Animated.View
      style={[
        professionalBagStyles.summaryCard,
        {
          opacity: entrance,
          transform: [
            {
              translateY: entrance.interpolate({
                inputRange: [0, 1],
                outputRange: [12, 0],
              }),
            },
          ],
        },
      ]}
    >
      <View style={professionalBagStyles.summaryHeader}>
        <View>
          <Text style={professionalBagStyles.summaryEyebrow}>
            ORDER SUMMARY
          </Text>
          <Text style={professionalBagStyles.summaryTitle}>Summary</Text>
        </View>
        <Text style={professionalBagStyles.itemCount}>{itemLabel}</Text>
      </View>
      <View style={professionalBagStyles.summaryDivider} />
      <View style={professionalBagStyles.summaryRow}>
        <Text style={professionalBagStyles.summaryLabel}>Subtotal</Text>
        <Text style={professionalBagStyles.summaryValue}>
          {formatMad(subtotal)}
        </Text>
      </View>
      <View style={professionalBagStyles.summaryRow}>
        <Text style={professionalBagStyles.summaryLabel}>
          Delivery across Morocco
        </Text>
        <Text style={professionalBagStyles.summaryValue}>
          {formatMad(delivery)}
        </Text>
      </View>
      <View style={professionalBagStyles.totalRow}>
        <View>
          <Text style={professionalBagStyles.totalLabel}>Total</Text>
          <Text style={professionalBagStyles.totalNote}>
            VAT and delivery included
          </Text>
        </View>
        <Text style={professionalBagStyles.totalValue}>
          {formatMad(subtotal + delivery)}
        </Text>
      </View>
      <View style={professionalBagStyles.assuranceRow}>
        <View style={professionalBagStyles.assuranceItem}>
          <Ionicons name="shield-checkmark-outline" size={17} color="#176b43" />
          <Text style={professionalBagStyles.assuranceText}>Authentic</Text>
        </View>
        <View style={professionalBagStyles.assuranceDivider} />
        <View style={professionalBagStyles.assuranceItem}>
          <Ionicons name="cash-outline" size={17} color="#176b43" />
          <Text style={professionalBagStyles.assuranceText}>
            Pay on delivery
          </Text>
        </View>
        <View style={professionalBagStyles.assuranceDivider} />
        <View style={professionalBagStyles.assuranceItem}>
          <Ionicons name="refresh-outline" size={17} color="#176b43" />
          <Text style={professionalBagStyles.assuranceText}>7-day returns</Text>
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Continue to checkout, total ${formatMad(subtotal + delivery)}`}
        onPress={onCheckout}
        style={({ pressed }) => [
          professionalBagStyles.checkoutButton,
          pressed && professionalBagStyles.checkoutPressed,
        ]}
      >
        <View>
          <Text style={professionalBagStyles.checkoutLabel}>
            CONTINUE TO CHECKOUT
          </Text>
          <Text style={professionalBagStyles.checkoutNote}>
            Cash on delivery
          </Text>
        </View>
        <Animated.View
          style={[
            professionalBagStyles.checkoutArrow,
            {
              transform: [
                {
                  translateX: arrowCue.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 3],
                  }),
                },
              ],
            },
          ]}
        >
          <Ionicons name="arrow-forward" size={19} color="#fff" />
        </Animated.View>
      </Pressable>
      <Text style={professionalBagStyles.secureNote}>
        Prices and availability are verified again at checkout.
      </Text>
    </Animated.View>
  );
}

function PremiumFilledBagPage({
  onBack,
  onCheckout,
}: {
  onBack: () => void;
  onCheckout: () => void;
}) {
  const { bag, bagCount } = useBagSnapshot();
  const { removeFromBag, updateQuantity } = useShoppingActions();
  const layout = useResponsiveLayout();
  const subtotal = bag.reduce(
    (sum, line) => sum + linePrice(line) * line.quantity,
    0,
  );
  const delivery = 35;
  const itemLabel = `${bagCount} ${bagCount === 1 ? "item" : "items"}`;
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.page, professionalBagStyles.page]}
    >
      <View style={styles.shell}>
        <PremiumBagHeader itemLabel={itemLabel} onBack={onBack} />
        <View style={professionalBagStyles.list}>
          {bag.map((line) => (
            <PremiumBagLineCard
              key={line.key}
              line={line}
              compact={layout.compact}
              onRemove={() => removeFromBag(line.key)}
              onQuantity={(quantity) => updateQuantity(line.key, quantity)}
            />
          ))}
        </View>
        <PremiumOrderSummary
          subtotal={subtotal}
          delivery={delivery}
          itemLabel={itemLabel}
          onCheckout={onCheckout}
        />
      </View>
    </ScrollView>
  );
}

// Styles for the retained visual-QA comparison above.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const premiumBagStyles = StyleSheet.create({
  intro: {
    minHeight: 70,
    borderRadius: 19,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5ddd8",
    padding: 12,
    marginBottom: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    shadowColor: "#2a1916",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  introIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#fff0f4",
    alignItems: "center",
    justifyContent: "center",
  },
  introCopy: { flex: 1, minWidth: 0 },
  introTitle: {
    fontFamily: "serif",
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "700",
    color: "#211719",
  },
  introText: { fontSize: 8, lineHeight: 12, color: "#82766f", marginTop: 2 },
  countPill: {
    height: 27,
    borderRadius: 14,
    backgroundColor: "#f3efec",
    paddingHorizontal: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  countText: {
    fontSize: 6,
    fontWeight: "900",
    letterSpacing: 0.75,
    color: "#766b65",
  },
  list: { gap: 11 },
  card: {
    minHeight: 208,
    borderRadius: 23,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e3dad5",
    padding: 12,
    flexDirection: "row",
    gap: 13,
    shadowColor: "#2a1916",
    shadowOpacity: 0.075,
    shadowRadius: 13,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  cardCompact: { minHeight: 0, gap: 9, padding: 9 },
  imageStage: {
    position: "relative",
    width: 112,
    borderRadius: 17,
    backgroundColor: "#f6f2f0",
    padding: 12,
    overflow: "hidden",
  },
  imageStageCompact: { width: 88, padding: 8 },
  image: { width: "100%", height: "100%" },
  authenticSeal: {
    position: "absolute",
    right: 7,
    bottom: 7,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#176b43",
    borderWidth: 2,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  imageEdition: {
    position: "absolute",
    left: 7,
    top: 7,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,.9)",
    paddingHorizontal: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  imageEditionText: {
    fontSize: 4.5,
    fontWeight: "900",
    letterSpacing: 0.55,
    color: "#756a64",
  },
  content: { flex: 1, minWidth: 0 },
  top: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  heading: { flex: 1, minWidth: 0 },
  brand: {
    fontSize: 6.5,
    lineHeight: 9,
    fontWeight: "900",
    letterSpacing: 1.05,
    color: "#765e55",
  },
  name: {
    fontFamily: "serif",
    fontSize: 16,
    lineHeight: 19,
    fontWeight: "700",
    color: "#171310",
    marginTop: 3,
  },
  remove: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#f5f1ef",
    borderWidth: 1,
    borderColor: "#eee7e2",
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.72, transform: [{ scale: 0.96 }] },
  details: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 9,
  },
  sizePill: {
    minHeight: 28,
    borderRadius: 14,
    backgroundColor: "#f4efec",
    paddingHorizontal: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  detailLabel: {
    fontSize: 4.8,
    fontWeight: "900",
    letterSpacing: 0.65,
    color: "#9a8e87",
  },
  sizeValue: { fontSize: 7, fontWeight: "900", color: "#4f4540" },
  stockPill: {
    height: 28,
    borderRadius: 14,
    backgroundColor: "#edf8f1",
    paddingHorizontal: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  stockDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#29945a",
  },
  stockText: {
    fontSize: 5.5,
    fontWeight: "900",
    letterSpacing: 0.65,
    color: "#176b43",
  },
  rule: {
    height: 1,
    backgroundColor: "#eee7e2",
    marginTop: 11,
    marginBottom: 10,
  },
  bottom: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 8,
  },
  bottomCompact: { flexWrap: "wrap" },
  controlLabel: {
    fontSize: 5,
    fontWeight: "900",
    letterSpacing: 0.8,
    color: "#9a8e87",
    marginBottom: 5,
  },
  quantity: {
    height: 43,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#ddd4cf",
    backgroundColor: "#fcfbfa",
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  },
  quantityButton: {
    width: 38,
    height: 41,
    alignItems: "center",
    justifyContent: "center",
  },
  quantityValueWrap: {
    minWidth: 35,
    height: 27,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "#eee7e2",
    alignItems: "center",
    justifyContent: "center",
  },
  quantityValue: { fontSize: 11, fontWeight: "900", color: "#171310" },
  pricePanel: {
    minWidth: 104,
    minHeight: 57,
    borderRadius: 15,
    backgroundColor: "#211719",
    paddingHorizontal: 11,
    paddingVertical: 8,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  priceLabel: {
    fontSize: 4.8,
    fontWeight: "900",
    letterSpacing: 0.75,
    color: "#ff91a9",
  },
  price: { fontSize: 14, fontWeight: "900", color: "#fff", marginTop: 2 },
  unitPrice: { fontSize: 5.5, color: "rgba(255,255,255,.52)", marginTop: 2 },
  summary: {
    marginTop: 14,
    borderRadius: 24,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2d8d3",
    padding: 17,
    shadowColor: "#2a1916",
    shadowOpacity: 0.09,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  summaryTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  summaryEyebrow: {
    fontSize: 6,
    fontWeight: "900",
    letterSpacing: 1.25,
    color: RED,
  },
  summaryTitle: {
    fontFamily: "serif",
    fontSize: 22,
    lineHeight: 27,
    fontWeight: "700",
    color: "#211719",
    marginTop: 2,
  },
  summaryStatus: {
    height: 25,
    borderRadius: 13,
    backgroundColor: "#edf8f1",
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  summaryStatusDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#29945a",
  },
  summaryStatusText: {
    fontSize: 5,
    fontWeight: "900",
    letterSpacing: 0.55,
    color: "#176b43",
  },
  summaryMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 9,
  },
  summaryMetaText: {
    fontSize: 5.5,
    fontWeight: "900",
    letterSpacing: 0.75,
    color: "#9a8e87",
  },
  breakdown: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#eee7e2",
    paddingVertical: 8,
    marginTop: 12,
  },
  breakdownRow: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  breakdownLabel: { flexDirection: "row", alignItems: "center", gap: 7 },
  breakdownText: { fontSize: 9, color: "#716761" },
  breakdownValue: { fontSize: 10, fontWeight: "900", color: "#211719" },
  breakdownRule: { height: 1, backgroundColor: "#f1ebe7" },
  totalHero: {
    minHeight: 88,
    borderRadius: 19,
    overflow: "hidden",
    paddingHorizontal: 15,
    paddingVertical: 14,
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  totalGlow: {
    position: "absolute",
    right: -30,
    top: -45,
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: "rgba(215,25,63,.2)",
  },
  totalHeroLabel: {
    fontSize: 5.5,
    fontWeight: "900",
    letterSpacing: 1,
    color: "#ff91a9",
  },
  totalHeroNote: {
    fontSize: 6.5,
    color: "rgba(255,255,255,.52)",
    marginTop: 4,
  },
  totalHeroValue: { fontSize: 23, fontWeight: "900", color: "#fff" },
  trustGrid: { flexDirection: "row", gap: 7, marginTop: 10 },
  trustCard: {
    flex: 1,
    minHeight: 82,
    borderRadius: 16,
    backgroundColor: "#f7f3f1",
    padding: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  trustIcon: {
    width: 30,
    height: 30,
    borderRadius: 11,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  trustLabel: {
    fontSize: 4.8,
    fontWeight: "900",
    letterSpacing: 0.5,
    color: "#365f4b",
    textAlign: "center",
    marginTop: 5,
  },
  trustDetail: {
    fontSize: 5.5,
    lineHeight: 8,
    color: "#958982",
    textAlign: "center",
    marginTop: 2,
  },
  verifiedNote: {
    minHeight: 55,
    borderRadius: 15,
    backgroundColor: "#edf8f1",
    paddingHorizontal: 11,
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  verifiedCopy: { flex: 1, minWidth: 0 },
  verifiedTitle: { fontSize: 7.5, fontWeight: "900", color: "#225f3e" },
  verifiedText: {
    fontSize: 6.5,
    lineHeight: 10,
    color: "#668071",
    marginTop: 2,
  },
  checkout: {
    minHeight: 62,
    borderRadius: 20,
    backgroundColor: RED,
    paddingLeft: 18,
    paddingRight: 7,
    marginTop: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: RED,
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  checkoutPressed: { opacity: 0.88, transform: [{ scale: 0.99 }] },
  checkoutLabel: {
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1.05,
    color: "#fff",
  },
  checkoutNote: { fontSize: 6.5, color: "rgba(255,255,255,.7)", marginTop: 3 },
  checkoutArrow: {
    width: 48,
    height: 48,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,.16)",
    alignItems: "center",
    justifyContent: "center",
  },
});

const professionalBagStyles = StyleSheet.create({
  page: { backgroundColor: "#f7f5f3", paddingBottom: 32 },
  headerCard: {
    borderRadius: 22,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e3dedb",
    padding: 14,
    marginBottom: 14,
    shadowColor: "#241917",
    shadowOpacity: 0.045,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  headerTop: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerBack: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#f7f4f2",
    borderWidth: 1,
    borderColor: "#e5dfdb",
    alignItems: "center",
    justifyContent: "center",
  },
  headerCopy: { flex: 1, minWidth: 0 },
  headerEyebrow: {
    fontSize: 6.5,
    fontWeight: "900",
    letterSpacing: 1.5,
    color: RED,
  },
  headerTitleRow: {
    marginTop: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  headerTitle: {
    flexShrink: 1,
    fontFamily: "serif",
    fontSize: 25,
    lineHeight: 30,
    fontWeight: "700",
    letterSpacing: -0.25,
    color: "#171310",
  },
  headerCount: {
    height: 24,
    borderRadius: 12,
    backgroundColor: "#fff0f4",
    paddingHorizontal: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCountText: {
    fontSize: 6.5,
    fontWeight: "900",
    letterSpacing: 0.45,
    color: "#a3233d",
  },
  headerSeal: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#edf8f1",
    borderWidth: 1,
    borderColor: "#d2eadb",
    alignItems: "center",
    justifyContent: "center",
  },
  headerProgress: {
    minHeight: 43,
    borderTopWidth: 1,
    borderColor: "#eee9e6",
    marginTop: 12,
    paddingTop: 11,
    paddingHorizontal: 3,
    flexDirection: "row",
    alignItems: "center",
  },
  headerStep: { flexDirection: "row", alignItems: "center", gap: 5 },
  headerStepNumber: {
    width: 19,
    height: 19,
    borderRadius: 10,
    backgroundColor: "#f0ece9",
    alignItems: "center",
    justifyContent: "center",
  },
  headerStepNumberActive: { backgroundColor: RED },
  headerStepNumberText: { fontSize: 6.5, fontWeight: "900", color: "#8b817b" },
  headerStepNumberTextActive: {
    fontSize: 6.5,
    fontWeight: "900",
    color: "#fff",
  },
  headerStepText: {
    fontSize: 5.5,
    fontWeight: "900",
    letterSpacing: 0.65,
    color: "#99908a",
  },
  headerStepTextActive: {
    fontSize: 5.5,
    fontWeight: "900",
    letterSpacing: 0.65,
    color: "#211719",
  },
  headerStepLine: {
    position: "relative",
    overflow: "hidden",
    flex: 1,
    height: 1,
    backgroundColor: "#e5dfdb",
    marginHorizontal: 7,
  },
  headerStepLineFill: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "#e65c78",
    transformOrigin: "left center",
  },
  intro: {
    minHeight: 48,
    marginBottom: 12,
    paddingHorizontal: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  introText: { flex: 1, fontSize: 10, lineHeight: 15, color: "#716963" },
  introCount: { fontSize: 8, fontWeight: "800", color: "#706761" },
  list: { gap: 12 },
  itemCard: {
    minHeight: 196,
    borderRadius: 21,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2dedb",
    padding: 13,
    flexDirection: "row",
    gap: 14,
    shadowColor: "#241917",
    shadowOpacity: 0.045,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  itemCardCompact: { minHeight: 184, padding: 11, gap: 11 },
  productImageWrap: {
    position: "relative",
    width: 122,
    height: 150,
    alignSelf: "flex-start",
    borderRadius: 18,
    backgroundColor: "#f4f3f2",
    borderWidth: 1,
    borderColor: "#ebe8e6",
    padding: 7,
    overflow: "hidden",
  },
  productImageCompact: { width: 102, height: 132, padding: 6 },
  productImage: {
    width: "100%",
    height: "100%",
    borderRadius: 13,
    backgroundColor: "#fff",
    transform: [{ scale: 1.08 }],
  },
  authenticBadge: {
    position: "absolute",
    right: 8,
    bottom: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#176b43",
    borderWidth: 2.5,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#176b43",
    shadowOpacity: 0.18,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  itemContent: { flex: 1, minWidth: 0 },
  itemTop: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  itemHeading: { flex: 1, minWidth: 0 },
  brand: { fontSize: 7, fontWeight: "900", letterSpacing: 1.15, color: RED },
  productName: {
    fontFamily: "serif",
    fontSize: 17,
    lineHeight: 21,
    fontWeight: "700",
    color: "#171310",
    marginTop: 3,
  },
  removeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "#e6e2df",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.65, transform: [{ scale: 0.96 }] },
  productMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 9,
  },
  sizeText: { fontSize: 8, fontWeight: "700", color: "#5f5752" },
  metaDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: "#c9c3bf" },
  stockRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  stockDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#29945a",
  },
  stockText: { fontSize: 7.5, fontWeight: "700", color: "#176b43" },
  itemPriceRow: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: "#eeeae7",
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 10,
  },
  unitLabel: {
    fontSize: 5.5,
    fontWeight: "900",
    letterSpacing: 0.8,
    color: "#9a918b",
  },
  unitValue: {
    fontSize: 11,
    fontWeight: "800",
    color: "#514a46",
    marginTop: 3,
  },
  linePriceGroup: { alignItems: "flex-end" },
  linePrice: {
    fontSize: 16,
    fontWeight: "900",
    color: "#171310",
    marginTop: 2,
  },
  itemFooter: {
    marginTop: "auto",
    paddingTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  quantity: {
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: "#dcd7d3",
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
  },
  quantityButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  quantityValue: {
    minWidth: 28,
    textAlign: "center",
    fontSize: 11,
    fontWeight: "900",
    color: "#171310",
  },
  quantityHint: { fontSize: 7.5, color: "#8b827d" },
  summaryCard: {
    marginTop: 14,
    borderRadius: 22,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2dedb",
    padding: 17,
    shadowColor: "#241917",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  summaryEyebrow: {
    fontSize: 6.5,
    fontWeight: "900",
    letterSpacing: 1.25,
    color: RED,
  },
  summaryTitle: {
    fontFamily: "serif",
    fontSize: 22,
    lineHeight: 27,
    fontWeight: "700",
    color: "#171310",
    marginTop: 2,
  },
  itemCount: { fontSize: 8, fontWeight: "800", color: "#766e69" },
  summaryDivider: { height: 1, backgroundColor: "#eae6e3", marginVertical: 14 },
  summaryRow: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  summaryLabel: { fontSize: 10, color: "#716963" },
  summaryValue: { fontSize: 11, fontWeight: "800", color: "#211b18" },
  totalRow: {
    minHeight: 76,
    borderRadius: 17,
    backgroundColor: "#f4f2f0",
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  totalLabel: {
    fontFamily: "serif",
    fontSize: 17,
    fontWeight: "700",
    color: "#171310",
  },
  totalNote: { fontSize: 7, color: "#887f79", marginTop: 3 },
  totalValue: { fontSize: 24, fontWeight: "900", color: "#171310" },
  assuranceRow: {
    minHeight: 62,
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#eeeae7",
  },
  assuranceItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  assuranceDivider: { width: 1, height: 28, backgroundColor: "#e8e4e1" },
  assuranceText: {
    fontSize: 6.5,
    fontWeight: "800",
    color: "#456252",
    textAlign: "center",
  },
  checkoutButton: {
    minHeight: 60,
    borderRadius: 30,
    backgroundColor: RED,
    marginTop: 13,
    paddingLeft: 20,
    paddingRight: 7,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: RED,
    shadowOpacity: 0.16,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  checkoutPressed: { opacity: 0.88, transform: [{ scale: 0.99 }] },
  checkoutLabel: {
    fontSize: 8.5,
    fontWeight: "900",
    letterSpacing: 1.05,
    color: "#fff",
  },
  checkoutNote: { fontSize: 7, color: "rgba(255,255,255,.75)", marginTop: 3 },
  checkoutArrow: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(255,255,255,.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  secureNote: {
    fontSize: 7.5,
    lineHeight: 12,
    color: "#8b827d",
    textAlign: "center",
    marginTop: 10,
  },
});

export function BagPage({
  onBack,
  onCheckout,
  onProduct,
}: {
  onBack: () => void;
  onCheckout: () => void;
  onProduct: (product: Product) => void;
}) {
  const { bag } = useBagSnapshot();
  const layout = useResponsiveLayout();
  const [products, setProducts] = useState<Product[]>([]);
  const [catalogState, setCatalogState] = useState<
    "loading" | "ready" | "empty" | "error"
  >("loading");
  const loadCatalog = async (forceRefresh = false) => {
    setCatalogState("loading");
    try {
      const liveProducts = await loadSharedProducts(forceRefresh);
      setProducts(liveProducts);
      setCatalogState(liveProducts.length ? "ready" : "empty");
    } catch {
      setCatalogState("error");
    }
  };
  useEffect(() => {
    let mounted = true;
    loadSharedProducts()
      .then((liveProducts) => {
        if (!mounted) return;
        setProducts(liveProducts);
        setCatalogState(liveProducts.length ? "ready" : "empty");
      })
      .catch(() => {
        if (mounted) setCatalogState("error");
      });
    return () => {
      mounted = false;
    };
  }, []);
  const bestsellers = useMemo(() => {
    const ranked = products.filter(
      (product) =>
        product.active !== false &&
        (product.filters.some(
          (filter) => filter.toLowerCase() === "best-sellers",
        ) ||
          ["BESTSELLER", "TRENDING", "ICONIC", "TOP RATED"].includes(
            product.badge.toUpperCase(),
          )),
    );
    return (
      ranked.length
        ? ranked
        : products
            .filter((product) => product.active !== false)
            .sort((a, b) => (b.reviewCount || 0) - (a.reviewCount || 0))
    ).slice(0, 10);
  }, [products]);
  if (bag.length)
    return <PremiumFilledBagPage onBack={onBack} onCheckout={onCheckout} />;
  const cardWidth = layout.tablet ? 224 : layout.compact ? 166 : 184;
  const heroHeight = layout.tablet ? 346 : layout.compact ? 318 : 334;
  const benefits = [
    { icon: "shield-checkmark-outline", label: "100% Authentic" },
    { icon: "car-outline", label: "Morocco Delivery" },
    { icon: "cash-outline", label: "Pay on Delivery" },
  ];
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={bagStyles.page}
    >
      <View
        style={[
          styles.shell,
          bagStyles.shell,
          layout.tablet && bagStyles.shellTablet,
          { width: Math.min(layout.width - 32, layout.tablet ? 920 : 720) },
        ]}
      >
        <CommerceHeader
          eyebrow="YOUR SELECTION"
          title="Shopping bag · 0"
          onBack={onBack}
          action={
            <View
              accessible
              accessibilityRole="image"
              accessibilityLabel="Secure shopping bag"
              style={styles.bagHeaderSeal}
            >
              <Ionicons
                accessibilityElementsHidden
                name="shield-checkmark-outline"
                size={22}
                color="#176b43"
              />
            </View>
          }
        />
        <View style={styles.emptyBag}>
          <View
            style={[
              styles.emptyBagHero,
              bagStyles.hero,
              { minHeight: heroHeight },
              layout.compact && bagStyles.heroCompact,
            ]}
          >
            <Image
              accessibilityLabel="Amber perfume bottle in the IPORDISE fragrance edit"
              accessibilityIgnoresInvertColors
              source={require("../../assets/empty-bag-editorial-v1.png")}
              resizeMode="cover"
              style={styles.emptyBagPhoto}
            />
            <LinearGradient
              pointerEvents="none"
              colors={[
                "rgba(7,5,6,.97)",
                "rgba(12,7,8,.72)",
                "rgba(12,7,8,.08)",
              ]}
              locations={[0, 0.6, 1]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              pointerEvents="none"
              colors={["rgba(8,6,6,.06)", "rgba(8,6,6,.1)", "rgba(8,6,6,.76)"]}
              locations={[0, 0.55, 1]}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.emptyBagTop}>
              <View style={[styles.emptyBagStatus, bagStyles.status]}>
                <View style={styles.emptyBagStatusDot} />
                <Text style={bagStyles.statusText}>YOUR BAG · 0 ITEMS</Text>
              </View>
              <Text style={bagStyles.edition}>IPORDISE EDIT</Text>
            </View>
            <View
              accessible
              accessibilityRole="image"
              accessibilityLabel="Shopping bag"
              style={[styles.emptyBagMark, bagStyles.heroMark]}
            >
              <Ionicons
                accessibilityElementsHidden
                name="bag-handle-outline"
                size={24}
                color="#fff"
              />
            </View>
            <Text maxFontSizeMultiplier={1.4} style={bagStyles.heroEyebrow}>
              YOUR NEXT SIGNATURE
            </Text>
            <Text maxFontSizeMultiplier={1.3} style={bagStyles.heroTitle}>
              Your signature scent is waiting.
            </Text>
            <Text maxFontSizeMultiplier={1.35} style={bagStyles.heroText}>
              Explore our curated fragrances and discover the one that belongs
              in your collection.
            </Text>
            <ExploreButton onPress={onBack} />
          </View>
          <View
            accessible
            accessibilityLabel="Shopping benefits"
            style={[styles.emptyBagBenefits, bagStyles.benefits]}
          >
            {benefits.map((item, index) => (
              <React.Fragment key={item.label}>
                <View
                  accessible
                  accessibilityLabel={item.label}
                  style={styles.emptyBagBenefit}
                >
                  <View style={bagStyles.benefitIcon}>
                    <Ionicons
                      accessibilityElementsHidden
                      name={item.icon as any}
                      size={20}
                      color="#176b43"
                    />
                  </View>
                  <Text
                    maxFontSizeMultiplier={1.35}
                    style={bagStyles.benefitText}
                  >
                    {item.label}
                  </Text>
                </View>
                {index < benefits.length - 1 ? (
                  <View style={bagStyles.benefitDivider} />
                ) : null}
              </React.Fragment>
            ))}
          </View>
          <View style={bagStyles.bestsellerSection}>
            <View style={bagStyles.bestsellerHeadingRow}>
              <View style={bagStyles.bestsellerHeadingCopy}>
                <Text style={bagStyles.bestsellerEyebrow}>
                  CURATED BY IPORDISE
                </Text>
                <Text
                  maxFontSizeMultiplier={1.35}
                  style={bagStyles.bestsellerHeading}
                >
                  Discover our bestsellers
                </Text>
                <Text
                  maxFontSizeMultiplier={1.4}
                  style={bagStyles.bestsellerSubtitle}
                >
                  Loved fragrances, selected from our live catalogue.
                </Text>
              </View>
              {catalogState === "ready" ? (
                <Text
                  accessibilityLabel={`${bestsellers.length} fragrances`}
                  style={bagStyles.bestsellerCount}
                >
                  {String(bestsellers.length).padStart(2, "0")}
                </Text>
              ) : null}
            </View>
            {catalogState === "loading" ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={bagStyles.bestsellerRail}
              >
                {[0, 1, 2].map((index) => (
                  <BestsellerSkeleton key={index} width={cardWidth} />
                ))}
              </ScrollView>
            ) : catalogState === "error" ? (
              <View accessibilityRole="alert" style={bagStyles.catalogMessage}>
                <View style={bagStyles.catalogMessageIcon}>
                  <Ionicons
                    accessibilityElementsHidden
                    name="cloud-offline-outline"
                    size={22}
                    color="#6f2638"
                  />
                </View>
                <View style={bagStyles.catalogMessageCopy}>
                  <Text style={bagStyles.catalogMessageTitle}>
                    The edit is temporarily unavailable.
                  </Text>
                  <Text style={bagStyles.catalogMessageText}>
                    Check your connection and try loading the live catalogue
                    again.
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Retry loading bestsellers"
                  onPress={() => void loadCatalog(true)}
                  style={({ pressed }) => [
                    bagStyles.catalogRetry,
                    pressed && bagStyles.controlPressed,
                  ]}
                >
                  <Ionicons
                    accessibilityElementsHidden
                    name="refresh"
                    size={18}
                    color="#fff"
                  />
                </Pressable>
              </View>
            ) : catalogState === "empty" || !bestsellers.length ? (
              <View style={bagStyles.catalogMessage}>
                <View style={bagStyles.catalogMessageIcon}>
                  <Ionicons
                    accessibilityElementsHidden
                    name="sparkles-outline"
                    size={22}
                    color="#6f2638"
                  />
                </View>
                <View style={bagStyles.catalogMessageCopy}>
                  <Text style={bagStyles.catalogMessageTitle}>
                    A new edit is being prepared.
                  </Text>
                  <Text style={bagStyles.catalogMessageText}>
                    Explore the full collection while our bestsellers are
                    refreshed.
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Explore all fragrances"
                  onPress={onBack}
                  style={({ pressed }) => [
                    bagStyles.catalogRetry,
                    pressed && bagStyles.controlPressed,
                  ]}
                >
                  <Ionicons
                    accessibilityElementsHidden
                    name="arrow-forward"
                    size={18}
                    color="#fff"
                  />
                </Pressable>
              </View>
            ) : (
              <ScrollView
                horizontal
                nestedScrollEnabled
                directionalLockEnabled
                showsHorizontalScrollIndicator={false}
                decelerationRate="fast"
                snapToInterval={cardWidth + 12}
                snapToAlignment="start"
                contentContainerStyle={bagStyles.bestsellerRail}
              >
                {bestsellers.map((product) => (
                  <BestsellerCard
                    key={product.id}
                    product={product}
                    width={cardWidth}
                    onView={() => onProduct(product)}
                  />
                ))}
              </ScrollView>
            )}
          </View>
          <Text maxFontSizeMultiplier={1.5} style={bagStyles.footnote}>
            Every order is checked and prepared by the IPORDISE boutique team.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

type CheckoutFormFieldProps = {
  name: "name" | "phone" | "email" | "city" | "address" | "notes";
  label: string;
  icon: string;
  value: string;
  onChangeText: (value: string) => void;
  accessibilityLabel: string;
  placeholder: string;
  autoCapitalize?: TextInputProps["autoCapitalize"];
  autoCorrect?: boolean;
  keyboardType?: TextInputProps["keyboardType"];
  multiline?: "large" | "small";
  inputRef?: React.RefObject<NativeTextInput | null>;
  returnKeyType?: TextInputProps["returnKeyType"];
  onSubmitEditing?: TextInputProps["onSubmitEditing"];
};

/**
 * Owns only the transient focus state for one native input. Keeping this
 * component at module scope gives React a stable element type and prevents a
 * focus change in one field from rebuilding the other native TextInputs.
 */
const CheckoutFormField = React.memo(function CheckoutFormField({
  name,
  label,
  icon,
  value,
  onChangeText,
  accessibilityLabel,
  placeholder,
  autoCapitalize,
  autoCorrect,
  keyboardType,
  multiline,
  inputRef,
  returnKeyType,
  onSubmitEditing,
}: CheckoutFormFieldProps) {
  const [isFocused, setIsFocused] = useState(false);
  const optional = label.includes("OPTIONAL");
  const displayLabel = label.replace(/\s*·?\s*OPTIONAL/g, "");
  const normalizedValue = value.trim();
  const hasValue = Boolean(normalizedValue);
  const validatesFormat = name === "phone" || name === "email";
  const formatValid =
    name === "phone"
      ? isValidMoroccanPhone(normalizedValue)
      : name === "email"
        ? isValidEmail(normalizedValue)
        : hasValue;
  const invalid = validatesFormat && hasValue && !formatValid;
  const confirmed = hasValue && formatValid;
  const validationMessage =
    name === "phone"
      ? formatValid
        ? "Moroccan phone number confirmed."
        : "Use 10 digits, for example 06 12 34 56 78."
      : name === "email"
        ? formatValid
          ? "Email address confirmed."
          : "Enter a complete email such as name@example.com."
        : "";

  return (
    <View
      style={[
        styles.checkoutField,
        professionalCheckoutStyles.field,
        confirmed && professionalCheckoutStyles.fieldComplete,
        invalid && professionalCheckoutStyles.fieldInvalid,
        isFocused && styles.checkoutFieldFocused,
        isFocused && professionalCheckoutStyles.fieldFocused,
        multiline && styles.checkoutFieldMultiline,
        multiline && professionalCheckoutStyles.fieldMultiline,
      ]}
    >
      <View
        style={[
          styles.checkoutFieldIcon,
          professionalCheckoutStyles.fieldIcon,
          confirmed && professionalCheckoutStyles.fieldIconComplete,
          invalid && professionalCheckoutStyles.fieldIconInvalid,
          isFocused && styles.checkoutFieldIconFocused,
          isFocused && professionalCheckoutStyles.fieldIconFocused,
        ]}
      >
        <Ionicons
          accessibilityElementsHidden
          name={icon as any}
          size={18}
          color={
            isFocused
              ? RED
              : invalid
                ? RED
                : confirmed
                  ? "#176b43"
                  : "#555b61"
          }
        />
      </View>
      <View style={[styles.checkoutFieldCopy, professionalCheckoutStyles.fieldCopy]}>
        <View style={professionalCheckoutStyles.fieldLabelRow}>
          <Text
            style={[
              styles.checkoutFieldLabel,
              professionalCheckoutStyles.fieldLabel,
              isFocused && styles.checkoutFieldLabelFocused,
            ]}
          >
            {displayLabel}
          </Text>
          {invalid ? (
            <View style={[professionalCheckoutStyles.fieldStatus, professionalCheckoutStyles.fieldStatusInvalid]}>
              <Ionicons name="alert-circle" size={8} color={RED} />
              <Text style={[professionalCheckoutStyles.fieldStatusText, professionalCheckoutStyles.fieldStatusTextInvalid]}>CHECK</Text>
            </View>
          ) : confirmed ? (
            <View style={[professionalCheckoutStyles.fieldStatus, professionalCheckoutStyles.fieldStatusComplete]}>
              <Ionicons name="checkmark" size={8} color="#176b43" />
              <Text style={[professionalCheckoutStyles.fieldStatusText, professionalCheckoutStyles.fieldStatusTextComplete]}>
                {validatesFormat ? "CORRECT" : "ADDED"}
              </Text>
            </View>
          ) : optional ? (
            <View style={[professionalCheckoutStyles.fieldStatus, professionalCheckoutStyles.fieldStatusOptional]}>
              <Text style={[professionalCheckoutStyles.fieldStatusText, professionalCheckoutStyles.fieldStatusTextOptional]}>OPTIONAL</Text>
            </View>
          ) : (
            <View style={[professionalCheckoutStyles.fieldStatus, professionalCheckoutStyles.fieldStatusRequired]}>
              <Text style={[professionalCheckoutStyles.fieldStatusText, professionalCheckoutStyles.fieldStatusTextRequired]}>REQUIRED</Text>
            </View>
          )}
        </View>
        <TextInput
          ref={inputRef}
          accessibilityLabel={accessibilityLabel}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          keyboardType={keyboardType}
          multiline={Boolean(multiline)}
          textAlignVertical={multiline ? "top" : "center"}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          placeholderTextColor="#9b918b"
          selectionColor={RED}
          cursorColor={RED}
          showSoftInputOnFocus
          returnKeyType={returnKeyType}
          blurOnSubmit={multiline ? undefined : returnKeyType === "done"}
          onSubmitEditing={onSubmitEditing}
          style={[
            styles.checkoutFieldInput,
            multiline === "large" && styles.checkoutFieldTextarea,
            multiline === "small" && styles.checkoutFieldTextareaSmall,
            professionalCheckoutStyles.input,
          ]}
        />
        {validatesFormat ? (
          <View
            accessibilityElementsHidden={!hasValue}
            importantForAccessibility={hasValue ? "auto" : "no-hide-descendants"}
            accessibilityRole={hasValue && invalid ? "alert" : undefined}
            style={[
              professionalCheckoutStyles.fieldMessage,
              !hasValue && professionalCheckoutStyles.fieldMessagePlaceholder,
            ]}
          >
            <Ionicons
              name={invalid ? "alert-circle-outline" : "checkmark-circle-outline"}
              size={11}
              color={invalid ? RED : "#176b43"}
            />
            <Text
              style={[
                professionalCheckoutStyles.fieldMessageText,
                invalid
                  ? professionalCheckoutStyles.fieldMessageError
                  : professionalCheckoutStyles.fieldMessageSuccess,
              ]}
            >
              {validationMessage}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
});

export function CheckoutPage({
  onBack,
  onComplete,
}: {
  onBack: () => void;
  onComplete: (order: CompletedOrder) => void;
}) {
  const layout = useResponsiveLayout();
  const { bag } = useBagSnapshot();
  const { clearBag, refreshBag } = useShoppingActions();
  const { session } = useCustomerAuth();
  const { profile, addresses, defaultAddress, loading: customerLoading, updateProfile, upsertAddress } = useCustomer();
  const [customer, setCustomer] = useState<CheckoutCustomer>(() => ({
    ...(checkoutSessionDraft?.customer || EMPTY_CHECKOUT_CUSTOMER),
  }));
  const [notes, setNotes] = useState(() => checkoutSessionDraft?.notes || "");
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(
    null,
  );
  const [addressPickerOpen, setAddressPickerOpen] = useState(false);
  const [saveProfileChanges, setSaveProfileChanges] = useState(false);
  const [saveAddressChanges, setSaveAddressChanges] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const subtotal = bag.reduce(
    (sum, line) => sum + linePrice(line) * line.quantity,
    0,
  );
  const [delivery, setDelivery] = useState(35);
  const [deliveryAvailable, setDeliveryAvailable] = useState(true);
  const itemCount = bag.reduce((sum, line) => sum + line.quantity, 0);
  const prefilledIdentity = useRef<string | null>(null);
  const phoneInputRef = useRef<NativeTextInput>(null);
  const emailInputRef = useRef<NativeTextInput>(null);
  const cityInputRef = useRef<NativeTextInput>(null);
  const addressInputRef = useRef<NativeTextInput>(null);
  useEffect(() => {
    checkoutSessionDraft = { customer, notes };
  }, [customer, notes]);
  useEffect(() => {
    if (!session || customerLoading || prefilledIdentity.current === session.user.id) return;
    const address = defaultAddress;
    setSelectedAddressId(address?.id || null);
    setCustomer({
      name:
        [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
        profile?.display_name ||
        "",
      phone: profile?.phone || address?.phone || "",
      email: session.user.email || profile?.email || "",
      city: address?.city || "",
      address: [address?.address_line1, address?.address_line2]
        .filter(Boolean)
        .join(", "),
    });
    setNotes(address?.delivery_instructions || "");
    prefilledIdentity.current = session.user.id;
  }, [customerLoading, defaultAddress, profile, session]);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      void loadDeliveryQuote(customer.city, subtotal)
        .then((quote) => {
          if (active) {
            setDelivery(quote.deliveryFee);
            setDeliveryAvailable(quote.available);
          }
        })
        .catch(() => undefined);
    }, 350);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [customer.city, subtotal]);
  const update = useCallback((key: keyof CheckoutCustomer, value: string) => {
    setError("");
    setCustomer((current) => ({
      ...current,
      [key]: key === "phone" ? formatMoroccanPhoneInput(value) : value,
    }));
  }, []);
  const updateName = useCallback((value: string) => update("name", value), [update]);
  const updatePhone = useCallback((value: string) => update("phone", value), [update]);
  const updateEmail = useCallback((value: string) => update("email", value), [update]);
  const updateCity = useCallback((value: string) => update("city", value), [update]);
  const updateAddress = useCallback((value: string) => update("address", value), [update]);
  const chooseAddress = (address: typeof defaultAddress) => {
    if (!address) return;
    setSelectedAddressId(address.id);
    setCustomer((current) => ({
      ...current,
      phone: address.phone || current.phone,
      city: address.city,
      address: [address.address_line1, address.address_line2]
        .filter(Boolean)
        .join(", "),
    }));
    setNotes(address.delivery_instructions || "");
    setAddressPickerOpen(false);
    setSaveAddressChanges(false);
  };
  const submit = async () => {
    if (!bag.length) {
      setError("Your bag is empty. Add a fragrance before checkout.");
      return;
    }
    if (!isValidMoroccanPhone(customer.phone)) {
      setError(
        "Enter a valid Moroccan phone number, for example 06 12 34 56 78.",
      );
      return;
    }
    if (customer.email && !isValidEmail(customer.email)) {
      setError("Enter a complete email address, for example name@example.com.");
      return;
    }
    if (
      customer.name.trim().length < 2 ||
      customer.city.trim().length < 2 ||
      customer.address.trim().length < 5
    ) {
      setError(
        "Complete your name and delivery address before placing the order.",
      );
      return;
    }
    if (!deliveryAvailable) {
      setError("Delivery is not currently available for the selected city.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const order = await createOrder(
        customer,
        bag,
        session?.access_token || "",
        notes,
      );
      if (session) {
        const names = customer.name.trim().split(/\s+/);
        const saves: Promise<unknown>[] = [];
        if (saveProfileChanges)
          saves.push(
            updateProfile({
              first_name: names.shift() || "",
              last_name: names.join(" "),
              phone: customer.phone,
            }),
          );
        if (saveAddressChanges)
          saves.push(
            upsertAddress({
              id: selectedAddressId || undefined,
              label:
                addresses.find((item) => item.id === selectedAddressId)
                  ?.label || "Home",
              recipient_name: customer.name,
              phone: customer.phone,
              country: "Morocco",
              city: customer.city,
              address_line1: customer.address,
              address_line2: null,
              delivery_instructions: notes || null,
              is_default:
                addresses.length === 0 ||
                Boolean(
                  addresses.find((item) => item.id === selectedAddressId)
                    ?.is_default,
                ),
            }),
          );
        await Promise.allSettled(saves);
      }
      onComplete(order);
      checkoutSessionDraft = null;
      clearBag();
    } catch (error) {
      if (
        error instanceof ApiError &&
        ["PRICE_CHANGED", "OUT_OF_STOCK", "ITEM_UNAVAILABLE"].includes(
          error.code || "",
        )
      )
        await refreshBag().catch(() => undefined);
      setError(
        error instanceof Error
          ? error.message
          : "Checkout is temporarily unavailable. Your bag has been saved; please try again.",
      );
    } finally {
      setLoading(false);
    }
  };
  if (!bag.length) {
    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.checkoutPage, professionalCheckoutStyles.page]}
      >
        <View style={[styles.shell, professionalCheckoutStyles.shell]}>
          <CommerceHeader eyebrow="YOUR BAG" title="Checkout" onBack={onBack} />
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="bag-outline" size={34} color={RED} />
            </View>
            <Text accessibilityRole="header" style={styles.emptyTitle}>Your bag is empty.</Text>
            <Text style={styles.emptyText}>Add a fragrance before continuing to checkout.</Text>
            <Pressable accessibilityRole="button" onPress={onBack} style={styles.darkButton}>
              <Text style={styles.darkButtonText}>EXPLORE PERFUMES</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    );
  }
  return (
    <>
      <ScrollView
        keyboardShouldPersistTaps="always"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "none"}
        automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
        removeClippedSubviews={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.checkoutPage,
          professionalCheckoutStyles.page,
        ]}
      >
        <View style={[styles.shell, professionalCheckoutStyles.shell]}>
          <CommerceHeader
            eyebrow="SECURE ORDER"
            title="Checkout"
            onBack={onBack}
          />
          <View
            accessible
            accessibilityLabel="Checkout progress. Step one of two, delivery details."
            style={[
              styles.checkoutProgress,
              professionalCheckoutStyles.progress,
            ]}
          >
            <View style={styles.checkoutProgressItem}>
              <View style={styles.checkoutProgressActive}>
                <Text style={styles.checkoutProgressActiveText}>1</Text>
              </View>
              <View>
                <Text style={styles.checkoutProgressLabelActive}>DELIVERY</Text>
                <Text style={styles.checkoutProgressMeta}>Your details</Text>
              </View>
            </View>
            <View style={styles.checkoutProgressLine} />
            <View style={styles.checkoutProgressItem}>
              <View style={styles.checkoutProgressNext}>
                <Text style={styles.checkoutProgressNextText}>2</Text>
              </View>
              <View>
                <Text style={styles.checkoutProgressLabel}>CONFIRMATION</Text>
                <Text style={styles.checkoutProgressMeta}>Order received</Text>
              </View>
            </View>
          </View>
          <View
            style={[
              styles.checkoutAssurance,
              professionalCheckoutStyles.assurance,
            ]}
          >
            <View style={styles.checkoutAssuranceIcon}>
              <Ionicons name="shield-checkmark" size={20} color="#176b43" />
            </View>
            <View style={styles.checkoutAssuranceCopy}>
              <Text style={styles.checkoutAssuranceTitle}>
                Protected boutique checkout
              </Text>
              <Text style={styles.checkoutAssuranceText}>
                Availability and live IPORDISE prices are verified securely
                before your order is created.
              </Text>
            </View>
            <View style={styles.checkoutSecurePill}>
              <View style={styles.checkoutSecureDot} />
              <Text style={styles.checkoutSecureText}>SECURE</Text>
            </View>
          </View>
          <View
            style={[
              styles.checkoutSectionCard,
              professionalCheckoutStyles.sectionCard,
            ]}
          >
            <View
              style={[
                styles.checkoutSectionHead,
                professionalCheckoutStyles.sectionHead,
              ]}
            >
              <View
                style={[
                  styles.checkoutSectionNumber,
                  professionalCheckoutStyles.sectionNumber,
                ]}
              >
                <Text style={styles.checkoutSectionNumberText}>01</Text>
              </View>
              <View style={styles.checkoutSectionCopy}>
                <Text style={styles.checkoutSectionEyebrow}>
                  CONTACT DETAILS
                </Text>
                <Text
                  style={[
                    styles.checkoutSectionTitle,
                    professionalCheckoutStyles.sectionTitle,
                  ]}
                >
                  Contact information
                </Text>
                <Text
                  style={[
                    styles.checkoutSectionText,
                    professionalCheckoutStyles.sectionText,
                  ]}
                >
                  Enter the details we should use for this order.
                </Text>
              </View>
            </View>
            <CheckoutFormField
              key="checkout-name"
              name="name"
              label="FULL NAME"
              icon="person-outline"
              accessibilityLabel="Full name"
              autoCapitalize="words"
              value={customer.name}
              onChangeText={updateName}
              placeholder="Your full name"
              returnKeyType="next"
              onSubmitEditing={() => phoneInputRef.current?.focus()}
            />
            <CheckoutFormField
              key="checkout-phone"
              name="phone"
              label="MOROCCAN PHONE NUMBER"
              icon="call-outline"
              accessibilityLabel="Moroccan phone number"
              keyboardType="phone-pad"
              value={customer.phone}
              onChangeText={updatePhone}
              placeholder="06 12 34 56 78"
              inputRef={phoneInputRef}
              returnKeyType="next"
              onSubmitEditing={() => emailInputRef.current?.focus()}
            />
            <CheckoutFormField
              key="checkout-email"
              name="email"
              label="EMAIL · OPTIONAL"
              icon="mail-outline"
              accessibilityLabel="Email, optional"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              value={customer.email || ""}
              onChangeText={updateEmail}
              placeholder="you@example.com"
              inputRef={emailInputRef}
              returnKeyType="next"
              onSubmitEditing={() => cityInputRef.current?.focus()}
            />
          </View>
          {session ? (
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: saveProfileChanges }} onPress={() => setSaveProfileChanges(value => !value)} style={professionalCheckoutStyles.saveChoice}>
              <Ionicons name={saveProfileChanges ? "checkbox" : "square-outline"} size={20} color={saveProfileChanges ? "#176b43" : "#766b65"} />
              <View style={professionalCheckoutStyles.saveChoiceCopy}>
                <Text style={professionalCheckoutStyles.saveChoiceTitle}>Save contact changes to my profile</Text>
                <Text style={professionalCheckoutStyles.saveChoiceText}>Unchecked changes apply only to this order.</Text>
              </View>
            </Pressable>
          ) : null}
          <View
            style={[
              styles.checkoutSectionCard,
              professionalCheckoutStyles.sectionCard,
            ]}
          >
            <View
              style={[
                styles.checkoutSectionHead,
                professionalCheckoutStyles.sectionHead,
              ]}
            >
              <View
                style={[
                  styles.checkoutSectionNumber,
                  professionalCheckoutStyles.sectionNumber,
                ]}
              >
                <Text style={styles.checkoutSectionNumberText}>02</Text>
              </View>
              <View style={styles.checkoutSectionCopy}>
                <Text style={styles.checkoutSectionEyebrow}>
                  DELIVERY ADDRESS
                </Text>
                <Text
                  style={[
                    styles.checkoutSectionTitle,
                    professionalCheckoutStyles.sectionTitle,
                  ]}
                >
                  Delivery address
                </Text>
                <Text
                  style={[
                    styles.checkoutSectionText,
                    professionalCheckoutStyles.sectionText,
                  ]}
                >
                  Tell us exactly where your fragrance should arrive.
                </Text>
              </View>
              {addresses.length ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Choose a saved delivery address" onPress={() => setAddressPickerOpen(true)} style={professionalCheckoutStyles.changeAddress}>
                  <Text style={professionalCheckoutStyles.changeAddressText}>CHANGE</Text>
                  <Ionicons name="chevron-down" size={13} color={RED} />
                </Pressable>
              ) : null}
            </View>
            <CheckoutFormField
              key="checkout-city"
              name="city"
              label="CITY"
              icon="location-outline"
              accessibilityLabel="City"
              autoCapitalize="words"
              value={customer.city}
              onChangeText={updateCity}
              placeholder="Your city"
              inputRef={cityInputRef}
              returnKeyType="next"
              onSubmitEditing={() => addressInputRef.current?.focus()}
            />
            <CheckoutFormField
              key="checkout-address"
              name="address"
              label="FULL DELIVERY ADDRESS"
              icon="home-outline"
              accessibilityLabel="Street address"
              value={customer.address}
              onChangeText={updateAddress}
              placeholder="Street, building, apartment and delivery details"
              multiline="large"
              inputRef={addressInputRef}
            />
            <CheckoutFormField
              key="checkout-notes"
              name="notes"
              label="ORDER NOTE · OPTIONAL"
              icon="create-outline"
              accessibilityLabel="Order notes"
              value={notes}
              onChangeText={setNotes}
              placeholder="A delivery preference or helpful note"
              multiline="small"
            />
          </View>
          {session ? (
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: saveAddressChanges }} onPress={() => setSaveAddressChanges(value => !value)} style={professionalCheckoutStyles.saveChoice}>
              <Ionicons name={saveAddressChanges ? "checkbox" : "square-outline"} size={20} color={saveAddressChanges ? "#176b43" : "#766b65"} />
              <View style={professionalCheckoutStyles.saveChoiceCopy}>
                <Text style={professionalCheckoutStyles.saveChoiceTitle}>Save this address to my account</Text>
                <Text style={professionalCheckoutStyles.saveChoiceText}>Keep it unchecked to use this address only once.</Text>
              </View>
            </Pressable>
          ) : null}
          <View
            style={[styles.checkoutPayment, professionalCheckoutStyles.payment]}
          >
            <View
              style={[
                styles.checkoutPaymentTop,
                professionalCheckoutStyles.paymentTop,
              ]}
            >
              <Text
                style={[
                  styles.checkoutPaymentEyebrow,
                  professionalCheckoutStyles.paymentEyebrow,
                ]}
              >
                PAYMENT METHOD
              </Text>
              <View style={styles.checkoutSelectedPill}>
                <Ionicons name="checkmark" size={11} color="#176b43" />
                <Text style={styles.checkoutSelectedText}>SELECTED</Text>
              </View>
            </View>
            <View
              style={[
                styles.checkoutPaymentMain,
                professionalCheckoutStyles.paymentMain,
              ]}
            >
              <View style={styles.checkoutPaymentIcon}>
                <Ionicons name="cash-outline" size={22} color="#171310" />
              </View>
              <View style={styles.checkoutPaymentCopy}>
                <Text
                  style={[
                    styles.checkoutPaymentTitle,
                    professionalCheckoutStyles.paymentTitle,
                  ]}
                >
                  Cash on delivery
                </Text>
                <Text
                  style={[
                    styles.checkoutPaymentText,
                    professionalCheckoutStyles.paymentText,
                  ]}
                >
                  Pay securely when your fragrance arrives.
                </Text>
              </View>
              <View style={styles.checkoutPaymentCheck}>
                <Ionicons name="checkmark" size={14} color="#fff" />
              </View>
            </View>
          </View>
          {error ? (
            <View accessibilityRole="alert" style={styles.checkoutError}>
              <Ionicons name="alert-circle-outline" size={16} color={RED} />
              <Text style={styles.checkoutErrorText}>{error}</Text>
            </View>
          ) : null}
          <View style={styles.checkoutSummaryCard}>
            <View style={styles.checkoutSummaryHead}>
              <View>
                <Text style={styles.checkoutSummaryEyebrow}>ORDER SUMMARY</Text>
                <Text style={styles.checkoutSummaryTitle}>
                  Ready when you are.
                </Text>
              </View>
              <View style={styles.checkoutItemPill}>
                <Text style={styles.checkoutItemPillText}>
                  {itemCount} {itemCount === 1 ? "ITEM" : "ITEMS"}
                </Text>
              </View>
            </View>
            <View style={styles.checkoutSummaryRule} />
            <View style={styles.checkoutSummaryRow}>
              <Text style={styles.checkoutSummaryLabel}>
                Fragrance subtotal
              </Text>
              <Text style={styles.checkoutSummaryValue}>
                {formatMad(subtotal)}
              </Text>
            </View>
            <View style={styles.checkoutSummaryRow}>
              <View style={styles.checkoutSummaryDelivery}>
                <Ionicons name="car-outline" size={15} color="#766b65" />
                <Text style={styles.checkoutSummaryLabel}>
                  Delivery across Morocco
                </Text>
              </View>
              <Text style={styles.checkoutSummaryValue}>
                {formatMad(delivery)}
              </Text>
            </View>
            <View style={styles.checkoutSummaryTotal}>
              <View>
                <Text style={styles.checkoutSummaryTotalLabel}>
                  TOTAL · DELIVERY INCLUDED
                </Text>
                <Text style={styles.checkoutSummaryTax}>
                  Cash on delivery · Prices verified live
                </Text>
              </View>
              <Text style={styles.checkoutSummaryTotalValue}>
                {formatMad(subtotal + delivery)}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Place order for ${formatMad(subtotal + delivery)}`}
              accessibilityState={{
                busy: loading,
                disabled: loading || !bag.length,
              }}
              disabled={loading || !bag.length}
              onPress={submit}
              style={({ pressed }) => [
                styles.checkoutPlaceOrder,
                loading && styles.disabled,
                pressed && styles.checkoutPlaceOrderPressed,
              ]}
            >
              <View style={styles.checkoutPlaceOrderCopy}>
                <Text style={styles.checkoutPlaceOrderText}>
                  {loading ? "CONFIRMING YOUR ORDER…" : "PLACE MY ORDER"}
                </Text>
                <Text style={styles.checkoutPlaceOrderSubtext}>
                  {loading
                    ? "Checking live prices securely"
                    : "No payment required now"}
                </Text>
              </View>
              <View style={styles.checkoutPlaceOrderArrow}>
                <Ionicons
                  name={loading ? "hourglass-outline" : "arrow-forward"}
                  size={17}
                  color="#fff"
                />
              </View>
            </Pressable>
            <View style={styles.checkoutConsent}>
              <Ionicons name="lock-closed-outline" size={11} color="#8b8079" />
              <Text style={styles.checkoutConsentText}>
                Your details are used only to prepare and deliver this order.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
      <Modal visible={addressPickerOpen} transparent animationType="slide" onRequestClose={() => setAddressPickerOpen(false)}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close address chooser" onPress={() => setAddressPickerOpen(false)} style={[professionalCheckoutStyles.modalBackdrop,layout.tablet&&professionalCheckoutStyles.modalBackdropTablet]}>
          <Pressable accessibilityRole="none" onPress={() => undefined} style={[professionalCheckoutStyles.addressSheet,layout.tablet&&professionalCheckoutStyles.addressSheetTablet]}>
            <View style={professionalCheckoutStyles.sheetHandle} />
            <Text style={professionalCheckoutStyles.sheetEyebrow}>DELIVERY</Text>
            <Text style={professionalCheckoutStyles.sheetTitle}>Choose delivery address</Text>
            {addresses.map(address => (
              <Pressable accessibilityRole="radio" accessibilityState={{ checked: selectedAddressId === address.id }} key={address.id} onPress={() => chooseAddress(address)} style={[professionalCheckoutStyles.savedAddress, selectedAddressId === address.id && professionalCheckoutStyles.savedAddressSelected]}>
                <View style={professionalCheckoutStyles.savedAddressIcon}><Ionicons name="home-outline" size={18} color={RED} /></View>
                <View style={professionalCheckoutStyles.savedAddressCopy}>
                  <Text style={professionalCheckoutStyles.savedAddressLabel}>{address.label}{address.is_default ? " · DEFAULT" : ""}</Text>
                  <Text style={professionalCheckoutStyles.savedAddressText}>{address.address_line1}</Text>
                  <Text style={professionalCheckoutStyles.savedAddressText}>{address.city}, {address.country || "Morocco"}</Text>
                </View>
                <Ionicons name={selectedAddressId === address.id ? "checkmark-circle" : "ellipse-outline"} size={21} color={selectedAddressId === address.id ? "#176b43" : "#b9afa9"} />
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const professionalCheckoutStyles = StyleSheet.create({
  page: { backgroundColor: "#f5f3f1", paddingTop: 4, paddingBottom: 32 },
  shell: {
    width: "100%",
    maxWidth: 620,
    ...Platform.select({
      web: {
        width: "calc(100% - 32px)",
        paddingHorizontal: 0,
        boxSizing: "border-box",
      } as any,
    }),
  },
  flow: {
    minHeight: 72,
    borderRadius: 22,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ded8d4",
    paddingHorizontal: 16,
    marginBottom: 4,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#241917",
    shadowOpacity: 0.075,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 7 },
    elevation: 3,
    overflow: "hidden",
  },
  flowStep: { flexDirection: "row", alignItems: "center", gap: 8 },
  flowCopy: { justifyContent: "center", gap: 2 },
  flowNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#f0ece9",
    borderWidth: 1,
    borderColor: "#e8e1dd",
    alignItems: "center",
    justifyContent: "center",
  },
  flowNumberStage: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  flowPulse: {
    position: "absolute",
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: RED,
  },
  flowNumberDone: {
    backgroundColor: "#176b43",
    borderColor: "#176b43",
    shadowColor: "#176b43",
    shadowOpacity: 0.16,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  flowNumberActive: {
    backgroundColor: RED,
    borderColor: "#fff",
    borderWidth: 2,
    shadowColor: RED,
    shadowOpacity: 0.28,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  flowNumberText: { fontSize: 8, fontWeight: "900", color: "#857b75" },
  flowNumberActiveText: { fontSize: 8, fontWeight: "900", color: "#fff" },
  flowText: {
    fontSize: 6.5,
    lineHeight: 9,
    fontWeight: "900",
    letterSpacing: 0.7,
    color: "#746b66",
  },
  flowTextDone: {
    fontSize: 6.5,
    lineHeight: 9,
    fontWeight: "900",
    letterSpacing: 0.7,
    color: "#285e43",
  },
  flowTextActive: {
    fontSize: 6.5,
    lineHeight: 9,
    fontWeight: "900",
    letterSpacing: 0.7,
    color: "#211719",
  },
  flowMeta: {
    fontSize: 4.5,
    lineHeight: 6,
    fontWeight: "800",
    letterSpacing: 0.55,
    color: "#aaa19b",
  },
  flowMetaDone: {
    fontSize: 4.5,
    lineHeight: 6,
    fontWeight: "800",
    letterSpacing: 0.55,
    color: "#75a087",
  },
  flowMetaActive: {
    fontSize: 4.5,
    lineHeight: 6,
    fontWeight: "900",
    letterSpacing: 0.55,
    color: RED,
  },
  flowLine: {
    position: "relative",
    overflow: "hidden",
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: "#eee9e6",
    marginHorizontal: 9,
  },
  flowLineFill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 2,
    backgroundColor: "#55a879",
    transformOrigin: "left center",
  },
  flowLineShimmer: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: "34%",
    borderRadius: 2,
    backgroundColor: "rgba(215,25,63,.16)",
  },
  progress: { display: "none" },
  assurance: { display: "none" },
  sectionCard: {
    marginTop: 12,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e3e3e3",
    padding: 15,
    shadowColor: "#191919",
    shadowOpacity: 0.035,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  sectionHead: { marginBottom: 7, paddingHorizontal: 1, gap: 0 },
  sectionNumber: { display: "none" },
  sectionTitle: { fontSize: 19, lineHeight: 23, letterSpacing: -0.1 },
  sectionText: { fontSize: 9, lineHeight: 14, color: "#77716d", marginTop: 3 },
  saveChoice: { minHeight: 58, marginTop: 8, borderRadius: 15, borderWidth: 1, borderColor: "#e2dad5", backgroundColor: "#fff", paddingHorizontal: 13, flexDirection: "row", alignItems: "center", gap: 10 },
  saveChoiceCopy: { flex: 1, minWidth: 0 },
  saveChoiceTitle: { fontSize: 9, lineHeight: 13, fontWeight: "800", color: "#211719" },
  saveChoiceText: { fontSize: 7.5, lineHeight: 11, color: "#81766f", marginTop: 2 },
  changeAddress: { minHeight: 44, paddingHorizontal: 8, flexDirection: "row", alignItems: "center", gap: 3 },
  changeAddressText: { fontSize: 6.5, fontWeight: "900", letterSpacing: 0.8, color: RED },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(20,12,13,.46)", justifyContent: "flex-end" },
  modalBackdropTablet: { justifyContent: "center", padding: 24 },
  addressSheet: { maxHeight: "78%", borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: "#fffdf9", paddingHorizontal: 18, paddingTop: 10, paddingBottom: 32 },
  addressSheetTablet: { width: "100%", maxWidth: 620, alignSelf: "center", borderRadius: 28 },
  sheetHandle: { width: 42, height: 4, borderRadius: 2, backgroundColor: "#d8cfca", alignSelf: "center", marginBottom: 18 },
  sheetEyebrow: { fontSize: 7, fontWeight: "900", letterSpacing: 1.35, color: RED },
  sheetTitle: { fontFamily: "serif", fontSize: 24, lineHeight: 29, fontWeight: "700", color: "#171310", marginTop: 3, marginBottom: 12 },
  savedAddress: { minHeight: 82, borderRadius: 17, borderWidth: 1, borderColor: "#e4dcd7", backgroundColor: "#fff", padding: 12, marginTop: 9, flexDirection: "row", alignItems: "center", gap: 11 },
  savedAddressSelected: { borderColor: "#7ead90", backgroundColor: "#f8fcf9" },
  savedAddressIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: "#fff0f4", alignItems: "center", justifyContent: "center" },
  savedAddressCopy: { flex: 1, minWidth: 0 },
  savedAddressLabel: { fontSize: 7, fontWeight: "900", letterSpacing: 0.85, color: "#211719" },
  savedAddressText: { fontSize: 8.5, lineHeight: 12, color: "#756a64", marginTop: 2 },
  field: {
    minHeight: 57,
    marginTop: 8,
    paddingHorizontal: 10,
    gap: 10,
    borderRadius: 12,
    borderColor: "#e1e1e1",
    backgroundColor: "#fafafa",
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  fieldComplete: { borderColor: "#dce8e1", backgroundColor: "#fbfdfc" },
  fieldInvalid: { borderColor: "#f2b9c5", backgroundColor: "#fffafb" },
  fieldFocused: {
    borderColor: RED,
    backgroundColor: "#fff",
    shadowColor: RED,
    shadowOpacity: 0.06,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  fieldMultiline: { minHeight: 78, paddingTop: 9 },
  fieldIcon: {
    width: 35,
    height: 35,
    borderRadius: 11,
    borderWidth: 0,
    backgroundColor: "#f0f0f0",
  },
  fieldIconComplete: { backgroundColor: "#edf8f1" },
  fieldIconInvalid: { backgroundColor: "#fff0f4" },
  fieldIconFocused: { borderColor: "#ffd5df", backgroundColor: "#fff0f4" },
  fieldCopy: { justifyContent: "center" },
  fieldLabelRow: {
    minHeight: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  fieldLabel: {
    flexShrink: 1,
    fontSize: 7,
    lineHeight: 10,
    letterSpacing: 0.8,
    color: "#55514e",
  },
  input: {
    height: 28,
    backgroundColor: "transparent",
    color: "#171310",
    fontSize: 11.5,
    ...Platform.select({
      web: { outlineStyle: "none", outlineWidth: 0, boxShadow: "none" } as any,
    }),
  },
  fieldStatus: { borderRadius: 999, paddingHorizontal: 5, paddingVertical: 2 },
  fieldStatusRequired: { backgroundColor: "#fff0f4" },
  fieldStatusOptional: { backgroundColor: "#f2f2f2" },
  fieldStatusComplete: {
    backgroundColor: "#edf8f1",
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  fieldStatusInvalid: {
    backgroundColor: "#fff0f4",
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  fieldStatusText: {
    fontSize: 5.5,
    lineHeight: 7,
    fontWeight: "900",
    letterSpacing: 0.55,
  },
  fieldStatusTextRequired: { fontSize: 5.5, lineHeight: 7, color: RED },
  fieldStatusTextOptional: { color: "#686868" },
  fieldStatusTextComplete: { color: "#176b43" },
  fieldStatusTextInvalid: { color: RED },
  fieldMessage: {
    minHeight: 17,
    paddingBottom: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  fieldMessagePlaceholder: { opacity: 0 },
  fieldMessageText: { flex: 1, fontSize: 7, lineHeight: 10 },
  fieldMessageError: { color: "#a9233d" },
  fieldMessageSuccess: { color: "#327152" },
  payment: {
    minHeight: 86,
    marginTop: 12,
    borderRadius: 18,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e3e3e3",
    padding: 14,
    shadowOpacity: 0.035,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  paymentTop: { marginBottom: 1 },
  paymentEyebrow: { color: RED },
  paymentMain: { marginTop: 9 },
  paymentTitle: { color: "#171310", fontSize: 14 },
  paymentText: { color: "#77716d", fontSize: 8.5 },
});

const thankYouProfessionalStyles = StyleSheet.create({
  background: { flex: 1, backgroundColor: "#f5efeb" },
  backgroundImage: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    width: "100%",
    height: 1100,
    opacity: 0.92,
    zIndex: 0,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,250,247,.28)",
    zIndex: 1,
  },
  page: {
    minHeight: 900,
    justifyContent: "flex-end",
    paddingTop: 210,
    paddingBottom: 28,
    ...Platform.select({
      web: {
        backgroundImage: "url('/thank-you-boutique-background-v1.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      } as any,
    }),
  },
  shell: { maxWidth: 560, zIndex: 2 },
  heroCard: {
    width: "100%",
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,.96)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.92)",
    padding: 21,
    overflow: "hidden",
    shadowColor: "#4a2b20",
    shadowOpacity: 0.14,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 11 },
    elevation: 5,
  },
  heroAccent: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: RED,
  },
  successRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  successSeal: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#176b43",
    borderWidth: 4,
    borderColor: "#e8f5ed",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#176b43",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },
  successCopy: { flex: 1, minWidth: 0 },
  successEyebrow: {
    fontSize: 7,
    fontWeight: "900",
    letterSpacing: 1.55,
    color: RED,
  },
  successMeta: {
    fontSize: 5.5,
    fontWeight: "800",
    letterSpacing: 0.65,
    color: "#8a7d75",
    marginTop: 3,
  },
  secureBadge: {
    height: 28,
    borderRadius: 14,
    backgroundColor: "#edf8f1",
    borderWidth: 1,
    borderColor: "#d9eee1",
    paddingHorizontal: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  secureBadgeText: {
    fontSize: 5,
    fontWeight: "900",
    letterSpacing: 0.65,
    color: "#176b43",
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    textAlign: "left",
    marginTop: 18,
    letterSpacing: -0.25,
  },
  copy: {
    fontSize: 10.5,
    lineHeight: 17,
    textAlign: "left",
    maxWidth: 480,
    marginTop: 8,
  },
  orderCard: {
    marginTop: 13,
    borderRadius: 25,
    backgroundColor: "rgba(255,255,255,.97)",
    borderColor: "rgba(224,213,206,.92)",
    padding: 18,
    shadowOpacity: 0.09,
    shadowRadius: 18,
  },
  orderCardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
  },
  pendingBadge: {
    minHeight: 27,
    borderRadius: 14,
    backgroundColor: "#fff0f4",
    borderWidth: 1,
    borderColor: "#ffe0e7",
    paddingHorizontal: 9,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  detailRow: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  detailLabel: { flexDirection: "row", alignItems: "center", gap: 7 },
  totalPanel: {
    minHeight: 74,
    borderRadius: 18,
    backgroundColor: "#f5f1ef",
    borderWidth: 1,
    borderColor: "#eee6e1",
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  totalEyebrow: {
    fontSize: 6,
    fontWeight: "900",
    letterSpacing: 1.1,
    color: "#5f554f",
  },
  totalNote: { fontSize: 6.5, color: "#91857e", marginTop: 3 },
  promise: {
    minHeight: 128,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,.95)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.9)",
    padding: 14,
    flexDirection: "column",
    alignItems: "stretch",
    gap: 0,
    shadowColor: "#4a2b20",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  promiseTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  promiseIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#fff0f4",
    alignItems: "center",
    justifyContent: "center",
  },
  journey: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 15,
    paddingHorizontal: 2,
  },
  journeyStep: { width: 66, alignItems: "center" },
  journeyDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#f0ebe8",
    borderWidth: 1,
    borderColor: "#e4dcd7",
    alignItems: "center",
    justifyContent: "center",
  },
  journeyDotActive: { backgroundColor: "#176b43", borderColor: "#176b43" },
  journeyNumber: {
    fontSize: 6,
    fontWeight: "900",
    lineHeight: 8,
    color: "#8f837c",
    textAlign: "center",
  },
  journeyLine: {
    flex: 1,
    height: 2,
    borderRadius: 1,
    backgroundColor: "#e7dfda",
    marginTop: 9,
    marginHorizontal: -4,
  },
  journeyLabel: {
    fontSize: 5.5,
    fontWeight: "900",
    letterSpacing: 0.65,
    color: "#9a8f88",
    textAlign: "center",
    marginTop: 6,
  },
  journeyLabelActive: { color: "#176b43" },
  journeyMeta: {
    fontSize: 5.5,
    color: "#a39993",
    textAlign: "center",
    marginTop: 2,
  },
  button: {
    width: "100%",
    minHeight: 58,
    borderRadius: 29,
    marginTop: 13,
    paddingLeft: 20,
    paddingRight: 7,
    justifyContent: "space-between",
    shadowColor: "#171310",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  buttonPressed: { transform: [{ scale: 0.985 }], opacity: 0.92 },
  buttonArrow: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  footerNote: {
    fontSize: 5.5,
    fontWeight: "900",
    letterSpacing: 1.15,
    color: "rgba(58,44,37,.6)",
    textAlign: "center",
    marginTop: 14,
  },
});

export function ThankYouPage({
  order,
  onContinue,
  onTrack,
}: {
  order: CompletedOrder;
  onContinue: () => void;
  onTrack: () => void;
}) {
  return (
    <View style={thankYouProfessionalStyles.background}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.thankPage,
          thankYouProfessionalStyles.page,
        ]}
      >
        <Image
          source={
            Platform.OS === "web"
              ? { uri: "/thank-you-boutique-background-v1.png" }
              : require("../../assets/thank-you-boutique-background-v1.png")
          }
          resizeMode="cover"
          style={thankYouProfessionalStyles.backgroundImage}
        />
        <View pointerEvents="none" style={thankYouProfessionalStyles.scrim} />
        <View style={[styles.thankShell, thankYouProfessionalStyles.shell]}>
          <View style={thankYouProfessionalStyles.heroCard}>
            <View
              pointerEvents="none"
              style={thankYouProfessionalStyles.heroAccent}
            />
            <View style={thankYouProfessionalStyles.successRow}>
              <View style={thankYouProfessionalStyles.successSeal}>
                <Ionicons name="checkmark" size={24} color="#fff" />
              </View>
              <View style={thankYouProfessionalStyles.successCopy}>
                <Text style={thankYouProfessionalStyles.successEyebrow}>
                  ORDER RECEIVED
                </Text>
                <Text style={thankYouProfessionalStyles.successMeta}>
                  YOUR SELECTION IS SAFELY WITH US
                </Text>
              </View>
              <View style={thankYouProfessionalStyles.secureBadge}>
                <Ionicons name="shield-checkmark" size={11} color="#176b43" />
                <Text style={thankYouProfessionalStyles.secureBadgeText}>
                  PROTECTED
                </Text>
              </View>
            </View>
            <Text style={[styles.thankTitle, thankYouProfessionalStyles.title]}>
              Thank you{order.customerName ? `, ${order.customerName.trim().split(/\s+/)[0]}` : ""}. Your order is safely with us.
            </Text>
            <Text style={[styles.thankCopy, thankYouProfessionalStyles.copy]}>
              We’re grateful you chose IPORDISE. Our boutique team will
              personally review your selection, confirm availability and contact
              you before dispatch.
            </Text>
          </View>

          <View
            style={[styles.orderCard, thankYouProfessionalStyles.orderCard]}
          >
            <View style={thankYouProfessionalStyles.orderCardTop}>
              <View>
                <Text style={styles.orderCardLabel}>ORDER NUMBER</Text>
                <Text selectable style={styles.orderNumber}>
                  {order.orderNumber}
                </Text>
              </View>
              <View style={thankYouProfessionalStyles.pendingBadge}>
                <View style={styles.orderStatusDot} />
                <Text style={styles.orderStatusText}>PENDING CONFIRMATION</Text>
              </View>
            </View>
            <View style={styles.orderRule} />
            <View style={thankYouProfessionalStyles.detailRow}>
              <View style={thankYouProfessionalStyles.detailLabel}>
                <Ionicons name="cash-outline" size={15} color="#756a64" />
                <Text style={styles.summaryLabel}>Payment</Text>
              </View>
              <Text style={styles.summaryValue}>Cash on delivery</Text>
            </View>
            <View style={thankYouProfessionalStyles.detailRow}>
              <View style={thankYouProfessionalStyles.detailLabel}>
                <Ionicons name="car-outline" size={15} color="#756a64" />
                <Text style={styles.summaryLabel}>Delivery</Text>
              </View>
              <Text style={styles.summaryValue}>Across Morocco</Text>
            </View>
            <View style={thankYouProfessionalStyles.totalPanel}>
              <View>
                <Text style={thankYouProfessionalStyles.totalEyebrow}>
                  ORDER TOTAL
                </Text>
                <Text style={thankYouProfessionalStyles.totalNote}>
                  Delivery included
                </Text>
              </View>
              <Text style={styles.totalValue}>{formatMad(order.total)}</Text>
            </View>
          </View>

          <View
            style={[styles.thankPromise, thankYouProfessionalStyles.promise]}
          >
            <View style={thankYouProfessionalStyles.promiseTop}>
              <View style={thankYouProfessionalStyles.promiseIcon}>
                <Ionicons name="notifications-outline" size={18} color={RED} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.thankPromiseTitle}>What happens next</Text>
                <Text style={styles.thankPromiseText}>
                  We’ll keep you informed as your order moves through the
                  boutique.
                </Text>
              </View>
              <Ionicons name="checkmark-circle" size={19} color="#176b43" />
            </View>
            <View
              accessibilityLabel="Order journey: received, boutique confirmation, dispatch"
              style={thankYouProfessionalStyles.journey}
            >
              <View style={thankYouProfessionalStyles.journeyStep}>
                <View
                  style={[
                    thankYouProfessionalStyles.journeyDot,
                    thankYouProfessionalStyles.journeyDotActive,
                  ]}
                >
                  <Ionicons name="checkmark" size={10} color="#fff" />
                </View>
                <Text
                  style={[
                    thankYouProfessionalStyles.journeyLabel,
                    thankYouProfessionalStyles.journeyLabelActive,
                  ]}
                >
                  RECEIVED
                </Text>
                <Text style={thankYouProfessionalStyles.journeyMeta}>
                  Complete
                </Text>
              </View>
              <View style={thankYouProfessionalStyles.journeyLine} />
              <View style={thankYouProfessionalStyles.journeyStep}>
                <View style={thankYouProfessionalStyles.journeyDot}>
                  <Text style={thankYouProfessionalStyles.journeyNumber}>
                    2
                  </Text>
                </View>
                <Text style={thankYouProfessionalStyles.journeyLabel}>
                  CONFIRMATION
                </Text>
                <Text style={thankYouProfessionalStyles.journeyMeta}>
                  Up next
                </Text>
              </View>
              <View style={thankYouProfessionalStyles.journeyLine} />
              <View style={thankYouProfessionalStyles.journeyStep}>
                <View style={thankYouProfessionalStyles.journeyDot}>
                  <Text style={thankYouProfessionalStyles.journeyNumber}>
                    3
                  </Text>
                </View>
                <Text style={thankYouProfessionalStyles.journeyLabel}>
                  DISPATCH
                </Text>
                <Text style={thankYouProfessionalStyles.journeyMeta}>
                  After review
                </Text>
              </View>
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Track order ${order.orderNumber}`}
            onPress={onTrack}
            style={({ pressed }) => [
              styles.darkButton,
              thankYouProfessionalStyles.button,
              pressed && thankYouProfessionalStyles.buttonPressed,
            ]}
          >
            <Ionicons name="location-outline" size={17} color="#fff" />
            <Text style={styles.darkButtonText}>TRACK MY ORDER</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Return to the boutique"
            onPress={onContinue}
            style={({ pressed }) => [
              styles.darkButton,
              thankYouProfessionalStyles.button,
              pressed && thankYouProfessionalStyles.buttonPressed,
            ]}
          >
            <Text style={styles.darkButtonText}>RETURN TO THE BOUTIQUE</Text>
            <View style={thankYouProfessionalStyles.buttonArrow}>
              <Ionicons name="arrow-forward" size={16} color="#fff" />
            </View>
          </Pressable>
          <Text style={thankYouProfessionalStyles.footerNote}>
            IPORDISE · AUTHENTICITY · CARE · MOROCCO
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const bagStyles = StyleSheet.create({
  page: {
    flexGrow: 1,
    backgroundColor: "#f7f3ef",
    paddingTop: 2,
    paddingBottom: 28,
  },
  shell: {
    alignSelf: "center",
    paddingHorizontal: 0,
    ...(Platform.OS === "web" && ({ boxSizing: "border-box" } as any)),
  },
  shellTablet: { maxWidth: 920, paddingHorizontal: 0 },
  headerCopy: { minWidth: 0 },
  headerEyebrow: { fontSize: 9, lineHeight: 12, letterSpacing: 1.25 },
  controlPressed: { opacity: 0.78, transform: [{ scale: 0.97 }] },
  hero: { padding: 22, minHeight: 0 },
  heroCompact: { padding: 18, minHeight: 0 },
  status: {
    minHeight: 28,
    height: undefined,
    borderColor: "rgba(255,255,255,.22)",
    backgroundColor: "rgba(255,255,255,.09)",
    paddingHorizontal: 10,
  },
  statusText: {
    fontSize: 8,
    lineHeight: 11,
    fontWeight: "900",
    letterSpacing: 0.65,
    color: "rgba(255,255,255,.84)",
  },
  edition: {
    fontSize: 8,
    lineHeight: 11,
    fontWeight: "900",
    letterSpacing: 0.8,
    color: "rgba(255,255,255,.62)",
  },
  heroMark: { width: 48, height: 48, borderRadius: 16, marginBottom: 12 },
  heroEyebrow: {
    fontSize: 9,
    lineHeight: 12,
    fontWeight: "900",
    letterSpacing: 1.25,
    color: "#ff8fa8",
  },
  heroTitle: {
    fontFamily: "serif",
    fontSize: 27,
    lineHeight: 32,
    fontWeight: "700",
    letterSpacing: -0.3,
    color: "#fff",
    marginTop: 5,
    maxWidth: "80%",
  },
  heroText: {
    fontSize: 12,
    lineHeight: 18,
    color: "rgba(255,255,255,.84)",
    marginTop: 6,
    maxWidth: "80%",
  },
  heroButton: {
    minHeight: 52,
    height: undefined,
    marginTop: 16,
    paddingLeft: 19,
  },
  heroButtonText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
    color: "#171310",
  },
  benefits: {
    minHeight: 92,
    paddingVertical: 12,
    alignItems: "stretch",
    borderColor: "#e1d8d2",
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
  },
  benefitIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#edf8f1",
    alignItems: "center",
    justifyContent: "center",
  },
  benefitText: {
    width: "100%",
    paddingHorizontal: 3,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: "800",
    color: "#365f4b",
    textAlign: "center",
  },
  benefitDivider: { width: 1, marginVertical: 8, backgroundColor: "#e9e1dc" },
  bestsellerSection: { marginTop: 25, overflow: "hidden" },
  bestsellerHeadingRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  bestsellerHeadingCopy: { flex: 1, minWidth: 0 },
  bestsellerEyebrow: {
    fontSize: 8,
    lineHeight: 11,
    fontWeight: "900",
    letterSpacing: 1.3,
    color: RED,
  },
  bestsellerHeading: {
    fontFamily: "serif",
    fontSize: 25,
    lineHeight: 30,
    fontWeight: "700",
    letterSpacing: -0.25,
    color: "#171310",
    marginTop: 3,
  },
  bestsellerSubtitle: {
    fontSize: 11,
    lineHeight: 16,
    color: "#786d66",
    marginTop: 3,
  },
  bestsellerCount: {
    minWidth: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#d9cec8",
    backgroundColor: "#fff",
    textAlign: "center",
    textAlignVertical: "center",
    fontFamily: "serif",
    fontSize: 16,
    lineHeight: 42,
    fontWeight: "700",
    color: "#53202b",
  },
  bestsellerRail: { paddingTop: 15, paddingBottom: 14, gap: 12 },
  bestsellerCard: {
    height: 302,
    borderRadius: 19,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e4dcd7",
    overflow: "hidden",
    shadowColor: "#2a1916",
    shadowOpacity: 0.07,
    shadowRadius: 11,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  cardPressed: { opacity: 0.92, transform: [{ scale: 0.985 }] },
  bestsellerImageWrap: {
    height: 154,
    backgroundColor: "#f3eeea",
    padding: 13,
    position: "relative",
  },
  bestsellerImage: { width: "100%", height: "100%" },
  bestsellerBadge: {
    position: "absolute",
    left: 10,
    top: 10,
    maxWidth: "72%",
    borderRadius: 10,
    backgroundColor: "#351018",
    paddingHorizontal: 8,
    paddingVertical: 5,
    color: "#fff",
    fontSize: 7,
    lineHeight: 9,
    fontWeight: "900",
    letterSpacing: 0.7,
  },
  bestsellerCopy: { flex: 1, padding: 12 },
  bestsellerBrand: {
    fontSize: 9,
    lineHeight: 12,
    fontWeight: "900",
    letterSpacing: 0.85,
    color: "#6f2638",
  },
  bestsellerName: {
    minHeight: 38,
    fontFamily: "serif",
    fontSize: 15,
    lineHeight: 19,
    fontWeight: "700",
    color: "#171310",
    marginTop: 3,
  },
  bestsellerPrice: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "900",
    color: "#171310",
    marginTop: 4,
  },
  bestsellerAction: {
    minHeight: 44,
    borderRadius: 22,
    backgroundColor: "#171310",
    paddingHorizontal: 14,
    marginTop: "auto",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  bestsellerActionText: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "800",
    color: "#fff",
  },
  skeletonBlock: { backgroundColor: "#e9e2dd" },
  skeletonLine: {
    height: 10,
    borderRadius: 6,
    backgroundColor: "#e9e2dd",
    marginBottom: 9,
  },
  catalogMessage: {
    minHeight: 96,
    marginHorizontal: 16,
    marginTop: 15,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e3d9d4",
    backgroundColor: "#fff",
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  catalogMessageIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#f7ecef",
    alignItems: "center",
    justifyContent: "center",
  },
  catalogMessageCopy: { flex: 1, minWidth: 0 },
  catalogMessageTitle: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900",
    color: "#241c19",
  },
  catalogMessageText: {
    fontSize: 10,
    lineHeight: 15,
    color: "#786d66",
    marginTop: 2,
  },
  catalogRetry: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#521624",
    alignItems: "center",
    justifyContent: "center",
  },
  footnote: {
    fontSize: 10,
    lineHeight: 15,
    color: "#82766f",
    textAlign: "center",
    marginTop: 6,
    paddingHorizontal: 22,
  },
});

const styles = StyleSheet.create({
  checkoutPage: {
    flexGrow: 1,
    backgroundColor: "#f6f2ef",
    paddingTop: 10,
    paddingBottom: 34,
  },
  checkoutProgress: {
    minHeight: 66,
    borderRadius: 18,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5ddd8",
    paddingHorizontal: 14,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#2b1a16",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  checkoutProgressItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  checkoutProgressActive: {
    width: 30,
    height: 30,
    borderRadius: 11,
    backgroundColor: "#211719",
    alignItems: "center",
    justifyContent: "center",
  },
  checkoutProgressActiveText: { fontSize: 9, fontWeight: "900", color: "#fff" },
  checkoutProgressNext: {
    width: 30,
    height: 30,
    borderRadius: 11,
    backgroundColor: "#f2ece9",
    alignItems: "center",
    justifyContent: "center",
  },
  checkoutProgressNextText: {
    fontSize: 9,
    fontWeight: "900",
    color: "#887d76",
  },
  checkoutProgressLabelActive: {
    fontSize: 6.5,
    fontWeight: "900",
    letterSpacing: 0.9,
    color: "#211719",
  },
  checkoutProgressLabel: {
    fontSize: 6.5,
    fontWeight: "900",
    letterSpacing: 0.8,
    color: "#938780",
  },
  checkoutProgressMeta: { fontSize: 7.5, color: "#9a8e87", marginTop: 2 },
  checkoutProgressLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#e7dfda",
    marginHorizontal: 10,
  },
  checkoutAssurance: {
    minHeight: 78,
    borderRadius: 19,
    backgroundColor: "#edf8f1",
    borderWidth: 1,
    borderColor: "#d3eadb",
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  checkoutAssuranceIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  checkoutAssuranceCopy: { flex: 1, minWidth: 0 },
  checkoutAssuranceTitle: { fontSize: 10, fontWeight: "900", color: "#195c39" },
  checkoutAssuranceText: {
    fontSize: 8,
    lineHeight: 12,
    color: "#5a7565",
    marginTop: 3,
  },
  checkoutSecurePill: {
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,.75)",
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  checkoutSecureDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#29945a",
  },
  checkoutSecureText: {
    fontSize: 5.5,
    fontWeight: "900",
    letterSpacing: 0.65,
    color: "#176b43",
  },
  checkoutSectionCard: {
    marginTop: 11,
    borderRadius: 22,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e4dcd7",
    padding: 16,
    shadowColor: "#2a1916",
    shadowOpacity: 0.045,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  checkoutSectionHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    marginBottom: 6,
  },
  checkoutSectionNumber: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#fff0f4",
    alignItems: "center",
    justifyContent: "center",
  },
  checkoutSectionNumberText: {
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.6,
    color: RED,
  },
  checkoutSectionCopy: { flex: 1, minWidth: 0 },
  checkoutSectionEyebrow: {
    fontSize: 6,
    fontWeight: "900",
    letterSpacing: 1.2,
    color: RED,
  },
  checkoutSectionTitle: {
    fontFamily: "serif",
    fontSize: 17,
    lineHeight: 21,
    fontWeight: "700",
    color: "#211719",
    marginTop: 2,
  },
  checkoutSectionText: {
    fontSize: 7.5,
    lineHeight: 11,
    color: "#897d76",
    marginTop: 1,
  },
  checkoutField: {
    minHeight: 62,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#ddd4cf",
    backgroundColor: "#fcfbfa",
    paddingHorizontal: 10,
    marginTop: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  checkoutFieldFocused: {
    borderColor: RED,
    backgroundColor: "#fff",
    shadowColor: RED,
    shadowOpacity: 0.07,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  checkoutFieldMultiline: {
    minHeight: 88,
    alignItems: "flex-start",
    paddingTop: 11,
  },
  checkoutFieldIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: "#f2edeb",
    alignItems: "center",
    justifyContent: "center",
  },
  checkoutFieldIconFocused: { backgroundColor: "#fff0f4" },
  checkoutFieldCopy: { flex: 1, minWidth: 0 },
  checkoutFieldLabel: {
    fontSize: 5.5,
    fontWeight: "900",
    letterSpacing: 0.9,
    color: "#8a7e77",
  },
  checkoutFieldLabelFocused: { color: RED },
  checkoutFieldInput: {
    width: "100%",
    height: 32,
    paddingVertical: 0,
    fontSize: 10.5,
    color: "#211719",
  },
  checkoutFieldTextarea: { height: 52, paddingTop: 5 },
  checkoutFieldTextareaSmall: { height: 45, paddingTop: 5 },
  checkoutPayment: {
    minHeight: 112,
    marginTop: 11,
    borderRadius: 22,
    backgroundColor: "#211719",
    padding: 15,
    shadowColor: "#211719",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  checkoutPaymentTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  checkoutPaymentEyebrow: {
    fontSize: 6,
    fontWeight: "900",
    letterSpacing: 1.25,
    color: "#ff91a9",
  },
  checkoutSelectedPill: {
    height: 23,
    borderRadius: 12,
    backgroundColor: "#edf8f1",
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  checkoutSelectedText: {
    fontSize: 5.5,
    fontWeight: "900",
    letterSpacing: 0.65,
    color: "#176b43",
  },
  checkoutPaymentMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    marginTop: 12,
  },
  checkoutPaymentIcon: {
    width: 45,
    height: 45,
    borderRadius: 15,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  checkoutPaymentCopy: { flex: 1, minWidth: 0 },
  checkoutPaymentTitle: {
    fontFamily: "serif",
    fontSize: 15,
    lineHeight: 19,
    fontWeight: "700",
    color: "#fff",
  },
  checkoutPaymentText: {
    fontSize: 8,
    lineHeight: 12,
    color: "rgba(255,255,255,.58)",
    marginTop: 2,
  },
  checkoutPaymentCheck: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#176b43",
    alignItems: "center",
    justifyContent: "center",
  },
  checkoutSummaryCard: {
    marginTop: 11,
    borderRadius: 22,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e4dcd7",
    padding: 17,
    shadowColor: "#2a1916",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  checkoutSummaryHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  checkoutSummaryEyebrow: {
    fontSize: 6,
    fontWeight: "900",
    letterSpacing: 1.2,
    color: RED,
  },
  checkoutSummaryTitle: {
    fontFamily: "serif",
    fontSize: 19,
    lineHeight: 24,
    fontWeight: "700",
    color: "#211719",
    marginTop: 2,
  },
  checkoutItemPill: {
    height: 27,
    borderRadius: 14,
    backgroundColor: "#f3efec",
    paddingHorizontal: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  checkoutItemPillText: {
    fontSize: 6,
    fontWeight: "900",
    letterSpacing: 0.75,
    color: "#766b65",
  },
  checkoutSummaryRule: {
    height: 1,
    backgroundColor: "#eee7e2",
    marginVertical: 13,
  },
  checkoutSummaryRow: {
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  checkoutSummaryDelivery: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  checkoutSummaryLabel: { fontSize: 9, color: "#766b65" },
  checkoutSummaryValue: { fontSize: 10, fontWeight: "900", color: "#211719" },
  checkoutSummaryTotal: {
    minHeight: 76,
    borderRadius: 17,
    backgroundColor: "#f5f1ef",
    paddingHorizontal: 13,
    paddingVertical: 12,
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  checkoutSummaryTotalLabel: {
    fontSize: 5.5,
    fontWeight: "900",
    letterSpacing: 0.9,
    color: "#766b65",
  },
  checkoutSummaryTax: { fontSize: 6.5, color: "#968a83", marginTop: 4 },
  checkoutSummaryTotalValue: {
    fontSize: 22,
    fontWeight: "900",
    color: "#171310",
  },
  checkoutPlaceOrder: {
    minHeight: 62,
    borderRadius: 20,
    backgroundColor: RED,
    marginTop: 13,
    paddingLeft: 18,
    paddingRight: 7,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: RED,
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  checkoutPlaceOrderPressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  checkoutPlaceOrderCopy: { flex: 1, minWidth: 0 },
  checkoutPlaceOrderText: {
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1.05,
    color: "#fff",
  },
  checkoutPlaceOrderSubtext: {
    fontSize: 6.5,
    color: "rgba(255,255,255,.68)",
    marginTop: 3,
  },
  checkoutPlaceOrderArrow: {
    width: 48,
    height: 48,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  checkoutConsent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    marginTop: 11,
  },
  checkoutConsentText: {
    fontSize: 7,
    lineHeight: 11,
    color: "#8d817a",
    textAlign: "center",
  },
  emptyBagPhoto: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  page: { flexGrow: 1, backgroundColor: "#f5f2f0", paddingVertical: 14 },
  shell: {
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
    paddingHorizontal: 16,
  },
  header: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  back: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e4ddd8",
    alignItems: "center",
    justifyContent: "center",
  },
  headerSpacer: { width: 44, height: 44 },
  headerCopy: { flex: 1 },
  eyebrow: { fontSize: 7, fontWeight: "900", letterSpacing: 1.5, color: RED },
  title: {
    fontFamily: "serif",
    fontSize: 27,
    lineHeight: 32,
    fontWeight: "700",
    color: "#171310",
    marginTop: 2,
  },
  headerAction: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e4ddd8",
    alignItems: "center",
    justifyContent: "center",
  },
  touchTarget: { minWidth: 44, minHeight: 44 },
  touchHeight: { height: undefined, minHeight: 44 },
  badge: {
    position: "absolute",
    right: -2,
    top: -2,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: RED,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: { fontSize: 7, fontWeight: "900", color: "#fff" },
  pageIntro: {
    fontSize: 11,
    lineHeight: 17,
    color: "#716761",
    marginBottom: 15,
  },
  savedGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  savedCard: {
    width: "48.5%",
    minHeight: 310,
    borderRadius: 18,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5ddd8",
    padding: 12,
    shadowColor: "#2c1c17",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },
  savedImageWrap: {
    height: 145,
    borderRadius: 13,
    backgroundColor: "#f7f4f2",
    padding: 8,
  },
  savedImage: { width: "100%", height: "100%" },
  savedHeart: {
    position: "absolute",
    right: 7,
    top: 7,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  productBrand: {
    fontSize: 7,
    fontWeight: "900",
    letterSpacing: 1.1,
    color: "#625952",
    marginTop: 11,
  },
  productName: {
    fontFamily: "serif",
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
    color: "#171310",
    marginTop: 2,
  },
  productPrice: {
    fontSize: 13,
    fontWeight: "900",
    color: "#171310",
    marginTop: 7,
  },
  savedAdd: {
    height: 38,
    borderRadius: 19,
    backgroundColor: "#171310",
    marginTop: "auto",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  savedAddText: {
    fontSize: 6.5,
    fontWeight: "900",
    letterSpacing: 1,
    color: "#fff",
  },
  empty: {
    minHeight: 430,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 25,
    backgroundColor: "#fff0f4",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontFamily: "serif",
    fontSize: 24,
    lineHeight: 29,
    fontWeight: "700",
    color: "#171310",
    marginTop: 18,
  },
  emptyText: {
    fontSize: 11,
    lineHeight: 17,
    color: "#786e68",
    textAlign: "center",
    maxWidth: 320,
    marginTop: 6,
  },
  darkButton: {
    minHeight: 50,
    borderRadius: 25,
    backgroundColor: "#171310",
    marginTop: 20,
    paddingHorizontal: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  darkButtonText: {
    fontSize: 7.5,
    fontWeight: "900",
    letterSpacing: 1.2,
    color: "#fff",
  },
  emptyBag: { paddingTop: 7, paddingBottom: 24 },
  emptyBagHero: {
    minHeight: 390,
    borderRadius: 25,
    overflow: "hidden",
    padding: 23,
    justifyContent: "flex-end",
    shadowColor: "#271015",
    shadowOpacity: 0.2,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 9 },
    elevation: 5,
  },
  emptyBagHeroCompact: { minHeight: 370, padding: 20 },
  emptyBagGlow: {
    position: "absolute",
    right: -80,
    top: -105,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(215,25,63,.2)",
  },
  emptyBagTop: {
    position: "absolute",
    left: 20,
    right: 20,
    top: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  emptyBagStatus: {
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.15)",
    backgroundColor: "rgba(255,255,255,.06)",
    paddingHorizontal: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  emptyBagStatusDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#ff4e72",
  },
  emptyBagStatusText: {
    fontSize: 5.5,
    fontWeight: "900",
    letterSpacing: 0.9,
    color: "rgba(255,255,255,.72)",
  },
  emptyBagEdition: {
    fontSize: 5.5,
    fontWeight: "900",
    letterSpacing: 1.15,
    color: "rgba(255,255,255,.45)",
  },
  emptyBagMark: {
    width: 50,
    height: 50,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.18)",
    backgroundColor: "rgba(255,255,255,.08)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 17,
  },
  emptyBagEyebrow: {
    fontSize: 6.5,
    fontWeight: "900",
    letterSpacing: 1.55,
    color: "#ff8fa8",
  },
  emptyBagTitle: {
    fontFamily: "serif",
    fontSize: 29,
    lineHeight: 34,
    fontWeight: "700",
    letterSpacing: -0.35,
    color: "#fff",
    marginTop: 5,
    maxWidth: "76%",
  },
  emptyBagText: {
    fontSize: 10.5,
    lineHeight: 16,
    color: "rgba(255,255,255,.68)",
    marginTop: 7,
    maxWidth: "72%",
  },
  emptyBagButton: {
    height: 52,
    borderRadius: 26,
    backgroundColor: "#fff",
    paddingLeft: 18,
    paddingRight: 5,
    marginTop: 19,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  emptyBagButtonText: {
    fontSize: 7,
    fontWeight: "900",
    letterSpacing: 1.15,
    color: "#171310",
  },
  emptyBagButtonArrow: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#f0e9e6",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyBagBenefits: {
    minHeight: 82,
    borderRadius: 19,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5ddd8",
    marginTop: 12,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#2a1916",
    shadowOpacity: 0.045,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  emptyBagBenefit: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  emptyBagBenefitIcon: {
    width: 31,
    height: 31,
    borderRadius: 11,
    backgroundColor: "#edf8f1",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyBagBenefitText: {
    fontSize: 5.2,
    fontWeight: "900",
    letterSpacing: 0.55,
    color: "#587061",
    textAlign: "center",
  },
  emptyBagBenefitDivider: { width: 1, height: 34, backgroundColor: "#eee7e2" },
  emptyBagFootnote: {
    fontSize: 7.5,
    lineHeight: 12,
    color: "#8a7f78",
    textAlign: "center",
    marginTop: 12,
    paddingHorizontal: 22,
  },
  bagHeaderSeal: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#edf8f1",
    borderWidth: 1,
    borderColor: "#d7ecde",
    alignItems: "center",
    justifyContent: "center",
  },
  bagIntro: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 8,
  },
  bagIntroText: { flex: 1, fontSize: 9, lineHeight: 13, color: "#7b7069" },
  bagIntroCount: {
    fontSize: 6,
    fontWeight: "900",
    letterSpacing: 1,
    color: "#8a7e77",
  },
  bagList: { gap: 10 },
  bagRow: {
    minHeight: 142,
    borderRadius: 18,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5ddd8",
    padding: 11,
    flexDirection: "row",
    gap: 12,
  },
  bagRowPremium: {
    minHeight: 174,
    borderRadius: 20,
    padding: 12,
    shadowColor: "#2a1916",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  bagRowCompact: { gap: 9, padding: 9 },
  bagImageWrap: {
    width: 105,
    borderRadius: 13,
    backgroundColor: "#f7f4f2",
    padding: 7,
  },
  bagImagePremium: { position: "relative", borderRadius: 16 },
  bagImage: { width: "100%", height: "100%" },
  bagAuthenticMark: {
    position: "absolute",
    right: 6,
    bottom: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#176b43",
    borderWidth: 2,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  bagCopy: { flex: 1, minWidth: 0 },
  bagTop: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  bagRemove: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f5f1ef",
    alignItems: "center",
    justifyContent: "center",
  },
  bagName: {
    fontFamily: "serif",
    fontSize: 15,
    lineHeight: 19,
    fontWeight: "700",
    color: "#171310",
    marginTop: 2,
  },
  bagMeta: { fontSize: 8.5, color: "#857b75", marginTop: 5 },
  bagMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 5,
    marginTop: 7,
  },
  bagSizePill: {
    minHeight: 22,
    borderRadius: 11,
    backgroundColor: "#f3efec",
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  bagSizeText: { fontSize: 7, fontWeight: "800", color: "#625852" },
  bagStockPill: {
    minHeight: 22,
    borderRadius: 11,
    backgroundColor: "#edf8f1",
    paddingHorizontal: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  bagStockDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#29945a",
  },
  bagStockText: {
    fontSize: 5.5,
    fontWeight: "900",
    letterSpacing: 0.65,
    color: "#176b43",
  },
  bagUnitPrice: { fontSize: 7.5, color: "#8b8079", marginTop: 5 },
  bagBottom: {
    marginTop: "auto",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
  },
  quantity: {
    minHeight: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#ddd5d0",
    backgroundColor: "#fcfbfa",
    flexDirection: "row",
    alignItems: "center",
  },
  quantityButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  quantityText: {
    minWidth: 24,
    textAlign: "center",
    fontSize: 11,
    fontWeight: "900",
  },
  lineTotalGroup: { alignItems: "flex-end" },
  lineTotalLabel: {
    fontSize: 5,
    fontWeight: "900",
    letterSpacing: 0.8,
    color: "#9a8e87",
  },
  lineTotal: {
    fontSize: 13,
    fontWeight: "900",
    color: "#171310",
    marginTop: 2,
  },
  summary: {
    marginTop: 14,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e3dbd6",
    padding: 17,
  },
  summaryPremium: {
    borderRadius: 22,
    padding: 18,
    shadowColor: "#2a1916",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  summaryEyebrow: {
    fontSize: 6,
    fontWeight: "900",
    letterSpacing: 1.15,
    color: RED,
  },
  summaryHeading: {
    fontFamily: "serif",
    fontSize: 20,
    lineHeight: 25,
    fontWeight: "700",
    color: "#171310",
    marginTop: 2,
  },
  summaryItems: {
    fontSize: 7,
    fontWeight: "900",
    letterSpacing: 0.8,
    color: "#8b8079",
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginVertical: 5,
    flexWrap: "wrap",
  },
  summaryLabel: { fontSize: 10, color: "#746a64", flexShrink: 1 },
  summaryValue: {
    fontSize: 10,
    fontWeight: "800",
    color: "#2a2421",
    textAlign: "right",
  },
  deliveryLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 1,
  },
  summaryDivider: { height: 1, backgroundColor: "#eee7e2", marginVertical: 11 },
  totalPanel: {
    minHeight: 72,
    borderRadius: 16,
    backgroundColor: "#f5f1ef",
    marginTop: 12,
    paddingHorizontal: 13,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  totalLabel: {
    fontFamily: "serif",
    fontSize: 15,
    fontWeight: "700",
    color: "#171310",
  },
  totalTax: { fontSize: 6.5, lineHeight: 10, color: "#81766f", marginTop: 3 },
  totalValue: { fontSize: 19, fontWeight: "900", color: "#171310" },
  bagTrustRow: {
    minHeight: 48,
    marginTop: 11,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#eee7e2",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
  bagTrustItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  bagTrustText: {
    fontSize: 4.7,
    fontWeight: "900",
    letterSpacing: 0.55,
    color: "#587061",
    textAlign: "center",
  },
  bagTrustDivider: { width: 1, height: 22, backgroundColor: "#eee7e2" },
  summaryHint: {
    fontSize: 7.5,
    lineHeight: 12,
    color: "#8a8079",
    marginTop: 10,
    textAlign: "center",
  },
  checkoutButton: {
    minHeight: 58,
    borderRadius: 29,
    backgroundColor: RED,
    marginTop: 15,
    paddingLeft: 20,
    paddingRight: 7,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  checkoutText: {
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1.05,
    color: "#fff",
  },
  checkoutSubtext: {
    fontSize: 6.5,
    color: "rgba(255,255,255,.68)",
    marginTop: 3,
  },
  checkoutArrow: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  checkoutTrust: {
    minHeight: 65,
    borderRadius: 16,
    backgroundColor: "#edf8f1",
    borderWidth: 1,
    borderColor: "#d7ecde",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  checkoutTrustTitle: { fontSize: 9.5, fontWeight: "900", color: "#225f3e" },
  checkoutTrustText: {
    fontSize: 8,
    lineHeight: 12,
    color: "#5d7868",
    marginTop: 2,
  },
  formCard: {
    marginTop: 11,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e4dcd7",
    padding: 16,
  },
  formSection: {
    fontSize: 7,
    fontWeight: "900",
    letterSpacing: 1.4,
    color: RED,
    marginBottom: 1,
  },
  input: {
    minHeight: 49,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#d9d1cc",
    backgroundColor: "#fcfbfa",
    paddingHorizontal: 13,
    fontSize: 11,
    color: "#211c19",
    marginTop: 8,
  },
  addressInput: { height: 76, paddingTop: 12, textAlignVertical: "top" },
  notesInput: { height: 66, paddingTop: 12, textAlignVertical: "top" },
  paymentCard: {
    minHeight: 70,
    marginTop: 11,
    borderRadius: 18,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e4dcd7",
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  paymentIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#f2eeeb",
    alignItems: "center",
    justifyContent: "center",
  },
  paymentTitle: { fontSize: 11, fontWeight: "900", color: "#171310" },
  paymentText: { fontSize: 8.5, color: "#7a706a", marginTop: 2 },
  checkoutError: {
    minHeight: 45,
    borderRadius: 13,
    backgroundColor: "#fff0f4",
    paddingHorizontal: 12,
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  checkoutErrorText: {
    flex: 1,
    fontSize: 8.5,
    lineHeight: 12,
    color: RED,
    fontWeight: "700",
  },
  checkoutTotal: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
  },
  checkoutTotalLabel: {
    fontSize: 6.5,
    fontWeight: "900",
    letterSpacing: 1,
    color: "#817770",
  },
  checkoutTotalValue: { fontSize: 24, fontWeight: "900", color: "#171310" },
  placeOrder: {
    minHeight: 56,
    borderRadius: 28,
    backgroundColor: RED,
    marginTop: 12,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  placeOrderText: {
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1.2,
    color: "#fff",
  },
  disabled: { opacity: 0.5 },
  orderConsent: {
    fontSize: 7,
    lineHeight: 11,
    color: "#958b85",
    textAlign: "center",
    marginTop: 9,
    paddingHorizontal: 20,
  },
  thankPage: {
    flexGrow: 1,
    minHeight: "100%",
    paddingVertical: 28,
    paddingHorizontal: 18,
    justifyContent: "center",
  },
  thankShell: {
    width: "100%",
    maxWidth: 580,
    alignSelf: "center",
    alignItems: "center",
  },
  thankSeal: {
    width: 76,
    height: 76,
    borderRadius: 27,
    backgroundColor: RED,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: RED,
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  thankEyebrow: {
    fontSize: 7,
    fontWeight: "900",
    letterSpacing: 1.7,
    color: RED,
    marginTop: 20,
  },
  thankTitle: {
    fontFamily: "serif",
    fontSize: 29,
    lineHeight: 35,
    fontWeight: "700",
    color: "#171310",
    textAlign: "center",
    marginTop: 5,
  },
  thankCopy: {
    fontSize: 11,
    lineHeight: 18,
    color: "#706660",
    textAlign: "center",
    maxWidth: 420,
    marginTop: 7,
  },
  orderCard: {
    width: "100%",
    borderRadius: 22,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e3dbd6",
    padding: 18,
    marginTop: 21,
    shadowColor: "#2a1915",
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
  },
  orderCardLabel: {
    fontSize: 6.5,
    fontWeight: "900",
    letterSpacing: 1.3,
    color: "#887e77",
  },
  orderNumber: {
    fontFamily: "serif",
    fontSize: 21,
    lineHeight: 27,
    fontWeight: "700",
    color: "#171310",
    marginTop: 2,
  },
  orderStatus: {
    position: "absolute",
    right: 16,
    top: 18,
    minHeight: 25,
    borderRadius: 13,
    backgroundColor: "#fff0f4",
    paddingHorizontal: 8,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  orderStatusInline: {
    position: "relative",
    right: undefined,
    top: undefined,
    alignSelf: "flex-start",
    marginTop: 8,
  },
  orderStatusDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: RED,
  },
  orderStatusText: {
    fontSize: 5,
    fontWeight: "900",
    letterSpacing: 0.7,
    color: RED,
  },
  orderRule: { height: 1, backgroundColor: "#eee7e2", marginVertical: 14 },
  thankPromise: {
    width: "100%",
    minHeight: 72,
    borderRadius: 17,
    backgroundColor: "#f3ece9",
    padding: 14,
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  thankPromiseTitle: { fontSize: 9.5, fontWeight: "900", color: "#171310" },
  thankPromiseText: {
    fontSize: 8,
    lineHeight: 12,
    color: "#766c66",
    marginTop: 2,
  },
});
