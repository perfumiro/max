import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = new URL('../', import.meta.url);
const { expo } = JSON.parse(readFileSync(new URL('app.json', root), 'utf8'));
const eas = JSON.parse(readFileSync(new URL('eas.json', root), 'utf8'));
assert.equal(expo.ios.bundleIdentifier, 'com.ipordise.app');
assert.equal(eas.build.production.distribution, 'store');
assert.equal(eas.build.production.environment, 'production');
assert.equal(eas.build.production.autoIncrement, true);
assert.equal(eas.build.production.ios.buildConfiguration, 'Release');
assert.match(eas.build.production.ios.image, /xcode-(?:26|27)\./);
assert.equal(expo.ios.config.usesNonExemptEncryption, false);

// Inspect generated native configuration, including plugin-supplied permissions.
const native = JSON.parse(execFileSync(process.execPath, [require.resolve('expo/bin/cli'), 'config', '--type', 'introspect', '--json'], {
  cwd: root, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024,
}));
const ios = native._internal?.modResults?.ios;
assert.ok(ios?.infoPlist, 'Expo must generate the iOS Info.plist');
assert.equal(ios.infoPlist.NSAppTransportSecurity.NSAllowsArbitraryLoads, false);
for (const permission of ['NSMicrophoneUsageDescription', 'NSSpeechRecognitionUsageDescription', 'NSPhotoLibraryUsageDescription']) {
  assert.ok(ios.infoPlist[permission]?.includes('IPORDISE'), `${permission} needs a specific purpose string`);
}
assert.ok(ios.entitlements?.['aps-environment'], 'Native push entitlement is required; EAS applies the distribution entitlement when signing');
const png = readFileSync(new URL(expo.ios.icon ?? expo.icon, root));
assert.equal(png.subarray(1, 4).toString(), 'PNG');
assert.equal(png.readUInt32BE(16), png.readUInt32BE(20), 'App icon must be square');
assert.ok(png.readUInt32BE(16) >= 1024, 'App icon must be at least 1024 pixels');
assert.ok([0, 2].includes(png[25]), 'App Store icon must not contain an alpha channel');
console.log('iOS release configuration, native permissions, push entitlement and opaque icon verified. Signing and physical-device testing remain separate checks.');
