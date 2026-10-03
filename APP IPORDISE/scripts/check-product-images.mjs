const root = 'https://gdgrskgegrcgmzswefmn.supabase.co';
const response = await fetch(root + '/rest/v1/products?active=eq.true&select=id,image,gallery', { headers: { apikey: 'sb_publishable_XbhrBW9Na65u8EkpgtEz4g_PuYkxs_H' } });
if (!response.ok) throw Error('Catalog HTTP ' + response.status);
const products = await response.json();
const urls = [...new Set(products.flatMap(p => [p.image, ...(p.gallery || [])]).filter(Boolean).map(image => new URL(image, 'https://ipordise.com').href))];
const results = [];
let next = 0;
await Promise.all(Array.from({length:6}, async () => {
  while (next < urls.length) {
    const url = urls[next++];
    try {
      const r = await fetch(url, {signal:AbortSignal.timeout(20000)});
      const type = r.headers.get('content-type') || '';
      const bytes = (await r.arrayBuffer()).byteLength;
      results.push({url, status:r.status, type, bytes, ok:r.ok && type.startsWith('image/') && bytes > 0});
    } catch (error) { results.push({url, ok:false, error:error.message}); }
  }
}));
const failed = results.filter(r => !r.ok);
console.log(JSON.stringify({products:products.length, images:urls.length, passed:results.length-failed.length, failed}, null, 2));
if (failed.length) process.exitCode = 1;
