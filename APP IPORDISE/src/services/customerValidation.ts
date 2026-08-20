export const normalizeEmail = (value: string) => value.trim().toLowerCase();

export const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));

export const isStrongPassword = (value: string) => value.length >= 12
  && /[a-z]/.test(value)
  && /[A-Z]/.test(value)
  && /\d/.test(value)
  && /[^A-Za-z0-9]/.test(value);

export const isValidMoroccanPhone = (value: string) => /^(?:\+?212|0)[5-7]\d{8}$/.test(value.replace(/[\s()-]/g, ''));

export function formatMoroccanPhoneInput(value: string) {
  const international = value.trimStart().startsWith('+') || value.replace(/\D/g, '').startsWith('212');
  const digits = value.replace(/\D/g, '');
  if (international) {
    const local = (digits.startsWith('212') ? digits.slice(3) : digits).slice(0, 9);
    return ['+212', local.slice(0, 1), local.slice(1, 3), local.slice(3, 5), local.slice(5, 7), local.slice(7, 9)].filter(Boolean).join(' ');
  }
  const local = digits.slice(0, 10);
  return [local.slice(0, 2), local.slice(2, 4), local.slice(4, 6), local.slice(6, 8), local.slice(8, 10)].filter(Boolean).join(' ');
}
