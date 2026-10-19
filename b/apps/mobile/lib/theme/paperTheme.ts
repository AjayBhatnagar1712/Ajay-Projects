import { configureFonts, MD3LightTheme, type MD3Theme } from "react-native-paper";
import { azure, emerald, semantic } from "@/lib/theme/colors";
import { fontFamilies } from "@/lib/theme/fonts";
import { shape } from "@/lib/theme/shape";

export { shape } from "@/lib/theme/shape";

/**
 * Paper theme + extended TrustKeyper color roles.
 *
 * Paper `roundness` is a multiplier, not px:
 * - TextInput outline → 1× roundness → 8 (inputs stay 8–12, not pills)
 * - Card → 3× roundness → 24
 * - Chip → 2× roundness → 16 (needs style override for brand 24)
 * Buttons ignore Paper's 5× roundness — `lib/ui/Button` uses `shape.buttonHeight / 2`.
 */

export type TrustKeyperColors = MD3Theme["colors"] & {
  headingText: string;
  bodyText: string;
  mutedText: string;
  mutedTextAccessible: string;
  success: string;
  successContainer: string;
  onSuccess: string;
  highlight: string;
  border: string;
};

export type TrustKeyperTheme = Omit<MD3Theme, "colors"> & {
  colors: TrustKeyperColors;
};

const fonts = configureFonts({
  config: {
    displayLarge: { fontFamily: fontFamilies.generalSansBold },
    displayMedium: { fontFamily: fontFamilies.generalSansBold },
    displaySmall: { fontFamily: fontFamilies.generalSansSemibold },
    headlineLarge: { fontFamily: fontFamilies.generalSansSemibold },
    headlineMedium: { fontFamily: fontFamilies.generalSansSemibold },
    headlineSmall: { fontFamily: fontFamilies.generalSansSemibold },
    titleLarge: { fontFamily: fontFamilies.generalSansSemibold },
    titleMedium: { fontFamily: fontFamilies.generalSansMedium },
    titleSmall: { fontFamily: fontFamilies.generalSansMedium },
    bodyLarge: { fontFamily: fontFamilies.robotoRegular },
    bodyMedium: { fontFamily: fontFamilies.robotoRegular },
    bodySmall: { fontFamily: fontFamilies.robotoRegular },
    labelLarge: { fontFamily: fontFamilies.robotoMedium },
    labelMedium: { fontFamily: fontFamilies.robotoMedium },
    labelSmall: { fontFamily: fontFamilies.robotoMedium },
  },
});

export const trustKeyperTheme: TrustKeyperTheme = {
  ...MD3LightTheme,
  roundness: shape.roundness,
  fonts,
  colors: {
    ...MD3LightTheme.colors,
    primary: semantic.primary,
    onPrimary: semantic.surface,
    primaryContainer: azure[100],
    onPrimaryContainer: azure[1000],
    secondary: semantic.headingText,
    onSecondary: semantic.surface,
    secondaryContainer: azure[50],
    onSecondaryContainer: azure[900],
    tertiary: emerald[400],
    // White fails on emerald-400 (~1.97:1); navy passes (~7.60:1).
    onTertiary: semantic.onSuccess,
    tertiaryContainer: emerald[50],
    onTertiaryContainer: semantic.onSuccess,
    background: semantic.background,
    onBackground: semantic.bodyText,
    surface: semantic.surface,
    onSurface: semantic.bodyText,
    surfaceVariant: azure[50],
    onSurfaceVariant: semantic.mutedTextAccessible,
    outline: semantic.border,
    outlineVariant: azure[100],
    inverseSurface: semantic.headingText,
    inverseOnSurface: semantic.surface,
    inversePrimary: azure[300],
    error: semantic.error,
    onError: semantic.onError,
    errorContainer: semantic.errorContainer,
    onErrorContainer: semantic.onErrorContainer,
    elevation: {
      ...MD3LightTheme.colors.elevation,
      level0: "transparent",
      level1: azure[50],
      level2: "#EEF3FF",
      level3: azure[100],
      level4: azure[100],
      level5: azure[100],
    },
    headingText: semantic.headingText,
    bodyText: semantic.bodyText,
    mutedText: semantic.mutedText,
    mutedTextAccessible: semantic.mutedTextAccessible,
    success: semantic.success,
    successContainer: semantic.successContainer,
    onSuccess: semantic.onSuccess,
    highlight: semantic.highlight,
    border: semantic.border,
  },
};
