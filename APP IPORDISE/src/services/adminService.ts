import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { appConfig } from "../config";
import type { HomeConfig } from "../home/homeConfig";
import type { OfferHeroConfig } from "../offers/offerConfig";
import { createPromotionWindow } from "../offers/promotionLogic";
import type { HelpConfig } from "../help/helpConfig";
import type { ShopConfig } from "../shop/shopConfig";
import {
  clearRuntimeSettingsCache,
  RUNTIME_SETTINGS_DOCUMENT,
} from "./runtimeSettings";
import { publicFirestoreUrl } from "./firestoreRest";
import { rankBestsellerProductIds } from "./bestsellerRanking";

const SESSION_KEY = "ipordise-admin-session-v2-firebase";
const FIREBASE_AUTH = "https://identitytoolkit.googleapis.com/v1";
const FIREBASE_REFRESH = "https://securetoken.googleapis.com/v1/token";
const ADMIN_EMAIL = "admin@ipordise.com";

export type AdminRole = "admin" | "editor" | "support";
export type AdminSession = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: { id: string; email: string };
  role: AdminRole;
  remembered?: boolean;
};
export type AdminProduct = {
  id: string;
  name: string;
  brand: string;
  image: string;
  gallery: string[];
  sizes: Record<string, number>;
  base_sizes: Record<string, number>;
  original_prices: Record<string, number>;
  variant_stocks: Record<string, number | null>;
  stock_left: number | null;
  active: boolean;
  publication_status: "draft" | "active" | "archived";
  badge: string | null;
  description?: string | null;
  filters: string[];
  notes?: Record<string, string>;
  sort_order: number;
  offer_start: string | null;
  offer_end: string | null;
  offer_featured: boolean;
  offer_badge: string | null;
  offer_display_order: number;
  updated_at: string;
};
export type AdminProductPatch = Pick<
  AdminProduct,
  | "name"
  | "brand"
  | "image"
  | "description"
  | "notes"
  | "sizes"
  | "original_prices"
  | "stock_left"
  | "active"
> & {
  variant_stocks?: Record<string, number | null>;
  base_sizes?: Record<string, number>;
  offer_start?: string | null;
  offer_end?: string | null;
  offer_featured?: boolean;
  offer_badge?: string | null;
  offer_display_order?: number;
  notify_promotion?: boolean;
  badge?: string | null;
};
export type NewAdminProduct = {
  name: string;
  brand: string;
  image: string;
  size: string;
  price: number;
  stock: number | null;
  active: boolean;
  notes: Record<string, string>;
  promotion: boolean;
  originalPrice: number | null;
};
export type AdminOrder = {
  id: string;
  order_number: string | null;
  customer: {
    name?: string;
    phone?: string;
    email?: string;
    city?: string;
    address?: string;
  };
  items: {
    productId?: string;
    variantId?: string;
    name?: string;
    brand?: string;
    image?: string;
    size?: string;
    format?: string;
    sku?: string;
    quantity?: number;
    unitPrice?: number;
    lineTotal?: number;
  }[];
  subtotal: number;
  delivery_fee: number;
  discount: number;
  total: number;
  currency: string;
  payment_method: string;
  source: string;
  notes: string | null;
  status:
    | "pending"
    | "confirmed"
    | "processing"
    | "ready_for_dispatch"
    | "shipped"
    | "out_for_delivery"
    | "delivered"
    | "cancelled"
    | "return_requested"
    | "returned"
    | "delivery_failed";
  courier_code?: string | null;
  courier_name?: string | null;
  tracking_number?: string | null;
  tracking_url?: string | null;
  estimated_delivery?: string | null;
  shipped_at?: string | null;
  delivered_at?: string | null;
  status_history?: {
    from_status?: string;
    to_status: string;
    changed_by: string;
    created_at: string;
  }[];
  risk_score: number;
  risk_level: "low" | "review" | "high";
  risk_flags: string[];
  notification_status: "pending" | "sent" | "partial" | "failed" | "skipped";
  created_at: string;
};
export type AdminSupportMessage = {
  id: string;
  senderType: "customer" | "staff";
  body: string;
  createdAt: string;
};
export type AdminConversation = {
  id: string;
  customer_name: string;
  customer_email: string;
  order_number: string | null;
  subject: string;
  message: string;
  source: string;
  has_app_thread: boolean;
  status: "open" | "pending_customer" | "resolved" | "closed";
  priority: "low" | "normal" | "high" | "urgent";
  last_message_at: string;
};
export type AdminCustomer = {
  uid: string;
  profile: {
    firstName?: string;
    lastName?: string;
    displayName?: string;
    phone?: string;
    email?: string;
    city?: string;
  };
  createdAt: string;
  orderCount: number;
};
export type AdminSupportThread = {
  id: string;
  subject: string;
  status: AdminConversation["status"];
  messages: AdminSupportMessage[];
};
export type AdminListTotals = {
  products: number;
  orders: number;
  customers: number;
  conversations: number;
};
export type AdminDashboardData = {
  products: AdminProduct[];
  orders: AdminOrder[];
  customers: AdminCustomer[];
  conversations: AdminConversation[];
  totals: AdminListTotals;
  subscriberCount: number;
  settings: Record<string, unknown>;
};
export type AdminConnectionHealth = {
  firebase: "healthy" | "unavailable";
  runtime: "healthy" | "setup_required" | "unavailable";
  storefront: "healthy" | "unavailable";
  catalogSync: "healthy" | "unavailable";
  checkedAt: string;
};

