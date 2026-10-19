/**
 * Shape tokens for layout chrome and shared CTAs.
 *
 * Primary CTAs go through `lib/ui/Button`, which uses `buttonHeight` and
 * `borderRadius = buttonHeight / 2` so every full-width primary is the same
 * capsule (Phone Continue, OTP Verify, onboarding Next, carousel Get started, …).
 *
 * Kept free of react-native-paper so unit tests can import without Flow entry.
 */
export const shape = {
  /** Paper theme.roundness — drives input (1×) and card (3×) */
  roundness: 8,
  radiusInput: 8,
  radiusCard: 24,
  /**
   * Shared primary CTA height (pt). Matches the historical Paper Button
   * content minHeight — do not override per screen.
   */
  buttonHeight: 48,
  /** True-pill radius for CTAs — always `buttonHeight / 2`. */
  radiusButton: 24,
  radiusChip: 24,
  /**
   * Vertical gap between stacked text fields on input-heavy screens
   * (create-agreement Property, Parties, Agreement details, …).
   */
  fieldStackGap: 32,
  /** Gap between inputs inside an Agreement details section card. */
  sectionFieldGap: 24,
  /** Gap between Agreement details section cards. */
  sectionStackGap: 32,
} as const;
