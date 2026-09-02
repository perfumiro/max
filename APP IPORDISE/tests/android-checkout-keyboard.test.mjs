import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('Android checkout uses one resize-and-scroll keyboard strategy', async () => {
  const [app, checkout, rawConfig] = await Promise.all([
    readFile(new URL('../App.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/commerce/CommercePages.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app.json', import.meta.url), 'utf8'),
  ]);
  const config = JSON.parse(rawConfig).expo;

  assert.equal(config.android.softwareKeyboardLayoutMode, 'resize');
  assert.equal(config.androidStatusBar.translucent, false);
  assert.match(app, /translucent=\{Platform\.OS !== 'android'\}/);
  assert.match(checkout, /keyboardShouldPersistTaps="always"/);
  assert.match(checkout, /keyboardDismissMode=\{Platform\.OS === "ios" \? "interactive" : "none"\}/);
  assert.match(checkout, /automaticallyAdjustKeyboardInsets=\{Platform\.OS === "ios"\}/);
  assert.doesNotMatch(checkout, /scrollToFocusedInput|measureLayout|KeyboardAwareScrollView/);
  assert.doesNotMatch(checkout, /<KeyboardAvoidingView/);
  assert.doesNotMatch(checkout, /autoFocus/);
});
