import { afterEach, describe, expect, it, vi } from "vitest";

const signInWithOtp = vi.fn();
const verifyOtp = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      signInWithOtp: (...args: unknown[]) => signInWithOtp(...args),
      verifyOtp: (...args: unknown[]) => verifyOtp(...args),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
      signOut: vi.fn(),
      setSession: vi.fn(),
    },
  }),
}));

vi.mock("./secureSession", () => ({
  clearSession: vi.fn(),
  getAccessToken: vi.fn(),
  getRefreshToken: vi.fn(),
  saveSessionIdentity: vi.fn(),
  saveSessionTokens: vi.fn(),
}));

describe("sendPhoneOtp / verifyPhoneOtp timeouts", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    // Reset module so getSupabase recreates client with fresh mocks if needed
    vi.resetModules();
  });

  it("returns a friendly message when OTP send hangs past 15s", async () => {
    vi.stubEnv("EXPO_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("EXPO_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
    vi.useFakeTimers();
    signInWithOtp.mockReturnValue(new Promise(() => undefined));

    const { sendPhoneOtp } = await import("./phoneOtp");
    const pending = sendPhoneOtp("9876543210");
    await vi.advanceTimersByTimeAsync(15_000);
    await expect(pending).resolves.toBe(
      "Couldn't send code. Check your connection and try again.",
    );
  });

  it("returns a friendly message when OTP verify hangs past 15s", async () => {
    vi.stubEnv("EXPO_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("EXPO_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
    vi.useFakeTimers();
    verifyOtp.mockReturnValue(new Promise(() => undefined));

    const { verifyPhoneOtp } = await import("./phoneOtp");
    const pending = verifyPhoneOtp("9876543210", "123456");
    await vi.advanceTimersByTimeAsync(15_000);
    await expect(pending).resolves.toEqual({
      error: "Couldn't verify code. Check your connection and try again.",
      accessToken: null,
    });
  });

  it("returns app configuration error when Supabase env is missing", async () => {
    vi.stubEnv("EXPO_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("EXPO_PUBLIC_SUPABASE_ANON_KEY", "");

    const { sendPhoneOtp } = await import("./phoneOtp");
    await expect(sendPhoneOtp("9876543210")).resolves.toBe(
      "App configuration error. Please reinstall or contact support.",
    );
  });
});
