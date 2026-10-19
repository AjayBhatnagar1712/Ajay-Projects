import {
  isValidAadhaarNumber,
  LeaseAgreementPatchSchema,
  LeaseInventoryReplaceSchema,
  LeasePartiesReplaceSchema,
  type LeaseAgreementPatch,
  type LeaseInventoryReplace,
  type LeasePartiesReplace,
  type LeasePartyInput,
} from "@workspace/api-schemas";
import { primaryByRole } from "./flow";

/** Stable JSON for dirty-checking autosave payloads. */
export function serializeAutosavePayload(payload: unknown): string {
  return JSON.stringify(payload);
}

function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Parties autosave: bypass PartyCreationSchema (title/age/aadhaar/email can be
 * null mid-edit) but still must satisfy API LeasePartiesReplaceSchema.
 * Invalid optional KYC mid-type is stripped to null so a partial save can land.
 * Returns null when the set isn't API-saveable yet (e.g. incomplete phone).
 */
export function buildPartiesAutosavePayload(
  parties: readonly LeasePartyInput[],
): LeasePartiesReplace | null {
  const sanitized = primaryByRole([...parties]).map((party) => {
    const aadhaarDigits = (party.aadhaar ?? "").replace(/\s+/g, "");
    const pan = emptyToNull(party.pan);
    const email = emptyToNull(party.email);
    return {
      role: party.role,
      name: party.name.trim(),
      phone: party.phone.trim(),
      isPrimary: party.isPrimary,
      sortOrder: party.sortOrder,
      title: emptyToNull(party.title),
      age:
        party.age !== null &&
        party.age !== undefined &&
        Number.isInteger(party.age) &&
        party.age >= 18 &&
        party.age <= 120
          ? party.age
          : null,
      address: emptyToNull(party.address),
      aadhaar: isValidAadhaarNumber(aadhaarDigits) ? aadhaarDigits.replace(/\D/g, "") : null,
      pan: pan && /^[A-Z]{5}[0-9]{4}[A-Z]$/i.test(pan) ? pan.toUpperCase() : null,
      email:
        email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null,
    };
  });

  const parsed = LeasePartiesReplaceSchema.safeParse({ parties: sanitized });
  return parsed.success ? parsed.data : null;
}

/**
 * Property autosave PATCH — only include fields that already look API-valid.
 * Empty / mid-edit values are omitted (not sent as "").
 */
export function buildPropertyAutosavePatch(values: {
  propertyAddress: string;
  areaSqft: string;
  facing: string;
  carParkingCount: string;
}): LeaseAgreementPatch | null {
  const patch: LeaseAgreementPatch = {};
  const address = values.propertyAddress.trim();
  if (address.length > 0) {
    patch.propertyAddress = address;
  }
  const area = Number(values.areaSqft);
  if (values.areaSqft.trim() !== "" && Number.isFinite(area) && area >= 0) {
    patch.areaSqft = area;
  }
  const facing = values.facing.trim();
  if (facing.length > 0) {
    patch.facing = facing;
  }
  const parking = Number(values.carParkingCount);
  if (
    values.carParkingCount.trim() !== "" &&
    Number.isInteger(parking) &&
    parking >= 0 &&
    parking <= 100
  ) {
    patch.carParkingCount = parking;
  }

  const parsed = LeaseAgreementPatchSchema.safeParse(patch);
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    return null;
  }
  return parsed.data;
}

/**
 * Fixtures & fittings autosave — drop blank rows; empty list is a valid clear.
 * Quantity defaults to 1 when missing/invalid so partial rows can still save.
 */
export function buildInventoryAutosavePayload(
  items: readonly { description: string; quantity?: number | null }[],
): LeaseInventoryReplace | null {
  const cleaned = items
    .map((item) => {
      const description = item.description.trim();
      const quantity =
        typeof item.quantity === "number" &&
        Number.isInteger(item.quantity) &&
        item.quantity >= 1
          ? item.quantity
          : 1;
      return { description, quantity };
    })
    .filter((item) => item.description.length > 0)
    .map((item, index) => ({
      description: item.description,
      quantity: item.quantity,
      sortOrder: index,
    }));

  const parsed = LeaseInventoryReplaceSchema.safeParse({ items: cleaned });
  return parsed.success ? parsed.data : null;
}

