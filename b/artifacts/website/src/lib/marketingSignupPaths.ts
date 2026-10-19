import { readMarketingAuthHandoff } from "@/lib/marketingAuthHandoff";
import type { MarketingAuthRole } from "@/lib/marketingAuthRoles";

export function buildMarketingSignupRolePath(): string {
  return "/signup/role";
}

export function buildMarketingSignupRoleFormPath(role: MarketingAuthRole): string {
  return `/signup/${role}`;
}

export function readMarketingSignupHandoffPhone(): string | null {
  return readMarketingAuthHandoff()?.phone ?? null;
}

export function requireMarketingSignupHandoff(): { phone: string; rememberMe: boolean } | null {
  const handoff = readMarketingAuthHandoff();
  if (!handoff) return null;
  return { phone: handoff.phone, rememberMe: handoff.rememberMe };
}
