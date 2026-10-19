import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addProperty, getProperties } from "./properties";

function createMemoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    key(index: number) {
      return [...data.keys()][index] ?? null;
    },
    getItem(key: string) {
      return data.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      data.set(key, value);
    },
    removeItem(key: string) {
      data.delete(key);
    },
    clear() {
      data.clear();
    },
  };
}

describe("addProperty", () => {
  let localStore: Storage;
  let sessionStore: Storage;

  beforeEach(() => {
    localStore = createMemoryStorage();
    sessionStore = createMemoryStorage();
    vi.stubGlobal("localStorage", localStore);
    vi.stubGlobal("sessionStorage", sessionStore);
    vi.stubGlobal("window", { dispatchEvent: vi.fn() });
    sessionStore.setItem("tk_active_phone", "9876543210");
    sessionStore.setItem("tk_active_role", "broker");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const baseProperty = {
    address: "12 MG Road",
    area: "Indiranagar",
    city: "Bengaluru",
    pincode: "560038",
    country: "India",
    ownerName: "Owner Name",
    ownerContact: "+919876543210",
    propertyType: "Apartment",
    unitSize: "2 BHK",
    furnishing: "Semi Furnished",
    builtUpArea: "1200",
    builtUpUnits: "sq ft",
    totalFloors: "10",
    bedrooms: "2",
    bathrooms: "2",
    balconies: "1",
    floorLevel: "5th",
    mainDoorDirection: "East",
    amenities: [] as string[],
    tenantsPreferred: ["Family"],
    monthlyRent: "25000",
    rentNegotiable: false,
    maintenanceIncluded: true,
    monthlyMaintenance: "2000",
    securityDeposit: "50000",
    availableFrom: "2026-07-01",
    images: [] as string[],
    imageCount: 0,
    uploadedBy: "broker" as const,
  };

  it("persists broker properties when session is active", () => {
    const property = addProperty(baseProperty);

    expect(property.id).toMatch(/^prop_/);
    expect(getProperties()).toHaveLength(1);
    expect(getProperties()[0]?.uploadedBy).toBe("broker");
  });

  it("fails when no active session is set", () => {
    sessionStore.clear();
    expect(() => addProperty(baseProperty)).toThrow("Failed to persist property");
  });

  it("persists broker properties with multiple image data urls", () => {
    const images = Array.from({ length: 5 }, (_, index) => `data:image/jpeg;base64,img${index}`);
    const property = addProperty({ ...baseProperty, images, imageCount: images.length });

    expect(property.imageCount).toBe(5);
    expect(getProperties()[0]?.images).toHaveLength(5);
  });
});
