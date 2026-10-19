/** Format paise as INR with integer math (no float drift). */
export function formatPaiseToInr(amountPaise: string | number): string {
  const paise = Math.round(Number(amountPaise));
  if (!Number.isFinite(paise)) return "—";
  const rupees = Math.floor(paise / 100);
  const remainder = paise % 100;
  const rupeesLabel = rupees.toLocaleString("en-IN");
  if (remainder > 0) {
    return `₹${rupeesLabel}.${remainder.toString().padStart(2, "0")}`;
  }
  return `₹${rupeesLabel}`;
}
