import type { Property } from "@/lib/properties";

export type PropertyShareSource = "broker" | "owner";

export function resolveShareSource(
  sharedByRole?: string | null,
  property?: Property | null,
): PropertyShareSource {
  if (sharedByRole === "broker" || sharedByRole === "owner") return sharedByRole;
  return property?.uploadedBy === "broker" ? "broker" : "owner";
}

export function shouldMaskOwnerDetails(sharedByRole?: string | null, property?: Property | null): boolean {
  return resolveShareSource(sharedByRole, property) === "broker";
}

/** Strip owner PII from broker-shared public property views. */
export function sanitizePropertyForPublicShare(
  property: Property,
  maskOwnerDetails: boolean,
): Property {
  if (!maskOwnerDetails) return property;
  return {
    ...property,
    ownerName: "",
    ownerContact: "",
    coOwners: [],
  };
}

export const BROKER_OWNER_MASK_MESSAGE =
  "Owner details will be shared after successful onboarding.";
