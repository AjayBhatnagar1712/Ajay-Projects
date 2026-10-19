export const normalizeIndianPhoneDigits = (value?: string | null) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  return digits.length >= 10 ? digits.slice(-10) : '';
};

export const toIndianE164 = (value?: string | null) => {
  const digits = normalizeIndianPhoneDigits(value);
  return digits ? `+91${digits}` : '';
};

export const isSameIndianPhone = (left?: string | null, right?: string | null) =>
  normalizeIndianPhoneDigits(left) !== ''
  && normalizeIndianPhoneDigits(left) === normalizeIndianPhoneDigits(right);
