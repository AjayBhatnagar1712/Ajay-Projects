import { describe, expect, it } from "vitest";
import {
  createEmptyMarketingOtp,
  formatMarketingPhoneDisplay,
  isMarketingOtpComplete,
  isValidMarketingPhone,
  normalizeMarketingPhoneDigits,
} from "./marketingAuthOtp";

describe("marketingAuthOtp", () => {
  it("normalizes phone digits to 10 characters", () => {
    expect(normalizeMarketingPhoneDigits("+91 63698 56040")).toBe("6369856040");
  });

  it("validates a complete 10-digit phone", () => {
    expect(isValidMarketingPhone("6369856040")).toBe(true);
    expect(isValidMarketingPhone("636985604")).toBe(false);
  });

  it("formats phone for OTP subtitle", () => {
    expect(formatMarketingPhoneDisplay("6369856040")).toBe("+91 6369856040");
  });

  it("tracks OTP completion for six digits", () => {
    expect(isMarketingOtpComplete(createEmptyMarketingOtp())).toBe(false);
    expect(isMarketingOtpComplete(["0", "1", "0", "1", "0", "1"])).toBe(true);
  });

  it("treats fewer than six digits as incomplete", () => {
    expect(isMarketingOtpComplete(["0", "1", "0", "1"])).toBe(false);
    expect(isMarketingOtpComplete(["0", "1", "0", "1", "0"])).toBe(false);
    expect(createEmptyMarketingOtp()).toHaveLength(6);
  });
});
