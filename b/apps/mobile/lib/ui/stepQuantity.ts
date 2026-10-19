/** Inventory (and any other count) stepper — never below this floor. */
export const MIN_STEPPER_VALUE = 1;

export function stepQuantity(
  current: number,
  delta: 1 | -1,
  min: number = MIN_STEPPER_VALUE,
): number {
  if (!Number.isInteger(current)) return min;
  return Math.max(min, current + delta);
}

export function canDecrementQuantity(
  current: number,
  min: number = MIN_STEPPER_VALUE,
): boolean {
  return Number.isInteger(current) && current > min;
}
