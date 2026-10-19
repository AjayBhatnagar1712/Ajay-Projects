import {
  isMarketingAuthRole,
  toMarketingAccountSummaries,
  type MarketingAccountSummary,
  type MarketingAuthRole,
} from "@/lib/marketingAuthRoles";

export function getMarketingApiBase(): string {
  const configured = import.meta.env.VITE_API_URL;
  if (configured) {
    const trimmed = configured.replace(/\/$/, "");
    return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
  }
  if (typeof window !== "undefined") {
    return `${window.location.origin}/api`;
  }
  return "/api";
}

export function getMarketingAppBase(): string {
  const configured = import.meta.env.VITE_APP_URL;
  if (configured) return configured.replace(/\/$/, "");
  return "https://app.trustkeyper.com";
}

export async function fetchMarketingAccountSummariesForPhone(
  phone: string,
): Promise<MarketingAccountSummary[]> {
  const digits = phone.replace(/\D/g, "").slice(-10);
  if (digits.length !== 10) return [];

  try {
    const res = await fetch(`${getMarketingApiBase()}/sync/accounts/${digits}/summaries`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      accounts?: Array<{ role?: string; displayName?: string }>;
    };
    const displayNames: Partial<Record<MarketingAuthRole, string>> = {};
    const roles: MarketingAuthRole[] = [];
    for (const account of json.accounts ?? []) {
      if (!account.role || !isMarketingAuthRole(account.role)) continue;
      roles.push(account.role);
      if (typeof account.displayName === "string" && account.displayName.trim()) {
        displayNames[account.role] = account.displayName.trim();
      }
    }
    return toMarketingAccountSummaries(roles, displayNames);
  } catch {
    return [];
  }
}

export async function fetchMarketingRolesForPhone(phone: string): Promise<MarketingAuthRole[]> {
  const digits = phone.replace(/\D/g, "").slice(-10);
  if (digits.length !== 10) return [];

  try {
    const res = await fetch(`${getMarketingApiBase()}/sync/accounts/${digits}/roles`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { roles?: string[] };
    return (json.roles ?? []).filter(isMarketingAuthRole);
  } catch {
    return [];
  }
}
