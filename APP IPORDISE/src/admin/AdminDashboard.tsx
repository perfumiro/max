import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView as NativeScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import { useResponsiveLayout } from "../useResponsiveLayout";
import {
  checkAdminConnections,
  createAdminProduct,
  deleteAdminOrder,
  loadAdminDashboard,
  loadAdminSupportThread,
  publishAdminBestsellerRanking,
  restoreAdminSession,
  sendAdminSupportReply,
  signInAdmin,
  signOutAdmin,
  updateAdminConversation,
  updateAdminHelpConfig,
  updateAdminShopConfig,
  updateAdminStorefrontConfig,
  updateAdminOrderShipping,
  updateAdminOrderStatus,
  updateAdminProduct,
  type AdminConnectionHealth,
  type AdminConversation,
  type AdminDashboardData,
  type AdminOrder,
  type AdminOrderShippingPatch,
  type AdminProduct,
  type AdminProductPatch,
  type AdminSession,
  type AdminSupportThread,
  type NewAdminProduct,
} from "../services/adminService";
import { normalizeHomeConfig, type HomeConfig } from "../home/homeConfig";
import {
  normalizeOfferHero,
  type OfferHeroConfig,
} from "../offers/offerConfig";
import { normalizeHelpConfig, type HelpConfig } from "../help/helpConfig";
import { SmoothScrollView as ScrollView } from "../components/smoothHorizontalScroll";
import {
  normalizeShopConfig,
  type ShopConfig,
  type ShopLink,
} from "../shop/shopConfig";

const RED = "#d7193f";
type AdminTab =
  | "Overview"
  | "Products"
  | "Inventory"
  | "Orders"
  | "Customers"
  | "Promotions"
  | "Support"
  | "Manage App";
const navItems: [AdminTab, string][] = [
  ["Overview", "grid-outline"],
  ["Products", "cube-outline"],
  ["Inventory", "layers-outline"],
  ["Orders", "receipt-outline"],
  ["Customers", "people-outline"],
  ["Promotions", "pricetag-outline"],
  ["Support", "chatbubbles-outline"],
  ["Manage App", "settings-outline"],
];
const orderFlow: AdminOrder["status"][] = [
  "pending",
  "confirmed",
  "processing",
  "ready_for_dispatch",
  "shipped",
  "out_for_delivery",
  "delivered",
];
const orderStatuses: AdminOrder["status"][] = [...orderFlow, "delivery_failed", "return_requested", "returned", "cancelled"];
const primaryOrderTransition: Partial<Record<AdminOrder["status"], AdminOrder["status"]>> = {
  pending: "confirmed",
  confirmed: "processing",
  processing: "ready_for_dispatch",
  ready_for_dispatch: "shipped",
  shipped: "out_for_delivery",
  out_for_delivery: "delivered",
  delivery_failed: "out_for_delivery",
  delivered: "return_requested",
  return_requested: "returned",
};

const money = (value: number, currency = "MAD") =>
  `${Math.round(Number(value) || 0).toLocaleString("en-US")} ${currency}`;
const shortDate = (value: string) =>
  new Date(value).toLocaleDateString("en-MA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
const titleCase = (value: string) =>
  value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

function AdminLogin({
  onSignedIn,
}: {
  onSignedIn: (session: AdminSession) => void;
}) {
  const layout = useResponsiveLayout();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remembered, setRemembered] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [focusedField, setFocusedField] = useState<"email" | "password" | null>(
    null,
  );
  const submit = async () => {
    if (!email.includes("@") || password.length < 6) {
      setError("Enter your staff email and password.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      onSignedIn(await signInAdmin(email, password, remembered));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Secure sign-in failed.");
    } finally {
      setLoading(false);
    }
  };
  const openStorefront = () => {
    if (Platform.OS === "web" && typeof globalThis.location !== "undefined") {
      globalThis.location.assign("/");
      return;
    }
    void Linking.openURL("https://ipordise.com");
  };
  return (
    <SafeAreaView style={styles.loginSafe}>
      <StatusBar style="light" />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.loginScroll}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[styles.loginShell, layout.tablet && styles.loginShellDesktop]}
        >
          <View
            style={[
              styles.loginStory,
              !layout.tablet && styles.loginStoryMobile,
              layout.tablet && styles.loginStoryDesktop,
            ]}
          >
            <LinearGradient
              colors={["#49111d", "#210b10", "#090707"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.loginGlow} />
            <View style={styles.loginGlowSmall} />
            <View style={styles.loginBrandRow}>
              <View style={styles.adminWordmark}>
                <Text style={styles.adminWordmarkText}>IPORDISE</Text>
                <Text style={styles.adminWordmarkMeta}>
                  ADMINISTRATION · MOROCCO
                </Text>
              </View>
              <View style={styles.loginRouteBadge}>
                <View style={styles.loginOnlineDot} />
                <Text style={styles.loginRouteText}>SECURE / APP</Text>
              </View>
            </View>
            <View
              style={[
                styles.loginStoryCopy,
                !layout.tablet && styles.loginStoryCopyMobile,
              ]}
            >
              <Text style={styles.loginKicker}>PRIVATE OPERATIONS SUITE</Text>
              <Text
                style={[
                  styles.loginTitle,
                  !layout.tablet && styles.loginTitleMobile,
                ]}
              >
                Run the boutique.{`\n`}Beautifully.
              </Text>
              <Text style={styles.loginDescription}>
                Catalogue, orders and client care—together in one protected
                workspace.
              </Text>
              <View style={styles.loginPromises}>
                {["Role protected", "Audit ready", "Live catalogue"].map(
                  (item, index) => (
                    <View key={item} style={styles.loginPromise}>
                      <Ionicons
                        name={
                          index === 0
                            ? "shield-checkmark-outline"
                            : index === 1
                              ? "time-outline"
                              : "sync-outline"
                        }
                        size={14}
                        color="#ff91aa"
                      />
                      <Text style={styles.loginPromiseText}>{item}</Text>
                    </View>
                  ),
                )}
              </View>
            </View>
          </View>
          <View
            style={[
              styles.loginPanel,
              !layout.tablet && styles.loginPanelMobile,
              layout.tablet && styles.loginPanelDesktop,
            ]}
          >
            <View
              style={[
                styles.loginPanelInner,
                !layout.tablet && styles.loginPanelInnerMobile,
              ]}
            >
              <View style={styles.loginAccessRow}>
                <View style={styles.loginLock}>
                  <Ionicons name="lock-closed" size={18} color={RED} />
                </View>
                <View style={styles.loginAccessCopy}>
                  <Text style={styles.loginEyebrow}>SECURE STAFF ACCESS</Text>
                  <Text style={styles.loginAccessStatus}>
                    Protected IPORDISE workspace
                  </Text>
                </View>
                <View style={styles.loginVerifiedBadge}>
                  <Ionicons name="checkmark" size={12} color="#176b43" />
                  <Text style={styles.loginVerifiedText}>VERIFIED</Text>
                </View>
              </View>
              <View style={styles.loginHeadingRule} />
              <Text style={styles.loginHeading}>Welcome back.</Text>
              <Text style={styles.loginText}>
                Sign in with your authorised administrator account.
              </Text>
              <Text style={styles.fieldLabel}>EMAIL ADDRESS</Text>
              <View
                style={[
                  styles.inputWrap,
                  focusedField === "email" && styles.inputWrapFocused,
                ]}
              >
                <Ionicons
                  name="mail-outline"
                  size={17}
                  color={focusedField === "email" ? RED : "#7a706a"}
                />
                <TextInput
                  value={email}
                  onChangeText={(value) => {
                    setEmail(value);
                    setError("");
                  }}
                  onFocus={() => setFocusedField("email")}
                  onBlur={() => setFocusedField(null)}
                  selectionColor={RED}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  autoComplete="email"
                  returnKeyType="next"
                  placeholder="name@ipordise.com"
                  placeholderTextColor="#a29994"
                  style={styles.input}
                />
              </View>
              <Text style={styles.fieldLabel}>PASSWORD</Text>
              <View
                style={[
                  styles.inputWrap,
                  focusedField === "password" && styles.inputWrapFocused,
                ]}
              >
                <Ionicons
                  name="key-outline"
                  size={17}
                  color={focusedField === "password" ? RED : "#7a706a"}
                />
                <TextInput
                  value={password}
                  onChangeText={(value) => {
                    setPassword(value);
                    setError("");
                  }}
                  onFocus={() => setFocusedField("password")}
                  onBlur={() => setFocusedField(null)}
                  selectionColor={RED}
                  secureTextEntry={!showPassword}
                  textContentType="password"
                  autoComplete="current-password"
                  returnKeyType="go"
                  placeholder="Enter your secure password"
                  placeholderTextColor="#a29994"
                  style={styles.input}
                  onSubmitEditing={submit}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    showPassword ? "Hide password" : "Show password"
                  }
                  onPress={() => setShowPassword((value) => !value)}
                  hitSlop={8}
                  style={styles.passwordToggle}
                >
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={18}
                    color="#776c66"
                  />
                </Pressable>
              </View>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: remembered }}
                onPress={() => setRemembered((value) => !value)}
                style={styles.rememberRow}
              >
                <View
                  style={[
                    styles.rememberBox,
                    remembered && styles.rememberBoxChecked,
                  ]}
                >
                  {remembered ? (
                    <Ionicons name="checkmark" size={13} color="#fff" />
                  ) : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rememberTitle}>Keep me signed in</Text>
                  <Text style={styles.rememberText}>
                    Stay signed in on this trusted device
                  </Text>
                </View>
              </Pressable>
              {error ? (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle-outline" size={16} color={RED} />
                  <Text accessibilityRole="alert" style={styles.errorText}>
                    {error}
                  </Text>
                </View>
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open admin dashboard"
                disabled={loading}
                onPress={submit}
                style={({ pressed }) => [
                  styles.loginButton,
                  (pressed || loading) && styles.pressed,
                ]}
              >
                <Text style={styles.loginButtonText}>
                  {loading ? "VERIFYING ACCESS…" : "OPEN DASHBOARD"}
                </Text>
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <View style={styles.loginButtonIcon}>
                    <Ionicons name="arrow-forward" size={17} color="#fff" />
                  </View>
                )}
              </Pressable>
              <View style={styles.loginTrustRow}>
                <View style={styles.loginTrustItem}>
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={15}
                    color="#176b43"
                  />
                  <Text style={styles.loginTrustText}>Encrypted access</Text>
                </View>
                <View style={styles.loginTrustDivider} />
                <View style={styles.loginTrustItem}>
                  <Ionicons name="person-outline" size={15} color="#176b43" />
                  <Text style={styles.loginTrustText}>Staff only</Text>
                </View>
              </View>
              <Pressable
                accessibilityRole="link"
                onPress={openStorefront}
                style={styles.storefrontLink}
              >
                <Ionicons name="arrow-back" size={13} color="#6e625c" />
                <Text style={styles.storefrontLinkText}>
                  RETURN TO THE BOUTIQUE
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon,
  tone = "dark",
}: {
  label: string;
  value: string;
  detail: string;
  icon: string;
  tone?: "dark" | "red" | "light";
}) {
  const phone = useResponsiveLayout().width < 600;
  return (
    <View
      style={[
        styles.metricCard,
        phone && styles.metricCardPhone,
        tone === "dark" && styles.metricDark,
        tone === "red" && styles.metricRed,
      ]}
    >
      <View
        style={[
          styles.metricIcon,
          phone && styles.metricIconPhone,
          tone !== "light" && styles.metricIconOnDark,
        ]}
      >
        <Ionicons
          name={icon as any}
          size={phone ? 15 : 18}
          color={tone === "light" ? RED : "#fff"}
        />
      </View>
      <Text
        style={[
          styles.metricLabel,
          phone && styles.metricLabelPhone,
          tone !== "light" && styles.textMutedLight,
        ]}
      >
        {label}
      </Text>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        style={[
          styles.metricValue,
          phone && styles.metricValuePhone,
          tone !== "light" && styles.textLight,
        ]}
      >
        {value}
      </Text>
      <Text
        numberOfLines={1}
        style={[
          styles.metricDetail,
          phone && styles.metricDetailPhone,
          tone !== "light" && styles.textMutedLight,
        ]}
      >
        {detail}
      </Text>
    </View>
  );
}

function StatusPill({ value }: { value: string }) {
  const good =
    value === "active" || value === "delivered" || value === "resolved";
  const warning = ["pending", "processing", "open", "high", "urgent"].includes(
    value,
  );
  return (
    <View
      style={[
        styles.statusPill,
        good && styles.statusGood,
        warning && styles.statusWarning,
      ]}
    >
      <View
        style={[
          styles.statusDot,
          good && styles.statusDotGood,
          warning && styles.statusDotWarning,
        ]}
      />
      <Text
        style={[
          styles.statusText,
          good && styles.statusTextGood,
          warning && styles.statusTextWarning,
        ]}
      >
        {value.replaceAll("_", " ").toUpperCase()}
      </Text>
    </View>
  );
}

function SectionHeader({
  eyebrow,
  title,
  detail,
  action,
}: {
  eyebrow: string;
  title: string;
  detail: string;
  action?: React.ReactNode;
}) {
  const phone = useResponsiveLayout().width < 600;
  return (
    <View style={[styles.sectionHeader, phone && styles.sectionHeaderPhone]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionEyebrow}>{eyebrow}</Text>
        <Text style={[styles.sectionTitle, phone && styles.sectionTitlePhone]}>
          {title}
        </Text>
        <Text
          style={[styles.sectionDetail, phone && styles.sectionDetailPhone]}
        >
          {detail}
        </Text>
      </View>
      {action}
    </View>
  );
}

function Overview({
  data,
  onNavigate,
}: {
  data: AdminDashboardData;
  onNavigate: (tab: AdminTab) => void;
}) {
  const revenue = data.orders
    .filter((order) => order.status !== "cancelled")
    .reduce((sum, order) => sum + Number(order.total || 0), 0);
  const attention = data.orders.filter(
    (order) => order.status === "pending" || order.risk_level !== "low",
  ).length;
  const openSupport = data.conversations.filter(
    (item) => item.status === "open" || item.status === "pending_customer",
  ).length;
  return (
    <>
      <SectionHeader
        eyebrow="TODAY AT IPORDISE"
        title="Boutique overview"
        detail="A clear view of catalogue and client operations."
      />
      <View style={styles.metricGrid}>
        <MetricCard
          label="CATALOGUE"
          value={String(data.totals.products)}
          detail={`${data.products.filter((item) => item.active).length} live in this view`}
          icon="cube-outline"
          tone="dark"
        />
        <MetricCard
          label="ORDERS"
          value={String(data.totals.orders)}
          detail={`${attention} need attention`}
          icon="receipt-outline"
          tone="red"
        />
        <MetricCard
          label="REVENUE"
          value={money(revenue)}
          detail="Recent non-cancelled orders"
          icon="trending-up-outline"
          tone="light"
        />
        <MetricCard
          label="CLIENT CARE"
          value={String(openSupport)}
          detail="Open conversations"
          icon="chatbubbles-outline"
          tone="light"
        />
      </View>
      <View style={styles.twoColumn}>
        <View style={styles.panel}>
          <View style={styles.panelHead}>
            <View>
              <Text style={styles.panelEyebrow}>RECENT ORDERS</Text>
              <Text style={styles.panelTitle}>Latest activity</Text>
            </View>
            <Pressable
              onPress={() => onNavigate("Orders")}
              style={styles.panelLink}
            >
              <Text style={styles.panelLinkText}>View all</Text>
              <Ionicons name="arrow-forward" size={14} />
            </Pressable>
          </View>
          {data.orders.slice(0, 4).map((order) => (
            <View key={order.id} style={styles.listRow}>
              <View style={styles.listIcon}>
                <Ionicons name="bag-handle-outline" size={17} color={RED} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={styles.listTitle}>
                  {order.order_number || "Order pending number"}
                </Text>
                <Text style={styles.listMeta}>
                  {order.customer?.name || "Client"} ·{" "}
                  {shortDate(order.created_at)}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.listAmount}>
                  {money(order.total, order.currency)}
                </Text>
                <StatusPill value={order.status} />
              </View>
            </View>
          ))}
          {!data.orders.length ? (
            <EmptyState
              icon="receipt-outline"
              title="No orders yet"
              text="New orders will appear here automatically."
            />
          ) : null}
        </View>
        <View style={styles.panel}>
          <View style={styles.panelHead}>
            <View>
              <Text style={styles.panelEyebrow}>CATALOGUE HEALTH</Text>
              <Text style={styles.panelTitle}>Needs attention</Text>
            </View>
            <Pressable
              onPress={() => onNavigate("Products")}
              style={styles.panelLink}
            >
              <Text style={styles.panelLinkText}>Manage</Text>
              <Ionicons name="arrow-forward" size={14} />
            </Pressable>
          </View>
          {data.products
            .filter(
              (item) =>
                !item.active ||
                item.stock_left === 0 ||
                !Object.values(item.sizes || {}).some((price) => price > 0),
            )
            .slice(0, 4)
            .map((product) => (
              <View key={product.id} style={styles.listRow}>
                <Image
                  source={{ uri: product.image }}
                  style={styles.listProductImage}
                />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={styles.listTitle}>
                    {product.name}
                  </Text>
                  <Text style={styles.listMeta}>{product.brand}</Text>
                </View>
                <StatusPill
                  value={
                    !product.active
                      ? "inactive"
                      : product.stock_left === 0
                        ? "out of stock"
                        : "price needed"
                  }
                />
              </View>
            ))}
          {!data.products.some(
            (item) =>
              !item.active ||
              item.stock_left === 0 ||
              !Object.values(item.sizes || {}).some((price) => price > 0),
          ) ? (
            <EmptyState
              icon="checkmark-circle-outline"
              title="Catalogue looks healthy"
              text="No product requires immediate attention."
            />
          ) : null}
        </View>
      </View>
    </>
  );
}

