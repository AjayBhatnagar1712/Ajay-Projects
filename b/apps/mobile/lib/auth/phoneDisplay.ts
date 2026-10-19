/** Keep digits only, capped at `maxLength`. */
export function digitsOnly(value: string, maxLength: number): string {
  return value.replace(/\D/g, "").slice(0, maxLength);
}

/** Display 10-digit mobile as `XXXXX XXXXX` while typing. */
export function formatIndianMobileDisplay(digits: string): string {
  const clean = digitsOnly(digits, 10);
  if (clean.length <= 5) return clean;
  return `${clean.slice(0, 5)} ${clean.slice(5)}`;
}

/** Mask for captions: `+91 98765 43210`. */
export function formatIndianMobileMasked(digits: string): string {
  const clean = digitsOnly(digits, 10);
  if (clean.length !== 10) return `+91${clean}`;
  return `+91 ${clean.slice(0, 5)} ${clean.slice(5)}`;
}
