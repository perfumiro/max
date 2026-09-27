import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { prepareProductImage, uploadProductImage } from '../assets/admin/product-upload.mjs';

const options = { cloud: 'test-cloud', preset: 'test-preset' };
const photo = () => new File(['photo'], 'product.jpg', { type: 'image/jpeg' });
function fastRetries(t) {
  const realTimeout = globalThis.setTimeout;
  t.mock.method(globalThis, 'setTimeout', (callback, delay) => realTimeout(callback, delay < 90000 ? 0 : delay));
}

test('uploads multipart image and reuses it when catalog save is retried', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    calls++;
    assert.equal(url, 'https://api.cloudinary.com/v1_1/test-cloud/image/upload');
    assert.equal(init.body.get('upload_preset'), 'test-preset');
    assert.equal(init.body.get('file').name, 'product.jpg');
    assert.equal(init.headers, undefined);
    return Response.json({ secure_url: 'https://images.test/product.jpg' });
  });
  const file = photo();
  assert.equal(await uploadProductImage(file, options), 'https://images.test/product.jpg');
  assert.equal(await uploadProductImage(file, options), 'https://images.test/product.jpg');
  assert.equal(calls, 1);
});

test('recovers from a mobile connection interruption and server outage', async t => {
  fastRetries(t);
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    calls++;
    if (calls === 1) throw new TypeError('Failed to fetch');
    if (calls === 2) return Response.json({ error: { message: 'Unavailable' } }, { status: 503 });
    return Response.json({ secure_url: 'https://images.test/recovered.jpg' });
  });
  assert.equal(await uploadProductImage(photo(), options), 'https://images.test/recovered.jpg');
  assert.equal(calls, 3);
});

test('permanent service rejection is surfaced without retry', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    calls++;
    return Response.json({ error: { message: 'Invalid upload preset' } }, { status: 400 });
  });
  await assert.rejects(uploadProductImage(photo(), options), /Invalid upload preset/);
  assert.equal(calls, 1);
});

test('stops after three network failures with recovery instructions', async t => {
  fastRetries(t);
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; throw new TypeError('offline'); });
  await assert.rejects(uploadProductImage(photo(), options), /after 3 attempts.*form is still here/);
  assert.equal(calls, 3);
});

test('timed out requests are aborted and retried', async t => {
  const realTimeout = globalThis.setTimeout;
  t.mock.method(globalThis, 'setTimeout', callback => realTimeout(callback, 0));
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (_url, { signal }) => {
    calls++;
    return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('timeout', 'AbortError'))));
  });
  await assert.rejects(uploadProductImage(photo(), options), /after 3 attempts/);
  assert.equal(calls, 3);
});

test('reduces large phone images while retaining PNG transparency', async t => {
  const canvas = {
    getContext: () => ({ drawImage() {} }),
    toBlob(callback, type) { assert.equal(type, 'image/png'); callback(new Blob(['compressed'], { type })); },
  };
  const originalImage = globalThis.Image;
  const originalDocument = globalThis.document;
  t.after(() => {
    if (originalImage === undefined) delete globalThis.Image;
    else globalThis.Image = originalImage;
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  });
  globalThis.Image = class {
    naturalWidth = 4000;
    naturalHeight = 3000;
    async decode() {}
  };
  globalThis.document = { createElement: () => canvas };
  const file = new File([new Uint8Array(2 * 1024 * 1024)], 'photo.png', { type: 'image/png' });
  const prepared = await prepareProductImage(file);
  assert.equal(canvas.width, 2000);
  assert.equal(canvas.height, 1500);
  assert.equal(prepared.type, 'image/png');
  assert.ok(prepared.size < file.size);
});

test('rejects unsupported and empty images before contacting service', async () => {
  await assert.rejects(prepareProductImage(new File(['text'], 'file.txt', { type: 'text/plain' })), /JPG, PNG, or WebP/);
  await assert.rejects(prepareProductImage(new File([], 'empty.jpg', { type: 'image/jpeg' })), /empty/);
});

test('admin product uploads use the resilient uploader', async () => {
  const source = await readFile(new URL('../assets/admin/admin.js', import.meta.url), 'utf8');
  assert.match(source, /import \{ uploadProductImage \} from '\.\/product-upload\.mjs\?v=1'/);
  assert.match(source, /const _apUploadToCloudinary = \(file, progressCb\) => uploadProductImage\(file/);
});