function EmptyState({
  icon,
  title,
  text,
}: {
  icon: string;
  title: string;
  text: string;
}) {
  return (
    <View style={styles.empty}>
      <Ionicons name={icon as any} size={25} color="#a99d97" />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

function ProductEditor({
  product,
  visible,
  saving,
  onClose,
  onSave,
}: {
  product: AdminProduct | null;
  visible: boolean;
  saving: boolean;
  onClose: () => void;
  onSave: (patch: AdminProductPatch) => void;
}) {
  const phone = useResponsiveLayout().width < 600;
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [image, setImage] = useState("");
  const [description, setDescription] = useState("");
  const [notesTop, setNotesTop] = useState("");
  const [notesHeart, setNotesHeart] = useState("");
  const [notesBase, setNotesBase] = useState("");
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [originalPrices, setOriginalPrices] = useState<Record<string, string>>(
    {},
  );
  const [stock, setStock] = useState("");
  const [active, setActive] = useState(true);
  const [newSize, setNewSize] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (product) {
      setName(product.name);
      setBrand(product.brand);
      setImage(product.image);
      setDescription(product.description || "");
      setNotesTop(product.notes?.top || "");
      setNotesHeart(product.notes?.heart || "");
      setNotesBase(product.notes?.base || "");
      setPrices(
        Object.fromEntries(
          Object.entries(product.sizes || {}).map(([key, value]) => [
            key,
            String(value),
          ]),
        ),
      );
      setOriginalPrices(
        Object.fromEntries(
          Object.entries(product.original_prices || {}).map(([key, value]) => [
            key,
            String(value),
          ]),
        ),
      );
      setStock(product.stock_left == null ? "" : String(product.stock_left));
      setActive(product.active);
      setError("");
    }
  }, [product]);
  const addSize = () => {
    const key = newSize.trim().toLowerCase().replace(/\s+/g, "");
    if (!/^\d+(?:\.\d+)?ml$/.test(key)) {
      setError("Use a size such as 5ml or 100ml.");
      return;
    }
    setPrices((value) => ({ ...value, [key]: value[key] || "" }));
    setNewSize("");
    setError("");
  };
  const submit = () => {
    const sizes = Object.fromEntries(
      Object.entries(prices)
        .filter(([, value]) => value.trim() !== "")
        .map(([key, value]) => [key, Number(value)]),
    );
    const original_prices = Object.fromEntries(
      Object.entries(originalPrices)
        .filter(([key, value]) => value.trim() !== "" && sizes[key] > 0)
        .map(([key, value]) => [key, Number(value)]),
    );
    if (
      name.trim().length < 2 ||
      brand.trim().length < 2 ||
      !/^https:\/\//i.test(image.trim())
    ) {
      setError("Add a valid product name, brand and public HTTPS image.");
      return;
    }
    if (
      !Object.keys(sizes).length ||
      Object.values(sizes).some(
        (value) => !Number.isFinite(value) || value <= 0,
      ) ||
      Object.values(original_prices).some(
        (value) => !Number.isFinite(value) || value <= 0,
      )
    ) {
      setError("Every active size needs a valid positive price.");
      return;
    }
    if (
      Object.entries(original_prices).some(
        ([key, value]) => value <= sizes[key],
      )
    ) {
      setError("Each original price must be higher than its sale price.");
      return;
    }
    const stockValue = stock.trim() === "" ? null : Number(stock);
    if (
      stockValue !== null &&
      (!Number.isInteger(stockValue) || stockValue < 0)
    ) {
      setError("Stock must be a non-negative whole number.");
      return;
    }
    onSave({
      name: name.trim(),
      brand: brand.trim().toUpperCase(),
      image: image.trim(),
      description: description.trim() || null,
      notes: {
        top: notesTop.trim(),
        heart: notesHeart.trim(),
        base: notesBase.trim(),
      },
      sizes,
      original_prices,
      stock_left: stockValue,
      active,
    });
  };
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={[styles.modalBackdrop, phone && styles.modalBackdropPhone]}>
        <View style={[styles.editor, phone && styles.editorPhone]}>
          <View style={styles.editorHead}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionEyebrow}>CATALOGUE CONTROL</Text>
              <Text style={styles.editorTitle}>{product?.name}</Text>
              <Text style={styles.editorMeta}>
                {product?.brand} · {product?.id}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close product editor"
              onPress={onClose}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={20} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.editorBody}>
            <Text style={styles.fieldLabel}>PRODUCT NAME</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              style={styles.editorInput}
            />
            <Text style={styles.fieldLabel}>BRAND</Text>
            <TextInput
              value={brand}
              onChangeText={setBrand}
              autoCapitalize="characters"
              style={styles.editorInput}
            />
            <Text style={styles.fieldLabel}>PUBLIC HTTPS IMAGE</Text>
            <TextInput
              value={image}
              onChangeText={setImage}
              autoCapitalize="none"
              keyboardType="url"
              style={styles.editorInput}
            />
            {/^https:\/\//i.test(image.trim()) ? (
              <Image
                source={{ uri: image.trim() }}
                resizeMode="contain"
                accessibilityLabel="Product image preview"
                style={styles.productImagePreview}
              />
            ) : null}
            <Text style={styles.fieldLabel}>DESCRIPTION</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              multiline
              maxLength={4000}
              style={[styles.editorInput, styles.homeMultiline]}
            />
            <Text style={styles.fieldLabel}>FRAGRANCE NOTES</Text>
            <Text style={styles.editorHelp}>
              Add the scent journey shown in the product Notes tab.
            </Text>
            <TextInput
              accessibilityLabel="Top notes"
              value={notesTop}
              onChangeText={setNotesTop}
              placeholder="Top notes — citrus, bergamot, pink pepper"
              placeholderTextColor="#a29994"
              style={styles.editorInput}
            />
            <TextInput
              accessibilityLabel="Heart notes"
              value={notesHeart}
              onChangeText={setNotesHeart}
              placeholder="Heart notes — lavender, iris, spice"
              placeholderTextColor="#a29994"
              style={styles.editorInput}
            />
            <TextInput
              accessibilityLabel="Base notes"
              value={notesBase}
              onChangeText={setNotesBase}
              placeholder="Base notes — woods, amber, musk"
              placeholderTextColor="#a29994"
              style={styles.editorInput}
            />
            <View style={styles.editorToggleRow}>
              <View>
                <Text style={styles.fieldLabel}>APP VISIBILITY</Text>
                <Text style={styles.editorHelp}>
                  {active
                    ? "Visible in the IPORDISE catalogue"
                    : "Archived and hidden from customers"}
                </Text>
              </View>
              <Pressable
                accessibilityRole="switch"
                accessibilityState={{ checked: active }}
                onPress={() => setActive((value) => !value)}
                style={[styles.toggle, active && styles.toggleActive]}
              >
                <View
                  style={[styles.toggleKnob, active && styles.toggleKnobActive]}
                />
              </Pressable>
            </View>
            <Text style={styles.fieldLabel}>STOCK AVAILABLE</Text>
            <TextInput
              value={stock}
              onChangeText={setStock}
              keyboardType="number-pad"
              placeholder="Unlimited"
              placeholderTextColor="#a29994"
              style={styles.editorInput}
            />
            <View style={styles.priceHead}>
              <View>
                <Text style={styles.fieldLabel}>SIZE PRICES</Text>
                <Text style={styles.editorHelp}>
                  Prices are in Moroccan dirham.
                </Text>
              </View>
              <Text style={styles.priceCurrency}>MAD</Text>
            </View>
            {Object.entries(prices).map(([size, value]) => (
              <View key={size} style={styles.priceRow}>
                <View style={styles.sizeBadge}>
                  <Text style={styles.sizeBadgeText}>{size.toUpperCase()}</Text>
                </View>
                <TextInput
                  value={value}
                  onChangeText={(next) =>
                    setPrices((current) => ({ ...current, [size]: next }))
                  }
                  keyboardType="decimal-pad"
                  placeholder="Price"
                  placeholderTextColor="#a29994"
                  style={styles.priceInput}
                />
                <TextInput
                  accessibilityLabel={`${size} compare-at price`}
                  value={originalPrices[size] || ""}
                  onChangeText={(next) =>
                    setOriginalPrices((current) => ({
                      ...current,
                      [size]: next,
                    }))
                  }
                  keyboardType="decimal-pad"
                  placeholder="Compare at"
                  placeholderTextColor="#a29994"
                  style={styles.priceInput}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${size} variant`}
                  onPress={() =>
                    (setPrices((current) =>
                      Object.fromEntries(Object.entries(current).filter(([key]) => key !== size)),
                    ),
                    setOriginalPrices((current) =>
                      Object.fromEntries(Object.entries(current).filter(([key]) => key !== size)),
                    ))
                  }
                  style={styles.removePrice}
                >
                  <Ionicons name="trash-outline" size={16} color={RED} />
                </Pressable>
              </View>
            ))}
            <View style={styles.addSizeRow}>
              <TextInput
                value={newSize}
                onChangeText={setNewSize}
                autoCapitalize="none"
                placeholder="Add size, e.g. 10ml"
                placeholderTextColor="#a29994"
                style={[styles.editorInput, { flex: 1, marginTop: 0 }]}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add product size"
                onPress={addSize}
                style={styles.addSizeButton}
              >
                <Ionicons name="add" size={19} color="#fff" />
              </Pressable>
            </View>
            {error ? (
              <Text accessibilityRole="alert" style={styles.editorError}>
                {error}
              </Text>
            ) : null}
          </ScrollView>
          <View style={styles.editorFooter}>
            <Pressable onPress={onClose} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              disabled={saving}
              onPress={submit}
              style={[styles.primaryButton, saving && styles.pressed]}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.primaryButtonText}>Save to app</Text>
                  <Ionicons name="checkmark" size={18} color="#fff" />
                </>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function NewProductEditor({
  visible,
  saving,
  onClose,
  onSave,
}: {
  visible: boolean;
  saving: boolean;
  onClose: () => void;
  onSave: (product: NewAdminProduct) => void;
}) {
  const phone = useResponsiveLayout().width < 600;
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [image, setImage] = useState("");
  const [size, setSize] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [notesTop, setNotesTop] = useState("");
  const [notesHeart, setNotesHeart] = useState("");
  const [notesBase, setNotesBase] = useState("");
  const [active, setActive] = useState(false);
  const [error, setError] = useState("");
  const close = () => {
    if (!saving) {
      setError("");
      onClose();
    }
  };
  const submit = () => {
    const numericPrice = Number(price);
    const numericStock = stock.trim() === "" ? null : Number(stock);
    if (
      name.trim().length < 2 ||
      brand.trim().length < 2 ||
      !/^https:\/\//i.test(image.trim()) ||
      !/^\d+(?:\.\d+)?\s*ml$/i.test(size.trim()) ||
      !Number.isFinite(numericPrice) ||
      numericPrice <= 0 ||
      (numericStock !== null &&
        (!Number.isInteger(numericStock) || numericStock < 0))
    ) {
      setError(
        "Add a name, brand, HTTPS image, size such as 20 ml, valid price and non-negative stock.",
      );
      return;
    }
    onSave({
      name,
      brand,
      image: image.trim(),
      size,
      price: numericPrice,
      stock: numericStock,
      active,
      notes: {
        top: notesTop.trim(),
        heart: notesHeart.trim(),
        base: notesBase.trim(),
      },
    });
  };
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={close}
    >
      <View style={[styles.modalBackdrop, phone && styles.modalBackdropPhone]}>
        <View style={[styles.editor, phone && styles.editorPhone]}>
          <View style={styles.editorHead}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionEyebrow}>NEW CATALOGUE ITEM</Text>
              <Text style={styles.editorTitle}>Add a fragrance</Text>
              <Text style={styles.editorMeta}>
                Saved to the shared commerce database
              </Text>
            </View>
            <Pressable
              disabled={saving}
              onPress={close}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={20} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.editorBody}>
            <Text style={styles.fieldLabel}>PRODUCT NAME</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Fragrance name"
              placeholderTextColor="#a29994"
              style={styles.editorInput}
            />
            <Text style={styles.fieldLabel}>BRAND</Text>
            <TextInput
              value={brand}
              onChangeText={setBrand}
              autoCapitalize="characters"
              placeholder="Brand"
              placeholderTextColor="#a29994"
              style={styles.editorInput}
            />
            <Text style={styles.fieldLabel}>PUBLIC HTTPS IMAGE</Text>
            <TextInput
              value={image}
              onChangeText={setImage}
              autoCapitalize="none"
              keyboardType="url"
              placeholder="https://…"
              placeholderTextColor="#a29994"
              style={styles.editorInput}
            />
            <Text style={styles.fieldLabel}>FIRST VARIANT</Text>
            <View style={styles.addSizeRow}>
              <TextInput
                value={size}
                onChangeText={setSize}
                placeholder="20 ml"
                placeholderTextColor="#a29994"
                style={[styles.editorInput, { flex: 1, marginTop: 0 }]}
              />
              <TextInput
                value={price}
                onChangeText={setPrice}
                keyboardType="decimal-pad"
                placeholder="Price MAD"
                placeholderTextColor="#a29994"
                style={[styles.editorInput, { flex: 1, marginTop: 0 }]}
              />
            </View>
            <Text style={styles.fieldLabel}>VARIANT STOCK</Text>
            <TextInput
              value={stock}
              onChangeText={setStock}
              keyboardType="number-pad"
              placeholder="Unlimited"
              placeholderTextColor="#a29994"
              style={styles.editorInput}
            />
            <Text style={styles.fieldLabel}>FRAGRANCE NOTES</Text>
            <Text style={styles.editorHelp}>
              These appear as Top, Heart and Base on the product page.
            </Text>
            <TextInput
              value={notesTop}
              onChangeText={setNotesTop}
              placeholder="Top notes"
              placeholderTextColor="#a29994"
              style={styles.editorInput}
            />
            <TextInput
              value={notesHeart}
              onChangeText={setNotesHeart}
              placeholder="Heart notes"
              placeholderTextColor="#a29994"
              style={styles.editorInput}
            />
            <TextInput
              value={notesBase}
              onChangeText={setNotesBase}
              placeholder="Base notes"
              placeholderTextColor="#a29994"
              style={styles.editorInput}
            />
            <View style={styles.editorToggleRow}>
              <View>
                <Text style={styles.fieldLabel}>PUBLISH NOW</Text>
                <Text style={styles.editorHelp}>
                  {active
                    ? "Customers can purchase it immediately"
                    : "Save as a draft until it is ready"}
                </Text>
              </View>
              <Pressable
                accessibilityRole="switch"
                accessibilityState={{ checked: active }}
                onPress={() => setActive((value) => !value)}
                style={[styles.toggle, active && styles.toggleActive]}
              >
                <View
                  style={[styles.toggleKnob, active && styles.toggleKnobActive]}
                />
              </Pressable>
            </View>
            {error ? (
              <Text accessibilityRole="alert" style={styles.editorError}>
                {error}
              </Text>
            ) : null}
          </ScrollView>
          <View style={styles.editorFooter}>
            <Pressable
              disabled={saving}
              onPress={close}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              disabled={saving}
              onPress={submit}
              style={[styles.primaryButton, saving && styles.pressed]}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.primaryButtonText}>Create product</Text>
                  <Ionicons name="add" size={18} color="#fff" />
                </>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Products({
  data,
  onSave,
}: {
  data: AdminDashboardData;
  onSave: (product: AdminProduct, patch: AdminProductPatch) => Promise<void>;
  onCreate: (product: NewAdminProduct) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<AdminProduct | null>(null);
  const [saving, setSaving] = useState(false);
  const products = useMemo(
    () =>
      data.products.filter((item) =>
        `${item.brand} ${item.name} ${item.id}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
      ),
    [data.products, query],
  );
  const save = async (patch: AdminProductPatch) => {
    if (!selected) return;
    setSaving(true);
    try {
      await onSave(selected, patch);
      setSelected(null);
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      <SectionHeader
        eyebrow="LIVE APP CONTROL"
        title="Product catalogue"
        detail="Update prices, stock and visibility across IPORDISE."
        action={
          <View style={styles.countBadge}>
            <Text style={styles.countValue}>{products.length}</Text>
            <Text style={styles.countLabel}>PRODUCTS</Text>
          </View>
        }
      />
      <View style={styles.toolbar}>
        <Ionicons name="search-outline" size={19} color="#6f6660" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search products or brands"
          placeholderTextColor="#9b918b"
          style={styles.toolbarInput}
        />
        <View style={styles.livePill}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE CATALOGUE</Text>
        </View>
      </View>
      <View style={styles.productAdminGrid}>
        {products.map((product) => (
          <View key={product.id} style={styles.productAdminCard}>
            <View style={styles.productAdminTop}>
              <Image
                source={{ uri: product.image }}
                resizeMode="contain"
                style={styles.productAdminImage}
              />
              <StatusPill value={product.active ? "active" : "inactive"} />
            </View>
            <Text style={styles.productAdminBrand}>{product.brand}</Text>
            <Text numberOfLines={2} style={styles.productAdminName}>
              {product.name}
            </Text>
            <View style={styles.productAdminMeta}>
              <View>
                <Text style={styles.metaLabel}>STOCK</Text>
                <Text style={styles.metaValue}>
                  {product.stock_left == null
                    ? "Unlimited"
                    : product.stock_left}
                </Text>
              </View>
              <View style={styles.metaDivider} />
              <View style={{ flex: 1 }}>
                <Text style={styles.metaLabel}>PRICES</Text>
                <Text numberOfLines={1} style={styles.metaValue}>
                  {Object.entries(product.sizes || {})
                    .filter(([, price]) => price > 0)
                    .map(([size, price]) => `${size.toUpperCase()} ${price}`)
                    .join(" · ") || "Needed"}
                </Text>
              </View>
            </View>
            <Pressable
              onPress={() => setSelected(product)}
              style={styles.manageButton}
            >
              <Text style={styles.manageButtonText}>Manage product</Text>
              <Ionicons name="options-outline" size={17} color="#fff" />
            </Pressable>
          </View>
        ))}
      </View>
      {!products.length ? (
        <EmptyState
          icon="search-outline"
          title="No matching products"
          text="Try a different product or brand name."
        />
      ) : null}
      <ProductEditor
        product={selected}
        visible={!!selected}
        saving={saving}
        onClose={() => setSelected(null)}
        onSave={save}
      />
    </>
  );
}

function VariantInventoryWorkspace({
  data,
  onSave,
}: {
  data: AdminDashboardData;
  onSave: (product: AdminProduct, patch: AdminProductPatch) => Promise<void>;
}) {
  const candidates = data.products.filter(
    (product) => Object.keys(product.sizes).length,
  );
  const [selectedId, setSelectedId] = useState(candidates[0]?.id || "");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const product =
    candidates.find((item) => item.id === selectedId) || candidates[0];
  const saveStock = async (size: string, value: string) => {
    if (!product) return;
    const stock = value.trim() === "" ? null : Number(value);
    if (stock !== null && (!Number.isInteger(stock) || stock < 0)) {
      setError(
        "Variant stock must be a non-negative whole number or blank for unlimited.",
      );
      return;
    }
    setError("");
    setBusy(size);
    try {
      await onSave(product, {
        name: product.name,
        brand: product.brand,
        image: product.image,
        description: product.description || null,
        sizes: product.sizes,
        original_prices: product.original_prices,
        stock_left: product.stock_left,
        active: product.active,
        variant_stocks: { ...product.variant_stocks, [size]: stock },
      });
    } finally {
      setBusy("");
    }
  };
  if (!product) return null;
  return (
    <View style={styles.homeEditor}>
      <SectionHeader
        eyebrow="VARIANT INVENTORY"
        title="Stock by size"
        detail="Each purchasable size has independent server-enforced stock."
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.homeSectionChips}
      >
        {candidates.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => setSelectedId(item.id)}
            style={[
              styles.homeSectionChip,
              product.id === item.id && styles.homeSectionChipActive,
            ]}
          >
            <Text
              numberOfLines={1}
              style={[
                styles.homeSectionChipText,
                product.id === item.id && styles.homeSectionChipTextActive,
              ]}
            >
              {item.brand} · {item.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      {Object.keys(product.sizes).map((size) => (
        <View
          key={`${product.id}:${size}:${product.variant_stocks[size]}`}
          style={styles.priceRow}
        >
          <View style={styles.sizeBadge}>
            <Text style={styles.sizeBadgeText}>{size.toUpperCase()}</Text>
          </View>
          <TextInput
            accessibilityLabel={`${size} stock`}
            defaultValue={
              product.variant_stocks[size] == null
                ? ""
                : String(product.variant_stocks[size])
            }
            editable={busy !== size}
            onEndEditing={(event) =>
              void saveStock(size, event.nativeEvent.text)
            }
            keyboardType="number-pad"
            placeholder="Unlimited"
            placeholderTextColor="#a29994"
            style={styles.priceInput}
          />
          {busy === size ? (
            <ActivityIndicator color={RED} size="small" />
          ) : (
            <Text style={styles.editorHelp}>{money(product.sizes[size])}</Text>
          )}
        </View>
      ))}
      {error ? (
        <Text accessibilityRole="alert" style={styles.editorError}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

function UnifiedProducts({
  data,
  onSave,
  onCreate,
}: {
  data: AdminDashboardData;
  onSave: (product: AdminProduct, patch: AdminProductPatch) => Promise<void>;
  onCreate: (product: NewAdminProduct) => Promise<void>;
}) {
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const create = async (product: NewAdminProduct) => {
    setSaving(true);
    try {
      await onCreate(product);
      setCreating(false);
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      <View style={{ alignItems: "flex-end", marginBottom: 12 }}>
        <Pressable
          accessibilityRole="button"
          onPress={() => setCreating(true)}
          style={styles.primaryButton}
        >
          <Text style={styles.primaryButtonText}>Add product</Text>
          <Ionicons name="add" size={18} color="#fff" />
        </Pressable>
      </View>
      <Products data={data} onSave={onSave} onCreate={onCreate} />
      <NewProductEditor
        visible={creating}
        saving={saving}
        onClose={() => setCreating(false)}
        onSave={create}
      />
    </>
  );
}

function Promotions({
  data,
  onSave,
}: {
  data: AdminDashboardData;
  onSave: (product: AdminProduct, patch: AdminProductPatch) => Promise<void>;
}) {
  const [selected, setSelected] = useState<AdminProduct | null>(null);
  const [saving, setSaving] = useState(false);
  const promoted = data.products.filter((product) =>
    Object.keys(product.original_prices || {}).some(
      (size) =>
        Number(product.original_prices[size]) > Number(product.sizes[size] || 0),
    ),
  );
  const save = async (patch: AdminProductPatch) => {
    if (!selected) return;
    setSaving(true);
    try {
      await onSave(selected, patch);
      setSelected(null);
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      <SectionHeader
        eyebrow="PRICING & OFFERS"
        title="Promotions"
        detail="Compare-at prices publish to both customer storefronts from the canonical catalogue."
        action={
          <View style={styles.countBadge}>
            <Text style={styles.countValue}>{promoted.length}</Text>
            <Text style={styles.countLabel}>ACTIVE</Text>
          </View>
        }
      />
      <View style={styles.orderList}>
        {promoted.map((product) => (
          <View key={product.id} style={styles.orderCard}>
            <View style={styles.orderCustomer}>
              <Image
                source={{ uri: product.image }}
                resizeMode="contain"
                style={styles.orderItemImage}
              />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={styles.customerName}>
                  {product.name}
                </Text>
                <Text numberOfLines={1} style={styles.customerMeta}>
                  {product.brand} · {Object.keys(product.original_prices).join(", ").toUpperCase()}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Edit promotion for ${product.name}`}
                onPress={() => setSelected(product)}
                style={styles.orderAdvance}
              >
                <Text style={styles.orderAdvanceText}>Edit offer</Text>
                <Ionicons name="create-outline" size={14} color="#fff" />
              </Pressable>
            </View>
          </View>
        ))}
      </View>
      {!promoted.length ? (
        <EmptyState
          icon="pricetag-outline"
          title="No active product promotions"
          text="Edit a product and add a compare-at price above its current price. Storefront hero offers remain in Manage App."
        />
      ) : null}
      <ProductEditor
        product={selected}
        visible={!!selected}
        saving={saving}
        onClose={() => setSelected(null)}
        onSave={save}
      />
    </>
  );
}

function Orders({
  data,
  onStatus,
  onShipping,
  onRemove,
}: {
  data: AdminDashboardData;
  onStatus: (order: AdminOrder, status: AdminOrder["status"]) => Promise<void>;
  onShipping: (order: AdminOrder, patch: AdminOrderShippingPatch) => Promise<void>;
  onRemove: (order: AdminOrder) => Promise<void>;
}) {
  const { compact } = useResponsiveLayout();
  const [filter, setFilter] = useState<"all" | AdminOrder["status"]>("all");
  const [busy, setBusy] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<AdminOrder | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<AdminOrder | null>(null);
  const [removeError, setRemoveError] = useState("");
  const [shippingDrafts, setShippingDrafts] = useState<Record<string, AdminOrderShippingPatch>>({});
  const orders = [
    ...data.orders.filter(
      (order) => filter === "all" || order.status === filter,
    ),
  ].sort(
    (a, b) =>
      b.risk_score - a.risk_score || b.created_at.localeCompare(a.created_at),
  );
  const update = async (order: AdminOrder, status: AdminOrder["status"]) => {
    setBusy(order.id);
    try {
      await onStatus(order, status);
    } finally {
      setBusy("");
    }
  };
  const remove = async (order: AdminOrder) => {
    setBusy(`remove:${order.id}`);
    setRemoveError("");
    try {
      await onRemove(order);
      setConfirmRemove(null);
    } catch (error) {
      setRemoveError(error instanceof Error ? error.message : "The order could not be removed.");
    } finally {
      setBusy("");
    }
  };
  const whatsapp = (order: AdminOrder) => {
    const phone = String(order.customer?.phone || "")
      .replace(/\D/g, "")
      .replace(/^0/, "212");
    if (phone)
      void Linking.openURL(
        `https://wa.me/${phone}?text=${encodeURIComponent(`Hello ${order.customer?.name || ""}, regarding your IPORDISE order ${order.order_number || ""}.`)}`,
      );
  };
  const shippingDraft = (order: AdminOrder): AdminOrderShippingPatch => shippingDrafts[order.id] || {
    courierCode: order.courier_code || "",
    courierName: order.courier_name || "",
    trackingNumber: order.tracking_number || "",
    trackingUrl: order.tracking_url || "",
    estimatedDelivery: order.estimated_delivery ? order.estimated_delivery.slice(0, 10) : "",
  };
  const setShippingField = (order: AdminOrder, field: keyof AdminOrderShippingPatch, value: string) => {
    setShippingDrafts(current => ({ ...current, [order.id]: { ...shippingDraft(order), ...current[order.id], [field]: value } }));
  };
  const saveShipping = async (order: AdminOrder) => {
    setBusy(`shipping:${order.id}`);
    try {
      await onShipping(order, shippingDraft(order));
      setShippingDrafts(current => {
        const next = { ...current };
        delete next[order.id];
        return next;
      });
    } finally {
      setBusy("");
    }
  };
  return (
    <>
      <SectionHeader
        eyebrow="ORDER OPERATIONS"
        title="Orders"
        detail="Confirm, fulfil and track every customer order. New orders refresh automatically."
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[
          styles.filterRow,
          compact && styles.filterRowMobile,
        ]}
      >
        {(["all", ...orderStatuses] as const).map((item) => (
          <Pressable
            key={item}
            onPress={() => setFilter(item)}
            style={[
              styles.filterChip,
              compact && styles.filterChipMobile,
              filter === item && styles.filterChipActive,
            ]}
          >
            <Text
              style={[
                styles.filterText,
                filter === item && styles.filterTextActive,
              ]}
            >
              {titleCase(item)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={styles.orderList}>
        {orders.map((order) => {
          const next = primaryOrderTransition[order.status] || null;
          const open = expanded === order.id;
          return (
            <View
              key={order.id}
              style={[styles.orderCard, compact && styles.orderCardMobile]}
            >
              <View style={styles.orderHead}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.orderNumber,
                      compact && styles.orderNumberMobile,
                    ]}
                  >
                    {order.order_number || "Awaiting order number"}
                  </Text>
                  <Text style={styles.orderDate}>
                    {shortDate(order.created_at)}
                  </Text>
                </View>
                <StatusPill value={order.status} />
              </View>
              <View
                style={[
                  styles.orderCustomer,
                  compact && styles.orderCustomerMobile,
                ]}
              >
                <View style={styles.customerAvatar}>
                  <Text style={styles.customerAvatarText}>
                    {(order.customer?.name || "C").slice(0, 1).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={styles.customerName}>
                    {order.customer?.name || "Customer"}
                  </Text>
                  <Text numberOfLines={1} style={styles.customerMeta}>
                    {order.customer?.city || "Morocco"} ·{" "}
                    {order.customer?.phone || "No phone"}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.orderTotal,
                    compact && styles.orderTotalMobile,
                  ]}
                >
                  {money(order.total, order.currency)}
                </Text>
              </View>
              {open ? (
                <View style={styles.orderDetails}>
                  <View style={styles.orderDetailGrid}>
                    <View style={styles.orderDetailBlock}>
                      <Text style={styles.metaLabel}>DELIVERY</Text>
                      <Text style={styles.orderDetailValue}>
                        {order.customer?.address || "No address provided"}
                      </Text>
                      <Text style={styles.orderDetailMeta}>
                        {order.customer?.city || "Morocco"}
                      </Text>
                    </View>
                    <View style={styles.orderDetailBlock}>
                      <Text style={styles.metaLabel}>CONTACT</Text>
                      <Text style={styles.orderDetailValue}>
                        {order.customer?.phone || "No phone"}
                      </Text>
                      <Text style={styles.orderDetailMeta}>
                        {order.customer?.email || "No email provided"}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.orderItems}>
                    {(order.items || []).map((item, index) => (
                      <View
                        key={`${item.productId || item.name}-${index}`}
                        style={styles.orderItemRow}
                      >
                        {item.image ? (
                          <Image
                            source={{ uri: item.image }}
                            resizeMode="contain"
                            style={styles.orderItemImage}
                          />
                        ) : (
                          <View style={styles.orderItemImagePlaceholder}>
                            <Ionicons
                              name="cube-outline"
                              size={16}
                              color="#766b65"
                            />
                          </View>
                        )}
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text numberOfLines={1} style={styles.orderItemName}>
                            {item.brand ? `${item.brand} · ` : ""}
                            {item.name || "Fragrance"}
                          </Text>
                          <Text style={styles.orderItemMeta}>
                            {String(item.size || "Selected size").toUpperCase()}{" "}
                            · Qty {item.quantity || 1}
                          </Text>
                        </View>
                        <Text style={styles.orderItemPrice}>
                          {money(
                            Number(item.lineTotal) ||
                              Number(item.unitPrice) *
                                Number(item.quantity || 1),
                            order.currency,
                          )}
                        </Text>
                      </View>
                    ))}
                  </View>
                  {order.notes ? (
                    <View style={styles.orderNote}>
                      <Ionicons name="create-outline" size={16} color={RED} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.metaLabel}>ORDER NOTE</Text>
                        <Text style={styles.orderDetailValue}>
                          {order.notes}
                        </Text>
                      </View>
                    </View>
                  ) : null}
                  <View style={styles.shippingEditor}>
                    <View style={styles.shippingEditorHead}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.metaLabel}>COURIER & TRACKING</Text>
                        <Text style={styles.orderDetailMeta}>These verified details appear on the customer&apos;s tracking page.</Text>
                      </View>
                      <Ionicons name="navigate-outline" size={18} color={RED} />
                    </View>
                    <View style={styles.shippingEditorGrid}>
                      <TextInput value={shippingDraft(order).courierName || ""} onChangeText={value => setShippingField(order, "courierName", value)} placeholder="Courier name" placeholderTextColor="#9b918b" style={styles.shippingInput} />
                      <TextInput value={shippingDraft(order).courierCode || ""} onChangeText={value => setShippingField(order, "courierCode", value)} placeholder="Courier code" placeholderTextColor="#9b918b" autoCapitalize="characters" style={styles.shippingInput} />
                      <TextInput value={shippingDraft(order).trackingNumber || ""} onChangeText={value => setShippingField(order, "trackingNumber", value)} placeholder="Tracking number" placeholderTextColor="#9b918b" autoCapitalize="characters" style={styles.shippingInput} />
                      <TextInput value={shippingDraft(order).trackingUrl || ""} onChangeText={value => setShippingField(order, "trackingUrl", value)} placeholder="Tracking URL (https://…)" placeholderTextColor="#9b918b" autoCapitalize="none" keyboardType="url" style={styles.shippingInput} />
                      <TextInput value={shippingDraft(order).estimatedDelivery || ""} onChangeText={value => setShippingField(order, "estimatedDelivery", value)} placeholder="Estimated delivery (YYYY-MM-DD)" placeholderTextColor="#9b918b" style={styles.shippingInput} />
                    </View>
                    <Pressable disabled={busy === `shipping:${order.id}`} onPress={() => void saveShipping(order)} style={styles.shippingSave}>
                      {busy === `shipping:${order.id}` ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.orderAdvanceText}>Save delivery details</Text>}
                    </Pressable>
                  </View>
                  <View style={styles.orderTotals}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.customerMeta}>Cash on delivery</Text>
                      <Text style={styles.customerMeta}>
                        Subtotal {money(order.subtotal, order.currency)} ·
                        Delivery {money(order.delivery_fee, order.currency)}
                      </Text>
                    </View>
                    <Text style={styles.orderTotal}>
                      {money(order.total, order.currency)}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="link"
                    disabled={!order.customer?.phone}
                    onPress={() => whatsapp(order)}
                    style={[
                      styles.orderWhatsapp,
                      compact && styles.orderWhatsappMobile,
                      !order.customer?.phone && styles.pressed,
                    ]}
                  >
                    <Ionicons name="logo-whatsapp" size={16} color="#fff" />
                    <Text style={styles.orderWhatsappText}>
                      Contact customer on WhatsApp
                    </Text>
                  </Pressable>
                </View>
              ) : null}
              <View
                style={[styles.orderFoot, compact && styles.orderFootMobile]}
              >
                <Pressable
                  onPress={() => setExpanded(open ? null : order.id)}
                  style={styles.orderDetailsToggle}
                >
                  <Ionicons
                    name={open ? "chevron-up" : "chevron-down"}
                    size={15}
                    color="#4e433e"
                  />
                  <Text style={styles.orderDetailsToggleText}>
                    {open ? "Hide details" : "View full order"}
                  </Text>
                </Pressable>
                <View
                  style={[
                    styles.orderActions,
                    compact && styles.orderActionsMobile,
                  ]}
                >
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove order ${order.order_number || order.id}`}
                    disabled={busy === `remove:${order.id}`}
                    onPress={() => { setRemoveError(""); setConfirmRemove(order); }}
                    style={[styles.orderRemove, compact && styles.orderCancelMobile]}
                  >
                    <Ionicons name="trash-outline" size={14} color={RED} />
                    <Text style={styles.orderRemoveText}>Remove</Text>
                  </Pressable>
                  {(["pending", "confirmed", "processing", "ready_for_dispatch"] as AdminOrder["status"][]).includes(order.status) ? (
                    <Pressable
                      disabled={busy === order.id}
                      onPress={() => setConfirmCancel(order)}
                      style={[
                        styles.orderCancel,
                        compact && styles.orderCancelMobile,
                      ]}
                    >
                      <Text style={styles.orderCancelText}>Cancel</Text>
                    </Pressable>
                  ) : null}
                  {(["shipped", "out_for_delivery"] as AdminOrder["status"][]).includes(order.status) ? (
                    <Pressable disabled={busy === order.id} onPress={() => update(order, "delivery_failed")} style={[styles.orderCancel, compact && styles.orderCancelMobile]}>
                      <Text style={styles.orderCancelText}>Delivery issue</Text>
                    </Pressable>
                  ) : null}
                  {next ? (
                    <Pressable
                      disabled={busy === order.id}
                      onPress={() => update(order, next)}
                      style={[
                        styles.orderAdvance,
                        compact && styles.orderAdvanceMobile,
                      ]}
                    >
                      {busy === order.id ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <>
                          <Text style={styles.orderAdvanceText}>
                            Mark {titleCase(next)}
                          </Text>
                          <Ionicons
                            name="arrow-forward"
                            size={14}
                            color="#fff"
                          />
                        </>
                      )}
                    </Pressable>
                  ) : null}
                </View>
              </View>
            </View>
          );
        })}
      </View>
      {!orders.length ? (
        <EmptyState
          icon="receipt-outline"
          title="No orders here"
          text="Orders matching this status will appear here."
        />
      ) : null}
      <Modal visible={!!confirmCancel} transparent animationType="fade" onRequestClose={() => setConfirmCancel(null)}>
        <View style={styles.confirmBackdrop}>
          <View style={styles.confirmDialog}>
            <View style={styles.confirmIcon}><Ionicons name="warning-outline" size={24} color={RED} /></View>
            <Text style={styles.confirmTitle}>Cancel this order?</Text>
            <Text style={styles.confirmText}>This changes the customer-visible status for {confirmCancel?.order_number || "this order"}. It does not delete the audit history.</Text>
            <View style={styles.confirmActions}>
              <Pressable accessibilityRole="button" onPress={() => setConfirmCancel(null)} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Keep order</Text></Pressable>
              <Pressable accessibilityRole="button" disabled={!confirmCancel || busy === confirmCancel?.id} onPress={() => { const order=confirmCancel; if(!order)return; setConfirmCancel(null); void update(order,"cancelled"); }} style={styles.dangerButton}><Text style={styles.primaryButtonText}>Cancel order</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <Modal visible={!!confirmRemove} transparent animationType="fade" onRequestClose={() => busy ? undefined : setConfirmRemove(null)}>
        <View style={styles.confirmBackdrop}>
          <View style={styles.confirmDialog}>
            <View style={styles.confirmIcon}><Ionicons name="trash-outline" size={24} color={RED} /></View>
            <Text style={styles.confirmTitle}>Permanently remove this order?</Text>
            <Text style={styles.confirmText}>{confirmRemove?.order_number || "This order"} will disappear from All Orders and customer tracking. This cannot be undone.</Text>
            {removeError ? <Text style={styles.confirmError}>{removeError}</Text> : null}
            <View style={styles.confirmActions}>
              <Pressable accessibilityRole="button" disabled={!!busy} onPress={() => setConfirmRemove(null)} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Keep order</Text></Pressable>
              <Pressable accessibilityRole="button" disabled={!confirmRemove || !!busy} onPress={() => confirmRemove ? void remove(confirmRemove) : undefined} style={styles.dangerButton}>
                {busy === `remove:${confirmRemove?.id}` ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.primaryButtonText}>Remove permanently</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

function Customers({ data }: { data: AdminDashboardData }) {
  const [query, setQuery] = useState("");
  const customers = data.customers.filter((customer) => {
    const profile = customer.profile || {};
    return `${profile.firstName || ""} ${profile.lastName || ""} ${profile.displayName || ""} ${profile.email || ""} ${profile.phone || ""} ${profile.city || ""}`
      .toLowerCase()
      .includes(query.trim().toLowerCase());
  });
  return (
    <>
      <SectionHeader
        eyebrow="CUSTOMER DIRECTORY"
        title="Customers"
        detail="Registered customer profiles and their canonical order counts."
        action={
          <View style={styles.countBadge}>
            <Text style={styles.countValue}>{customers.length}</Text>
            <Text style={styles.countLabel}>CUSTOMERS</Text>
          </View>
        }
      />
      <View style={styles.toolbar}>
        <Ionicons name="search-outline" size={19} color="#6f6660" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search name, email, phone or city"
          placeholderTextColor="#9b918b"
          style={styles.toolbarInput}
        />
      </View>
      <View style={styles.orderList}>
        {customers.map((customer) => {
          const profile = customer.profile || {};
          const name =
            [profile.firstName, profile.lastName].filter(Boolean).join(" ") ||
            profile.displayName ||
            "Customer";
          return (
            <View key={customer.uid} style={styles.orderCard}>
              <View style={styles.orderCustomer}>
                <View style={styles.customerAvatar}>
                  <Text style={styles.customerAvatarText}>
                    {name.slice(0, 1).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={styles.customerName}>
                    {name}
                  </Text>
                  <Text numberOfLines={1} style={styles.customerMeta}>
                    {profile.email || "No email"} ·{" "}
                    {profile.phone || "No phone"}
                  </Text>
                  <Text style={styles.customerMeta}>
                    {profile.city || "No city"} · Joined{" "}
                    {shortDate(customer.createdAt)}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.orderTotal}>{customer.orderCount}</Text>
                  <Text style={styles.metaLabel}>ORDERS</Text>
                </View>
              </View>
            </View>
          );
        })}
      </View>
      {!customers.length ? (
        <EmptyState
          icon="people-outline"
          title="No customers found"
          text={
            query
              ? "Try a different search."
              : "Registered customers will appear here."
          }
        />
      ) : null}
    </>
  );
}

function Support({
  session,
  data,
  onUpdate,
  onReply,
}: {
  session: AdminSession;
  data: AdminDashboardData;
  onUpdate: (
    conversation: AdminConversation,
    patch: Pick<AdminConversation, "status" | "priority">,
  ) => Promise<void>;
  onReply: (
    conversation: AdminConversation,
    message: string,
  ) => Promise<AdminSupportThread>;
}) {
  const [busy, setBusy] = useState("");
  const [expanded, setExpanded] = useState("");
  const [thread, setThread] = useState<AdminSupportThread | null>(null);
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");
  const update = async (
    item: AdminConversation,
    patch: Pick<AdminConversation, "status" | "priority">,
  ) => {
    setBusy(item.id);
    setError("");
    try {
      await onUpdate(item, patch);
      if (thread?.id === item.id)
        setThread((current) =>
          current ? { ...current, status: patch.status } : current,
        );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "The conversation could not be updated.",
      );
    } finally {
      setBusy("");
    }
  };
  const open = async (item: AdminConversation) => {
    if (expanded === item.id) {
      setExpanded("");
      setThread(null);
      setError("");
      return;
    }
    setExpanded(item.id);
    setThread(null);
    setReply("");
    setError("");
    setBusy(item.id);
    try {
      setThread(await loadAdminSupportThread(session, item));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "The conversation could not be loaded.",
      );
    } finally {
      setBusy("");
    }
  };
  const send = async (item: AdminConversation) => {
    setBusy(item.id);
    setError("");
    try {
      setThread(await onReply(item, reply));
      setReply("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "The reply could not be sent.",
      );
    } finally {
      setBusy("");
    }
  };
  const emailReply = (item: AdminConversation) => {
    const url = `mailto:${item.customer_email}?subject=${encodeURIComponent(`Re: ${item.subject}`)}&body=${encodeURIComponent(reply.trim())}`;
    void Linking.openURL(url);
  };
  return (
    <>
      <SectionHeader
        eyebrow="IPORDISE CARE"
        title="Client conversations"
        detail="Read every request, reply directly in the app, and keep follow-up organised."
      />
      <View style={styles.supportAdminList}>
        {data.conversations.map((item) => {
          const isOpen = expanded === item.id;
          return (
            <View key={item.id} style={styles.supportAdminCard}>
              <View style={styles.supportAdminSummary}>
                <View style={styles.supportAdminIcon}>
                  <Ionicons
                    name="chatbubble-ellipses-outline"
                    size={20}
                    color={RED}
                  />
                </View>
                <View style={styles.supportAdminCopy}>
                  <View style={styles.supportTitleRow}>
                    <Text numberOfLines={1} style={styles.supportSubject}>
                      {item.subject}
                    </Text>
                    <StatusPill value={item.priority} />
                  </View>
                  <Text numberOfLines={1} style={styles.supportCustomer}>
                    {item.customer_name} · {item.customer_email}
                  </Text>
                  <Text style={styles.supportTime}>
                    Last activity {shortDate(item.last_message_at)}
                    {item.order_number ? ` · ${item.order_number}` : ""} ·{" "}
                    {item.has_app_thread ? "App chat" : "Website email"}
                  </Text>
                  <View style={styles.supportActions}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ expanded: isOpen }}
                      onPress={() => void open(item)}
                      style={styles.openConversationButton}
                    >
                      <Ionicons
                        name={isOpen ? "chevron-up" : "chatbox-outline"}
                        size={14}
                        color="#fff"
                      />
                      <Text style={styles.openConversationText}>
                        {isOpen ? "Close" : "Open conversation"}
                      </Text>
                    </Pressable>
                    <StatusPill value={item.status} />
                    {item.status !== "resolved" && item.status !== "closed" ? (
                      <Pressable
                        disabled={busy === item.id}
                        onPress={() =>
                          void update(item, {
                            status: "resolved",
                            priority: item.priority,
                          })
                        }
                        style={styles.resolveButton}
                      >
                        <Ionicons name="checkmark" size={14} color="#176b43" />
                        <Text style={styles.resolveText}>Resolve</Text>
                      </Pressable>
                    ) : null}
                    {item.priority !== "urgent" ? (
                      <Pressable
                        disabled={busy === item.id}
                        onPress={() =>
                          void update(item, {
                            status: item.status,
                            priority: "urgent",
                          })
                        }
                        style={styles.urgentButton}
                      >
                        <Text style={styles.urgentText}>Mark urgent</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              </View>
              {isOpen ? (
                <View style={styles.supportThreadPanel}>
                  {busy === item.id && !thread ? (
                    <ActivityIndicator color={RED} />
                  ) : null}
                  {thread?.messages.map((message) => (
                    <View
                      key={message.id}
                      style={[
                        styles.adminMessageBubble,
                        message.senderType === "staff" &&
                          styles.adminMessageStaff,
                      ]}
                    >
                      <Text style={styles.adminMessageSender}>
                        {message.senderType === "staff"
                          ? "IPORDISE CARE"
                          : "CUSTOMER"}
                      </Text>
                      <Text style={styles.adminMessageBody}>
                        {message.body}
                      </Text>
                      <Text style={styles.adminMessageTime}>
                        {new Date(message.createdAt).toLocaleString()}
                      </Text>
                    </View>
                  ))}
                  {error ? (
                    <Text accessibilityRole="alert" style={styles.editorError}>
                      {error}
                    </Text>
                  ) : null}
                  <View style={styles.adminReplyComposer}>
                    <TextInput
                      accessibilityLabel="Reply to customer"
                      multiline
                      value={reply}
                      onChangeText={setReply}
                      placeholder={
                        item.has_app_thread
                          ? "Write a reply that will appear in the customer app…"
                          : "Write your email reply…"
                      }
                      placeholderTextColor="#91867f"
                      style={styles.adminReplyInput}
                    />
                    <Pressable
                      accessibilityRole="button"
                      disabled={
                        busy === item.id ||
                        !reply.trim() ||
                        (!item.customer_email && !item.has_app_thread)
                      }
                      onPress={() =>
                        item.has_app_thread ? void send(item) : emailReply(item)
                      }
                      style={[
                        styles.adminReplyButton,
                        (busy === item.id || !reply.trim()) && styles.pressed,
                      ]}
                    >
                      {busy === item.id ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Ionicons
                          name={item.has_app_thread ? "send" : "mail-outline"}
                          size={17}
                          color="#fff"
                        />
                      )}
                      <Text style={styles.adminReplyButtonText}>
                        {item.has_app_thread
                          ? "Send to app"
                          : "Open email reply"}
                      </Text>
                    </Pressable>
                  </View>
                  {!item.has_app_thread ? (
                    <Text style={styles.supportLegacyNote}>
                      This request came from ipordise.com. The email button
                      opens your mail app with this reply ready to send.
                    </Text>
                  ) : (
                    <Text style={styles.supportLegacyNote}>
                      The customer will see this reply automatically in their
                      private app conversation.
                    </Text>
                  )}
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
      {!data.conversations.length ? (
        <EmptyState
          icon="chatbubbles-outline"
          title="Inbox is clear"
          text="New customer conversations will appear here."
        />
      ) : null}
    </>
  );
}

function LegacyHomeSettings({
  session,
  data,
  onSave,
}: {
  session: AdminSession;
  data: AdminDashboardData;
  onSave: (config: HomeConfig, offers: OfferHeroConfig) => Promise<void>;
}) {
  const [draft, setDraft] = useState(() =>
    normalizeHomeConfig({ homepage: data.settings.homepage }, true),
  );
  const offerDraft = normalizeOfferHero(data.settings.offers);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const save = async () => {
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      await onSave(draft, offerDraft);
      setSaved(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Storefront settings could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  };
  const updateSlide = (
    id: string,
    patch: Partial<HomeConfig["heroSlides"][number]>,
  ) =>
    setDraft((current) => ({
      ...current,
      heroSlides: current.heroSlides.map((slide) =>
        slide.id === id ? { ...slide, ...patch } : slide,
      ),
    }));
  return (
    <>
      <SectionHeader
        eyebrow="SYSTEM & ACCESS"
        title="Dashboard settings"
        detail="Connection, permissions, catalogue, and live homepage content."
      />
      <View style={styles.settingsGrid}>
        <View style={styles.settingCard}>
          <View style={styles.settingIcon}>
            <Ionicons
              name="shield-checkmark-outline"
              size={21}
              color="#176b43"
            />
          </View>
          <Text style={styles.settingLabel}>SIGNED IN AS</Text>
          <Text style={styles.settingValue}>{session.user.email}</Text>
          <Text style={styles.settingHelp}>
            Active {session.role} role · server verified
          </Text>
        </View>
        <View style={styles.settingCard}>
          <View style={styles.settingIcon}>
            <Ionicons name="cloud-done-outline" size={21} color="#176b43" />
          </View>
          <Text style={styles.settingLabel}>APP CATALOGUE</Text>
          <Text style={styles.settingValue}>
            {data.products.filter((item) => item.active).length} products live
          </Text>
          <Text style={styles.settingHelp}>
            Prices are rechecked during checkout
          </Text>
        </View>
        <View style={styles.settingCard}>
          <View style={styles.settingIcon}>
            <Ionicons name="globe-outline" size={21} color="#176b43" />
          </View>
          <Text style={styles.settingLabel}>STOREFRONT</Text>
          <Text style={styles.settingValue}>ipordise.com</Text>
          <Text style={styles.settingHelp}>
            Morocco · MAD · protected operations
          </Text>
        </View>
      </View>
      <View style={styles.homeEditor}>
        <SectionHeader
          eyebrow="LIVE HOMEPAGE CONTROL"
          title="Home campaigns"
          detail="Edit announcement messages, campaign copy, destinations, images, schedules, order, and visibility."
        />
        <Text style={styles.fieldLabel}>ROTATING BENEFITS · ONE PER LINE</Text>
        <TextInput
          multiline
          value={draft.announcements.join("\n")}
          onChangeText={(value) =>
            setDraft((current) => ({
              ...current,
              announcements: value.split("\n").filter(Boolean),
            }))
          }
          style={[styles.editorInput, styles.homeMultiline]}
        />
        <Text style={styles.fieldLabel}>SECTION VISIBILITY</Text>
        <View style={styles.homeSectionChips}>
          {draft.sectionOrder.map((section) => {
            const visible = !draft.hiddenSections.includes(section);
            return (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: visible }}
                key={section}
                onPress={() =>
                  setDraft((current) => ({
                    ...current,
                    hiddenSections: visible
                      ? [...current.hiddenSections, section]
                      : current.hiddenSections.filter(
                          (item) => item !== section,
                        ),
                  }))
                }
                style={[
                  styles.homeSectionChip,
                  visible && styles.homeSectionChipActive,
                ]}
              >
                <Ionicons
                  name={visible ? "eye-outline" : "eye-off-outline"}
                  size={14}
                  color={visible ? "#fff" : "#776c66"}
                />
                <Text
                  style={[
                    styles.homeSectionChipText,
                    visible && styles.homeSectionChipTextActive,
                  ]}
                >
                  {section.replaceAll("-", " ")}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {draft.heroSlides.map((slide) => (
          <View key={slide.id} style={styles.homeSlideCard}>
            <View style={styles.homeSlideHead}>
              <View>
                <Text style={styles.panelEyebrow}>
                  CAMPAIGN {String(slide.order).padStart(2, "0")}
                </Text>
                <Text style={styles.panelTitle}>{slide.headline}</Text>
              </View>
              <Pressable
                accessibilityRole="switch"
                accessibilityState={{ checked: slide.active }}
                onPress={() => updateSlide(slide.id, { active: !slide.active })}
                style={[styles.toggle, slide.active && styles.toggleActive]}
              >
                <View
                  style={[
                    styles.toggleKnob,
                    slide.active && styles.toggleKnobActive,
                  ]}
                />
              </Pressable>
            </View>
            <Text style={styles.fieldLabel}>EYEBROW</Text>
            <TextInput
              value={slide.eyebrow}
              onChangeText={(value) =>
                updateSlide(slide.id, { eyebrow: value })
              }
              style={styles.editorInput}
            />
            <Text style={styles.fieldLabel}>HEADLINE</Text>
            <TextInput
              value={slide.headline}
              onChangeText={(value) =>
                updateSlide(slide.id, { headline: value })
              }
              style={styles.editorInput}
            />
            <Text style={styles.fieldLabel}>DESCRIPTION</Text>
            <TextInput
              value={slide.description}
              onChangeText={(value) =>
                updateSlide(slide.id, { description: value })
              }
              style={styles.editorInput}
            />
            <View style={styles.homeFieldRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>CTA LABEL</Text>
                <TextInput
                  value={slide.ctaLabel}
                  onChangeText={(value) =>
                    updateSlide(slide.id, { ctaLabel: value })
                  }
                  style={styles.editorInput}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>DESTINATION</Text>
                <TextInput
                  value={slide.destination}
                  onChangeText={(value) =>
                    updateSlide(slide.id, { destination: value })
                  }
                  style={styles.editorInput}
                />
              </View>
            </View>
            <Text style={styles.fieldLabel}>MOBILE IMAGE URL · OPTIONAL</Text>
            <TextInput
              autoCapitalize="none"
              value={slide.imageUrl || ""}
              onChangeText={(value) =>
                updateSlide(slide.id, { imageUrl: value || undefined })
              }
              style={styles.editorInput}
            />
            <Text style={styles.fieldLabel}>TABLET IMAGE URL · OPTIONAL</Text>
            <TextInput
              autoCapitalize="none"
              value={slide.tabletImageUrl || ""}
              onChangeText={(value) =>
                updateSlide(slide.id, { tabletImageUrl: value || undefined })
              }
              style={styles.editorInput}
            />
            <View style={styles.homeFieldRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>START DATE · ISO</Text>
                <TextInput
                  value={slide.startsAt || ""}
                  onChangeText={(value) =>
                    updateSlide(slide.id, { startsAt: value || undefined })
                  }
                  style={styles.editorInput}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>END DATE · ISO</Text>
                <TextInput
                  value={slide.endsAt || ""}
                  onChangeText={(value) =>
                    updateSlide(slide.id, { endsAt: value || undefined })
                  }
                  style={styles.editorInput}
                />
              </View>
            </View>
          </View>
        ))}
        {error ? (
          <Text accessibilityRole="alert" style={styles.editorError}>
            {error}
          </Text>
        ) : saved ? (
          <Text accessibilityRole="alert" style={styles.homeSaved}>
            Homepage configuration published.
          </Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          disabled={saving}
          onPress={save}
          style={[
            styles.primaryButton,
            styles.homeSave,
            saving && styles.pressed,
          ]}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.primaryButtonText}>PUBLISH HOMEPAGE</Text>
              <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
            </>
          )}
        </Pressable>
      </View>
      <View style={styles.securityPanel}>
        <Ionicons name="information-circle-outline" size={21} color={RED} />
        <View style={{ flex: 1 }}>
          <Text style={styles.securityTitle}>Production configuration</Text>
          <Text style={styles.securityText}>
            Homepage content is stored in the existing protected store settings
            document. Never place service-role keys in the app.
          </Text>
        </View>
      </View>
    </>
  );
}

function StorefrontSettings({
  session,
  data,
  onSave,
}: {
  session: AdminSession;
  data: AdminDashboardData;
  onSave: (config: HomeConfig, offers: OfferHeroConfig) => Promise<void>;
}) {
  const [offer, setOffer] = useState(() =>
    normalizeOfferHero(data.settings.offers),
  );
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const update = (patch: Partial<OfferHeroConfig>) =>
    setOffer((current) => ({ ...current, ...patch }));
  const publish = async () => {
    setSaving(true);
    setStatus("");
    try {
      await onSave(
        normalizeHomeConfig({ homepage: data.settings.homepage }, true),
        offer,
      );
      setStatus("Offers campaign published.");
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Offers campaign could not be published.",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      <LegacyHomeSettings
        session={session}
        data={data}
        onSave={(homepage) => onSave(homepage, offer)}
      />
      <View style={styles.homeEditor}>
        <SectionHeader
          eyebrow="LIVE OFFERS CONTROL"
          title="Offers campaign"
          detail="Manage the campaign image, copy, destination, visibility, and real schedule."
        />
        <View style={styles.homeSlideCard}>
          <View style={styles.homeSlideHead}>
            <View>
              <Text style={styles.panelEyebrow}>PROMOTIONAL HERO</Text>
              <Text style={styles.panelTitle}>{offer.heading}</Text>
            </View>
            <Pressable
              accessibilityRole="switch"
              accessibilityState={{ checked: offer.active }}
              onPress={() => update({ active: !offer.active })}
              style={[styles.toggle, offer.active && styles.toggleActive]}
            >
              <View
                style={[
                  styles.toggleKnob,
                  offer.active && styles.toggleKnobActive,
                ]}
              />
            </Pressable>
          </View>
          <Text style={styles.fieldLabel}>EYEBROW</Text>
          <TextInput
            value={offer.eyebrow}
            onChangeText={(eyebrow) => update({ eyebrow })}
            style={styles.editorInput}
          />
          <Text style={styles.fieldLabel}>HEADING</Text>
          <TextInput
            value={offer.heading}
            onChangeText={(heading) => update({ heading })}
            style={styles.editorInput}
          />
          <Text style={styles.fieldLabel}>DESCRIPTION</Text>
          <TextInput
            value={offer.description}
            onChangeText={(description) => update({ description })}
            style={styles.editorInput}
          />
          <View style={styles.homeFieldRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>CTA LABEL</Text>
              <TextInput
                value={offer.ctaLabel}
                onChangeText={(ctaLabel) => update({ ctaLabel })}
                style={styles.editorInput}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>DESTINATION</Text>
              <TextInput
                value={offer.destination}
                onChangeText={(destination) => update({ destination })}
                style={styles.editorInput}
              />
            </View>
          </View>
          <Text style={styles.fieldLabel}>BACKGROUND IMAGE URL</Text>
          <TextInput
            autoCapitalize="none"
            value={offer.backgroundImage}
            onChangeText={(backgroundImage) => update({ backgroundImage })}
            style={styles.editorInput}
          />
          <View style={styles.homeFieldRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>MOBILE IMAGE URL</Text>
              <TextInput
                autoCapitalize="none"
                value={offer.mobileImage}
                onChangeText={(mobileImage) => update({ mobileImage })}
                style={styles.editorInput}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>TABLET IMAGE URL</Text>
              <TextInput
                autoCapitalize="none"
                value={offer.tabletImage}
                onChangeText={(tabletImage) => update({ tabletImage })}
                style={styles.editorInput}
              />
            </View>
          </View>
          <View style={styles.homeFieldRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>START DATE · ISO</Text>
              <TextInput
                value={offer.startsAt}
                onChangeText={(startsAt) => update({ startsAt })}
                style={styles.editorInput}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>END DATE · ISO</Text>
              <TextInput
                value={offer.endsAt}
                onChangeText={(endsAt) => update({ endsAt })}
                style={styles.editorInput}
              />
            </View>
          </View>
        </View>
        {status ? (
          <Text
            accessibilityRole="alert"
            style={
              status.includes("published")
                ? styles.homeSaved
                : styles.editorError
            }
          >
            {status}
          </Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          disabled={saving}
          onPress={publish}
          style={[
            styles.primaryButton,
            styles.homeSave,
            saving && styles.pressed,
          ]}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.primaryButtonText}>
                PUBLISH OFFERS CAMPAIGN
              </Text>
              <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
            </>
          )}
        </Pressable>
      </View>
    </>
  );
}

function ShopSettings({
  data,
  onSave,
}: {
  data: AdminDashboardData;
  onSave: (shop: ShopConfig) => Promise<void>;
}) {
  const [shop, setShop] = useState(() =>
    normalizeShopConfig(data.settings.shop, true),
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const banner = (patch: Partial<ShopConfig["banner"]>) =>
    setShop((current) => ({
      ...current,
      banner: { ...current.banner, ...patch },
    }));
  const serialize = (items: ShopLink[]) =>
    items
      .map((item) =>
        [
          item.id,
          item.label,
          item.description,
          item.filter || item.query || "",
          item.icon,
          item.order,
          item.active ? "visible" : "hidden",
        ].join("|"),
      )
      .join("\n");
  const parse = (value: string, current: ShopLink[]) =>
    value
      .split("\n")
      .map((line) => line.split("|"))
      .filter((parts) => parts.length >= 4)
      .map((parts, index) => ({
        id: parts[0].trim() || current[index]?.id || `item-${index + 1}`,
        label: parts[1].trim(),
        description: parts[2].trim(),
        filter: parts[3].trim(),
        icon: parts[4]?.trim() || "arrow-forward-outline",
        order: Number(parts[5]) || index + 1,
        active: parts[6]?.trim() !== "hidden",
      }));
  const publish = async () => {
    setSaving(true);
    setMessage("");
    try {
      await onSave(shop);
      setMessage("Shop configuration published.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Shop settings could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <View style={styles.homeEditor}>
      <SectionHeader
        eyebrow="LIVE SHOP CONTROL"
        title="Shop discovery hub"
        detail="Control campaign content, category metadata, visibility, order, brands, families, collections, images, filters, and schedule."
      />
      <View style={styles.homeSlideCard}>
        <View style={styles.homeSlideHead}>
          <Text style={styles.panelTitle}>{shop.banner.headline}</Text>
          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: shop.banner.active }}
            onPress={() => banner({ active: !shop.banner.active })}
            style={[styles.toggle, shop.banner.active && styles.toggleActive]}
          >
            <View
              style={[
                styles.toggleKnob,
                shop.banner.active && styles.toggleKnobActive,
              ]}
            />
          </Pressable>
        </View>
        <Text style={styles.fieldLabel}>EYEBROW</Text>
        <TextInput
          value={shop.banner.eyebrow}
          onChangeText={(eyebrow) => banner({ eyebrow })}
          style={styles.editorInput}
        />
        <Text style={styles.fieldLabel}>HEADING</Text>
        <TextInput
          value={shop.banner.headline}
          onChangeText={(headline) => banner({ headline })}
          style={styles.editorInput}
        />
        <Text style={styles.fieldLabel}>DESCRIPTION</Text>
        <TextInput
          value={shop.banner.description}
          onChangeText={(description) => banner({ description })}
          style={styles.editorInput}
        />
        <View style={styles.homeFieldRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>CTA LABEL</Text>
            <TextInput
              value={shop.banner.ctaLabel}
              onChangeText={(ctaLabel) => banner({ ctaLabel })}
              style={styles.editorInput}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>FILTER</Text>
            <TextInput
              value={shop.banner.filter}
              onChangeText={(filter) => banner({ filter })}
              style={styles.editorInput}
            />
          </View>
        </View>
        <View style={styles.homeFieldRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>PHONE IMAGE URL</Text>
            <TextInput
              value={shop.banner.imageUrl || ""}
              onChangeText={(imageUrl) =>
                banner({ imageUrl: imageUrl || undefined })
              }
              style={styles.editorInput}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>TABLET IMAGE URL</Text>
            <TextInput
              value={shop.banner.tabletImageUrl || ""}
              onChangeText={(tabletImageUrl) =>
                banner({ tabletImageUrl: tabletImageUrl || undefined })
              }
              style={styles.editorInput}
            />
          </View>
        </View>
        <View style={styles.homeFieldRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>START DATE · ISO</Text>
            <TextInput
              value={shop.banner.startsAt || ""}
              onChangeText={(startsAt) =>
                banner({ startsAt: startsAt || undefined })
              }
              style={styles.editorInput}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>END DATE · ISO</Text>
            <TextInput
              value={shop.banner.endsAt || ""}
              onChangeText={(endsAt) => banner({ endsAt: endsAt || undefined })}
              style={styles.editorInput}
            />
          </View>
        </View>
      </View>
      {(
        [
          ["QUICK LINKS", "quickLinks"],
          ["CATEGORIES", "categories"],
          ["COLLECTIONS", "collections"],
        ] as const
      ).map(([label, key]) => (
        <View key={key}>
          <Text style={styles.fieldLabel}>
            {label} · ID | NAME | DESCRIPTION | FILTER | ICON | ORDER |
            VISIBLE/HIDDEN
          </Text>
          <TextInput
            multiline
            value={serialize(shop[key])}
            onChangeText={(value) =>
              setShop((current) => ({
                ...current,
                [key]: parse(value, current[key]),
              }))
            }
            style={[
              styles.editorInput,
              key === "categories"
                ? { height: 180, paddingTop: 12, textAlignVertical: "top" }
                : styles.homeMultiline,
            ]}
          />
        </View>
      ))}
      <Text style={styles.fieldLabel}>
        FRAGRANCE FAMILY ORDER · ONE PER LINE
      </Text>
      <TextInput
        multiline
        value={shop.familyOrder.join("\n")}
        onChangeText={(value) =>
          setShop((current) => ({
            ...current,
            familyOrder: value
              .split("\n")
              .map((item) => item.trim())
              .filter(Boolean),
          }))
        }
        style={[styles.editorInput, styles.homeMultiline]}
      />
      <Text style={styles.fieldLabel}>
        FEATURED BRANDS · EXACT CATALOGUE NAMES, ONE PER LINE
      </Text>
      <TextInput
        multiline
        value={shop.featuredBrands.join("\n")}
        onChangeText={(value) =>
          setShop((current) => ({
            ...current,
            featuredBrands: value
              .split("\n")
              .map((item) => item.trim())
              .filter(Boolean),
          }))
        }
        style={[styles.editorInput, styles.homeMultiline]}
      />
      {message ? (
        <Text
          accessibilityRole="alert"
          style={
            message.includes("published")
              ? styles.homeSaved
              : styles.editorError
          }
        >
          {message}
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        disabled={saving}
        onPress={publish}
        style={[
          styles.primaryButton,
          styles.homeSave,
          saving && styles.pressed,
        ]}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Text style={styles.primaryButtonText}>PUBLISH SHOP HUB</Text>
            <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
          </>
        )}
      </Pressable>
    </View>
  );
}

function SettingsBase({
  session,
  data,
  onSave,
  onSaveHelp,
}: {
  session: AdminSession;
  data: AdminDashboardData;
  onSave: (config: HomeConfig, offers: OfferHeroConfig) => Promise<void>;
  onSaveHelp: (help: HelpConfig) => Promise<void>;
}) {
  const [help, setHelp] = useState(() =>
    normalizeHelpConfig(data.settings.help),
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const updateContact = (key: keyof HelpConfig["contacts"], value: string) =>
    setHelp((current) => ({
      ...current,
      contacts: { ...current.contacts, [key]: value },
    }));
  const publish = async () => {
    setSaving(true);
    setMessage("");
    try {
      await onSaveHelp(help);
      setMessage("Help Centre configuration published.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Help Centre settings could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      <StorefrontSettings session={session} data={data} onSave={onSave} />
      <View style={styles.homeEditor}>
        <SectionHeader
          eyebrow="LIVE CUSTOMER CARE CONTROL"
          title="Help Centre"
          detail="Manage truthful availability, contact channels, FAQs, policies, and featured topics."
        />
        <Text style={styles.fieldLabel}>AVAILABILITY OVERRIDE</Text>
        <View style={styles.homeSectionChips}>
          {(["auto", "online", "offline"] as const).map((value) => (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{
                checked: help.availabilityOverride === value,
              }}
              key={value}
              onPress={() =>
                setHelp((current) => ({
                  ...current,
                  availabilityOverride: value,
                }))
              }
              style={[
                styles.homeSectionChip,
                help.availabilityOverride === value &&
                  styles.homeSectionChipActive,
              ]}
            >
              <Text
                style={[
                  styles.homeSectionChipText,
                  help.availabilityOverride === value &&
                    styles.homeSectionChipTextActive,
                ]}
              >
                {value}
              </Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: help.temporaryClosure }}
          onPress={() =>
            setHelp((current) => ({
              ...current,
              temporaryClosure: !current.temporaryClosure,
            }))
          }
          style={styles.editorToggleRow}
        >
          <View>
            <Text style={styles.fieldLabel}>TEMPORARY CLOSURE</Text>
            <Text style={styles.editorHelp}>
              Immediately displays the unavailable support state.
            </Text>
          </View>
          <View
            style={[
              styles.toggle,
              help.temporaryClosure && styles.toggleActive,
            ]}
          >
            <View
              style={[
                styles.toggleKnob,
                help.temporaryClosure && styles.toggleKnobActive,
              ]}
            />
          </View>
        </Pressable>
        <Text style={styles.fieldLabel}>EXPECTED RESPONSE · OPTIONAL</Text>
        <TextInput
          value={help.expectedResponse}
          onChangeText={(expectedResponse) =>
            setHelp((current) => ({ ...current, expectedResponse }))
          }
          placeholder="Only enter an operationally accurate response time"
          style={styles.editorInput}
        />
        <View style={styles.homeFieldRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>WHATSAPP NUMBER</Text>
            <TextInput
              value={help.contacts.whatsapp}
              onChangeText={(value) => updateContact("whatsapp", value)}
              keyboardType="phone-pad"
              style={styles.editorInput}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>PHONE NUMBER</Text>
            <TextInput
              value={help.contacts.phone}
              onChangeText={(value) => updateContact("phone", value)}
              keyboardType="phone-pad"
              style={styles.editorInput}
            />
          </View>
        </View>
        <Text style={styles.fieldLabel}>SUPPORT EMAIL</Text>
        <TextInput
          value={help.contacts.email}
          onChangeText={(value) => updateContact("email", value)}
          autoCapitalize="none"
          keyboardType="email-address"
          style={styles.editorInput}
        />
        <Text style={styles.fieldLabel}>
          HOLIDAY CLOSURES · YYYY-MM-DD, ONE PER LINE
        </Text>
        <TextInput
          multiline
          value={help.holidayClosures.join("\n")}
          onChangeText={(value) =>
            setHelp((current) => ({
              ...current,
              holidayClosures: value
                .split("\n")
                .map((item) => item.trim())
                .filter(Boolean),
            }))
          }
          style={[styles.editorInput, styles.homeMultiline]}
        />
        <Text style={styles.fieldLabel}>
          BUSINESS HOURS · DAY,OPEN,CLOSE · SUNDAY IS 0
        </Text>
        <TextInput
          multiline
          value={help.businessHours
            .map((item) => `${item.day},${item.open},${item.close}`)
            .join("\n")}
          onChangeText={(value) =>
            setHelp((current) => ({
              ...current,
              businessHours: value
                .split("\n")
                .map((line) => line.split(","))
                .filter((parts) => parts.length === 3)
                .map((parts) => ({
                  day: Number(parts[0]),
                  open: parts[1].trim(),
                  close: parts[2].trim(),
                  closed: false,
                })),
            }))
          }
          placeholder={"1,09:00,18:00\n2,09:00,18:00"}
          style={[styles.editorInput, styles.homeMultiline]}
        />
        <Text style={styles.fieldLabel}>POPULAR QUESTIONS</Text>
        {help.faqs.map((faq) => (
          <View key={faq.id} style={styles.homeSlideCard}>
            <TextInput
              value={faq.question}
              onChangeText={(question) =>
                setHelp((current) => ({
                  ...current,
                  faqs: current.faqs.map((item) =>
                    item.id === faq.id ? { ...item, question } : item,
                  ),
                }))
              }
              style={styles.editorInput}
            />
            <TextInput
              multiline
              value={faq.answer}
              onChangeText={(answer) =>
                setHelp((current) => ({
                  ...current,
                  faqs: current.faqs.map((item) =>
                    item.id === faq.id ? { ...item, answer } : item,
                  ),
                }))
              }
              style={[styles.editorInput, styles.homeMultiline]}
            />
          </View>
        ))}
        {message ? (
          <Text
            accessibilityRole="alert"
            style={
              message.includes("published")
                ? styles.homeSaved
                : styles.editorError
            }
          >
            {message}
          </Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          disabled={saving}
          onPress={publish}
          style={[
            styles.primaryButton,
            styles.homeSave,
            saving && styles.pressed,
          ]}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.primaryButtonText}>PUBLISH HELP CENTRE</Text>
              <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
            </>
          )}
        </Pressable>
      </View>
    </>
  );
}

function SystemStatus({
  session,
  data,
}: {
  session: AdminSession;
  data: AdminDashboardData;
}) {
  const [health, setHealth] = useState<AdminConnectionHealth | null>(null);
  const [checking, setChecking] = useState(false);
  const check = useCallback(async () => {
    setChecking(true);
    try {
      setHealth(await checkAdminConnections(session));
    } finally {
      setChecking(false);
    }
  }, [session]);
  useEffect(() => {
    void check();
  }, [check]);
  const connection = (
    label: string,
    status: AdminConnectionHealth[keyof Omit<
      AdminConnectionHealth,
      "checkedAt"
    >],
    detail: string,
    icon: string,
  ) => (
    <View style={styles.systemConnectionRow}>
      <View
        style={[
          styles.systemConnectionIcon,
          status === "unavailable" && styles.settingIconError,
        ]}
      >
        <Ionicons
          name={icon as any}
          size={18}
          color={status === "unavailable" ? RED : "#176b43"}
        />
      </View>
      <View style={styles.systemConnectionCopy}>
        <Text style={styles.systemConnectionLabel}>{label}</Text>
        <Text numberOfLines={1} style={styles.systemConnectionDetail}>
          {detail}
        </Text>
      </View>
      <View
        style={[
          styles.systemStatusBadge,
          status === "unavailable" && styles.systemStatusBadgeError,
          status === "setup_required" && styles.systemStatusBadgeReady,
        ]}
      >
        <View
          style={[
            styles.systemStatusDot,
            status === "unavailable" && styles.systemStatusDotError,
            status === "setup_required" && styles.systemStatusDotReady,
          ]}
        />
        <Text
          style={[
            styles.systemStatusBadgeText,
            status === "unavailable" && styles.systemStatusBadgeTextError,
          ]}
        >
          {status === "healthy"
            ? "CONNECTED"
            : status === "setup_required"
              ? "READY"
              : "CHECK"}
        </Text>
      </View>
    </View>
  );
  return (
    <>
      <SectionHeader
        eyebrow="SYSTEM & ACCESS"
        title="System status"
        detail="A compact live view of every service powering the customer app."
      />
      <View style={styles.systemActions}>
        <Pressable
          accessibilityRole="button"
          disabled={checking}
          onPress={() => void check()}
          style={styles.systemCheckButton}
        >
          {checking ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Ionicons name="pulse-outline" size={17} color="#fff" />
          )}
          <Text style={styles.systemCheckText}>
            {checking ? "CHECKING…" : "REFRESH STATUS"}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="link"
          onPress={() =>
            Platform.OS === "web"
              ? globalThis.open?.("/app", "_blank")
              : void Linking.openURL("https://ipordise.com/app")
          }
          style={styles.systemOpenButton}
        >
          <Ionicons name="open-outline" size={16} color="#3e3531" />
          <Text style={styles.systemOpenText}>OPEN APP</Text>
        </Pressable>
      </View>
      <View style={styles.systemSummary}>
        <View style={styles.systemSummaryBlock}>
          <View style={styles.systemSummaryIcon}>
            <Ionicons name="cube-outline" size={18} color="#176b43" />
          </View>
          <View>
            <Text style={styles.systemSummaryLabel}>LIVE CATALOGUE</Text>
            <Text style={styles.systemSummaryValue}>
              {data.products.filter((item) => item.active).length} products
            </Text>
          </View>
        </View>
        <View style={styles.systemSummaryDivider} />
        <View style={styles.systemSummaryBlock}>
          <View style={styles.systemSummaryIcon}>
            <Ionicons
              name="shield-checkmark-outline"
              size={18}
              color="#176b43"
            />
          </View>
          <View style={styles.systemConnectionCopy}>
            <Text style={styles.systemSummaryLabel}>ADMINISTRATOR</Text>
            <Text numberOfLines={1} style={styles.systemSummaryValueSmall}>
              {session.user.email}
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.systemPanel}>
        <View style={styles.systemPanelHead}>
          <View>
            <Text style={styles.panelEyebrow}>LIVE CONNECTIONS</Text>
            <Text style={styles.panelTitle}>App services</Text>
          </View>
          {health ? (
            <Text style={styles.systemChecked}>
              Checked{" "}
              {new Date(health.checkedAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
          ) : null}
        </View>
        {health ? (
          <>
            {connection(
              "Firebase settings",
              health.firebase,
              "Runtime settings and legacy enquiries",
              "server-outline",
            )}
            {connection(
              "App settings",
              health.runtime,
              health.runtime === "setup_required"
                ? "Publish one Manage App section"
                : "Homepage, offers, help and shop",
              "options-outline",
            )}
            {connection(
              "Website",
              health.storefront,
              "ipordise.com availability",
              "globe-outline",
            )}
            {connection(
              "Commerce catalogue API",
              health.catalogSync,
              "Authenticated product administration",
              "sync-outline",
            )}
          </>
        ) : (
          <View style={styles.systemLoading}>
            <ActivityIndicator color={RED} />
            <Text style={styles.loadingText}>Checking app services…</Text>
          </View>
        )}
      </View>
    </>
  );
}

function Settings({
  session,
  data,
  onSave,
  onSaveShop,
  onSaveHelp,
  onNavigate,
  onOpenTab,
}: {
  session: AdminSession;
  data: AdminDashboardData;
  onSave: (config: HomeConfig, offers: OfferHeroConfig) => Promise<void>;
  onSaveShop: (shop: ShopConfig) => Promise<void>;
  onSaveHelp: (help: HelpConfig) => Promise<void>;
  onNavigate: () => void;
  onOpenTab: (tab: AdminTab) => void;
}) {
  const phone = useResponsiveLayout().width < 600;
  const [tool, setTool] = useState<
    "storefront" | "shop" | "all" | "system" | null
  >(null);
  const selectTool = (next: typeof tool) => {
    setTool(next);
    requestAnimationFrame(onNavigate);
  };
  const liveProducts = data.products.filter((item) => item.active).length;
  const pendingOrders = data.orders.filter(
    (item) => item.status === "pending" || item.status === "processing",
  ).length;
  const openConversations = data.conversations.filter(
    (item) => item.status === "open" || item.status === "pending_customer",
  ).length;
  const controls = [
    {
      id: "storefront",
      icon: "images-outline",
      title: "Homepage & offers",
      text: "Hero campaigns, announcements, schedules and promotion visibility",
      meta: "Live content",
    },
    {
      id: "shop",
      icon: "grid-outline",
      title: "Shop discovery",
      text: "Categories, collections, filters, families and featured brands",
      meta: `${liveProducts} products live`,
    },
    {
      id: "all",
      icon: "headset-outline",
      title: "Customer experience",
      text: "Help centre, availability, contact channels, FAQs and policies",
      meta: "Care & configuration",
    },
    {
      id: "system",
      icon: "pulse-outline",
      title: "API & system health",
      text: "Verify Firebase, runtime settings, website catalogue and sync",
      meta: "Live diagnostics",
    },
  ] as const;
  if (!tool)
    return (
      <>
        <SectionHeader
          eyebrow="APP CONTROL CENTRE"
          title="Manage your app"
          detail="Publish content, run daily operations, and verify every service from one workspace."
        />
        <View style={styles.manageAppHero}>
          <View style={styles.manageAppHeroTop}>
            <View style={styles.manageAppHeroIcon}>
              <Ionicons name="phone-portrait-outline" size={22} color="#fff" />
            </View>
            <View style={styles.manageAppHeroCopy}>
              <Text style={styles.manageAppHeroMeta}>IPORDISE APP · LIVE</Text>
              <Text style={styles.manageAppHeroTitle}>
                Everything under control.
              </Text>
              <Text style={styles.manageAppHeroText}>
                Firebase-secured publishing for the website and customer app.
              </Text>
            </View>
            <View style={styles.manageAppLiveBadge}>
              <View style={styles.manageAppLiveDot} />
              <Text style={styles.manageAppLiveText}>CONNECTED</Text>
            </View>
          </View>
          <View style={styles.manageAppStats}>
            <View style={styles.manageAppStat}>
              <Text style={styles.manageAppStatValue}>{liveProducts}</Text>
              <Text style={styles.manageAppStatLabel}>LIVE PRODUCTS</Text>
            </View>
            <View style={styles.manageAppStatDivider} />
            <View style={styles.manageAppStat}>
              <Text style={styles.manageAppStatValue}>{pendingOrders}</Text>
              <Text style={styles.manageAppStatLabel}>ORDERS TO HANDLE</Text>
            </View>
            <View style={styles.manageAppStatDivider} />
            <View style={styles.manageAppStat}>
              <Text style={styles.manageAppStatValue}>{openConversations}</Text>
              <Text style={styles.manageAppStatLabel}>CARE REQUESTS</Text>
            </View>
          </View>
        </View>
        <View style={styles.manageAppSectionHead}>
          <View>
            <Text style={styles.panelEyebrow}>DAILY OPERATIONS</Text>
            <Text style={styles.panelTitle}>Quick actions</Text>
          </View>
          <Text style={styles.manageAppSectionHint}>Open a workspace</Text>
        </View>
        <View style={styles.manageAppQuickRow}>
          {(
            [
              ["Products", "cube-outline", `${liveProducts} live`],
              ["Orders", "receipt-outline", `${pendingOrders} active`],
              ["Support", "chatbubbles-outline", `${openConversations} open`],
            ] as const
          ).map(([label, icon, meta]) => (
            <Pressable
              accessibilityRole="button"
              key={label}
              onPress={() => onOpenTab(label)}
              style={({ pressed }) => [
                styles.manageAppQuick,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.manageAppQuickIcon}>
                <Ionicons name={icon} size={17} color={RED} />
              </View>
              <View style={styles.manageAppCopy}>
                <Text style={styles.manageAppQuickTitle}>{label}</Text>
                <Text style={styles.manageAppQuickMeta}>{meta}</Text>
              </View>
              <Ionicons name="chevron-forward" size={15} color="#8a7e78" />
            </Pressable>
          ))}
        </View>
        <View style={styles.manageAppSectionHead}>
          <View>
            <Text style={styles.panelEyebrow}>APP CONFIGURATION</Text>
            <Text style={styles.panelTitle}>Publishing tools</Text>
          </View>
          <Text style={styles.manageAppSectionHint}>4 control areas</Text>
        </View>
        <View style={styles.manageAppGrid}>
          {controls.map((item) => (
            <Pressable
              accessibilityRole="button"
              key={item.id}
              onPress={() => selectTool(item.id)}
              style={({ pressed }) => [
                styles.manageAppCard,
                phone && styles.manageAppCardPhone,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.manageAppIcon}>
                <Ionicons name={item.icon} size={21} color={RED} />
              </View>
              <View style={styles.manageAppCopy}>
                <Text style={styles.manageAppMeta}>{item.meta}</Text>
                <Text
                  style={[
                    styles.manageAppTitle,
                    phone && styles.manageAppTitlePhone,
                  ]}
                >
                  {item.title}
                </Text>
                <Text style={styles.manageAppText}>{item.text}</Text>
              </View>
              <View
                style={[
                  styles.manageAppArrow,
                  phone && styles.manageAppArrowPhone,
                ]}
              >
                <Ionicons name="arrow-forward" size={16} color="#fff" />
              </View>
            </Pressable>
          ))}
        </View>
        <View style={styles.manageAppSecurity}>
          <Ionicons name="shield-checkmark-outline" size={18} color="#176b43" />
          <View style={styles.manageAppCopy}>
            <Text style={styles.manageAppSecurityTitle}>
              Protected publishing
            </Text>
            <Text style={styles.manageAppSecurityText}>
              Changes require your verified administrator session and publish to
              the shared Firebase runtime.
            </Text>
          </View>
        </View>
      </>
    );
  const back = (
    <Pressable
      accessibilityRole="button"
      onPress={() => selectTool(null)}
      style={styles.manageAppBack}
    >
      <Ionicons name="arrow-back" size={16} color="#4e433e" />
      <Text style={styles.manageAppBackText}>All app controls</Text>
    </Pressable>
  );
  if (tool === "system")
    return (
      <>
        {back}
        <SystemStatus session={session} data={data} />
      </>
    );
  return (
    <>
      {back}
      {tool === "storefront" ? (
        <StorefrontSettings session={session} data={data} onSave={onSave} />
      ) : tool === "shop" ? (
        <ShopSettings data={data} onSave={onSaveShop} />
      ) : (
        <>
          <SettingsBase
            session={session}
            data={data}
            onSave={onSave}
            onSaveHelp={onSaveHelp}
          />
          <ShopSettings data={data} onSave={onSaveShop} />
        </>
      )}
    </>
  );
}

function AdminNavigation({
  active,
  data,
  email,
  onNavigate,
  onSignOut,
}: {
  active: AdminTab;
  data: AdminDashboardData | null;
  email: string;
  onNavigate: (tab: AdminTab) => void;
  onSignOut: () => void;
}) {
  const pending = data?.orders.filter((item) => item.status === "pending").length || 0;
  return (
    <>
      <View style={styles.sidebarBrand}>
        <Text style={styles.sidebarBrandName}>IPORDISE</Text>
        <Text style={styles.sidebarBrandMeta}>ADMINISTRATION</Text>
      </View>
      <View style={styles.sidebarRule} />
      <View style={styles.sidebarNav}>
        {navItems.map(([label, icon]) => (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: active === label }}
            key={label}
            onPress={() => onNavigate(label)}
            style={[styles.sidebarItem, active === label && styles.sidebarItemActive]}
          >
            <Ionicons name={icon as any} size={20} color={active === label ? "#fff" : "#c8bec0"} />
            <Text style={[styles.sidebarItemText, active === label && styles.sidebarItemTextActive]}>{label}</Text>
            {label === "Orders" && pending ? <View style={styles.sidebarBadge}><Text style={styles.sidebarBadgeText}>{pending}</Text></View> : null}
          </Pressable>
        ))}
      </View>
      <View style={styles.sidebarFooter}>
        <View style={styles.sidebarUser}>
          <View style={styles.sidebarAvatar}><Text style={styles.sidebarAvatarText}>IP</Text></View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={styles.sidebarUserName}>{email}</Text>
            <Text style={styles.sidebarRole}>ADMINISTRATOR</Text>
          </View>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Sign out of Admin" onPress={onSignOut} style={styles.signOut}>
          <Ionicons name="log-out-outline" size={18} color="#c8bec0" />
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </View>
    </>
  );
}

export function AdminDashboard() {
  const layout = useResponsiveLayout();
  const desktop = layout.width >= 1024;
  const contentScrollRef = useRef<NativeScrollView>(null);
  const [session, setSession] = useState<AdminSession | null | undefined>(
    undefined,
  );
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [active, setActive] = useState<AdminTab>("Overview");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    void restoreAdminSession().then(setSession);
  }, []);
  const reload = async (current = session) => {
    if (!current) return;
    setLoading(true);
    setError("");
    try {
      setData(await loadAdminDashboard(current));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Dashboard data could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (!session) return;
    setLoading(true);
    setError("");
    void loadAdminDashboard(session)
      .then(setData)
      .catch((err) =>
        setError(
          err instanceof Error
            ? err.message
            : "Dashboard data could not be loaded.",
        ),
      )
      .finally(() => setLoading(false));
  }, [session]);
  useEffect(() => {
    if (!session) return;
    const timer = setInterval(() => {
      void loadAdminDashboard(session)
        .then(setData)
        .catch(() => {
          /* Keep the last successful dashboard snapshot. */
        });
    }, 20_000);
    return () => clearInterval(timer);
  }, [session]);
  const currentOrders = data?.orders;
  useEffect(() => {
    if (session && currentOrders)
      void publishAdminBestsellerRanking(session, currentOrders).catch(() => {
        /* The next dashboard refresh retries the public ranking. */
      });
  }, [session, currentOrders]);
  if (session === undefined)
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={RED} />
        <Text style={styles.bootText}>Securing the IPORDISE workspace…</Text>
      </View>
    );
  if (!session) return <AdminLogin onSignedIn={setSession} />;
  const saveProduct = async (
    product: AdminProduct,
    patch: AdminProductPatch,
  ) => {
    const updated = await updateAdminProduct(
      session,
      product.id,
      patch,
      product,
    );
    setData((current) =>
      current
        ? {
            ...current,
            products: current.products.map((item) =>
              item.id === product.id ? { ...item, ...updated } : item,
            ),
          }
        : current,
    );
  };
  const addProduct = async (product: NewAdminProduct) => {
    const created = await createAdminProduct(session, product);
    setData((current) =>
      current
        ? { ...current, products: [created, ...current.products] }
        : current,
    );
  };
  const saveOrder = async (order: AdminOrder, status: AdminOrder["status"]) => {
    const updated = await updateAdminOrderStatus(session, order.id, status);
    setData((current) =>
      current
        ? {
            ...current,
            orders: current.orders.map((item) =>
              item.id === order.id ? { ...item, ...updated } : item,
            ),
          }
        : current,
    );
  };
  const saveOrderShipping = async (order: AdminOrder, patch: AdminOrderShippingPatch) => {
    const updated = await updateAdminOrderShipping(session, order.id, patch);
    setData(current => current ? {
      ...current,
      orders: current.orders.map(item => item.id === order.id ? { ...item, ...updated } : item),
    } : current);
  };
  const removeOrder = async (order: AdminOrder) => {
    await deleteAdminOrder(session, order.id);
    setData(current => current ? {
      ...current,
      orders: current.orders.filter(item => item.id !== order.id),
    } : current);
  };
  const saveConversation = async (
    item: AdminConversation,
    patch: Pick<AdminConversation, "status" | "priority">,
  ) => {
    const updated = await updateAdminConversation(
      session,
      item.id,
      patch,
      item.has_app_thread,
    );
    setData((current) =>
      current
        ? {
            ...current,
            conversations: current.conversations.map((row) =>
              row.id === item.id ? { ...row, ...updated } : row,
            ),
          }
        : current,
    );
  };
  const saveSupportReply = async (item: AdminConversation, message: string) => {
    const thread = await sendAdminSupportReply(session, item, message);
    setData((current) =>
      current
        ? {
            ...current,
            conversations: current.conversations.map((row) =>
              row.id === item.id
                ? {
                    ...row,
                    status: "pending_customer",
                    last_message_at: new Date().toISOString(),
                  }
                : row,
            ),
          }
        : current,
    );
    return thread;
  };
  const saveHomepage = async (config: HomeConfig, offers: OfferHeroConfig) => {
    if (!data) return;
    const settings = await updateAdminStorefrontConfig(
      session,
      data.settings,
      config,
      offers,
    );
    setData((current) => (current ? { ...current, settings } : current));
  };
  const saveHelp = async (help: HelpConfig) => {
    if (!data) return;
    const settings = await updateAdminHelpConfig(session, data.settings, help);
    setData((current) => (current ? { ...current, settings } : current));
  };
  const saveShop = async (shop: ShopConfig) => {
    if (!data) return;
    const settings = await updateAdminShopConfig(session, data.settings, shop);
    setData((current) => (current ? { ...current, settings } : current));
  };
  const openAdminTab = (tab: AdminTab) => {
    setActive(tab);
    setDrawerOpen(false);
    requestAnimationFrame(() =>
      contentScrollRef.current?.scrollTo({ y: 0, animated: false }),
    );
  };
  const content = data ? (
    active === "Overview" ? (
      <Overview data={data} onNavigate={openAdminTab} />
    ) : active === "Products" ? (
      <UnifiedProducts data={data} onSave={saveProduct} onCreate={addProduct} />
    ) : active === "Inventory" ? (
      <VariantInventoryWorkspace data={data} onSave={saveProduct} />
    ) : active === "Orders" ? (
      <Orders data={data} onStatus={saveOrder} onShipping={saveOrderShipping} onRemove={removeOrder} />
    ) : active === "Customers" ? (
      <Customers data={data} />
    ) : active === "Promotions" ? (
      <Promotions data={data} onSave={saveProduct} />
    ) : active === "Support" ? (
      <Support
        session={session}
        data={data}
        onUpdate={saveConversation}
        onReply={saveSupportReply}
      />
    ) : (
      <Settings
        session={session}
        data={data}
        onSave={saveHomepage}
        onSaveShop={saveShop}
        onSaveHelp={saveHelp}
        onNavigate={() =>
          contentScrollRef.current?.scrollTo({ y: 0, animated: false })
        }
        onOpenTab={openAdminTab}
      />
    )
  ) : null;
  return (
    <SafeAreaView style={styles.adminSafe}>
      <StatusBar style="dark" />
      <View style={styles.adminApp}>
        {desktop ? (
          <View style={styles.sidebar}>
            <AdminNavigation active={active} data={data} email={session.user.email} onNavigate={openAdminTab} onSignOut={() => void signOutAdmin(session).then(() => setSession(null))} />
          </View>
        ) : null}
        <View style={styles.adminMain}>
          <View style={styles.topbar}>
            <View>
              {!desktop ? (
                <View style={styles.mobileHeaderTitle}>
                  <Pressable accessibilityRole="button" accessibilityLabel="Open Admin navigation" onPress={() => setDrawerOpen(true)} style={styles.menuButton}>
                    <Ionicons name="menu" size={24} color="#211719" />
                  </Pressable>
                  <View style={{ minWidth: 0 }}>
                    <Text style={styles.mobileBrandMeta}>IPORDISE ADMIN</Text>
                    <Text numberOfLines={1} style={styles.mobilePageTitle}>{active}</Text>
                  </View>
                </View>
              ) : (
                <>
                  <Text style={styles.topbarKicker}>IPORDISE OPERATIONS</Text>
                  <Text style={styles.topbarTitle}>{active}</Text>
                </>
              )}
            </View>
            <View style={styles.topbarActions}>
              <Pressable
                onPress={() => void reload()}
                style={styles.iconButton}
              >
                {loading ? (
                  <ActivityIndicator color={RED} size="small" />
                ) : (
                  <Ionicons name="refresh-outline" size={19} />
                )}
              </Pressable>
              <View style={styles.onlinePill}>
                <View style={styles.onlineDot} />
                <Text style={styles.onlineText}>SECURE</Text>
              </View>
            </View>
          </View>
          {!desktop ? (
            <Modal visible={drawerOpen} transparent animationType="fade" onRequestClose={() => setDrawerOpen(false)}>
              <View style={styles.drawerLayer}>
                <Pressable accessibilityRole="button" accessibilityLabel="Close Admin navigation" onPress={() => setDrawerOpen(false)} style={styles.drawerBackdrop} />
                <SafeAreaView style={styles.drawerPanel}>
                  <View style={styles.drawerCloseRow}><Pressable accessibilityRole="button" accessibilityLabel="Close Admin navigation" onPress={() => setDrawerOpen(false)} style={styles.iconButton}><Ionicons name="close" size={22} /></Pressable></View>
                  <AdminNavigation active={active} data={data} email={session.user.email} onNavigate={openAdminTab} onSignOut={() => void signOutAdmin(session).then(() => setSession(null))} />
                </SafeAreaView>
              </View>
            </Modal>
          ) : null}
          <ScrollView
            ref={contentScrollRef}
            contentContainerStyle={[
              styles.adminContent,
              { paddingHorizontal: layout.compact ? 13 : desktop ? 32 : 20 },
            ]}
          >
            {error ? (
              <View style={styles.dashboardError}>
                <Ionicons name="cloud-offline-outline" size={20} color={RED} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.dashboardErrorTitle}>
                    Dashboard connection unavailable
                  </Text>
                  <Text style={styles.dashboardErrorText}>{error}</Text>
                </View>
                <Pressable onPress={() => void reload()}>
                  <Text style={styles.retryText}>Retry</Text>
                </Pressable>
              </View>
            ) : null}
            {loading && !data ? (
              <View style={styles.loadingPanel}>
                <ActivityIndicator color={RED} />
                <Text style={styles.loadingText}>
                  Loading protected operations…
                </Text>
              </View>
            ) : (
              content
            )}
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}

const adminHomeStyles = StyleSheet.create({
  homeEditor: {
    marginTop: 18,
    borderRadius: 22,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2dad6",
    padding: 18,
  },
  homeMultiline: { height: 96, paddingTop: 12, textAlignVertical: "top" },
  homeSectionChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginTop: 8,
  },
  homeSectionChip: {
    minHeight: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "#ddd4cf",
    backgroundColor: "#fff",
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  homeSectionChipActive: { backgroundColor: "#211719", borderColor: "#211719" },
  homeSectionChipText: {
    fontSize: 8,
    fontWeight: "800",
    color: "#776c66",
    textTransform: "capitalize",
  },
  homeSectionChipTextActive: { color: "#fff" },
  homeSlideCard: {
    marginTop: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e6ded9",
    backgroundColor: "#f8f5f3",
    padding: 14,
  },
  homeSlideHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  homeFieldRow: { flexDirection: "row", gap: 10 },
  homeSave: {
    flex: 0,
    minHeight: 50,
    marginTop: 16,
    paddingHorizontal: 24,
    alignSelf: "flex-end",
  },
  homeSaved: {
    fontSize: 9,
    fontWeight: "800",
    color: "#176b43",
    marginTop: 12,
  },
  filterRowMobile: { paddingRight: 14, paddingBottom: 12 },
  filterChipMobile: { height: 40, borderRadius: 20, paddingHorizontal: 15 },
  orderCardMobile: { padding: 12, borderRadius: 17 },
  orderNumberMobile: { fontSize: 16 },
  orderCustomerMobile: { minHeight: 68, gap: 8 },
  orderTotalMobile: { fontSize: 12 },
  orderWhatsappMobile: { width: "100%", height: 44, justifyContent: "center" },
  orderFootMobile: { alignItems: "stretch", gap: 4, paddingTop: 6 },
  orderActionsMobile: { width: "100%", marginTop: 0 },
  orderCancelMobile: { minWidth: 72, height: 42 },
  orderAdvanceMobile: { flex: 1, minWidth: 0, height: 42 },
  manageAppHero: {
    borderRadius: 23,
    backgroundColor: "#1d1617",
    padding: 17,
    marginBottom: 17,
    overflow: "hidden",
  },
  manageAppHeroTop: { flexDirection: "row", alignItems: "center", gap: 11 },
  manageAppHeroIcon: {
    width: 45,
    height: 45,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,.11)",
    alignItems: "center",
    justifyContent: "center",
  },
  manageAppHeroCopy: { flex: 1, minWidth: 0 },
  manageAppHeroMeta: {
    fontSize: 5.5,
    fontWeight: "900",
    letterSpacing: 1.1,
    color: "#ff8da6",
  },
  manageAppHeroTitle: {
    fontFamily: "serif",
    fontSize: 21,
    lineHeight: 26,
    fontWeight: "700",
    color: "#fff",
    marginTop: 2,
  },
  manageAppHeroText: {
    fontSize: 7.5,
    lineHeight: 12,
    color: "rgba(255,255,255,.62)",
    marginTop: 2,
  },
  manageAppLiveBadge: {
    height: 25,
    borderRadius: 13,
    backgroundColor: "rgba(65,185,116,.14)",
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  manageAppLiveDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#66d695",
  },
  manageAppLiveText: {
    fontSize: 5,
    fontWeight: "900",
    letterSpacing: 0.6,
    color: "#8be3ad",
  },
  manageAppStats: {
    minHeight: 64,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,.1)",
    marginTop: 14,
    paddingTop: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  manageAppStat: { flex: 1, minWidth: 0 },
  manageAppStatDivider: {
    width: 1,
    height: 34,
    backgroundColor: "rgba(255,255,255,.1)",
    marginHorizontal: 10,
  },
  manageAppStatValue: {
    fontFamily: "serif",
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "700",
    color: "#fff",
  },
  manageAppStatLabel: {
    fontSize: 4.8,
    fontWeight: "900",
    letterSpacing: 0.65,
    color: "rgba(255,255,255,.48)",
    marginTop: 2,
  },
  manageAppSectionHead: {
    minHeight: 43,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 9,
  },
  manageAppSectionHint: { fontSize: 7, color: "#8b807a", paddingBottom: 3 },
  manageAppQuickRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  manageAppQuick: {
    flexGrow: 1,
    flexBasis: 170,
    minWidth: 150,
    minHeight: 68,
    borderRadius: 17,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2dad6",
    padding: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  manageAppQuickIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#faeaee",
    alignItems: "center",
    justifyContent: "center",
  },
  manageAppQuickTitle: { fontSize: 9, fontWeight: "900", color: "#241d1a" },
  manageAppQuickMeta: { fontSize: 6.5, color: "#8a7e78", marginTop: 2 },
  manageAppGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  manageAppCard: {
    flexGrow: 1,
    flexBasis: 270,
    minWidth: 240,
    minHeight: 126,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2dad6",
    padding: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    shadowColor: "#2a1915",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
  },
  manageAppCardPhone: {
    flexBasis: "47%",
    minWidth: 0,
    minHeight: 178,
    padding: 13,
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 9,
  },
  manageAppIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#faeaee",
    alignItems: "center",
    justifyContent: "center",
  },
  manageAppCopy: { flex: 1, minWidth: 0 },
  manageAppMeta: {
    fontSize: 6,
    fontWeight: "900",
    letterSpacing: 1,
    color: RED,
    textTransform: "uppercase",
  },
  manageAppTitle: {
    fontFamily: "serif",
    fontSize: 20,
    lineHeight: 25,
    fontWeight: "700",
    color: "#171310",
    marginTop: 2,
  },
  manageAppTitlePhone: { fontSize: 17, lineHeight: 21 },
  manageAppText: {
    fontSize: 8.5,
    lineHeight: 13,
    color: "#776d67",
    marginTop: 2,
  },
  manageAppArrow: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#211719",
    alignItems: "center",
    justifyContent: "center",
  },
  manageAppArrowPhone: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignSelf: "flex-end",
    marginTop: "auto",
  },
  manageAppSecurity: {
    minHeight: 70,
    borderRadius: 17,
    backgroundColor: "#edf7f0",
    borderWidth: 1,
    borderColor: "#dcece1",
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
  },
  manageAppSecurityTitle: {
    fontSize: 8.5,
    fontWeight: "900",
    color: "#245b3e",
  },
  manageAppSecurityText: {
    fontSize: 7,
    lineHeight: 11,
    color: "#668071",
    marginTop: 2,
  },
  manageAppBack: {
    height: 42,
    alignSelf: "flex-start",
    borderRadius: 21,
    borderWidth: 1,
    borderColor: "#ddd4cf",
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 17,
  },
  manageAppBackText: { fontSize: 8, fontWeight: "900", color: "#4e433e" },
  systemActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  systemCheckButton: {
    minHeight: 44,
    borderRadius: 22,
    backgroundColor: "#211719",
    paddingHorizontal: 17,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  systemCheckText: {
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.5,
    color: "#fff",
  },
  systemOpenButton: {
    minHeight: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#ddd4cf",
    backgroundColor: "#fff",
    paddingHorizontal: 17,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  systemOpenText: {
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.4,
    color: "#3e3531",
  },
  systemChecked: {
    fontSize: 8,
    color: "#81756f",
    marginTop: 10,
    textAlign: "right",
  },
  settingIconError: { backgroundColor: "#faeaee" },
  sectionHeaderPhone: { marginBottom: 14, gap: 10 },
  sectionTitlePhone: { fontSize: 25, lineHeight: 30 },
  sectionDetailPhone: { fontSize: 9, lineHeight: 13 },
  metricCardPhone: {
    flexBasis: "47%",
    flexGrow: 1,
    minWidth: 0,
    maxWidth: "49%",
    minHeight: 116,
    padding: 12,
    borderRadius: 17,
  },
  metricIconPhone: { width: 30, height: 30, borderRadius: 10 },
  metricLabelPhone: { fontSize: 5.5, marginTop: 9 },
  metricValuePhone: { fontSize: 20, lineHeight: 24, marginTop: 0 },
  metricDetailPhone: { fontSize: 6.5, marginTop: 1 },
});

const styles = StyleSheet.create({
  systemSummary: {
    minHeight: 92,
    borderRadius: 18,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2dad6",
    padding: 13,
    flexDirection: "row",
    alignItems: "stretch",
    marginBottom: 11,
  },
  systemSummaryBlock: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  systemSummaryDivider: {
    width: 1,
    backgroundColor: "#eee8e5",
    marginHorizontal: 10,
  },
  systemSummaryIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#eaf6ee",
    alignItems: "center",
    justifyContent: "center",
  },
  systemSummaryLabel: {
    fontSize: 5.5,
    fontWeight: "900",
    letterSpacing: 1,
    color: RED,
  },
  systemSummaryValue: {
    fontFamily: "serif",
    fontSize: 17,
    lineHeight: 21,
    fontWeight: "700",
    color: "#171310",
    marginTop: 2,
  },
  systemSummaryValueSmall: {
    fontFamily: "serif",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
    color: "#171310",
    marginTop: 2,
  },
  systemPanel: {
    borderRadius: 19,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2dad6",
    padding: 14,
  },
  systemPanelHead: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 10,
    paddingBottom: 8,
  },
  systemConnectionRow: {
    minHeight: 65,
    borderTopWidth: 1,
    borderTopColor: "#eee8e5",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  systemConnectionIcon: {
    width: 35,
    height: 35,
    borderRadius: 12,
    backgroundColor: "#eaf6ee",
    alignItems: "center",
    justifyContent: "center",
  },
  systemConnectionCopy: { flex: 1, minWidth: 0 },
  systemConnectionLabel: { fontSize: 9, fontWeight: "900", color: "#2b2420" },
  systemConnectionDetail: {
    fontSize: 7,
    lineHeight: 11,
    color: "#8a7f79",
    marginTop: 2,
  },
  systemStatusBadge: {
    height: 24,
    borderRadius: 12,
    backgroundColor: "#eaf6ee",
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  systemStatusBadgeError: { backgroundColor: "#fae9ed" },
  systemStatusBadgeReady: { backgroundColor: "#fff1e5" },
  systemStatusDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#26955a",
  },
  systemStatusDotError: { backgroundColor: RED },
  systemStatusDotReady: { backgroundColor: "#c9761d" },
  systemStatusBadgeText: {
    fontSize: 5.5,
    fontWeight: "900",
    letterSpacing: 0.6,
    color: "#176b43",
  },
  systemStatusBadgeTextError: { color: RED },
  systemLoading: {
    minHeight: 150,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  supportAdminSummary: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11,
  },
  openConversationButton: {
    height: 30,
    borderRadius: 15,
    backgroundColor: "#211719",
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  openConversationText: { fontSize: 6.5, fontWeight: "900", color: "#fff" },
  supportThreadPanel: {
    width: "100%",
    borderTopWidth: 1,
    borderTopColor: "#eee8e5",
    paddingTop: 14,
    gap: 8,
  },
  adminMessageBubble: {
    maxWidth: "88%",
    borderRadius: 14,
    borderBottomLeftRadius: 4,
    backgroundColor: "#f6f1ef",
    padding: 11,
    alignSelf: "flex-start",
  },
  adminMessageStaff: {
    alignSelf: "flex-end",
    backgroundColor: "#fbe8ed",
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 4,
  },
  adminMessageSender: {
    fontSize: 5.5,
    fontWeight: "900",
    letterSpacing: 1,
    color: RED,
  },
  adminMessageBody: {
    fontSize: 10,
    lineHeight: 15,
    color: "#2d2521",
    marginTop: 3,
  },
  adminMessageTime: { fontSize: 6, color: "#8d817b", marginTop: 5 },
  adminReplyComposer: {
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#ddd4cf",
    backgroundColor: "#fcfbfa",
    padding: 7,
    marginTop: 4,
  },
  adminReplyInput: {
    minHeight: 72,
    maxHeight: 130,
    paddingHorizontal: 7,
    paddingVertical: 7,
    fontSize: 11,
    color: "#211c19",
    textAlignVertical: "top",
  },
  adminReplyButton: {
    height: 40,
    borderRadius: 13,
    backgroundColor: RED,
    paddingHorizontal: 13,
    alignSelf: "flex-end",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  adminReplyButtonText: { fontSize: 7, fontWeight: "900", color: "#fff" },
  supportLegacyNote: { fontSize: 7, lineHeight: 11, color: "#81756f" },
  ...adminHomeStyles,
  pressed: { opacity: 0.72 },
  textLight: { color: "#fff" },
  textMutedLight: { color: "rgba(255,255,255,.62)" },
  boot: {
    flex: 1,
    backgroundColor: "#f5f2f0",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  bootText: { fontSize: 11, color: "#756b66" },
  loginSafe: { flex: 1, backgroundColor: "#0c0909" },
  loginScroll: { flexGrow: 1, backgroundColor: "#f4f0ee" },
  loginShell: { flexGrow: 1 },
  loginShellDesktop: { flexDirection: "row", minHeight: "100%" },
  loginStory: { minHeight: 268, padding: 22, overflow: "hidden", minWidth: 0 },
  loginStoryMobile: { minHeight: 286, paddingBottom: 40 },
  loginStoryDesktop: { flex: 1, padding: 44 },
  loginGlow: {
    position: "absolute",
    right: -105,
    top: -135,
    width: 380,
    height: 380,
    borderRadius: 190,
    backgroundColor: "rgba(215,25,63,.22)",
  },
  loginGlowSmall: {
    position: "absolute",
    left: -65,
    bottom: -100,
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: "rgba(255,120,150,.055)",
  },
  loginBrandRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  adminWordmark: { alignSelf: "flex-start" },
  adminWordmarkText: {
    fontFamily: "serif",
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: 0.35,
    color: "#fff",
  },
  adminWordmarkMeta: {
    fontSize: 6,
    fontWeight: "900",
    letterSpacing: 2,
    color: "#ff8ca6",
    marginTop: 1,
  },
  loginRouteBadge: {
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.16)",
    backgroundColor: "rgba(255,255,255,.065)",
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  loginOnlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#70d99a",
    shadowColor: "#70d99a",
    shadowOpacity: 0.7,
    shadowRadius: 5,
  },
  loginRouteText: {
    fontSize: 5.5,
    fontWeight: "900",
    letterSpacing: 0.9,
    color: "rgba(255,255,255,.72)",
  },
  loginStoryCopy: { marginTop: "auto", maxWidth: 580, minWidth: 0 },
  loginStoryCopyMobile: { width: "100%", maxWidth: "100%" },
  loginKicker: {
    fontSize: 7,
    fontWeight: "900",
    letterSpacing: 1.8,
    color: "#ff91aa",
  },
  loginTitle: {
    fontFamily: "serif",
    fontSize: 54,
    lineHeight: 59,
    fontWeight: "700",
    letterSpacing: -1.2,
    color: "#fff",
    marginTop: 8,
  },
  loginTitleMobile: { fontSize: 34, lineHeight: 36 },
  loginDescription: {
    fontSize: 11.5,
    lineHeight: 18,
    color: "rgba(255,255,255,.7)",
    maxWidth: 460,
    marginTop: 8,
    flexShrink: 1,
  },
  loginPromises: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 15,
    marginTop: 16,
  },
  loginPromise: { flexDirection: "row", alignItems: "center", gap: 6 },
  loginPromiseText: {
    fontSize: 8,
    fontWeight: "800",
    color: "rgba(255,255,255,.76)",
  },
  loginPanel: {
    flex: 1,
    backgroundColor: "#f4f0ee",
    paddingHorizontal: 20,
    paddingVertical: 27,
    justifyContent: "flex-start",
    minWidth: 0,
  },
  loginPanelMobile: { paddingHorizontal: 14, paddingTop: 0, paddingBottom: 24 },
  loginPanelDesktop: { maxWidth: 560, padding: 50, justifyContent: "center" },
  loginPanelInner: {
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
    minWidth: 0,
  },
  loginPanelInnerMobile: {
    width: "auto",
    maxWidth: "100%",
    alignSelf: "stretch",
    marginTop: -24,
    paddingHorizontal: 20,
    paddingTop: 21,
    paddingBottom: 16,
    borderRadius: 25,
    backgroundColor: "#fffdfc",
    borderWidth: 1,
    borderColor: "rgba(118,91,85,.11)",
    shadowColor: "#291519",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.13,
    shadowRadius: 28,
    elevation: 8,
  },
  loginAccessRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    marginBottom: 12,
  },
  loginAccessCopy: { flex: 1, minWidth: 0 },
  loginLock: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#f8e7eb",
    borderWidth: 1,
    borderColor: "#f1d7dd",
    alignItems: "center",
    justifyContent: "center",
  },
  loginEyebrow: {
    fontSize: 7,
    fontWeight: "900",
    letterSpacing: 1.55,
    color: RED,
  },
  loginAccessStatus: { fontSize: 8, color: "#887d77", marginTop: 3 },
  loginVerifiedBadge: {
    height: 24,
    borderRadius: 12,
    backgroundColor: "#edf7f0",
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  loginVerifiedText: {
    fontSize: 5.5,
    fontWeight: "900",
    letterSpacing: 0.65,
    color: "#176b43",
  },
  loginHeadingRule: { height: 1, backgroundColor: "#eee7e3", marginBottom: 15 },
  loginHeading: {
    fontFamily: "serif",
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "700",
    letterSpacing: -0.35,
    color: "#171310",
  },
  loginText: {
    fontSize: 11,
    lineHeight: 17,
    color: "#746a65",
    marginTop: 3,
    marginBottom: 11,
  },
  fieldLabel: {
    fontSize: 7,
    fontWeight: "900",
    letterSpacing: 1.25,
    color: "#655c57",
    marginTop: 12,
  },
  inputWrap: {
    height: 54,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#d8ceca",
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginTop: 7,
    alignSelf: "stretch",
    shadowColor: "#2f2020",
    shadowOpacity: 0.025,
    shadowRadius: 8,
  },
  inputWrapFocused: {
    borderColor: RED,
    borderWidth: 1.5,
    shadowColor: RED,
    shadowOpacity: 0.09,
    shadowRadius: 10,
  },
  input: {
    flex: 1,
    minWidth: 0,
    height: 50,
    fontSize: 13,
    color: "#211b18",
    outlineStyle: "solid",
    outlineWidth: 0,
  },
  passwordToggle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#faf7f5",
  },
  rememberRow: {
    minHeight: 46,
    marginTop: 12,
    borderRadius: 13,
    paddingHorizontal: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  rememberBox: {
    width: 21,
    height: 21,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: "#cfc4bf",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  rememberBoxChecked: { backgroundColor: RED, borderColor: RED },
  rememberTitle: { fontSize: 9, fontWeight: "800", color: "#352c28" },
  rememberText: { fontSize: 7.5, color: "#8a7e78", marginTop: 2 },
  errorBox: {
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: "#fff0f4",
    borderWidth: 1,
    borderColor: "#f5d8df",
    padding: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
  },
  errorText: {
    flex: 1,
    fontSize: 9,
    lineHeight: 13,
    color: RED,
    fontWeight: "700",
  },
  loginButton: {
    height: 56,
    borderRadius: 17,
    backgroundColor: RED,
    paddingHorizontal: 18,
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    alignSelf: "stretch",
    shadowColor: RED,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 4,
  },
  loginButtonText: {
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1.15,
    color: "#fff",
  },
  loginButtonIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  loginTrustRow: {
    minHeight: 42,
    marginTop: 13,
    borderRadius: 13,
    backgroundColor: "#eef5f0",
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  loginTrustItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  loginTrustText: { fontSize: 7.5, fontWeight: "700", color: "#476052" },
  loginTrustDivider: { width: 1, height: 18, backgroundColor: "#d4e3d8" },
  storefrontLink: {
    height: 36,
    alignSelf: "center",
    paddingHorizontal: 10,
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  storefrontLinkText: {
    fontSize: 6.5,
    fontWeight: "900",
    letterSpacing: 1.05,
    color: "#6e625c",
  },
  adminSafe: { flex: 1, backgroundColor: "#f4f1ef" },
  adminApp: { flex: 1, flexDirection: "row" },
  sidebar: {
    width: 244,
    backgroundColor: "#151011",
    paddingHorizontal: 16,
    paddingTop: 25,
  },
  sidebarBrand: { paddingHorizontal: 10 },
  sidebarBrandName: {
    fontFamily: "serif",
    fontSize: 23,
    fontWeight: "700",
    color: "#fff",
  },
  sidebarBrandMeta: {
    fontSize: 5.5,
    fontWeight: "900",
    letterSpacing: 2,
    color: "#ff829e",
    marginTop: 1,
  },
  sidebarRule: {
    height: 1,
    backgroundColor: "rgba(255,255,255,.1)",
    marginVertical: 22,
  },
  sidebarNav: { gap: 5 },
  sidebarItem: {
    minHeight: 48,
    borderRadius: 13,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  sidebarItemActive: { backgroundColor: RED },
  sidebarItemText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    color: "#c8bec0",
  },
  sidebarItemTextActive: { color: "#fff" },
  sidebarBadge: {
    minWidth: 19,
    height: 19,
    borderRadius: 10,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  sidebarBadgeText: { fontSize: 7, fontWeight: "900", color: RED },
  sidebarFooter: { marginTop: "auto", paddingBottom: 22 },
  sidebarUser: {
    minHeight: 57,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(255,255,255,.1)",
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  sidebarAvatar: {
    width: 33,
    height: 33,
    borderRadius: 11,
    backgroundColor: "rgba(215,25,63,.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  sidebarAvatarText: { fontSize: 8, fontWeight: "900", color: "#ff9ab0" },
  sidebarUserName: { fontSize: 8, fontWeight: "800", color: "#fff" },
  sidebarRole: {
    fontSize: 5.5,
    fontWeight: "900",
    letterSpacing: 0.9,
    color: "#887d7f",
    marginTop: 2,
  },
  signOut: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    marginTop: 8,
  },
  signOutText: { fontSize: 13, fontWeight: "700", color: "#c8bec0" },
  adminMain: { flex: 1, minWidth: 0, overflow: "hidden" },
  topbar: {
    height: 72,
    flexShrink: 0,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e7e0dc",
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topbarKicker: {
    fontSize: 5.5,
    fontWeight: "900",
    letterSpacing: 1.3,
    color: RED,
  },
  topbarTitle: {
    fontFamily: "serif",
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "700",
    color: "#171310",
  },
  mobileBrand: { flexDirection: "row", alignItems: "baseline", gap: 7 },
  mobileBrandText: { fontFamily: "serif", fontSize: 20, fontWeight: "700" },
  mobileBrandMeta: {
    fontSize: 6,
    fontWeight: "900",
    letterSpacing: 1.2,
    color: RED,
  },
  topbarActions: { flexDirection: "row", alignItems: "center", gap: 7 },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#e3dcd8",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  menuButton: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#f4f0ee" },
  mobileHeaderTitle: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 10 },
  mobilePageTitle: { fontFamily: "serif", fontSize: 18, lineHeight: 22, fontWeight: "700", color: "#171310" },
  drawerLayer: { flex: 1, flexDirection: "row", backgroundColor: "rgba(18,12,12,.52)" },
  drawerBackdrop: { ...StyleSheet.absoluteFillObject },
  drawerPanel: { width: "86%", maxWidth: 330, backgroundColor: "#151011", paddingHorizontal: 16, paddingTop: 8 },
  drawerCloseRow: { minHeight: 52, alignItems: "flex-end", justifyContent: "center" },
  onlinePill: {
    height: 30,
    borderRadius: 15,
    backgroundColor: "#edf7f0",
    paddingHorizontal: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#2da263",
  },
  onlineText: {
    fontSize: 5.5,
    fontWeight: "900",
    letterSpacing: 1,
    color: "#176b43",
  },
  mobileNavShell: {
    height: 55,
    minHeight: 55,
    maxHeight: 55,
    flexGrow: 0,
    flexShrink: 0,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e7e0dc",
  },
  mobileNav: {
    height: 54,
    minHeight: 54,
    paddingHorizontal: 13,
    paddingVertical: 9,
    gap: 6,
    alignItems: "center",
  },
  mobileNavItem: {
    height: 37,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e3dcd8",
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  mobileNavItemActive: { backgroundColor: "#211719", borderColor: "#211719" },
  mobileNavText: { fontSize: 8, fontWeight: "800", color: "#605650" },
  mobileNavTextActive: { color: "#fff" },
  adminContent: {
    width: "100%",
    maxWidth: 1320,
    alignSelf: "center",
    paddingTop: 27,
    paddingBottom: 50,
  },
  dashboardError: {
    minHeight: 70,
    borderRadius: 17,
    backgroundColor: "#fff0f4",
    borderWidth: 1,
    borderColor: "#f0d8de",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    marginBottom: 18,
  },
  dashboardErrorTitle: { fontSize: 10, fontWeight: "900", color: "#5d2431" },
  dashboardErrorText: {
    fontSize: 8,
    lineHeight: 12,
    color: "#8a5c66",
    marginTop: 2,
  },
  retryText: { fontSize: 8, fontWeight: "900", color: RED },
  loadingPanel: {
    minHeight: 240,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  loadingText: { fontSize: 9, color: "#756b66" },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 16,
    marginBottom: 20,
  },
  sectionEyebrow: {
    fontSize: 6.5,
    fontWeight: "900",
    letterSpacing: 1.45,
    color: RED,
  },
  sectionTitle: {
    fontFamily: "serif",
    fontSize: 30,
    lineHeight: 35,
    fontWeight: "700",
    letterSpacing: -0.45,
    color: "#171310",
    marginTop: 3,
  },
  sectionDetail: {
    fontSize: 10,
    lineHeight: 15,
    color: "#786e68",
    marginTop: 3,
  },
  countBadge: {
    width: 55,
    height: 55,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#d8d0cb",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  countValue: { fontFamily: "serif", fontSize: 17, fontWeight: "700" },
  countLabel: {
    fontSize: 4.5,
    fontWeight: "900",
    letterSpacing: 0.7,
    color: "#897d77",
  },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metricCard: {
    flexGrow: 1,
    flexBasis: 210,
    minWidth: 170,
    minHeight: 153,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5ddd9",
    padding: 16,
    overflow: "hidden",
  },
  metricDark: { backgroundColor: "#1d1617", borderColor: "#1d1617" },
  metricRed: { backgroundColor: RED, borderColor: RED },
  metricIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: "#f6e7eb",
    alignItems: "center",
    justifyContent: "center",
  },
  metricIconOnDark: { backgroundColor: "rgba(255,255,255,.12)" },
  metricLabel: {
    fontSize: 6,
    fontWeight: "900",
    letterSpacing: 1.2,
    color: "#766b65",
    marginTop: 15,
  },
  metricValue: {
    fontFamily: "serif",
    fontSize: 25,
    lineHeight: 30,
    fontWeight: "700",
    color: "#171310",
    marginTop: 1,
  },
  metricDetail: { fontSize: 8, color: "#81756f", marginTop: 3 },
  twoColumn: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 13 },
  panel: {
    flexGrow: 1,
    flexBasis: 380,
    minWidth: 280,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5ddd9",
    padding: 17,
  },
  panelHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  panelEyebrow: {
    fontSize: 5.5,
    fontWeight: "900",
    letterSpacing: 1.1,
    color: RED,
  },
  panelTitle: {
    fontFamily: "serif",
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "700",
    marginTop: 2,
  },
  panelLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 8,
  },
  panelLinkText: { fontSize: 8, fontWeight: "800" },
  listRow: {
    minHeight: 61,
    borderTopWidth: 1,
    borderTopColor: "#f0ebe8",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  listIcon: {
    width: 35,
    height: 35,
    borderRadius: 12,
    backgroundColor: "#f9ecef",
    alignItems: "center",
    justifyContent: "center",
  },
  listProductImage: {
    width: 35,
    height: 35,
    borderRadius: 10,
    backgroundColor: "#f5f2f0",
  },
  listTitle: { fontSize: 9.5, fontWeight: "900", color: "#211b18" },
  listMeta: { fontSize: 7, color: "#8a7f79", marginTop: 2 },
  listAmount: { fontSize: 9, fontWeight: "900", marginBottom: 3 },
  statusPill: {
    height: 20,
    borderRadius: 10,
    backgroundColor: "#f1eeec",
    paddingHorizontal: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
  },
  statusGood: { backgroundColor: "#e9f6ed" },
  statusWarning: { backgroundColor: "#fff1e5" },
  statusDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#918681",
  },
  statusDotGood: { backgroundColor: "#2b9a5c" },
  statusDotWarning: { backgroundColor: "#d27a21" },
  statusText: {
    fontSize: 4.8,
    fontWeight: "900",
    letterSpacing: 0.6,
    color: "#746a65",
  },
  statusTextGood: { color: "#267a4e" },
  statusTextWarning: { color: "#a95c15" },
  empty: {
    minHeight: 150,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  emptyTitle: {
    fontFamily: "serif",
    fontSize: 16,
    fontWeight: "700",
    marginTop: 8,
  },
  emptyText: {
    fontSize: 8,
    lineHeight: 12,
    color: "#8b817b",
    textAlign: "center",
    marginTop: 3,
  },
  toolbar: {
    height: 50,
    borderRadius: 16,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2dad6",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginBottom: 14,
  },
  toolbarInput: { flex: 1, minWidth: 0, height: 48, fontSize: 11 },
  livePill: {
    height: 25,
    borderRadius: 13,
    backgroundColor: "#edf7f0",
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#2da263" },
  liveText: {
    fontSize: 5,
    fontWeight: "900",
    letterSpacing: 0.8,
    color: "#176b43",
  },
  productAdminGrid: { flexDirection: "row", flexWrap: "wrap", gap: 11 },
  productAdminCard: {
    flexGrow: 1,
    flexBasis: 245,
    maxWidth: 340,
    minWidth: 220,
    minHeight: 310,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e3dcd8",
    padding: 14,
  },
  productAdminTop: {
    height: 116,
    borderRadius: 15,
    backgroundColor: "#f7f4f2",
    padding: 9,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  productAdminImage: { flex: 1, height: "100%" },
  productAdminBrand: {
    fontSize: 6,
    fontWeight: "900",
    letterSpacing: 1.2,
    color: RED,
    marginTop: 13,
  },
  productAdminName: {
    fontFamily: "serif",
    fontSize: 17,
    lineHeight: 21,
    fontWeight: "700",
    minHeight: 42,
    marginTop: 2,
  },
  productAdminMeta: {
    minHeight: 43,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#eee8e5",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  metaLabel: {
    fontSize: 4.8,
    fontWeight: "900",
    letterSpacing: 0.75,
    color: "#998d86",
  },
  metaValue: {
    fontSize: 7.5,
    fontWeight: "800",
    color: "#39302c",
    marginTop: 2,
  },
  metaDivider: { width: 1, height: 23, backgroundColor: "#eee8e5" },
  manageButton: {
    height: 39,
    borderRadius: 13,
    backgroundColor: "#201719",
    paddingHorizontal: 12,
    marginTop: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  manageButtonText: {
    fontSize: 7,
    fontWeight: "900",
    letterSpacing: 0.7,
    color: "#fff",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(18,12,12,.64)",
    padding: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBackdropPhone: { padding: 0, justifyContent: "flex-end" },
  editor: {
    width: "100%",
    maxWidth: 560,
    maxHeight: "92%",
    borderRadius: 24,
    backgroundColor: "#f8f5f3",
    overflow: "hidden",
  },
  editorPhone: { maxWidth: "100%", maxHeight: "100%", height: "100%", borderRadius: 0 },
  editorHead: {
    padding: 19,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e7e0dc",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  editorTitle: {
    fontFamily: "serif",
    fontSize: 23,
    lineHeight: 28,
    fontWeight: "700",
    marginTop: 3,
  },
  editorMeta: { fontSize: 7, color: "#8e837d", marginTop: 3 },
  closeButton: {
    width: 48,
    height: 48,
    borderRadius: 13,
    backgroundColor: "#f4f0ee",
    alignItems: "center",
    justifyContent: "center",
  },
  editorBody: { padding: 19 },
  editorToggleRow: {
    minHeight: 66,
    borderRadius: 16,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e3dcd8",
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  editorHelp: { fontSize: 8, color: "#8a7e78", marginTop: 3 },
  toggle: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#d7cfcb",
    padding: 3,
  },
  toggleActive: { backgroundColor: "#2f9c61" },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#fff",
  },
  toggleKnobActive: { marginLeft: 18 },
  editorInput: {
    height: 48,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#dcd3ce",
    backgroundColor: "#fff",
    paddingHorizontal: 13,
    fontSize: 12,
    marginTop: 7,
  },
  productImagePreview: { width: "100%", height: 150, borderRadius: 14, backgroundColor: "#fff", marginTop: 9 },
  confirmBackdrop: { flex: 1, backgroundColor: "rgba(18,12,12,.64)", padding: 18, alignItems: "center", justifyContent: "center" },
  confirmDialog: { width: "100%", maxWidth: 430, borderRadius: 22, backgroundColor: "#fff", padding: 22 },
  confirmIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: "#fff0f4", alignItems: "center", justifyContent: "center" },
  confirmTitle: { fontFamily: "serif", fontSize: 23, fontWeight: "700", color: "#211719", marginTop: 14 },
  confirmText: { fontSize: 13, lineHeight: 20, color: "#70645e", marginTop: 7 },
  confirmError: { fontSize: 12, lineHeight: 18, color: RED, marginTop: 10 },
  confirmActions: { flexDirection: "row", gap: 9, marginTop: 20 },
  dangerButton: { minHeight: 48, borderRadius: 14, backgroundColor: RED, flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  priceHead: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginTop: 13,
    marginBottom: 7,
  },
  priceCurrency: {
    fontSize: 6,
    fontWeight: "900",
    letterSpacing: 1,
    color: "#837771",
  },
  priceRow: {
    height: 49,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 7,
  },
  sizeBadge: {
    width: 62,
    height: 45,
    borderRadius: 12,
    backgroundColor: "#211719",
    alignItems: "center",
    justifyContent: "center",
  },
  sizeBadgeText: { fontSize: 8, fontWeight: "900", color: "#fff" },
  priceInput: {
    flex: 1,
    minWidth: 0,
    height: 45,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#dcd3ce",
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    fontSize: 12,
  },
  removePrice: {
    width: 43,
    height: 43,
    borderRadius: 12,
    backgroundColor: "#f8e9ed",
    alignItems: "center",
    justifyContent: "center",
  },
  addSizeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 13,
  },
  addSizeButton: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: RED,
    alignItems: "center",
    justifyContent: "center",
  },
  editorError: {
    fontSize: 8.5,
    lineHeight: 13,
    fontWeight: "700",
    color: RED,
    marginTop: 10,
  },
  editorFooter: {
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: "#e2dad6",
    backgroundColor: "#fff",
    flexDirection: "row",
    gap: 8,
  },
  secondaryButton: {
    height: 47,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d8d0cb",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  secondaryButtonText: { fontSize: 8, fontWeight: "900" },
  primaryButton: {
    height: 47,
    borderRadius: 14,
    backgroundColor: RED,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryButtonText: {
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.7,
    color: "#fff",
  },
  filterRow: { gap: 7, paddingBottom: 14 },
  filterChip: {
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#d9d1cc",
    backgroundColor: "#fff",
    paddingHorizontal: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  filterChipActive: { backgroundColor: "#211719", borderColor: "#211719" },
  filterText: { fontSize: 8, fontWeight: "800", color: "#655b56" },
  filterTextActive: { color: "#fff" },
  orderList: { gap: 10 },
  orderCard: {
    borderRadius: 19,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2dad6",
    padding: 15,
  },
  orderHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  orderNumber: { fontFamily: "serif", fontSize: 17, fontWeight: "700" },
  orderDate: { fontSize: 7, color: "#8b807a", marginTop: 2 },
  orderCustomer: {
    minHeight: 62,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#eee8e5",
    marginTop: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  customerAvatar: {
    width: 35,
    height: 35,
    borderRadius: 12,
    backgroundColor: "#f5e8eb",
    alignItems: "center",
    justifyContent: "center",
  },
  customerAvatarText: {
    fontFamily: "serif",
    fontSize: 14,
    fontWeight: "700",
    color: RED,
  },
  customerName: { fontSize: 9.5, fontWeight: "900" },
  customerMeta: { fontSize: 7, color: "#8b807a", marginTop: 2 },
  orderTotal: { fontSize: 13, fontWeight: "900" },
  orderDetails: {
    borderBottomWidth: 1,
    borderBottomColor: "#eee8e5",
    paddingVertical: 13,
    gap: 10,
  },
  orderDetailGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  orderDetailBlock: {
    flex: 1,
    minWidth: 210,
    borderRadius: 13,
    backgroundColor: "#f8f5f3",
    padding: 11,
  },
  orderDetailValue: {
    fontSize: 8.5,
    lineHeight: 13,
    fontWeight: "700",
    color: "#3f3631",
    marginTop: 4,
  },
  orderDetailMeta: {
    fontSize: 7,
    lineHeight: 11,
    color: "#897d77",
    marginTop: 2,
  },
  orderItems: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#eee8e5",
    overflow: "hidden",
  },
  orderItemRow: {
    minHeight: 56,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderBottomWidth: 1,
    borderBottomColor: "#f2edeb",
  },
  orderItemImage: {
    width: 42,
    height: 42,
    borderRadius: 9,
    backgroundColor: "#f8f5f3",
  },
  orderItemImagePlaceholder: {
    width: 42,
    height: 42,
    borderRadius: 9,
    backgroundColor: "#f8f5f3",
    alignItems: "center",
    justifyContent: "center",
  },
  orderItemName: { fontSize: 8.5, fontWeight: "800", color: "#2c2521" },
  orderItemMeta: { fontSize: 6.5, color: "#8b8079", marginTop: 2 },
  orderItemPrice: { fontSize: 8.5, fontWeight: "900", color: "#211b18" },
  orderNote: {
    borderRadius: 13,
    backgroundColor: "#fff3f6",
    padding: 11,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  shippingEditor: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#eee8e5",
    paddingVertical: 12,
    gap: 9,
  },
  shippingEditorHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  shippingEditorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  shippingInput: {
    flexGrow: 1,
    minWidth: 170,
    height: 38,
    borderWidth: 1,
    borderColor: "#ddd4cf",
    borderRadius: 9,
    backgroundColor: "#fff",
    paddingHorizontal: 10,
    fontSize: 8,
    color: "#2d2521",
  },
  shippingSave: {
    alignSelf: "flex-start",
    minWidth: 150,
    height: 36,
    borderRadius: 10,
    paddingHorizontal: 14,
    backgroundColor: "#211719",
    alignItems: "center",
    justifyContent: "center",
  },
  orderTotals: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 10,
  },
  orderWhatsapp: {
    height: 38,
    borderRadius: 12,
    backgroundColor: "#176b43",
    paddingHorizontal: 13,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  orderWhatsappText: { fontSize: 7, fontWeight: "900", color: "#fff" },
  orderFoot: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
  },
  orderDetailsToggle: {
    height: 36,
    paddingHorizontal: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  orderDetailsToggleText: { fontSize: 7, fontWeight: "900", color: "#4e433e" },
  orderActions: { flexDirection: "row", gap: 7, marginTop: 10 },
  orderCancel: {
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#dfd6d2",
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  orderCancelText: { fontSize: 7, fontWeight: "900", color: "#776c66" },
  orderRemove: {
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#efb6c2",
    backgroundColor: "#fff5f7",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  orderRemoveText: { fontSize: 7, fontWeight: "900", color: RED },
  orderAdvance: {
    minWidth: 122,
    height: 36,
    borderRadius: 12,
    backgroundColor: RED,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  orderAdvanceText: { fontSize: 7, fontWeight: "900", color: "#fff" },
  supportAdminList: { gap: 9 },
  supportAdminCard: {
    borderRadius: 18,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2dad6",
    padding: 14,
    flexDirection: "column",
    alignItems: "stretch",
    gap: 11,
  },
  supportAdminIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#f8e9ed",
    alignItems: "center",
    justifyContent: "center",
  },
  supportAdminCopy: { flex: 1, minWidth: 0 },
  supportTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  supportSubject: {
    flex: 1,
    fontFamily: "serif",
    fontSize: 16,
    fontWeight: "700",
  },
  supportCustomer: {
    fontSize: 8,
    fontWeight: "800",
    color: "#4f4540",
    marginTop: 5,
  },
  supportTime: { fontSize: 7, color: "#91857f", marginTop: 3 },
  supportActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 7,
    marginTop: 11,
  },
  resolveButton: {
    height: 28,
    borderRadius: 14,
    backgroundColor: "#eaf6ee",
    paddingHorizontal: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  resolveText: { fontSize: 6.5, fontWeight: "900", color: "#176b43" },
  urgentButton: {
    height: 28,
    borderRadius: 14,
    backgroundColor: "#fff0e5",
    paddingHorizontal: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  urgentText: { fontSize: 6.5, fontWeight: "900", color: "#a55a19" },
  settingsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  settingCard: {
    flexGrow: 1,
    flexBasis: 250,
    minWidth: 220,
    minHeight: 160,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2dad6",
    padding: 17,
  },
  settingIcon: {
    width: 39,
    height: 39,
    borderRadius: 13,
    backgroundColor: "#eaf6ee",
    alignItems: "center",
    justifyContent: "center",
  },
  settingLabel: {
    fontSize: 5.5,
    fontWeight: "900",
    letterSpacing: 1.1,
    color: RED,
    marginTop: 17,
  },
  settingValue: {
    fontFamily: "serif",
    fontSize: 18,
    lineHeight: 23,
    fontWeight: "700",
    marginTop: 3,
  },
  settingHelp: { fontSize: 8, lineHeight: 12, color: "#8b807a", marginTop: 3 },
  securityPanel: {
    minHeight: 87,
    borderRadius: 18,
    backgroundColor: "#f6e9ec",
    borderWidth: 1,
    borderColor: "#ead7dc",
    padding: 15,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11,
    marginTop: 12,
  },
  securityTitle: { fontSize: 10, fontWeight: "900", color: "#4f222c" },
  securityText: { fontSize: 8, lineHeight: 13, color: "#7f5660", marginTop: 3 },
});
