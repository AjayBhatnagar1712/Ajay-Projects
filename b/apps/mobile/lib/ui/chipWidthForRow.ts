/** Equal-width chip columns from a measured row width. */
export function chipWidthForRow(
  rowWidth: number,
  columns = 2,
  gap = 8,
): number {
  if (rowWidth <= 0 || columns <= 0) return 0;
  return Math.floor((rowWidth - gap * (columns - 1)) / columns);
}
