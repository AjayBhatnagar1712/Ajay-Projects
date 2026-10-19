/**
 * Previous create-agreement route for in-flow Back (steps 2–5).
 * Live navigation uses `goToPreviousCreateStep`; this helper stays for tests
 * and any call sites that need the path alone.
 */
export function previousCreateAgreementPath(
  step: 2 | 3 | 4 | 5,
):
  | "/(create-agreement)/property"
  | "/(create-agreement)/owners"
  | "/(create-agreement)/tenants"
  | "/(create-agreement)/inventory" {
  if (step === 2) return "/(create-agreement)/property";
  if (step === 3) return "/(create-agreement)/owners";
  if (step === 4) return "/(create-agreement)/tenants";
  return "/(create-agreement)/inventory";
}
