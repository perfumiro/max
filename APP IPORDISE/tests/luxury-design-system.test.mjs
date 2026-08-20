import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('luxury foundation exposes every required semantic token family', async () => {
  const source = await read('../src/designSystem.ts');
  for (const token of ['palette', 'colors', 'fontFamilies', 'typography', 'spacing', 'radius', 'borders', 'sizes', 'shadows', 'motion', 'imagery']) {
    assert.match(source, new RegExp(`export const ${token}`));
  }
  for (const role of ['displayTitle', 'productTitle', 'sectionTitle', 'eyebrow', 'bodySmall', 'price', 'metadata', 'button', 'navigation']) {
    assert.match(source, new RegExp(`${role}:`));
  }
  assert.match(source, /duration:\s*\{ instant: 150, standard: 220, deliberate: 300 \}/);
});

test('legacy design-system exports remain available during migration', async () => {
  const source = await read('../src/designSystem.ts');
  for (const alias of ['ink', 'paper', 'muted', 'line', 'brand', 'action', 'blush', 'soft']) {
    assert.match(source, new RegExp(`${alias}:`));
  }
  assert.match(source, /export const shadow = shadows\.raised/);
});

test('shared luxury components cover commerce, forms, and navigation states', async () => {
  const [buttons, cards, forms, navigation, headers] = await Promise.all([
    read('../src/components/LuxuryButton.tsx'),
    read('../src/components/LuxuryProductCard.tsx'),
    read('../src/components/LuxuryFormControls.tsx'),
    read('../src/components/LuxuryNavigation.tsx'),
    read('../src/components/LuxurySectionHeader.tsx'),
  ]);

  for (const variant of ['primary', 'secondary', 'text', 'sticky']) assert.match(buttons, new RegExp(`'${variant}'`));
  assert.match(buttons, /accessibilityState=\{\{ disabled: isDisabled, busy: loading \}\}/);
  assert.match(cards, /imagery\.productCard/);
  for (const control of ['LuxuryTextField', 'LuxurySearchField', 'LuxurySelectControl', 'LuxuryQuantityControl', 'LuxuryCouponControl', 'LuxuryAddressField', 'LuxuryPaymentOption']) {
    assert.match(forms, new RegExp(`function ${control}`));
  }
  assert.match(navigation, /function LuxuryHeader/);
  assert.match(navigation, /function LuxuryBottomNavigation/);
  assert.match(headers, /function LuxurySectionHeader/);
});

test('migration guide establishes image, motion, and phased adoption rules', async () => {
  const guide = await read('../docs/LUXURY_DESIGN_SYSTEM.md');
  assert.match(guide, /Product photography/);
  assert.match(guide, /Motion language/);
  assert.match(guide, /Phase 1 — App shell/);
  assert.match(guide, /Phase 5 — Campaigns/);
  assert.match(guide, /one search control per context/i);
});
