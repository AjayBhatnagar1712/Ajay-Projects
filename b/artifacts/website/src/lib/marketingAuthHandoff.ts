export const MARKETING_AUTH_HANDOFF_KEY = "tk_marketing_auth_handoff";

export interface MarketingAuthHandoff {
  phone: string;
  rememberMe: boolean;
  verifiedAt: number;
  accessToken?: string | null;
  refreshToken?: string | null;
}

export function persistMarketingAuthHandoff(handoff: MarketingAuthHandoff): void {
  sessionStorage.setItem(MARKETING_AUTH_HANDOFF_KEY, JSON.stringify(handoff));
}

export function readMarketingAuthHandoff(): MarketingAuthHandoff | null {
  try {
    const raw = sessionStorage.getItem(MARKETING_AUTH_HANDOFF_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MarketingAuthHandoff;
    if (typeof parsed.phone !== "string" || parsed.phone.length !== 10) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearMarketingAuthHandoff(): void {
  sessionStorage.removeItem(MARKETING_AUTH_HANDOFF_KEY);
}

export function buildExistingAccountPagePath(phone: string, rememberMe: boolean): string {
  const params = new URLSearchParams({ phone });
  if (rememberMe) params.set("remember", "1");
  return `/login/existing?${params.toString()}`;
}

export function buildMarketingSignupRolePath(): string {
  return "/signup/role";
}
