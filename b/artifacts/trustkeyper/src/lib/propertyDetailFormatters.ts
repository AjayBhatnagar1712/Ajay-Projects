import type { Property } from "@/lib/properties";

export function formatPropertyRent(v: string): string {
  const n = Number(v);
  if (!n) return "—";
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n}`;
}

export function formatPropertyDeposit(v: string): string {
  const n = Number(v);
  if (!n) return "—";
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n}`;
}

export function formatPropertyAvailableDate(v: string): string {
  if (!v) return "Immediately";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function getPropertyDetailTitle(property: Property): string {
  const type = property.propertyType === "Other"
    ? (property.propertyTypeOther || "Property")
    : property.propertyType;
  const size = property.unitSize === "Other"
    ? (property.unitSizeOther || "")
    : property.unitSize;
  return size
    ? `${size} ${type} in ${property.nickname || property.area}`
    : `${type} in ${property.nickname || property.area}`;
}

export function getPropertyDetailTypeLabel(property: Property): string {
  return property.propertyType === "Other"
    ? (property.propertyTypeOther || "Property")
    : property.propertyType;
}
