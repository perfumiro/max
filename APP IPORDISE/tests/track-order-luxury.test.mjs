import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('premium tracking UI preserves private lookup and renders only API-backed order fields', async () => {
  const [app, service] = await Promise.all([
    readFile(new URL('../App.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/services/orderTrackingService.ts', import.meta.url), 'utf8'),
  ]);

  assert.match(app, /await trackOrder\(normalizedOrder,normalizedPhone\)/);
  assert.match(app, /formatMoroccanPhoneInput/);
  assert.match(app, /keyboardType="phone-pad"/);
  assert.match(app, /CHECKING YOUR ORDER…/);
  assert.match(app, /We couldn't connect right now\./);
  assert.match(app, /We couldn't find this order\./);
  assert.match(app, /order\.createdAt/);
  assert.match(app, /order\.itemCount/);
  assert.match(app, /order\.total/);
  assert.match(app, /order\.statusHistory/);
  assert.match(app, /onPress=\{onContact\}/);
  assert.match(service, /functions\/v1\/track-order/);
  assert.doesNotMatch(app, /Monday, 17 August|tracking number when available|courier when available/i);
});
