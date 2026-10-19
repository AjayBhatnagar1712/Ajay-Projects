/**
 * Display-only Indian rupee formatting for Terms money fields.
 * Form / API still use plain digit strings → paise via `rupeesToPaise`.
 */

/** Strip to digits + optional single decimal (max 2 places). */
export function parseRupeesInput(text: string): string {
  const cleaned = text.replace(/[^\d.]/g, "");
  const [whole = "", ...rest] = cleaned.split(".");
  if (rest.length === 0) return whole;
  const fraction = rest.join("").slice(0, 2);
  return `${whole}.${fraction}`;
}

/** Live display: `45000` → `45,000`, `135000` → `1,35,000` (en-IN). */
export function formatRupeesDisplay(raw: string): string {
  const parsed = parseRupeesInput(raw);
  if (parsed.length === 0) return "";
  const [whole = "", fraction] = parsed.split(".");
  if (whole.length === 0) {
    return fraction !== undefined ? `0.${fraction}` : "";
  }
  const grouped = Number(whole).toLocaleString("en-IN");
  if (fraction !== undefined) return `${grouped}.${fraction}`;
  // Preserve trailing decimal while the broker is typing "45."
  if (parsed.endsWith(".")) return `${grouped}.`;
  return grouped;
}
