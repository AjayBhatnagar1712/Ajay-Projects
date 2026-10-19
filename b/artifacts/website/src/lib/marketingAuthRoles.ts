export const MARKETING_AUTH_ROLES = ["owner", "broker", "tenant"] as const;

export type MarketingAuthRole = (typeof MARKETING_AUTH_ROLES)[number];

export function isMarketingAuthRole(value: string): value is MarketingAuthRole {
  return (MARKETING_AUTH_ROLES as readonly string[]).includes(value);
}

export interface MarketingAccountSummary {
  role: MarketingAuthRole;
  displayName: string;
}

export function marketingRoleLabel(role: MarketingAuthRole): string {
  switch (role) {
    case "owner":
      return "Property Owner";
    case "broker":
      return "Broker";
    case "tenant":
      return "Tenant";
  }
}

export function marketingRolesMissingFrom(
  existing: readonly MarketingAuthRole[],
): MarketingAuthRole[] {
  const existingSet = new Set(existing);
  return MARKETING_AUTH_ROLES.filter((role) => !existingSet.has(role));
}

export function toMarketingAccountSummaries(
  roles: readonly MarketingAuthRole[],
  displayNames?: Partial<Record<MarketingAuthRole, string>>,
): MarketingAccountSummary[] {
  return roles.map((role) => ({
    role,
    displayName: displayNames?.[role]?.trim() || marketingRoleLabel(role),
  }));
}
