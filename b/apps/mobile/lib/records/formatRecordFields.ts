import type { PropertyRecord } from "@/lib/agreements/flow";

export type PropertyDetailRow = {
  label: string;
  value: string;
};

export function formatAreaSqft(areaSqft: number): string {
  return `${areaSqft.toLocaleString("en-IN")} sq ft`;
}

export function propertyCountLabel(count: number): string {
  return count === 1 ? "1 property" : `${count} properties`;
}

/** Build property card rows — omit null/empty fields entirely. */
export function propertyDetailRows(property: PropertyRecord): PropertyDetailRow[] {
  const rows: PropertyDetailRow[] = [];
  if (property.areaSqft != null) {
    rows.push({ label: "Area", value: formatAreaSqft(property.areaSqft) });
  }
  if (property.facing != null && property.facing.trim().length > 0) {
    rows.push({ label: "Facing", value: property.facing.trim() });
  }
  if (property.carParkingCount != null) {
    rows.push({
      label: "Car parking",
      value: String(property.carParkingCount),
    });
  }
  return rows;
}
