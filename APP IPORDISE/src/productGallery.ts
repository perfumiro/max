import websiteCatalog from '../website-ipordise/catalog.json';

type CatalogProduct = {
  id?: string;
  slug?: string;
  image?: string;
  gallery?: string[];
};

type CatalogPayload = { products?: CatalogProduct[] };

const supportedFallbackImage = /\.(?:jpe?g|png|webp)(?:[?#].*)?$/i;
const catalogProducts = Array.isArray((websiteCatalog as CatalogPayload).products)
  ? (websiteCatalog as CatalogPayload).products!
  : [];

const galleryFallbacks = new Map(
  catalogProducts.flatMap(product => {
    const id = String(product.id || product.slug || '').trim();
    if (!id) return [];
    const gallery = (Array.isArray(product.gallery) ? product.gallery : [product.image])
      .filter((image): image is string => typeof image === 'string' && supportedFallbackImage.test(image));
    return [[id, gallery] as const];
  })
);

const comparableImage = (image: string) => {
  try {
    const url = new URL(image, 'https://www.ipordise.com');
    return `${url.pathname}${url.search}`.toLocaleLowerCase();
  } catch {
    return image.trim().replace(/^\/+/, '/').toLocaleLowerCase();
  }
};

/**
 * Keeps the live catalogue authoritative while restoring secondary photography
 * from the bundled IPORDISE media catalogue when the API only returns a cover.
 */
export const mergeProductGallery = (
  productId: string,
  primaryImage: unknown,
  liveGallery: unknown
): string[] => {
  const liveImages = Array.isArray(liveGallery) ? liveGallery : [];
  const candidates = [primaryImage, ...liveImages, ...(galleryFallbacks.get(productId) || [])]
    .filter((image): image is string => typeof image === 'string' && image.trim().length > 0);
  const seen = new Set<string>();
  return candidates.filter(image => {
    const key = comparableImage(image);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const bundledGalleryCount = (productId: string) => galleryFallbacks.get(productId)?.length || 0;
