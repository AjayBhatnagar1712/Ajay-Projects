import type { LeaseAgreementPdfInput, LeaseInventoryItemPdfInput, LeasePartyPdfInput } from "@workspace/lease-agreement";

type AgreementRow = {
  execution_date: string | null;
  effective_date: string | null;
  end_date: string | null;
  execution_city: string | null;
  duration_months: number | null;
  min_stay_months: number | null;
  notice_period_licensee_months: number | null;
  notice_period_licensor_months: number | null;
  monthly_rent_paise: number | null;
  security_deposit_paise: number | null;
  rent_due_day: number | null;
  property_address: string | null;
  area_sqft: string | number | null;
  facing: string | null;
  car_parking_count: number | null;
};

type PartyRow = {
  role: string;
  name: string;
  title: string | null;
  age: number | null;
  address: string | null;
  aadhaar: string | null;
  pan: string | null;
  email: string | null;
  is_primary: boolean;
  sort_order: number;
};

type InventoryRow = {
  description: string;
  quantity: number;
  sort_order: number;
};

export type LeaseAgreementPdfValidationResult =
  | { ok: true; input: LeaseAgreementPdfInput }
  | { ok: false; error: string; missing: string[] };

const AGREEMENT_REQUIRED_FIELDS: Array<{
  key: keyof AgreementRow;
  label: string;
}> = [
  { key: "execution_date", label: "execution date" },
  { key: "effective_date", label: "effective date" },
  { key: "end_date", label: "end date" },
  { key: "execution_city", label: "execution city" },
  { key: "duration_months", label: "duration in months" },
  { key: "min_stay_months", label: "minimum stay in months" },
  { key: "notice_period_licensee_months", label: "licensee notice period" },
  { key: "notice_period_licensor_months", label: "licensor notice period" },
  { key: "monthly_rent_paise", label: "monthly rent" },
  { key: "security_deposit_paise", label: "security deposit" },
  { key: "rent_due_day", label: "rent due day" },
  { key: "property_address", label: "property address" },
];

function hasValue(value: string | number | null | undefined): boolean {
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  return value !== null && value !== undefined;
}

function formatList(items: string[]): string {
  if (items.length === 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function partyLabel(party: PartyRow, index: number): string {
  const base = party.name.trim().length > 0 ? party.name.trim() : `Party ${index + 1}`;
  const role = party.role === "owner" ? "owner" : party.role === "tenant" ? "tenant" : "signer";
  return `${base} (${role})`;
}

function validatePartyCompleteness(party: PartyRow, index: number): string[] {
  const missing: string[] = [];
  if (!hasValue(party.title)) missing.push("title");
  if (!hasValue(party.age)) missing.push("age");
  if (!hasValue(party.address)) missing.push("address");
  if (!hasValue(party.aadhaar)) missing.push("Aadhaar");
  if (!hasValue(party.email)) missing.push("email");

  if (missing.length === 0) {
    return [];
  }

  return [`Add ${formatList(missing)} for ${partyLabel(party, index)}`];
}

function mapParties(parties: PartyRow[]): LeasePartyPdfInput[] {
  return parties.map((party) => ({
    role: party.role === "tenant" ? "tenant" : "owner",
    title: party.title,
    name: party.name,
    age: party.age,
    address: party.address,
    aadhaar: party.aadhaar,
    pan: party.pan,
    email: party.email,
    isPrimary: party.is_primary,
    sortOrder: party.sort_order,
  }));
}

function mapInventory(items: InventoryRow[]): LeaseInventoryItemPdfInput[] {
  return items.map((item) => ({
    description: item.description,
    quantity: item.quantity,
    sortOrder: item.sort_order,
  }));
}

export function buildLeaseAgreementPdfInput(
  agreement: AgreementRow,
  parties: PartyRow[],
  inventory: InventoryRow[],
): LeaseAgreementPdfValidationResult {
  const missing: string[] = [];

  const owners = parties.filter((party) => party.role === "owner");
  const tenants = parties.filter((party) => party.role === "tenant");
  if (parties.length < 2 || owners.length < 1 || tenants.length < 1) {
    missing.push("Add at least one owner and one tenant before previewing");
  }

  for (const field of AGREEMENT_REQUIRED_FIELDS) {
    if (!hasValue(agreement[field.key])) {
      missing.push(`Add ${field.label}`);
    }
  }

  parties.forEach((party, index) => {
    missing.push(...validatePartyCompleteness(party, index));
  });

  if (missing.length > 0) {
    return {
      ok: false,
      error: `Lease agreement draft is incomplete. ${missing.join(". ")}.`,
      missing,
    };
  }

  return {
    ok: true,
    input: {
      executionDate: agreement.execution_date ?? "",
      effectiveDate: agreement.effective_date ?? "",
      endDate: agreement.end_date ?? "",
      executionCity: agreement.execution_city ?? "",
      durationMonths: agreement.duration_months ?? 0,
      minStayMonths: agreement.min_stay_months ?? 0,
      noticePeriodLicenseeMonths: agreement.notice_period_licensee_months ?? 0,
      noticePeriodLicensorMonths: agreement.notice_period_licensor_months ?? 0,
      monthlyRentPaise: agreement.monthly_rent_paise ?? 0,
      securityDepositPaise: agreement.security_deposit_paise ?? 0,
      rentDueDay: agreement.rent_due_day ?? 0,
      propertyAddress: agreement.property_address ?? "",
      areaSqft:
        agreement.area_sqft === null ? null : Number(agreement.area_sqft),
      facing: agreement.facing,
      carParkingCount: agreement.car_parking_count,
      parties: mapParties(parties),
      inventoryItems: mapInventory(inventory),
    },
  };
}
