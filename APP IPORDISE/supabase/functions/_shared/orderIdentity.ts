export const ORDER_NUMBER_PATTERN = /^IPD?-[A-Z0-9-]{8,32}$/;
export const MOROCCAN_MOBILE_PATTERN = /^\+212[5-7]\d{8}$/;

export function normalizeOrderNumber(value: unknown) {
  const normalized = String(value ?? '').trim().toUpperCase();
  return ORDER_NUMBER_PATTERN.test(normalized) ? normalized : null;
}

/** Canonical Moroccan mobile format used at every order boundary: +212XXXXXXXXX. */
export function normalizeMoroccanPhone(value: unknown) {
  let digits = String(value ?? '').trim().replace(/[^\d+]/g, '');
  if (digits.startsWith('00')) digits = `+${digits.slice(2)}`;
  digits = digits.replace(/(?!^)\+/g, '');
  if (digits.startsWith('+212')) digits = digits.slice(4);
  else if (digits.startsWith('212')) digits = digits.slice(3);
  else if (digits.startsWith('0')) digits = digits.slice(1);
  if (!/^[5-7]\d{8}$/.test(digits)) return null;
  return `+212${digits}`;
}

export function maskMoroccanPhone(value: unknown) {
  const normalized = normalizeMoroccanPhone(value);
  return normalized ? `${normalized.slice(0, 7)}****${normalized.slice(-2)}` : 'invalid';
}
