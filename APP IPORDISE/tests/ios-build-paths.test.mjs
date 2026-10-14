import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { patchIosBuildFile } from '../scripts/fix-ios-build-paths.mjs';
import bundlePlugin from '../plugins/withSpaceSafeIosBundle.cjs';

test('React Native bundle script executes the complete path as one quoted command', () => {
  const script = 'export PROJECT_ROOT="$PROJECT_DIR"/..\n`"$NODE_BINARY" --print "require.resolve(\'react-native/scripts/react-native-xcode.sh\')"`\n';
  const fixed = bundlePlugin.quoteBundleScript(script);
  assert.ok(fixed.includes('"$("$NODE_BINARY" --print'));
  assert.equal(bundlePlugin.quoteBundleScript(fixed), fixed);
  assert.ok(fixed.startsWith('export PROJECT_ROOT="$PROJECT_DIR"/..\n'));
});

test('podspec patches run during dependency installation, before CocoaPods generates scripts', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.scripts.postinstall, 'node scripts/fix-ios-build-paths.mjs');
  assert.equal(pkg.scripts['eas-build-post-install'], undefined);
});

test('Expo iOS script fixes preserve quoted paths and are idempotent', () => {
  const fixtures = [
    [String.raw`:script => "bash -l -c \"#{env_vars}$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh\"",`, 'constants'],
    ['bash -l -c "$PODS_TARGET_SRCROOT/../scripts/create-updates-resources-ios.sh"', 'updates'],
    ['PROJECT_DIR_BASENAME=$(basename $PROJECT_DIR)', 'basename'],
  ];
  for (const [source, kind] of fixtures) {
    const patched = patchIosBuildFile(source, kind);
    assert.notEqual(patched, source);
    assert.equal(patchIosBuildFile(patched, kind), patched);
    assert.ok(!patched.includes('bash -l -c'));
  }
});

test('dependency changes fail explicitly instead of silently leaving broken scripts', () => {
  assert.throws(() => patchIosBuildFile('unexpected upstream script', 'constants'), /review the iOS path workaround/);
});
