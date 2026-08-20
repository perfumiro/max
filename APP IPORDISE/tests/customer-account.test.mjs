import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('customer account supports password signup, sign-in, verification, recovery and refresh', async () => {
  const auth = await read('src/services/customerAuthService.ts');
  for (const endpoint of ['/signup', 'grant_type=password', '/resend', '/recover', 'grant_type=refresh_token', '/logout']) assert.match(auth, new RegExp(endpoint.replace(/[?]/g, '\\?')));
  assert.match(auth, /expo-secure-store/);
  assert.doesNotMatch(auth, /service.role/i);
});

test('callback sessions are verified before storage and refresh while the app remains open', async () => {
  const context = await read('src/account/CustomerAuthContext.tsx');
  const parsedAt = context.indexOf('sessionFromUrl(url)');
  const verifiedAt = context.indexOf('getCustomerUser(incoming.access_token)');
  const savedAt = context.indexOf('saveCustomerSession(incoming');
  assert.ok(parsedAt >= 0 && verifiedAt > parsedAt && savedAt > verifiedAt);
  assert.match(context, /AppState\.addEventListener/);
  assert.match(context, /refreshCustomerSession/);
  assert.match(context, /verifyCustomerTokenHash/);
  assert.match(context, /authLinkInvalid/);
  assert.match(context, /setAuthCompletionId\(Date\.now\(\)\)/);
  assert.match(context, /new URLSearchParams\(parsed\.hash[\s\S]*authParams\.set/);
});

test('mobile email confirmation and recovery links return to the installed app', async () => {
  const [config, service, app] = await Promise.all([
    read('supabase/config.toml'),
    read('src/services/customerAuthService.ts'),
    read('app.json'),
  ]);
  assert.match(app, /"scheme": "ipordise"/);
  assert.match(service, /ipordise:\/\/auth\?auth=\$\{mode\}/);
  assert.match(config, /"ipordise:\/\/auth\?auth=confirmed"/);
  assert.match(config, /"ipordise:\/\/auth\?auth=recovery"/);
});

test('account language is persistent and provides French English and Arabic RTL copy', async () => {
  const language = await read('src/i18n/LanguageContext.tsx');
  assert.match(language, /type AppLanguage = ["']fr["'] \| ["']ar["'] \| ["']en["']/);
  assert.match(language, /documentElement\.dir = language === ["']ar["'] \? ["']rtl["'] : ["']ltr["']/);
  assert.match(language, /localStorage\.setItem\(STORAGE_KEY, next\)/);
  assert.match(language, /تسجيل الدخول/);
  assert.match(language, /SIGN IN/);
  assert.match(language, /SE CONNECTER/);
});

test('customer data remains scoped to auth uid by row level security', async () => {
  const migration = await read('supabase/migrations/202608090001_customer_account_experience.sql');
  for (const table of ['customer_addresses', 'notification_preferences', 'customer_wishlist', 'customer_carts', 'data_export_requests', 'account_deletion_requests']) assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
  assert.match(migration, /user_id = auth\.uid\(\)/);
  assert.match(migration, /on conflict \(user_id\) do nothing/);
});

test('cart and wishlist state is cleared at the customer session boundary', async () => {
  const shopping = await read('src/commerce/ShoppingContext.tsx');
  assert.match(shopping, /previousUserId/);
  assert.match(shopping, /if\(previous\)\{setBag\(\[\]\);setFavourites\(\[\]\);setLastAdded\(null\);\}/);
  assert.match(shopping, /const mayMergeGuestState=previous==null/);
  assert.match(shopping, /const local=mayMergeGuestState\?current:\[\]/);
});

test('checkout delegates price validation and order writes to canonical Supabase commerce', async () => {
  const client = await read('src/services/orderService.ts');
  const edge = await read('supabase/functions/create-order/index.ts');
  const migration = await read('supabase/migrations/202608130001_unified_commerce.sql');
  assert.match(client, /supabaseUrl}\/functions\/v1\/create-order/);
  assert.doesNotMatch(client, /firebaseFunctionsUrl}\/createOrder/);
  assert.match(edge, /create_commerce_order_safe/);
  assert.match(migration, /for update of pv/i);
  assert.doesNotMatch(edge, /payload\.userId/);
});

