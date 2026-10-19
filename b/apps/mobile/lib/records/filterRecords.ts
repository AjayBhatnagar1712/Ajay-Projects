import type { LeaseAgreement, PartyContactSummary } from "@/lib/api/client";
import type { PropertyRecord } from "@/lib/agreements/flow";

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

/** Digits-only for phone matching (ignores spaces / +91). */
function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function filterProperties(
  properties: readonly PropertyRecord[],
  query: string,
): PropertyRecord[] {
  const q = normalizeQuery(query);
  if (!q) return [...properties];
  return properties.filter((property) =>
    property.address.toLowerCase().includes(q),
  );
}

export function filterParties(
  parties: readonly PartyContactSummary[],
  query: string,
): PartyContactSummary[] {
  const q = normalizeQuery(query);
  if (!q) return [...parties];
  const qDigits = digitsOnly(q);
  return parties.filter((party) => {
    if (party.name.toLowerCase().includes(q)) return true;
    if (qDigits.length > 0 && digitsOnly(party.phone).includes(qDigits)) {
      return true;
    }
    return false;
  });
}

/** Client-side Agreements list filter — property address only. */
export function filterAgreementsByAddress(
  agreements: readonly LeaseAgreement[],
  query: string,
): LeaseAgreement[] {
  const q = normalizeQuery(query);
  if (!q) return [...agreements];
  return agreements.filter((agreement) => {
    const address = agreement.propertyAddress?.trim().toLowerCase() ?? "";
    return address.includes(q);
  });
}
