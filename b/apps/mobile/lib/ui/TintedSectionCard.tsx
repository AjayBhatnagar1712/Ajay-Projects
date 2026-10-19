import type { ReactNode } from "react";
import { View } from "react-native";
import { shape } from "@/lib/theme/shape";
import { useAppTheme } from "@/lib/theme/useAppTheme";

type Props = {
  children: ReactNode;
  /** Inner stack gap. Defaults to 16 to match Profile broker-details. */
  gap?: number;
};

/**
 * Light-blue grouping card on white create-agreement screens.
 *
 * Tokens (same recipe as Profile broker-details, TermsForm `sectionCard`,
 * and Inventory item rows):
 * - fill: `theme.colors.surfaceVariant` (azure-50 / `#F5F8FF`)
 * - radius: `shape.radiusCard` (24)
 * - padding: 16
 *
 * Do not use `FormSectionCard` here — that is the white + hairline card for
 * grey onboarding pages, where this tint is too close to the page background.
 */
export function TintedSectionCard({ children, gap = 16 }: Props) {
  const theme = useAppTheme();

  return (
    <View
      style={{
        width: "100%",
        backgroundColor: theme.colors.surfaceVariant,
        borderRadius: shape.radiusCard,
        padding: 16,
        gap,
      }}
    >
      {children}
    </View>
  );
}
