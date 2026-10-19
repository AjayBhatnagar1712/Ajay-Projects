/** OTP length for all signup and login flows */
export const OTP_LENGTH = 6;

export const OTP_LAST_INDEX = OTP_LENGTH - 1;

export function createEmptyOtp(): string[] {
  return Array(OTP_LENGTH).fill("");
}
