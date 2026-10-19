/** Slide duration; callers defer focus until this has elapsed. */
export const BOTTOM_SHEET_ENTER_MS = 280;

/**
 * Park the sheet this far below its rest position until onLayout measures
 * height and starts withTiming. Must not be written during render.
 */
export const BOTTOM_SHEET_OFFSCREEN_Y = 2000;

/**
 * Whether the next onLayout should start the enter animation.
 * Open edge → true; close → false; otherwise keep the current flag
 * (onLayout consumes it).
 */
export function isSheetEnterPending(
  visible: boolean,
  wasVisible: boolean,
  previousPending: boolean,
): boolean {
  if (!visible) return false;
  if (!wasVisible) return true;
  return previousPending;
}
