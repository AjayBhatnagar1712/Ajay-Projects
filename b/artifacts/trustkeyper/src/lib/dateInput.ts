/** Today's date as YYYY-MM-DD in local timezone (for <input type="date" min>). */
export function todayLocalDateInputMin(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
