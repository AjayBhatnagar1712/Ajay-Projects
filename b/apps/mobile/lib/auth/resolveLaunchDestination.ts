import type { Href } from "expo-router";
import { getAccountRoles } from "../api/client";
import { classifyLaunchFailure } from "./launchGate";
import {
  hasCompletedOnboardingLocal,
} from "./onboardingCompleteLocal";
import { restoreSupabaseSession, signOut } from "./phoneOtp";
import {
  hrefForAppRole,
  isAppRole,
  normalizeAppRoles,
  resolvePreferredRole,
} from "./roleRouting";
import { loadStoredSession, saveSessionIdentity } from "./secureSession";

export type LaunchDestination =
  | { status: "ready"; href: Href }
  | { status: "session_expired" }
  | { status: "error"; message: string };

/**
 * Splash gate — same incompleteness rule as Phone Back:
 *
 * - Valid session → restore + role-aware route (broker onboarding/tabs or portal).
 *   Mid-OTP / mid-onboarding with a live session never sees the carousel.
 * - No session + onboarding not complete locally → intro carousel
 *   (includes: never started, left after Get started, entered phone but never
 *   finished OTP — they never reached a signed-in session).
 * - No session + onboarding complete locally → Phone Entry (re-login).
 *
 * `introSeen` is not consulted; onboarding-completeness is the real signal.
 */
export async function resolveLaunchDestination(): Promise<LaunchDestination> {
  const t0 = Date.now();
  const onboardingComplete = await hasCompletedOnboardingLocal();
  const stored = await loadStoredSession();
  const logDev = typeof __DEV__ !== "undefined" && __DEV__;

  if (logDev) {
    console.log("[launch] gate inputs", {
      onboardingComplete,
      hasAccessToken: Boolean(stored?.accessToken),
      ms: Date.now() - t0,
    });
  }

  if (stored?.accessToken) {
    const restored = await restoreSupabaseSession();
    if (!restored) {
      await signOut();
      return { status: "session_expired" };
    }

    try {
      const routeStarted = Date.now();
      const phone = stored.phone?.replace(/\D/g, "").slice(-10) ?? "";

      // Owner/tenant with a known role — skip broker profile entirely.
      if (
        phone.length === 10 &&
        isAppRole(stored.role) &&
        (stored.role === "owner" || stored.role === "tenant")
      ) {
        const href = await hrefForAppRole(stored.role);
        if (logDev) {
          console.log("[launch] portal route", {
            role: stored.role,
            totalMs: Date.now() - t0,
            href,
          });
        }
        return { status: "ready", href };
      }

      if (phone.length === 10) {
        const rolesResponse = await getAccountRoles(phone);
        const roles = normalizeAppRoles(rolesResponse.roles);
        const preferred = resolvePreferredRole(roles, stored.role);

        if (preferred === "picker") {
          return {
            status: "ready",
            href: {
              pathname: "/(auth)/role-picker",
              params: { phone, roles: roles.join(",") },
            } as Href,
          };
        }

        await saveSessionIdentity({ phone, role: preferred });
        const href = await hrefForAppRole(preferred);
        if (logDev) {
          console.log("[launch] role-aware route", {
            roleMs: Date.now() - routeStarted,
            totalMs: Date.now() - t0,
            role: preferred,
            href,
          });
        }
        return { status: "ready", href };
      }

      // Legacy session without phone — broker path only.
      const href = await hrefForAppRole("broker");
      return { status: "ready", href };
    } catch (err) {
      if (classifyLaunchFailure(err) === "unauthenticated") {
        await signOut();
        return { status: "session_expired" };
      }
      return {
        status: "error",
        message:
          err instanceof Error ? err.message : "Could not load your profile",
      };
    }
  }

  if (!onboardingComplete) {
    return { status: "ready", href: "/(auth)/intro" };
  }

  return { status: "ready", href: "/(auth)/phone" };
}
