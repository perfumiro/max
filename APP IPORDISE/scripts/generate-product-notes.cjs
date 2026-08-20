const fs = require('fs');
const path = require('path');

const root = path.resolve(process.cwd());
const source = fs.readFileSync(path.join(root, 'website-ipordise', 'script.js'), 'utf8');
const catalogPayload = JSON.parse(fs.readFileSync(path.join(root, 'website-ipordise', 'catalog.json'), 'utf8'));
const catalog = Array.isArray(catalogPayload) ? catalogPayload : catalogPayload.products || [];

const normalize = value => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const start = source.indexOf('const productDetailOverrides = {');
const end = source.indexOf('\n    };', start);
if (start < 0 || end < 0) throw new Error('Could not locate productDetailOverrides in website script.');

const body = source.slice(start, end);
const entryPattern = /^\s{8}'([^']+)': \{/gm;
const entries = [];
let match;
while ((match = entryPattern.exec(body))) entries.push({ key: match[1], start: match.index });

const notesByName = new Map();
entries.forEach((entry, index) => {
  const chunk = body.slice(entry.start, entries[index + 1]?.start ?? body.length);
  const notesBlock = chunk.match(/\n\s{12}notes:\s*\[([\s\S]*?)\n\s{12}\],/);
  const titles = notesBlock
    ? [...notesBlock[1].matchAll(/title:\s*'([^']+)'/g)].map(item => item[1].trim())
    : [];
  if (titles.length >= 3) notesByName.set(normalize(entry.key), titles.slice(0, 3));
});

const legacyKey = name => normalize(name)
  .replace(/\bideal\b/g, 'id al')
  .replace(/\bextreme\b/g, 'extr me');

const generated = {};
const missing = [];
catalog.forEach(product => {
  const key = normalize(product.name);
  const titles = notesByName.get(key) || notesByName.get(legacyKey(product.name));
  if (!titles) {
    missing.push(product.name);
    return;
  }
  generated[String(product.id)] = { top: titles[0], heart: titles[1], base: titles[2] };
});

if (missing.length) throw new Error(`Missing curated notes for: ${missing.join(', ')}`);

const output = `// Generated from the curated productDetailOverrides in website-ipordise/script.js.\n` +
  `// Run node scripts/generate-product-notes.cjs after changing the source catalogue notes.\n` +
  `export const curatedProductNotes: Record<string, { top: string; heart: string; base: string }> = ${JSON.stringify(generated, null, 2)};\n`;

fs.writeFileSync(path.join(root, 'src', 'productNotes.generated.ts'), output);
console.log(`Generated fragrance notes for ${Object.keys(generated).length} products.`);
