/**
 * Shared outlined TextInput chrome — Paper floating-label fields
 * (TextField, TextAreaField, MoneyField, SelectField).
 */
import { fontFamilies } from "@/lib/theme/fonts";
import type { TrustKeyperTheme } from "@/lib/theme/paperTheme";

export function outlinedFieldStyle(theme: TrustKeyperTheme) {
  return { backgroundColor: theme.colors.surface } as const;
}

export const outlinedFieldContentStyle = {
  fontFamily: fontFamilies.robotoRegular,
  fontSize: 16,
} as const;
