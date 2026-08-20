const EXPO_SEND_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';
const BATCH_SIZE = 100;
type Language = 'fr' | 'en' | 'ar';
type Device = { id: string; expo_push_token: string; language: Language; platform: 'android' | 'ios' };

const chunks = <T>(items: T[], size = BATCH_SIZE) => Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));
const cleanProductName = (value: unknown) => String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 140);
const fetchWithTimeout = async (url: string, init: RequestInit, timeoutMs = 10_000) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(url, { ...init, signal: controller.signal }); }
  finally { clearTimeout(timeout); }
};

const localizedCopy = (name: string) => ({
  en: { title: 'New at IPORDISE ✨', body: `${name} has just arrived. Discover it now.` },
  fr: { title: 'Nouveau chez IPORDISE ✨', body: `${name} vient d’arriver. Découvrez-le maintenant.` },
  ar: { title: 'جديد لدى IPORDISE ✨', body: `وصل الآن ${name}. اكتشفه الآن.` },
});

export async function processPendingExpoReceipts(admin: any) {
  const cutoff = new Date(Date.now() - 15 * 60_000).toISOString();
  const { data: tickets, error } = await admin.from('push_tickets').select('id,device_id').is('checked_at', null).lte('created_at', cutoff).limit(1000);
  if (error || !tickets?.length) return;
  const pendingTickets = tickets as Array<{ id: string; device_id: string }>;
  for (const batch of chunks(pendingTickets)) {
    try {
      const response = await fetchWithTimeout(EXPO_RECEIPTS_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ ids: batch.map(ticket => ticket.id) }) });
      if (!response.ok) continue;
      const receipts = (await response.json())?.data || {};
      const checkedAt = new Date().toISOString();
      for (const ticket of batch) {
        const receipt = receipts[ticket.id];
        if (!receipt) continue;
        await admin.from('push_tickets').update({ checked_at: checkedAt }).eq('id', ticket.id);
        if (receipt.status === 'error' && receipt.details?.error === 'DeviceNotRegistered') {
          await admin.from('push_devices').update({ enabled: false, disabled_at: checkedAt }).eq('id', ticket.device_id);
        }
      }
    } catch (error) {
      console.warn(JSON.stringify({ event: 'expo_push_receipt_check_failed', error: error instanceof Error ? error.message : String(error) }));
    }
  }
}

export async function sendNewProductNotification(admin: any, product: { id: string; name: unknown }) {
  const productName = cleanProductName(product.name);
  if (!productName || !/^[a-z0-9][a-z0-9_.:-]{1,127}$/i.test(product.id)) throw new Error('INVALID_PUSH_PRODUCT');
  const copy = localizedCopy(productName);
  const { data: campaign, error: campaignError } = await admin.from('push_campaigns').insert({
    type: 'NEW_PRODUCT', product_id: product.id,
    title: { en: copy.en.title, fr: copy.fr.title, ar: copy.ar.title },
    body: { en: copy.en.body, fr: copy.fr.body, ar: copy.ar.body }, status: 'sending',
  }).select('id').single();
  if (campaignError?.code === '23505') return { status: 'duplicate' as const, attempted: 0, accepted: 0, failed: 0 };
  if (campaignError) throw campaignError;
  await processPendingExpoReceipts(admin);
  const devices: Device[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from('push_devices').select('id,expo_push_token,language,platform').eq('enabled', true).eq('new_products_enabled', true).range(from, from + 999);
    if (error) throw error;
    devices.push(...((data || []) as Device[]));
    if (!data || data.length < 1000) break;
  }
  let accepted = 0;
  let failed = 0;
  for (const wave of chunks(chunks(devices), 5)) {
    const results = await Promise.all(wave.map(async batch => {
      try {
        const messages = batch.map(device => {
          const language = copy[device.language] ? device.language : 'fr';
          return {
            to: device.expo_push_token, sound: 'default', title: copy[language].title, body: copy[language].body,
            data: { type: 'new_product', productId: product.id, route: `ipordise://product/${encodeURIComponent(product.id)}` },
            channelId: device.platform === 'android' ? 'new-products' : undefined,
            priority: 'high',
          };
        });
        const response = await fetchWithTimeout(EXPO_SEND_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'Accept-Encoding': 'gzip, deflate' }, body: JSON.stringify(messages) });
        if (!response.ok) throw new Error(`Expo push request failed (${response.status})`);
        const tickets = (await response.json())?.data || [];
        return { batch, tickets, requestFailed: false };
      } catch (error) {
        console.error(JSON.stringify({ event: 'expo_push_batch_failed', campaignId: campaign.id, error: error instanceof Error ? error.message : String(error) }));
        return { batch, tickets: [], requestFailed: true };
      }
    }));
    for (const result of results) {
      if (result.requestFailed) { failed += result.batch.length; continue; }
      const ticketRows: { id: string; campaign_id: string; device_id: string }[] = [];
      for (let index = 0; index < result.batch.length; index += 1) {
        const ticket = result.tickets[index];
        const device = result.batch[index];
        if (ticket?.status === 'ok' && ticket.id) {
          accepted += 1;
          ticketRows.push({ id: ticket.id, campaign_id: campaign.id, device_id: device.id });
        } else {
          failed += 1;
          if (ticket?.details?.error === 'DeviceNotRegistered') await admin.from('push_devices').update({ enabled: false, disabled_at: new Date().toISOString() }).eq('id', device.id);
        }
      }
      if (ticketRows.length) await admin.from('push_tickets').upsert(ticketRows, { onConflict: 'id' });
    }
  }
  const status = failed === 0 ? 'sent' : accepted > 0 ? 'partial' : 'failed';
  await admin.from('push_campaigns').update({ status, attempted_count: devices.length, accepted_count: accepted, failed_count: failed, sent_at: new Date().toISOString() }).eq('id', campaign.id);
  return { status, attempted: devices.length, accepted, failed };
}
