/**
 * Paper MD3 IconButton uses `size + 16` for the touchable (8px padding each side).
 * Default size 24 → 40×40 — below the 44×44pt minimum.
 */
export const PAPER_ICON_PADDING = 8;
export const MIN_ICON_BUTTON_TOUCH_PT = 44;

/** Layout size of the pressable (≥ 44, and ≥ Paper's size+16). */
export function iconButtonTouchExtent(iconSize: number): number {
  return Math.max(MIN_ICON_BUTTON_TOUCH_PT, iconSize + 2 * PAPER_ICON_PADDING);
}

/** Extra hitSlop when Paper's natural size is still under 44 (belt-and-suspenders). */
export function iconButtonHitSlop(iconSize: number): {
  top: number;
  bottom: number;
  left: number;
  right: number;
} {
  const visual = iconSize + 2 * PAPER_ICON_PADDING;
  const pad = Math.max(0, Math.ceil((MIN_ICON_BUTTON_TOUCH_PT - visual) / 2));
  return { top: pad, bottom: pad, left: pad, right: pad };
}