export class AdminApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "AdminApiError";
  }
}

type JsonMap = Record<string, any>;
const firebaseConfig = () => ({
  key: appConfig.firebaseApiKey,
  root: appConfig.firestoreRoot,
});
const edgeFunctionConfig = (name: string) => {
  if (!appConfig.supabaseUrl || !appConfig.supabasePublishableKey)
    throw new AdminApiError(
      "The protected administration API is not configured.",
    );
  return {
    url: `${appConfig.supabaseUrl}/functions/v1/${name}`,
    key: appConfig.supabasePublishableKey,
  };
};
const parseResponse = async <T>(response: Response): Promise<T> => {
  const text = await response.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {}
  if (!response.ok) {
    const detail =
      body?.error?.message ||
      body?.error?.status ||
      (typeof body?.error === "string" ? body.error : "");
    throw new AdminApiError(
      response.status === 401 || response.status === 403
        ? "Your Firebase administrator session is not authorized."
        : detail ||
          "The administration service could not complete this request.",
      response.status,
    );
  }
  return body as T;
};
const saveStoredSession = async (session: AdminSession | null) => {
  const value = session ? JSON.stringify(session) : null;
  if (Platform.OS === "web" && typeof localStorage !== "undefined") {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    if (value)
      (session?.remembered ? localStorage : sessionStorage).setItem(
        SESSION_KEY,
        value,
      );
    return;
  }
  if (value && session?.remembered)
    await SecureStore.setItemAsync(SESSION_KEY, value);
  else await SecureStore.deleteItemAsync(SESSION_KEY);
};
const readStoredSession = async () => {
  try {
    const value =
      Platform.OS === "web" && typeof localStorage !== "undefined"
        ? (localStorage.getItem(SESSION_KEY) ??
          sessionStorage.getItem(SESSION_KEY))
        : await SecureStore.getItemAsync(SESSION_KEY);
    return value ? (JSON.parse(value) as AdminSession) : null;
  } catch {
    return null;
  }
};
const verifyAdmin = async (session: AdminSession) => {
  const { key } = firebaseConfig();
  const body = await parseResponse<any>(
    await fetch(
      `${FIREBASE_AUTH}/accounts:lookup?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: session.accessToken }),
      },
    ),
  );
  const user = body.users?.[0];
  if (!user || String(user.email || "").toLowerCase() !== ADMIN_EMAIL)
    throw new AdminApiError(
      "This account does not have IPORDISE administrator access.",
      403,
    );
  return {
    ...session,
    user: { id: user.localId, email: user.email },
    role: "admin" as const,
  };
};

export async function signInAdmin(
  email: string,
  password: string,
  remembered = false,
) {
  const { key } = firebaseConfig();
  const body = await parseResponse<any>(
    await fetch(
      `${FIREBASE_AUTH}/accounts:signInWithPassword?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          returnSecureToken: true,
        }),
      },
    ),
  );
  const session = await verifyAdmin({
    accessToken: body.idToken,
    refreshToken: body.refreshToken,
    expiresAt: Date.now() + Math.max(60, Number(body.expiresIn || 3600)) * 1000,
    user: { id: body.localId, email: body.email || "" },
    role: "admin",
    remembered,
  });
  await saveStoredSession(session);
  return session;
}
const refreshAdminSession = async (session: AdminSession) => {
  const { key } = firebaseConfig();
  const body = await parseResponse<any>(
    await fetch(`${FIREBASE_REFRESH}?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: session.refreshToken,
      }).toString(),
    }),
  );
  const refreshed = await verifyAdmin({
    accessToken: body.id_token,
    refreshToken: body.refresh_token,
    expiresAt:
      Date.now() + Math.max(60, Number(body.expires_in || 3600)) * 1000,
    user: { id: body.user_id, email: session.user.email },
    role: "admin",
    remembered: session.remembered,
  });
  await saveStoredSession(refreshed);
  return refreshed;
};
export async function restoreAdminSession() {
  const session = await readStoredSession();
  if (!session) return null;
  try {
    return session.expiresAt <= Date.now() + 60_000
      ? await refreshAdminSession(session)
      : await verifyAdmin(session);
  } catch {
    await saveStoredSession(null);
    return null;
  }
}
export async function signOutAdmin(_session: AdminSession | null) {
  await saveStoredSession(null);
}

const decodeValue = (value: any): any => {
  if (!value || typeof value !== "object") return value;
  if ("stringValue" in value) return value.stringValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("timestampValue" in value) return value.timestampValue;
  if ("nullValue" in value) return null;
  if ("arrayValue" in value)
    return (value.arrayValue.values || []).map(decodeValue);
  if ("mapValue" in value) return decodeFields(value.mapValue.fields || {});
  return undefined;
};
const decodeFields = (fields: JsonMap) =>
  Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, decodeValue(value)]),
  );
const encodeValue = (value: any): any => {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number")
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  if (typeof value === "string") return { stringValue: value };
  if (Array.isArray(value))
    return { arrayValue: { values: value.map(encodeValue) } };
  if (typeof value === "object")
    return { mapValue: { fields: encodeFields(value) } };
  return { stringValue: String(value) };
};
const encodeFields = (value: JsonMap) =>
  Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, encodeValue(item)]),
  );
const firestoreHeaders = (session: AdminSession) => ({
  Authorization: `Bearer ${session.accessToken}`,
  "Content-Type": "application/json",
});
const listCollection = async (
  session: AdminSession,
  collection: string,
  limit = 100,
): Promise<JsonMap[]> => {
  const { root, key } = firebaseConfig();
  const query = new URLSearchParams({
    key,
    pageSize: String(Math.max(1, Math.min(100, limit))),
  });
  const body = await parseResponse<any>(
    await fetch(`${root}/${collection}?${query}`, {
      headers: firestoreHeaders(session),
    }),
  );
  return (body.documents || []).map((document: any) => ({
    id: String(document.name).split("/").pop() || "",
    ...decodeFields(document.fields || {}),
  }));
};
const getDocument = async (
  session: AdminSession,
  path: string,
): Promise<JsonMap> => {
  const { root, key } = firebaseConfig();
  const response = await fetch(
    `${root}/${path}?key=${encodeURIComponent(key)}`,
    { headers: firestoreHeaders(session) },
  );
  if (response.status === 404) return {};
  const body = await parseResponse<any>(response);
  return {
    id:
      String(body.name || "")
        .split("/")
        .pop() || "",
    ...decodeFields(body.fields || {}),
  };
};
const patchDocument = async (
  session: AdminSession,
  path: string,
  patch: JsonMap,
) => {
  const { root, key } = firebaseConfig();
  const query = new URLSearchParams({ key });
  Object.keys(patch).forEach((field) =>
    query.append("updateMask.fieldPaths", field),
  );
  const body = await parseResponse<any>(
    await fetch(`${root}/${path}?${query}`, {
      method: "PATCH",
      headers: firestoreHeaders(session),
      body: JSON.stringify({ fields: encodeFields(patch) }),
    }),
  );
  return {
    id: String(body.name || "")
      .split("/")
      .pop(),
    ...decodeFields(body.fields || {}),
  };
};
const syncCatalogProduct = async (
  session: AdminSession,
  id: string,
  value: JsonMap,
) => {
  const api = edgeFunctionConfig("admin-catalog-sync");
  return parseResponse(
    await fetch(api.url, {
      method: "POST",
      headers: {
        apikey: api.key,
        Authorization: `Bearer ${session.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ section: "products", id, value }),
    }),
  );
};
type AdminPage<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
};
const loadAdminPage = async (
  session: AdminSession,
  functionName: string,
  field: "products" | "orders" | "customers",
  pageSize: number,
  query: Record<string, string | number | undefined> = {},
): Promise<AdminPage<JsonMap>> => {
  const api = edgeFunctionConfig(functionName);
  const search = new URLSearchParams({ page: "1", pageSize: String(pageSize) });
  for (const [key, value] of Object.entries(query))
    if (value !== undefined && String(value).trim())
      search.set(key, String(value));
  const body = await parseResponse<any>(
    await fetch(`${api.url}?${search}`, {
      headers: {
        apikey: api.key,
        Authorization: `Bearer ${session.accessToken}`,
        Accept: "application/json",
      },
      cache: "no-store",
    }),
  );
  const items = Array.isArray(body[field]) ? body[field] : [];
  return {
    items,
    page: Number(body.pagination?.page || 1),
    pageSize: Number(body.pagination?.pageSize || pageSize),
    total: Math.max(items.length, Number(body.pagination?.total || 0)),
  };
};
const loadAdminCatalog = (session: AdminSession) =>
  loadAdminPage(session, "admin-catalog-sync", "products", 100);
