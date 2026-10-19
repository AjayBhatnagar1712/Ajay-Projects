export const SCROLL_KEYFRAMES = [0, 0.25, 0.5, 0.75, 1] as const;

export function offsetsForStrength(strength: number): number[] {
  return [
    strength * 0.6,
    -strength,
    strength * 0.4,
    -strength * 0.8,
    strength * 0.5,
  ];
}
