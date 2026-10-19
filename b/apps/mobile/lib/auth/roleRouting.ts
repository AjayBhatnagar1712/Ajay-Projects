import type { Href } from "expo-router";
import { getAccountRoles, getBrokerProfile } from "../api/client";
import { routeFromBrokerProfile } from "../broker/routing";
import { markOnboardingCompleteLocal } from "./onboardingCompleteLocal";

export type AppRole = "broker" | "owner" | "tenant";

export type RoleRouteResult =
  | { kind: "href"; href: Href; role: AppRole }
  | { kind: "picker"; roles: AppRole[] };

const APP_ROLES: readonly AppRole[] = ["broker", "owner", "tenant"];

export function isAppRole(value: string | null | undefined): value is AppRole {
  return value === "broker" || value === "owner" || value === "tenant";
}

export function normalizeAppRoles(roles: readonly string[]): AppRole[] {
  const seen = new Set<AppRole>();
  const out: AppRole[] = [];
  for (const raw of roles) {
    const role = raw.trim().toLowerCase();
    if (!isAppRole(role) || seen.has(role)) continue;
    seen.add(role);
    out.push(role);
  }
  return out;
}

export function portalHomeHref(): Href {
  return "/(portal)/home" as Href;
}

export function roleLabel(role: AppRole): string {
  if (role === "broker") return "Broker";
  if (role === "owner") return "Owner";
  return "Tenant";
}

/**
 * Prefer last active role when still valid; otherwise:
 * - only broker → broker
 * - only owner/tenant (any mix) → portal role (owner preferred if both)
 * - broker + owner/tenant → picker
 * - empty → broker (new phone / onboarding)
 */
export function resolvePreferredRole(
  roles: readonly AppRole[],
  storedRole: string | null | undefined,
): AppRole | "picker" {
  if (roles.length === 0) return "broker";

  if (isAppRole(storedRole) && roles.includes(storedRole)) {
    return storedRole;
  }

  const hasBroker = roles.includes("broker");
  const portalRoles = roles.filter((r) => r === "owner" || r === "tenant");

  if (hasBroker && portalRoles.length === 0) return "broker";
  if (!hasBroker && portalRoles.length > 0) {
    return portalRoles.includes("owner") ? "owner" : "tenant";
  }
  if (hasBroker && portalRoles.length > 0) return "picker";

  return roles[0] ?? "broker";
}

export async function hrefForAppRole(role: AppRole): Promise<Href> {
  if (role === "owner" || role === "tenant") {
    return portalHomeHref();
  }
  const profile = await getBrokerProfile();
  if (profile?.onboardingCompletedAt) {
    await markOnboardingCompleteLocal();
  }
  return routeFromBrokerProfile(profile);
}

/**
 * After OTP / cold launch with a phone — pick destination from account roles
 * and last active SecureStore role.
 */
export async function resolveRoleAwareDestination(
  phone: string,
  storedRole: string | null | undefined,
): Promise<RoleRouteResult> {
  const response = await getAccountRoles(phone);
  const roles = normalizeAppRoles(response.roles);
  const preferred = resolvePreferredRole(roles, storedRole);

  if (preferred === "picker") {
    return { kind: "picker", roles };
  }

  const href = await hrefForAppRole(preferred);
  return { kind: "href", href, role: preferred };
}
