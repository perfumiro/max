import { appConfig } from '../config';

export type PendingCustomerAvatar = {
  uri: string;
  mimeType?: string | null;
  fileSize?: number | null;
};

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

export async function uploadCustomerAvatar(token: string, userId: string, asset: PendingCustomerAvatar) {
  if (!appConfig.supabaseUrl || !appConfig.supabasePublishableKey) throw new Error('Profile photo upload is temporarily unavailable.');
  if (!token || !userId) throw new Error('Sign in again to upload your photo.');
  const contentType = String(asset.mimeType || 'image/jpeg').toLowerCase();
  if (!ALLOWED_TYPES.has(contentType)) throw new Error('Choose a JPG, PNG, WEBP, or HEIC photo.');
  if (asset.fileSize && asset.fileSize > MAX_AVATAR_BYTES) throw new Error('Choose a photo smaller than 5 MB.');

  const source = await fetch(asset.uri);
  if (!source.ok) throw new Error("We couldn't read that photo. Choose another image.");
  const blob = await source.blob();
  if (blob.size > MAX_AVATAR_BYTES) throw new Error('Choose a photo smaller than 5 MB.');
  const objectPath = `${userId}/profile`;
  const response = await fetch(`${appConfig.supabaseUrl}/storage/v1/object/customer-avatars/${objectPath}`, {
    method: 'POST',
    headers: {
      apikey: appConfig.supabasePublishableKey,
      Authorization: `Bearer ${token}`,
      'Content-Type': contentType,
      'x-upsert': 'true',
      'Cache-Control': '3600',
    },
    body: blob,
  });
  if (!response.ok) {
    if (response.status === 413) throw new Error('Choose a photo smaller than 5 MB.');
    if (response.status === 401 || response.status === 403) throw new Error('Your session expired. Sign in and try again.');
    throw new Error("We couldn't upload your photo. Check your connection and try again.");
  }
  return `${appConfig.supabaseUrl}/storage/v1/object/public/customer-avatars/${objectPath}?v=${Date.now()}`;
}
