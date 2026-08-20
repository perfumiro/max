import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const generated = fs.readFileSync('src/productNotes.generated.ts', 'utf8');
const catalogPayload = JSON.parse(fs.readFileSync('website-ipordise/catalog.json', 'utf8'));
const catalog = Array.isArray(catalogPayload) ? catalogPayload : catalogPayload.products || [];
const sharedCatalog = fs.readFileSync('src/sharedCatalog.ts', 'utf8');
const adminService = fs.readFileSync('src/services/adminService.ts', 'utf8');
const adminDashboard = fs.readFileSync('src/admin/AdminDashboard.tsx', 'utf8');

test('every existing fragrance has a complete curated scent pyramid', () => {
  const entries = [...generated.matchAll(/^  "([^"]+)": \{\n    "top": "([^"]+)",\n    "heart": "([^"]+)",\n    "base": "([^"]+)"/gm)];
  const ids = new Set(entries.map(entry => entry[1]));
  assert.equal(entries.length, catalog.length);
  catalog.forEach(product => assert.ok(ids.has(String(product.id)), `Missing notes for ${product.name}`));
});

test('all catalogue adapters normalize admin notes and apply curated fallbacks', () => {
  assert.equal((sharedCatalog.match(/normalizeProductNotes\(/g) || []).length, 2);
});

test('admin create and edit flows persist top, heart and base notes', () => {
  assert.match(adminService, /\| "notes"/);
  assert.match(adminService, /notes: patch\.notes/);
  assert.match(adminService, /notes: input\.notes/);
  assert.match(adminDashboard, /accessibilityLabel="Top notes"/);
  assert.match(adminDashboard, /heart: notesHeart\.trim\(\)/);
  assert.match(adminDashboard, /base: notesBase\.trim\(\)/);
});
