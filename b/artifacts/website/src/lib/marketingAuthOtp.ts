/** OTP length for marketing site login modal (Supabase default). */
export const MARKETING_OTP_LENGTH = 6;

export const MARKETING_OTP_LAST_INDEX = MARKETING_OTP_LENGTH - 1;

export const MARKETING_OTP_RESEND_SECONDS = 10;

export function createEmptyMarketingOtp(): string[] {
  return Array(MARKETING_OTP_LENGTH).fill("");
}

export function isMarketingOtpComplete(otp: string[]): boolean {
  return otp.length === MARKETING_OTP_LENGTH && otp.every((digit) => digit.length === 1);
}

export function normalizeMarketingPhoneDigits(value: string): string {
  return value.replace(/\D/g, "").slice(-10);
}

export function isValidMarketingPhone(digits: string): boolean {
  return digits.length === 10;
}

export function formatMarketingPhoneDisplay(digits: string): string {
  return `+91 ${digits}`;
}
