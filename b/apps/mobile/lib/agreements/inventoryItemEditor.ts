export function inventoryDescriptionError(value: string): string | null {
  if (value.trim().length === 0) return "Description is required";
  return null;
}

export function inventoryQuantityError(
  value: number | null | undefined,
): string | null {
  if (value === null || value === undefined) return "Quantity is required";
  if (!Number.isInteger(value) || value < 1) {
    return "Quantity must be at least 1";
  }
  return null;
}
