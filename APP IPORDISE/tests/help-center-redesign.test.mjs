import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('customer care renders every active configured topic with stable working actions', async () => {
  const [source,config,translations] = await Promise.all([
    readFile(new URL('../src/help/HelpCenter.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/help/helpConfig.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/i18n/siteTranslations.ts', import.meta.url), 'utf8'),
  ]);

  assert.match(source, /CUSTOMER CARE/);
  assert.match(source, /How can we help\?/);
  assert.match(source, /config\.topics\.map/);
  assert.match(source, /key=\{item\.id\}/);
  assert.match(source, /item\.id === 'payments' \|\| item\.id === 'faq'/);
  assert.match(source, /setOpenId\(paymentFaq\?\.id \|\| ''\)/);
  assert.match(source, /onNavigate\(item\.id\)/);
  assert.match(config, /byId\.get\(item\.id\)\|\|item\)\.filter\(item=>item\.active!==false\)/);
  for (const label of ['Products & fragrances','Account & security','Frequently asked questions','Payment methods and pay-on-delivery help']) {
    assert.match(translations,new RegExp(`'${label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}'`));
  }
  assert.match(source, /borderBottomWidth: 1/);
  assert.doesNotMatch(source, /LinearGradient|topicNumber|topicGrid|availabilityGlow|shadowOpacity|supportBlock|recentOrders|topicIcon|borderRadius/);
});
