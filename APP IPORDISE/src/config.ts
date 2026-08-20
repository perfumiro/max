const normalizeUrl = (value: string | undefined, preserveLocation = false) => {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.hostname === 'localhost' ? (preserveLocation ? url.toString() : url.origin) : undefined;
  } catch {
    return undefined;
  }
};

const supabaseUrl = normalizeUrl(process.env.EXPO_PUBLIC_SUPABASE_URL);
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
const adminDashboardUrl = normalizeUrl(process.env.EXPO_PUBLIC_ADMIN_DASHBOARD_URL, true);
const firebaseFunctionsUrl = normalizeUrl(process.env.EXPO_PUBLIC_FIREBASE_FUNCTIONS_URL)
  || 'https://europe-west3-ipordise-aef54.cloudfunctions.net';
// Firebase Functions require a paid Firebase plan and are not deployed for this
// project. Use the active Supabase Edge Functions unless Firebase is explicitly
// enabled in a future environment.
const firebaseOrderApiEnabled = process.env.EXPO_PUBLIC_FIREBASE_ORDER_API_ENABLED === 'true';

export const appConfig = Object.freeze({
  storeOrigin: 'https://ipordise.com',
  privacyPolicyUrl: 'https://ipordise.com/pages/privacy-policy',
  termsUrl: 'https://ipordise.com/pages/terms',
  supportUrl: 'https://ipordise.com/pages/support',
  accountDeletionUrl: 'https://ipordise.com/pages/account-deletion',
  availabilityWhatsApp: '212663750210',
  firestoreRoot: 'https://firestore.googleapis.com/v1/projects/ipordise-aef54/databases/(default)/documents',
  firebaseApiKey: 'AIzaSyAt-fnGB3Y69qEmg4pjOWneKrutbnQLMM4',
  firebaseFunctionsUrl,
  firebaseOrderApiEnabled,
  supabaseUrl,
  supabasePublishableKey,
  supabaseConfigured: Boolean(supabaseUrl && supabasePublishableKey),
  adminDashboardUrl,
  requestTimeoutMs: 10_000,
  requestRetries: 1,
  // Keep an open shop close to admin publications while still batching reads.
  catalogCacheTtlMs: 30_000,
});