const loadLegacyAdminOrders = (session: AdminSession) =>
  loadAdminPage(session, "admin-orders", "orders", 50);
const loadAdminCustomers = (session: AdminSession) =>
  loadAdminPage(session, "admin-customers", "customers", 50);
const patchLegacyAdminOrder = async (
  session: AdminSession,
  id: string,
  patch: { status: AdminOrder["status"] } | AdminOrderShippingPatch,
) => {
  const api = edgeFunctionConfig("admin-orders");
  const body = await parseResponse<{ order: JsonMap }>(
    await fetch(api.url, {
      method: "PATCH",
      headers: {
        apikey: api.key,
        Authorization: `Bearer ${session.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id, ...patch }),
    }),
  );
  return body.order;
};
const loadAdminOrders = (session: AdminSession) =>
  loadLegacyAdminOrders(session);
const patchAdminOrder = async (
  session: AdminSession,
  id: string,
  status: AdminOrder["status"],
) => {
  if (!/^[0-9a-f-]{36}$/i.test(id))
    throw new AdminApiError(
      "This historical order must be migrated before it can be updated.",
      409,
    );
  return patchLegacyAdminOrder(session, id, { status });
};
export type AdminOrderShippingPatch = {
  courierCode: string | null;
  courierName: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  estimatedDelivery: string | null;
};
const dateValue = (value: any) => {
  if (typeof value === "string" && value) return value;
  if (value?.seconds)
    return new Date(Number(value.seconds) * 1000).toISOString();
  return new Date(0).toISOString();
};
const adminProductPricing = (raw: JsonMap) => {
  const fallbackSizes = raw.sizes || {};
  const fallbackOriginalPrices = raw.original_prices || raw.originalPrices || {};
  const variants = Array.isArray(raw.product_variants) ? raw.product_variants : [];
  if (!variants.length)
    return { sizes: fallbackSizes, originalPrices: fallbackOriginalPrices };
  const sizes: Record<string, number> = {};
  const originalPrices: Record<string, number> = {};
  variants.forEach((variant: any) => {
    const size = String(variant?.size_key || "").trim().toLowerCase().replace(/\s+/g, "");
    const price = Number(variant?.price_minor) / 100;
    const compareAt = variant?.compare_at_price_minor == null
      ? 0
      : Number(variant.compare_at_price_minor) / 100;
    if (!size || !Number.isFinite(price) || price < 0) return;
    sizes[size] = price;
    if (Number.isFinite(compareAt) && compareAt > price)
      originalPrices[size] = compareAt;
  });
  return Object.keys(sizes).length
    ? { sizes, originalPrices }
    : { sizes: fallbackSizes, originalPrices: fallbackOriginalPrices };
};
const mapProduct = (raw: JsonMap): AdminProduct => {
  const pricing = adminProductPricing(raw);
  return {
    id: raw.id,
    name: raw.name || raw.id,
    brand: String(raw.brand || "IPORDISE").toUpperCase(),
    image: raw.image || (Array.isArray(raw.images) ? raw.images[0] : "") || "",
    gallery: Array.isArray(raw.gallery)
      ? raw.gallery
      : Array.isArray(raw.images)
        ? raw.images
        : [],
    sizes: pricing.sizes,
    base_sizes:
      raw.base_sizes && typeof raw.base_sizes === "object"
        ? raw.base_sizes
        : Object.keys(pricing.originalPrices).length
          ? { ...pricing.sizes, ...pricing.originalPrices }
          : pricing.sizes,
    original_prices: pricing.originalPrices,
    variant_stocks: Object.fromEntries(
      (Array.isArray(raw.product_variants) ? raw.product_variants : []).map(
        (variant: any) => [
          String(variant.size_key),
          variant.stock_quantity == null ? null : Number(variant.stock_quantity),
        ],
      ),
    ),
    stock_left: raw.stock_left ?? raw.stockLeft ?? null,
    active: raw.active !== false,
    publication_status: ["draft", "archived"].includes(raw.publication_status)
      ? raw.publication_status
      : "active",
    badge: raw.badge || null,
    description: raw.description || null,
    filters: Array.isArray(raw.filters) ? raw.filters : [],
    notes: raw.notes && typeof raw.notes === "object" ? raw.notes : {},
    sort_order: Number(raw.sort_order ?? raw.sortOrder ?? 0),
    offer_start: raw.offer_start || raw.offerStart || null,
    offer_end: raw.offer_end || raw.offerEnd || null,
    offer_featured: raw.offer_featured === true || raw.offerFeatured === true,
    offer_badge: raw.offer_badge || raw.offerBadge || null,
    offer_display_order: Number(
      raw.offer_display_order ?? raw.offerDisplayOrder ?? 100,
    ),
    updated_at: dateValue(raw.updated_at || raw.updatedAt),
  };
};
const mapOrder = (raw: JsonMap): AdminOrder => {
  const customer = raw.customer || {};
  const summary = raw.summary || {};
  return {
    id: raw.id,
    order_number: raw.order_number || raw.orderId || raw.orderNumber || raw.id,
    customer: {
      name:
        customer.name ||
        `${customer.firstName || ""} ${customer.lastName || ""}`.trim(),
      phone: customer.phone,
      email: customer.email,
      city: customer.city,
      address: customer.address,
    },
    items: (raw.items || []).map((item: any) => ({
      ...item,
      quantity: item.quantity ?? item.qty,
      unitPrice: item.unitPrice ?? item.price,
      lineTotal:
        item.lineTotal ?? Number(item.price || 0) * Number(item.qty || 1),
    })),
    subtotal: Number(raw.subtotal ?? summary.subtotal ?? 0),
    delivery_fee: Number(
      raw.delivery_fee ?? raw.deliveryFee ?? summary.shipping ?? 0,
    ),
    discount: Number(raw.discount || 0),
    total: Number(raw.total ?? summary.total ?? 0),
    currency: raw.currency || "MAD",
    payment_method:
      raw.payment_method ||
      raw.paymentMethod ||
      raw.channel ||
      "cash_on_delivery",
    source: raw.source || "website",
    notes: raw.notes || customer.notes || null,
    status: raw.status || "pending",
    courier_code: raw.courier_code ?? null,
    courier_name: raw.courier_name ?? null,
    tracking_number: raw.tracking_number ?? null,
    tracking_url: raw.tracking_url ?? null,
    estimated_delivery: raw.estimated_delivery ?? null,
    shipped_at: raw.shipped_at ?? null,
    delivered_at: raw.delivered_at ?? null,
    status_history: Array.isArray(raw.order_status_history)
      ? raw.order_status_history
      : undefined,
    risk_score: Number(raw.risk_score || 0),
    risk_level:
      raw.risk_level === "high"
        ? "high"
        : raw.risk_level === "review"
          ? "review"
          : "low",
    risk_flags: Array.isArray(raw.risk_flags) ? raw.risk_flags : [],
    notification_status: ["sent", "partial", "failed", "skipped"].includes(
      raw.notification_status,
    )
      ? raw.notification_status
      : "pending",
    created_at: dateValue(raw.created_at || raw.createdAt),
  };
};
const mapConversation = (raw: JsonMap): AdminConversation => ({
  id: raw.id,
  customer_name: raw.name || "Customer",
  customer_email: raw.email || "",
  order_number: raw.orderNumber || null,
  subject: raw.subject || "Customer message",
  message: raw.message || "",
  source: raw.source || "website",
  has_app_thread: Boolean(raw.hasAppThread || raw.source === "ipordise-app"),
  status: raw.status || (raw.read === true ? "resolved" : "open"),
  priority: raw.priority || "normal",
  last_message_at: dateValue(raw.lastMessageAt || raw.createdAt),
});

const callSupportInbox = async <T>(session: AdminSession, payload: JsonMap) => {
  const api = edgeFunctionConfig("support-inbox");
  return parseResponse<T>(
    await fetch(api.url, {
      method: "POST",
      headers: {
        apikey: api.key,
        Authorization: `Bearer ${session.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }),
  );
};
const loadCanonicalSupport = async (session: AdminSession) => {
  const body = await callSupportInbox<any>(session, {
    action: "admin_list",
    status: "all",
    page: 1,
    pageSize: 50,
  });
  const items = Array.isArray(body.conversations) ? body.conversations : [];
  return {
    items,
    total: Math.max(items.length, Number(body.pagination?.total || 0)),
  };
};
const loadSubscriberCount = async (session: AdminSession) => {
  const api = edgeFunctionConfig("newsletter-subscribe");
  const body = await parseResponse<{ count: number }>(
    await fetch(api.url, {
      method: "POST",
      headers: {
        apikey: api.key,
        Authorization: `Bearer ${session.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "admin_count" }),
    }),
  );
  return Math.max(0, Number(body.count || 0));
};

export async function loadAdminDashboard(
  session: AdminSession,
): Promise<AdminDashboardData> {
  const emptyPage: AdminPage<JsonMap> = {
    items: [],
    page: 1,
    pageSize: 0,
    total: 0,
  };
  const [
    productsPage,
    ordersPage,
    customersPage,
    legacyMessages,
    canonicalSupport,
    subscriberCount,
    privateSettings,
    publicSettings,
  ] = await Promise.all([
    loadAdminCatalog(session).catch(() => emptyPage),
    loadAdminOrders(session),
    loadAdminCustomers(session).catch(() => emptyPage),
    listCollection(session, "contactMessages", 50).catch(() => []),
    loadCanonicalSupport(session).catch(() => emptyPage),
    loadSubscriberCount(session).catch(() => 0),
    getDocument(session, "admin_config/settings").catch((): JsonMap => ({})),
    getDocument(session, RUNTIME_SETTINGS_DOCUMENT).catch((): JsonMap => ({})),
  ]);
  const selectedSettings =
    Object.keys(privateSettings).length > 1 ? privateSettings : publicSettings;
  const {
    id: _,
    system: __,
    active: ___,
    updatedAt: ____,
    ...settings
  } = selectedSettings;
  const conversations = [
    ...canonicalSupport.items.map((item: JsonMap) =>
      mapConversation({
        ...item,
        name: item.customer_name,
        email: item.customer_email,
        orderNumber: item.order_number,
        lastMessageAt: item.last_message_at,
        source: "ipordise-app",
        hasAppThread: true,
      }),
    ),
    ...legacyMessages.map((message) =>
      mapConversation({ ...message, hasAppThread: false }),
    ),
  ];
  return {
    products: productsPage.items
      .map(mapProduct)
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
    orders: ordersPage.items
      .map(mapOrder)
      .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    customers: customersPage.items.map(
      (item): AdminCustomer => ({
        uid: String(item.uid || ""),
        profile:
          item.profile && typeof item.profile === "object" ? item.profile : {},
        createdAt: dateValue(item.createdAt),
        orderCount: Number(item.orderCount || 0),
      }),
    ),
    conversations: conversations.sort((a, b) =>
      b.last_message_at.localeCompare(a.last_message_at),
    ),
    totals: {
      products: productsPage.total,
      orders: ordersPage.total,
      customers: customersPage.total,
      conversations: canonicalSupport.total + legacyMessages.length,
    },
    subscriberCount,
    settings,
  };
}
export async function updateAdminProduct(
  session: AdminSession,
  id: string,
  patch: AdminProductPatch,
  current?: AdminProduct,
): Promise<AdminProduct> {
  if (!current)
    throw new AdminApiError(
      "The product must be reloaded before it can be updated.",
    );
  const variantStocks =
    patch.variant_stocks ??
    Object.fromEntries(
      Object.keys(patch.sizes).map((size) => [size, patch.stock_left]),
    );
  const gallery = [
    patch.image,
    ...current.gallery.filter((image) => image !== patch.image),
  ].slice(0, 12);
  const value = {
    name: patch.name,
    brand: patch.brand,
    image: patch.image,
    images: gallery,
    sizes: patch.sizes,
    baseSizes: patch.base_sizes ?? current.base_sizes,
    originalPrices: patch.original_prices,
    variantStocks,
    stockLeft: patch.stock_left,
    active: patch.active,
    publicationStatus: patch.active ? "active" : "archived",
    badge: patch.badge === undefined ? current.badge : patch.badge,
    description: patch.description,
    filters: current.filters,
    notes: patch.notes,
    offerStart: patch.offer_start ?? current.offer_start,
    offerEnd: patch.offer_end ?? current.offer_end,
    offerFeatured: patch.offer_featured ?? current.offer_featured,
    offerBadge: patch.offer_badge ?? current.offer_badge,
    offerDisplayOrder:
      patch.offer_display_order ?? current.offer_display_order,
    notifyPromotion: patch.notify_promotion === true,
  };
  await syncCatalogProduct(session, id, value);
  return {
    ...current,
    ...patch,
    gallery,
    variant_stocks: variantStocks,
    base_sizes: patch.base_sizes ?? current.base_sizes,
    publication_status: patch.active ? "active" : "archived",
    badge: patch.badge === undefined ? current.badge : patch.badge,
    offer_start: patch.offer_start ?? current.offer_start,
    offer_end: patch.offer_end ?? current.offer_end,
    offer_featured: patch.offer_featured ?? current.offer_featured,
    offer_badge: patch.offer_badge ?? current.offer_badge,
    offer_display_order:
      patch.offer_display_order ?? current.offer_display_order,
    updated_at: new Date().toISOString(),
  };
}
export async function createAdminProduct(
  session: AdminSession,
  input: NewAdminProduct,
): Promise<AdminProduct> {
  const base =
    input.name
      .trim()
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 100) || "fragrance";
  const id = `${base}-${crypto.randomUUID().slice(0, 8)}`;
  const size = input.size.trim().toLowerCase().replace(/\s+/g, "");
  const promotionPriceIsValid =
    !input.promotion ||
    (input.originalPrice !== null &&
      Number.isFinite(input.originalPrice) &&
      input.originalPrice > input.price);
  if (
    input.name.trim().length < 2 ||
    input.brand.trim().length < 2 ||
    !/^https:\/\//i.test(input.image) ||
    !/^\d+(?:\.\d+)?ml$/.test(size) ||
    !Number.isFinite(input.price) ||
    input.price <= 0 ||
    !promotionPriceIsValid
  )
    throw new AdminApiError(
      "Complete the product details. A promotion also needs an original price above its sale price.",
    );
  const promotionWindow = input.promotion ? createPromotionWindow() : null;
  const publishNow = input.active || input.promotion;
  const value = {
    name: input.name.trim(),
    brand: input.brand.trim().toUpperCase(),
    image: input.image.trim(),
    images: [input.image.trim()],
    sizes: { [size]: input.price },
    baseSizes: {
      [size]: input.promotion ? Number(input.originalPrice) : input.price,
    },
    originalPrices: input.promotion
      ? { [size]: Number(input.originalPrice) }
      : {},
    variantStocks: { [size]: input.stock },
    stockLeft: input.stock,
    active: publishNow,
    publicationStatus: publishNow ? "active" : "draft",
    createOnly: true,
    filters: ["new-in"],
    badge: input.promotion ? "48H OFFER" : "NEW",
    notes: input.notes,
    offerStart: promotionWindow?.startsAt ?? null,
    offerEnd: promotionWindow?.endsAt ?? null,
    offerFeatured: input.promotion,
    offerBadge: input.promotion ? "48H OFFER" : null,
    offerDisplayOrder: 100,
    notifyPromotion: input.promotion,
  };
  await syncCatalogProduct(session, id, value);
  return {
    id,
    name: value.name,
    brand: value.brand,
    image: value.image,
    gallery: value.images,
    sizes: value.sizes,
    base_sizes: value.baseSizes,
    original_prices: value.originalPrices,
    variant_stocks: value.variantStocks,
    stock_left: input.stock,
    active: publishNow,
    publication_status: publishNow ? "active" : "draft",
    badge: value.badge,
    description: null,
    filters: value.filters,
    notes: input.notes,
    sort_order: 100,
    offer_start: value.offerStart,
    offer_end: value.offerEnd,
    offer_featured: value.offerFeatured,
    offer_badge: value.offerBadge,
    offer_display_order: value.offerDisplayOrder,
    updated_at: new Date().toISOString(),
  };
}
export async function updateAdminOrderStatus(
  session: AdminSession,
  id: string,
  status: AdminOrder["status"],
) {
  return mapOrder(await patchAdminOrder(session, id, status));
}
export async function deleteAdminOrder(session: AdminSession, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id))
    throw new AdminApiError("This historical order cannot be removed.", 409);
  const api = edgeFunctionConfig("admin-orders");
  await parseResponse<{ deleted: { id: string; orderNumber: string } }>(
    await fetch(api.url, {
      method: "DELETE",
      headers: {
        apikey: api.key,
        Authorization: `Bearer ${session.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id }),
    }),
  );
}
export async function updateAdminOrderShipping(
  session: AdminSession,
  id: string,
  patch: AdminOrderShippingPatch,
) {
  if (!/^[0-9a-f-]{36}$/i.test(id))
    throw new AdminApiError("This historical order cannot store courier details.", 409);
  return mapOrder(await patchLegacyAdminOrder(session, id, patch));
}
export async function publishAdminBestsellerRanking(
  session: AdminSession,
  orders: AdminOrder[],
) {
  const ranking = rankBestsellerProductIds(orders);
  await patchDocument(session, "products/_bestsellers", {
    ranking,
    orderCount: orders.filter((order) => order.status !== "cancelled").length,
    updatedAt: new Date().toISOString(),
    system: true,
  });
  return ranking;
}
export async function updateAdminConversation(
  session: AdminSession,
  id: string,
  patch: Pick<AdminConversation, "status" | "priority">,
  canonical = true,
) {
  if (canonical) {
    await callSupportInbox(session, {
      action: "admin_update",
      conversationId: id,
      ...patch,
    });
    return patch;
  }
  const raw = await patchDocument(
    session,
    `contactMessages/${encodeURIComponent(id)}`,
    {
      status: patch.status,
      priority: patch.priority,
      read: ["resolved", "closed"].includes(patch.status),
    },
  );
  return mapConversation(raw);
}
export async function loadAdminSupportThread(
  session: AdminSession,
  conversation: AdminConversation,
): Promise<AdminSupportThread> {
  if (!conversation.has_app_thread)
    return {
      id: conversation.id,
      subject: conversation.subject,
      status: conversation.status,
      messages: conversation.message
        ? [
            {
              id: `legacy-${conversation.id}`,
              senderType: "customer",
              body: conversation.message,
              createdAt: conversation.last_message_at,
            },
          ]
        : [],
    };
  const thread = await callSupportInbox<any>(session, {
    action: "admin_thread",
    conversationId: conversation.id,
  });
  const messages: AdminSupportMessage[] = (
    Array.isArray(thread.messages) ? thread.messages : []
  ).map(
    (item: any): AdminSupportMessage => ({
      id: String(item.id || ""),
      senderType: item.senderType === "staff" ? "staff" : "customer",
      body: String(item.body || ""),
      createdAt: dateValue(item.createdAt),
    }),
  );
  return {
    id: conversation.id,
    subject: String(thread.subject || conversation.subject),
    status: thread.status || conversation.status,
    messages: messages.sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  };
}
export async function sendAdminSupportReply(
  session: AdminSession,
  conversation: AdminConversation,
  message: string,
) {
  const body = message.trim();
  if (!conversation.has_app_thread)
    throw new AdminApiError(
      "This request came from the website. Use Reply by email to contact this customer.",
    );
  if (!body) throw new AdminApiError("Write a reply before sending.");
  if (body.length > 4000)
    throw new AdminApiError("Keep the reply under 4,000 characters.");
  const thread = await callSupportInbox<any>(session, {
    action: "admin_reply",
    conversationId: conversation.id,
    message: body,
  });
  return {
    id: conversation.id,
    subject: String(thread.subject || conversation.subject),
    status: thread.status || "pending_customer",
    messages: (Array.isArray(thread.messages) ? thread.messages : []).map(
      (item: any): AdminSupportMessage => ({
        id: String(item.id || ""),
        senderType: item.senderType === "staff" ? "staff" : "customer",
        body: String(item.body || ""),
        createdAt: dateValue(item.createdAt),
      }),
    ),
  };
}
export async function checkAdminConnections(
  session: AdminSession,
): Promise<AdminConnectionHealth> {
  const [firebase, runtime, storefront, catalogSync] = await Promise.all([
    listCollection(session, "products")
      .then(() => true)
      .catch(() => false),
    fetch(publicFirestoreUrl(RUNTIME_SETTINGS_DOCUMENT), {
      headers: { Accept: "application/json", "Cache-Control": "no-cache" },
    })
      .then((response) =>
        response.status === 404
          ? "setup_required"
          : response.ok
            ? "healthy"
            : "unavailable",
      )
      .catch(() => "unavailable" as const),
    fetch(`${appConfig.storeOrigin}/catalog.json?health=${Date.now()}`, {
      mode: "no-cors",
      cache: "no-store",
    })
      .then((response) => response.ok || response.type === "opaque")
      .catch(() => false),
    Promise.resolve()
      .then(() => edgeFunctionConfig("admin-catalog-sync"))
      .then((api) =>
        fetch(`${api.url}?page=1&pageSize=1`, {
          headers: {
            apikey: api.key,
            Authorization: `Bearer ${session.accessToken}`,
            Accept: "application/json",
          },
          cache: "no-store",
        }),
      )
      .then((response) => response.ok)
      .catch(() => false),
  ]);
  return {
    firebase: firebase ? "healthy" : "unavailable",
    runtime,
    catalogSync: catalogSync ? "healthy" : "unavailable",
    storefront: storefront ? "healthy" : "unavailable",
    checkedAt: new Date().toISOString(),
  };
}
const updateSettings = async (
  session: AdminSession,
  current: Record<string, unknown>,
  patch: Record<string, unknown>,
) => {
  const {
    id: _,
    system: __,
    active: ___,
    updatedAt: ____,
    ...cleanCurrent
  } = current;
  const value = { ...cleanCurrent, ...patch };
  const publishedAt = new Date().toISOString();
  const publicValue = {
    homepage: value.homepage ?? null,
    offers: value.offers ?? null,
    help: value.help ?? null,
    shop: value.shop ?? null,
    system: true,
    active: false,
    updatedAt: publishedAt,
  };
  await Promise.all([
    patchDocument(session, "admin_config/settings", {
      ...value,
      updatedAt: publishedAt,
    }),
    patchDocument(session, RUNTIME_SETTINGS_DOCUMENT, publicValue),
  ]);
  clearRuntimeSettingsCache();
  return value;
};
export const updateAdminHomeConfig = (
  session: AdminSession,
  current: Record<string, unknown>,
  homepage: HomeConfig,
) => updateSettings(session, current, { homepage });
export const updateAdminStorefrontConfig = (
  session: AdminSession,
  current: Record<string, unknown>,
  homepage: HomeConfig,
  offers: OfferHeroConfig,
) => updateSettings(session, current, { homepage, offers });
export const updateAdminHelpConfig = (
  session: AdminSession,
  current: Record<string, unknown>,
  help: HelpConfig,
) => updateSettings(session, current, { help });
export const updateAdminShopConfig = (
  session: AdminSession,
  current: Record<string, unknown>,
  shop: ShopConfig,
) => updateSettings(session, current, { shop });
