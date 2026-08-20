import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('customer care uses an extremely minimal directory while preserving real actions', async () => {
  const source = await readFile(new URL('../src/help/HelpCenter.tsx', import.meta.url), 'utf8');

  assert.match(source, /CUSTOMER CARE/);
  assert.match(source, /How can we help\?/);
  assert.match(source, /id: 'track'/);
  assert.match(source, /id: 'orders'/);
  assert.match(source, /id: 'delivery'/);
  assert.match(source, /id: 'payments'/);
  assert.match(source, /id: 'contact'/);
  assert.match(source, /onNavigate\(item\.id\)/);
  assert.match(source, /borderBottomWidth: 1/);
  assert.doesNotMatch(source, /LinearGradient|topicNumber|topicGrid|availabilityGlow|shadowOpacity|supportBlock|recentOrders|topicIcon|borderRadius/);
});
