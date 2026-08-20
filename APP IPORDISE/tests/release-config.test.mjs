import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { validateReleaseConfig } from '../scripts/check-release-config.mjs';

test('native release configuration contains required store identifiers', async () => {
  const config = JSON.parse(await readFile(new URL('../app.json', import.meta.url), 'utf8'));
  assert.deepEqual(validateReleaseConfig(config), []);
  assert.equal(config.expo.ios.bundleIdentifier, config.expo.android.package);
  assert.equal(config.expo.ios.supportsTablet, true);
});

test('release validator reports incomplete configuration', () => {
  assert.ok(validateReleaseConfig({ expo: {} }).length >= 5);
});
