import type { MarketingAuthRole } from "@/lib/marketingAuthRoles";
import { getMarketingAppBase } from "@/lib/marketingAuthLookup";
import { encodeMarketingSessionHash } from "@/lib/marketingSessionHandoff";

function dashboardPathFor(role: MarketingAuthRole): string {
  switch (role) {
    case "owner":
      return "/owner/dashboard";
    case "broker":
      return "/broker/dashboard";
    case "tenant":
      return "/tenant/dashboard";
  }
}

export interface MarketingAppHandoffParams {
  phone: string;
  role: MarketingAuthRole;
  rememberMe: boolean;
  accessToken?: string | null;
  refreshToken?: string | null;
}

export function buildMarketingExistingAccountUrl({
  phone,
  role,
  rememberMe,
  accessToken,
  refreshToken,
}: MarketingAppHandoffParams): string {
  const url = new URL(getMarketingAppBase());
  url.pathname = dashboardPathFor(role);
  url.searchParams.set("phone", phone);
  url.searchParams.set("role", role);
  url.searchParams.set("from", "marketing");
  if (rememberMe) url.searchParams.set("remember", "1");
  if (accessToken) {
    url.hash = encodeMarketingSessionHash({
      access_token: accessToken,
      ...(refreshToken ? { refresh_token: refreshToken } : {}),
    });
  }
  return url.toString();
}

export function buildMarketingNewUserSignupUrl(
  phone: string,
  rememberMe: boolean,
): string {
  const url = new URL(getMarketingAppBase());
  url.pathname = "/";
  url.searchParams.set("phone", phone);
  url.searchParams.set("signup", "1");
  url.searchParams.set("from", "marketing");
  if (rememberMe) url.searchParams.set("remember", "1");
  return url.toString();
}

export function buildMarketingSignupUrl({
  phone,
  role,
  rememberMe,
}: Omit<MarketingAppHandoffParams, "accessToken" | "refreshToken">): string {
  const url = new URL(getMarketingAppBase());
  url.pathname = "/";
  url.searchParams.set("phone", phone);
  url.searchParams.set("role", role);
  url.searchParams.set("signup", "1");
  url.searchParams.set("from", "marketing");
  if (rememberMe) url.searchParams.set("remember", "1");
  return url.toString();
}
