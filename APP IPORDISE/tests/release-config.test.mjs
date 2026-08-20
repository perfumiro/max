import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { validateReleaseConfig } from '../scripts/check-release-config.mjs';

test('native release configuration contains required store identifiers', async () => {
  const [config, easConfig, packageConfig] = await Promise.all([
    readFile(new URL('../app.json', import.meta.url), 'utf8').then(JSON.parse),
    readFile(new URL('../eas.json', import.meta.url), 'utf8').then(JSON.parse),
    readFile(new URL('../package.json', import.meta.url), 'utf8').then(JSON.parse),
  ]);
  assert.deepEqual(validateReleaseConfig(config, easConfig), []);
  assert.equal(config.expo.ios.bundleIdentifier, config.expo.android.package);
  assert.equal(config.expo.ios.supportsTablet, true);
  assert.match(packageConfig.dependencies['expo-updates'], /^~29\./);
  assert.ok(packageConfig.dependencies['expo-dev-client']);
});

test('release validator reports incomplete configuration', () => {
  assert.ok(validateReleaseConfig({ expo: {} }).length >= 5);
});
