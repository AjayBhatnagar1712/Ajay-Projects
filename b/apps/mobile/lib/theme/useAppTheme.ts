import { useTheme } from "react-native-paper";
import type { TrustKeyperTheme } from "@/lib/theme/paperTheme";

/** Typed theme hook — includes TrustKeyper semantic color extensions. */
export function useAppTheme(): TrustKeyperTheme {
  return useTheme<TrustKeyperTheme>();
}
