import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeMoroccanPhone, normalizeOrderNumber } from '../supabase/functions/_shared/orderIdentity.ts';

test('Moroccan phones share one canonical format at checkout and tracking boundaries', () => {
  for (const value of ['0612345678', '06 12 34 56 78', '+212612345678', '212612345678', '00212612345678']) {
    assert.equal(normalizeMoroccanPhone(value), '+212612345678');
  }
  for (const value of ['', '1234', '+33612345678', '0812345678', '06123456789']) {
    assert.equal(normalizeMoroccanPhone(value), null);
  }
});

test('order numbers accept canonical IPORDISE formats without permitting arbitrary identifiers', () => {
  assert.equal(normalizeOrderNumber(' ip-260815-a1b2c3d4 '), 'IP-260815-A1B2C3D4');
  assert.equal(normalizeOrderNumber('ipd-260815-a1b2c3d4'), 'IPD-260815-A1B2C3D4');
  assert.equal(normalizeOrderNumber('order-1'), null);
});
