import type { LeasePartyInput, LeasePartyRole } from "@workspace/api-schemas";
import { LEASE_PARTY_MAX } from "@workspace/api-schemas";
import { primaryByRole } from "./flow";

/**
 * Merge the role being edited with the opposite role from the saved detail
 * (owners first, then tenants) for PUT .../parties.
 */
export function mergeRolePartiesForSave(
  role: LeasePartyRole,
  roleParties: readonly LeasePartyInput[],
  oppositeParties: readonly LeasePartyInput[],
): LeasePartyInput[] {
  const owners = role === "owner" ? [...roleParties] : [...oppositeParties];
  const tenants = role === "tenant" ? [...roleParties] : [...oppositeParties];
  return primaryByRole([...owners, ...tenants]);
}

/** Leave room for ≥1 of the other role when that role is still empty. */
export function maxPartiesForRole(oppositeCount: number): number {
  const reservedForOpposite = Math.max(oppositeCount, 1);
  return Math.max(1, LEASE_PARTY_MAX - reservedForOpposite);
}

export function detailPartiesAsInput(
  parties: readonly {
    role: LeasePartyRole;
    name: string;
    phone: string;
    isPrimary: boolean;
    sortOrder: number;
    title: string | null;
    age: number | null;
    address: string | null;
    aadhaar: string | null;
    pan: string | null;
    email: string | null;
  }[],
): LeasePartyInput[] {
  return [...parties]
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((party) => ({
      role: party.role,
      name: party.name,
      phone: party.phone,
      isPrimary: party.isPrimary,
      sortOrder: party.sortOrder,
      title: party.title,
      age: party.age,
      address: party.address,
      aadhaar: party.aadhaar,
      pan: party.pan,
      email: party.email,
    }));
}
