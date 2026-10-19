/**
 * Shared TextAreaField sizing — keep compact vs address fields on one formula.
 * Historical 4-line field used minHeight 88 → 22pt per line.
 */
export const TEXT_AREA_LINE_HEIGHT = 22;
export const TEXT_AREA_DEFAULT_LINES = 4;
export const TEXT_AREA_COMPACT_LINES = 2;
export const TEXT_AREA_MIN_CONTENT_HEIGHT = 44;

export function textAreaContentMinHeight(numberOfLines: number): number {
  if (!Number.isInteger(numberOfLines) || numberOfLines < 1) {
    return TEXT_AREA_MIN_CONTENT_HEIGHT;
  }
  return Math.max(
    TEXT_AREA_MIN_CONTENT_HEIGHT,
    numberOfLines * TEXT_AREA_LINE_HEIGHT,
  );
}
