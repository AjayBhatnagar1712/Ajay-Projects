import type { Property } from "@/lib/properties";
import { propertyImagesEqual } from "./propertyMedia";

export const PROPERTIES_UPDATED_EVENT = "trustkeyper:properties-updated";

export function notifyPropertiesUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PROPERTIES_UPDATED_EVENT));
}

export interface BrokerPropertyEditDraft {
  nickname: string;
  monthlyRent: string;
  area: string;
  city: string;
}

export type ValidationResult =
  | { ok: true }
  | { ok: false; message: string; step?: number };

export function validateBrokerPropertyEditDraft(
  draft: BrokerPropertyEditDraft,
): ValidationResult {
  if (!draft.city.trim()) {
    return { ok: false, message: "City is required." };
  }
  if (!draft.area.trim()) {
    return { ok: false, message: "Area / landmark is required." };
  }
  if (draft.monthlyRent.trim()) {
    const rent = Number(draft.monthlyRent);
    if (!Number.isFinite(rent) || rent < 0) {
      return { ok: false, message: "Monthly rent must be a valid non-negative number." };
    }
  }
  return { ok: true };
}

export interface OwnerPropertyEditPayload {
  nickname: string;
  address: string;
  area: string;
  city: string;
  pincode: string;
  country: string;
  ownerName: string;
  ownerContact: string;
  propertyType: string;
  propertyTypeOther: string;
  unitSize: string;
  unitSizeOther: string;
  furnishing: string;
  builtUpArea: string;
  builtUpUnits: string;
  totalFloors: string;
  bathrooms: string;
  balconies: string;
  floorLevel: string;
  mainDoorDirection: string;
  amenities: string[];
  tenantsPreferred: string[];
  monthlyRent: string;
  rentNegotiable: boolean;
  maintenanceIncluded: boolean;
  monthlyMaintenance: string;
  securityDeposit: string;
  availableFrom: string;
  images: string[];
  imageCount: number;
  bedrooms: string;
}

export function propertyToEditPayload(property: Property): OwnerPropertyEditPayload {
  return {
    nickname: property.nickname ?? "",
    address: property.address ?? "",
    area: property.area ?? "",
    city: property.city ?? "",
    pincode: property.pincode ?? "",
    country: property.country ?? "",
    ownerName: property.ownerName ?? "",
    ownerContact: property.ownerContact ?? "",
    propertyType: property.propertyType ?? "",
    propertyTypeOther: property.propertyTypeOther ?? "",
    unitSize: property.unitSize ?? "",
    unitSizeOther: property.unitSizeOther ?? "",
    furnishing: property.furnishing ?? "",
    builtUpArea: property.builtUpArea ?? "",
    builtUpUnits: property.builtUpUnits ?? "sq ft",
    totalFloors: property.totalFloors ?? "",
    bathrooms: property.bathrooms ?? "",
    balconies: property.balconies ?? "",
    floorLevel: property.floorLevel ?? "",
    mainDoorDirection: property.mainDoorDirection ?? "",
    amenities: property.amenities ?? [],
    tenantsPreferred: property.tenantsPreferred ?? [],
    monthlyRent: property.monthlyRent ?? "",
    rentNegotiable: property.rentNegotiable ?? false,
    maintenanceIncluded: property.maintenanceIncluded ?? false,
    monthlyMaintenance: property.monthlyMaintenance ?? "",
    securityDeposit: property.securityDeposit ?? "",
    availableFrom: property.availableFrom ?? "",
    images: property.images ?? [],
    imageCount: property.imageCount ?? property.images?.length ?? 0,
    bedrooms: property.bedrooms ?? "",
  };
}

function isValidPhone(contact: string): boolean {
  const digits = contact.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 12;
}

function validateOwnerPropertyDetailsStep(
  payload: OwnerPropertyEditPayload,
): ValidationResult {
  if (!payload.address.trim()) {
    return { ok: false, message: "Address is required.", step: 0 };
  }
  if (!payload.area.trim()) {
    return { ok: false, message: "Area is required.", step: 0 };
  }
  if (!payload.city.trim()) {
    return { ok: false, message: "City is required.", step: 0 };
  }
  if (!/^\d{6}$/.test(payload.pincode)) {
    return { ok: false, message: "Enter a valid 6-digit pincode.", step: 0 };
  }
  if (!payload.country.trim()) {
    return { ok: false, message: "Country is required.", step: 0 };
  }
  if (!isValidPhone(payload.ownerContact)) {
    return { ok: false, message: "Enter a valid owner phone number.", step: 0 };
  }
  return { ok: true };
}