test('public order endpoints use server-side rate limits and private tracking', async () => {
  const [migration, checkout, tracking, trackingClient] = await Promise.all([
    read('supabase/migrations/202608090001_customer_account_experience.sql'),
    read('supabase/functions/create-order/index.ts'),
    read('supabase/functions/track-order/index.ts'),
    read('src/services/orderTrackingService.ts'),
  ]);
  assert.match(migration, /consume_api_rate_limit/);
  assert.match(migration, /grant execute[\s\S]*service_role/);
  assert.match(checkout, /create-order:preauth', 60, 900/);
  assert.match(checkout, /authenticatedUser \? 25 : 8/);
  assert.match(checkout, /'create-order:guest'/);
  assert.match(tracking, /consumeRateLimit\(admin,\s*request,\s*'track-order',\s*12,\s*900\)/);
  assert.match(trackingClient, /supabaseUrl}\/functions\/v1\/track-order/);
  assert.doesNotMatch(trackingClient, /firebaseFunctionsUrl}\/trackOrder/);
  assert.doesNotMatch(trackingClient, /publicFirestoreUrl/);
});

test('/app is a customer route and /admin remains staff-only', async () => {
  const app = await read('App.tsx');
  const adminExpression = app.split('\n').find(line => line.includes('const previewAdmin')) || '';
  const storeExpression = app.split('\n').find(line => line.includes('const previewStore')) || '';
  assert.doesNotMatch(adminExpression, /path==='\/app'/);
  assert.match(storeExpression, /path==='\/app'/);
});

