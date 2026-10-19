import { Platform, type ViewStyle } from "react-native";

/**
 * Quiet Material-style elevation — match Home alert cards (soft, diffuse).
 *
 * iOS previously used opacity 0.08 / radius 8 / offset y=2, which read as a hard
 * edge on white cards. Softened so both platforms feel like Home.
 */
export const quietElevation: ViewStyle =
  Platform.OS === "android"
    ? { elevation: 1 }
    : {
        shadowColor: "#192839",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 10,
      };

export const quietElevationStrong: ViewStyle =
  Platform.OS === "android"
    ? { elevation: 2 }
    : {
        shadowColor: "#192839",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 14,
      };