/**
 * Terms autosave PATCH — send only fields that coerce cleanly; skip
 * endDate/effectiveDate pair when end ≤ start so the whole patch isn't rejected.
 * Duration is expected to be pre-computed from Start/End by the form.
 */
export function buildTermsAutosavePatch(values: {
  executionDate: string;
  effectiveDate: string;
  endDate: string;
  executionCity: string;
  durationMonths: string;
  minStayMonths: string;
  noticePeriodLicenseeMonths: string;
  noticePeriodLicensorMonths: string;
  monthlyRentRupees: string;
  securityDepositRupees: string;
  brokerageFeeRupees?: string;
  maintenanceIncluded: boolean;
  monthlyMaintenanceRupees: string;
  rentDueDay: string;
}): LeaseAgreementPatch | null {
  const patch: LeaseAgreementPatch = {};
  const ymd = /^\d{4}-\d{2}-\d{2}$/;

  if (ymd.test(values.executionDate)) {
    patch.executionDate = values.executionDate;
  }
  if (ymd.test(values.effectiveDate)) {
    patch.effectiveDate = values.effectiveDate;
  }
  if (ymd.test(values.endDate)) {
    patch.endDate = values.endDate;
  }
  const city = values.executionCity.trim();
  if (city.length > 0) {
    patch.executionCity = city;
  }

  function optionalInt(
    raw: string,
    min: number,
    max: number,
  ): number | undefined {
    if (raw.trim() === "") return undefined;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < min || n > max) return undefined;
    return n;
  }

  const duration = optionalInt(values.durationMonths, 1, 600);
  if (duration !== undefined) patch.durationMonths = duration;
  const minStay = optionalInt(values.minStayMonths, 0, 600);
  if (minStay !== undefined) patch.minStayMonths = minStay;
  const noticeLicensee = optionalInt(values.noticePeriodLicenseeMonths, 0, 120);
  if (noticeLicensee !== undefined) {
    patch.noticePeriodLicenseeMonths = noticeLicensee;
  }
  const noticeLicensor = optionalInt(values.noticePeriodLicensorMonths, 0, 120);
  if (noticeLicensor !== undefined) {
    patch.noticePeriodLicensorMonths = noticeLicensor;
  }
  patch.rentDueDay = 5;

  function rupeesToPaiseField(raw: string): number | undefined {
    if (raw.trim() === "") return undefined;
    const n = Number(raw.replace(/,/g, ""));
    if (!Number.isFinite(n) || n < 0) return undefined;
    return Math.round(n * 100);
  }
  const rentPaise = rupeesToPaiseField(values.monthlyRentRupees);
  if (rentPaise !== undefined) patch.monthlyRentPaise = rentPaise;
  const depositPaise = rupeesToPaiseField(values.securityDepositRupees);
  if (depositPaise !== undefined) patch.securityDepositPaise = depositPaise;

  if (values.brokerageFeeRupees !== undefined) {
    if (values.brokerageFeeRupees.trim() === "") {
      patch.brokerageFeePaise = null;
    } else {
      const brokeragePaise = rupeesToPaiseField(values.brokerageFeeRupees);
      if (brokeragePaise !== undefined) patch.brokerageFeePaise = brokeragePaise;
    }
  }

  patch.maintenanceIncluded = values.maintenanceIncluded;
  if (values.maintenanceIncluded) {
    patch.monthlyMaintenancePaise = null;
  } else {
    const maintenancePaise = rupeesToPaiseField(values.monthlyMaintenanceRupees);
    if (maintenancePaise !== undefined) {
      patch.monthlyMaintenancePaise = maintenancePaise;
    }
  }

  // Avoid sending a failing end/effective pair — drop endDate until valid.
  if (
    patch.effectiveDate != null &&
    patch.endDate != null &&
    new Date(`${patch.endDate}T00:00:00Z`).getTime() <=
      new Date(`${patch.effectiveDate}T00:00:00Z`).getTime()
  ) {
    delete patch.endDate;
  }

  const parsed = LeaseAgreementPatchSchema.safeParse(patch);
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    return null;
  }
  return parsed.data;
}
