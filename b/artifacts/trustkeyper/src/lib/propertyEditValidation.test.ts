import { describe, it, expect } from "vitest";
import {
  brokerDraftsEqual,
  propertyToEditPayload,
  validateBrokerPropertyEditDraft,
  validateOwnerPropertyEditPayload,
  validateOwnerPropertyEditPayloadForSubStep,
  type OwnerPropertyEditPayload,
} from "./propertyEditValidation";
import type { Property } from "@/lib/properties";

const baseOwnerPayload = (): OwnerPropertyEditPayload => ({
  nickname: "Sunny",
  address: "123 Main St",
  area: "Madhapur",
  city: "Hyderabad",
  pincode: "500081",
  country: "India",
  ownerName: "Owner",
  ownerContact: "+919876543210",
  propertyType: "Apartment",
  propertyTypeOther: "",
  unitSize: "2 BHK",
  unitSizeOther: "",
  furnishing: "Semi Furnished",
  builtUpArea: "1200",
  builtUpUnits: "sq ft",
  totalFloors: "10",
  bathrooms: "2",
  balconies: "1",
  floorLevel: "5th",
  mainDoorDirection: "East",
  amenities: ["Gym"],
  tenantsPreferred: ["Family"],
  monthlyRent: "25000",
  rentNegotiable: false,
  maintenanceIncluded: false,
  monthlyMaintenance: "",
  securityDeposit: "50000",
  availableFrom: "2026-07-01",
  images: ["data:image/png;base64,abc"],
  imageCount: 1,
  bedrooms: "2",
});

describe("validateBrokerPropertyEditDraft", () => {
  it("accepts valid broker edit draft", () => {
    const result = validateBrokerPropertyEditDraft({
      nickname: "Flat A",
      monthlyRent: "30000",
      area: "Gachibowli",
      city: "Hyderabad",
    });
    expect(result.ok).toBe(true);
  });

  it("rejects invalid rent", () => {
    const result = validateBrokerPropertyEditDraft({
      nickname: "",
      monthlyRent: "-1",
      area: "Gachibowli",
      city: "Hyderabad",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("rent");
  });
});

describe("validateOwnerPropertyEditPayloadForSubStep", () => {
  it("validates step 0 without requiring images", () => {
    const payload = baseOwnerPayload();
    payload.images = [];
    expect(validateOwnerPropertyEditPayloadForSubStep(0, payload).ok).toBe(true);
  });

  it("rejects step 5 when images are missing", () => {
    const payload = baseOwnerPayload();
    payload.images = [];
    const result = validateOwnerPropertyEditPayloadForSubStep(5, payload);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.step).toBe(5);
  });

  it("accepts optional amenities on step 3", () => {
    const payload = baseOwnerPayload();
    payload.amenities = [];
    expect(validateOwnerPropertyEditPayloadForSubStep(3, payload).ok).toBe(true);
  });
});

describe("validateOwnerPropertyEditPayload", () => {
  it("accepts complete owner payload", () => {
    expect(validateOwnerPropertyEditPayload(baseOwnerPayload()).ok).toBe(true);
  });

  it("rejects missing pincode", () => {
    const payload = baseOwnerPayload();
    payload.pincode = "12";
    const result = validateOwnerPropertyEditPayload(payload);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.step).toBe(0);
  });
});

describe("propertyToEditPayload", () => {
  it("maps property fields for discard baseline", () => {
    const property: Property = {
      id: "prop_1",
      nickname: "Home",
      address: "Addr",
      area: "Area",
      city: "City",
      pincode: "500001",
      country: "India",
      ownerName: "O",
      ownerContact: "+911234567890",
      propertyType: "Apartment",
      unitSize: "2 BHK",
      furnishing: "Unfurnished",
      builtUpArea: "1000",
      builtUpUnits: "sq ft",
      totalFloors: "5",
      bedrooms: "2",
      bathrooms: "2",
      balconies: "1",
      floorLevel: "2nd",
      mainDoorDirection: "North",
      amenities: [],
      tenantsPreferred: ["Family"],
      monthlyRent: "20000",
      rentNegotiable: false,
      maintenanceIncluded: false,
      monthlyMaintenance: "",
      securityDeposit: "40000",
      availableFrom: "2026-01-01",
      images: [],
      imageCount: 0,
      status: "Active",
      createdAt: Date.now(),
    };
    const payload = propertyToEditPayload(property);
    expect(payload.city).toBe("City");
    expect(payload.monthlyRent).toBe("20000");
  });
});

describe("brokerDraftsEqual", () => {
  it("detects unchanged broker drafts", () => {
    const draft = { nickname: "A", monthlyRent: "1", area: "B", city: "C" };
    expect(brokerDraftsEqual(draft, { ...draft })).toBe(true);
    expect(brokerDraftsEqual(draft, { ...draft, city: "D" })).toBe(false);
  });
});
