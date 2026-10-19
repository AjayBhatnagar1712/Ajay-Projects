/** Floating pill tab bar geometry — keep content clear of the bar + system gesture area. */
export const FLOATING_TAB_BAR_HEIGHT = 64;
/**
 * Vertical clearance between the capsule and the home-indicator / safe-area edge.
 * Outer capsule uses a ~2:1 horizontal:vertical margin ratio (see HORIZONTAL).
 */
export const FLOATING_TAB_BAR_MARGIN = 12;
/**
 * Horizontal inset from screen edges. ~2× vertical margin (12 → 24) for
 * pill/capsule-shaped floating bars.
 */
export const FLOATING_TAB_BAR_HORIZONTAL = 24;

/**
 * Bottom padding for tab screen content so lists are not hidden behind the pill.
 * Callers should add `useSafeAreaInsets().bottom` on top of this.
 */
export const FLOATING_TAB_BAR_CONTENT_INSET =
  FLOATING_TAB_BAR_HEIGHT + FLOATING_TAB_BAR_MARGIN * 2;