function validateOwnerPropertyTypeStep(
  payload: OwnerPropertyEditPayload,
): ValidationResult {
  const typeOk =
    payload.propertyType !== "" &&
    (payload.propertyType !== "Other" || payload.propertyTypeOther.trim() !== "");
  if (!typeOk) {
    return { ok: false, message: "Select a property type.", step: 1 };
  }

  const sizeOk =
    payload.unitSize !== "" &&
    (payload.unitSize !== "Other" || payload.unitSizeOther.trim() !== "");
  if (!sizeOk) {
    return { ok: false, message: "Select a unit size.", step: 1 };
  }
  if (!payload.furnishing.trim()) {
    return { ok: false, message: "Select furnishing.", step: 1 };
  }
  return { ok: true };
}

function validateOwnerPropertyDimensionsStep(
  payload: OwnerPropertyEditPayload,
): ValidationResult {
  if (
    !payload.builtUpArea.trim() ||
    !payload.builtUpUnits.trim() ||
    !payload.totalFloors.trim() ||
    !payload.bathrooms.trim() ||
    !payload.balconies.trim() ||
    !payload.floorLevel.trim() ||
    !payload.mainDoorDirection.trim()
  ) {
    return { ok: false, message: "Complete all dimension fields.", step: 2 };
  }
  return { ok: true };
}

function validateOwnerPropertyRentalStep(
  payload: OwnerPropertyEditPayload,
): ValidationResult {
  if (payload.tenantsPreferred.length === 0) {
    return { ok: false, message: "Select at least one tenant preference.", step: 4 };
  }
  if (!payload.monthlyRent.trim()) {
    return { ok: false, message: "Monthly rent is required.", step: 4 };
  }
  const rent = Number(payload.monthlyRent);
  if (!Number.isFinite(rent) || rent < 0) {
    return { ok: false, message: "Monthly rent must be a valid number.", step: 4 };
  }
  if (!payload.securityDeposit.trim()) {
    return { ok: false, message: "Security deposit is required.", step: 4 };
  }
  const deposit = Number(payload.securityDeposit);
  if (!Number.isFinite(deposit) || deposit < 0) {
    return { ok: false, message: "Security deposit must be a valid number.", step: 4 };
  }
  if (!payload.availableFrom.trim()) {
    return { ok: false, message: "Available from date is required.", step: 4 };
  }
  return { ok: true };
}

function validateOwnerPropertyImagesStep(
  payload: OwnerPropertyEditPayload,
): ValidationResult {
  if (payload.images.length === 0) {
    return { ok: false, message: "Upload at least one property image.", step: 5 };
  }
  return { ok: true };
}

/** Validates only the fields shown on the current owner edit wizard sub-step. */
export function validateOwnerPropertyEditPayloadForSubStep(
  subStep: number,
  payload: OwnerPropertyEditPayload,
): ValidationResult {
  if (subStep === 0) return validateOwnerPropertyDetailsStep(payload);
  if (subStep === 1) return validateOwnerPropertyTypeStep(payload);
  if (subStep === 2) return validateOwnerPropertyDimensionsStep(payload);
  if (subStep === 3) return { ok: true };
  if (subStep === 4) return validateOwnerPropertyRentalStep(payload);
  if (subStep === 5) return validateOwnerPropertyImagesStep(payload);
  return { ok: true };
}

export function validateOwnerPropertyEditPayload(
  payload: OwnerPropertyEditPayload,
): ValidationResult {
  const steps = [
    validateOwnerPropertyDetailsStep(payload),
    validateOwnerPropertyTypeStep(payload),
    validateOwnerPropertyDimensionsStep(payload),
    validateOwnerPropertyRentalStep(payload),
    validateOwnerPropertyImagesStep(payload),
  ];
  for (const result of steps) {
    if (!result.ok) return result;
  }
  return { ok: true };
}

export function editPayloadsEqual(
  a: OwnerPropertyEditPayload,
  b: OwnerPropertyEditPayload,
): boolean {
  if (!propertyImagesEqual(a.images, b.images)) return false;
  if (a.imageCount !== b.imageCount) return false;

  const { images: _aImages, imageCount: _aCount, ...aRest } = a;
  const { images: _bImages, imageCount: _bCount, ...bRest } = b;
  return JSON.stringify(aRest) === JSON.stringify(bRest);
}

export function brokerDraftsEqual(
  a: BrokerPropertyEditDraft,
  b: BrokerPropertyEditDraft,
): boolean {
  return (
    a.nickname === b.nickname &&
    a.monthlyRent === b.monthlyRent &&
    a.area === b.area &&
    a.city === b.city
  );
}
