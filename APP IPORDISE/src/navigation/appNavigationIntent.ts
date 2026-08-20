export type AppNavigationIntent =
  | { type: "product"; id: string }
  | { type: "order"; id: string };

const cleanId = (value: string | null | undefined) => {
  const id = String(value || "").trim();
  return id && id.length <= 160 && /^[a-z0-9_.:-]+$/i.test(id) ? id : "";
};

export function parseAppNavigationIntent(value: string | null | undefined): AppNavigationIntent | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const productQuery = cleanId(url.searchParams.get("product"));
    const orderQuery = cleanId(url.searchParams.get("order") || url.searchParams.get("orderId"));
    if (productQuery) return { type: "product", id: productQuery };
    if (orderQuery) return { type: "order", id: orderQuery };

    const segments = [url.host, ...url.pathname.split("/")].filter(Boolean).map(segment => decodeURIComponent(segment));
    const productIndex = segments.findIndex(segment => segment.toLowerCase() === "product");
    const orderIndex = segments.findIndex(segment => ["order", "orders"].includes(segment.toLowerCase()));
    const productId = cleanId(segments[productIndex + 1]);
    const orderId = cleanId(segments[orderIndex + 1]);
    if (productIndex >= 0 && productId) return { type: "product", id: productId };
    if (orderIndex >= 0 && orderId) return { type: "order", id: orderId };
  } catch {
    return null;
  }
  return null;
}
