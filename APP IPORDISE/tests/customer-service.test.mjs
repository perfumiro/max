import assert from 'node:assert/strict';
import test from 'node:test';
import { formatMoroccanPhoneInput, isStrongPassword, isValidEmail, isValidMoroccanPhone, normalizeEmail } from '../src/services/customerValidation.ts';
import { CustomerAuthError, classifyCustomerAuthError } from '../src/services/customerAuthErrors.ts';
import { translateSiteText } from '../src/i18n/siteTranslations.ts';

test('customer email input is normalized consistently', () => {
  assert.equal(normalizeEmail('  Client@Example.COM '), 'client@example.com');
});

test('customer email validation rejects incomplete addresses', () => {
  assert.equal(isValidEmail('client@example.com'), true);
  assert.equal(isValidEmail('client@'), false);
  assert.equal(isValidEmail('client example.com'), false);
});

test('customer passwords enforce the configured strong policy', () => {
  assert.equal(isStrongPassword('Short1!'), false);
  assert.equal(isStrongPassword('alllowercase123!'), false);
  assert.equal(isStrongPassword('StrongPassword1!'), true);
});

test('Moroccan customer phones are normalized for validation', () => {
  assert.equal(isValidMoroccanPhone('06 12 34 56 78'), true);
  assert.equal(isValidMoroccanPhone('+212 6 12 34 56 78'), true);
  assert.equal(isValidMoroccanPhone('12345'), false);
});

test('checkout formats local and international Moroccan phone input', () => {
  assert.equal(formatMoroccanPhoneInput('0612345678'), '06 12 34 56 78');
  assert.equal(formatMoroccanPhoneInput('+212612345678'), '+212 6 12 34 56 78');
  assert.equal(formatMoroccanPhoneInput('0812345678'), '08 12 34 56 78');
});

test('checkout field labels and placeholders follow the selected language', () => {
  assert.equal(translateSiteText('FULL NAME', 'fr'), 'NOM COMPLET');
  assert.equal(translateSiteText('Your full name', 'fr'), 'Votre nom complet');
  assert.equal(translateSiteText('FULL DELIVERY ADDRESS', 'fr'), 'ADRESSE DE LIVRAISON COMPLÈTE');
  assert.equal(translateSiteText('A delivery preference or helpful note', 'fr'), 'Une préférence de livraison ou une note utile');
  assert.equal(translateSiteText('FULL NAME', 'ar'), 'الاسم الكامل');
  assert.equal(translateSiteText('Your city', 'ar'), 'مدينتك');
});

test('authentication failures map to stable customer-safe codes', () => {
  assert.equal(classifyCustomerAuthError(400, { message: 'Invalid login credentials' }), 'invalid_credentials');
  assert.equal(classifyCustomerAuthError(400, { message: 'Email not confirmed' }), 'email_unverified');
  assert.equal(classifyCustomerAuthError(401, { message: 'JWT expired' }), 'expired_session');
  assert.equal(classifyCustomerAuthError(429, {}), 'rate_limited');
  assert.equal(classifyCustomerAuthError(503, { message: 'database internals' }), 'unavailable');
});

test('network authentication errors never expose browser or backend details', () => {
  const error = new CustomerAuthError('network');
  assert.equal(error.code, 'network');
  assert.match(error.message, /internet connection/i);
  assert.doesNotMatch(error.message, /fetch|supabase|database|stack/i);
});
