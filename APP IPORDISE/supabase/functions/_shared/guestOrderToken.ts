const encoder = new TextEncoder();

const base64Url = (bytes: Uint8Array) => {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const tokenMessage = (orderId: string, orderNumber: string) =>
  `ipordise-guest-order:v1:${orderId}:${orderNumber.trim().toUpperCase()}`;

export async function guestOrderToken(secret: string, orderId: string, orderNumber: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(tokenMessage(orderId, orderNumber)));
  return base64Url(new Uint8Array(signature));
}

export function constantTimeTokenMatch(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}