test('account overview uses live order items and real customer data services', async () => {
  const [screen, service, context] = await Promise.all([
    read('src/account/AccountScreen.tsx'),
    read('src/services/customerAccountService.ts'),
    read('src/account/CustomerContext.tsx'),
  ]);
  assert.match(service, /orders\?select=id,order_number,status,[^']*total,[^']*currency,[^']*created_at,items/);
  assert.match(screen, /order\.items\?\.\[0\]/);
  assert.match(context, /loadCustomerAccount\(token, force\)/);
  assert.doesNotMatch(screen, /loyalty|payment method|moyens de paiement/i);
});

test('guest and member account states expose accessible real destinations', async () => {
  const [screen, app] = await Promise.all([
    read('src/account/AccountScreen.tsx'),
    read('App.tsx'),
  ]);
  for (const page of ['orders', 'profile', 'addresses', 'language', 'notifications', 'privacy', 'legal']) {
    assert.match(screen, new RegExp(`navigateAccount\\(["']${page}["']\\)`));
  }
  assert.match(screen, /onHelp\(["']track["']\)/);
  assert.match(app, /setHelpDestination\(destination\|\|["']home["']\)/);
  assert.match(screen, /paddingBottom: bottomInset \+ 32/);
});

test('account back navigation follows real page history and protects unsaved forms', async () => {
  const screen = await read('src/account/AccountScreen.tsx');
  assert.match(screen, /pageHistoryRef = useRef<AccountPage\[]>/);
  assert.match(screen, /recordNavigationEntry\(pageHistoryRef\.current, current, next\)/);
  assert.match(screen, /popPreviousNavigationEntry\(pageHistoryRef\.current, current\)/);
  assert.match(screen, /Discard changes\?/);
  assert.match(screen, /addressPageRef\.current\?\.requestBack\(\)/);
  assert.match(screen, /registerAndroidBackAction\(requestBack\)/);
  assert.doesNotMatch(screen, /page === "order-details" \? "orders" : "home"/);
});

test('mobile guest header integrates language, currency and secure status without a second control row', async () => {
  const screen = await read('src/account/AccountScreen.tsx');
  assert.match(screen, /<View style=\{s\.headerLanguage\}><LanguageSwitcher compact header \/><\/View>/);
  assert.match(screen, /style=\{s\.headerMarket\}/);
  assert.match(screen, /header && language === code \? <View style=\{s\.languageHeaderIndicator\}/);
  assert.match(screen, /\{layout\.tablet \? <PreferenceBar \/> : null\}/);
  assert.match(screen, /preferenceLanguageHeader: \{[^}]*borderWidth: 0/);
});

test('new account experience copy is localized in French English and Arabic', async () => {
  const language = await read('src/i18n/LanguageContext.tsx');
  for (const key of ['heroTitle', 'memberBenefitsTitle', 'trackOrder', 'privacySecurity', 'accountUnavailable']) {
    assert.equal(language.match(new RegExp(`${key}:`, 'g'))?.length, 3);
  }
  assert.match(language, /Votre beauté, toujours à portée de main/);
  assert.match(language, /Your beauty, always within reach/);
  assert.match(language, /جمالك دائماً في متناولك/);
});

test('account dashboard provides loading, retry, empty and product-image fallback states', async () => {
  const screen = await read('src/account/AccountScreen.tsx');
  assert.match(screen, /function AccountSkeleton/);
  assert.match(screen, /accountError/);
  assert.match(screen, /onPress=\{\(\) => void reload\(true\)\}/);
  assert.match(screen, /noRecentOrder/);
  assert.match(screen, /guestWelcome/);
  assert.match(screen, /accountIdentity/);
  assert.match(screen, /item\?\.image \?/);
});

test('authentication forms use labelled autocomplete fields, password visibility and duplicate-submit protection', async () => {
  const screen = await read('src/account/AccountScreen.tsx');
  for (const value of ['email', 'current-password', 'new-password', 'given-name', 'family-name', 'tel']) assert.match(screen, new RegExp(`autoComplete=["']${value}["']`));
  assert.match(screen, /showPassword/);
  assert.match(screen, /hidePassword/);
  assert.match(screen, /requestInFlight\.current/);
  assert.match(screen, /accessibilityState=\{\{ busy: loading, disabled: disabled \|\| loading \}\}/);
});

test('forgotten-password responses stay enumeration-safe and recovery uses a dedicated reset screen', async () => {
  const screen = await read('src/account/AccountScreen.tsx');
  assert.match(screen, /recoveryPrivacySuccess/);
  assert.match(screen, /function PasswordResetPage/);
  assert.match(screen, /<PasswordResetPage token=\{session\.access_token\}/);
  assert.doesNotMatch(screen, /No account (?:exists|was found)/i);
});

test('session restoration handles expiry, secure storage, intended routes and reliable local logout', async () => {
  const [context, service] = await Promise.all([
    read('src/account/CustomerAuthContext.tsx'),
    read('src/services/customerAuthService.ts'),
  ]);
  assert.match(service, /SecureStore\.setItemAsync\(SESSION_KEY/);
  assert.match(service, /CustomerAuthError\('network'\)/);
  assert.match(service, /CustomerAuthError\('timeout'\)/);
  assert.match(context, /refreshCustomerSession/);
  assert.match(context, /setAuthNotice\('sessionExpired'\)/);
  assert.match(context, /AUTH_RETURN_KEY/);
  assert.match(context, /safeDestination/);
  assert.match(context, /finally \{ await saveCustomerSession\(null\); setSession\(null\)/);
});

test('account deletion is immediate, authenticated, and removes or anonymizes linked data', async () => {
  const [screen, context, service, migration] = await Promise.all([
    read('src/account/AccountScreen.tsx'),
    read('src/account/CustomerAuthContext.tsx'),
    read('src/services/customerAccountService.ts'),
    read('supabase/functions/delete-account/index.ts'),
  ]);
  assert.match(screen, /normalizeEmail\(deleteEmail\).*normalizeEmail\(session\?\.user\.email/);
  assert.match(screen, /reauthenticate\(deletePassword\)/);
  assert.match(screen, /ConfirmationDialog visible=\{deleteDialog\}/);
  assert.match(context, /next\.user\.id !== session\.user\.id/);
  assert.match(service, /functions\/v1\/delete-account/);
  assert.match(screen, /await signOut\(\)/);
  assert.match(migration, /admin\.auth\.getUser\(token\)/);
  assert.match(migration, /from\('orders'\)\.update\(\{[\s\S]*user_id: null/);
  assert.match(migration, /admin\.auth\.admin\.deleteUser\(user\.id\)/);
  assert.match(migration, /storage\.from\('customer-avatars'\)\.remove/);
});

test('all new authentication and destructive-action copy is localized in three languages', async () => {
  const language = await read('src/i18n/LanguageContext.tsx');
  for (const key of ['authError_invalid_credentials', 'recoveryPrivacySuccess', 'logoutTitle', 'deleteDialogTitle', 'passwordResetSuccessTitle']) {
    assert.equal(language.match(new RegExp(`${key}:`, 'g'))?.length, 3);
  }
});

test('member dashboard preserves healthy account sections during partial API outages', async () => {
  const [screen, language, service] = await Promise.all([
    read('src/account/AccountScreen.tsx'),
    read('src/i18n/LanguageContext.tsx'),
    read('src/services/customerAccountService.ts'),
  ]);
  const dashboard = screen.slice(screen.indexOf('function LoggedInAccount'), screen.indexOf('function AddressPage'));
  const context = await read('src/account/CustomerContext.tsx');
  assert.match(service, /Promise\.allSettled/);
  assert.match(service, /unavailable\.length === sections\.length/);
  assert.match(context, /if \(data\.orders !== undefined\) setOrders\(data\.orders\)/);
  assert.match(dashboard, /value=\{ordersUnavailable \? ["'][^"']+["'] : activeOrders\}/);
  assert.match(dashboard, /!loading && !profileUnavailable && !addressesUnavailable && profileCompletion < 100/);
  assert.doesNotMatch(dashboard, /<Text style=\{s\.errorBoxText\}>\{error\}<\/Text>/);
  for (const key of ['accountUnavailableCopy', 'verifiedAccount', 'completeProfile', 'completeProfileCopy']) {
    assert.equal(language.match(new RegExp(`${key}:`, 'g'))?.length, 3);
  }
});
