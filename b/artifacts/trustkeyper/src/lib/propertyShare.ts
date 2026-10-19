import type { Property } from "@/lib/properties";
import { getPropertyTitle } from "@/lib/properties";

function appBasePath(): string {
  const base = import.meta.env.BASE_URL ?? "/";
  return base.endsWith("/") ? base.slice(0, -1) : base;
}

export function getPropertyShareUrl(propertyId: string): string {
  const path = `${appBasePath()}/share/property/${propertyId}`;
  if (typeof window === "undefined") return path;
  return `${window.location.origin}${path}`;
}

function bhkLabel(property: Property): string {
  const beds = property.bedrooms?.trim();
  const baths = property.bathrooms?.trim();
  if (beds && baths) return `${beds} BHK`;
  if (beds) return `${beds} BHK`;
  return property.unitSize || "—";
}

export function buildPropertyShareMessage(property: Property): string {
  const rent = property.monthlyRent
    ? `₹${Number(property.monthlyRent).toLocaleString("en-IN")}/mo`
    : "—";
  const area = property.builtUpArea
    ? `${property.builtUpArea} ${property.builtUpUnits || ""}`.trim()
    : "—";
  const url = getPropertyShareUrl(property.id);
  const lines = [
    "Property available on TrustKeyper",
    "",
    getPropertyTitle(property),
    [property.area, property.city].filter(Boolean).join(", "),
    `BHK: ${bhkLabel(property)}`,
    `Rent: ${rent}`,
    `Area: ${area}`,
    `Furnishing: ${property.furnishing || "—"}`,
    "",
    `View details: ${url}`,
  ].filter(Boolean);
  return lines.join("\n");
}

export function getPropertyShareWhatsAppHref(property: Property, phone?: string): string {
  const message = encodeURIComponent(buildPropertyShareMessage(property));
  const digits = phone?.replace(/\D/g, "").slice(-10);
  if (digits && digits.length === 10) {
    return `https://wa.me/91${digits}?text=${message}`;
  }
  return `https://wa.me/?text=${message}`;
}
