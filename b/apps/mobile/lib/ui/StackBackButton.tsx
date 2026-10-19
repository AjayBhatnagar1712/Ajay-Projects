import { Pressable } from "react-native";
import { Icon } from "react-native-paper";
import { useAppTheme } from "@/lib/theme/useAppTheme";
import { quietElevation } from "@/lib/ui/elevation";

type Props = {
  onPress: () => void;
  /** Defaults to "Go back". */
  accessibilityLabel?: string;
};

/**
 * Shared header back control — Phone Entry (AuthScreenLayout), StackScreenHeader,
 * and create-agreement steps. Circular 44×44 chevron-left with quiet elevation.
 */
export function StackBackButton({
  onPress,
  accessibilityLabel = "Go back",
}: Props) {
  const theme = useAppTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={4}
      style={[
        quietElevation,
        {
          width: 44,
          height: 44,
          minWidth: 44,
          minHeight: 44,
          borderRadius: 22,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: theme.colors.surface,
          borderWidth: 1,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <Icon source="chevron-left" size={24} color={theme.colors.headingText} />
    </Pressable>
  );
}
