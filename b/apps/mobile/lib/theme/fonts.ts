/**
 * Font loading map for expo-font / useFonts.
 *
 * General Sans: self-hosted OTF copied from marketing site assets
 * (not available via @expo-google-fonts).
 *
 * Roboto: @expo-google-fonts/roboto — preferred over vendoring TTF because the
 * package is Expo-maintained, works cleanly in Expo Go, and keeps weight names
 * stable without committing large binary font files for a Google-hosted family.
 */

import {
  Roboto_400Regular,
  Roboto_500Medium,
} from "@expo-google-fonts/roboto";

export const fontFamilies = {
  generalSansRegular: "GeneralSans",
  generalSansMedium: "GeneralSans-Medium",
  generalSansSemibold: "GeneralSans-Semibold",
  generalSansBold: "GeneralSans-Bold",
  robotoRegular: "Roboto_400Regular",
  robotoMedium: "Roboto_500Medium",
} as const;

export const appFontMap = {
  [fontFamilies.generalSansRegular]: require("../../assets/fonts/GeneralSans-Regular.otf"),
  [fontFamilies.generalSansMedium]: require("../../assets/fonts/GeneralSans-Medium.otf"),
  [fontFamilies.generalSansSemibold]: require("../../assets/fonts/GeneralSans-Semibold.otf"),
  [fontFamilies.generalSansBold]: require("../../assets/fonts/GeneralSans-Bold.otf"),
  Roboto_400Regular,
  Roboto_500Medium,
} as const;
