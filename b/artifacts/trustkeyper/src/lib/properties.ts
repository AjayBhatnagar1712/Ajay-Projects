import { queueCloudSync } from "./cloudSync";
import { normalizePropertyImages } from "./propertyMedia";
import { notifyPropertiesUpdated } from "./propertyEditValidation";
import { activeKey, getItem, getSessionItem, setItem, setSessionItem } from "./storageKeys";

export type PropertyStatus = "Active" | "Draft" | "Rented";

export interface Property {
  id: string;
  nickname?: string;
  address: string;
  area: string;
  city: string;
  pincode: string;
  country: string;
  ownerName: string;
  ownerContact: string;
  /** Additional owners saved from agreement flow, shown on property details. */
  coOwners?: { name: string; contact: string }[];
  propertyType: string;
  propertyTypeOther?: string;
  unitSize: string;
  unitSizeOther?: string;
  furnishing: string;
  builtUpArea: string;
  builtUpUnits: string;
  totalFloors: string;
  bedrooms: string;
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
  status: PropertyStatus;
  createdAt: number;
  uploadedBy?: "owner" | "broker";
}

const readProperties = (): Property[] => {
  if (typeof window === "undefined") return [];
  try {
    const localRaw = getItem("properties");
    const sessionRaw = getSessionItem("properties");
    const raw = localRaw ?? sessionRaw;
    return raw ? (JSON.parse(raw) as Property[]) : [];
  } catch {
    return [];
  }
};

const saveProperties = (list: Property[]): boolean => {
  try {
    const payload = JSON.stringify(list);
    const key = activeKey("properties");
    if (!key) return false;
    localStorage.setItem(key, payload);
    sessionStorage.setItem(key, payload);
    if (localStorage.getItem(key) !== payload) return false;
    queueCloudSync("properties", payload);
    notifyPropertiesUpdated();
    return true;
  } catch {
    return false;
  }
};

export function getProperties(): Property[] {
  return readProperties();
}

export function addProperty(p: Omit<Property, "id" | "createdAt" | "status"> & { status?: PropertyStatus }): Property {
  const imageFields = normalizePropertyImages(p.images ?? []);
  const property: Property = {
    ...p,
    ...imageFields,
    id: `prop_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: Date.now(),
    status: p.status ?? "Active",
  };
  const list = getProperties();
  list.unshift(property);
  if (!saveProperties(list)) {
    throw new Error("Failed to persist property");
  }
  return property;
}

export function updatePropertyStatus(id: string, status: PropertyStatus): void {
  const list = getProperties();
  const idx = list.findIndex((p) => p.id === id);
  if (idx !== -1) {
    list[idx].status = status;
    saveProperties(list);
  }
}

export function updateProperty(
  id: string,
  changes: Partial<Omit<Property, "id" | "createdAt" | "uploadedBy">>,
): boolean {
  const list = getProperties();
  const idx = list.findIndex((p) => p.id === id);
  if (idx === -1) return false;

  const nextChanges = { ...changes };
  if (nextChanges.images !== undefined) {
    Object.assign(nextChanges, normalizePropertyImages(nextChanges.images));
  } else if (nextChanges.imageCount !== undefined) {
    const currentImages = list[idx].images ?? [];
    nextChanges.imageCount = currentImages.length;
  }

  list[idx] = { ...list[idx], ...nextChanges };
  return saveProperties(list);
}

/** Derive bedroom count from BHK / RK selection captured in step 1. */
export function deriveBedroomsFromUnitSize(
  unitSize: string,
  unitSizeOther?: string,
): string {
  const source =
    unitSize === "Other" ? (unitSizeOther ?? "").trim() : unitSize.trim();
  const bhkMatch = source.match(/^(\d+)\s*BHK/i);
  if (bhkMatch) return bhkMatch[1];
  if (/^1\s*RK/i.test(source)) return "1";
  return "";
}

export function getPropertyTitle(p: Property): string {
  const type = p.propertyType === "Other" ? (p.propertyTypeOther || "Property") : p.propertyType;
  const size = p.unitSize === "Other" ? (p.unitSizeOther || "") : p.unitSize;
  const label = size ? `${size} ${type}` : type;
  const location = p.city || p.area || p.nickname || "";
  return location ? `${label} in ${location}` : label;
}
