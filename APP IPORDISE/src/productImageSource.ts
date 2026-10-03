import { Platform, type ImageSourcePropType } from 'react-native';
import { bundledProductImages } from './generated/productImages';

export function normalizeProductImageUrl(value: string): string {
  try {
    const url = new URL(value.trim().replace(/\\/g, '/'), 'https://ipordise.com');
    if (url.protocol === 'http:' && ['ipordise.com', 'www.ipordise.com', 'res.cloudinary.com'].includes(url.hostname)) url.protocol = 'https:';
    if (url.protocol !== 'https:') return '';
    return url.href;
  } catch { return ''; }
}

export function productImageSource(value: string): ImageSourcePropType {
  const uri = normalizeProductImageUrl(value);
  if (uri && Platform.OS !== 'web') {
    const url = new URL(uri);
    if (['ipordise.com', 'www.ipordise.com'].includes(url.hostname) && !url.search) {
      let pathname = url.pathname;
      try { pathname = decodeURIComponent(pathname); } catch { /* Keep a malformed escape remote. */ }
      const local = bundledProductImages[pathname];
      if (local) return local;
    }
  }
  return { uri };
}
