/**
 * Returning tenants always land on the dashboard after sign-in.
 * Document upload links remain available from workspace notifications.
 */
export function resolveTenantPostLoginRoute(phone: string): string {
  void phone;
  return "/tenant/dashboard";
}
