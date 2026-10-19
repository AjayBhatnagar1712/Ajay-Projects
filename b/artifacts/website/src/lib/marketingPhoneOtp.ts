import { marketingSupabase } from "@/lib/marketingSupabaseClient";

/** Sends SMS OTP via Supabase Auth. Returns error message or null on success. */
export async function sendMarketingPhoneOtp(phoneDigits: string): Promise<string | null> {
  const { error } = await marketingSupabase.auth.signInWithOtp({
    phone: "+91" + phoneDigits.replace(/\D/g, "").slice(0, 10),
  });
  return error?.message ?? null;
}

/** Verifies SMS OTP. Returns error and access token from the verifyOtp session. */
export async function verifyMarketingPhoneOtp(
  phoneDigits: string,
  token: string,
): Promise<{ error: string | null; accessToken: string | null; refreshToken: string | null }> {
  const phone = phoneDigits.replace(/\D/g, "").slice(0, 10);
  const { data, error } = await marketingSupabase.auth.verifyOtp({
    phone: "+91" + phone,
    token,
    type: "sms",
  });
  return {
    error: error?.message ?? null,
    accessToken: data.session?.access_token ?? null,
    refreshToken: data.session?.refresh_token ?? null,
  };
}
