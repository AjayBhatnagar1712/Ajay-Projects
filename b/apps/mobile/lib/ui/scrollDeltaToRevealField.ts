/**
 * How far to scroll a ScrollView so a field (window coordinates) sits inside
 * the visible scroll viewport. Pure math for Vitest.
 */
export function scrollDeltaToRevealField(options: {
  fieldY: number;
  fieldHeight: number;
  scrollViewY: number;
  scrollViewHeight: number;
  margin?: number;
}): number {
  const margin = options.margin ?? 24;
  const fieldTop = options.fieldY;
  const fieldBottom = options.fieldY + options.fieldHeight;
  const visibleTop = options.scrollViewY + margin;
  const visibleBottom =
    options.scrollViewY + options.scrollViewHeight - margin;
  if (fieldBottom > visibleBottom) return fieldBottom - visibleBottom;
  if (fieldTop < visibleTop) return fieldTop - visibleTop;
  return 0;
}
