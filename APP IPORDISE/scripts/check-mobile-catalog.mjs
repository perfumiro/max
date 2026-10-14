// Execute the actual mobile catalog converter against public production data.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';

const compile = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const configSource = await readFile(new URL('../src/config.ts', import.meta.url), 'utf8');
const configContext = vm.createContext({ exports: {}, process, URL, __DEV__: false });
vm.runInContext(compile(configSource), configContext);
const { appConfig } = configContext.exports;
const source = (await readFile(new URL('../src/sharedCatalog.ts', import.meta.url), 'utf8')).replace(/^import .*;\r?\n/gm, '');
const snapshot = JSON.parse(await readFile(new URL('../src/generated/catalogSnapshot.json', import.meta.url), 'utf8'));
const warnings = [];
const context = vm.createContext({ exports: {}, appConfig, catalogSnapshot: snapshot, fetch, URLSearchParams, AbortController, setTimeout, clearTimeout,
  logger: { warn: name => warnings.push(name) },
  normalizeProductImageUrl: value => { try { const url = new URL(String(value), appConfig.storeOrigin); return url.protocol === 'https:' ? url.href : ''; } catch { return ''; } },
  productImageSource: uri => ({ uri }), mergeProductGallery: (_id, image, gallery) => [image, ...(Array.isArray(gallery) ? gallery : [])].filter(Boolean),
  normalizeProductNotes: () => undefined, isPromotionWindowActive: () => true,
});
vm.runInContext(compile(source), context);
const products = await context.exports.loadSharedProducts(true);
assert.ok(!warnings.some(name => name.startsWith('commerce_catalog_unavailable')), 'Mobile reader fell back to an old snapshot');
const requested = process.argv.slice(2);
const normalize = value => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
const matches = Object.fromEntries(requested.map(term => [term, products.filter(product => normalize(`${product.name} ${product.brand}`).includes(normalize(term))).map(product => ({ id: product.id, name: product.name, sizes: product.sizes }))]));
for (const term of requested) assert.ok(matches[term].length, `Mobile catalog is missing ${term}`);
console.log(JSON.stringify({ ok: true, liveMobileProducts: products.length, bundledProducts: snapshot.products.length, optionalServiceWarnings: warnings, matches }, null, 2));
