import type { ReactNode } from "react";
import { View } from "react-native";
import { shape } from "@/lib/theme/shape";
import { useAppTheme } from "@/lib/theme/useAppTheme";
import { quietElevation } from "@/lib/ui/elevation";

type Props = {
  children: ReactNode;
};

/**
 * Form section card — same radius/padding/gap recipe as TermsForm section cards,
 * but uses `surface` (#FFFFFF) + hairline border (RecordCard / Home pattern) so
 * the block reads clearly on the grey page background (`#F8FAFC`).
 *
 * TermsForm still uses `surfaceVariant` (#F5F8FF); that tint is too close to the
 * page grey for onboarding section grouping.
 */
export function FormSectionCard({ children }: Props) {
  const theme = useAppTheme();

  return (
    <View
      style={[
        quietElevation,
        {
          width: "100%",
          backgroundColor: theme.colors.surface,
          borderRadius: shape.radiusCard,
          borderWidth: 1,
          borderColor: theme.colors.border,
          padding: 12,
          gap: shape.sectionFieldGap,
        },
      ]}
    >
      {children}
    </View>
  );
}
