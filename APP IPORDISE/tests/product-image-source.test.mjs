import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const code = ts.transpileModule(readFileSync(new URL('../src/productImageSource.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
function loader(os) {
  const context = vm.createContext({ exports: {}, URL, require: name => name === 'react-native' ? { Platform: { OS: os } } : { bundledProductImages: { '/assets/perfume photo.jpg': 42 } } });
  vm.runInContext(code, context);
  return context.exports;
}
test('a fresh Android installation resolves packaged photos without network/cache', () => {
  const api = loader('android');
  for (const url of ['/assets/perfume photo.jpg', 'https://www.ipordise.com/assets/perfume%20photo.jpg']) assert.equal(api.productImageSource(url), 42);
});
test('new admin uploads keep their remote image and encode spaces', () => {
  const api = loader('android');
  assert.equal(api.productImageSource('https://res.cloudinary.com/demo/image/upload/new perfume.jpg').uri, 'https://res.cloudinary.com/demo/image/upload/new%20perfume.jpg');
  assert.equal(api.productImageSource('https://other.test/assets/perfume photo.jpg').uri, 'https://other.test/assets/perfume%20photo.jpg');
  assert.equal(api.normalizeProductImageUrl('file:///private/photo.jpg'), '');
  assert.equal(api.normalizeProductImageUrl('//ipordise.com/assets/a.jpg'), 'https://ipordise.com/assets/a.jpg');
});
test('web keeps hosted images and explicit replacement query parameters are honored', () => {
  assert.equal(loader('web').productImageSource('/assets/perfume photo.jpg').uri, 'https://ipordise.com/assets/perfume%20photo.jpg');
  assert.equal(loader('android').productImageSource('/assets/perfume photo.jpg?v=2').uri, 'https://ipordise.com/assets/perfume%20photo.jpg?v=2');
});
test('every bundled catalog cover is packaged and every static require exists', () => {
  const catalog = JSON.parse(readFileSync(new URL('../website-ipordise/catalog.json', import.meta.url), 'utf8'));
  const manifest = readFileSync(new URL('../src/generated/productImages.ts', import.meta.url), 'utf8');
  for (const product of catalog.products) assert.ok(manifest.includes(JSON.stringify(product.image)), product.id);
  const files = [...manifest.matchAll(/require\("([^\"]+)"\)/g)];
  assert.ok(files.length >= catalog.products.length);
  for (const [, path] of files) assert.ok(existsSync(new URL(path, new URL('../src/generated/productImages.ts', import.meta.url))), path);
});
