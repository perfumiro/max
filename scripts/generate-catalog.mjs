import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const storefront = fs.readFileSync(path.join(root, 'discover.html'), 'utf8');
const basePrices = JSON.parse(fs.readFileSync(path.join(root, 'prices.json'), 'utf8'));

const decode = (value = '') => value
  .replace(/&amp;/g, '&')
  .replace(/&quot;/g, '"')
  .replace(/&#39;|&apos;/g, "'")
  .replace(/&eacute;/g, 'é')
  .replace(/&Eacute;/g, 'É')
  .replace(/&ecirc;/g, 'ê')
  .replace(/&Ecirc;/g, 'Ê')
  .replace(/&iuml;/g, 'ï')
  .replace(/&ocirc;/g, 'ô')
  .replace(/&mdash;/g, '—')
  .replace(/&ndash;/g, '–');

const attr = (tag, name) => {
  const match = tag.match(new RegExp(`${name}="([^"]*)"`, 'i'));
  return decode(match?.[1] || '');
};

const parseDeclaredPrices = (value) => {
  const sizes = {};
  const pattern = /(\d+)\s*ML\s*([\d\s.,]+)\s*(?:DH|MAD)/gi;
  let match;
  while ((match = pattern.exec(value))) {
    const price = Number(match[2].replace(/\s/g, '').replace(',', '.'));
    if (price > 0) sizes[`${Number(match[1])}ml`] = price;
  }
  return sizes;
};

const galleryFor = (rawImage) => {
  if (!rawImage) return [];
  if (/^https?:\/\//i.test(rawImage)) return [rawImage];
  const relativeImage = rawImage.replace(/^\/+/, '');
  const imagePath = path.join(root, ...relativeImage.split('/'));
  const directory = path.dirname(imagePath);
  if (!fs.existsSync(directory)) return [`/${relativeImage}`];
  const supported = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.jfif']);
  const files = fs.readdirSync(directory)
    .filter((file) => supported.has(path.extname(file).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .slice(0, 6)
    .map((file) => `/${path.posix.join(path.posix.dirname(relativeImage), file)}`);
  return files.length ? files : [`/${relativeImage}`];
};

const products = [];
const seen = new Set();
const articlePattern = /<article\b[^>]*\bjs-product-link\b[^>]*>/gi;
let match;

while ((match = articlePattern.exec(storefront))) {
  const tag = match[0];
  const id = attr(tag, 'data-id');
  if (!id || seen.has(id)) continue;
  seen.add(id);

  const declared = attr(tag, 'data-product-price');
  const configured = basePrices[id] || {};
  const configuredPositive = Object.fromEntries(
    Object.entries(configured).filter(([, price]) => Number(price) > 0).map(([size, price]) => [size.toLowerCase(), Number(price)])
  );
  const sizes = Object.keys(configuredPositive).length ? configuredPositive : parseDeclaredPrices(declared);
  const filters = attr(tag, 'data-filters').split(',').map((item) => item.trim()).filter(Boolean);
  const image = attr(tag, 'data-product-image');
  const gallery = galleryFor(image);
  const reviewCount = Number(attr(tag, 'data-product-reviews')) || 0;

  products.push({
    id,
    slug: id,
    name: attr(tag, 'data-product-name') || id.replace(/-/g, ' '),
    brand: attr(tag, 'data-product-brand') || 'IPORDISE',
    image: gallery[0] || image,
    gallery,
    sizes,
    filters,
    badge: filters.includes('best-sellers') ? 'BESTSELLER' : filters.includes('offers') ? 'OFFER' : filters.includes('new-in') ? 'NEW' : '',
    rating: reviewCount >= 20 ? 4.9 : reviewCount >= 10 ? 4.8 : 4.7,
    reviewCount,
    active: true,
  });
}

const payload = {
  version: 1,
  currency: 'MAD',
  source: 'ipordise.com',
  products,
};

fs.writeFileSync(path.join(root, 'catalog.json'), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
console.log(`Generated catalog.json with ${products.length} storefront products.`);
